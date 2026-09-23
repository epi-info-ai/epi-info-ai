import type { RecordValue, FormSchema } from "../contracts/core.js";
import type {
  CheckCodeBlock,
  CheckCodeDefinition,
  CheckCodeCondition,
  CheckCodeEvent,
  CheckCodeDialogRequest,
  CheckCodeDialogDataSource,
  CheckCodeAutoSearchRequest,
  CheckCodeExpression,
  CheckCodeProgramAst,
  CheckCodeScope,
  CheckCodeStatement,
} from "./check-code-program.js";

export const CHECK_CODE_RUNTIME_VERSION = "epi-check-code-runtime/0.1" as const;
export const CHECK_CODE_MAX_EFFECTS_PER_EVENT = 256;
export const CHECK_CODE_MAX_NAVIGATIONS_PER_EVENT = 16;
export const CHECK_CODE_MAX_DIALOG_CHOICES = 250;

export interface CheckCodeRuntimeAudit {
  runtime: typeof CHECK_CODE_RUNTIME_VERSION;
  scope: CheckCodeScope;
  event: CheckCodeEvent;
  name?: string;
  statements: number;
  effects: number;
  navigationEffects: number;
  status: "succeeded" | "cancelled" | "failed";
  diagnostic?: string;
}

export interface CheckCodeRuntimeHost {
  readField(name: string): RecordValue;
  writeField(name: string, value: RecordValue): void;
  applyFieldAction(action: "enable" | "disable" | "hide" | "unhide" | "highlight" | "unhighlight" | "set-required" | "set-not-required", name: string): void;
  gotoField(name: string): void | Promise<void>;
  gotoPage(target: string): void | Promise<void>;
  gotoForm(target: string): void | Promise<void>;
  beep(): void | Promise<void>;
  requestRecordAction(action: "save" | "new" | "quit"): void | Promise<void>;
  autoSearch(request: CheckCodeAutoSearchRequest, signal?: AbortSignal): void | Promise<void>;
  showDialog(request: CheckCodeDialogRequest, signal?: AbortSignal): Promise<{ accepted: boolean; value?: RecordValue }>;
  resolveDialogChoices(source: CheckCodeDialogDataSource, signal?: AbortSignal): Promise<readonly string[]>;
  runGeocode(addressField: string, latitudeField: string, longitudeField: string): Promise<void>;
  /** GLOBAL is host-session state; PERMANENT is host-profile state. Values never enter project exports implicitly. */
  readScopedVariable?(definition: CheckCodeDefinition): RecordValue | undefined;
  writeScopedVariable?(definition: CheckCodeDefinition, value: RecordValue | undefined): void;
  audit(event: CheckCodeRuntimeAudit): void;
}

export interface CheckCodeRuntime {
  run(scope: CheckCodeScope, event: CheckCodeEvent, name?: string, signal?: AbortSignal): Promise<CheckCodeRuntimeAudit>;
  resetStandardVariables(): void;
  variable(name: string): RecordValue | undefined;
}

function key(name: string): string { return name.toLocaleLowerCase("en-US"); }

function coerceDefinition(definition: CheckCodeDefinition, value: RecordValue): RecordValue {
  if (value === null || value === "") return null;
  if (definition.valueType === "numeric") {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) throw new RangeError(`${definition.name} requires a finite numeric value.`);
    return numeric;
  }
  if (definition.valueType === "yn") {
    if (typeof value === "boolean") return value;
    if (/^(?:yes|true|1)$/i.test(String(value))) return true;
    if (/^(?:no|false|0)$/i.test(String(value))) return false;
    throw new RangeError(`${definition.name} requires Yes/No, True/False, or 1/0.`);
  }
  return String(value);
}

function countStatements(statements: readonly CheckCodeStatement[]): number {
  return statements.reduce((total, statement) => total + 1
    + (statement.kind === "if" ? countStatements(statement.then) + countStatements(statement.otherwise)
      : statement.kind === "always" ? countStatements(statement.statements) : 0), 0);
}

export function createCheckCodeRuntime(ast: CheckCodeProgramAst, schema: FormSchema, host: CheckCodeRuntimeHost): CheckCodeRuntime {
  const fields = new Map(schema.fields.map((field) => [key(field.name), field.name]));
  const fieldTypes = new Map(schema.fields.map((field) => [key(field.name), field.type]));
  const definitions = new Map(ast.definitions.map((definition) => [key(definition.name), definition]));
  const variables = new Map<string, RecordValue>(ast.definitions.map((definition) => {
    const stored = definition.scope === "standard" ? undefined : host.readScopedVariable?.(definition);
    return [key(definition.name), stored === undefined ? null : coerceDefinition(definition, stored)];
  }));
  const undefinedVariables = new Set<string>();
  const subroutines = new Map(ast.subroutines.map((subroutine) => [key(subroutine.name), subroutine.statements]));
  const blocks = new Map<string, CheckCodeBlock>();
  for (const block of ast.blocks) blocks.set(`${block.scope}:${key(block.name ?? "")}`, block);

  const readReference = (name: string): RecordValue => {
    const field = fields.get(key(name));
    if (field) return host.readField(field);
    if (definitions.has(key(name))) {
      if (undefinedVariables.has(key(name))) throw new RangeError(`Check Code variable ${JSON.stringify(name)} was undefined in this session.`);
      return variables.get(key(name)) ?? null;
    }
    throw new RangeError(`Check Code reference ${JSON.stringify(name)} is unavailable.`);
  };
  const write = (name: string, value: RecordValue): void => {
    const field = fields.get(key(name));
    if (field) {
      host.writeField(field, value);
      return;
    }
    const definition = definitions.get(key(name));
    if (!definition) throw new RangeError(`Check Code target ${JSON.stringify(name)} is unavailable.`);
    if (undefinedVariables.has(key(name))) throw new RangeError(`Check Code variable ${JSON.stringify(name)} was undefined in this session.`);
    const coerced = coerceDefinition(definition, value);
    variables.set(key(name), coerced);
    if (definition.scope !== "standard") host.writeScopedVariable?.(definition, coerced);
  };
  const clear = (name: string): void => {
    if (name === "*") {
      for (const field of fields.values()) host.writeField(field, null);
      for (const definition of ast.definitions) {
        variables.set(key(definition.name), null);
        if (definition.scope !== "standard") host.writeScopedVariable?.(definition, null);
      }
      return;
    }
    write(name, null);
  };
  type RuntimeFamily = "text" | "text-literal" | "number" | "boolean" | "date" | "time" | "date-time" | "null";
  const expressionFamily = (value: CheckCodeExpression): RuntimeFamily => {
    if (value.kind === "literal") {
      if (value.value === null) return "null";
      if (typeof value.value === "number") return "number";
      if (typeof value.value === "boolean") return "boolean";
      return "text-literal";
    }
    if (value.kind === "reference") {
      const name = key(value.value);
      const declared = definitions.get(name)?.valueType ?? fieldTypes.get(name);
      if (["numeric", "number"].includes(declared ?? "")) return "number";
      if (["yn", "yes-no", "checkbox"].includes(declared ?? "")) return "boolean";
      if (["dateformat", "date"].includes(declared ?? "")) return "date";
      if (["timeformat", "time"].includes(declared ?? "")) return "time";
      if (declared === "datetimeformat") return "date-time";
      return "text";
    }
    if (value.kind === "unary") return expressionFamily(value.operand) === "null" ? "null" : "number";
    if (value.kind === "binary") return value.operator === "concatenate" ? "text" : expressionFamily(value.left) === "null" || expressionFamily(value.right) === "null" ? "null" : "number";
    return ["SUBSTRING", "UPPERCASE"].includes(value.name) ? "text" : "number";
  };
  const finiteNumber = (value: RecordValue, context: string): number => {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) throw new RangeError(`${context} expected a finite number, received ${JSON.stringify(value)}.`);
    return numeric;
  };
  const dateParts = (value: RecordValue, context: string): [number, number, number] => {
    const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    if (!match) throw new RangeError(`${context} requires an ISO date in YYYY-MM-DD form.`);
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const test = new Date(Date.UTC(year, month - 1, day));
    if (test.getUTCFullYear() !== year || test.getUTCMonth() + 1 !== month || test.getUTCDate() !== day) throw new RangeError(`${context} received an invalid calendar date.`);
    return [year, month, day];
  };
  const roundAwayFromZero = (value: number, places: number): number => {
    if (!Number.isInteger(places) || places < 0 || places > 15) throw new RangeError("ROUND decimal places must be an integer from 0 through 15.");
    const factor = 10 ** places;
    const scaled = value * factor;
    const rounded = Math.sign(scaled) * Math.floor(Math.abs(scaled) + 0.5);
    const result = rounded / factor;
    if (!Number.isFinite(result)) throw new RangeError("ROUND produced a non-finite result.");
    return result;
  };
  const evaluateExpression = (value: CheckCodeExpression): RecordValue => {
    if (value.kind === "literal") return value.value;
    if (value.kind === "reference") return readReference(value.value);
    if (value.kind === "unary") {
      const operand = evaluateExpression(value.operand);
      if (operand === null) return null;
      const numeric = finiteNumber(operand, `Unary ${value.operator}`);
      return value.operator === "negative" ? -numeric : numeric;
    }
    if (value.kind === "binary") {
      const left = evaluateExpression(value.left);
      const right = evaluateExpression(value.right);
      if (value.operator === "concatenate") return `${left ?? ""}${right ?? ""}`;
      if (left === null || right === null) return null;
      const leftNumber = finiteNumber(left, value.operator);
      const rightNumber = finiteNumber(right, value.operator);
      if ((value.operator === "divide" || value.operator === "modulo") && rightNumber === 0) throw new RangeError(`${value.operator} by zero is not allowed.`);
      const result = value.operator === "add" ? leftNumber + rightNumber
        : value.operator === "subtract" ? leftNumber - rightNumber
        : value.operator === "multiply" ? leftNumber * rightNumber
        : value.operator === "divide" ? leftNumber / rightNumber
        : value.operator === "modulo" ? leftNumber % rightNumber
        : leftNumber ** rightNumber;
      if (!Number.isFinite(result)) throw new RangeError(`${value.operator} produced a non-finite result.`);
      return result;
    }
    const args = value.arguments.map(evaluateExpression);
    if (args.some((argument) => argument === null)) return null;
    if (value.name === "ABS") return Math.abs(finiteNumber(args[0]!, "ABS"));
    if (value.name === "ROUND") return roundAwayFromZero(finiteNumber(args[0]!, "ROUND"), args.length === 2 ? finiteNumber(args[1]!, "ROUND") : 0);
    if (value.name === "STRLEN") return String(args[0]).length;
    if (value.name === "UPPERCASE") return String(args[0]).toUpperCase();
    if (value.name === "TXTTONUM") {
      if (typeof args[0] === "boolean") return args[0] ? 1 : 0;
      return finiteNumber(args[0]!, "TXTTONUM");
    }
    if (value.name === "SUBSTRING") {
      const source = String(args[0]);
      const start = finiteNumber(args[1]!, "SUBSTRING");
      const length = args.length === 3 ? finiteNumber(args[2]!, "SUBSTRING") : source.length;
      if (!Number.isInteger(start) || start < 1 || !Number.isInteger(length) || length < 0) throw new RangeError("SUBSTRING uses a 1-based positive start and a non-negative integer length.");
      return start > source.length ? "" : source.slice(start - 1, start - 1 + length);
    }
    const [year, month, day] = dateParts(args[0]!, value.name);
    return value.name === "YEAR" ? year : value.name === "MONTH" ? month : day;
  };
  const comparableValue = (value: RecordValue, family: RuntimeFamily): string | number | boolean | null => {
    if (value === null) return null;
    if (family === "number") {
      const numeric = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(numeric)) throw new RangeError(`IF expected a numeric value, received ${JSON.stringify(value)}.`);
      return numeric;
    }
    if (family === "boolean") {
      if (typeof value === "boolean") return value;
      if (/^(?:true|yes|1|\+)$/i.test(String(value))) return true;
      if (/^(?:false|no|0|-)$/i.test(String(value))) return false;
      throw new RangeError(`IF expected a Yes/No value, received ${JSON.stringify(value)}.`);
    }
    if (family === "date" || family === "date-time") {
      const timestamp = Date.parse(String(value));
      if (!Number.isFinite(timestamp)) throw new RangeError(`IF expected a ${family} value, received ${JSON.stringify(value)}.`);
      return timestamp;
    }
    if (family === "time") {
      const match = String(value).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
      if (!match) throw new RangeError(`IF expected a time value, received ${JSON.stringify(value)}.`);
      return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0);
    }
    return String(value).toLocaleLowerCase("en-US");
  };
  const evaluateCondition = (condition: CheckCodeCondition): boolean => {
    if (condition.kind === "logical") return condition.operator === "and"
      ? evaluateCondition(condition.left) && evaluateCondition(condition.right)
      : evaluateCondition(condition.left) || evaluateCondition(condition.right);
    if (condition.kind === "not") return !evaluateCondition(condition.condition);
    if (condition.kind === "truthy") return comparableValue(evaluateExpression(condition.operand), expressionFamily(condition.operand)) === true;
    const leftRaw = evaluateExpression(condition.left);
    const rightRaw = evaluateExpression(condition.right);
    if (leftRaw === null || rightRaw === null) {
      const equal = leftRaw === rightRaw;
      return condition.operator === "equals" ? equal : condition.operator === "not-equals" ? !equal : false;
    }
    const comparesEmptyText = condition.operator === "equals" || condition.operator === "not-equals"
      ? (condition.left.kind === "literal" && condition.left.value === "")
        || (condition.right.kind === "literal" && condition.right.value === "")
      : false;
    if (comparesEmptyText) {
      const equal = leftRaw === "" && rightRaw === "";
      return condition.operator === "equals" ? equal : !equal;
    }
    const leftDeclared = expressionFamily(condition.left);
    const rightDeclared = expressionFamily(condition.right);
    const family = leftDeclared === "text-literal" && rightDeclared !== "text-literal" ? rightDeclared
      : rightDeclared === "text-literal" && leftDeclared !== "text-literal" ? leftDeclared : leftDeclared;
    const left = comparableValue(leftRaw, family);
    const right = comparableValue(rightRaw, family);
    const order = left === right ? 0 : (left as string | number) < (right as string | number) ? -1 : 1;
    if (condition.operator === "equals") return order === 0;
    if (condition.operator === "not-equals") return order !== 0;
    if (condition.operator === "less-than") return order < 0;
    if (condition.operator === "less-than-or-equal") return order <= 0;
    if (condition.operator === "greater-than") return order > 0;
    return order >= 0;
  };

  return {
    async run(scope, event, name, signal) {
      const block = blocks.get(`${scope}:${key(name ?? "")}`);
      const statements = block?.events[event] ?? [];
      let effects = 0;
      let navigationEffects = 0;
      const guard = (): void => {
        if (signal?.aborted) throw new DOMException("Check Code execution was cancelled.", "AbortError");
        effects += 1;
        if (effects > CHECK_CODE_MAX_EFFECTS_PER_EVENT) throw new RangeError(`Check Code exceeded ${CHECK_CODE_MAX_EFFECTS_PER_EVENT} effects in one event.`);
      };
      const execute = async (items: readonly CheckCodeStatement[], callDepth = 0): Promise<boolean> => {
        for (const statement of items) {
          guard();
          if (statement.kind === "if") {
            if (await execute(evaluateCondition(statement.condition) ? statement.then : statement.otherwise)) return true;
          } else if (statement.kind === "assign") write(statement.target, evaluateExpression(statement.value));
          else if (statement.kind === "clear") statement.targets.forEach(clear);
          else if (statement.kind === "undefine") {
            const targets = statement.target === "*"
              ? ast.definitions.filter((definition) => statement.scope === "global" ? definition.scope === "global" : definition.scope === "standard")
              : [definitions.get(key(statement.target))!];
            for (const definition of targets) {
              undefinedVariables.add(key(definition.name));
              variables.delete(key(definition.name));
              if (definition.scope !== "standard") host.writeScopedVariable?.(definition, undefined);
            }
          }
          else if (statement.kind === "beep") await host.beep();
          else if (statement.kind === "record-action") {
            await host.requestRecordAction(statement.action);
            return true;
          }
          else if (statement.kind === "autosearch") await host.autoSearch(statement, signal);
          else if (statement.kind === "iocode") throw new Error("IOCODE cannot execute without the governed Occupational Epidemiology package and its approved NIOSH-compatible browser coder.");
          else if (statement.kind === "call") {
            if (callDepth >= 8) throw new RangeError("Check Code CALL depth exceeds the browser limit of 8.");
            if (await execute(subroutines.get(key(statement.target))!, callDepth + 1)) return true;
          }
          else if (statement.kind === "always") {
            if (await execute(statement.statements, callDepth)) return true;
          }
          else if (statement.kind === "field-action") {
            const excluded = new Set((statement.except ?? []).map(key));
            const targets = (statement.targets.includes("*") ? [...fields.values()] : statement.targets.map((target) => fields.get(key(target))!))
              .filter((target) => !excluded.has(key(target)));
            for (const target of targets) host.applyFieldAction(statement.action, target);
          } else if (statement.kind === "goto") {
            navigationEffects += 1;
            if (navigationEffects > CHECK_CODE_MAX_NAVIGATIONS_PER_EVENT) throw new RangeError(`Check Code exceeded ${CHECK_CODE_MAX_NAVIGATIONS_PER_EVENT} navigation effects in one event.`);
            if (statement.targetType === "form") {
              await host.gotoForm(statement.target);
              return true;
            }
            if (statement.targetType === "page") await host.gotoPage(statement.target);
            else await host.gotoField(fields.get(key(statement.target))!);
          } else if (statement.kind === "dialog") {
            const choices = statement.dataSource ? [...await host.resolveDialogChoices(statement.dataSource, signal)] : statement.choices;
            if (choices && choices.length > CHECK_CODE_MAX_DIALOG_CHOICES) {
              throw new RangeError(`Check Code DIALOG exceeds the ${CHECK_CODE_MAX_DIALOG_CHOICES}-choice browser limit.`);
            }
            const response = await host.showDialog({ ...statement, ...(choices ? { choices: [...choices] } : {}) }, signal);
            if (response.accepted && statement.target) write(statement.target, response.value ?? null);
          }
          else if (statement.kind === "geocode") await host.runGeocode(
            fields.get(key(statement.addressField))!, fields.get(key(statement.latitudeField))!, fields.get(key(statement.longitudeField))!,
          );
        }
        return false;
      };
      let status: CheckCodeRuntimeAudit["status"] = "succeeded";
      let diagnostic: string | undefined;
      try {
        await execute(statements);
      } catch (error) {
        status = error instanceof DOMException && error.name === "AbortError" ? "cancelled" : "failed";
        diagnostic = error instanceof Error ? error.message : "Check Code execution failed.";
      }
      const audit: CheckCodeRuntimeAudit = {
        runtime: CHECK_CODE_RUNTIME_VERSION, scope, event, ...(name ? { name } : {}),
        statements: countStatements(statements), effects, navigationEffects, status, ...(diagnostic ? { diagnostic } : {}),
      };
      host.audit(audit);
      if (status === "failed") throw new Error(diagnostic);
      if (status === "cancelled") throw new DOMException(diagnostic, "AbortError");
      return audit;
    },
    resetStandardVariables() {
      for (const definition of ast.definitions) if (definition.scope === "standard") {
        variables.set(key(definition.name), null);
        undefinedVariables.delete(key(definition.name));
      }
    },
    variable(name) { return undefinedVariables.has(key(name)) ? undefined : variables.get(key(name)); },
  };
}
