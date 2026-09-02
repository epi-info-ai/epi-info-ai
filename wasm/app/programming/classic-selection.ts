import type { EpiRecord, FieldDefinition, FieldType, RecordValue } from "../contracts/core.ts";
import { CLASSIC_AST_VERSION, parseClassicProgram, type ClassicExpression, type ClassicLiteralValue } from "./classic-ast.ts";
import type { ClassicSessionVariable } from "./classic-session.ts";

export const CLASSIC_SELECTION_PLAN_VERSION = "0.2.0" as const;
export type ClassicSelectionOperator = "=" | "<>" | ">" | ">=" | "<" | "<=";

export type ClassicSelectionPlan =
  | ({ kind: "apply"; version: typeof CLASSIC_SELECTION_PLAN_VERSION; astVersion: typeof CLASSIC_AST_VERSION; source: string; canonicalSource: string; expression: ClassicExpression; fields: FieldDefinition[]; variables: ClassicSessionVariable[] } & (
      | { mode: "comparison"; field: string; fieldType: FieldType; operator: ClassicSelectionOperator; value: ClassicLiteralValue }
      | { mode: "expression" }
    ))
  | { kind: "cancel"; version: typeof CLASSIC_SELECTION_PLAN_VERSION; astVersion: typeof CLASSIC_AST_VERSION; source: string; canonicalSource: "CANCEL SELECT" };

export interface ClassicSelectionResult {
  records: EpiRecord[];
  sourceRecords: number;
  selectedRecords: number;
  excludedRecords: number;
  excludedMissing: number;
}

const fieldToken = (name: string): string => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `[${name}]`;
const isMissing = (value: RecordValue | undefined): boolean => value === null || value === undefined || (typeof value === "string" && value.trim() === "");
const textTypes = new Set<FieldType>(["text", "text-uppercase", "multiline", "unique-id", "phone", "date", "time", "option"]);

export function formatClassicSelectionLiteral(value: ClassicLiteralValue): string {
  if (typeof value === "boolean") return value ? "(+)" : "(-)";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new RangeError("SELECT requires a finite numeric value.");
    return String(value);
  }
  return JSON.stringify(value);
}

export function buildClassicSelectionCommand(field: string, operator: ClassicSelectionOperator, value: ClassicLiteralValue): string {
  return `SELECT ${fieldToken(field)} ${operator} ${formatClassicSelectionLiteral(value)}`;
}

function resolvedField(fields: readonly FieldDefinition[], requested: string): FieldDefinition {
  const matches = fields.filter((field) => field.name.toLocaleLowerCase("en-US") === requested.toLocaleLowerCase("en-US"));
  if (matches.length !== 1) throw new RangeError(matches.length ? `${requested} is ambiguous in the current form.` : `${requested} is not a field in the current form.`);
  return matches[0]!;
}

function assertCompatibleLiteral(field: FieldDefinition, value: ClassicLiteralValue, operator: ClassicSelectionOperator): void {
  if (field.type === "number" && typeof value !== "number") throw new RangeError(`${field.prompt} is a Number field; enter a numeric SELECT value.`);
  if ((field.type === "checkbox" || field.type === "yes-no") && typeof value !== "boolean") throw new RangeError(`${field.prompt} is a Yes/No field; choose Yes or No.`);
  if (textTypes.has(field.type) && typeof value !== "string") throw new RangeError(`${field.prompt} requires a text SELECT value.`);
  if (field.type === "command-button") throw new RangeError(`${field.prompt} is a command button and cannot be selected.`);
  if (typeof value === "boolean" && operator !== "=" && operator !== "<>") throw new RangeError("Yes/No fields support only equals and not-equals comparisons.");
}

const supportedFunctions = new Map<string, readonly [minimum: number, maximum: number]>([
  ["ABS", [1, 1]], ["ROUND", [1, 2]], ["STRLEN", [1, 1]], ["UPPERCASE", [1, 1]],
]);

function validateExpression(expression: ClassicExpression, fields: readonly FieldDefinition[], variables: readonly ClassicSessionVariable[]): void {
  if (expression.type === "Literal" || expression.type === "Missing") return;
  if (expression.type === "IdentifierExpression") {
    const field = fields.find((candidate) => candidate.name.localeCompare(expression.name, "en-US", { sensitivity: "accent" }) === 0);
    const variable = variables.find((candidate) => candidate.name.localeCompare(expression.name, "en-US", { sensitivity: "accent" }) === 0);
    if (!field && !variable) throw new RangeError(`${expression.name} is not a field or defined variable in the current Classic session.`);
    if (field?.type === "command-button") throw new RangeError(`${field.prompt} is a command button and cannot be used in SELECT.`);
    return;
  }
  if (expression.type === "UnaryExpression") return validateExpression(expression.argument, fields, variables);
  if (expression.type === "BinaryExpression") {
    validateExpression(expression.left, fields, variables);
    validateExpression(expression.right, fields, variables);
    return;
  }
  const functionName = expression.callee.toUpperCase();
  const arity = supportedFunctions.get(functionName);
  if (!arity) throw new RangeError(`${expression.callee} is not yet a parity-reviewed SELECT function.`);
  if (expression.arguments.length < arity[0] || expression.arguments.length > arity[1]) {
    throw new RangeError(`${functionName} requires ${arity[0] === arity[1] ? arity[0] : `${arity[0]} or ${arity[1]}`} argument${arity[1] === 1 ? "" : "s"}.`);
  }
  expression.arguments.forEach((argument) => validateExpression(argument, fields, variables));
}

export function resolveClassicSelectionCommand(source: string, fields: readonly FieldDefinition[], variables: readonly ClassicSessionVariable[] = []): ClassicSelectionPlan {
  if (!source.trim()) throw new RangeError("Select one complete SELECT or CANCEL SELECT command in the Program Editor.");
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "SelectStatement") throw new RangeError("Select exactly one complete SELECT or CANCEL SELECT command.");
  const statement = ast.body[0];
  if (statement.mode !== "apply") return { kind: "cancel", version: CLASSIC_SELECTION_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION, source, canonicalSource: "CANCEL SELECT" };
  const expression = statement.expression;
  if (!expression) throw new RangeError("SELECT requires an expression.");
  validateExpression(expression, fields, variables);
  const common = {
    kind: "apply" as const, version: CLASSIC_SELECTION_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION, source,
    canonicalSource: source.trim().replace(/^select\b/i, "SELECT"), expression: structuredClone(expression),
    fields: structuredClone([...fields]), variables: structuredClone([...variables]),
  };
  if (expression.type === "BinaryExpression" && ["=", "<>", ">", ">=", "<", "<="].includes(expression.operator)
      && expression.left.type === "IdentifierExpression" && expression.right.type === "Literal") {
    const identifier = expression.left.name;
    const variable = variables.find((candidate) => candidate.name.toLocaleLowerCase("en-US") === identifier.toLocaleLowerCase("en-US"));
    if (!variable) {
      const field = resolvedField(fields, identifier);
      const operator = expression.operator as ClassicSelectionOperator;
      assertCompatibleLiteral(field, expression.right.value, operator);
      return { ...common, mode: "comparison", field: field.name, fieldType: field.type, operator, value: expression.right.value };
    }
  }
  return { ...common, mode: "expression" };
}

function compare(actual: RecordValue, expected: ClassicLiteralValue, operator: ClassicSelectionOperator): boolean {
  let left: string | number | boolean = actual as string | number | boolean;
  let right: string | number | boolean = expected;
  if (typeof expected === "number") {
    if (typeof actual !== "number" && (typeof actual !== "string" || actual.trim() === "")) return false;
    left = Number(actual);
    if (!Number.isFinite(left)) return false;
  } else if (typeof expected === "boolean") {
    if (typeof actual === "string") {
      if (/^(?:yes|true|1)$/i.test(actual)) left = true;
      else if (/^(?:no|false|0)$/i.test(actual)) left = false;
      else return false;
    } else if (typeof actual !== "boolean") return false;
  } else {
    left = String(actual).toLocaleLowerCase("en-US");
    right = expected.toLocaleLowerCase("en-US");
  }
  if (operator === "=") return left === right;
  if (operator === "<>") return left !== right;
  if (operator === ">") return left > right;
  if (operator === ">=") return left >= right;
  if (operator === "<") return left < right;
  return left <= right;
}

export function applyClassicSelection(records: readonly EpiRecord[], plan: Extract<ClassicSelectionPlan, { kind: "apply" }>): ClassicSelectionResult {
  let excludedMissing = 0;
  const selected = records.filter((record) => {
    if (plan.mode === "comparison") {
      const actual = record[plan.field];
      if (isMissing(actual)) { excludedMissing += 1; return false; }
      return compare(actual!, plan.value, plan.operator);
    }
    const evaluation = evaluateSelectionExpression(plan.expression, record, plan.fields, plan.variables);
    const included = asBoolean(evaluation.value);
    if (evaluation.missing && !included) excludedMissing += 1;
    return included;
  });
  return {
    records: structuredClone(selected), sourceRecords: records.length, selectedRecords: selected.length,
    excludedRecords: records.length - selected.length, excludedMissing,
  };
}

type Evaluated = { value: RecordValue; missing: boolean };
const evaluated = (value: RecordValue | undefined, missing = isMissing(value)): Evaluated => ({ value: value ?? null, missing });
const asBoolean = (value: RecordValue): boolean => typeof value === "boolean" ? value : typeof value === "number" ? value !== 0 : /^(?:true|yes|1)$/i.test(String(value ?? "").trim());
const asNumber = (value: RecordValue | undefined): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};
const compareValues = (left: RecordValue, right: RecordValue, operator: ClassicSelectionOperator | "LIKE"): boolean => {
  const leftMissing = isMissing(left); const rightMissing = isMissing(right);
  if (leftMissing || rightMissing) return operator === "=" ? leftMissing && rightMissing : operator === "<>" ? leftMissing !== rightMissing : false;
  if (operator === "LIKE") {
    const escaped = String(right).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`, "i").test(String(left));
  }
  const leftNumber = asNumber(left); const rightNumber = asNumber(right);
  const [a, b] = leftNumber !== null && rightNumber !== null
    ? [leftNumber, rightNumber]
    : [String(left).trim().toLocaleLowerCase("en-US"), String(right).trim().toLocaleLowerCase("en-US")];
  if (operator === "=") return a === b;
  if (operator === "<>") return a !== b;
  if (operator === ">") return a > b;
  if (operator === ">=") return a >= b;
  if (operator === "<") return a < b;
  return a <= b;
};

function evaluateSelectionExpression(expression: ClassicExpression, record: EpiRecord, fields: readonly FieldDefinition[], variables: readonly ClassicSessionVariable[]): Evaluated {
  if (expression.type === "Literal") return evaluated(expression.value, false);
  if (expression.type === "Missing") return evaluated(null, true);
  if (expression.type === "IdentifierExpression") {
    const field = fields.find(({ name }) => name.toLocaleLowerCase("en-US") === expression.name.toLocaleLowerCase("en-US"));
    if (field) return evaluated(record[field.name]);
    const variable = variables.find(({ name }) => name.toLocaleLowerCase("en-US") === expression.name.toLocaleLowerCase("en-US"));
    return evaluated(variable?.value);
  }
  if (expression.type === "UnaryExpression") {
    const argument = evaluateSelectionExpression(expression.argument, record, fields, variables);
    if (expression.operator === "NOT") return evaluated(!asBoolean(argument.value), argument.missing);
    const number = asNumber(argument.value);
    return number === null ? evaluated(null, true) : evaluated(expression.operator === "-" ? -number : number, false);
  }
  if (expression.type === "CallExpression") {
    const args = expression.arguments.map((argument) => evaluateSelectionExpression(argument, record, fields, variables));
    if (args.some(({ missing }) => missing)) return evaluated(null, true);
    const name = expression.callee.toUpperCase(); const first = args[0]?.value;
    if (name === "ABS") return evaluated(Math.abs(asNumber(first) ?? Number.NaN), false);
    if (name === "ROUND") {
      const places = Math.trunc(asNumber(args[1]?.value) ?? 0); const factor = 10 ** places;
      const number = asNumber(first) ?? Number.NaN;
      return evaluated(Math.sign(number) * Math.round(Math.abs(number) * factor) / factor, false);
    }
    if (name === "STRLEN") return evaluated(typeof first === "string" ? first.length : null, typeof first !== "string");
    return evaluated(String(first).toUpperCase(), false);
  }
  if (expression.operator === "AND" || expression.operator === "OR" || expression.operator === "XOR") {
    const left = evaluateSelectionExpression(expression.left, record, fields, variables);
    const right = evaluateSelectionExpression(expression.right, record, fields, variables);
    const a = asBoolean(left.value); const b = asBoolean(right.value);
    return evaluated(expression.operator === "AND" ? a && b : expression.operator === "OR" ? a || b : a !== b, left.missing || right.missing);
  }
  const left = evaluateSelectionExpression(expression.left, record, fields, variables);
  const right = evaluateSelectionExpression(expression.right, record, fields, variables);
  if (["LIKE", "=", "<>", ">", ">=", "<", "<="].includes(expression.operator)) {
    return evaluated(compareValues(left.value, right.value, expression.operator as ClassicSelectionOperator | "LIKE"), left.missing || right.missing);
  }
  if (expression.operator === "&") return evaluated(`${left.value ?? ""}${right.value ?? ""}`, left.missing && right.missing);
  const a = asNumber(left.value); const b = asNumber(right.value);
  if (a === null || b === null) return evaluated(null, true);
  if (expression.operator === "+") return evaluated(a + b, false);
  if (expression.operator === "-") return evaluated(a - b, false);
  if (expression.operator === "*") return evaluated(a * b, false);
  if (expression.operator === "/") return evaluated(b === 0 ? null : a / b, b === 0);
  if (expression.operator === "MOD" || expression.operator === "%") return evaluated(b === 0 ? null : a % b, b === 0);
  return evaluated(a ** b, false);
}
