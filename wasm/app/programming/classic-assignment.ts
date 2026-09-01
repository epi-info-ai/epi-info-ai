import type { FieldDefinition, RecordValue } from "../contracts/core.ts";
import { CLASSIC_AST_VERSION, parseClassicProgram, type ClassicLiteralExpression, type ClassicLiteralValue, type ClassicVariableScope, type ClassicVariableType } from "./classic-ast.ts";

export const CLASSIC_ASSIGNMENT_PLAN_VERSION = "0.1.0" as const;

export interface ClassicSessionVariableDefinition {
  name: string;
  scope: ClassicVariableScope;
  variableType: ClassicVariableType;
  prompt?: string;
}

export type ClassicVariableValue = RecordValue;
export type ClassicDefinePlan = ClassicSessionVariableDefinition & {
  kind: "define"; version: typeof CLASSIC_ASSIGNMENT_PLAN_VERSION; astVersion: typeof CLASSIC_AST_VERSION; source: string; canonicalSource: string;
};
export type ClassicAssignPlan = {
  kind: "assign"; version: typeof CLASSIC_ASSIGNMENT_PLAN_VERSION; astVersion: typeof CLASSIC_AST_VERSION; source: string; canonicalSource: string;
  variable: ClassicSessionVariableDefinition; value: ClassicVariableValue;
};
export type ClassicUndefinePlan = {
  kind: "undefine"; version: typeof CLASSIC_ASSIGNMENT_PLAN_VERSION; astVersion: typeof CLASSIC_AST_VERSION; source: string;
  canonicalSource: string; mode: "one" | "all-standard"; variable?: ClassicSessionVariableDefinition;
};

const variableToken = (name: string): string => {
  const trimmed = name.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) throw new RangeError("Variable names must begin with a letter or underscore and contain only letters, numbers, and underscores.");
  return trimmed;
};

export function formatClassicAssignmentLiteral(value: ClassicVariableValue): string {
  if (value === null) throw new RangeError("Missing-value assignment remains fail-closed in this slice.");
  if (typeof value === "boolean") return value ? "(+)" : "(-)";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError("ASSIGN requires a finite numeric value.");
    return String(value);
  }
  return JSON.stringify(value);
}

export function buildClassicAssignmentCommand(variable: string, value: ClassicVariableValue): string {
  return `ASSIGN ${variableToken(variable)} = ${formatClassicAssignmentLiteral(value)}`;
}

export function buildClassicUndefineCommand(variable: string | "*"): string {
  return variable === "*" ? "UNDEFINE *" : `UNDEFINE ${variableToken(variable)}`;
}

function caseInsensitive<T extends { name: string }>(values: readonly T[], requested: string): T | undefined {
  return values.find((value) => value.name.toLocaleLowerCase("en-US") === requested.toLocaleLowerCase("en-US"));
}

function literalValue(literal: ClassicLiteralExpression): ClassicVariableValue { return literal.value; }

function assertCompatible(variable: ClassicSessionVariableDefinition, literal: ClassicLiteralExpression): void {
  const value = literalValue(literal);
  if (variable.variableType === "NUMERIC" && typeof value !== "number") throw new RangeError(`${variable.name} is Numeric and requires a numeric literal.`);
  if (variable.variableType === "YN" && typeof value !== "boolean") throw new RangeError(`${variable.name} is Yes/No and requires (+) or (-).`);
  if (["TEXTINPUT", "DATEFORMAT", "DATETIMEFORMAT", "TIMEFORMAT"].includes(variable.variableType) && typeof value !== "string") {
    throw new RangeError(`${variable.name} requires a quoted text value in this bounded ASSIGN slice.`);
  }
}

export function resolveClassicDefineCommand(source: string, fields: readonly FieldDefinition[], variables: readonly ClassicSessionVariableDefinition[], groups: readonly { name: string }[] = []): ClassicDefinePlan {
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "DefineStatement") throw new RangeError("Select exactly one complete DEFINE command.");
  const statement = ast.body[0];
  if (!statement.variableType || statement.initializer) throw new RangeError("Selected DEFINE requires an explicit scalar type; initializer syntax remains fail-closed.");
  if (statement.scope !== "STANDARD") throw new RangeError("Selected DEFINE currently supports Standard session variables only; Global and Permanent lifetimes remain fail-closed.");
  if (caseInsensitive(fields, statement.variable.name)) throw new RangeError(`${statement.variable.name} is a current-form field and cannot be redefined as a session variable.`);
  if (caseInsensitive(variables, statement.variable.name)) throw new RangeError(`${statement.variable.name} is already defined in this Classic session.`);
  if (caseInsensitive(groups, statement.variable.name)) throw new RangeError(`${statement.variable.name} is already a GROUPVAR in this Classic session.`);
  const definition: ClassicSessionVariableDefinition = {
    name: statement.variable.name, scope: statement.scope, variableType: statement.variableType,
    ...(statement.prompt ? { prompt: statement.prompt } : {}),
  };
  const prompt = definition.prompt ? ` ${JSON.stringify(definition.prompt)}` : "";
  return { kind: "define", version: CLASSIC_ASSIGNMENT_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION, source, canonicalSource: `DEFINE ${variableToken(definition.name)} ${definition.variableType}${prompt}`, ...definition };
}

export function resolveClassicAssignCommand(source: string, fields: readonly FieldDefinition[], variables: readonly ClassicSessionVariableDefinition[]): ClassicAssignPlan {
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "AssignStatement") throw new RangeError("Select exactly one complete ASSIGN command.");
  const statement = ast.body[0];
  if (caseInsensitive(fields, statement.target.name)) throw new RangeError("Selected ASSIGN cannot mutate data-source fields; record-by-record assignment requires a reviewed program context.");
  const variable = caseInsensitive(variables, statement.target.name);
  if (!variable) throw new RangeError(`${statement.target.name} is not a defined variable in the current Classic session. Run its DEFINE command first.`);
  if (statement.value.type !== "Literal") throw new RangeError("This reviewed ASSIGN slice accepts one literal value only. Field references, functions, and arithmetic remain fail-closed.");
  assertCompatible(variable, statement.value);
  const value = literalValue(statement.value);
  return {
    kind: "assign", version: CLASSIC_ASSIGNMENT_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION, source,
    canonicalSource: buildClassicAssignmentCommand(variable.name, value), variable, value,
  };
}

export function resolveClassicUndefineCommand(source: string, fields: readonly FieldDefinition[], variables: readonly ClassicSessionVariableDefinition[]): ClassicUndefinePlan {
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "UndefineStatement") throw new RangeError("Select exactly one complete UNDEFINE command.");
  const statement = ast.body[0];
  if (statement.mode === "all-global") throw new RangeError("UNDEFINE * GLOBAL remains fail-closed until Global variable lifetime is implemented.");
  if (statement.mode === "all-standard") return {
    kind: "undefine", version: CLASSIC_ASSIGNMENT_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION, source,
    canonicalSource: "UNDEFINE *", mode: "all-standard",
  };
  const name = statement.variable!.name;
  if (caseInsensitive(fields, name)) throw new RangeError(`${name} is a data-source field; UNDEFINE applies only to defined variables.`);
  const variable = caseInsensitive(variables, name);
  if (!variable) throw new RangeError(`${name} is not a defined Standard variable in the current Classic session.`);
  return {
    kind: "undefine", version: CLASSIC_ASSIGNMENT_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION, source,
    canonicalSource: buildClassicUndefineCommand(variable.name), mode: "one", variable,
  };
}

export function assignmentValueFromInput(variable: ClassicSessionVariableDefinition, raw: string, booleanValue = true): ClassicLiteralValue {
  if (variable.variableType === "NUMERIC") {
    const value = Number(raw);
    if (!raw.trim() || !Number.isFinite(value)) throw new RangeError(`${variable.name} requires a finite numeric value.`);
    return value;
  }
  if (variable.variableType === "YN") return booleanValue;
  if (!raw.trim()) throw new RangeError(`${variable.name} requires a value.`);
  return raw;
}
