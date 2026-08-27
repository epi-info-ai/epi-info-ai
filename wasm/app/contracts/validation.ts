export const VALIDATION_RULE_VERSION = 1 as const;

export type ValidationSeverity = "error" | "warning";

interface RuleBase {
  version?: typeof VALIDATION_RULE_VERSION;
  message?: string;
  severity?: ValidationSeverity;
}

export interface RequiredRule extends RuleBase {
  kind: "required";
}

export interface RangeRule extends RuleBase {
  kind: "range";
  valueType: "number" | "date";
  min?: number | string;
  max?: number | string;
}

export interface LegalValuesRule extends RuleBase {
  kind: "legal-values";
  values: string[];
  allowComment?: boolean;
  caseSensitive?: boolean;
}

export interface PatternRule extends RuleBase {
  kind: "pattern";
  pattern: string;
  flags?: string;
  valueType?: "text" | "number" | "date";
}

export interface UniqueRule extends RuleBase {
  kind: "unique";
  caseSensitive?: boolean;
}

export interface CalculatedAgeRule extends RuleBase {
  kind: "calculated-age";
  sourceDateField: string;
  asOfDateField?: string;
}

export interface CoordinateRule extends RuleBase {
  kind: "coordinate";
  axis: "latitude" | "longitude";
  minimumDecimalPlaces: number;
}

export type FieldValidationRule = RequiredRule | RangeRule | LegalValuesRule | PatternRule | UniqueRule | CalculatedAgeRule | CoordinateRule;

export interface FieldValidationIssue {
  formId: string;
  recordIndex: number;
  fieldName: string;
  rule: FieldValidationRule["kind"];
  severity: ValidationSeverity;
  message: string;
  suggestedResolution: string;
}

function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`);
}

function optionalBase(source: Record<string, unknown>, path: string): RuleBase {
  const base: RuleBase = {};
  if (source.version !== undefined && source.version !== VALIDATION_RULE_VERSION) {
    fail(`${path}.version`, `unsupported version ${JSON.stringify(source.version)}`);
  }
  if (source.version !== undefined) base.version = VALIDATION_RULE_VERSION;
  if (source.message !== undefined) {
    if (typeof source.message !== "string" || source.message.trim() === "") fail(`${path}.message`, "must be a non-empty string");
    base.message = source.message;
  }
  if (source.severity !== undefined) {
    if (source.severity !== "error" && source.severity !== "warning") fail(`${path}.severity`, "must be error or warning");
    base.severity = source.severity;
  }
  return base;
}

function optionalBoolean(source: Record<string, unknown>, key: string, path: string): boolean | undefined {
  if (source[key] === undefined) return undefined;
  if (typeof source[key] !== "boolean") fail(`${path}.${key}`, "must be a boolean");
  return source[key];
}

export function validateFieldRules(value: unknown, path = "rules"): FieldValidationRule[] {
  if (!Array.isArray(value)) fail(path, "must be an array");
  return value.map((item, index) => {
    const rulePath = `${path}[${index}]`;
    if (typeof item !== "object" || item === null || Array.isArray(item)) fail(rulePath, "must be an object");
    const source = item as Record<string, unknown>;
    const base = optionalBase(source, rulePath);
    if (source.kind === "required") return { ...base, kind: "required" };
    if (source.kind === "unique") {
      const caseSensitive = optionalBoolean(source, "caseSensitive", rulePath);
      return caseSensitive === undefined ? { ...base, kind: "unique" } : { ...base, kind: "unique", caseSensitive };
    }
    if (source.kind === "calculated-age") {
      if (typeof source.sourceDateField !== "string" || source.sourceDateField.trim() === "") {
        fail(`${rulePath}.sourceDateField`, "must be a non-empty field name");
      }
      const result: CalculatedAgeRule = {
        ...base,
        kind: "calculated-age",
        sourceDateField: source.sourceDateField.trim(),
      };
      if (source.asOfDateField !== undefined) {
        if (typeof source.asOfDateField !== "string" || source.asOfDateField.trim() === "") {
          fail(`${rulePath}.asOfDateField`, "must be a non-empty field name");
        }
        result.asOfDateField = source.asOfDateField.trim();
      }
      return result;
    }
    if (source.kind === "coordinate") {
      if (source.axis !== "latitude" && source.axis !== "longitude") {
        fail(`${rulePath}.axis`, "must be latitude or longitude");
      }
      if (!Number.isInteger(source.minimumDecimalPlaces) || Number(source.minimumDecimalPlaces) < 5 || Number(source.minimumDecimalPlaces) > 15) {
        fail(`${rulePath}.minimumDecimalPlaces`, "must be an integer from 5 through 15");
      }
      return {
        ...base,
        kind: "coordinate",
        axis: source.axis,
        minimumDecimalPlaces: Number(source.minimumDecimalPlaces),
      };
    }
    if (source.kind === "legal-values") {
      if (!Array.isArray(source.values) || source.values.length === 0 || source.values.some((entry) => typeof entry !== "string")) {
        fail(`${rulePath}.values`, "must contain one or more strings");
      }
      const values = [...new Set(source.values as string[])];
      const allowComment = optionalBoolean(source, "allowComment", rulePath);
      const caseSensitive = optionalBoolean(source, "caseSensitive", rulePath);
      const result: LegalValuesRule = { ...base, kind: "legal-values", values };
      if (allowComment !== undefined) result.allowComment = allowComment;
      if (caseSensitive !== undefined) result.caseSensitive = caseSensitive;
      return result;
    }
    if (source.kind === "pattern") {
      if (typeof source.pattern !== "string" || source.pattern === "") fail(`${rulePath}.pattern`, "must be a non-empty string");
      if (source.flags !== undefined && typeof source.flags !== "string") fail(`${rulePath}.flags`, "must be a string");
      if (source.valueType !== undefined && !["text", "number", "date"].includes(String(source.valueType))) {
        fail(`${rulePath}.valueType`, "must be text, number, or date");
      }
      try {
        new RegExp(source.pattern, typeof source.flags === "string" ? source.flags : "");
      } catch {
        fail(`${rulePath}.pattern`, "must be a valid regular expression");
      }
      const result: PatternRule = { ...base, kind: "pattern", pattern: source.pattern };
      if (typeof source.flags === "string") result.flags = source.flags;
      if (source.valueType === "text" || source.valueType === "number" || source.valueType === "date") {
        result.valueType = source.valueType;
      }
      return result;
    }
    if (source.kind === "range") {
      if (source.valueType !== "number" && source.valueType !== "date") fail(`${rulePath}.valueType`, "must be number or date");
      if (source.min === undefined && source.max === undefined) fail(rulePath, "must define min, max, or both");
      const result: RangeRule = { ...base, kind: "range", valueType: source.valueType };
      for (const key of ["min", "max"] as const) {
        const bound = source[key];
        if (bound === undefined) continue;
        if (source.valueType === "number" && (typeof bound !== "number" || !Number.isFinite(bound))) {
          fail(`${rulePath}.${key}`, "must be a finite number");
        }
        if (source.valueType === "date" && (typeof bound !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(bound))) {
          fail(`${rulePath}.${key}`, "must be an ISO date (YYYY-MM-DD)");
        }
        if (key === "min") result.min = bound as number | string;
        else result.max = bound as number | string;
      }
      return result;
    }
    return fail(`${rulePath}.kind`, `unsupported rule ${JSON.stringify(source.kind)}`);
  });
}
