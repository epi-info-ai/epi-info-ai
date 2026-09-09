import type { EpiRecord, FieldDefinition } from "../contracts/core.ts";
import type { MapDataSource } from "../contracts/maps.ts";
import { legacyTFromP } from "./classic-complex-tables.ts";

export const CLASSIC_COMPLEX_MEANS_PLAN_VERSION = "classic-complex-means-v0.1.0" as const;
export interface ClassicComplexMeansPlan { version: typeof CLASSIC_COMPLEX_MEANS_PLAN_VERSION; source: string; canonicalSource: string; field: string; prompt: string; crossTabField?: string; crossTabPrompt?: string; strataField?: string; strataPrompt?: string; weightField?: string; weightPrompt?: string; psuField: string; psuPrompt: string; outputTable?: string }
export interface ClassicComplexMeansRow { label: string; count: number | null; mean: number; standardError: number | null; lowerConfidenceLimit: number | null; upperConfidenceLimit: number | null; minimum: number | null; maximum: number | null }
export interface ClassicComplexMeansResult { operation: "classic.means.complex-sample"; planVersion: typeof CLASSIC_COMPLEX_MEANS_PLAN_VERSION; sourceRecords: number; includedRecords: number; excludedRecords: number; designStrata: number; primarySamplingUnits: number; degreesOfFreedom: number; confidenceMultiplier: number; rows: ClassicComplexMeansRow[] }
interface Working { value: number; domain: string; stratum: string; psu: string; weight: number }
const key = (value: string): string => value.toLocaleLowerCase("en-US");
const token = (value: string): string => /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) ? value : `[${value}]`;
const text = (value: unknown): string | null => value === null || value === undefined || String(value).trim() === "" ? null : String(value).trim();
function field(fields: readonly FieldDefinition[], name: string): FieldDefinition { const found = fields.find((candidate) => key(candidate.name) === key(name)); if (!found) throw new RangeError(`${name} is not a field in the active Classic table.`); return found; }
function variance(records: readonly Working[], influence: (record: Working) => number): number {
  return [...new Set(records.map(({ stratum }) => stratum))].reduce((total, stratum) => {
    const members = records.filter((record) => record.stratum === stratum); const psus = [...new Set(members.map(({ psu }) => psu))]; if (psus.length <= 1) return total;
    const q = psus.map((psu) => members.filter((record) => record.psu === psu).reduce((sum, record) => sum + influence(record), 0));
    return total + (psus.length * q.reduce((sum, value) => sum + value * value, 0) - q.reduce((sum, value) => sum + value, 0) ** 2) / (psus.length - 1);
  }, 0);
}
export function resolveClassicComplexMeansPlan(source: string, fields: readonly FieldDefinition[], requested: string, crossTabBy: string | undefined, stratifyBy: string | undefined, weightBy: string | undefined, psuBy: string, outputTable?: string): ClassicComplexMeansPlan {
  const outcome = field(fields, requested), crossTab = crossTabBy ? field(fields, crossTabBy) : undefined, strata = stratifyBy ? field(fields, stratifyBy) : undefined, weight = weightBy ? field(fields, weightBy) : undefined, psu = field(fields, psuBy);
  if (outcome.type !== "number") throw new RangeError(`${outcome.name} must be a Number field for Complex Sample Means.`); if (weight && weight.type !== "number") throw new RangeError(`${weight.name} must be a Number field for Complex Sample Means WEIGHTVAR.`);
  const chosen = [outcome.name, crossTab?.name, strata?.name, weight?.name, psu.name].filter((value): value is string => Boolean(value)); if (new Set(chosen.map(key)).size !== chosen.length) throw new RangeError("Complex Sample Means fields must be different.");
  return { version: CLASSIC_COMPLEX_MEANS_PLAN_VERSION, source, canonicalSource: `MEANS ${token(outcome.name)}${crossTab ? ` ${token(crossTab.name)}` : ""}${strata ? ` STRATAVAR=${token(strata.name)}` : ""}${weight ? ` WEIGHTVAR=${token(weight.name)}` : ""}${outputTable ? ` OUTTABLE=${token(outputTable)}` : ""} PSUVAR=${token(psu.name)}`, field: outcome.name, prompt: outcome.prompt, ...(crossTab ? { crossTabField: crossTab.name, crossTabPrompt: crossTab.prompt } : {}), ...(strata ? { strataField: strata.name, strataPrompt: strata.prompt } : {}), ...(weight ? { weightField: weight.name, weightPrompt: weight.prompt } : {}), psuField: psu.name, psuPrompt: psu.prompt, ...(outputTable ? { outputTable } : {}) };
}
export function applyClassicComplexMeans(records: readonly EpiRecord[], plan: ClassicComplexMeansPlan): ClassicComplexMeansResult {
  const included: Working[] = []; let excludedRecords = 0;
  for (const record of records) { const value = Number(record[plan.field]); const domain = plan.crossTabField ? text(record[plan.crossTabField]) : "TOTAL"; const stratum = plan.strataField ? text(record[plan.strataField]) : "All records"; const psu = text(record[plan.psuField]); const weight = plan.weightField ? Number(record[plan.weightField]) : 1; if (!Number.isFinite(value) || !domain || !stratum || !psu || !Number.isFinite(weight) || weight < 0) { excludedRecords++; continue; } included.push({ value, domain, stratum, psu, weight }); }
  if (!included.length) throw new RangeError("Complex Sample Means found no complete records for the selected survey design fields.");
  const pairs = new Set(included.map(({ stratum, psu }) => `${JSON.stringify(stratum)}\u0000${JSON.stringify(psu)}`)); const designStrata = new Set(included.map(({ stratum }) => stratum)).size; const degreesOfFreedom = pairs.size - designStrata; if (degreesOfFreedom <= 0) throw new RangeError("Complex Sample Means requires at least two complete PSUs within the survey design."); const confidenceMultiplier = legacyTFromP(0.95, degreesOfFreedom);
  const domains = plan.crossTabField ? [...new Set(included.map(({ domain }) => domain))].sort((a, b) => a.localeCompare(b, "en-US", { numeric: true, sensitivity: "base" })) : ["TOTAL"];
  const estimates = domains.map((label) => { const members = included.filter(({ domain }) => domain === label); const sumWeight = members.reduce((sum, record) => sum + record.weight, 0); const mean = members.reduce((sum, record) => sum + record.value * record.weight, 0) / sumWeight; const varT = variance(included, (record) => record.domain === label ? (record.value - mean) * record.weight / sumWeight : 0); const se = varT > 0 ? Math.sqrt(varT) : null; return { label, count: members.length, mean, standardError: se, lowerConfidenceLimit: se === null ? null : mean - confidenceMultiplier * se, upperConfidenceLimit: se === null ? null : mean + confidenceMultiplier * se, minimum: Math.min(...members.map(({ value }) => value)), maximum: Math.max(...members.map(({ value }) => value)) }; });
  const rows: ClassicComplexMeansRow[] = [...estimates];
  if (estimates.length === 2) { const [left, right] = estimates; const diff = left!.mean - right!.mean; const leftWeight = included.filter(({ domain }) => domain === left!.label).reduce((sum, record) => sum + record.weight, 0); const rightWeight = included.filter(({ domain }) => domain === right!.label).reduce((sum, record) => sum + record.weight, 0); const varT = variance(included, (record) => record.domain === left!.label ? (record.value-left!.mean)*record.weight/leftWeight : record.domain === right!.label ? -(record.value-right!.mean)*record.weight/rightWeight : 0); const se = varT > 0 ? Math.sqrt(varT) : null; rows.push({ label: "Difference", count: null, mean: diff, standardError: se, lowerConfidenceLimit: se === null ? null : diff-confidenceMultiplier*se, upperConfidenceLimit: se === null ? null : diff+confidenceMultiplier*se, minimum: null, maximum: null }); }
  return { operation: "classic.means.complex-sample", planVersion: CLASSIC_COMPLEX_MEANS_PLAN_VERSION, sourceRecords: records.length, includedRecords: included.length, excludedRecords, designStrata, primarySamplingUnits: pairs.size, degreesOfFreedom, confidenceMultiplier, rows };
}

/**
 * Browser adaptation: desktop CSM exposes a disabled Output to Table control and
 * its EICSMeans path never calls OutTable. This materializes the visible result
 * rows into an explicitly named session table without claiming a legacy schema.
 */
export function classicComplexMeansOutTable(input: MapDataSource, plan: ClassicComplexMeansPlan, result: ClassicComplexMeansResult): MapDataSource {
  if (!plan.outputTable) throw new RangeError("Complex Sample Means OUTTABLE requires a named output table.");
  const domainField = plan.crossTabField
    ? structuredClone(input.fields.find((candidate) => key(candidate.name) === key(plan.crossTabField!))!)
    : { name: "Domain", prompt: "Domain", type: "text" as const, required: false };
  const fields: FieldDefinition[] = [
    domainField,
    { name: "VARNAME", prompt: "Variable Name", type: "text", required: false },
    { name: "COUNT", prompt: "Count", type: "number", required: false },
    { name: "MEAN", prompt: "Mean", type: "number", required: false },
    { name: "StdErr", prompt: "Standard Error", type: "number", required: false },
    { name: "LCL", prompt: "Lower Confidence Limit", type: "number", required: false },
    { name: "UCL", prompt: "Upper Confidence Limit", type: "number", required: false },
    { name: "MIN", prompt: "Minimum", type: "number", required: false },
    { name: "MAX", prompt: "Maximum", type: "number", required: false },
  ];
  const records: EpiRecord[] = result.rows.map((row) => ({
    [domainField.name]: row.label, VARNAME: plan.field, COUNT: row.count, MEAN: row.mean,
    StdErr: row.standardError, LCL: row.lowerConfidenceLimit, UCL: row.upperConfidenceLimit,
    MIN: row.minimum, MAX: row.maximum,
  }));
  return { projectName: input.projectName, formId: `classic-outtable:${plan.outputTable}`, formName: plan.outputTable, fields, records };
}
