import type { EpiRecord, FieldDefinition, FieldType } from "../contracts/core.ts";
import type { MapDataSource } from "../contracts/maps.ts";
import { parseClassicProgram, type ClassicAggregateFunction } from "./classic-ast.ts";

export const CLASSIC_SUMMARIZE_PLAN_VERSION = "0.1.0" as const;
export type ClassicSummarizeAggregate = ClassicAggregateFunction;

export interface ClassicSummarizeInput {
  aggregate: ClassicSummarizeAggregate;
  field?: string;
  resultField: string;
  outputTable: string;
  stratifyBy?: string;
}

export interface ClassicSummarizePlan extends ClassicSummarizeInput {
  version: typeof CLASSIC_SUMMARIZE_PLAN_VERSION;
  fieldType?: FieldType;
  canonicalSource: string;
}

export interface ClassicSummarizeResult {
  source: MapDataSource;
  sourceRecords: number;
  includedRecords: number;
  excludedMissing: number;
  groups: number;
  canonicalSource: string;
}

const token = (name: string): string => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `[${name}]`;
const missing = (value: unknown): boolean => value === null || value === undefined || value === "";

export function buildClassicSummarizeCommand(input: ClassicSummarizeInput): string {
  const resultField = token(input.resultField.trim());
  const outputTable = token(input.outputTable.trim());
  if (!input.resultField.trim() || !input.outputTable.trim()) throw new RangeError("SUMMARIZE requires result and output-table names.");
  if (input.aggregate !== "COUNT" && !input.field) throw new RangeError(`${input.aggregate} requires a source field.`);
  const argument = input.field ? token(input.field) : "";
  return `SUMMARIZE ${resultField} :: ${input.aggregate}(${argument}) TO ${outputTable}${input.stratifyBy ? ` STRATAVAR=${token(input.stratifyBy)}` : ""}`;
}

const resolveField = (fields: readonly FieldDefinition[], requested: string): FieldDefinition => {
  const field = fields.find(({ name }) => name.toLocaleLowerCase("en-US") === requested.toLocaleLowerCase("en-US"));
  if (!field) throw new RangeError(`${requested} is not a field in the active Classic table.`);
  return field;
};

export function resolveClassicSummarizeCommand(source: string, fields: readonly FieldDefinition[]): ClassicSummarizePlan {
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "SummarizeStatement") throw new RangeError("Select exactly one SUMMARIZE command.");
  const statement = ast.body[0];
  if (statement.aggregates.length !== 1) throw new RangeError("This reviewed SUMMARIZE slice supports exactly one aggregate per command.");
  if (statement.stratifyBy.length > 1) throw new RangeError("This reviewed SUMMARIZE slice supports at most one STRATAVAR.");
  if (statement.weightBy) throw new RangeError("WEIGHTVAR remains disabled until weighted aggregate behavior is differentially validated.");
  const aggregate = statement.aggregates[0]!;
  const sourceField = aggregate.field ? resolveField(fields, aggregate.field.name) : undefined;
  if (!sourceField && aggregate.aggregate !== "COUNT") throw new RangeError(`${aggregate.aggregate} requires a source field.`);
  if (sourceField && ["AVG", "STDEV", "STDEVP", "SUM", "VAR", "VARP"].includes(aggregate.aggregate) && sourceField.type !== "number") {
    throw new RangeError(`${aggregate.aggregate} requires a Number field.`);
  }
  const strata = statement.stratifyBy[0] ? resolveField(fields, statement.stratifyBy[0].name) : undefined;
  if (strata && sourceField?.name === strata.name) throw new RangeError("The aggregate field and STRATAVAR must be different fields.");
  const plan: ClassicSummarizeInput = {
    aggregate: aggregate.aggregate, ...(sourceField ? { field: sourceField.name } : {}), resultField: aggregate.target.name,
    outputTable: statement.outputTable.name, ...(strata ? { stratifyBy: strata.name } : {}),
  };
  return { version: CLASSIC_SUMMARIZE_PLAN_VERSION, ...plan, ...(sourceField ? { fieldType: sourceField.type } : {}), canonicalSource: buildClassicSummarizeCommand(plan) };
}

function aggregateValue(values: unknown[], aggregate: ClassicSummarizeAggregate): string | number | boolean | null {
  if (aggregate === "COUNT") return values.length;
  if (!values.length) return null;
  if (aggregate === "FIRST") return values[0] as string | number | boolean;
  if (aggregate === "LAST") return values.at(-1) as string | number | boolean;
  if (aggregate === "MIN" || aggregate === "MAX") {
    return values.reduce((best, value) => aggregate === "MIN" ? (value! < best! ? value : best) : (value! > best! ? value : best)) as string | number | boolean;
  }
  const numbers = values.map(Number);
  const sum = numbers.reduce((total, value) => total + value, 0);
  if (aggregate === "SUM") return sum;
  if (aggregate === "AVG") return sum / numbers.length;
  const mean = sum / numbers.length;
  const sumSquares = numbers.reduce((total, value) => total + (value - mean) ** 2, 0);
  if (aggregate === "VARP") return sumSquares / numbers.length;
  if (aggregate === "STDEVP") return Math.sqrt(sumSquares / numbers.length);
  if (numbers.length < 2) return null;
  if (aggregate === "VAR") return sumSquares / (numbers.length - 1);
  return Math.sqrt(sumSquares / (numbers.length - 1));
}

export function applyClassicSummarize(input: MapDataSource, plan: ClassicSummarizePlan): ClassicSummarizeResult {
  const groupField = plan.stratifyBy;
  const groups = new Map<string, { value: unknown; records: EpiRecord[] }>();
  for (const record of input.records) {
    const value = groupField ? record[groupField] : "All records";
    const key = JSON.stringify(value ?? null);
    const group = groups.get(key) ?? { value: value ?? null, records: [] };
    group.records.push(record);
    groups.set(key, group);
  }
  if (!groups.size) groups.set("all", { value: "All records", records: [] });
  let includedRecords = 0;
  const records = [...groups.values()].map((group) => {
    const values = plan.field ? group.records.map((record) => record[plan.field!]).filter((value) => !missing(value)) : group.records.map(() => 1);
    includedRecords += values.length;
    return {
      ...(groupField ? { [groupField]: group.value as EpiRecord[string] } : {}),
      [plan.resultField]: aggregateValue(values, plan.aggregate),
    };
  });
  const fields: FieldDefinition[] = [
    ...(groupField ? [structuredClone(input.fields.find(({ name }) => name === groupField)!)] : []),
    {
      name: plan.resultField, prompt: plan.resultField,
      type: ["FIRST", "LAST", "MAX", "MIN"].includes(plan.aggregate) ? (plan.fieldType ?? "number") : "number",
      required: false,
    },
  ];
  return {
    source: { projectName: input.projectName, formId: `classic-outtable:${plan.outputTable}`, formName: plan.outputTable, fields, records },
    sourceRecords: input.records.length, includedRecords, excludedMissing: plan.field ? input.records.length - includedRecords : 0,
    groups: records.length, canonicalSource: plan.canonicalSource,
  };
}
