import type { EpiRecord, FieldDefinition, FieldType } from "../contracts/core.ts";
import type { MapDataSource } from "../contracts/maps.ts";
import { legacyTFromP } from "./classic-complex-tables.ts";

export const CLASSIC_COMPLEX_FREQUENCY_PLAN_VERSION = "classic-complex-frequency-v0.1.0" as const;

export interface ClassicComplexFrequencyPlan {
  version: typeof CLASSIC_COMPLEX_FREQUENCY_PLAN_VERSION;
  source: string;
  canonicalSource: string;
  field: string;
  prompt: string;
  fieldType: FieldType;
  strataField?: string;
  strataPrompt?: string;
  weightField?: string;
  weightPrompt?: string;
  psuField: string;
  psuPrompt: string;
  outputTable?: string;
}

export interface ClassicComplexFrequencyRow {
  value: string;
  count: number;
  weightedCount: number;
  percent: number;
  standardError: number;
  lowerConfidenceLimit: number;
  upperConfidenceLimit: number;
  logitLowerConfidenceLimit: number | null;
  logitUpperConfidenceLimit: number | null;
  designEffect: number | null;
}

export interface ClassicComplexFrequencyResult {
  operation: "classic.frequency.complex-sample";
  planVersion: typeof CLASSIC_COMPLEX_FREQUENCY_PLAN_VERSION;
  sourceRecords: number;
  includedRecords: number;
  excludedRecords: number;
  weightedTotal: number;
  rows: ClassicComplexFrequencyRow[];
  designStrata: number;
  primarySamplingUnits: number;
  degreesOfFreedom: number;
  confidenceMultiplier: number;
}

interface WorkingRecord { value: string; stratum: string; psu: string; weight: number }

const key = (value: string): string => value.toLocaleLowerCase("en-US");
const token = (value: string): string => /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) ? value : `[${value}]`;
const category = (value: unknown): string | null => value === null || value === undefined || String(value).trim() === "" ? null : String(value).trim();
const compare = (left: string, right: string): number => left.localeCompare(right, "en-US", { numeric: true, sensitivity: "base" });

function ordered(values: readonly string[], type: FieldType): string[] {
  const sorted = [...values].sort(compare);
  if (sorted.length !== 2 || (type !== "yes-no" && type !== "checkbox")) return sorted;
  const rank = (value: string): number => ["1", "true", "yes", "y"].includes(key(value)) ? 0 : ["0", "false", "no", "n"].includes(key(value)) ? 1 : 2;
  return sorted.sort((left, right) => rank(left) - rank(right));
}

function resolveField(fields: readonly FieldDefinition[], requested: string): FieldDefinition {
  const field = fields.find(({ name }) => key(name) === key(requested));
  if (!field) throw new RangeError(`${requested} is not a field in the active Classic table.`);
  if (field.type === "command-button") throw new RangeError(`${field.name} cannot participate in Complex Sample Frequencies.`);
  return field;
}

function designVariance(records: readonly WorkingRecord[], influence: (record: WorkingRecord) => number): number {
  return [...new Set(records.map(({ stratum }) => stratum))].reduce((total, stratum) => {
    const members = records.filter((record) => record.stratum === stratum);
    const psus = [...new Set(members.map(({ psu }) => psu))];
    if (psus.length <= 1) return total;
    const clusterTotals = psus.map((psu) => members.filter((record) => record.psu === psu).reduce((sum, record) => sum + influence(record), 0));
    const sum = clusterTotals.reduce((accumulator, value) => accumulator + value, 0);
    const sumSquares = clusterTotals.reduce((accumulator, value) => accumulator + value * value, 0);
    return total + (psus.length * sumSquares - sum * sum) / (psus.length - 1);
  }, 0);
}

export function resolveClassicComplexFrequencyPlan(source: string, fields: readonly FieldDefinition[], requestedField: string, stratifyBy: string | undefined, weightBy: string | undefined, psuBy: string, outputTable?: string): ClassicComplexFrequencyPlan {
  const field = resolveField(fields, requestedField);
  const strata = stratifyBy ? resolveField(fields, stratifyBy) : undefined;
  const weight = weightBy ? resolveField(fields, weightBy) : undefined;
  const psu = resolveField(fields, psuBy);
  if (weight && weight.type !== "number") throw new RangeError(`${weight.name} must be a Number field for Complex Sample Frequencies WEIGHTVAR.`);
  const selected = [field.name, strata?.name, weight?.name, psu.name].filter((value): value is string => Boolean(value));
  if (new Set(selected.map(key)).size !== selected.length) throw new RangeError("Complex Sample Frequencies analysis, STRATAVAR, WEIGHTVAR, and PSUVAR fields must be different.");
  return {
    version: CLASSIC_COMPLEX_FREQUENCY_PLAN_VERSION, source,
    canonicalSource: `FREQ ${token(field.name)}${strata ? ` STRATAVAR=${token(strata.name)}` : ""}${weight ? ` WEIGHTVAR=${token(weight.name)}` : ""} PSUVAR=${token(psu.name)}${outputTable ? ` OUTTABLE=${token(outputTable)}` : ""}`,
    field: field.name, prompt: field.prompt, fieldType: field.type,
    ...(strata ? { strataField: strata.name, strataPrompt: strata.prompt } : {}),
    ...(weight ? { weightField: weight.name, weightPrompt: weight.prompt } : {}),
    psuField: psu.name, psuPrompt: psu.prompt, ...(outputTable ? { outputTable } : {}),
  };
}

export function applyClassicComplexFrequency(records: readonly EpiRecord[], plan: ClassicComplexFrequencyPlan): ClassicComplexFrequencyResult {
  const included: WorkingRecord[] = [];
  let excludedRecords = 0;
  for (const record of records) {
    const value = category(record[plan.field]);
    const stratum = plan.strataField ? category(record[plan.strataField]) : "All records";
    const psu = category(record[plan.psuField]);
    const rawWeight = plan.weightField ? record[plan.weightField] : 1;
    const weight = typeof rawWeight === "number" ? rawWeight : Number(rawWeight);
    if (!value || !stratum || !psu || !Number.isFinite(weight) || weight < 0) { excludedRecords++; continue; }
    included.push({ value, stratum, psu, weight });
  }
  if (!included.length) throw new RangeError("Complex Sample Frequencies found no complete records for the selected survey design fields.");
  const designPairs = new Set(included.map(({ stratum, psu }) => `${JSON.stringify(stratum)}\u0000${JSON.stringify(psu)}`));
  const designStrata = new Set(included.map(({ stratum }) => stratum)).size;
  const degreesOfFreedom = designPairs.size - designStrata;
  if (degreesOfFreedom <= 0) throw new RangeError("Complex Sample Frequencies requires at least two complete PSUs within the survey design.");
  const confidenceMultiplier = legacyTFromP(0.95, degreesOfFreedom);
  const weightedTotal = included.reduce((sum, record) => sum + record.weight, 0);
  const values = ordered([...new Set(included.map(({ value }) => value))], plan.fieldType);
  const firstValue = values[0]!;
  const firstWeighted = included.filter(({ value }) => value === firstValue).reduce((sum, record) => sum + record.weight, 0);
  const firstProportion = firstWeighted / weightedTotal;
  const firstVariance = designVariance(included, (record) => record.weight * ((record.value === firstValue ? 1 : 0) - firstProportion) / weightedTotal);
  const deffDenominator = included.length > 1 ? firstProportion * (1 - firstProportion) / (included.length - 1) : 0;
  // Legacy EICSTables.DesignEffect uses the first category and repeats that value on every CSF row.
  const designEffect = deffDenominator ? firstVariance / deffDenominator : null;
  const rows = values.map((value) => {
    const members = included.filter((record) => record.value === value);
    const weightedCount = members.reduce((sum, record) => sum + record.weight, 0);
    const proportion = weightedCount / weightedTotal;
    const variance = designVariance(included, (record) => record.weight * ((record.value === value ? 1 : 0) - proportion) / weightedTotal);
    const standardErrorProportion = Math.sqrt(Math.max(0, variance));
    const standardError = 100 * standardErrorProportion;
    let logitLowerConfidenceLimit: number | null = null;
    let logitUpperConfidenceLimit: number | null = null;
    if (proportion > 0 && proportion < 1) {
      const logit = Math.log(proportion / (1 - proportion));
      const error = confidenceMultiplier * standardErrorProportion / (proportion * (1 - proportion));
      const inverse = (candidate: number): number => 100 * Math.exp(candidate) / (1 + Math.exp(candidate));
      logitLowerConfidenceLimit = inverse(logit - error);
      logitUpperConfidenceLimit = inverse(logit + error);
    }
    return {
      value, count: members.length, weightedCount, percent: 100 * proportion, standardError,
      lowerConfidenceLimit: 100 * proportion - confidenceMultiplier * standardError,
      upperConfidenceLimit: 100 * proportion + confidenceMultiplier * standardError,
      logitLowerConfidenceLimit, logitUpperConfidenceLimit, designEffect,
    };
  });
  return {
    operation: "classic.frequency.complex-sample", planVersion: CLASSIC_COMPLEX_FREQUENCY_PLAN_VERSION,
    sourceRecords: records.length, includedRecords: included.length, excludedRecords, weightedTotal, rows,
    designStrata, primarySamplingUnits: designPairs.size, degreesOfFreedom, confidenceMultiplier,
  };
}

export function classicComplexFrequencyOutTable(input: MapDataSource, plan: ClassicComplexFrequencyPlan, result: ClassicComplexFrequencyResult): MapDataSource {
  if (!plan.outputTable) throw new RangeError("Complex Sample Frequencies OUTTABLE requires a named output table.");
  const fields: FieldDefinition[] = [
    { name: plan.field, prompt: plan.prompt, type: "number", required: false },
    { name: "VARNAME", prompt: "Variable Name", type: "text", required: false },
    { name: "COUNT", prompt: "Count", type: "number", required: false },
    { name: "RowPct", prompt: "Row Percent", type: "number", required: false },
    { name: "ColPct", prompt: "Column Percent", type: "number", required: false },
    { name: "StdErr", prompt: "Standard Error Percent", type: "number", required: false },
    { name: "LCL", prompt: "Lower Confidence Limit", type: "number", required: false },
    { name: "UCL", prompt: "Upper Confidence Limit", type: "number", required: false },
    { name: "DesignEff", prompt: "Design Effect", type: "number", required: false },
  ];
  const outputRecords: EpiRecord[] = result.rows.map((row, index) => ({
    [plan.field]: index + 1, VARNAME: plan.field, COUNT: row.count, RowPct: 100, ColPct: row.percent,
    StdErr: row.standardError, LCL: row.lowerConfidenceLimit, UCL: row.upperConfidenceLimit, DesignEff: row.designEffect,
  }));
  return { projectName: input.projectName, formId: `classic-outtable:${plan.outputTable}`, formName: plan.outputTable, fields, records: outputRecords };
}
