import type { RecordValue, FormSchema } from "../contracts/core.js";
import type {
  CheckCodeBlock,
  CheckCodeDefinition,
  CheckCodeEvent,
  CheckCodeOperand,
  CheckCodeProgramAst,
  CheckCodeScope,
  CheckCodeStatement,
} from "./check-code-program.js";

export const CHECK_CODE_RUNTIME_VERSION = "epi-check-code-runtime/0.1" as const;
export const CHECK_CODE_MAX_EFFECTS_PER_EVENT = 256;
export const CHECK_CODE_MAX_NAVIGATIONS_PER_EVENT = 16;

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
  applyFieldAction(action: "enable" | "disable" | "hide" | "unhide" | "set-required" | "set-not-required", name: string): void;
  gotoField(name: string): void;
  showDialog(message: string, signal?: AbortSignal): Promise<void>;
  runGeocode(addressField: string, latitudeField: string, longitudeField: string): Promise<void>;
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
    + (statement.kind === "if" ? countStatements(statement.then) + countStatements(statement.otherwise) : 0), 0);
}

export function createCheckCodeRuntime(ast: CheckCodeProgramAst, schema: FormSchema, host: CheckCodeRuntimeHost): CheckCodeRuntime {
  const fields = new Map(schema.fields.map((field) => [key(field.name), field.name]));
  const definitions = new Map(ast.definitions.map((definition) => [key(definition.name), definition]));
  const variables = new Map<string, RecordValue>(ast.definitions.map((definition) => [key(definition.name), null]));
  const blocks = new Map<string, CheckCodeBlock>();
  for (const block of ast.blocks) blocks.set(`${block.scope}:${key(block.name ?? "")}`, block);

  const read = (operand: CheckCodeOperand): RecordValue => {
    if (operand.kind === "literal") return operand.value as RecordValue;
    const name = String(operand.value);
    const field = fields.get(key(name));
    if (field) return host.readField(field);
    if (definitions.has(key(name))) return variables.get(key(name)) ?? null;
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
    variables.set(key(name), coerceDefinition(definition, value));
  };
  const clear = (name: string): void => {
    if (name === "*") {
      for (const field of fields.values()) host.writeField(field, null);
      for (const definition of ast.definitions) variables.set(key(definition.name), null);
      return;
    }
    write(name, null);
  };
  const equal = (left: RecordValue, right: RecordValue): boolean => {
    if (left === null || right === null) return left === right;
    if (typeof left === "number" && typeof right === "number") return left === right;
    if (typeof left === "boolean" && typeof right === "boolean") return left === right;
    return String(left).toLocaleLowerCase("en-US") === String(right).toLocaleLowerCase("en-US");
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
      const execute = async (items: readonly CheckCodeStatement[]): Promise<void> => {
        for (const statement of items) {
          guard();
          if (statement.kind === "if") {
            const left = read({ kind: "reference", value: statement.condition.left });
            const matches = equal(left, read(statement.condition.right));
            await execute((statement.condition.operator === "equals") === matches ? statement.then : statement.otherwise);
          } else if (statement.kind === "assign") write(statement.target, read(statement.value));
          else if (statement.kind === "clear") statement.targets.forEach(clear);
          else if (statement.kind === "field-action") {
            const targets = statement.targets.includes("*") ? [...fields.values()] : statement.targets.map((target) => fields.get(key(target))!);
            for (const target of targets) host.applyFieldAction(statement.action, target);
          } else if (statement.kind === "goto") {
            navigationEffects += 1;
            if (navigationEffects > CHECK_CODE_MAX_NAVIGATIONS_PER_EVENT) throw new RangeError(`Check Code exceeded ${CHECK_CODE_MAX_NAVIGATIONS_PER_EVENT} navigation effects in one event.`);
            host.gotoField(fields.get(key(statement.target))!);
          } else if (statement.kind === "dialog") await host.showDialog(statement.message, signal);
          else if (statement.kind === "geocode") await host.runGeocode(
            fields.get(key(statement.addressField))!, fields.get(key(statement.latitudeField))!, fields.get(key(statement.longitudeField))!,
          );
        }
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
      for (const definition of ast.definitions) if (definition.scope === "standard") variables.set(key(definition.name), null);
    },
    variable(name) { return variables.get(key(name)); },
  };
}
