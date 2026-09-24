import type { RecordValue, FormSchema } from "../contracts/core.js";
import type { FieldCheckCode, SafeCheckCodeStatement, SafeFieldAction } from "../contracts/check-code.js";
import { checkCodeFormatName } from "./check-code-format.ts";

export const CHECK_CODE_AST_SCHEMA = "epi-check-code-ast/0.1" as const;

export type CheckCodeScope = "form" | "record" | "page" | "field";
export type CheckCodeEvent = "before" | "after" | "click";

export type CheckCodeFunctionName =
  | "ABS" | "COS" | "EXP" | "LN" | "LOG" | "ROUND" | "SIN" | "SQRT" | "TAN" | "TRUNC"
  | "FINDTEXT" | "STEP" | "STRLEN" | "SUBSTRING" | "UPPERCASE" | "TXTTONUM"
  | "TXTTODATE" | "NUMTODATE" | "NUMTOTIME" | "YEAR" | "MONTH" | "DAY" | "HOUR" | "MINUTE" | "SECOND"
  | "DAYS" | "HOURS" | "MINUTES" | "SECONDS" | "MONTHS" | "YEARS" | "EPIWEEK"
  | "FORMAT" | "LINEBREAK" | "RECORDCOUNT" | "ISUNIQUE" | "CURRENTUSER" | "SYSALTITUDE" | "SYSLATITUDE" | "SYSLONGITUDE" | "SYSTEMDATE" | "SYSTEMTIME" | "RND" | "PFROMZ" | "ZSCORE";

export type CheckCodeExpression =
  | { kind: "literal"; value: RecordValue }
  | { kind: "reference"; value: string }
  | { kind: "unary"; operator: "positive" | "negative"; operand: CheckCodeExpression }
  | { kind: "binary"; operator: "add" | "subtract" | "multiply" | "divide" | "modulo" | "power" | "concatenate"; left: CheckCodeExpression; right: CheckCodeExpression }
  | { kind: "function"; name: CheckCodeFunctionName; arguments: CheckCodeExpression[] };

/** Retained alias for callers compiled against the first typed Check Code slice. */
export type CheckCodeOperand = CheckCodeExpression;

export type CheckCodeComparisonOperator = "equals" | "not-equals" | "less-than" | "less-than-or-equal" | "greater-than" | "greater-than-or-equal";

export type CheckCodeCondition =
  | { kind: "comparison"; left: CheckCodeOperand; operator: CheckCodeComparisonOperator; right: CheckCodeOperand }
  | { kind: "logical"; operator: "and" | "or"; left: CheckCodeCondition; right: CheckCodeCondition }
  | { kind: "not"; condition: CheckCodeCondition }
  | { kind: "truthy"; operand: CheckCodeOperand };

export type CheckCodeDialogInputType = "text" | "number" | "yes-no" | "date" | "time" | "date-time" | "choice";

export type CheckCodeDialogDataSource =
  | { kind: "db-variables" }
  | { kind: "db-values"; table: string; variable: string }
  | { kind: "db-views" }
  | { kind: "databases" };

export interface CheckCodeDialogRequest {
  message: string;
  title?: string;
  target?: string;
  inputType?: CheckCodeDialogInputType;
  mask?: string;
  choices?: string[];
  dataSource?: CheckCodeDialogDataSource;
}

export interface CheckCodeAutoSearchRequest {
  keys: string[];
  display: string[];
  always: boolean;
  continueNew: boolean;
}

export interface CheckCodeIoCodeRequest {
  industryField: string;
  occupationField: string;
  industryCodeField: string;
  occupationCodeField: string;
  industryTitleField: string;
  occupationTitleField: string;
  schemeField: string;
}

export type CheckCodeStatement =
  | { kind: "goto"; target: string; targetType?: "field" | "page" | "form"; line: number }
  | { kind: "field-action"; action: SafeFieldAction; targets: string[]; except?: string[]; line: number }
  | { kind: "geocode"; addressField: string; latitudeField: string; longitudeField: string; line: number }
  | { kind: "assign"; target: string; value: CheckCodeExpression; line: number }
  | { kind: "clear"; targets: string[]; line: number }
  | { kind: "undefine"; target: string; scope?: "global"; line: number }
  | { kind: "beep"; line: number }
  | { kind: "call"; target: string; line: number }
  | { kind: "always"; statements: CheckCodeStatement[]; line: number }
  | { kind: "record-action"; action: "save" | "new" | "quit"; line: number }
  | ({ kind: "autosearch"; line: number } & CheckCodeAutoSearchRequest)
  | ({ kind: "iocode"; line: number } & CheckCodeIoCodeRequest)
  | ({ kind: "dialog"; line: number } & CheckCodeDialogRequest)
  | { kind: "if"; condition: CheckCodeCondition; then: CheckCodeStatement[]; otherwise: CheckCodeStatement[]; line: number };

export interface CheckCodeSubroutine {
  name: string;
  statements: CheckCodeStatement[];
  line: number;
}

export interface CheckCodeBlock {
  scope: CheckCodeScope;
  name?: string;
  events: Partial<Record<CheckCodeEvent, CheckCodeStatement[]>>;
  line: number;
}

export interface CheckCodeDefinition {
  name: string;
  scope: "standard" | "global" | "permanent";
  valueType: "textinput" | "numeric" | "yn" | "dateformat" | "timeformat" | "datetimeformat";
  line: number;
}

export interface CheckCodeProgramAst {
  schema: typeof CHECK_CODE_AST_SCHEMA;
  definitions: CheckCodeDefinition[];
  subroutines: CheckCodeSubroutine[];
  blocks: CheckCodeBlock[];
}

export interface CheckCodeCompileResult {
  executable: boolean;
  ast: CheckCodeProgramAst;
  fieldCheckCode: ReadonlyMap<string, FieldCheckCode>;
  reasons: string[];
}

export interface CheckCodeProjectFormReference {
  id: string;
  name: string;
}

export interface CheckCodeCompileContext {
  currentFormId?: string;
  forms?: readonly CheckCodeProjectFormReference[];
  capabilities?: readonly { id: string; installed: boolean; executable: boolean; packageTitle?: string; reason?: string }[];
}

interface SourceLine { number: number; text: string }
interface Cursor { index: number }

export class CheckCodeParseError extends Error {
  readonly line: number;

  constructor(line: number, message: string) {
    super(`Line ${line}: ${message}`);
    this.name = "CheckCodeParseError";
    this.line = line;
  }
}

function identifier(token: string, line: number): string {
  const value = token.trim().replace(/^\[|\]$/g, "");
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new CheckCodeParseError(line, `Invalid identifier ${JSON.stringify(token.trim())}.`);
  return value;
}

function formIdentifier(token: string, line: number): string {
  const trimmed = token.trim();
  const quoted = trimmed.match(/^(?:"([^"]+)"|'([^']+)'|\[([^\]]+)\])$/);
  const value = (quoted?.[1] ?? quoted?.[2] ?? quoted?.[3] ?? trimmed).trim();
  if (!value || (!quoted && !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(value))) {
    throw new CheckCodeParseError(line, `Invalid project form identifier ${JSON.stringify(trimmed)}.`);
  }
  return value;
}

function identifiers(source: string, line: number): string[] {
  const values = source.split(/[\s,]+/).filter(Boolean).map((value) => value === "*" ? value : identifier(value, line));
  if (values.length === 0) throw new CheckCodeParseError(line, "Expected at least one field identifier.");
  return values;
}

interface ExpressionToken { kind: "number" | "string" | "word" | "operator" | "left-paren" | "right-paren" | "comma" | "missing" | "boolean"; value?: string | number | boolean }

const functionArity: Record<CheckCodeFunctionName, readonly [number, number]> = {
  ABS: [1, 1], COS: [1, 1], EXP: [1, 1], LN: [1, 1], LOG: [1, 1], ROUND: [1, 2], SIN: [1, 1], SQRT: [1, 1], TAN: [1, 1], TRUNC: [1, 1],
  FINDTEXT: [2, 2], STEP: [2, 2], STRLEN: [1, 1], SUBSTRING: [2, 3], UPPERCASE: [1, 1], TXTTONUM: [1, 1], YEAR: [1, 1], MONTH: [1, 1], DAY: [1, 1],
  TXTTODATE: [1, 1], NUMTODATE: [3, 3], NUMTOTIME: [3, 3], HOUR: [1, 1], MINUTE: [1, 1], SECOND: [1, 1],
  DAYS: [2, 2], HOURS: [2, 2], MINUTES: [2, 2], SECONDS: [2, 2], MONTHS: [2, 2], YEARS: [2, 2],
  EPIWEEK: [1, 2],
  FORMAT: [1, 2], LINEBREAK: [0, 0],
  RECORDCOUNT: [0, 0], ISUNIQUE: [1, 12],
  CURRENTUSER: [0, 0],
  SYSALTITUDE: [0, 0], SYSLATITUDE: [0, 0], SYSLONGITUDE: [0, 0],
  SYSTEMDATE: [0, 0], SYSTEMTIME: [0, 0],
  RND: [1, 2],
  PFROMZ: [1, 1],
  ZSCORE: [5, 5],
};

export const CHECK_CODE_FUNCTION_NAMES = Object.freeze(Object.keys(functionArity).sort()) as readonly CheckCodeFunctionName[];
const bareCheckCodeFunctions = new Set<CheckCodeFunctionName>(["SYSALTITUDE", "SYSLATITUDE", "SYSLONGITUDE", "SYSTEMDATE", "SYSTEMTIME"]);

function expressionTokens(source: string, line: number): ExpressionToken[] {
  const tokens: ExpressionToken[] = [];
  for (let index = 0; index < source.length;) {
    if (/\s/.test(source[index]!)) { index += 1; continue; }
    const rest = source.slice(index);
    const special = rest.match(/^\((\.|\+|-)\)/);
    if (special) {
      tokens.push(special[1] === "." ? { kind: "missing" } : { kind: "boolean", value: special[1] === "+" });
      index += special[0].length;
      continue;
    }
    const current = source[index]!;
    if (current === "(") { tokens.push({ kind: "left-paren" }); index += 1; continue; }
    if (current === ")") { tokens.push({ kind: "right-paren" }); index += 1; continue; }
    if (current === ",") { tokens.push({ kind: "comma" }); index += 1; continue; }
    if ("+-*/%^&".includes(current)) { tokens.push({ kind: "operator", value: current }); index += 1; continue; }
    if (current === '"' || current === "'") {
      const quote = current;
      let value = "";
      index += 1;
      while (index < source.length && source[index] !== quote) {
        if (source[index] === "\\" && source[index + 1] !== undefined) { value += source[index + 1]; index += 2; }
        else { value += source[index]; index += 1; }
      }
      if (source[index] !== quote) throw new CheckCodeParseError(line, "Expression contains an unterminated string.");
      index += 1;
      tokens.push({ kind: "string", value });
      continue;
    }
    const numeric = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)/)?.[0];
    if (numeric) { tokens.push({ kind: "number", value: Number(numeric) }); index += numeric.length; continue; }
    const word = rest.match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0];
    if (!word) throw new CheckCodeParseError(line, `Unsupported expression token near ${JSON.stringify(rest.slice(0, 16))}.`);
    index += word.length;
    const upper = word.toUpperCase();
    if (upper === "MOD") tokens.push({ kind: "operator", value: "MOD" });
    else if (["TRUE", "YES"].includes(upper)) tokens.push({ kind: "boolean", value: true });
    else if (["FALSE", "NO"].includes(upper)) tokens.push({ kind: "boolean", value: false });
    else if (upper === "NULL") tokens.push({ kind: "missing" });
    else tokens.push({ kind: "word", value: word });
  }
  return tokens;
}

function expression(source: string, line: number): CheckCodeExpression {
  const tokens = expressionTokens(source, line);
  let index = 0;
  let nodes = 0;
  const node = <T extends CheckCodeExpression>(value: T): T => {
    nodes += 1;
    if (nodes > 64) throw new CheckCodeParseError(line, "Expression exceeds 64 nodes.");
    return value;
  };
  const primary = (): CheckCodeExpression => {
    const token = tokens[index];
    if (!token) throw new CheckCodeParseError(line, "Expression is incomplete.");
    if (token.kind === "left-paren") {
      index += 1;
      const value = concatenation();
      if (tokens[index]?.kind !== "right-paren") throw new CheckCodeParseError(line, "Expression is missing a closing parenthesis.");
      index += 1;
      return value;
    }
    if (token.kind === "number" || token.kind === "string" || token.kind === "boolean" || token.kind === "missing") {
      index += 1;
      return node({ kind: "literal", value: token.kind === "missing" ? null : token.value as RecordValue });
    }
    if (token.kind !== "word") throw new CheckCodeParseError(line, "Expression requires a value, reference, or allowlisted function.");
    index += 1;
    const name = String(token.value);
    const functionName = name.toUpperCase() as CheckCodeFunctionName;
    if (tokens[index]?.kind !== "left-paren") {
      if (bareCheckCodeFunctions.has(functionName)) return node({ kind: "function", name: functionName, arguments: [] });
      return node({ kind: "reference", value: identifier(name, line) });
    }
    if (bareCheckCodeFunctions.has(functionName)) throw new CheckCodeParseError(line, `${functionName} uses legacy bare syntax without parentheses.`);
    if (!(functionName in functionArity)) throw new CheckCodeParseError(line, `Function ${JSON.stringify(name)} is not in the browser-safe Check Code allowlist.`);
    index += 1;
    const args: CheckCodeExpression[] = [];
    if (tokens[index]?.kind !== "right-paren") {
      while (true) {
        args.push(concatenation());
        if (tokens[index]?.kind !== "comma") break;
        index += 1;
      }
    }
    if (tokens[index]?.kind !== "right-paren") throw new CheckCodeParseError(line, `Function ${functionName} is missing a closing parenthesis.`);
    index += 1;
    const [minimum, maximum] = functionArity[functionName];
    if (args.length < minimum || args.length > maximum) {
      const count = minimum === maximum ? String(minimum) : maximum === minimum + 1 ? `${minimum} or ${maximum}` : `${minimum} through ${maximum}`;
      throw new CheckCodeParseError(line, `${functionName} requires ${count} argument${maximum === 1 ? "" : "s"}.`);
    }
    return node({ kind: "function", name: functionName, arguments: args });
  };
  const unary = (): CheckCodeExpression => {
    const operator = tokens[index];
    if (operator?.kind === "operator" && (operator.value === "+" || operator.value === "-")) {
      index += 1;
      return node({ kind: "unary", operator: operator.value === "+" ? "positive" : "negative", operand: unary() });
    }
    return primary();
  };
  const power = (): CheckCodeExpression => {
    const left = unary();
    if (tokens[index]?.kind === "operator" && tokens[index]?.value === "^") {
      index += 1;
      return node({ kind: "binary", operator: "power", left, right: power() });
    }
    return left;
  };
  const multiplication = (): CheckCodeExpression => {
    let value = power();
    while (tokens[index]?.kind === "operator" && ["*", "/", "%", "MOD"].includes(String(tokens[index]?.value))) {
      const operator = String(tokens[index]!.value);
      index += 1;
      value = node({ kind: "binary", operator: operator === "*" ? "multiply" : operator === "/" ? "divide" : "modulo", left: value, right: power() });
    }
    return value;
  };
  const addition = (): CheckCodeExpression => {
    let value = multiplication();
    while (tokens[index]?.kind === "operator" && ["+", "-"].includes(String(tokens[index]?.value))) {
      const operator = tokens[index]!.value;
      index += 1;
      value = node({ kind: "binary", operator: operator === "+" ? "add" : "subtract", left: value, right: multiplication() });
    }
    return value;
  };
  function concatenation(): CheckCodeExpression {
    let value = addition();
    while (tokens[index]?.kind === "operator" && tokens[index]?.value === "&") {
      index += 1;
      value = node({ kind: "binary", operator: "concatenate", left: value, right: addition() });
    }
    return value;
  }
  const result = concatenation();
  if (index !== tokens.length) throw new CheckCodeParseError(line, "Expression contains an unexpected trailing token.");
  return result;
}

function topLevelWord(source: string, word: "OR" | "AND"): number {
  let depth = 0;
  let quote: string | undefined;
  for (let index = 0; index <= source.length - word.length; index += 1) {
    const current = source[index]!;
    if (quote) {
      if (current === "\\") index += 1;
      else if (current === quote) quote = undefined;
      continue;
    }
    if (current === '"' || current === "'") { quote = current; continue; }
    if (current === "(") { depth += 1; continue; }
    if (current === ")") { depth -= 1; continue; }
    if (depth === 0 && source.slice(index, index + word.length).toUpperCase() === word
      && !/[A-Za-z0-9_]/.test(source[index - 1] ?? "") && !/[A-Za-z0-9_]/.test(source[index + word.length] ?? "")) return index;
  }
  return -1;
}

function stripConditionParentheses(source: string): string {
  let value = source.trim();
  while (value.startsWith("(") && value.endsWith(")") && !/^\((?:\.|\+|-)\)$/.test(value)) {
    let depth = 0;
    let quote: string | undefined;
    let wraps = true;
    for (let index = 0; index < value.length; index += 1) {
      const current = value[index]!;
      if (quote) {
        if (current === "\\") index += 1;
        else if (current === quote) quote = undefined;
      } else if (current === '"' || current === "'") quote = current;
      else if (current === "(") depth += 1;
      else if (current === ")") {
        depth -= 1;
        if (depth === 0 && index < value.length - 1) { wraps = false; break; }
      }
    }
    if (!wraps || depth !== 0) break;
    value = value.slice(1, -1).trim();
  }
  return value;
}

function topLevelComparison(source: string): { index: number; token: string } | undefined {
  let depth = 0;
  let quote: string | undefined;
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index]!;
    if (quote) {
      if (current === "\\") index += 1;
      else if (current === quote) quote = undefined;
      continue;
    }
    if (current === '"' || current === "'") { quote = current; continue; }
    if (current === "(") { depth += 1; continue; }
    if (current === ")") { depth -= 1; continue; }
    if (depth !== 0) continue;
    const token = source.slice(index).match(/^(<=|>=|<>|!=|=|<|>)/)?.[0];
    if (token) return { index, token };
  }
  return undefined;
}

function condition(source: string, line: number, depth = 0): CheckCodeCondition {
  if (depth > 32) throw new CheckCodeParseError(line, "IF condition exceeds 32 logical nodes.");
  const value = stripConditionParentheses(source);
  const orAt = topLevelWord(value, "OR");
  if (orAt >= 0) return { kind: "logical", operator: "or", left: condition(value.slice(0, orAt), line, depth + 1), right: condition(value.slice(orAt + 2), line, depth + 1) };
  const andAt = topLevelWord(value, "AND");
  if (andAt >= 0) return { kind: "logical", operator: "and", left: condition(value.slice(0, andAt), line, depth + 1), right: condition(value.slice(andAt + 3), line, depth + 1) };
  if (/^NOT\b/i.test(value)) return { kind: "not", condition: condition(value.replace(/^NOT\b/i, ""), line, depth + 1) };
  const comparison = topLevelComparison(value);
  if (!comparison) return { kind: "truthy", operand: expression(value, line) };
  const operators: Record<string, CheckCodeComparisonOperator> = {
    "=": "equals", "<>": "not-equals", "!=": "not-equals", "<": "less-than", "<=": "less-than-or-equal", ">": "greater-than", ">=": "greater-than-or-equal",
  };
  return {
    kind: "comparison",
    left: expression(value.slice(0, comparison.index), line),
    operator: operators[comparison.token]!,
    right: expression(value.slice(comparison.index + comparison.token.length), line),
  };
}

interface DialogToken { kind: "string" | "word" | "comma" | "equals"; value: string }

function dialogTokens(source: string, line: number): DialogToken[] {
  const tokens: DialogToken[] = [];
  for (let index = 0; index < source.length;) {
    if (/\s/.test(source[index]!)) { index += 1; continue; }
    const current = source[index]!;
    if (current === ",") { tokens.push({ kind: "comma", value: current }); index += 1; continue; }
    if (current === "=") { tokens.push({ kind: "equals", value: current }); index += 1; continue; }
    if (current === '"' || current === "'") {
      const quote = current;
      let value = "";
      index += 1;
      while (index < source.length && source[index] !== quote) {
        if (source[index] === "\\" && source[index + 1] !== undefined) { value += source[index + 1]; index += 2; }
        else { value += source[index]; index += 1; }
      }
      if (source[index] !== quote) throw new CheckCodeParseError(line, "DIALOG contains an unterminated string.");
      index += 1;
      tokens.push({ kind: "string", value });
      continue;
    }
    const start = index;
    while (index < source.length && !/[\s,=]/.test(source[index]!)) index += 1;
    tokens.push({ kind: "word", value: source.slice(start, index) });
  }
  return tokens;
}

function parseDialogStatement(source: string, line: number): CheckCodeStatement {
  const tokens = dialogTokens(source.replace(/^DIALOG\s+/i, ""), line);
  const message = tokens.shift();
  if (message?.kind !== "string") throw new CheckCodeParseError(line, "DIALOG requires a quoted message.");
  let title: string | undefined;
  const titleIndex = tokens.findIndex((token) => token.kind === "word" && token.value.toUpperCase() === "TITLETEXT");
  if (titleIndex >= 0) {
    const titleTokens = tokens.splice(titleIndex);
    if (titleTokens.length !== 3 || titleTokens[1]?.kind !== "equals" || titleTokens[2]?.kind !== "string") {
      throw new CheckCodeParseError(line, "DIALOG TITLETEXT must use TITLETEXT=\"title\".");
    }
    title = titleTokens[2].value;
  }
  if (tokens.length === 0) return { kind: "dialog", message: message.value, ...(title ? { title } : {}), line };
  const targetToken = tokens.shift();
  if (targetToken?.kind !== "word") throw new CheckCodeParseError(line, "DIALOG response requires a target field or variable.");
  const target = identifier(targetToken.value, line);
  const modifier = tokens[0]?.kind === "word" ? tokens.shift()!.value.toUpperCase() : "";
  const types: Record<string, CheckCodeDialogInputType> = {
    TEXTINPUT: "text", NUMERIC: "number", YN: "yes-no", DATEFORMAT: "date", TIMEFORMAT: "time", DATETIMEFORMAT: "date-time",
  };
  if (modifier === "DBVARIABLES") {
    if (tokens.length > 0) throw new CheckCodeParseError(line, "DBVARIABLES DIALOG does not accept additional source arguments.");
    return { kind: "dialog", message: message.value, target, inputType: "choice", dataSource: { kind: "db-variables" }, ...(title ? { title } : {}), line };
  }
  if (modifier === "DBVIEWS" || modifier === "DATABASES") {
    if (tokens.length > 0) throw new CheckCodeParseError(line, `${modifier} DIALOG does not accept additional source arguments.`);
    return {
      kind: "dialog", message: message.value, target, inputType: "choice",
      dataSource: { kind: modifier === "DBVIEWS" ? "db-views" : "databases" },
      ...(title ? { title } : {}), line,
    };
  }
  if (modifier === "DBVALUES") {
    if (tokens.length !== 2 || tokens.some((token) => token.kind !== "word")) {
      throw new CheckCodeParseError(line, "DBVALUES DIALOG requires a registered table and variable identifier.");
    }
    return {
      kind: "dialog", message: message.value, target, inputType: "choice",
      dataSource: { kind: "db-values", table: identifier(tokens[0]!.value, line), variable: identifier(tokens[1]!.value, line) },
      ...(title ? { title } : {}), line,
    };
  }
  if (modifier && !types[modifier]) {
    throw new CheckCodeParseError(line, `DIALOG modifier ${JSON.stringify(modifier)} is not in the browser-safe input allowlist.`);
  }
  if (modifier) {
    let mask: string | undefined;
    if (tokens.length > 0) {
      if (!(["TEXTINPUT", "NUMERIC", "DATEFORMAT"].includes(modifier) && tokens.length === 1 && tokens[0]?.kind === "string")) {
        throw new CheckCodeParseError(line, `Unsupported or malformed ${modifier} DIALOG options.`);
      }
      mask = tokens[0]!.value;
    }
    return { kind: "dialog", message: message.value, target, inputType: types[modifier]!, ...(mask ? { mask } : {}), ...(title ? { title } : {}), line };
  }
  if (tokens.length === 0) return { kind: "dialog", message: message.value, target, inputType: "number", ...(title ? { title } : {}), line };
  const choices: string[] = [];
  while (tokens.length > 0) {
    const choice = tokens.shift();
    if (choice?.kind !== "string") throw new CheckCodeParseError(line, "DIALOG choices must be quoted strings separated by commas.");
    choices.push(choice.value);
    if (tokens.length > 0 && tokens.shift()?.kind !== "comma") throw new CheckCodeParseError(line, "DIALOG choices must be separated by commas.");
  }
  if (choices.length < 2) throw new CheckCodeParseError(line, "A multiple-choice DIALOG requires at least two choices.");
  return { kind: "dialog", message: message.value, target, inputType: "choice", choices, ...(title ? { title } : {}), line };
}

function parseConditionalBranch(lines: readonly SourceLine[], cursor: Cursor, depth: number): CheckCodeStatement {
  const current = lines[cursor.index]!;
  const match = current.text.match(/^(?:IF|ELSE-IF)\s+(.+?)\s+THEN$/i);
  if (!match) throw new CheckCodeParseError(current.number, "Malformed IF or ELSE-IF statement.");
  cursor.index += 1;
  const thenStatements = parseStatements(lines, cursor, new Set(["ELSE", "ELSE-IF", "END", "END-IF"]), depth + 1);
  let otherwise: CheckCodeStatement[] = [];
  if (lines[cursor.index]?.text.toUpperCase() === "ELSE") {
    cursor.index += 1;
    otherwise = parseStatements(lines, cursor, new Set(["END", "END-IF"]), depth + 1);
  } else if (/^ELSE-IF\s+.+?\s+THEN$/i.test(lines[cursor.index]?.text ?? "")) {
    otherwise = [parseConditionalBranch(lines, cursor, depth + 1)];
  }
  return { kind: "if", condition: condition(match[1] ?? "", current.number), then: thenStatements, otherwise, line: current.number };
}

function parseStatements(lines: readonly SourceLine[], cursor: Cursor, endTokens: ReadonlySet<string>, depth = 0): CheckCodeStatement[] {
  if (depth > 8) throw new CheckCodeParseError(lines[cursor.index]?.number ?? 1, "IF nesting exceeds the browser limit of 8.");
  const statements: CheckCodeStatement[] = [];
  while (cursor.index < lines.length) {
    const current = lines[cursor.index]!;
    const upper = current.text.toUpperCase();
    if (endTokens.has(upper) || endTokens.has("ELSE-IF") && /^ELSE-IF\b/i.test(current.text)) break;
    const ifMatch = current.text.match(/^IF\s+(.+?)\s+THEN$/i);
    if (ifMatch) {
      const statement = parseConditionalBranch(lines, cursor, depth);
      const closing = lines[cursor.index];
      if (!closing || !["END", "END-IF"].includes(closing.text.toUpperCase())) {
        throw new CheckCodeParseError(current.number, "IF is missing END-IF.");
      }
      cursor.index += 1;
      statements.push(statement);
      continue;
    }
    const gotoFormMatch = current.text.match(/^GOTOFORM\s+(.+)$/i);
    const gotoPageMatch = current.text.match(/^GOTOPAGE\s+(.+)$/i);
    const gotoMatch = current.text.match(/^GOTO\s+(.+)$/i);
    const actionMatch = current.text.match(/^(ENABLE|DISABLE|HIDE|UNHIDE|HIGHLIGHT|UNHIGHLIGHT|SET-REQUIRED|SET-NOT-REQUIRED)\s+(.+)$/i);
    const geocodeMatch = current.text.match(/^GEOCODE\s+([^,]+),\s*([^,]+),\s*([^,]+)$/i);
    const clearMatch = current.text.match(/^CLEAR\s+(.+)$/i);
    const assignMatch = current.text.match(/^(?:(?:ASSIGN|LET)\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/i);
    const undefineMatch = current.text.match(/^UNDEFINE\s+(\*|[A-Za-z_][A-Za-z0-9_]*)(?:\s+(GLOBAL))?$/i);
    const callMatch = current.text.match(/^CALL\s+([A-Za-z_][A-Za-z0-9_]*)$/i);
    const autoSearchMatch = current.text.match(/^AUTOSEARCH\s+(.+)$/i);
    const ioCodeMatch = current.text.match(/^IOCODE\s+(.+)$/i);
    const dialogMatch = current.text.match(/^DIALOG\s+/i);
    if (gotoFormMatch) {
      statements.push({ kind: "goto", target: formIdentifier(gotoFormMatch[1] ?? "", current.number), targetType: "form", line: current.number });
    }
    else if (gotoPageMatch) {
      const target = (gotoPageMatch[1] ?? "").trim();
      statements.push({
        kind: "goto",
        target: /^[+-]?\d+$/.test(target) ? target : identifier(target, current.number),
        targetType: "page",
        line: current.number,
      });
    }
    else if (gotoMatch) {
      const target = (gotoMatch[1] ?? "").trim();
      statements.push(/^[+-]?\d+$/.test(target)
        ? { kind: "goto", target, targetType: "page", line: current.number }
        : { kind: "goto", target: identifier(target, current.number), targetType: "field", line: current.number });
    }
    else if (actionMatch) {
      const targetSource = actionMatch[2] ?? "";
      const exceptMatch = targetSource.match(/^\*\s+EXCEPT\s+(.+)$/i);
      statements.push({
        kind: "field-action",
        action: actionMatch[1]!.toLocaleLowerCase() as SafeFieldAction,
        targets: exceptMatch ? ["*"] : identifiers(targetSource, current.number),
        ...(exceptMatch ? { except: identifiers(exceptMatch[1] ?? "", current.number) } : {}),
        line: current.number,
      });
    }
    else if (geocodeMatch) statements.push({
      kind: "geocode",
      addressField: identifier(geocodeMatch[1] ?? "", current.number),
      latitudeField: identifier(geocodeMatch[2] ?? "", current.number),
      longitudeField: identifier(geocodeMatch[3] ?? "", current.number),
      line: current.number,
    });
    else if (clearMatch) statements.push({ kind: "clear", targets: identifiers(clearMatch[1] ?? "", current.number), line: current.number });
    else if (undefineMatch) statements.push({ kind: "undefine", target: undefineMatch[1]!, ...(undefineMatch[2] ? { scope: "global" as const } : {}), line: current.number });
    else if (/^BEEP$/i.test(current.text)) statements.push({ kind: "beep", line: current.number });
    else if (callMatch) statements.push({ kind: "call", target: callMatch[1]!, line: current.number });
    else if (/^SAVE-?RECORD$/i.test(current.text)) statements.push({ kind: "record-action", action: "save", line: current.number });
    else if (/^NEW-?RECORD$/i.test(current.text)) statements.push({ kind: "record-action", action: "new", line: current.number });
    else if (/^(?:QUIT|EXIT)$/i.test(current.text)) statements.push({ kind: "record-action", action: "quit", line: current.number });
    else if (autoSearchMatch) {
      const tokens = (autoSearchMatch[1] ?? "").trim().split(/[\s,]+/).filter(Boolean);
      const displayAt = tokens.findIndex((token) => /^DISPLAYLIST$/i.test(token));
      const alwaysAt = tokens.findIndex((token) => /^ALWAYS$/i.test(token));
      if (tokens.filter((token) => /^DISPLAYLIST$/i.test(token)).length > 1 || tokens.filter((token) => /^ALWAYS$/i.test(token)).length > 1) {
        throw new CheckCodeParseError(current.number, "AUTOSEARCH options may appear only once.");
      }
      if (alwaysAt >= 0 && alwaysAt !== tokens.length - 1) throw new CheckCodeParseError(current.number, "AUTOSEARCH ALWAYS must be the final option.");
      if (displayAt >= 0 && alwaysAt >= 0 && displayAt > alwaysAt) throw new CheckCodeParseError(current.number, "AUTOSEARCH DISPLAYLIST must precede ALWAYS.");
      const keyEnd = displayAt >= 0 ? displayAt : alwaysAt >= 0 ? alwaysAt : tokens.length;
      const keys = identifiers(tokens.slice(0, keyEnd).join(" "), current.number);
      if (keys.includes("*")) throw new CheckCodeParseError(current.number, "AUTOSEARCH requires explicit matching fields.");
      const displayEnd = alwaysAt >= 0 ? alwaysAt : tokens.length;
      const rawDisplay = displayAt >= 0 ? tokens.slice(displayAt + 1, displayEnd) : [];
      if (displayAt >= 0 && rawDisplay.length === 0) throw new CheckCodeParseError(current.number, "AUTOSEARCH DISPLAYLIST requires at least one field or CONTINUENEW.");
      const continueNew = rawDisplay.some((token) => /^CONTINUENEW$/i.test(token));
      const display = rawDisplay.filter((token) => !/^CONTINUENEW$/i.test(token)).map((token) => identifier(token, current.number));
      statements.push({ kind: "autosearch", keys, display, always: alwaysAt >= 0, continueNew, line: current.number });
    }
    else if (ioCodeMatch) {
      const fields = (ioCodeMatch[1] ?? "").split(",").map((token) => identifier(token, current.number));
      if (fields.length !== 7) throw new CheckCodeParseError(current.number, "IOCODE requires exactly seven comma-separated text fields: industry, occupation, industry code, occupation code, industry title, occupation title, and scheme.");
      statements.push({
        kind: "iocode",
        industryField: fields[0]!, occupationField: fields[1]!, industryCodeField: fields[2]!, occupationCodeField: fields[3]!,
        industryTitleField: fields[4]!, occupationTitleField: fields[5]!, schemeField: fields[6]!, line: current.number,
      });
    }
    else if (/^ALWAYS$/i.test(current.text)) {
      cursor.index += 1;
      const children = parseStatements(lines, cursor, new Set(["END"]), depth + 1);
      if (lines[cursor.index]?.text.toUpperCase() !== "END") throw new CheckCodeParseError(current.number, "ALWAYS is missing END.");
      statements.push({ kind: "always", statements: children, line: current.number });
      cursor.index += 1;
      continue;
    }
    else if (assignMatch) statements.push({ kind: "assign", target: identifier(assignMatch[1] ?? "", current.number), value: expression(assignMatch[2] ?? "", current.number), line: current.number });
    else if (dialogMatch) statements.push(parseDialogStatement(current.text, current.number));
    else throw new CheckCodeParseError(current.number, `Unsupported or malformed Check Code statement: ${current.text}`);
    cursor.index += 1;
    if (statements.length > 128) throw new CheckCodeParseError(current.number, "An event exceeds the browser limit of 128 statements.");
  }
  return statements;
}

function stripCheckCodeComments(source: string): string {
  let result = "";
  let quote: '"' | "'" | undefined;
  let blockCommentLine: number | undefined;
  let line = 1;
  for (let index = 0; index < source.length;) {
    const current = source[index]!;
    const next = source[index + 1];
    if (blockCommentLine !== undefined) {
      if (current === "*" && next === "/") {
        result += "  ";
        index += 2;
      } else {
        result += current === "\n" || current === "\r" ? current : " ";
        if (current === "\n") line += 1;
        index += 1;
      }
      if (current === "*" && next === "/") blockCommentLine = undefined;
      continue;
    }
    if (quote) {
      result += current;
      if (current === "\\" && next !== undefined) {
        result += next;
        index += 2;
        continue;
      }
      if (current === quote) quote = undefined;
      if (current === "\n") line += 1;
      index += 1;
      continue;
    }
    if (current === '"' || current === "'") {
      quote = current;
      result += current;
      index += 1;
      continue;
    }
    if (current === "/" && next === "/") {
      result += "  ";
      index += 2;
      while (index < source.length && source[index] !== "\n" && source[index] !== "\r") {
        result += " ";
        index += 1;
      }
      continue;
    }
    if (current === "/" && next === "*") {
      blockCommentLine = line;
      result += "  ";
      index += 2;
      continue;
    }
    result += current;
    if (current === "\n") line += 1;
    index += 1;
  }
  if (blockCommentLine !== undefined) throw new CheckCodeParseError(blockCommentLine, "Multiline comment is missing */.");
  return result;
}

function sourceLines(source: string): SourceLine[] {
  if (source.length > 100_000) throw new CheckCodeParseError(1, "Check Code source exceeds 100,000 characters.");
  return stripCheckCodeComments(source).split(/\r?\n/).map((text, index) => ({ number: index + 1, text: text.trim() }))
    .filter((line) => line.text !== "" && !line.text.startsWith("//") && !line.text.startsWith("***"));
}

export function parseCheckCodeProgram(source: string): CheckCodeProgramAst {
  const lines = sourceLines(source);
  const cursor: Cursor = { index: 0 };
  const definitions: CheckCodeDefinition[] = [];
  const subroutines: CheckCodeSubroutine[] = [];
  const blocks: CheckCodeBlock[] = [];
  while (cursor.index < lines.length) {
    const current = lines[cursor.index]!;
    if (/^DEFINEVARIABLES$/i.test(current.text)) {
      cursor.index += 1;
      while (cursor.index < lines.length && !/^END-DEFINEVARIABLES$/i.test(lines[cursor.index]!.text)) {
        const definitionLine = lines[cursor.index]!;
        const match = definitionLine.text.match(/^DEFINE\s+([^\s]+)(?:\s+(STANDARD|GLOBAL|PERMANENT))?\s+(TEXTINPUT|NUMERIC|YN|DATEFORMAT|TIMEFORMAT|DATETIMEFORMAT)(?:\s+.*)?$/i);
        if (!match) throw new CheckCodeParseError(definitionLine.number, "Unsupported DEFINE syntax in DefineVariables.");
        definitions.push({
          name: identifier(match[1] ?? "", definitionLine.number),
          scope: (match[2]?.toLocaleLowerCase() ?? "standard") as CheckCodeDefinition["scope"],
          valueType: match[3]!.toLocaleLowerCase() as CheckCodeDefinition["valueType"],
          line: definitionLine.number,
        });
        cursor.index += 1;
      }
      if (!lines[cursor.index]) throw new CheckCodeParseError(current.number, "DefineVariables is missing End-DefineVariables.");
      cursor.index += 1;
      continue;
    }
    const subroutine = current.text.match(/^SUB\s+(.+)$/i);
    if (subroutine) {
      cursor.index += 1;
      const statements = parseStatements(lines, cursor, new Set(["END-SUB"]));
      if (lines[cursor.index]?.text.toUpperCase() !== "END-SUB") throw new CheckCodeParseError(current.number, "Sub is missing End-Sub.");
      subroutines.push({ name: identifier(subroutine[1] ?? "", current.number), statements, line: current.number });
      cursor.index += 1;
      continue;
    }
    const opening = current.text.match(/^(FIELD|PAGE)\s+(.+)$/i) ?? current.text.match(/^(FORM|VIEW|RECORD)$/i);
    if (!opening) throw new CheckCodeParseError(current.number, "Expected DefineVariables, Sub, Field, Page, Form/View, or Record.");
    const keyword = opening[1]!.toLocaleLowerCase();
    const scope: CheckCodeScope = keyword === "view" ? "form" : keyword as CheckCodeScope;
    const name = opening[2] ? identifier(opening[2], current.number) : undefined;
    const endBlock = `END-${keyword === "view" ? "VIEW" : keyword.toUpperCase()}`;
    const events: Partial<Record<CheckCodeEvent, CheckCodeStatement[]>> = {};
    cursor.index += 1;
    while (cursor.index < lines.length && lines[cursor.index]!.text.toUpperCase() !== endBlock) {
      const eventLine = lines[cursor.index]!;
      const eventName = eventLine.text.toLocaleLowerCase() as CheckCodeEvent;
      if (!["before", "after", "click"].includes(eventName)) throw new CheckCodeParseError(eventLine.number, `Expected an event block or ${endBlock}.`);
      if (eventName === "click" && scope !== "field") throw new CheckCodeParseError(eventLine.number, "Click is valid only inside a Field block.");
      if (events[eventName]) throw new CheckCodeParseError(eventLine.number, `Duplicate ${eventLine.text} event.`);
      cursor.index += 1;
      events[eventName] = parseStatements(lines, cursor, new Set([`END-${eventName.toUpperCase()}`]));
      const eventEnd = lines[cursor.index];
      if (!eventEnd || eventEnd.text.toUpperCase() !== `END-${eventName.toUpperCase()}`) {
        throw new CheckCodeParseError(eventLine.number, `${eventLine.text} is missing End-${eventLine.text}.`);
      }
      cursor.index += 1;
    }
    if (!lines[cursor.index]) throw new CheckCodeParseError(current.number, `${current.text} is missing ${endBlock}.`);
    cursor.index += 1;
    blocks.push({ scope, ...(name ? { name } : {}), events, line: current.number });
    if (blocks.length > 256) throw new CheckCodeParseError(current.number, "Check Code exceeds 256 event scopes.");
  }
  return { schema: CHECK_CODE_AST_SCHEMA, definitions, subroutines, blocks };
}

function compareName(name: string): string { return name.toLocaleLowerCase(); }

export function compileFieldCheckCodeSubset(ast: CheckCodeProgramAst, schema: FormSchema, context: CheckCodeCompileContext = {}): CheckCodeCompileResult {
  const names = new Map(schema.fields.map((field) => [compareName(field.name), field.name]));
  const pages = schema.pages?.length ? schema.pages : [{ name: "EntryPage", fields: schema.fields.map(({ name }) => name) }];
  const pageNames = new Map(pages.map((page) => [compareName(page.name), page.name]));
  const fieldTypes = new Map(schema.fields.map((field) => [compareName(field.name), field.type]));
  const variables = new Map<string, CheckCodeDefinition>();
  const subroutines = new Map<string, CheckCodeSubroutine>();
  const compiled = new Map<string, FieldCheckCode>();
  const navigation = new Map<string, Set<string>>();
  const reasons: string[] = [];
  const projectForms = context.forms ?? [];
  const resolveForm = (name: string, line: number): CheckCodeProjectFormReference | undefined => {
    const normalized = compareName(name);
    const matches = projectForms.filter((form) => compareName(form.id) === normalized || compareName(form.name) === normalized);
    if (matches.length === 0) {
      reasons.push(`Line ${line}: project form ${JSON.stringify(name)} does not exist in the current project.`);
      return undefined;
    }
    const unique = [...new Map(matches.map((form) => [form.id, form])).values()];
    if (unique.length > 1) {
      reasons.push(`Line ${line}: project form ${JSON.stringify(name)} is ambiguous; use its unique project form identifier.`);
      return undefined;
    }
    if (context.currentFormId && unique[0]!.id === context.currentFormId) {
      reasons.push(`Line ${line}: GOTOFORM cannot target the current form ${JSON.stringify(name)}.`);
      return undefined;
    }
    return unique[0];
  };
  for (const definition of ast.definitions) {
    const normalized = compareName(definition.name);
    if (variables.has(normalized) || names.has(normalized)) reasons.push(`Line ${definition.line}: ${JSON.stringify(definition.name)} duplicates a field or variable name.`);
    else variables.set(normalized, definition);
  }
  for (const subroutine of ast.subroutines) {
    const normalized = compareName(subroutine.name);
    if (subroutines.has(normalized)) reasons.push(`Line ${subroutine.line}: duplicate subroutine ${JSON.stringify(subroutine.name)}.`);
    else subroutines.set(normalized, subroutine);
  }
  const resolveField = (name: string, line: number): string | undefined => {
    const target = names.get(compareName(name));
    if (!target) reasons.push(`Line ${line}: field ${JSON.stringify(name)} does not exist in this form.`);
    return target;
  };
  const resolveValue = (name: string, line: number): boolean => {
    if (names.has(compareName(name)) || variables.has(compareName(name))) return true;
    reasons.push(`Line ${line}: field or variable ${JSON.stringify(name)} does not exist.`);
    return false;
  };
  type ValueFamily = "text" | "text-literal" | "number" | "boolean" | "date" | "time" | "date-time" | "null" | "unknown";
  const declaredFamily = (name: string): ValueFamily => {
    const normalized = compareName(name);
    const declared = variables.get(normalized)?.valueType ?? fieldTypes.get(normalized);
    if (["numeric", "number"].includes(declared ?? "")) return "number";
    if (["yn", "yes-no", "checkbox"].includes(declared ?? "")) return "boolean";
    if (["dateformat", "date"].includes(declared ?? "")) return "date";
    if (["timeformat", "time"].includes(declared ?? "")) return "time";
    if (declared === "datetimeformat") return "date-time";
    return declared ? "text" : "unknown";
  };
  const expressionFamily = (value: CheckCodeExpression, line: number): ValueFamily => {
    if (value.kind === "reference") {
      const name = value.value;
      return resolveValue(name, line) ? declaredFamily(name) : "unknown";
    }
    if (value.kind === "literal") {
      if (value.value === null) return "null";
      if (typeof value.value === "number") return "number";
      if (typeof value.value === "boolean") return "boolean";
      return "text-literal";
    }
    if (value.kind === "unary") {
      const family = expressionFamily(value.operand, line);
      if (!["number", "null", "unknown"].includes(family)) reasons.push(`Line ${line}: unary ${value.operator} requires a numeric expression; received ${family}.`);
      return family === "unknown" ? family : family === "null" ? "null" : "number";
    }
    if (value.kind === "binary") {
      const left = expressionFamily(value.left, line);
      const right = expressionFamily(value.right, line);
      if (value.operator === "concatenate") return left === "unknown" || right === "unknown" ? "unknown" : "text";
      for (const family of [left, right]) if (!["number", "null", "unknown"].includes(family)) {
        reasons.push(`Line ${line}: ${value.operator} requires numeric expressions; received ${family}.`);
      }
      return left === "unknown" || right === "unknown" ? "unknown" : left === "null" || right === "null" ? "null" : "number";
    }
    const families = value.arguments.map((argument) => expressionFamily(argument, line));
    const requireFamily = (indexes: readonly number[], allowed: readonly ValueFamily[]): void => {
      for (const index of indexes) if (families[index] && !allowed.includes(families[index]!)) {
        reasons.push(`Line ${line}: ${value.name} argument ${index + 1} requires ${allowed.join(" or ")}; received ${families[index]}.`);
      }
    };
    if (["ABS", "COS", "EXP", "LN", "LOG", "ROUND", "SIN", "SQRT", "TAN", "TRUNC"].includes(value.name)) requireFamily([0, 1].slice(0, value.arguments.length), ["number", "null", "unknown"]);
    else if (value.name === "STEP") requireFamily([0, 1], ["number", "null", "unknown"]);
    else if (value.name === "FINDTEXT") requireFamily([0, 1], ["text", "text-literal", "null", "unknown"]);
    else if (value.name === "FORMAT" && value.arguments.length === 2) {
      requireFamily([1], ["text-literal"]);
      const format = value.arguments[1];
      if (format?.kind === "literal" && typeof format.value === "string") {
        const name = checkCodeFormatName(format.value);
        if (!name) reasons.push(`Line ${line}: FORMAT named format ${JSON.stringify(format.value)} is not supported by the deterministic browser profile.`);
        else if (["General Number", "Currency", "Fixed", "Standard", "Percent", "Scientific", "Yes/No", "True/False", "On/Off"].includes(name)) {
          requireFamily([0], ["number", "boolean", "null", "unknown"]);
        } else if (["Long Date", "Short Date"].includes(name)) {
          requireFamily([0], ["date", "date-time", "text-literal", "null", "unknown"]);
        } else if (["Long Time", "Short Time"].includes(name)) {
          requireFamily([0], ["time", "date-time", "text-literal", "null", "unknown"]);
        } else requireFamily([0], ["date", "time", "date-time", "text-literal", "null", "unknown"]);
      }
    }
    else if (value.name === "ISUNIQUE") {
      const seen = new Set<string>();
      for (const argument of value.arguments) {
        if (argument.kind !== "reference" || !names.has(compareName(argument.value))) {
          reasons.push(`Line ${line}: ISUNIQUE arguments must be fields in the active form.`);
          continue;
        }
        const normalized = compareName(argument.value);
        if (fieldTypes.get(normalized) === "command-button") reasons.push(`Line ${line}: ISUNIQUE cannot use command-button field ${JSON.stringify(argument.value)}.`);
        if (seen.has(normalized)) reasons.push(`Line ${line}: ISUNIQUE field ${JSON.stringify(argument.value)} is repeated.`);
        seen.add(normalized);
      }
    }
    else if (value.name === "RND") requireFamily([0, 1].slice(0, value.arguments.length), ["number", "null", "unknown"]);
    else if (value.name === "PFROMZ") requireFamily([0], ["number", "null", "unknown"]);
    else if (value.name === "ZSCORE") {
      requireFamily([0, 1], ["text", "text-literal", "null", "unknown"]);
      requireFamily([2, 3, 4], ["number", "null", "unknown"]);
    }
    else if (value.name === "SUBSTRING") {
      requireFamily([0], ["text", "text-literal", "null", "unknown"]);
      requireFamily([1, 2].slice(0, value.arguments.length - 1), ["number", "null", "unknown"]);
    } else if (["STRLEN", "UPPERCASE"].includes(value.name)) requireFamily([0], ["text", "text-literal", "null", "unknown"]);
    else if (["YEAR", "MONTH", "DAY"].includes(value.name)) requireFamily([0], ["date", "date-time", "text", "text-literal", "null", "unknown"]);
    else if (["HOUR", "MINUTE", "SECOND"].includes(value.name)) requireFamily([0], ["time", "date-time", "text", "text-literal", "null", "unknown"]);
    else if (value.name === "TXTTODATE") requireFamily([0], ["text", "text-literal", "date", "date-time", "null", "unknown"]);
    else if (["NUMTODATE", "NUMTOTIME"].includes(value.name)) requireFamily([0, 1, 2], ["number", "null", "unknown"]);
    else if (["DAYS", "HOURS", "MINUTES", "SECONDS", "MONTHS", "YEARS"].includes(value.name)) {
      requireFamily([0, 1], ["date", "date-time", "text", "text-literal", "null", "unknown"]);
    } else if (value.name === "EPIWEEK") {
      requireFamily([0], ["date", "date-time", "text", "text-literal", "null", "unknown"]);
      if (value.arguments.length === 2) requireFamily([1], ["number", "null", "unknown"]);
    }
    if (["TXTTODATE", "NUMTODATE", "SYSTEMDATE"].includes(value.name)) return "date";
    if (["NUMTOTIME", "SYSTEMTIME"].includes(value.name)) return "time";
    if (value.name === "ISUNIQUE") return "boolean";
    return ["SUBSTRING", "UPPERCASE", "FORMAT", "LINEBREAK", "CURRENTUSER"].includes(value.name) ? "text"
      : ["ABS", "COS", "EXP", "FINDTEXT", "LN", "LOG", "PFROMZ", "ZSCORE", "RND", "ROUND", "SIN", "SQRT", "STEP", "TAN", "TRUNC", "STRLEN", "TXTTONUM", "YEAR", "MONTH", "DAY", "HOUR", "MINUTE", "SECOND", "DAYS", "HOURS", "MINUTES", "SECONDS", "MONTHS", "YEARS", "EPIWEEK", "RECORDCOUNT", "SYSALTITUDE", "SYSLATITUDE", "SYSLONGITUDE"].includes(value.name) ? "number" : "unknown";
  };
  const validateCondition = (value: CheckCodeCondition, line: number): void => {
    if (value.kind === "logical") { validateCondition(value.left, line); validateCondition(value.right, line); return; }
    if (value.kind === "not") { validateCondition(value.condition, line); return; }
    if (value.kind === "truthy") {
      const family = expressionFamily(value.operand, line);
      if (family !== "boolean" && family !== "unknown") reasons.push(`Line ${line}: a bare IF value must be Yes/No; received ${family}.`);
      return;
    }
    const left = expressionFamily(value.left, line);
    const right = expressionFamily(value.right, line);
    if (left === "unknown" || right === "unknown") return;
    const comparable = left === "null" || right === "null" || left === right || left === "text-literal" || right === "text-literal";
    if (!comparable) reasons.push(`Line ${line}: IF cannot compare ${left} with ${right}.`);
    if (!["equals", "not-equals"].includes(value.operator) && (left === "null" || right === "null" || left === "boolean" || right === "boolean")) {
      reasons.push(`Line ${line}: ${value.operator} is not valid for missing or Yes/No values.`);
    }
  };
  const validateStatement = (statement: CheckCodeStatement): void => {
    if (statement.kind === "goto") {
      if (statement.targetType === "form") resolveForm(statement.target, statement.line);
      else if (statement.targetType === "page") {
        if (/^[+-]?\d+$/.test(statement.target)) {
          const pageNumber = Number(statement.target);
          const relative = /^[+-]/.test(statement.target);
          if (pageNumber === 0 || relative && Math.abs(pageNumber) >= pages.length || !relative && (pageNumber < 1 || pageNumber > pages.length)) {
            reasons.push(`Line ${statement.line}: page GOTO ${statement.target} is outside this form's ${pages.length}-page model.`);
          }
        } else if (!pageNames.has(compareName(statement.target))) {
          reasons.push(`Line ${statement.line}: page ${JSON.stringify(statement.target)} does not exist in this form.`);
        }
      } else resolveField(statement.target, statement.line);
    }
    else if (statement.kind === "field-action") {
      for (const target of statement.targets) if (target !== "*") resolveField(target, statement.line);
      for (const target of statement.except ?? []) resolveField(target, statement.line);
    } else if (statement.kind === "geocode") {
      resolveField(statement.addressField, statement.line);
      resolveField(statement.latitudeField, statement.line);
      resolveField(statement.longitudeField, statement.line);
    } else if (statement.kind === "assign") {
      resolveValue(statement.target, statement.line);
      expressionFamily(statement.value, statement.line);
    } else if (statement.kind === "clear") {
      for (const target of statement.targets) if (target !== "*") resolveValue(target, statement.line);
    } else if (statement.kind === "undefine") {
      if (statement.target !== "*" && !variables.has(compareName(statement.target))) {
        reasons.push(`Line ${statement.line}: defined variable ${JSON.stringify(statement.target)} does not exist.`);
      }
      if (statement.scope === "global" && statement.target !== "*") reasons.push(`Line ${statement.line}: GLOBAL is valid only with UNDEFINE *.`);
    } else if (statement.kind === "call") {
      if (!subroutines.has(compareName(statement.target))) reasons.push(`Line ${statement.line}: subroutine ${JSON.stringify(statement.target)} does not exist.`);
    } else if (statement.kind === "autosearch") {
      for (const targets of [statement.keys, statement.display]) {
        const seen = new Set<string>();
        for (const target of targets) {
          const normalized = compareName(target);
          const field = resolveField(target, statement.line);
          if (field && fieldTypes.get(normalized) === "command-button") reasons.push(`Line ${statement.line}: AUTOSEARCH cannot use Command Button field ${JSON.stringify(target)}.`);
          if (!seen.add(normalized)) reasons.push(`Line ${statement.line}: AUTOSEARCH field ${JSON.stringify(target)} is repeated in one list.`);
        }
      }
    } else if (statement.kind === "iocode") {
      const textTypes = new Set(["text", "text-uppercase", "multiline"]);
      for (const target of [statement.industryField, statement.occupationField, statement.industryCodeField, statement.occupationCodeField, statement.industryTitleField, statement.occupationTitleField, statement.schemeField]) {
        const resolved = resolveField(target, statement.line);
        if (resolved && !textTypes.has(fieldTypes.get(compareName(resolved)) ?? "")) reasons.push(`Line ${statement.line}: IOCODE field ${JSON.stringify(target)} must be a Text field.`);
      }
      const capability = context.capabilities?.find(({ id }) => id === "io.coder.review/0.1");
      if (capability?.installed) {
        reasons.push(`Line ${statement.line}: ${capability.packageTitle ?? "The Occupational Epidemiology package"} is installed and integrity-checked, but IOCODE scientific execution is not approved${capability.reason ? `: ${capability.reason}` : "."}`);
      } else {
        reasons.push(`Line ${statement.line}: IOCODE is preserved but cannot execute until the governed Occupational Epidemiology package supplies an approved NIOSH-compatible browser coder, licensed model, and validation corpus.`);
      }
    } else if (statement.kind === "dialog") {
      if (statement.target && resolveValue(statement.target, statement.line) && statement.inputType) {
        const normalized = compareName(statement.target);
        const actual = variables.get(normalized)?.valueType ?? fieldTypes.get(normalized);
        const allowed: Record<CheckCodeDialogInputType, readonly string[]> = {
          text: ["textinput", "text", "text-uppercase", "multiline", "unique-id", "phone"],
          choice: ["textinput", "text", "text-uppercase", "multiline", "option"],
          number: ["numeric", "number"],
          "yes-no": ["yn", "yes-no", "checkbox"],
          date: ["dateformat", "date"],
          time: ["timeformat", "time"],
          "date-time": ["datetimeformat"],
        };
        if (!actual || !allowed[statement.inputType].includes(actual)) {
          reasons.push(`Line ${statement.line}: ${statement.inputType} DIALOG target ${JSON.stringify(statement.target)} has incompatible type ${JSON.stringify(actual ?? "unknown")}.`);
        }
      }
    } else if (statement.kind === "if") {
      validateCondition(statement.condition, statement.line);
      statement.then.forEach(validateStatement);
      statement.otherwise.forEach(validateStatement);
    } else if (statement.kind === "always") statement.statements.forEach(validateStatement);
  };
  const collectGotoTargets = (statements: readonly CheckCodeStatement[], targets: Set<string>): void => {
    for (const statement of statements) {
      if (statement.kind === "goto" && statement.targetType !== "page" && statement.targetType !== "form") targets.add(compareName(statement.target));
      else if (statement.kind === "if") {
        collectGotoTargets(statement.then, targets);
        collectGotoTargets(statement.otherwise, targets);
      } else if (statement.kind === "always") collectGotoTargets(statement.statements, targets);
    }
  };
  const compileAfter = (statement: CheckCodeStatement, blockField: string, when?: SafeCheckCodeStatement["when"]): SafeCheckCodeStatement[] => {
    if (statement.kind === "goto") {
      if (statement.targetType === "page" || statement.targetType === "form") return [];
      const targetField = names.get(compareName(statement.target));
      return targetField ? [{ kind: "goto", targetField, ...(when ? { when } : {}) }] : [];
    }
    if (statement.kind === "field-action") {
      const excluded = new Set((statement.except ?? []).map(compareName));
      const targets = (statement.targets.includes("*") ? [...names.values()] : statement.targets)
        .filter((target) => !excluded.has(compareName(target)));
      return targets.flatMap((target) => {
        const targetField = names.get(compareName(target));
        return targetField ? [{ kind: "field-action" as const, action: statement.action, targetField, ...(when ? { when } : {}) }] : [];
      });
    }
    if (statement.kind === "if") {
      const predicate = statement.condition;
      if (predicate.kind !== "comparison" || predicate.left.kind !== "reference" || predicate.right.kind !== "literal"
        || !["equals", "not-equals"].includes(predicate.operator) || statement.otherwise.length > 0) return [];
      const left = names.get(compareName(String(predicate.left.value)));
      if (left !== blockField) return [];
      const nestedWhen = { operator: predicate.operator as "equals" | "not-equals", value: predicate.right.value as RecordValue };
      return statement.then.flatMap((child) => compileAfter(child, blockField, nestedWhen));
    }
    if (statement.kind === "always") return statement.statements.flatMap((child) => compileAfter(child, blockField, when));
    return [];
  };
  const containsRecordAction = (statement: CheckCodeStatement): boolean => statement.kind === "record-action"
    || statement.kind === "if" && [...statement.then, ...statement.otherwise].some(containsRecordAction)
    || statement.kind === "always" && statement.statements.some(containsRecordAction);
  for (const subroutine of ast.subroutines) {
    subroutine.statements.forEach(validateStatement);
    if (subroutine.statements.some(containsRecordAction)) reasons.push(`Line ${subroutine.line}: record lifecycle commands must appear directly in a Field Click event, not a reusable subroutine.`);
  }
  const callGraph = new Map<string, Set<string>>();
  const collectCalls = (statements: readonly CheckCodeStatement[], targets: Set<string>): void => {
    for (const statement of statements) {
      if (statement.kind === "call") targets.add(compareName(statement.target));
      else if (statement.kind === "if") { collectCalls(statement.then, targets); collectCalls(statement.otherwise, targets); }
      else if (statement.kind === "always") collectCalls(statement.statements, targets);
    }
  };
  for (const [name, subroutine] of subroutines) {
    const targets = new Set<string>();
    collectCalls(subroutine.statements, targets);
    callGraph.set(name, targets);
  }
  const callVisiting = new Set<string>();
  const callVisited = new Set<string>();
  const visitCall = (name: string, path: string[]): void => {
    if (callVisiting.has(name)) {
      const cycleAt = path.indexOf(name);
      reasons.push(`Check Code CALL cycle detected: ${[...path.slice(Math.max(0, cycleAt)), name].map((item) => subroutines.get(item)?.name ?? item).join(" -> ")}.`);
      return;
    }
    if (callVisited.has(name)) return;
    callVisiting.add(name);
    for (const target of callGraph.get(name) ?? []) if (callGraph.has(target)) visitCall(target, [...path, name]);
    callVisiting.delete(name);
    callVisited.add(name);
  };
  for (const name of callGraph.keys()) visitCall(name, []);
  const seenBlocks = new Set<string>();
  for (const block of ast.blocks) {
    const blockKey = `${block.scope}:${compareName(block.name ?? "")}`;
    if (seenBlocks.has(blockKey)) reasons.push(`Line ${block.line}: duplicate ${block.scope} Check Code block.`);
    seenBlocks.add(blockKey);
    for (const statements of Object.values(block.events)) statements?.forEach(validateStatement);
    const visitRecordAction = (statement: CheckCodeStatement, event: CheckCodeEvent): void => {
      if (statement.kind === "record-action" && (block.scope !== "field" || event !== "click")) {
        reasons.push(`Line ${statement.line}: ${statement.action.toUpperCase()} record lifecycle commands are enabled only in a Field Click event in this browser candidate.`);
      } else if (statement.kind === "if") {
        statement.then.forEach((child) => visitRecordAction(child, event));
        statement.otherwise.forEach((child) => visitRecordAction(child, event));
      } else if (statement.kind === "always") statement.statements.forEach((child) => visitRecordAction(child, event));
    };
    for (const [event, statements] of Object.entries(block.events) as [CheckCodeEvent, CheckCodeStatement[]][]) {
      statements?.forEach((statement) => visitRecordAction(statement, event));
      if (event === "click" && statements?.some(containsRecordAction) && block.name
        && fieldTypes.get(compareName(block.name)) !== "command-button") {
        reasons.push(`Line ${block.line}: record lifecycle commands require a Command Button Field Click event.`);
      }
    }
    if (block.scope !== "field") {
      const visitExitNavigation = (statement: CheckCodeStatement): void => {
        if (statement.kind === "goto" && statement.targetType === "form") {
          reasons.push(`Line ${statement.line}: GOTOFORM is not allowed in ${block.scope} After; use a field event so exit events remain deterministic.`);
        } else if (statement.kind === "if") {
          statement.then.forEach(visitExitNavigation);
          statement.otherwise.forEach(visitExitNavigation);
        } else if (statement.kind === "always") statement.statements.forEach(visitExitNavigation);
      };
      block.events.after?.forEach(visitExitNavigation);
    }
    if (block.scope === "page" && block.name && !pageNames.has(compareName(block.name))) {
      reasons.push(`Line ${block.line}: page event block ${JSON.stringify(block.name)} does not exist in this form.`);
    }
    if (block.scope !== "field" || !block.name) continue;
    const fieldName = resolveField(block.name, block.line);
    if (!fieldName) continue;
    const targets = navigation.get(compareName(fieldName)) ?? new Set<string>();
    collectGotoTargets(block.events.after ?? [], targets);
    navigation.set(compareName(fieldName), targets);
    const after = (block.events.after ?? []).flatMap((statement) => compileAfter(statement, fieldName));
    const clickStatements = block.events.click ?? [];
    const click = clickStatements.flatMap((statement) => {
      if (statement.kind !== "geocode") return [];
      const addressField = names.get(compareName(statement.addressField));
      const latitudeField = names.get(compareName(statement.latitudeField));
      const longitudeField = names.get(compareName(statement.longitudeField));
      return addressField && latitudeField && longitudeField ? [{ kind: "geocode" as const, addressField, latitudeField, longitudeField }] : [];
    });
    if (after.length > 8) after.length = 0;
    if (click.length > 1) reasons.push(`Field ${fieldName} exceeds the current limit of one Click statement.`);
    if (after.length > 0 || click.length > 0) compiled.set(fieldName, { version: 1, ...(after.length > 0 ? { after } : {}), ...(click.length > 0 ? { click } : {}) });
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (field: string, path: string[]): void => {
    if (visiting.has(field)) {
      const cycleAt = path.indexOf(field);
      reasons.push(`Check Code GOTO cycle detected: ${[...path.slice(Math.max(0, cycleAt)), field].map((name) => names.get(name) ?? name).join(" -> ")}.`);
      return;
    }
    if (visited.has(field)) return;
    visiting.add(field);
    for (const target of navigation.get(field) ?? []) if (navigation.has(target)) visit(target, [...path, field]);
    visiting.delete(field);
    visited.add(field);
  };
  for (const field of navigation.keys()) visit(field, []);
  return { executable: reasons.length === 0, ast, fieldCheckCode: reasons.length === 0 ? compiled : new Map(), reasons };
}

export function serializeFieldCheckCodeSubset(schema: FormSchema): string {
  const lines: string[] = ["*** Epi Info AI bounded Check Code source"];
  for (const field of schema.fields) {
    const after = field.checkCode?.after ?? [];
    const click = field.checkCode?.click ?? [];
    if (after.length === 0 && click.length === 0) continue;
    lines.push(`Field ${field.name}`);
    if (after.length > 0) {
      lines.push("  After");
      for (const statement of after) {
        const command = statement.kind === "goto" ? `GOTO ${statement.targetField}` : `${statement.action.toUpperCase()} ${statement.targetField}`;
        if (statement.when) {
          const value = typeof statement.when.value === "string" ? JSON.stringify(statement.when.value) : String(statement.when.value);
          lines.push(`    IF ${field.name} ${statement.when.operator === "equals" ? "=" : "<>"} ${value} THEN`, `      ${command}`, "    END-IF");
        } else lines.push(`    ${command}`);
      }
      lines.push("  End-After");
    }
    if (click.length > 0) {
      lines.push("  Click");
      for (const statement of click) lines.push(`    GEOCODE ${statement.addressField}, ${statement.latitudeField}, ${statement.longitudeField}`);
      lines.push("  End-Click");
    }
    lines.push("End-Field", "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
