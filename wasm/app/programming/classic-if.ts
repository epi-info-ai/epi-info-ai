import type { FieldDefinition } from "../contracts/core.ts";
import { CLASSIC_AST_VERSION, parseClassicProgram, type ClassicAssignStatement, type ClassicLiteralExpression, type ClassicStatement } from "./classic-ast.ts";
import { buildClassicAssignmentCommand, formatClassicAssignmentLiteral, type ClassicSessionVariableDefinition, type ClassicVariableValue } from "./classic-assignment.ts";
import type { ClassicSessionVariable } from "./classic-session.ts";
import type { ClassicSelectionOperator } from "./classic-selection.ts";

export const CLASSIC_IF_PLAN_VERSION = "0.1.0" as const;

export interface ClassicIfInput {
  conditionVariable: string;
  operator: ClassicSelectionOperator;
  compareValue: ClassicVariableValue;
  thenVariable: string;
  thenValue: ClassicVariableValue;
  elseAssignment?: { variable: string; value: ClassicVariableValue };
}

export interface ClassicIfPlan {
  kind: "if";
  version: typeof CLASSIC_IF_PLAN_VERSION;
  astVersion: typeof CLASSIC_AST_VERSION;
  source: string;
  canonicalSource: string;
  condition: { variable: ClassicSessionVariableDefinition; operator: ClassicSelectionOperator; value: ClassicVariableValue };
  consequent: { variable: ClassicSessionVariableDefinition; value: ClassicVariableValue };
  alternate?: { variable: ClassicSessionVariableDefinition; value: ClassicVariableValue };
}

export interface ClassicIfResult {
  branch: "then" | "else" | "none";
  conditionResult: boolean;
  assignment?: { variable: string; value: ClassicVariableValue };
}

const operators = new Set<ClassicSelectionOperator>(["=", "<>", ">", ">=", "<", "<="]);
const variableToken = (name: string): string => {
  const trimmed = name.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) throw new RangeError("Variable names must begin with a letter or underscore and contain only letters, numbers, and underscores.");
  return trimmed;
};
const findVariable = (variables: readonly ClassicSessionVariableDefinition[], name: string): ClassicSessionVariableDefinition | undefined =>
  variables.find((variable) => variable.name.toLocaleLowerCase("en-US") === name.toLocaleLowerCase("en-US"));

function assertLiteralCompatible(variable: ClassicSessionVariableDefinition, value: ClassicVariableValue, purpose: string): void {
  if (value === null) throw new RangeError(`${purpose} does not support Missing values in this bounded IF slice.`);
  if (variable.variableType === "NUMERIC" && typeof value !== "number") throw new RangeError(`${variable.name} is Numeric and requires a numeric literal.`);
  if (variable.variableType === "YN" && typeof value !== "boolean") throw new RangeError(`${variable.name} is Yes/No and requires (+) or (-).`);
  if (["TEXTINPUT", "DATEFORMAT", "DATETIMEFORMAT", "TIMEFORMAT"].includes(variable.variableType) && typeof value !== "string") {
    throw new RangeError(`${variable.name} requires a quoted text value in this bounded IF slice.`);
  }
}

function literal(expression: ClassicLiteralExpression): ClassicVariableValue { return expression.value; }

export function buildClassicIfCommand(input: ClassicIfInput): string {
  if (!operators.has(input.operator)) throw new RangeError("Choose a supported IF comparison.");
  const lines = [
    `IF ${variableToken(input.conditionVariable)} ${input.operator} ${formatClassicAssignmentLiteral(input.compareValue)} THEN`,
    `  ${buildClassicAssignmentCommand(input.thenVariable, input.thenValue)}`,
  ];
  if (input.elseAssignment) lines.push("ELSE", `  ${buildClassicAssignmentCommand(input.elseAssignment.variable, input.elseAssignment.value)}`);
  lines.push("END");
  return lines.join("\n");
}

function resolveAssignment(statement: ClassicStatement, variables: readonly ClassicSessionVariableDefinition[], label: string) {
  if (statement.type !== "AssignStatement") throw new RangeError(`${label} must contain exactly one ASSIGN statement.`);
  const assignment = statement as ClassicAssignStatement;
  const valueExpression = assignment.value;
  if (valueExpression.type !== "Literal") throw new RangeError(`${label} ASSIGN accepts one literal only; commands, fields, functions, and arithmetic remain fail-closed.`);
  const variable = findVariable(variables, assignment.target.name);
  if (!variable) throw new RangeError(`${assignment.target.name} is not a defined Standard variable in the current Classic session.`);
  const value = literal(valueExpression);
  assertLiteralCompatible(variable, value, `${label} ASSIGN`);
  return { variable, value };
}

export function resolveClassicIfCommand(source: string, fields: readonly FieldDefinition[], variables: readonly ClassicSessionVariableDefinition[]): ClassicIfPlan {
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "IfStatement") throw new RangeError("Select exactly one complete IF / ELSE / END block.");
  const statement = ast.body[0];
  if (statement.test.type !== "BinaryExpression") throw new RangeError("Bounded IF requires one Standard variable-to-literal comparison.");
  const test = statement.test;
  if (test.left.type !== "IdentifierExpression" || test.right.type !== "Literal" || !operators.has(test.operator as ClassicSelectionOperator)) {
    throw new RangeError("Bounded IF requires <Standard variable> <comparison> <literal>. AND, OR, fields, functions, and arithmetic remain fail-closed.");
  }
  const left = test.left;
  const right = test.right;
  if (fields.some((field) => field.name.toLocaleLowerCase("en-US") === left.name.toLocaleLowerCase("en-US"))) {
    throw new RangeError("Record-field IF conditions require reviewed record-by-record program execution and remain fail-closed.");
  }
  const conditionVariable = findVariable(variables, left.name);
  if (!conditionVariable) throw new RangeError(`${left.name} is not a defined Standard variable in the current Classic session.`);
  const compareValue = literal(right);
  assertLiteralCompatible(conditionVariable, compareValue, "IF comparison");
  if (statement.consequent.length !== 1) throw new RangeError("Bounded THEN requires exactly one ASSIGN statement.");
  if (statement.alternate.length > 1) throw new RangeError("Bounded ELSE permits at most one ASSIGN statement.");
  const consequent = resolveAssignment(statement.consequent[0]!, variables, "THEN");
  const alternate = statement.alternate.length ? resolveAssignment(statement.alternate[0]!, variables, "ELSE") : undefined;
  const canonicalSource = buildClassicIfCommand({
    conditionVariable: conditionVariable.name, operator: test.operator as ClassicSelectionOperator, compareValue,
    thenVariable: consequent.variable.name, thenValue: consequent.value,
    ...(alternate ? { elseAssignment: { variable: alternate.variable.name, value: alternate.value } } : {}),
  });
  return {
    kind: "if", version: CLASSIC_IF_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION, source, canonicalSource,
    condition: { variable: conditionVariable, operator: test.operator as ClassicSelectionOperator, value: compareValue },
    consequent, ...(alternate ? { alternate } : {}),
  };
}

function compare(left: Exclude<ClassicVariableValue, null>, operator: ClassicSelectionOperator, right: Exclude<ClassicVariableValue, null>): boolean {
  if (typeof left !== typeof right) throw new RangeError("IF comparison operands must have matching types.");
  if (operator === "=") return left === right;
  if (operator === "<>") return left !== right;
  if (typeof left === "boolean" || typeof right === "boolean") throw new RangeError("Yes/No IF comparisons support = and <> only.");
  if (operator === ">") return left > right;
  if (operator === ">=") return left >= right;
  if (operator === "<") return left < right;
  return left <= right;
}

export function evaluateClassicIf(plan: ClassicIfPlan, variables: readonly ClassicSessionVariable[]): ClassicIfResult {
  const live = variables.find((variable) => variable.name.toLocaleLowerCase("en-US") === plan.condition.variable.name.toLocaleLowerCase("en-US"));
  if (!live) throw new RangeError(`${plan.condition.variable.name} is no longer defined in this Classic session.`);
  if (live.value === null || plan.condition.value === null) throw new RangeError("Bounded IF does not silently compare Missing values; initialize the condition variable first.");
  const conditionResult = compare(live.value, plan.condition.operator, plan.condition.value);
  const selected = conditionResult ? plan.consequent : plan.alternate;
  return selected
    ? { branch: conditionResult ? "then" : "else", conditionResult, assignment: { variable: selected.variable.name, value: selected.value } }
    : { branch: "none", conditionResult };
}
