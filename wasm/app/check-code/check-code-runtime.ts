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
import { formatCheckCodeValue } from "./check-code-format.ts";
import type { CheckCodeRandomDraw } from "./check-code-random.js";
import { normalPercentileFromZ } from "./check-code-normal.ts";
import type { CheckCodeIdentityReading, CheckCodeIdentitySource } from "./check-code-identity.ts";
import type { CheckCodePositionReading } from "./check-code-device-context.ts";
import { anthropometricZScore } from "./check-code-zscore.ts";
import type { CheckCodeZScoreResult } from "./check-code-zscore.ts";

export const CHECK_CODE_RUNTIME_VERSION = "epi-check-code-runtime/0.1" as const;
export const CHECK_CODE_MAX_EFFECTS_PER_EVENT = 256;
export const CHECK_CODE_MAX_NAVIGATIONS_PER_EVENT = 16;
export const CHECK_CODE_MAX_DIALOG_CHOICES = 250;

export interface CheckCodeClockReading {
  /** UTC RFC 3339 instant, normally produced by Date.prototype.toISOString(). */
  instant: string;
  /** IANA time-zone identifier used to derive the project-local calendar values. */
  timeZone: string;
}

export interface CheckCodeClockAudit extends CheckCodeClockReading {
  function: "SYSTEMDATE" | "SYSTEMTIME";
}

export interface CheckCodeRandomAudit extends CheckCodeRandomDraw {
  minimumInclusive: number;
  maximumExclusive: number;
}

export interface CheckCodeIdentityAudit {
  function: "CURRENTUSER";
  source: CheckCodeIdentitySource | "unavailable";
  available: boolean;
}

export interface CheckCodeDeviceAudit {
  function: "SYSALTITUDE" | "SYSLATITUDE" | "SYSLONGITUDE";
  available: boolean;
  source: "browser-geolocation" | "unavailable";
  acquiredAt?: string;
  accuracy?: number;
  altitudeAccuracy?: number | null;
}

export interface CheckCodeScientificAudit {
  function: "ZSCORE";
  available: boolean;
  reference: CheckCodeZScoreResult["reference"];
  metric: string | null;
  referenceVersion: CheckCodeZScoreResult["referenceVersion"];
}

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
  clockReadings?: readonly CheckCodeClockAudit[];
  randomDraws?: readonly CheckCodeRandomAudit[];
  identityReadings?: readonly CheckCodeIdentityAudit[];
  deviceReadings?: readonly CheckCodeDeviceAudit[];
  scientificReadings?: readonly CheckCodeScientificAudit[];
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
  recordCount?(): number;
  isUnique?(fieldNames: readonly string[]): boolean;
  readSystemClock?(): CheckCodeClockReading;
  randomInteger?(minimumInclusive: number, maximumExclusive: number): CheckCodeRandomDraw;
  /** Explicit application identity only. Implementations must not infer an OS account from browser metadata. */
  readCurrentUser?(): CheckCodeIdentityReading;
  /** Returns only a previously and explicitly acquired position; scalar functions never prompt for permission. */
  readLastPosition?(): CheckCodePositionReading | null;
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
  let activeClockReadings: CheckCodeClockAudit[] | null = null;
  let activeRandomDraws: CheckCodeRandomAudit[] | null = null;
  let activeIdentityReadings: CheckCodeIdentityAudit[] | null = null;
  let activeDeviceReadings: CheckCodeDeviceAudit[] | null = null;
  let activeScientificReadings: CheckCodeScientificAudit[] | null = null;
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
    if (["TXTTODATE", "NUMTODATE", "SYSTEMDATE"].includes(value.name)) return "date";
    if (["NUMTOTIME", "SYSTEMTIME"].includes(value.name)) return "time";
    if (value.name === "ISUNIQUE") return "boolean";
    return ["SUBSTRING", "UPPERCASE", "FORMAT", "LINEBREAK", "CURRENTUSER"].includes(value.name) ? "text" : "number";
  };
  const finiteNumber = (value: RecordValue, context: string): number => {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric)) throw new RangeError(`${context} expected a finite number, received ${JSON.stringify(value)}.`);
    return numeric;
  };
  const finiteResult = (value: number, context: string): number => {
    if (!Number.isFinite(value)) throw new RangeError(`${context} produced a non-finite result.`);
    return value;
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
  const timeParts = (value: RecordValue, context: string): [number, number, number] => {
    const match = String(value ?? "").match(/^(?:\d{4}-\d{2}-\d{2}T)?(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) throw new RangeError(`${context} requires an ISO time in HH:MM or HH:MM:SS form.`);
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const second = Number(match[3] ?? 0);
    if (hour > 23 || minute > 59 || second > 59) throw new RangeError(`${context} received an invalid clock time.`);
    return [hour, minute, second];
  };
  const integerPart = (value: RecordValue, context: string): number => {
    const numeric = finiteNumber(value, context);
    if (!Number.isInteger(numeric)) throw new RangeError(`${context} requires integer date/time parts.`);
    return numeric;
  };
  const isoDate = (yearValue: RecordValue, monthValue: RecordValue, dayValue: RecordValue, context: string): string => {
    let year = integerPart(yearValue, context);
    const month = integerPart(monthValue, context);
    const day = integerPart(dayValue, context);
    if (year >= 0 && year <= 29) year += 2000;
    else if (year >= 30 && year <= 99) year += 1900;
    if (year < 1 || year > 9999) throw new RangeError(`${context} year must resolve from 1 through 9999.`);
    const test = new Date(Date.UTC(year, month - 1, day));
    if (test.getUTCFullYear() !== year || test.getUTCMonth() + 1 !== month || test.getUTCDate() !== day) throw new RangeError(`${context} received invalid calendar parts.`);
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  const isoTimestamp = (value: RecordValue, context: string): { timestamp: number; year: number; month: number; day: number } => {
    const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!match) throw new RangeError(`${context} requires an ISO date or local date-time without a time-zone suffix.`);
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = Number(match[4] ?? 0);
    const minute = Number(match[5] ?? 0);
    const second = Number(match[6] ?? 0);
    const timestamp = Date.UTC(year, month - 1, day, hour, minute, second);
    const test = new Date(timestamp);
    if (year < 100 || test.getUTCFullYear() !== year || test.getUTCMonth() + 1 !== month || test.getUTCDate() !== day
      || test.getUTCHours() !== hour || test.getUTCMinutes() !== minute || test.getUTCSeconds() !== second) {
      throw new RangeError(`${context} received an invalid ISO date-time.`);
    }
    return { timestamp, year, month, day };
  };
  const completedLegacyYears = (wholeDays: number): number => {
    const daysBeforeYear = (year: number): number => {
      const prior = year - 1;
      return 365 * prior + Math.floor(prior / 4) - Math.floor(prior / 100) + Math.floor(prior / 400);
    };
    let low = 0;
    let high = 9998;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (daysBeforeYear(middle + 1) <= wholeDays) low = middle;
      else high = middle - 1;
    }
    return low;
  };
  const epidemiologicYearStart = (year: number, firstDayOfWeek: number): number => {
    const januaryFirst = Date.UTC(year, 0, 1);
    const firstDayOfYear = new Date(januaryFirst).getUTCDay();
    const offset = firstDayOfYear <= firstDayOfWeek + 3
      ? firstDayOfWeek - firstDayOfYear
      : 7 - firstDayOfWeek - firstDayOfYear;
    return januaryFirst + offset * 86_400_000;
  };
  const epidemiologicWeek = (dateValue: RecordValue, firstDayValue?: RecordValue): number => {
    const date = isoTimestamp(dateValue, "EPIWEEK");
    const firstDay = firstDayValue === undefined ? 1 : integerPart(firstDayValue, "EPIWEEK first-day argument");
    if (firstDay < 1 || firstDay > 7) throw new RangeError("EPIWEEK first-day argument must be an integer from 1 through 7.");
    const firstDayOfWeek = firstDay - 1;
    const previousStart = epidemiologicYearStart(date.year - 1, firstDayOfWeek);
    const currentStart = epidemiologicYearStart(date.year, firstDayOfWeek);
    const nextStart = epidemiologicYearStart(date.year + 1, firstDayOfWeek);
    const start = date.timestamp < currentStart ? previousStart : date.timestamp >= nextStart ? nextStart : currentStart;
    return Math.floor((date.timestamp - start) / 86_400_000 / 7) + 1;
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
  const systemClockValue = (functionName: "SYSTEMDATE" | "SYSTEMTIME"): string => {
    if (!host.readSystemClock) throw new Error(`${functionName} requires an explicit project clock from the Check Code host.`);
    const reading = host.readSystemClock();
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(reading.instant)) {
      throw new RangeError(`${functionName} clock instant must be a UTC RFC 3339 value.`);
    }
    if (!reading.timeZone || reading.timeZone.length > 64) throw new RangeError(`${functionName} requires a bounded IANA time-zone identifier.`);
    const instant = new Date(reading.instant);
    if (Number.isNaN(instant.valueOf())) throw new RangeError(`${functionName} clock instant is invalid.`);
    let parts: Intl.DateTimeFormatPart[];
    try {
      parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: reading.timeZone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
      }).formatToParts(instant);
    } catch {
      throw new RangeError(`${functionName} clock time zone ${JSON.stringify(reading.timeZone)} is unavailable.`);
    }
    const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((candidate) => candidate.type === type)?.value ?? "";
    const date = `${part("year")}-${part("month")}-${part("day")}`;
    const time = `${part("hour")}:${part("minute")}:${part("second")}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}:\d{2}$/.test(time)) throw new RangeError(`${functionName} could not derive a project-local value.`);
    activeClockReadings?.push({ function: functionName, instant: instant.toISOString(), timeZone: reading.timeZone });
    return functionName === "SYSTEMDATE" ? date : time;
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
    if (value.name === "RECORDCOUNT") {
      if (!host.recordCount) throw new Error("RECORDCOUNT requires active-form record context from the Check Code host.");
      const count = host.recordCount();
      if (!Number.isSafeInteger(count) || count < 0) throw new RangeError("RECORDCOUNT host returned an invalid active-record count.");
      return count;
    }
    if (value.name === "ISUNIQUE") {
      if (!host.isUnique) throw new Error("ISUNIQUE requires active-form record context from the Check Code host.");
      const fieldNames = value.arguments.map((argument) => {
        if (argument.kind !== "reference" || !fields.has(key(argument.value))) throw new Error("ISUNIQUE accepts active-form field references only.");
        return fields.get(key(argument.value))!;
      });
      return host.isUnique(fieldNames);
    }
    if (value.name === "SYSTEMDATE" || value.name === "SYSTEMTIME") return systemClockValue(value.name);
    if (value.name === "CURRENTUSER") {
      const reading = host.readCurrentUser?.() ?? { identity: null, source: "unavailable" as const };
      const identity = reading.identity?.trim() || null;
      if (identity && identity.length > 100) throw new RangeError("CURRENTUSER host returned an identity longer than 100 characters.");
      if (!(["authenticated-account", "local-profile", "unavailable"] as const).includes(reading.source)) {
        throw new RangeError("CURRENTUSER host returned an invalid identity source.");
      }
      if ((identity === null) !== (reading.source === "unavailable")) {
        throw new RangeError("CURRENTUSER host returned inconsistent identity availability.");
      }
      activeIdentityReadings?.push({ function: "CURRENTUSER", source: reading.source, available: identity !== null });
      return identity;
    }
    if (value.name === "SYSALTITUDE" || value.name === "SYSLATITUDE" || value.name === "SYSLONGITUDE") {
      const reading = host.readLastPosition?.() ?? null;
      const result = reading === null ? null
        : value.name === "SYSALTITUDE" ? reading.altitude
          : value.name === "SYSLATITUDE" ? reading.latitude : reading.longitude;
      activeDeviceReadings?.push({
        function: value.name,
        available: result !== null,
        source: reading?.source ?? "unavailable",
        ...(reading ? { acquiredAt: reading.acquiredAt, accuracy: reading.accuracy, altitudeAccuracy: reading.altitudeAccuracy } : {}),
      });
      return result;
    }
    const args = value.arguments.map(evaluateExpression);
    if (args.some((argument) => argument === null)) return null;
    if (value.name === "RND") {
      if (!host.randomInteger) throw new Error("RND requires an explicit seeded random generator from the Check Code host.");
      const bounds = args.map((argument) => finiteNumber(argument, "RND"));
      if (bounds.some((bound) => !Number.isInteger(bound))) throw new RangeError("RND bounds must be integers.");
      const minimumInclusive = bounds.length === 1 ? 0 : bounds[0]!;
      const maximumExclusive = bounds.length === 1 ? bounds[0]! : bounds[1]!;
      if (bounds.length === 1 && maximumExclusive < 0) throw new RangeError("RND(max) requires a non-negative max.");
      if (maximumExclusive < minimumInclusive) throw new RangeError("RND upper bound must be greater than or equal to its lower bound.");
      const result = host.randomInteger(minimumInclusive, maximumExclusive);
      const valueOutsideBounds = maximumExclusive === minimumInclusive
        ? result.value !== minimumInclusive
        : result.value < minimumInclusive || result.value >= maximumExclusive;
      if (!Number.isSafeInteger(result.value) || valueOutsideBounds
        || !result.generator || result.generator.length > 64 || !Number.isSafeInteger(result.seed) || result.seed < 0 || result.seed > 0xffff_ffff
        || !Number.isSafeInteger(result.draw) || result.draw < 1) {
        throw new RangeError("RND host returned an invalid or out-of-range seeded draw.");
      }
      activeRandomDraws?.push({ ...result, minimumInclusive, maximumExclusive });
      return result.value;
    }
    if (value.name === "ABS") return Math.abs(finiteNumber(args[0]!, "ABS"));
    if (value.name === "COS") return finiteResult(Math.cos(finiteNumber(args[0]!, "COS")), "COS");
    if (value.name === "EXP") return finiteResult(Math.exp(finiteNumber(args[0]!, "EXP")), "EXP");
    if (value.name === "FINDTEXT") return String(args[1]).toLocaleLowerCase().indexOf(String(args[0]).toLocaleLowerCase()) + 1;
    if (value.name === "LN") return finiteResult(Math.log(finiteNumber(args[0]!, "LN")), "LN");
    if (value.name === "LOG") return finiteResult(Math.log10(finiteNumber(args[0]!, "LOG")), "LOG");
    if (value.name === "PFROMZ") return normalPercentileFromZ(finiteNumber(args[0]!, "PFROMZ"));
    if (value.name === "ZSCORE") {
      const result = anthropometricZScore(
        String(args[0]), String(args[1]), finiteNumber(args[2]!, "ZSCORE"),
        finiteNumber(args[3]!, "ZSCORE"), finiteNumber(args[4]!, "ZSCORE"),
      );
      activeScientificReadings?.push({
        function: "ZSCORE", available: result.value !== null, reference: result.reference,
        metric: result.metric, referenceVersion: result.referenceVersion,
      });
      return result.value;
    }
    if (value.name === "ROUND") return roundAwayFromZero(finiteNumber(args[0]!, "ROUND"), args.length === 2 ? finiteNumber(args[1]!, "ROUND") : 0);
    if (value.name === "SIN") return finiteResult(Math.sin(finiteNumber(args[0]!, "SIN")), "SIN");
    if (value.name === "SQRT") return finiteResult(Math.sqrt(finiteNumber(args[0]!, "SQRT")), "SQRT");
    if (value.name === "STEP") return finiteNumber(args[0]!, "STEP") < finiteNumber(args[1]!, "STEP") ? 0 : 1;
    if (value.name === "TAN") return finiteResult(Math.tan(finiteNumber(args[0]!, "TAN")), "TAN");
    if (value.name === "TRUNC") return Math.trunc(finiteNumber(args[0]!, "TRUNC"));
    if (value.name === "TXTTODATE") {
      const [year, month, day] = dateParts(args[0]!, "TXTTODATE");
      return isoDate(year, month, day, "TXTTODATE");
    }
    if (value.name === "NUMTODATE") return isoDate(args[0]!, args[1]!, args[2]!, "NUMTODATE");
    if (value.name === "NUMTOTIME") {
      const hour = integerPart(args[0]!, "NUMTOTIME");
      const minute = integerPart(args[1]!, "NUMTOTIME");
      const second = integerPart(args[2]!, "NUMTOTIME");
      if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) throw new RangeError("NUMTOTIME requires hour 0-23 and minute/second 0-59.");
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
    }
    if (["HOUR", "MINUTE", "SECOND"].includes(value.name)) {
      const [hour, minute, second] = timeParts(args[0]!, value.name);
      return value.name === "HOUR" ? hour : value.name === "MINUTE" ? minute : second;
    }
    if (["DAYS", "HOURS", "MINUTES", "SECONDS", "MONTHS", "YEARS"].includes(value.name)) {
      const start = isoTimestamp(args[0]!, value.name);
      const end = isoTimestamp(args[1]!, value.name);
      const deltaMilliseconds = end.timestamp - start.timestamp;
      if (value.name === "DAYS") return Math.trunc(deltaMilliseconds / 86_400_000);
      if (value.name === "HOURS") return Math.trunc(deltaMilliseconds / 3_600_000) % 24;
      if (value.name === "MINUTES") return deltaMilliseconds / 60_000;
      if (value.name === "SECONDS") return deltaMilliseconds / 1_000;
      if (value.name === "MONTHS") {
        let result = 12 * (end.year - start.year) + end.month - start.month;
        if (start.timestamp > end.timestamp) {
          if (start.day < end.day) result += 1;
        } else if (end.day < start.day) result -= 1;
        return result;
      }
      const sign = Math.sign(deltaMilliseconds);
      return sign * completedLegacyYears(Math.trunc(Math.abs(deltaMilliseconds) / 86_400_000));
    }
    if (value.name === "EPIWEEK") return epidemiologicWeek(args[0]!, args[1]);
    if (value.name === "FORMAT") return formatCheckCodeValue(args[0]!, args[1]);
    if (value.name === "LINEBREAK") return "\n";
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
      activeClockReadings = [];
      activeRandomDraws = [];
      activeIdentityReadings = [];
      activeDeviceReadings = [];
      activeScientificReadings = [];
      try {
        await execute(statements);
      } catch (error) {
        status = error instanceof DOMException && error.name === "AbortError" ? "cancelled" : "failed";
        diagnostic = error instanceof Error ? error.message : "Check Code execution failed.";
      }
      const audit: CheckCodeRuntimeAudit = {
        runtime: CHECK_CODE_RUNTIME_VERSION, scope, event, ...(name ? { name } : {}),
        statements: countStatements(statements), effects, navigationEffects, status, ...(diagnostic ? { diagnostic } : {}),
        ...(activeClockReadings.length > 0 ? { clockReadings: [...activeClockReadings] } : {}),
        ...(activeRandomDraws.length > 0 ? { randomDraws: [...activeRandomDraws] } : {}),
        ...(activeIdentityReadings.length > 0 ? { identityReadings: [...activeIdentityReadings] } : {}),
        ...(activeDeviceReadings.length > 0 ? { deviceReadings: [...activeDeviceReadings] } : {}),
        ...(activeScientificReadings.length > 0 ? { scientificReadings: [...activeScientificReadings] } : {}),
      };
      activeClockReadings = null;
      activeRandomDraws = null;
      activeIdentityReadings = null;
      activeDeviceReadings = null;
      activeScientificReadings = null;
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
