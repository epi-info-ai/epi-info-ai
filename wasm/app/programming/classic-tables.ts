import type { EpiRecord, FieldDefinition, FieldType } from "../contracts/core.ts";
import type { StratifiedTable2x2Input } from "../contracts/engine.ts";
import type { MapDataSource } from "../contracts/maps.ts";

export const CLASSIC_TABLES_PLAN_VERSION = "classic-tables-v0.11.0" as const;
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
  weightField?: string;
  weightPrompt?: string;
  statistics?: "NONE" | "FISHER";
  outputTable?: string;
  oneIsYes: boolean;
  noWrap: boolean;
  columnSize?: number;
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
  strataValues?: string[];
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
  excludedInvalidWeight: number;
  zeroWeightRecords: number;
  weightedTotal: number;
  weightField?: string;
  includedMissing: number;
  exposureValues: string[];
  outcomeValues: string[];
  strata: ClassicTablesStratum[];
}

export function classicTablesStratified2x2Input(result: ClassicTablesResult): StratifiedTable2x2Input | null {
  if (result.weightField || result.strata.length < 2 || result.strata.some((stratum) => !stratum.twoByTwo)) return null;
  return {
    confidenceLevel: 0.95,
    strata: result.strata.map((stratum, index) => ({
      id: `classic-table-stratum-${index + 1}`,
      label: stratum.value,
      exposedCases: stratum.twoByTwo!.input.exposedCases,
      exposedNonCases: stratum.twoByTwo!.input.exposedNonCases,
      unexposedCases: stratum.twoByTwo!.input.unexposedCases,
      unexposedNonCases: stratum.twoByTwo!.input.unexposedNonCases,
    })),
  };
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

function orderedCategories(values: readonly string[], fieldType: FieldType, oneIsYes = false): string[] {
  const ordered = [...values].sort(compare);
  if (fieldType !== "yes-no" && fieldType !== "checkbox" && !oneIsYes) return ordered;
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
  if (counts.length < 2 || counts.some((row) => row.length !== counts[0]?.length) || (counts[0]?.length ?? 0) < 2) {
    return { ...base, state: "unavailable", reason: "Fisher exact requires a rectangular table with at least two rows and two columns.", tablesEnumerated: 0 };
  }
  if (counts.flat().some((value) => !Number.isSafeInteger(value) || value < 0)) {
    return { ...base, state: "unavailable", reason: "Fisher exact requires non-negative integer cell counts.", tablesEnumerated: 0 };
  }
  const nonEmptyRows = counts.filter((row) => row.some((value) => value > 0));
  const nonEmptyColumns = counts[0]!.map((_, column) => column).filter((column) => nonEmptyRows.some((row) => row[column]! > 0));
  const table = nonEmptyRows.map((row) => nonEmptyColumns.map((column) => row[column]!));
  if (table.length < 2 || nonEmptyColumns.length < 2) return { ...base, state: "unavailable", reason: "Fisher exact requires at least two non-empty rows and columns.", tablesEnumerated: 0 };
  const rowTotals = table.map((row) => row.reduce((sum, value) => sum + value, 0));
  const columnTotals = nonEmptyColumns.map((_, column) => table.reduce((sum, row) => sum + row[column]!, 0));
  const total = rowTotals.reduce((sum, value) => sum + value, 0);
  const logFactorial = Array.from({ length: total + 1 }, () => 0);
  for (let index = 2; index <= total; index++) logFactorial[index] = logFactorial[index - 1]! + Math.log(index);
  const constant = rowTotals.reduce((sum, value) => sum + logFactorial[value]!, 0)
    + columnTotals.reduce((sum, value) => sum + logFactorial[value]!, 0) - logFactorial[total]!;
  const observedLogProbability = constant - table.flat().reduce((sum, value) => sum + logFactorial[value]!, 0);
  const selected: number[] = [];
  let tablesEnumerated = 0;
  let exceeded = false;
  const enumerateRows = (row: number, remainingColumns: number[], logCellFactorials: number): void => {
    if (exceeded) return;
    if (row === rowTotals.length - 1) {
      if (remainingColumns.reduce((sum, value) => sum + value, 0) !== rowTotals[row]) return;
      tablesEnumerated++;
      if (tablesEnumerated > maximumTables) { exceeded = true; return; }
      const candidate = constant - logCellFactorials - remainingColumns.reduce((sum, value) => sum + logFactorial[value]!, 0);
      if (candidate <= observedLogProbability + Math.log1p(CLASSIC_TABLES_FISHER_TOLERANCE)) selected.push(candidate);
      return;
    }
    const allocation = Array.from({ length: remainingColumns.length }, () => 0);
    const enumerateColumns = (column: number, remainingRow: number): void => {
      if (exceeded) return;
      if (column === remainingColumns.length - 1) {
        if (remainingRow < 0 || remainingRow > remainingColumns[column]!) return;
        allocation[column] = remainingRow;
        enumerateRows(
          row + 1,
          remainingColumns.map((value, index) => value - allocation[index]!),
          logCellFactorials + allocation.reduce((sum, value) => sum + logFactorial[value]!, 0),
        );
        return;
      }
      const remainingCapacity = remainingColumns.slice(column + 1).reduce((sum, value) => sum + value, 0);
      const minimum = Math.max(0, remainingRow - remainingCapacity);
      const maximum = Math.min(remainingColumns[column]!, remainingRow);
      for (let value = minimum; value <= maximum; value++) {
        allocation[column] = value;
        enumerateColumns(column + 1, remainingRow - value);
      }
    };
    enumerateColumns(0, rowTotals[row]!);
  };
  enumerateRows(0, [...columnTotals], 0);
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
  statistics?: "NONE" | "FISHER",
  weightBy?: string,
  includeMissing = false,
  representationOfMissing = "Missing",
  outputTable?: string,
  oneIsYes = false,
  noWrap = false,
  columnSize?: number,
): ClassicTablesPlan {
  const exposureField = resolveField(fields, exposure);
  const outcomeField = resolveField(fields, outcome);
  const requestedStrata = typeof stratifyBy === "string" ? [stratifyBy] : [...(stratifyBy ?? [])];
  const strataFields = requestedStrata.map((field) => resolveField(fields, field));
  const weightField = weightBy ? resolveField(fields, weightBy) : undefined;
  if (weightField && weightField.type !== "number") throw new RangeError(`${weightField.name} must be a Number field for TABLES WEIGHTVAR.`);
  if (weightField && statistics === "FISHER") throw new RangeError("TABLES STATISTICS=FISHER is not available with WEIGHTVAR because exact tests require unweighted integer observations.");
  const selectedFields = [exposureField.name, outcomeField.name, ...strataFields.map(({ name }) => name), ...(weightField ? [weightField.name] : [])];
  if (new Set(selectedFields.map(key)).size !== selectedFields.length) throw new RangeError(
    weightField ? "TABLES exposure, outcome, STRATAVAR, and WEIGHTVAR fields must all be different."
      : strataFields.length ? "TABLES exposure, outcome, and STRATAVAR fields must all be different." : "TABLES exposure and outcome must use different fields.",
  );
  return {
    version: CLASSIC_TABLES_PLAN_VERSION,
    source,
    canonicalSource: `TABLES ${token(exposureField.name)} ${token(outcomeField.name)}${strataFields.length ? ` STRATAVAR=${strataFields.map(({ name }) => token(name)).join(" ")}` : ""}${weightField ? ` WEIGHTVAR=${token(weightField.name)}` : ""}${statistics ? ` STATISTICS=${statistics}` : ""}${outputTable ? ` OUTTABLE=${token(outputTable)}` : ""}${oneIsYes ? " ONEISYES" : ""}${noWrap ? " NOWRAP" : ""}${columnSize !== undefined ? ` COLUMNSIZE=${columnSize}` : ""}`,
    exposureField: exposureField.name,
    exposurePrompt: exposureField.prompt,
    exposureType: exposureField.type,
    outcomeField: outcomeField.name,
    outcomePrompt: outcomeField.prompt,
    outcomeType: outcomeField.type,
    strataFields: strataFields.map(({ name }) => name),
    strataPrompts: strataFields.map(({ prompt }) => prompt),
    ...(weightField ? { weightField: weightField.name, weightPrompt: weightField.prompt } : {}),
    ...(statistics ? { statistics } : {}),
    ...(outputTable ? { outputTable } : {}),
    oneIsYes,
    noWrap,
    ...(columnSize !== undefined ? { columnSize } : {}),
    includeMissing,
    representationOfMissing,
  };
}

export function applyClassicTables(records: readonly EpiRecord[], plan: ClassicTablesPlan): ClassicTablesResult {
  let includedMissing = 0;
  let excludedMissing = 0;
  let excludedInvalidWeight = 0;
  let zeroWeightRecords = 0;
  const included = records.flatMap((record) => {
    const exposure = category(record[plan.exposureField]);
    const outcome = category(record[plan.outcomeField]);
    const strata = plan.strataFields.map((field) => category(record[field]));
    const hasMissing = !exposure || !outcome || strata.some((value) => !value);
    if (hasMissing && !plan.includeMissing) { excludedMissing++; return []; }
    if (hasMissing) includedMissing++;
    let weight = 1;
    if (plan.weightField) {
      const rawWeight = record[plan.weightField];
      if (rawWeight === null || rawWeight === undefined || String(rawWeight).trim() === "") { excludedInvalidWeight++; return []; }
      weight = typeof rawWeight === "number" ? rawWeight : Number(rawWeight);
      if (!Number.isFinite(weight) || weight < 0) { excludedInvalidWeight++; return []; }
      if (weight === 0) zeroWeightRecords++;
    }
    const normalizedStrata = strata.map((value) => value ?? plan.representationOfMissing);
    return [{
      exposure: exposure ?? plan.representationOfMissing,
      outcome: outcome ?? plan.representationOfMissing,
      weight,
      strataValues: normalizedStrata,
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
  const exposureValues = isTwoByTwo ? orderedCategories(rawExposureValues, plan.exposureType, plan.oneIsYes) : rawExposureValues;
  const outcomeValues = isTwoByTwo ? orderedCategories(rawOutcomeValues, plan.outcomeType, plan.oneIsYes) : rawOutcomeValues;
  const strataValues = [...new Map(included.map(({ stratumKey, stratum }) => [stratumKey, { key: stratumKey, value: stratum }])).values()].sort((left, right) => compare(left.value, right.value));
  const strata = strataValues.map(({ key: stratumKey, value }) => {
    const members = included.filter((item) => item.stratumKey === stratumKey);
    const countRows = exposureValues.map((exposureValue) => {
      const counts = outcomeValues.map((outcomeValue) => members
        .filter((item) => item.exposure === exposureValue && item.outcome === outcomeValue)
        .reduce((sum, item) => sum + item.weight, 0));
      return { exposureValue, counts, total: counts.reduce((sum, count) => sum + count, 0) };
    });
    const columnTotals = outcomeValues.map((_, index) => countRows.reduce((sum, row) => sum + row.counts[index]!, 0));
    const total = members.reduce((sum, item) => sum + item.weight, 0);
    const rows = countRows.map((row) => ({
      ...row,
      rowPercents: row.counts.map((count) => row.total ? count / row.total * 100 : 0),
      columnPercents: row.counts.map((count, index) => columnTotals[index] ? count / columnTotals[index]! * 100 : 0),
      expectedCounts: row.counts.map((_, index) => total ? row.total * columnTotals[index]! / total : 0),
    }));
    const twoByTwo = isTwoByTwo && !plan.weightField && plan.statistics !== "NONE" ? {
      exposedValue: exposureValues[0]!, unexposedValue: exposureValues[1]!,
      caseValue: outcomeValues[0]!, nonCaseValue: outcomeValues[1]!,
      input: {
        exposedCases: rows[0]!.counts[0]!, exposedNonCases: rows[0]!.counts[1]!,
        unexposedCases: rows[1]!.counts[0]!, unexposedNonCases: rows[1]!.counts[1]!, confidenceLevel: 0.95 as const,
      },
    } : null;
    return {
      value, ...(plan.outputTable ? { strataValues: [...(members[0]?.strataValues ?? [])] } : {}), rows, columnTotals,
      columnPercents: columnTotals.map((count) => total ? count / total * 100 : 0),
      total, pearson: plan.statistics === "NONE" ? null : pearson(rows, columnTotals, total), ...(twoByTwo ? { twoByTwo } : {}),
      ...(plan.statistics === "FISHER" && !plan.weightField && !twoByTwo ? { fisherExact: calculateBoundedFisherExact(rows.map(({ counts }) => counts)) } : {}),
    };
  });
  return {
    operation: "classic.tables.categorical",
    planVersion: CLASSIC_TABLES_PLAN_VERSION,
    canonicalSource: plan.canonicalSource,
    sourceRecords: records.length,
    includedRecords: included.length,
    excludedMissing,
    excludedInvalidWeight,
    zeroWeightRecords,
    weightedTotal: included.reduce((sum, item) => sum + item.weight, 0),
    ...(plan.weightField ? { weightField: plan.weightField } : {}),
    includedMissing,
    exposureValues,
    outcomeValues,
    strata,
  };
}

export function classicTablesOutTable(input: MapDataSource, plan: ClassicTablesPlan, result: ClassicTablesResult): MapDataSource {
  if (!plan.outputTable) throw new RangeError("TABLES OUTTABLE requires a named output table.");
  const sourceField = (name: string): FieldDefinition => {
    const field = input.fields.find((candidate) => key(candidate.name) === key(name));
    if (!field) throw new RangeError(`${name} is not a field in the active Classic table.`);
    return structuredClone(field);
  };
  const fields: FieldDefinition[] = [
    ...plan.strataFields.map(sourceField),
    sourceField(plan.exposureField),
    sourceField(plan.outcomeField),
    { name: "VARNAME", prompt: "VARNAME", type: "text", required: false },
    { name: "COUNT", prompt: "COUNT", type: "number", required: false },
  ];
  const records: EpiRecord[] = result.strata.flatMap((stratum) => stratum.rows.flatMap((row) =>
    result.outcomeValues.map((outcomeValue, outcomeIndex) => ({
      ...Object.fromEntries(plan.strataFields.map((field, index) => [field, stratum.strataValues?.[index] ?? null])),
      [plan.exposureField]: row.exposureValue,
      [plan.outcomeField]: outcomeValue,
      VARNAME: `${plan.exposureField}:${plan.outcomeField}`,
      COUNT: row.counts[outcomeIndex] ?? 0,
    })),
  ));
  return {
    projectName: input.projectName,
    formId: `classic-outtable:${plan.outputTable}`,
    formName: plan.outputTable,
    fields,
    records,
  };
}
