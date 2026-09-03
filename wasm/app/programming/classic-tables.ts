import type { EpiRecord, FieldDefinition, FieldType } from "../contracts/core.ts";

export const CLASSIC_TABLES_PLAN_VERSION = "classic-tables-v0.7.0" as const;
export const CLASSIC_TABLES_FISHER_MAX_TABLES = 200_000;
export const CLASSIC_TABLES_FISHER_TOLERANCE = 3.45254e-7;

export interface ClassicTablesPlan {
  version: typeof CLASSIC_TABLES_PLAN_VERSION;
  source: string;
  canonicalSource: string;
  exposureField: string;
  exposurePrompt: string;
  exposureType: FieldType;
  outcomeField: string;
  outcomePrompt: string;
  outcomeType: FieldType;
  strataFields: string[];
  strataPrompts: string[];
  statistics?: "FISHER";
  includeMissing: boolean;
  representationOfMissing: string;
}

export interface ClassicTablesRow {
  exposureValue: string;
  counts: number[];
  rowPercents: number[];
  columnPercents: number[];
  expectedCounts: number[];
  total: number;
}

export interface ClassicTablesPearsonResult {
  chiSquare: number;
  degreesOfFreedom: number;
  pValue: number;
  minimumExpected: number;
  cellsExpectedBelowFive: number;
  cellsExpectedBelowOne: number;
  warning: string | null;
}

export interface ClassicTablesStratum {
  value: string;
  rows: ClassicTablesRow[];
  columnTotals: number[];
  columnPercents: number[];
  total: number;
  pearson: ClassicTablesPearsonResult | null;
  twoByTwo?: ClassicTablesTwoByTwo;
  fisherExact?: ClassicTablesFisherResult;
}

export type ClassicTablesFisherResult = {
  state: "computed";
  method: "fisher-freeman-halton-probability-ordering";
  pValue: number;
  tablesEnumerated: number;
  maximumTables: number;
  tolerance: number;
} | {
  state: "unavailable";
  method: "fisher-freeman-halton-probability-ordering";
  reason: string;
  tablesEnumerated: number;
  maximumTables: number;
  tolerance: number;
};

export interface ClassicTablesTwoByTwo {
  exposedValue: string;
  unexposedValue: string;
  caseValue: string;
  nonCaseValue: string;
  input: {
    exposedCases: number;
    exposedNonCases: number;
    unexposedCases: number;
    unexposedNonCases: number;
    confidenceLevel: 0.95;
  };
}

export interface ClassicTablesResult {
  operation: "classic.tables.categorical";
  planVersion: typeof CLASSIC_TABLES_PLAN_VERSION;
  canonicalSource: string;
  sourceRecords: number;
  includedRecords: number;
  excludedMissing: number;
  includedMissing: number;
  exposureValues: string[];
  outcomeValues: string[];
  strata: ClassicTablesStratum[];
}

const token = (name: string): string => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `[${name}]`;
const key = (value: string): string => value.toLocaleLowerCase("en-US");
const compare = new Intl.Collator("en-US", { numeric: true, sensitivity: "base" }).compare;
const EPSILON = 1e-14;

// Lanczos log-gamma plus the standard series/continued-fraction forms of the
// regularized incomplete gamma. TABLES uses Q(df/2, chiSquare/2).
function logGamma(value: number): number {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -0.13857109526572012,
    9.984369578019572e-6, 1.5056327351493116e-7];
  if (value < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  const shifted = value - 1;
  let sum = 0.9999999999998099;
  for (let index = 0; index < coefficients.length; index++) sum += coefficients[index]! / (shifted + index + 1);
  const t = shifted + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(sum);
}

function regularizedGammaQ(shape: number, value: number): number {
  if (!(shape > 0) || value < 0 || !Number.isFinite(value)) return Number.NaN;
  if (value === 0) return 1;
  if (value < shape + 1) {
    let term = 1 / shape;
    let sum = term;
    let denominator = shape;
    for (let iteration = 1; iteration <= 10_000; iteration++) {
      denominator++;
      term *= value / denominator;
      sum += term;
      if (Math.abs(term) <= Math.abs(sum) * EPSILON) break;
    }
    const lower = sum * Math.exp(-value + shape * Math.log(value) - logGamma(shape));
    return Math.max(0, Math.min(1, 1 - lower));
  }
  let b = value + 1 - shape;
  let c = 1 / Number.MIN_VALUE;
  let d = 1 / b;
  let fraction = d;
  for (let iteration = 1; iteration <= 10_000; iteration++) {
    const coefficient = -iteration * (iteration - shape);
    b += 2;
    d = coefficient * d + b;
    if (Math.abs(d) < Number.MIN_VALUE) d = Number.MIN_VALUE;
    c = b + coefficient / c;
    if (Math.abs(c) < Number.MIN_VALUE) c = Number.MIN_VALUE;
    d = 1 / d;
    const delta = d * c;
    fraction *= delta;
    if (Math.abs(delta - 1) <= EPSILON) break;
  }
  return Math.max(0, Math.min(1, Math.exp(-value + shape * Math.log(value) - logGamma(shape)) * fraction));
}

function pearson(rows: readonly ClassicTablesRow[], columnTotals: readonly number[], total: number): ClassicTablesPearsonResult | null {
  const activeRows = rows.filter((row) => row.total > 0);
  const activeColumns = columnTotals.map((columnTotal, index) => ({ columnTotal, index })).filter(({ columnTotal }) => columnTotal > 0);
  const degreesOfFreedom = (activeRows.length - 1) * (activeColumns.length - 1);
  if (total <= 0 || degreesOfFreedom <= 0) return null;
  const expected = activeRows.flatMap((row) => activeColumns.map(({ columnTotal, index }) => ({
    observed: row.counts[index]!, expected: row.total * columnTotal / total,
  })));
  const chiSquare = expected.reduce((sum, cell) => sum + (cell.observed - cell.expected) ** 2 / cell.expected, 0);
  const minimumExpected = Math.min(...expected.map(({ expected: count }) => count));
  const cellsExpectedBelowFive = expected.filter(({ expected: count }) => count < 5).length;
  const cellsExpectedBelowOne = expected.filter(({ expected: count }) => count < 1).length;
  const warning = cellsExpectedBelowOne > 0
    ? "An expected value is < 1. Chi-squared may not be a valid test."
    : cellsExpectedBelowFive > 0 ? "An expected value is < 5. Chi-squared may not be a valid test." : null;
  return {
    chiSquare, degreesOfFreedom, pValue: regularizedGammaQ(degreesOfFreedom / 2, chiSquare / 2), minimumExpected,
    cellsExpectedBelowFive, cellsExpectedBelowOne, warning,
  };
}

function resolveField(fields: readonly FieldDefinition[], requested: string): FieldDefinition {
  const field = fields.find((candidate) => key(candidate.name) === key(requested));
  if (!field) throw new RangeError(`${requested} is not a field in the current form.`);
  return field;
}

function category(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function binaryRank(value: string): number | null {
  const normalized = value.trim().toLocaleLowerCase("en-US");
  if (["yes", "true", "1"].includes(normalized)) return 0;
  if (["no", "false", "0"].includes(normalized)) return 1;
  return null;
}

function orderedCategories(values: readonly string[], fieldType: FieldType): string[] {
  const ordered = [...values].sort(compare);
  if (fieldType !== "yes-no" && fieldType !== "checkbox") return ordered;
  return ordered.sort((left, right) => {
    const leftRank = binaryRank(left);
    const rightRank = binaryRank(right);
    return leftRank === null || rightRank === null ? compare(left, right) : leftRank - rightRank;
  });
}

export function calculateBoundedFisherExact(
  counts: readonly (readonly number[])[],
  maximumTables = CLASSIC_TABLES_FISHER_MAX_TABLES,
): ClassicTablesFisherResult {
  const base = { method: "fisher-freeman-halton-probability-ordering" as const, maximumTables, tolerance: CLASSIC_TABLES_FISHER_TOLERANCE };
  if (counts.length !== 2 || counts.some((row) => row.length !== counts[0]?.length) || (counts[0]?.length ?? 0) < 2) {
    return { ...base, state: "unavailable", reason: "This bounded Fisher slice supports 2 x N tables only.", tablesEnumerated: 0 };
  }
  if (counts.flat().some((value) => !Number.isSafeInteger(value) || value < 0)) {
    return { ...base, state: "unavailable", reason: "Fisher exact requires non-negative integer cell counts.", tablesEnumerated: 0 };
  }
  const columns = counts[0]!.map((value, index) => value + counts[1]![index]!);
  const rowTotal = counts[0]!.reduce((sum, value) => sum + value, 0);
  const total = columns.reduce((sum, value) => sum + value, 0);
  if (!total || !rowTotal || rowTotal === total) return { ...base, state: "unavailable", reason: "Fisher exact requires two non-empty rows.", tablesEnumerated: 0 };
  const logFactorial = Array.from({ length: total + 1 }, () => 0);
  for (let index = 2; index <= total; index++) logFactorial[index] = logFactorial[index - 1]! + Math.log(index);
  const logChoose = (n: number, k: number): number => logFactorial[n]! - logFactorial[k]! - logFactorial[n - k]!;
  const denominator = logChoose(total, rowTotal);
  const observedLogProbability = columns.reduce((sum, margin, index) => sum + logChoose(margin, counts[0]![index]!), -denominator);
  const selected: number[] = [];
  let tablesEnumerated = 0;
  let exceeded = false;
  const enumerate = (column: number, remaining: number, logNumerator: number): void => {
    if (exceeded) return;
    if (column === columns.length - 1) {
      if (remaining < 0 || remaining > columns[column]!) return;
      tablesEnumerated++;
      if (tablesEnumerated > maximumTables) { exceeded = true; return; }
      const candidate = logNumerator + logChoose(columns[column]!, remaining) - denominator;
      if (candidate <= observedLogProbability + Math.log1p(CLASSIC_TABLES_FISHER_TOLERANCE)) selected.push(candidate);
      return;
    }
    const remainingMargins = columns.slice(column + 1).reduce((sum, value) => sum + value, 0);
    const minimum = Math.max(0, remaining - remainingMargins);
    const maximum = Math.min(columns[column]!, remaining);
    for (let value = minimum; value <= maximum; value++) enumerate(column + 1, remaining - value, logNumerator + logChoose(columns[column]!, value));
  };
  enumerate(0, rowTotal, 0);
  if (exceeded) return { ...base, state: "unavailable", reason: `The exact enumeration exceeded the ${maximumTables.toLocaleString("en-US")}-table browser limit.`, tablesEnumerated };
  const peak = Math.max(...selected);
  const pValue = selected.length ? Math.min(1, Math.exp(peak) * selected.reduce((sum, value) => sum + Math.exp(value - peak), 0)) : 0;
  return { ...base, state: "computed", pValue, tablesEnumerated };
}

export function resolveClassicTablesPlan(
  source: string,
  fields: readonly FieldDefinition[],
  exposure: string,
  outcome: string,
  stratifyBy?: string | readonly string[],
  statistics?: "FISHER",
  includeMissing = false,
  representationOfMissing = "Missing",
): ClassicTablesPlan {
  const exposureField = resolveField(fields, exposure);
  const outcomeField = resolveField(fields, outcome);
  const requestedStrata = typeof stratifyBy === "string" ? [stratifyBy] : [...(stratifyBy ?? [])];
  const strataFields = requestedStrata.map((field) => resolveField(fields, field));
  const selectedFields = [exposureField.name, outcomeField.name, ...strataFields.map(({ name }) => name)];
  if (new Set(selectedFields.map(key)).size !== selectedFields.length) throw new RangeError(
    strataFields.length ? "TABLES exposure, outcome, and STRATAVAR fields must all be different." : "TABLES exposure and outcome must use different fields.",
  );
  return {
    version: CLASSIC_TABLES_PLAN_VERSION,
    source,
    canonicalSource: `TABLES ${token(exposureField.name)} ${token(outcomeField.name)}${strataFields.length ? ` STRATAVAR=${strataFields.map(({ name }) => token(name)).join(" ")}` : ""}${statistics ? ` STATISTICS=${statistics}` : ""}`,
    exposureField: exposureField.name,
    exposurePrompt: exposureField.prompt,
    exposureType: exposureField.type,
    outcomeField: outcomeField.name,
    outcomePrompt: outcomeField.prompt,
    outcomeType: outcomeField.type,
    strataFields: strataFields.map(({ name }) => name),
    strataPrompts: strataFields.map(({ prompt }) => prompt),
    ...(statistics ? { statistics } : {}),
    includeMissing,
    representationOfMissing,
  };
}

export function applyClassicTables(records: readonly EpiRecord[], plan: ClassicTablesPlan): ClassicTablesResult {
  let includedMissing = 0;
  const included = records.flatMap((record) => {
    const exposure = category(record[plan.exposureField]);
    const outcome = category(record[plan.outcomeField]);
    const strata = plan.strataFields.map((field) => category(record[field]));
    const hasMissing = !exposure || !outcome || strata.some((value) => !value);
    if (hasMissing && !plan.includeMissing) return [];
    if (hasMissing) includedMissing++;
    const normalizedStrata = strata.map((value) => value ?? plan.representationOfMissing);
    return [{
      exposure: exposure ?? plan.representationOfMissing,
      outcome: outcome ?? plan.representationOfMissing,
      stratumKey: JSON.stringify(normalizedStrata),
      stratum: normalizedStrata.length === 0
        ? "All records"
        : normalizedStrata.length === 1
          ? normalizedStrata[0]!
          : normalizedStrata.map((value, index) => `${plan.strataPrompts[index]}: ${value}`).join(" · "),
    }];
  });
  const rawExposureValues = [...new Set(included.map(({ exposure }) => exposure))].sort(compare);
  const rawOutcomeValues = [...new Set(included.map(({ outcome }) => outcome))].sort(compare);
  const isTwoByTwo = rawExposureValues.length === 2 && rawOutcomeValues.length === 2;
  // Desktop Epi Info gives Boolean/Yes-No fields affirmative-first orientation
  // when it promotes a categorical result to Single Table Analysis.
  const exposureValues = isTwoByTwo ? orderedCategories(rawExposureValues, plan.exposureType) : rawExposureValues;
  const outcomeValues = isTwoByTwo ? orderedCategories(rawOutcomeValues, plan.outcomeType) : rawOutcomeValues;
  const strataValues = [...new Map(included.map(({ stratumKey, stratum }) => [stratumKey, { key: stratumKey, value: stratum }])).values()].sort((left, right) => compare(left.value, right.value));
  const strata = strataValues.map(({ key: stratumKey, value }) => {
    const members = included.filter((item) => item.stratumKey === stratumKey);
    const countRows = exposureValues.map((exposureValue) => {
      const counts = outcomeValues.map((outcomeValue) => members.filter((item) => item.exposure === exposureValue && item.outcome === outcomeValue).length);
      return { exposureValue, counts, total: counts.reduce((sum, count) => sum + count, 0) };
    });
    const columnTotals = outcomeValues.map((_, index) => countRows.reduce((sum, row) => sum + row.counts[index]!, 0));
    const total = members.length;
    const rows = countRows.map((row) => ({
      ...row,
      rowPercents: row.counts.map((count) => row.total ? count / row.total * 100 : 0),
      columnPercents: row.counts.map((count, index) => columnTotals[index] ? count / columnTotals[index]! * 100 : 0),
      expectedCounts: row.counts.map((_, index) => total ? row.total * columnTotals[index]! / total : 0),
    }));
    const twoByTwo = isTwoByTwo ? {
      exposedValue: exposureValues[0]!, unexposedValue: exposureValues[1]!,
      caseValue: outcomeValues[0]!, nonCaseValue: outcomeValues[1]!,
      input: {
        exposedCases: rows[0]!.counts[0]!, exposedNonCases: rows[0]!.counts[1]!,
        unexposedCases: rows[1]!.counts[0]!, unexposedNonCases: rows[1]!.counts[1]!, confidenceLevel: 0.95 as const,
      },
    } : null;
    return {
      value, rows, columnTotals,
      columnPercents: columnTotals.map((count) => total ? count / total * 100 : 0),
      total, pearson: pearson(rows, columnTotals, total), ...(twoByTwo ? { twoByTwo } : {}),
      ...(plan.statistics === "FISHER" && !twoByTwo ? { fisherExact: calculateBoundedFisherExact(rows.map(({ counts }) => counts)) } : {}),
    };
  });
  return {
    operation: "classic.tables.categorical",
    planVersion: CLASSIC_TABLES_PLAN_VERSION,
    canonicalSource: plan.canonicalSource,
    sourceRecords: records.length,
    includedRecords: included.length,
    excludedMissing: records.length - included.length,
    includedMissing,
    exposureValues,
    outcomeValues,
    strata,
  };
}
