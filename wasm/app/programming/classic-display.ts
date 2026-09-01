import type { FieldDefinition, RecordValue } from "../contracts/core.ts";
import { CLASSIC_AST_VERSION, parseClassicProgram } from "./classic-ast.ts";
import type { ClassicSessionVariable } from "./classic-session.ts";

export const CLASSIC_DISPLAY_PLAN_VERSION = "0.1.0" as const;
export type ClassicDisplayMode = "all" | "defined" | "fields" | "list";

export interface ClassicDisplayInput { mode: ClassicDisplayMode; variables?: string[] }
export interface ClassicDisplayRow {
  pageNumber: string;
  prompt: string;
  fieldType: string;
  variable: string;
  variableValue: RecordValue;
  formatValue: string;
  specialInfo: "DataSource" | "Standard";
  table: string;
}
export interface ClassicDisplayPlan {
  kind: "display";
  version: typeof CLASSIC_DISPLAY_PLAN_VERSION;
  astVersion: typeof CLASSIC_AST_VERSION;
  source: string;
  canonicalSource: string;
  mode: ClassicDisplayMode;
  fields: FieldDefinition[];
  variables: ClassicSessionVariable[];
}

const token = (name: string): string => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `[${name}]`;
const key = (name: string): string => name.toLocaleLowerCase("en-US");

export function buildClassicDisplayCommand(input: ClassicDisplayInput): string {
  if (input.mode === "all") return "DISPLAY DBVARIABLES";
  if (input.mode === "defined") return "DISPLAY DBVARIABLES DEFINE";
  if (input.mode === "fields") return "DISPLAY DBVARIABLES FIELDVAR";
  if (!input.variables?.length) throw new RangeError("Selected DISPLAY requires at least one variable.");
  if (new Set(input.variables.map(key)).size !== input.variables.length) throw new RangeError("Each DISPLAY variable may appear only once.");
  return `DISPLAY DBVARIABLES LIST ${input.variables.map(token).join(" ")}`;
}

export function resolveClassicDisplayCommand(source: string, fields: readonly FieldDefinition[], variables: readonly ClassicSessionVariable[]): ClassicDisplayPlan {
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "DisplayStatement") throw new RangeError("Select exactly one complete DISPLAY DBVARIABLES command.");
  const statement = ast.body[0];
  const fieldMap = new Map(fields.map((field) => [key(field.name), field]));
  const variableMap = new Map(variables.map((variable) => [key(variable.name), variable]));
  let selectedFields: FieldDefinition[] = [];
  let selectedVariables: ClassicSessionVariable[] = [];
  const canonicalVariables: string[] = [];
  if (statement.mode === "all" || statement.mode === "fields") selectedFields = [...fields];
  if (statement.mode === "all" || statement.mode === "defined") selectedVariables = [...variables];
  if (statement.mode === "list") {
    const seen = new Set<string>();
    for (const requested of statement.variables) {
      const requestedKey = key(requested.name);
      if (seen.has(requestedKey)) throw new RangeError(`${requested.name} appears more than once in DISPLAY.`);
      seen.add(requestedKey);
      const field = fieldMap.get(requestedKey);
      const variable = variableMap.get(requestedKey);
      if (!field && !variable) throw new RangeError(`${requested.name} is not available in the current Classic session.`);
      if (field) { selectedFields.push(field); canonicalVariables.push(field.name); }
      else { selectedVariables.push(variable!); canonicalVariables.push(variable!.name); }
    }
  }
  const canonicalSource = buildClassicDisplayCommand({
    mode: statement.mode,
    ...(statement.mode === "list" ? { variables: canonicalVariables } : {}),
  });
  return {
    kind: "display", version: CLASSIC_DISPLAY_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION, source, canonicalSource,
    mode: statement.mode, fields: structuredClone(selectedFields), variables: structuredClone(selectedVariables),
  };
}

export function classicDisplayRows(plan: ClassicDisplayPlan, formName: string): ClassicDisplayRow[] {
  const fieldRows = plan.fields.map((field): ClassicDisplayRow => ({
    pageNumber: "", prompt: field.prompt, fieldType: field.type, variable: field.name, variableValue: null,
    formatValue: "", specialInfo: "DataSource", table: formName,
  }));
  const variableRows = plan.variables.map((variable): ClassicDisplayRow => ({
    pageNumber: "", prompt: variable.prompt ?? variable.name, fieldType: variable.variableType, variable: variable.name,
    variableValue: variable.value, formatValue: "", specialInfo: "Standard", table: "Defined",
  }));
  return [...fieldRows, ...variableRows].sort((left, right) => left.table.localeCompare(right.table) || left.variable.localeCompare(right.variable));
}
