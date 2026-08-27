import type { RecordValue } from "./core.js";

export const CHECK_CODE_VERSION = 1 as const;

export interface CheckCodeCondition {
  operator: "equals" | "not-equals";
  value: RecordValue;
  caseSensitive?: boolean;
}

export interface SafeGotoStatement {
  kind: "goto";
  targetField: string;
  when?: CheckCodeCondition;
}

export type SafeFieldAction = "enable" | "disable" | "hide" | "unhide" | "set-required" | "set-not-required";

export interface SafeFieldActionStatement {
  kind: "field-action";
  action: SafeFieldAction;
  targetField: string;
  when?: CheckCodeCondition;
}

export type SafeCheckCodeStatement = SafeGotoStatement | SafeFieldActionStatement;

export interface FieldCheckCode {
  version?: typeof CHECK_CODE_VERSION;
  after?: SafeCheckCodeStatement[];
}

function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`);
}

function recordValue(value: unknown, path: string): RecordValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fail(path, "must be a string, finite number, boolean, or null");
}

export function validateFieldCheckCode(value: unknown, path = "checkCode"): FieldCheckCode {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "must be an object");
  const source = value as Record<string, unknown>;
  if (source.version !== undefined && source.version !== CHECK_CODE_VERSION) {
    fail(`${path}.version`, `unsupported version ${JSON.stringify(source.version)}`);
  }
  const result: FieldCheckCode = {};
  if (source.version !== undefined) result.version = CHECK_CODE_VERSION;
  if (source.after !== undefined) {
    if (!Array.isArray(source.after)) fail(`${path}.after`, "must be an array");
    if (source.after.length > 8) fail(`${path}.after`, "supports at most 8 statements in this browser subset");
    result.after = source.after.map((item, index) => {
      const itemPath = `${path}.after[${index}]`;
      if (typeof item !== "object" || item === null || Array.isArray(item)) fail(itemPath, "must be an object");
      const statement = item as Record<string, unknown>;
      if (statement.kind !== "goto" && statement.kind !== "field-action") {
        fail(`${itemPath}.kind`, "must be goto or field-action");
      }
      if (typeof statement.targetField !== "string" || statement.targetField.trim() === "") {
        fail(`${itemPath}.targetField`, "must be a non-empty field name");
      }
      const resultStatement: SafeCheckCodeStatement = statement.kind === "goto"
        ? { kind: "goto", targetField: statement.targetField.trim() }
        : {
            kind: "field-action",
            action: (() => {
              if (!["enable", "disable", "hide", "unhide", "set-required", "set-not-required"].includes(String(statement.action))) {
                return fail(`${itemPath}.action`, "is not in the browser-safe field-action allowlist");
              }
              return statement.action as SafeFieldAction;
            })(),
            targetField: statement.targetField.trim(),
          };
      if (statement.when !== undefined) {
        if (typeof statement.when !== "object" || statement.when === null || Array.isArray(statement.when)) {
          fail(`${itemPath}.when`, "must be an object");
        }
        const condition = statement.when as Record<string, unknown>;
        if (condition.operator !== "equals" && condition.operator !== "not-equals") {
          fail(`${itemPath}.when.operator`, "must be equals or not-equals");
        }
        const when: CheckCodeCondition = {
          operator: condition.operator,
          value: recordValue(condition.value, `${itemPath}.when.value`),
        };
        if (condition.caseSensitive !== undefined) {
          if (typeof condition.caseSensitive !== "boolean") fail(`${itemPath}.when.caseSensitive`, "must be a boolean");
          when.caseSensitive = condition.caseSensitive;
        }
        resultStatement.when = when;
      }
      return resultStatement;
    });
  }
  return result;
}
