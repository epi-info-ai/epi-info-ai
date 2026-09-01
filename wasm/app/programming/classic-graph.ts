import type { FieldDefinition } from "../contracts/core.ts";
import { parseClassicProgram } from "./classic-ast.ts";

export const CLASSIC_GRAPH_PLAN_VERSION = "0.3.0" as const;
export type ClassicGraphType = "Bar" | "Column" | "Pie";

export interface ClassicGraphInput {
  field: string;
  graphType: ClassicGraphType;
  title?: string;
  xTitle?: string;
  yTitle?: string;
}

export interface ClassicGraphPlan extends ClassicGraphInput {
  version: typeof CLASSIC_GRAPH_PLAN_VERSION;
  fieldDefinition: FieldDefinition;
  canonicalSource: string;
}

const token = (name: string): string => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `[${name}]`;
const option = (name: string, value?: string): string => value?.trim() ? ` ${name}="${value.trim().replace(/"/g, '""')}"` : "";

export function buildClassicGraphCommand(input: ClassicGraphInput): string {
  if (!input.field.trim()) throw new RangeError("GRAPH requires a variable.");
  if (input.graphType !== "Bar" && input.graphType !== "Column" && input.graphType !== "Pie") throw new RangeError("This reviewed GRAPH slice supports Bar, Column, and Pie charts only.");
  return `GRAPH ${token(input.field)} GRAPHTYPE="${input.graphType}"${option("TITLETEXT", input.title)}${option("XTITLE", input.xTitle)}${option("YTITLE", input.yTitle)}`;
}

export function resolveClassicGraphCommand(source: string, fields: readonly FieldDefinition[]): ClassicGraphPlan {
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "GraphStatement") throw new RangeError("Select exactly one GRAPH command.");
  const statement = ast.body[0];
  const graphType = statement.graphType.toLocaleLowerCase("en-US");
  if (graphType !== "bar" && graphType !== "column" && graphType !== "pie") throw new RangeError(`GRAPH type ${JSON.stringify(statement.graphType)} remains disabled; this slice supports Bar, Column, and Pie charts only.`);
  const fieldDefinition = fields.find(({ name }) => name.toLocaleLowerCase("en-US") === statement.field.name.toLocaleLowerCase("en-US"));
  if (!fieldDefinition) throw new RangeError(`${statement.field.name} is not a field in the active Classic data source.`);
  const input: ClassicGraphInput = {
    field: fieldDefinition.name, graphType: graphType === "bar" ? "Bar" : graphType === "column" ? "Column" : "Pie",
    ...(statement.title?.trim() ? { title: statement.title } : {}),
    ...(statement.xTitle?.trim() ? { xTitle: statement.xTitle } : {}),
    ...(statement.yTitle?.trim() ? { yTitle: statement.yTitle } : {}),
  };
  return { version: CLASSIC_GRAPH_PLAN_VERSION, ...input, fieldDefinition, canonicalSource: buildClassicGraphCommand(input) };
}
