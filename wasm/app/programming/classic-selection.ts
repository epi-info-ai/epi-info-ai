import type { EpiRecord, FieldDefinition, FieldType, RecordValue } from "../contracts/core.ts";
import { CLASSIC_AST_VERSION, parseClassicProgram, type ClassicLiteralValue } from "./classic-ast.ts";

export const CLASSIC_SELECTION_PLAN_VERSION = "0.1.0" as const;
export type ClassicSelectionOperator = "=" | "<>" | ">" | ">=" | "<" | "<=";

export type ClassicSelectionPlan =
  | { kind: "apply"; version: typeof CLASSIC_SELECTION_PLAN_VERSION; astVersion: typeof CLASSIC_AST_VERSION; source: string; canonicalSource: string; field: string; fieldType: FieldType; operator: ClassicSelectionOperator; value: ClassicLiteralValue }
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

export function resolveClassicSelectionCommand(source: string, fields: readonly FieldDefinition[]): ClassicSelectionPlan {
  if (!source.trim()) throw new RangeError("Select one complete SELECT or CANCEL SELECT command in the Program Editor.");
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "SelectStatement") throw new RangeError("Select exactly one complete SELECT or CANCEL SELECT command.");
  const statement = ast.body[0];
  if (statement.mode !== "apply") return { kind: "cancel", version: CLASSIC_SELECTION_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION, source, canonicalSource: "CANCEL SELECT" };
  const expression = statement.expression;
  if (!expression || expression.type !== "BinaryExpression" || !["=", "<>", ">", ">=", "<", "<="].includes(expression.operator)) {
    throw new RangeError("This reviewed SELECT slice supports one field-to-value comparison. AND, OR, LIKE, functions, and arithmetic remain fail-closed.");
  }
  if (expression.left.type !== "IdentifierExpression" || expression.right.type !== "Literal") {
    throw new RangeError("SELECT must compare one current-form field on the left with one literal value on the right.");
  }
  const field = resolvedField(fields, expression.left.name);
  const operator = expression.operator as ClassicSelectionOperator;
  assertCompatibleLiteral(field, expression.right.value, operator);
  return {
    kind: "apply", version: CLASSIC_SELECTION_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION, source,
    canonicalSource: buildClassicSelectionCommand(field.name, operator, expression.right.value),
    field: field.name, fieldType: field.type, operator, value: expression.right.value,
  };
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
    const actual = record[plan.field];
    if (isMissing(actual)) { excludedMissing += 1; return false; }
    return compare(actual!, plan.value, plan.operator);
  });
  return {
    records: structuredClone(selected), sourceRecords: records.length, selectedRecords: selected.length,
    excludedRecords: records.length - selected.length, excludedMissing,
  };
}
