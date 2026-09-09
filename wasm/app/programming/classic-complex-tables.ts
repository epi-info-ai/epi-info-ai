import type { EpiRecord, FieldDefinition, FieldType } from "../contracts/core.ts";
import type { MapDataSource } from "../contracts/maps.ts";

export const CLASSIC_COMPLEX_TABLES_PLAN_VERSION = "classic-complex-tables-v0.2.0" as const;

export interface ClassicComplexTablesPlan {
  version: typeof CLASSIC_COMPLEX_TABLES_PLAN_VERSION;
  source: string;
  canonicalSource: string;
  exposureField: string;
  exposurePrompt: string;
  exposureType: FieldType;
  outcomeField: string;
  outcomePrompt: string;
  outcomeType: FieldType;
  strataField?: string;
  strataPrompt?: string;
  weightField?: string;
  weightPrompt?: string;
  psuField: string;
  psuPrompt: string;
  outputTable?: string;
}

export interface ClassicComplexTablesCell {
  outcomeValue: string;
  count: number;
  weightedCount: number;
  rowPercent: number;
  columnPercent: number;
  standardError: number;
  lowerConfidenceLimit: number;
  upperConfidenceLimit: number;
  designEffect: number | null;
}

export interface ClassicComplexTablesRow {
  exposureValue: string;
  cells: ClassicComplexTablesCell[];
  weightedTotal: number;
}

export interface ClassicComplexTablesRiskResult {
  exposedValue: string;
  unexposedValue: string;
  caseValue: string;
  nonCaseValue: string;
  oddsRatio: number;
  oddsRatioStandardError: number;
  oddsRatioLower: number;
  oddsRatioUpper: number;
  riskRatio: number;
  riskRatioStandardError: number;
  riskRatioLower: number;
  riskRatioUpper: number;
  riskDifferencePercent: number;
  riskDifferenceStandardError: number;
  riskDifferenceLower: number;
  riskDifferenceUpper: number;
}

export interface ClassicComplexTablesResult {
  operation: "classic.tables.complex-sample";
  planVersion: typeof CLASSIC_COMPLEX_TABLES_PLAN_VERSION;
  sourceRecords: number;
  includedRecords: number;
  excludedRecords: number;
  weightedTotal: number;
  exposureValues: string[];
  outcomeValues: string[];
  rows: ClassicComplexTablesRow[];
  designStrata: number;
  primarySamplingUnits: number;
  degreesOfFreedom: number;
  confidenceMultiplier: number;
  risk?: ClassicComplexTablesRiskResult;
}

interface WorkingRecord {
  exposure: string;
  outcome: string;
  stratum: string;
  psu: string;
  weight: number;
}

const key = (value: string): string => value.toLocaleLowerCase("en-US");
const token = (value: string): string => /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) ? value : `[${value.replaceAll("]", "]]")}]`;
const category = (value: unknown): string | null => value === null || value === undefined || String(value).trim() === "" ? null : String(value).trim();
const compare = (left: string, right: string): number => left.localeCompare(right, "en-US", { numeric: true, sensitivity: "base" });

function binaryRank(value: string): number | null {
  const normalized = value.trim().toLocaleLowerCase("en-US");
  if (["1", "true", "yes", "y"].includes(normalized)) return 0;
  if (["0", "false", "no", "n"].includes(normalized)) return 1;
  return null;
}

function ordered(values: readonly string[], type: FieldType): string[] {
  const sorted = [...values].sort(compare);
  if (sorted.length !== 2 || (type !== "yes-no" && type !== "checkbox")) return sorted;
  return sorted.sort((left, right) => (binaryRank(left) ?? 2) - (binaryRank(right) ?? 2));
}

function resolveField(fields: readonly FieldDefinition[], requested: string): FieldDefinition {
  const field = fields.find(({ name }) => key(name) === key(requested));
  if (!field) throw new RangeError(`${requested} is not a field in the active Classic table.`);
  if (field.type === "command-button") throw new RangeError(`${field.name} cannot participate in Complex Sample Tables.`);
  return field;
}

// Direct port of StatisticsRepository.statlib PfromT/TfromP. The legacy engine
// asks TfromP(0.95, PSU-strata degrees of freedom) for its two-sided 95% limits.
function rightTailFromT(tValue: number, degreesOfFreedom: number): number {
  const t = Math.abs(tValue);
  if (degreesOfFreedom >= 1000) {
    // This bounded host never approaches 1000 PSUs, but retain a stable normal tail.
    const z = t;
    const p = 0.3275911;
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
    const q = 1 / (1 + p * z / Math.SQRT2);
    const erf = 1 - (((((a5 * q + a4) * q + a3) * q + a2) * q + a1) * q) * Math.exp(-z * z / 2);
    return (1 - erf) / 2;
  }
  const ddf = degreesOfFreedom;
  const a = t / Math.sqrt(ddf);
  const b = ddf / (ddf + t * t);
  const odd = ddf % 2;
  let sum = 1;
  let term = 1;
  for (let f = 2 + odd; f <= ddf - 2; f += 2) {
    term = term * b * (f - 1) / f;
    sum += term;
  }
  const probability = odd === 0
    ? 0.5 - a * Math.sqrt(b) * sum / 2
    : 0.5 - (a * b * sum + Math.atan(a)) * 0.3183098862;
  return Math.max(0, Math.min(1, probability));
}

export function legacyTFromP(proportion: number, degreesOfFreedom: number): number {
  if (degreesOfFreedom <= 0) return Number.NaN;
  if (proportion < 0 || proportion > 1) return 0;
  const target = Math.min(proportion, 1 - proportion) / 2;
  let left = 0;
  let right = 1;
  while (rightTailFromT(right, degreesOfFreedom) >= target) right *= 10;
  let current = 0;
  for (let iteration = 0; iteration < 256; iteration++) {
    current = (left + right) / 2;
    const tail = rightTailFromT(current, degreesOfFreedom);
    if (Math.abs(tail - target) < 1e-8) break;
    if (tail < target) right = current;
    else left = current;
  }
  return current;
}

export function resolveClassicComplexTablesPlan(
  source: string,
  fields: readonly FieldDefinition[],
  exposure: string,
  outcome: string,
  stratifyBy: readonly string[] | undefined,
  weightBy: string | undefined,
  psuBy: string,
  outputTable?: string,
): ClassicComplexTablesPlan {
  if ((stratifyBy?.length ?? 0) > 1) throw new RangeError("Complex Sample Tables currently accepts the legacy dialog's single STRATAVAR design stratum.");
  const exposureField = resolveField(fields, exposure);
  const outcomeField = resolveField(fields, outcome);
  const strataField = stratifyBy?.[0] ? resolveField(fields, stratifyBy[0]) : undefined;
  const weightField = weightBy ? resolveField(fields, weightBy) : undefined;
  const psuField = resolveField(fields, psuBy);
  if (weightField && weightField.type !== "number") throw new RangeError(`${weightField.name} must be a Number field for Complex Sample Tables WEIGHTVAR.`);
  const selected = [exposureField.name, outcomeField.name, strataField?.name, weightField?.name, psuField.name].filter((value): value is string => Boolean(value));
  if (new Set(selected.map(key)).size !== selected.length) throw new RangeError("Complex Sample Tables exposure, outcome, STRATAVAR, WEIGHTVAR, and PSUVAR fields must be different.");
  return {
    version: CLASSIC_COMPLEX_TABLES_PLAN_VERSION,
    source,
    canonicalSource: `TABLES ${token(exposureField.name)} ${token(outcomeField.name)}${strataField ? ` STRATAVAR=${token(strataField.name)}` : ""}${weightField ? ` WEIGHTVAR=${token(weightField.name)}` : ""} PSUVAR=${token(psuField.name)}${outputTable ? ` OUTTABLE=${token(outputTable)}` : ""}`,
    exposureField: exposureField.name, exposurePrompt: exposureField.prompt, exposureType: exposureField.type,
    outcomeField: outcomeField.name, outcomePrompt: outcomeField.prompt, outcomeType: outcomeField.type,
    ...(strataField ? { strataField: strataField.name, strataPrompt: strataField.prompt } : {}),
    ...(weightField ? { weightField: weightField.name, weightPrompt: weightField.prompt } : {}),
    psuField: psuField.name, psuPrompt: psuField.prompt,
    ...(outputTable ? { outputTable } : {}),
  };
}

export function classicComplexTablesOutTable(input: MapDataSource, plan: ClassicComplexTablesPlan, result: ClassicComplexTablesResult): MapDataSource {
  if (!plan.outputTable) throw new RangeError("Complex Sample Tables OUTTABLE requires a named output table.");
  const sourceField = (name: string): FieldDefinition => {
    const field = input.fields.find((candidate) => key(candidate.name) === key(name));
    if (!field) throw new RangeError(`${name} is not a field in the active Classic table.`);
    return structuredClone(field);
  };
  const fields: FieldDefinition[] = [
    sourceField(plan.exposureField),
    sourceField(plan.outcomeField),
    { name: "COUNT", prompt: "Count", type: "number", required: false },
    { name: "RowPct", prompt: "Row Percent", type: "number", required: false },
    { name: "ColPct", prompt: "Column Percent", type: "number", required: false },
    { name: "StdErr", prompt: "Standard Error Percent", type: "number", required: false },
    { name: "LCL", prompt: "Lower Confidence Limit", type: "number", required: false },
    { name: "UCL", prompt: "Upper Confidence Limit", type: "number", required: false },
    { name: "DesignEff", prompt: "Design Effect", type: "number", required: false },
  ];
  const outputRecords: EpiRecord[] = result.rows.flatMap((row) => row.cells.map((cell) => ({
    [plan.exposureField]: row.exposureValue,
    [plan.outcomeField]: cell.outcomeValue,
    COUNT: cell.count,
    RowPct: cell.rowPercent,
    ColPct: cell.columnPercent,
    StdErr: cell.standardError,
    LCL: cell.lowerConfidenceLimit,
    UCL: cell.upperConfidenceLimit,
    DesignEff: cell.designEffect,
  })));
  return {
    projectName: input.projectName,
    formId: `classic-outtable:${plan.outputTable}`,
    formName: plan.outputTable,
    fields,
    records: outputRecords,
  };
}

function designVariance(records: readonly WorkingRecord[], influence: (record: WorkingRecord) => number): number {
  const strata = [...new Set(records.map(({ stratum }) => stratum))];
  return strata.reduce((total, stratum) => {
    const members = records.filter((record) => record.stratum === stratum);
    const psus = [...new Set(members.map(({ psu }) => psu))];
    if (psus.length <= 1) return total;
    const clusterTotals = psus.map((psu) => members.filter((record) => record.psu === psu).reduce((sum, record) => sum + influence(record), 0));
    const sum = clusterTotals.reduce((accumulator, value) => accumulator + value, 0);
    const sumSquares = clusterTotals.reduce((accumulator, value) => accumulator + value * value, 0);
    return total + (psus.length * sumSquares - sum * sum) / (psus.length - 1);
  }, 0);
}

export function applyClassicComplexTables(records: readonly EpiRecord[], plan: ClassicComplexTablesPlan): ClassicComplexTablesResult {
  let excludedRecords = 0;
  const included: WorkingRecord[] = [];
  for (const record of records) {
    const exposure = category(record[plan.exposureField]);
    const outcome = category(record[plan.outcomeField]);
    const stratum = plan.strataField ? category(record[plan.strataField]) : "All records";
    const psu = category(record[plan.psuField]);
    const rawWeight = plan.weightField ? record[plan.weightField] : 1;
    const weight = typeof rawWeight === "number" ? rawWeight : Number(rawWeight);
    if (!exposure || !outcome || !stratum || !psu || !Number.isFinite(weight) || weight < 0) { excludedRecords++; continue; }
    included.push({ exposure, outcome, stratum, psu, weight });
  }
  if (!included.length) throw new RangeError("Complex Sample Tables found no complete records for the selected survey design fields.");
  const exposureValues = ordered([...new Set(included.map(({ exposure }) => exposure))], plan.exposureType);
  const outcomeValues = ordered([...new Set(included.map(({ outcome }) => outcome))], plan.outcomeType);
  const designPairs = new Set(included.map(({ stratum, psu }) => `${JSON.stringify(stratum)}\u0000${JSON.stringify(psu)}`));
  const designStrata = new Set(included.map(({ stratum }) => stratum)).size;
  const degreesOfFreedom = designPairs.size - designStrata;
  if (degreesOfFreedom <= 0) throw new RangeError("Complex Sample Tables requires at least two complete PSUs within the survey design.");
  const confidenceMultiplier = legacyTFromP(0.95, degreesOfFreedom);
  const columnTotals = outcomeValues.map((outcome) => included.filter((record) => record.outcome === outcome).reduce((sum, record) => sum + record.weight, 0));
  const rows = exposureValues.map((exposureValue) => {
    const domain = included.filter((record) => record.exposure === exposureValue);
    const weightedTotal = domain.reduce((sum, record) => sum + record.weight, 0);
    const firstOutcome = outcomeValues[0]!;
    const firstWeighted = domain.filter(({ outcome }) => outcome === firstOutcome).reduce((sum, record) => sum + record.weight, 0);
    const firstProportion = weightedTotal ? firstWeighted / weightedTotal : 0;
    const firstVariance = designVariance(included, (record) => record.exposure === exposureValue ? record.weight * ((record.outcome === firstOutcome ? 1 : 0) - firstProportion) / weightedTotal : 0);
    const designEffectDenominator = domain.length > 1 ? firstProportion * (1 - firstProportion) / (domain.length - 1) : 0;
    const designEffect = designEffectDenominator ? firstVariance / designEffectDenominator : null;
    return {
      exposureValue,
      weightedTotal,
      cells: outcomeValues.map((outcomeValue, outcomeIndex) => {
        const cell = domain.filter(({ outcome }) => outcome === outcomeValue);
        const weightedCount = cell.reduce((sum, record) => sum + record.weight, 0);
        const proportion = weightedTotal ? weightedCount / weightedTotal : 0;
        const variance = designVariance(included, (record) => record.exposure === exposureValue ? record.weight * ((record.outcome === outcomeValue ? 1 : 0) - proportion) / weightedTotal : 0);
        const standardError = 100 * Math.sqrt(Math.max(0, variance));
        return {
          outcomeValue, count: cell.length, weightedCount,
          rowPercent: 100 * proportion,
          columnPercent: columnTotals[outcomeIndex] ? 100 * weightedCount / columnTotals[outcomeIndex]! : 0,
          standardError,
          lowerConfidenceLimit: 100 * proportion - confidenceMultiplier * standardError,
          upperConfidenceLimit: 100 * proportion + confidenceMultiplier * standardError,
          designEffect,
        };
      }),
    };
  });
  let risk: ClassicComplexTablesRiskResult | undefined;
  if (exposureValues.length === 2 && outcomeValues.length === 2) {
    const a = rows[0]!.cells[0]!.weightedCount, b = rows[0]!.cells[1]!.weightedCount;
    const c = rows[1]!.cells[0]!.weightedCount, d = rows[1]!.cells[1]!.weightedCount;
    if (a > 0 && b > 0 && c > 0 && d > 0) {
      const oddsRatio = a * d / (b * c);
      const risk1 = a / (a + b), risk2 = c / (c + d);
      const riskRatio = risk1 / risk2;
      const riskDifference = risk1 - risk2;
      const cell = (record: WorkingRecord): "a" | "b" | "c" | "d" => record.exposure === exposureValues[0]
        ? record.outcome === outcomeValues[0] ? "a" : "b"
        : record.outcome === outcomeValues[0] ? "c" : "d";
      const varOdds = designVariance(included, (record) => ({ a: 1 / a, b: -oddsRatio / b, c: -oddsRatio / c, d: oddsRatio / d })[cell(record)] * record.weight);
      const varLogOdds = designVariance(included, (record) => ({ a: 1 / a, b: -1 / b, c: -1 / c, d: 1 / d })[cell(record)] * record.weight);
      const varRiskRatio = designVariance(included, (record) => ({
        a: riskRatio * (1 - risk1) / a, b: -riskRatio / (a + b),
        c: -riskRatio * (1 - risk2) / c, d: riskRatio / (c + d),
      })[cell(record)] * record.weight);
      const varLogRisk = designVariance(included, (record) => ({
        a: 1 / a - 1 / (a + b), b: -1 / (a + b), c: 1 / (c + d) - 1 / c, d: 1 / (c + d),
      })[cell(record)] * record.weight);
      const varRiskDifference = designVariance(included, (record) => ({
        a: risk1 * (1 - risk1) / a, b: -(risk1 * risk1) / a,
        c: -risk2 * (1 - risk2) / c, d: (risk2 * risk2) / c,
      })[cell(record)] * record.weight);
      const oddsLogError = confidenceMultiplier * Math.sqrt(Math.max(0, varLogOdds));
      const riskLogError = confidenceMultiplier * Math.sqrt(Math.max(0, varLogRisk));
      const differenceError = confidenceMultiplier * Math.sqrt(Math.max(0, varRiskDifference));
      risk = {
        exposedValue: exposureValues[0]!, unexposedValue: exposureValues[1]!, caseValue: outcomeValues[0]!, nonCaseValue: outcomeValues[1]!,
        oddsRatio, oddsRatioStandardError: Math.sqrt(Math.max(0, varOdds)), oddsRatioLower: Math.exp(Math.log(oddsRatio) - oddsLogError), oddsRatioUpper: Math.exp(Math.log(oddsRatio) + oddsLogError),
        riskRatio, riskRatioStandardError: Math.sqrt(Math.max(0, varRiskRatio)), riskRatioLower: Math.exp(Math.log(riskRatio) - riskLogError), riskRatioUpper: Math.exp(Math.log(riskRatio) + riskLogError),
        riskDifferencePercent: 100 * riskDifference, riskDifferenceStandardError: 100 * Math.sqrt(Math.max(0, varRiskDifference)), riskDifferenceLower: 100 * (riskDifference - differenceError), riskDifferenceUpper: 100 * (riskDifference + differenceError),
      };
    }
  }
  return {
    operation: "classic.tables.complex-sample", planVersion: CLASSIC_COMPLEX_TABLES_PLAN_VERSION,
    sourceRecords: records.length, includedRecords: included.length, excludedRecords,
    weightedTotal: included.reduce((sum, record) => sum + record.weight, 0),
    exposureValues, outcomeValues, rows, designStrata, primarySamplingUnits: designPairs.size,
    degreesOfFreedom, confidenceMultiplier, ...(risk ? { risk } : {}),
  };
}
