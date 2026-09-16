import type { EpiRecord, FieldDefinition, RecordValue } from "../contracts/core.ts";
import { parseClassicProgram, type ClassicLogisticStatement } from "./classic-ast.ts";

export const CLASSIC_CONDITIONAL_LOGISTIC_VERSION = "classic-conditional-logistic-v0.1.0" as const;

export interface ClassicConditionalLogisticPlan {
  version: typeof CLASSIC_CONDITIONAL_LOGISTIC_VERSION;
  outcomeField: string;
  predictorFields: string[];
  matchField: string;
  confidenceLevel: 0.95;
  title?: string;
  canonicalSource: string;
}

export interface ClassicConditionalLogisticCoefficient {
  field: string;
  coefficient: number;
  standardError: number;
  oddsRatio: number;
  confidenceInterval: { lower: number; upper: number };
  z: number;
  pValue: number;
}

export interface ClassicConditionalLogisticResult {
  version: typeof CLASSIC_CONDITIONAL_LOGISTIC_VERSION;
  operation: "epi.logistic.conditional";
  plan: ClassicConditionalLogisticPlan;
  coefficients: ClassicConditionalLogisticCoefficient[];
  fit: {
    converged: boolean;
    iterations: number;
    logLikelihood: number;
    nullLogLikelihood: number;
    likelihoodRatio: number;
    degreesOfFreedom: number;
    pValue: number;
  };
  totals: {
    sourceRecords: number;
    sourceSets: number;
    includedRecords: number;
    includedSets: number;
    informativeSets: number;
    excludedRecords: number;
    excludedSets: number;
  };
  exclusions: {
    missingValueSets: number;
    invalidOutcomeSets: number;
    invalidPredictorSets: number;
    invalidCompositionSets: number;
    oversizedSets: number;
  };
  diagnostics: { warnings: string[] };
}

const MAX_RECORDS = 100_000;
const MAX_SETS = 50_000;
const MAX_SET_SIZE = 20;
const MAX_PREDICTORS = 10;
const MAX_ITERATIONS = 50;
const TOLERANCE = 1e-9;
const Z_95 = 1.959963984540054;

function fieldToken(name: string): string {
  if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name)) return name;
  const escaped = name.replaceAll("]", "]]");
  return `[${escaped}]`;
}

function resolvedField(fields: readonly FieldDefinition[], requested: string): FieldDefinition {
  const field = fields.find((candidate) => candidate.name.toLocaleLowerCase("en-US") === requested.toLocaleLowerCase("en-US"));
  if (!field) throw new RangeError(`${requested} is not a field in the current form.`);
  return field;
}

export function parseClassicLogisticCommand(source: string): ClassicLogisticStatement {
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "LogisticStatement") throw new RangeError("Select exactly one complete LOGISTIC command.");
  return ast.body[0];
}

export function resolveClassicConditionalLogisticCommand(
  source: string,
  fields: readonly FieldDefinition[],
): ClassicConditionalLogisticPlan {
  const statement = parseClassicLogisticCommand(source);
  if (!statement.matchBy) throw new RangeError("This first executable LOGISTIC slice requires MATCHVAR for conditional logistic regression; ordinary logistic regression remains fail-closed.");
  if (statement.weightBy) throw new RangeError("Conditional LOGISTIC WEIGHTVAR remains syntax-only in V0.1.");
  if (statement.outputTable) throw new RangeError("Conditional LOGISTIC OUTTABLE remains syntax-only in V0.1.");
  if (statement.linkFunction) throw new RangeError("LINKFUNCTION=LOG requests log-binomial regression and cannot be combined with this conditional-logistic slice.");
  if (statement.confidenceLevel !== undefined && statement.confidenceLevel !== 0.95) throw new RangeError("Conditional LOGISTIC V0.1 supports 95% confidence limits only.");
  if (statement.terms.some((term) => term.factors.length !== 1 || term.factors[0]!.categorical)) {
    throw new RangeError("Conditional LOGISTIC V0.1 accepts simple numeric or binary predictor fields only; categorical expansion and interaction terms remain fail-closed.");
  }
  if (statement.terms.length > MAX_PREDICTORS) throw new RangeError(`Conditional LOGISTIC V0.1 accepts at most ${MAX_PREDICTORS} predictors.`);
  const outcome = resolvedField(fields, statement.outcome.name);
  const match = resolvedField(fields, statement.matchBy.name);
  const predictors = statement.terms.map((term) => resolvedField(fields, term.factors[0]!.field.name));
  if (predictors.some((field) => field.type !== "number")) throw new RangeError("Conditional LOGISTIC V0.1 predictors must be Number fields.");
  if (outcome.type === "command-button" || match.type === "command-button") throw new RangeError("LOGISTIC outcome and MATCHVAR cannot be command-button fields.");
  const names = [outcome.name, match.name, ...predictors.map(({ name }) => name)];
  if (new Set(names.map((name) => name.toLocaleLowerCase("en-US"))).size !== names.length) {
    throw new RangeError("LOGISTIC outcome, MATCHVAR, and predictor fields must be distinct, and predictors may appear only once.");
  }
  const predictorFields = predictors.map(({ name }) => name);
  const canonicalSource = `LOGISTIC ${fieldToken(outcome.name)} = ${predictorFields.map(fieldToken).join(" ")} MATCHVAR=${fieldToken(match.name)}${statement.noIntercept ? " NOINTERCEPT" : ""}${statement.title !== undefined ? ` TITLETEXT=${JSON.stringify(statement.title)}` : ""}`;
  return {
    version: CLASSIC_CONDITIONAL_LOGISTIC_VERSION,
    outcomeField: outcome.name,
    predictorFields,
    matchField: match.name,
    confidenceLevel: 0.95,
    ...(statement.title !== undefined ? { title: statement.title } : {}),
    canonicalSource,
  };
}

function missing(value: RecordValue | undefined): boolean {
  return value === null || value === undefined || (typeof value === "string" && !value.trim());
}

function binary(value: RecordValue | undefined): 0 | 1 | null | "invalid" {
  if (missing(value)) return null;
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;
  if (typeof value !== "string") return "invalid";
  const normalized = value.trim().toLocaleLowerCase("en-US");
  if (normalized === "1" || normalized === "yes") return 1;
  if (normalized === "0" || normalized === "no") return 0;
  return "invalid";
}

function numeric(value: RecordValue | undefined): number | null | "invalid" {
  if (missing(value)) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : "invalid";
  if (typeof value !== "string") return "invalid";
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : "invalid";
}

interface LogisticRow { outcome: 0 | 1; predictors: number[] }
interface LogisticSet { rows: LogisticRow[] }

function solve(matrix: number[][], vector: number[]): number[] {
  const n = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]!]);
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) if (Math.abs(augmented[row]![column]!) > Math.abs(augmented[pivot]![column]!)) pivot = row;
    if (Math.abs(augmented[pivot]![column]!) < 1e-12) throw new RangeError("Conditional LOGISTIC information matrix is singular; remove redundant or non-varying predictors.");
    [augmented[column], augmented[pivot]] = [augmented[pivot]!, augmented[column]!];
    const divisor = augmented[column]![column]!;
    for (let j = column; j <= n; j++) augmented[column]![j] = augmented[column]![j]! / divisor;
    for (let row = 0; row < n; row++) {
      if (row === column) continue;
      const factor = augmented[row]![column]!;
      for (let j = column; j <= n; j++) augmented[row]![j] = augmented[row]![j]! - factor * augmented[column]![j]!;
    }
  }
  return augmented.map((row) => row[n]!);
}

function inverse(matrix: number[][]): number[][] {
  return matrix.map((_, column) => solve(matrix, matrix.map((__, row) => row === column ? 1 : 0)));
}

function dot(left: readonly number[], right: readonly number[]): number {
  return left.reduce((total, value, index) => total + value * right[index]!, 0);
}

function evaluate(sets: readonly LogisticSet[], beta: readonly number[]): { logLikelihood: number; gradient: number[]; information: number[][]; informative: number } {
  const p = beta.length;
  const gradient = Array(p).fill(0) as number[];
  const information = Array.from({ length: p }, () => Array(p).fill(0) as number[]);
  let logLikelihood = 0;
  let informative = 0;
  for (const set of sets) {
    const etas = set.rows.map((row) => dot(row.predictors, beta));
    const maximum = Math.max(...etas);
    const weights = etas.map((eta) => Math.exp(eta - maximum));
    const denominator = weights.reduce((sum, value) => sum + value, 0);
    const probabilities = weights.map((weight) => weight / denominator);
    const caseRow = set.rows.find((row) => row.outcome === 1)!;
    const mean = Array(p).fill(0) as number[];
    set.rows.forEach((row, rowIndex) => row.predictors.forEach((value, index) => { mean[index] = mean[index]! + probabilities[rowIndex]! * value; }));
    caseRow.predictors.forEach((value, index) => { gradient[index] = gradient[index]! + value - mean[index]!; });
    let trace = 0;
    set.rows.forEach((row, rowIndex) => {
      for (let j = 0; j < p; j++) for (let k = 0; k < p; k++) {
        const contribution = probabilities[rowIndex]! * (row.predictors[j]! - mean[j]!) * (row.predictors[k]! - mean[k]!);
        information[j]![k] = information[j]![k]! + contribution;
        if (j === k) trace += contribution;
      }
    });
    if (trace > 1e-12) informative++;
    logLikelihood += dot(caseRow.predictors, beta) - maximum - Math.log(denominator);
  }
  return { logLikelihood, gradient, information, informative };
}

function erf(value: number): number {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const approximation = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * approximation;
}

function normalTwoTailed(z: number): number {
  return Math.max(0, Math.min(1, 1 - erf(Math.abs(z) / Math.SQRT2)));
}

function logGamma(value: number): number {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  let x = 0.9999999999998099;
  const z = value - 1;
  coefficients.forEach((coefficient, index) => { x += coefficient / (z + index + 1); });
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function regularizedGammaQ(shape: number, value: number): number {
  if (value <= 0) return 1;
  const gln = logGamma(shape);
  if (value < shape + 1) {
    let sum = 1 / shape;
    let term = sum;
    let ap = shape;
    for (let n = 1; n <= 200; n++) { ap++; term *= value / ap; sum += term; if (Math.abs(term) < Math.abs(sum) * 1e-14) break; }
    return 1 - sum * Math.exp(-value + shape * Math.log(value) - gln);
  }
  let b = value + 1 - shape;
  let c = 1 / Number.MIN_VALUE;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - shape);
    b += 2;
    d = an * d + b; if (Math.abs(d) < Number.MIN_VALUE) d = Number.MIN_VALUE;
    c = b + an / c; if (Math.abs(c) < Number.MIN_VALUE) c = Number.MIN_VALUE;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-14) break;
  }
  return Math.max(0, Math.min(1, Math.exp(-value + shape * Math.log(value) - gln) * h));
}

export function applyClassicConditionalLogistic(
  records: readonly EpiRecord[],
  plan: ClassicConditionalLogisticPlan,
): ClassicConditionalLogisticResult {
  if (!records.length) throw new RangeError("Conditional LOGISTIC requires at least one active record.");
  if (records.length > MAX_RECORDS) throw new RangeError(`Conditional LOGISTIC V0.1 is limited to ${MAX_RECORDS.toLocaleString("en-US")} active records.`);
  const grouped = new Map<string, EpiRecord[]>();
  let missingMatchRecords = 0;
  for (const record of records) {
    const raw = record[plan.matchField];
    if (missing(raw)) { missingMatchRecords++; continue; }
    const label = String(raw).trim();
    const key = `${typeof raw}:${label}`;
    const group = grouped.get(key);
    if (group) group.push(record); else grouped.set(key, [record]);
    if (grouped.size > MAX_SETS) throw new RangeError(`Conditional LOGISTIC V0.1 is limited to ${MAX_SETS.toLocaleString("en-US")} matched sets.`);
  }
  const exclusions = { missingValueSets: missingMatchRecords, invalidOutcomeSets: 0, invalidPredictorSets: 0, invalidCompositionSets: 0, oversizedSets: 0 };
  const sets: LogisticSet[] = [];
  let excludedRecords = missingMatchRecords;
  for (const group of grouped.values()) {
    if (group.length > MAX_SET_SIZE) { exclusions.oversizedSets++; excludedRecords += group.length; continue; }
    const rows: LogisticRow[] = [];
    let reason: keyof typeof exclusions | null = null;
    for (const record of group) {
      const outcome = binary(record[plan.outcomeField]);
      const predictors = plan.predictorFields.map((field) => numeric(record[field]));
      if (outcome === null || predictors.includes(null)) { reason = "missingValueSets"; break; }
      if (outcome === "invalid") { reason = "invalidOutcomeSets"; break; }
      if (predictors.includes("invalid")) { reason = "invalidPredictorSets"; break; }
      rows.push({ outcome, predictors: predictors as number[] });
    }
    if (!reason && (rows.length < 2 || rows.filter(({ outcome }) => outcome === 1).length !== 1)) reason = "invalidCompositionSets";
    if (reason) { exclusions[reason]++; excludedRecords += group.length; continue; }
    sets.push({ rows });
  }
  if (!sets.length) throw new RangeError("No matched sets with exactly one case, at least one control, and complete numeric predictors remain.");

  const beta = Array(plan.predictorFields.length).fill(0) as number[];
  const nullEvaluation = evaluate(sets, beta);
  let current = nullEvaluation;
  let converged = false;
  let iterations = 0;
  for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
    iterations = iteration;
    const delta = solve(current.information, current.gradient);
    let scale = 1;
    let candidate = beta.map((value, index) => value + delta[index]!);
    let evaluated = evaluate(sets, candidate);
    while (evaluated.logLikelihood < current.logLikelihood && scale > 1 / 1024) {
      scale /= 2;
      candidate = beta.map((value, index) => value + scale * delta[index]!);
      evaluated = evaluate(sets, candidate);
    }
    if (evaluated.logLikelihood < current.logLikelihood) throw new RangeError("Conditional LOGISTIC could not find an improving Newton step; inspect separation and predictor scaling.");
    const maximumStep = Math.max(...beta.map((value, index) => Math.abs(candidate[index]! - value)));
    beta.splice(0, beta.length, ...candidate);
    current = evaluated;
    if (maximumStep < TOLERANCE || Math.max(...current.gradient.map(Math.abs)) < TOLERANCE) { converged = true; break; }
  }
  const covariance = inverse(current.information);
  const coefficients = plan.predictorFields.map((field, index) => {
    const coefficient = beta[index]!;
    const standardError = Math.sqrt(Math.max(0, covariance[index]![index]!));
    const z = coefficient / standardError;
    return {
      field, coefficient, standardError, oddsRatio: Math.exp(coefficient),
      confidenceInterval: { lower: Math.exp(coefficient - Z_95 * standardError), upper: Math.exp(coefficient + Z_95 * standardError) },
      z, pValue: normalTwoTailed(z),
    };
  });
  const likelihoodRatio = Math.max(0, 2 * (current.logLikelihood - nullEvaluation.logLikelihood));
  const excludedSets = Object.values(exclusions).reduce((sum, count) => sum + count, 0);
  const warnings = [
    ...(excludedSets ? [`${excludedSets} matched sets were excluded before model fitting.`] : []),
    ...(!converged ? [`Maximum ${MAX_ITERATIONS} iterations reached without the convergence tolerance.`] : []),
    "Browser V0.1 uses a reviewed TypeScript conditional-likelihood kernel; Rust/WASM migration and desktop differential validation remain pending.",
  ];
  return {
    version: CLASSIC_CONDITIONAL_LOGISTIC_VERSION,
    operation: "epi.logistic.conditional",
    plan,
    coefficients,
    fit: {
      converged, iterations, logLikelihood: current.logLikelihood, nullLogLikelihood: nullEvaluation.logLikelihood,
      likelihoodRatio, degreesOfFreedom: coefficients.length,
      pValue: regularizedGammaQ(coefficients.length / 2, likelihoodRatio / 2),
    },
    totals: {
      sourceRecords: records.length,
      sourceSets: grouped.size + missingMatchRecords,
      includedRecords: sets.reduce((sum, set) => sum + set.rows.length, 0),
      includedSets: sets.length,
      informativeSets: current.informative,
      excludedRecords,
      excludedSets,
    },
    exclusions,
    diagnostics: { warnings },
  };
}
