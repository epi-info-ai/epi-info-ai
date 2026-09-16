export const CLASSIC_AST_VERSION = "1.0.0" as const;

export interface ClassicSourceLocation {
  line: number;
  column: number;
  offset: number;
}

export interface ClassicSourceSpan {
  start: ClassicSourceLocation;
  end: ClassicSourceLocation;
}

interface ClassicNode {
  span: ClassicSourceSpan;
}

export interface ClassicIdentifier extends ClassicNode {
  type: "Identifier";
  name: string;
}

export type ClassicLiteralValue = string | number | boolean;

export interface ClassicLiteralExpression extends ClassicNode {
  type: "Literal";
  value: ClassicLiteralValue;
  raw: string;
  valueType: "string" | "number" | "boolean" | "date";
}

export interface ClassicMissingExpression extends ClassicNode {
  type: "Missing";
  raw: "(.)";
}

export interface ClassicIdentifierExpression extends ClassicNode {
  type: "IdentifierExpression";
  name: string;
}

export interface ClassicUnaryExpression extends ClassicNode {
  type: "UnaryExpression";
  operator: "+" | "-" | "NOT";
  argument: ClassicExpression;
}

export interface ClassicBinaryExpression extends ClassicNode {
  type: "BinaryExpression";
  operator: "OR" | "XOR" | "AND" | "LIKE" | "=" | "<>" | ">" | ">=" | "<" | "<=" | "&" | "+" | "-" | "*" | "/" | "MOD" | "%" | "^";
  left: ClassicExpression;
  right: ClassicExpression;
}

export interface ClassicCallExpression extends ClassicNode {
  type: "CallExpression";
  callee: string;
  arguments: ClassicExpression[];
}

export type ClassicExpression =
  | ClassicLiteralExpression
  | ClassicMissingExpression
  | ClassicIdentifierExpression
  | ClassicUnaryExpression
  | ClassicBinaryExpression
  | ClassicCallExpression;

export interface ClassicAnalysisOptions {
  stratifyBy: ClassicIdentifier[];
  weightBy?: ClassicIdentifier;
  outputTable?: ClassicIdentifier;
  psuVariable?: ClassicIdentifier;
  statistics?: "NONE" | "FISHER";
  columnSize?: number;
  noWrap: boolean;
  oneIsYes: boolean;
}

export interface ClassicReadStatement extends ClassicNode {
  type: "ReadStatement";
  target: {
    kind: "current-project-table" | "external-table";
    table: string;
    source?: string;
    raw: string;
  };
}

export interface ClassicRelateStatement extends ClassicNode {
  type: "RelateStatement";
  target: ClassicReadStatement["target"];
  keys: Array<{ current: ClassicIdentifier; related: ClassicIdentifier }>;
  join: "matching" | "all";
}

export interface ClassicWriteStatement extends ClassicNode {
  type: "WriteStatement";
  mode: "APPEND" | "REPLACE";
  format: "Epi7" | "Epi2000" | "Epi 2000" | "Excel 8.0" | "Text";
  target: { source: string; table?: string; raw: string };
  selection:
    | { kind: "fields"; fields: ClassicIdentifier[] }
    | { kind: "all" }
    | { kind: "all-except"; fields: ClassicIdentifier[] };
}

export interface ClassicMergeStatement extends ClassicNode {
  type: "MergeStatement";
  target: ClassicReadStatement["target"];
  keys: Array<{ current: ClassicIdentifier; source: ClassicIdentifier }>;
  mode: "default" | "APPEND" | "UPDATE" | "RELATE";
}

export interface ClassicDeleteStatement extends ClassicNode {
  type: "DeleteStatement";
  target:
    | { kind: "external-file"; source: string; raw: string }
    | { kind: "current-project-table"; table: string; raw: string }
    | { kind: "external-table"; source: string; table?: string; raw: string }
    | { kind: "records"; selection: "all" | ClassicExpression; raw: string };
  permanent: boolean;
  runSilent: boolean;
  saveData: boolean;
}

export interface ClassicUndeleteStatement extends ClassicNode {
  type: "UndeleteStatement";
  selection: "all" | ClassicExpression;
  raw: string;
  runSilent: boolean;
}

export interface ClassicFrequencyStatement extends ClassicNode {
  type: "FrequencyStatement";
  selection:
    | { kind: "fields"; fields: ClassicIdentifier[] }
    | { kind: "all" }
    | { kind: "all-except"; fields: ClassicIdentifier[] };
  options: ClassicAnalysisOptions;
}

export interface ClassicListStatement extends ClassicNode {
  type: "ListStatement";
  selection: ClassicFrequencyStatement["selection"];
}

export interface ClassicTablesStatement extends ClassicNode {
  type: "TablesStatement";
  exposure: ClassicIdentifier | "*";
  outcome?: ClassicIdentifier;
  options: ClassicAnalysisOptions;
}

export interface ClassicMatchStatement extends ClassicNode {
  type: "MatchStatement";
  selection:
    | { kind: "row-all"; outcome: ClassicIdentifier }
    | { kind: "row-all-except"; excludedRows: ClassicIdentifier[]; outcome: ClassicIdentifier }
    | { kind: "column-all"; exposure: ClassicIdentifier }
    | { kind: "column-all-except"; exposure: ClassicIdentifier; excludedColumns: ClassicIdentifier[] }
    | { kind: "row-column"; exposure: ClassicIdentifier; outcome: ClassicIdentifier };
  weightBy?: ClassicIdentifier;
  matchBy: ClassicIdentifier[];
  settings: Array<{ name: string; value: string }>;
}

export interface ClassicLogisticTerm {
  factors: Array<{ field: ClassicIdentifier; categorical: boolean }>;
}

export interface ClassicLogisticStatement extends ClassicNode {
  type: "LogisticStatement";
  outcome: ClassicIdentifier;
  terms: ClassicLogisticTerm[];
  matchBy?: ClassicIdentifier;
  weightBy?: ClassicIdentifier;
  title?: string;
  confidenceLevel?: number;
  outputTable?: ClassicIdentifier;
  linkFunction?: "LOG";
  noIntercept: boolean;
}

export interface ClassicMeansStatement extends ClassicNode {
  type: "MeansStatement";
  field: ClassicIdentifier;
  crossTab?: ClassicIdentifier;
  options: ClassicAnalysisOptions;
}

export type ClassicAggregateFunction = "AVG" | "COUNT" | "FIRST" | "LAST" | "MAX" | "MIN" | "STDEV" | "STDEVP" | "SUM" | "VAR" | "VARP";

export interface ClassicSummarizeStatement extends ClassicNode {
  type: "SummarizeStatement";
  aggregates: Array<{ target: ClassicIdentifier; aggregate: ClassicAggregateFunction; field?: ClassicIdentifier }>;
  outputTable: ClassicIdentifier;
  stratifyBy: ClassicIdentifier[];
  weightBy?: ClassicIdentifier;
}

export interface ClassicGraphStatement extends ClassicNode {
  type: "GraphStatement";
  field: ClassicIdentifier;
  graphType: string;
  title?: string;
  xTitle?: string;
  yTitle?: string;
}

export type ClassicSetStatement = ClassicNode & ({
  type: "SetStatement";
  option: "MISSING";
  enabled: boolean;
} | {
  type: "SetStatement";
  option: "REPRESENTATION_OF_MISSING";
  value: string;
});

export interface EpiAiQualityStatement extends ClassicNode {
  type: "EpiAiQualityStatement";
}

export interface EpiAiSpaceTimeClusterStatement extends ClassicNode {
  type: "EpiAiSpaceTimeClusterStatement";
  idField: ClassicIdentifier;
  dateField: ClassicIdentifier;
  latitudeField: ClassicIdentifier;
  longitudeField: ClassicIdentifier;
  resultName: ClassicIdentifier;
  studyStart: string;
  studyEnd: string;
  timeUnit: "DAY" | "WEEK" | "MONTH";
  timeLength: number;
  maxDistanceKm: number;
  maxCaseFraction: number;
  maxTimeUnits: number;
  maxTimeFraction: number;
  replications: number;
  seed: number;
}

export interface EpiAiClusterRenderStatement extends ClassicNode {
  type: "EpiAiClusterRenderStatement";
  resultName: ClassicIdentifier;
}

export interface EpiAiRecordLinkFieldPair {
  sourceA: ClassicIdentifier;
  sourceB: ClassicIdentifier;
}

export interface EpiAiRecordLinkStatement extends ClassicNode {
  type: "EpiAiRecordLinkStatement";
  sourceA: ClassicIdentifier;
  sourceB: ClassicIdentifier;
  idA: ClassicIdentifier;
  idB: ClassicIdentifier;
  truthSource?: ClassicIdentifier;
  truthIdA?: ClassicIdentifier;
  truthIdB?: ClassicIdentifier;
  blockPairs: EpiAiRecordLinkFieldPair[];
  exactPairs: EpiAiRecordLinkFieldPair[];
  fuzzyPairs: EpiAiRecordLinkFieldPair[];
  fuzzyThreshold: number;
  reviewThreshold: number;
  matchThreshold: number;
  maxCandidates: number;
  resultName: ClassicIdentifier;
}

export interface FileConvertStatement extends ClassicNode {
  type: "FileConvertStatement";
  inputFile: string;
  outputFile: string;
}

export type ClassicVariableScope = "STANDARD" | "GLOBAL" | "PERMANENT";
export type ClassicVariableType = "NUMERIC" | "TEXTINPUT" | "YN" | "DATEFORMAT" | "DATETIMEFORMAT" | "TIMEFORMAT";

export interface ClassicDefineStatement extends ClassicNode {
  type: "DefineStatement";
  variable: ClassicIdentifier;
  scope: ClassicVariableScope;
  variableType?: ClassicVariableType;
  prompt?: string;
  initializer?: ClassicExpression;
}

export interface ClassicDefineGroupStatement extends ClassicNode {
  type: "DefineGroupStatement";
  group: ClassicIdentifier;
  members: ClassicIdentifier[];
}

export interface ClassicAssignStatement extends ClassicNode {
  type: "AssignStatement";
  target: ClassicIdentifier;
  value: ClassicExpression;
}

export interface ClassicUndefineStatement extends ClassicNode {
  type: "UndefineStatement";
  mode: "one" | "all-standard" | "all-global";
  variable?: ClassicIdentifier;
}

export interface ClassicDisplayStatement extends ClassicNode {
  type: "DisplayStatement";
  displayType: "DBVARIABLES";
  mode: "all" | "defined" | "fields" | "list";
  variables: ClassicIdentifier[];
}

export interface ClassicSelectStatement extends ClassicNode {
  type: "SelectStatement";
  mode: "apply" | "clear" | "cancel";
  expression?: ClassicExpression;
}

export interface ClassicSortStatement extends ClassicNode {
  type: "SortStatement";
  mode: "apply" | "clear" | "cancel";
  items: Array<{ field: ClassicIdentifier; direction: "ASC" | "DESC" }>;
}

export interface ClassicRecodeValueClause extends ClassicNode {
  type: "RecodeValueClause";
  from: ClassicExpression;
  to?: ClassicExpression;
  result: ClassicExpression;
}

export interface ClassicRecodeElseClause extends ClassicNode {
  type: "RecodeElseClause";
  result: ClassicExpression;
}

export type ClassicRecodeClause = ClassicRecodeValueClause | ClassicRecodeElseClause;

export interface ClassicRecodeStatement extends ClassicNode {
  type: "RecodeStatement";
  source: ClassicIdentifier;
  target: ClassicIdentifier;
  clauses: ClassicRecodeClause[];
}

export interface ClassicIfStatement extends ClassicNode {
  type: "IfStatement";
  test: ClassicExpression;
  consequent: ClassicStatement[];
  alternate: ClassicStatement[];
}

export interface ClassicHeaderStatement extends ClassicNode {
  type: "HeaderStatement";
  level: 1;
  text: string;
}

export interface ClassicTypeoutStatement extends ClassicNode {
  type: "TypeoutStatement";
  text: string;
}

export interface ClassicRouteoutStatement extends ClassicNode {
  type: "RouteoutStatement";
  fileName: string;
  mode: "APPEND" | "REPLACE";
}

export interface ClassicCloseoutStatement extends ClassicNode {
  type: "CloseoutStatement";
}

export interface ClassicPrintoutStatement extends ClassicNode {
  type: "PrintoutStatement";
  fileName?: string;
}

export type ClassicDialogInput =
  | { kind: "message" }
  | { kind: "numeric"; implicit: boolean; mask?: string }
  | { kind: "text"; mask?: string }
  | { kind: "yes-no" }
  | { kind: "date" | "time" | "datetime"; mask?: string }
  | { kind: "choices"; values: string[] }
  | { kind: "db-values"; table: ClassicIdentifier; variable: ClassicIdentifier }
  | { kind: "db-views" | "databases" | "db-variables" }
  | { kind: "read-file" | "write-file"; filter?: string };

export interface ClassicDialogStatement extends ClassicNode {
  type: "DialogStatement";
  prompt: string;
  title?: string;
  target?: ClassicIdentifier;
  input: ClassicDialogInput;
}

export interface ClassicBeepStatement extends ClassicNode {
  type: "BeepStatement";
}

export type ClassicStatement =
  | ClassicReadStatement
  | ClassicRelateStatement
  | ClassicWriteStatement
  | ClassicMergeStatement
  | ClassicDeleteStatement
  | ClassicUndeleteStatement
  | ClassicFrequencyStatement
  | ClassicListStatement
  | ClassicTablesStatement
  | ClassicMatchStatement
  | ClassicLogisticStatement
  | ClassicMeansStatement
  | ClassicSummarizeStatement
  | ClassicGraphStatement
  | ClassicHeaderStatement
  | ClassicTypeoutStatement
  | ClassicRouteoutStatement
  | ClassicCloseoutStatement
  | ClassicPrintoutStatement
  | ClassicDialogStatement
  | ClassicBeepStatement
  | ClassicSetStatement
  | EpiAiQualityStatement
  | EpiAiSpaceTimeClusterStatement
  | EpiAiClusterRenderStatement
  | EpiAiRecordLinkStatement
  | FileConvertStatement
  | ClassicDefineStatement
  | ClassicDefineGroupStatement
  | ClassicAssignStatement
  | ClassicUndefineStatement
  | ClassicDisplayStatement
  | ClassicSelectStatement
  | ClassicSortStatement
  | ClassicRecodeStatement
  | ClassicIfStatement;

export interface ClassicProgramAst extends ClassicNode {
  type: "Program";
  astVersion: typeof CLASSIC_AST_VERSION;
  source: string;
  body: ClassicStatement[];
}

export class ClassicSyntaxError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(line: number, column: number, message: string) {
    super(`Line ${line}, column ${column}: ${message}`);
    this.name = "ClassicSyntaxError";
    this.line = line;
    this.column = column;
  }
}

interface SourceLine {
  text: string;
  trimmed: string;
  line: number;
  offset: number;
}

type ExpressionTokenKind = "identifier" | "number" | "string" | "date" | "boolean" | "missing" | "operator" | "left" | "right" | "comma" | "eof";

interface ExpressionToken {
  kind: ExpressionTokenKind;
  text: string;
  start: number;
  end: number;
}

const BINARY_PRECEDENCE: Readonly<Record<string, number>> = {
  OR: 1, XOR: 2, AND: 3,
  LIKE: 4, "=": 4, "<>": 4, ">": 4, ">=": 4, "<": 4, "<=": 4,
  "&": 5, "+": 6, "-": 6, "*": 7, "/": 7, MOD: 7, "%": 7, "^": 8,
};

function lineSpan(line: SourceLine, endLine: SourceLine = line): ClassicSourceSpan {
  return {
    start: { line: line.line, column: 1, offset: line.offset },
    end: { line: endLine.line, column: endLine.text.length + 1, offset: endLine.offset + endLine.text.length },
  };
}

function expressionSpan(line: SourceLine, start: number, end: number): ClassicSourceSpan {
  return {
    start: { line: line.line, column: start + 1, offset: line.offset + start },
    end: { line: line.line, column: end + 1, offset: line.offset + end },
  };
}

function identifierName(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith("[") && trimmed.endsWith("]") ? trimmed.slice(1, -1) : trimmed;
}

function identifier(raw: string, line: SourceLine): ClassicIdentifier {
  const trimmed = raw.trim();
  const bracketed = trimmed.startsWith("[") && trimmed.endsWith("]");
  const name = identifierName(raw);
  const valid = bracketed
    ? Boolean(name.trim()) && !/[\[\]\r\n]/.test(name)
    : /^(?:[A-Za-z_][A-Za-z0-9_]*)(?:\.(?:[A-Za-z_][A-Za-z0-9_]*))*$/.test(name);
  if (!valid) {
    throw new ClassicSyntaxError(line.line, Math.max(1, line.text.indexOf(raw) + 1), `Expected an identifier; found ${JSON.stringify(raw)}.`);
  }
  const start = Math.max(0, line.text.indexOf(raw));
  return { type: "Identifier", name, span: expressionSpan(line, start, start + raw.length) };
}

function tokenizeExpression(source: string, line: SourceLine, sourceColumn: number): ExpressionToken[] {
  const tokens: ExpressionToken[] = [];
  let cursor = 0;
  const fail = (message: string): never => { throw new ClassicSyntaxError(line.line, sourceColumn + cursor, message); };
  while (cursor < source.length) {
    if (/\s/.test(source[cursor]!)) { cursor++; continue; }
    const start = cursor;
    const remaining = source.slice(cursor);
    if (remaining.startsWith("(.)")) { cursor += 3; tokens.push({ kind: "missing", text: "(.)", start, end: cursor }); continue; }
    const boolean = remaining.match(/^\((?:\+|-)\)/);
    if (boolean) { cursor += boolean[0].length; tokens.push({ kind: "boolean", text: boolean[0], start, end: cursor }); continue; }
    const date = remaining.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}(?![\d/])/);
    if (date) { cursor += date[0].length; tokens.push({ kind: "date", text: date[0], start, end: cursor }); continue; }
    if (source[cursor] === '"') {
      cursor++;
      let closed = false;
      while (cursor < source.length) {
        if (source[cursor] !== '"') { cursor++; continue; }
        if (source[cursor + 1] === '"') { cursor += 2; continue; }
        cursor++; closed = true; break;
      }
      if (!closed) fail("Unterminated string literal.");
      tokens.push({ kind: "string", text: source.slice(start, cursor), start, end: cursor });
      continue;
    }
    if (source[cursor] === "[") {
      const end = source.indexOf("]", cursor + 1);
      if (end < 0) fail("Unterminated bracketed identifier.");
      cursor = end + 1;
      tokens.push({ kind: "identifier", text: source.slice(start, cursor), start, end: cursor });
      continue;
    }
    const number = remaining.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][-+]?\d+)?/);
    if (number) { cursor += number[0].length; tokens.push({ kind: "number", text: number[0], start, end: cursor }); continue; }
    const word = remaining.match(/^[A-Za-z_][A-Za-z0-9_.]*/);
    if (word) {
      cursor += word[0].length;
      const upper = word[0].toUpperCase();
      const kind: ExpressionTokenKind = ["AND", "OR", "XOR", "NOT", "MOD", "LIKE"].includes(upper)
        ? "operator" : ["TRUE", "FALSE", "YES", "NO"].includes(upper) ? "boolean" : "identifier";
      tokens.push({ kind, text: word[0], start, end: cursor });
      continue;
    }
    const pair = source.slice(cursor, cursor + 2);
    if (["<=", ">=", "<>"].includes(pair)) { cursor += 2; tokens.push({ kind: "operator", text: pair, start, end: cursor }); continue; }
    const single = source[cursor]!;
    if ("=><&+-*/%^".includes(single)) { cursor++; tokens.push({ kind: "operator", text: single, start, end: cursor }); continue; }
    if (single === "(") { cursor++; tokens.push({ kind: "left", text: single, start, end: cursor }); continue; }
    if (single === ")") { cursor++; tokens.push({ kind: "right", text: single, start, end: cursor }); continue; }
    if (single === ",") { cursor++; tokens.push({ kind: "comma", text: single, start, end: cursor }); continue; }
    fail(`Unexpected character ${JSON.stringify(single)}.`);
  }
  tokens.push({ kind: "eof", text: "", start: source.length, end: source.length });
  return tokens;
}

function parseExpression(source: string, line: SourceLine, sourceColumn: number): ClassicExpression {
  const tokens = tokenizeExpression(source, line, sourceColumn);
  let cursor = 0;
  const current = (): ExpressionToken => tokens[cursor]!;
  const span = (start: number, end: number): ClassicSourceSpan => expressionSpan(line, sourceColumn - 1 + start, sourceColumn - 1 + end);
  const fail = (token: ExpressionToken, message: string): never => {
    throw new ClassicSyntaxError(line.line, sourceColumn + token.start, message);
  };
  const primary = (): ClassicExpression => {
    const token = current();
    if (token.kind === "operator" && ["+", "-", "NOT"].includes(token.text.toUpperCase())) {
      cursor++;
      // Legacy grammar defines NOT over a complete comparison, while unary +/- bind to one primary.
      const argument = token.text.toUpperCase() === "NOT" ? binary(4) : primary();
      return { type: "UnaryExpression", operator: token.text.toUpperCase() as ClassicUnaryExpression["operator"], argument, span: span(token.start, argument.span.end.offset - line.offset - sourceColumn + 1) };
    }
    if (token.kind === "left") {
      cursor++;
      const value = binary(0);
      if (current().kind !== "right") fail(current(), "Expected a closing parenthesis.");
      cursor++;
      return value;
    }
    if (token.kind === "number") {
      cursor++;
      return { type: "Literal", value: Number(token.text), raw: token.text, valueType: "number", span: span(token.start, token.end) };
    }
    if (token.kind === "string") {
      cursor++;
      return { type: "Literal", value: token.text.slice(1, -1).replace(/""/g, '"'), raw: token.text, valueType: "string", span: span(token.start, token.end) };
    }
    if (token.kind === "date") {
      cursor++;
      return { type: "Literal", value: token.text, raw: token.text, valueType: "date", span: span(token.start, token.end) };
    }
    if (token.kind === "boolean") {
      cursor++;
      const upper = token.text.toUpperCase();
      return { type: "Literal", value: upper === "TRUE" || upper === "YES" || upper === "(+)" , raw: token.text, valueType: "boolean", span: span(token.start, token.end) };
    }
    if (token.kind === "missing") {
      cursor++;
      return { type: "Missing", raw: "(.)", span: span(token.start, token.end) };
    }
    if (token.kind === "identifier") {
      cursor++;
      const name = identifierName(token.text);
      if (current().kind !== "left") return { type: "IdentifierExpression", name, span: span(token.start, token.end) };
      cursor++;
      const args: ClassicExpression[] = [];
      if (current().kind !== "right") {
        while (true) {
          args.push(binary(0));
          if (current().kind !== "comma") break;
          cursor++;
        }
      }
      if (current().kind !== "right") fail(current(), "Expected a closing parenthesis after function arguments.");
      const end = current().end;
      cursor++;
      return { type: "CallExpression", callee: name, arguments: args, span: span(token.start, end) };
    }
    return fail(token, "Expected an expression.");
  };
  const binary = (minimum: number): ClassicExpression => {
    let left = primary();
    while (current().kind === "operator") {
      const operator = current().text.toUpperCase();
      const precedence = BINARY_PRECEDENCE[operator];
      if (precedence === undefined || precedence < minimum) break;
      const operatorToken = current();
      cursor++;
      const right = binary(precedence + (operator === "^" ? 0 : 1));
      left = {
        type: "BinaryExpression",
        operator: operator as ClassicBinaryExpression["operator"],
        left,
        right,
        span: { start: left.span.start, end: right.span.end },
      };
      if (operatorToken.kind !== "operator") break;
    }
    return left;
  };
  if (!source.trim()) throw new ClassicSyntaxError(line.line, sourceColumn, "Expected an expression.");
  const result = binary(0);
  if (current().kind !== "eof") fail(current(), `Unexpected token ${JSON.stringify(current().text)}.`);
  return result;
}

function words(source: string): string[] {
  return [...source.matchAll(/\[[^\]]+\]|"(?:[^"]|"")*"|[^\s]+/g)].map((match) => match[0]);
}

const OPTION_NAMES = new Set(["STRATAVAR", "WEIGHTVAR", "OUTTABLE", "PSUVAR", "STATISTICS", "COLUMNSIZE", "NOWRAP", "ONEISYES"]);

function optionStart(token: string): boolean {
  return OPTION_NAMES.has(token.split("=", 1)[0]!.toUpperCase());
}

function optionValue(tokens: string[], index: number, line: SourceLine): { key: string; value: string; next: number } {
  const token = tokens[index]!;
  const equals = token.indexOf("=");
  if (equals >= 0) {
    const value = token.slice(equals + 1);
    if (!value) {
      const next = tokens[index + 1];
      if (!next) throw new ClassicSyntaxError(line.line, 1, `${token.slice(0, equals)} requires a value.`);
      return { key: token.slice(0, equals).toUpperCase(), value: next, next: index + 2 };
    }
    return { key: token.slice(0, equals).toUpperCase(), value, next: index + 1 };
  }
  if (tokens[index + 1] === "=") {
    const value = tokens[index + 2];
    if (!value) throw new ClassicSyntaxError(line.line, 1, `${token} requires a value.`);
    return { key: token.toUpperCase(), value, next: index + 3 };
  }
  throw new ClassicSyntaxError(line.line, 1, `${token} requires '=' and a value.`);
}

function analysisOptions(tokens: string[], start: number, line: SourceLine): ClassicAnalysisOptions {
  const result: ClassicAnalysisOptions = { stratifyBy: [], noWrap: false, oneIsYes: false };
  let cursor = start;
  while (cursor < tokens.length) {
    const standalone = tokens[cursor]!.toUpperCase();
    if (standalone === "NOWRAP" || standalone === "ONEISYES") {
      if (standalone === "NOWRAP") result.noWrap = true;
      else result.oneIsYes = true;
      cursor++;
      continue;
    }
    const parsed = optionValue(tokens, cursor, line);
    cursor = parsed.next;
    if (parsed.key === "STRATAVAR") {
      const values = [parsed.value];
      while (cursor < tokens.length && !optionStart(tokens[cursor]!)) values.push(tokens[cursor++]!);
      result.stratifyBy.push(...values.map((value) => identifier(value, line)));
    } else if (parsed.key === "WEIGHTVAR") result.weightBy = identifier(parsed.value, line);
    else if (parsed.key === "OUTTABLE") result.outputTable = identifier(parsed.value, line);
    else if (parsed.key === "PSUVAR") result.psuVariable = identifier(parsed.value, line);
    else if (parsed.key === "STATISTICS") {
      const value = parsed.value.toUpperCase();
      if (value !== "NONE" && value !== "FISHER") throw new ClassicSyntaxError(line.line, 1, "STATISTICS must be NONE or FISHER in the V0.1 AST.");
      result.statistics = value;
    } else if (parsed.key === "COLUMNSIZE") {
      const size = Number(parsed.value);
      if (!Number.isSafeInteger(size) || size <= 0) throw new ClassicSyntaxError(line.line, 1, "COLUMNSIZE must be a positive integer.");
      result.columnSize = size;
    } else throw new ClassicSyntaxError(line.line, 1, `Unsupported analysis option ${parsed.key}.`);
  }
  return result;
}

function splitCommand(line: SourceLine): { command: string; rest: string; restColumn: number } {
  const match = line.trimmed.match(/^([A-Za-z-]+)(?:\s+(.*))?$/);
  if (!match) throw new ClassicSyntaxError(line.line, 1, "Expected an Epi Info command.");
  const rest = match[2] ?? "";
  return { command: match[1]!.toUpperCase(), rest, restColumn: line.text.indexOf(rest) + 1 };
}

class ProgramParser {
  private cursor = 0;
  private readonly source: string;
  private readonly lines: SourceLine[];

  constructor(source: string, lines: SourceLine[]) {
    this.source = source;
    this.lines = lines;
  }

  parse(): ClassicProgramAst {
    const body = this.block(new Set());
    const finalLine = this.lines.at(-1);
    return {
      type: "Program",
      astVersion: CLASSIC_AST_VERSION,
      source: this.source,
      body,
      span: finalLine ? lineSpan(this.lines[0]!, finalLine) : {
        start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 },
      },
    };
  }

  private block(stops: ReadonlySet<string>): ClassicStatement[] {
    const statements: ClassicStatement[] = [];
    while (this.cursor < this.lines.length) {
      const line = this.lines[this.cursor]!;
      const command = splitCommand(line).command;
      if (stops.has(command)) break;
      if (command === "END" || command === "ELSE") throw new ClassicSyntaxError(line.line, 1, `Unexpected ${command}.`);
      statements.push(this.statement());
    }
    return statements;
  }

  private statement(): ClassicStatement {
    const line = this.lines[this.cursor++]!;
    const { command, rest, restColumn } = splitCommand(line);
    if (command === "READ") return this.read(line, rest);
    if (command === "RELATE") return this.relate(line, rest);
    if (command === "WRITE") return this.write(line, rest);
    if (command === "MERGE") return this.merge(line, rest);
    if (command === "DELETE") return this.deleteFileOrTable(line, rest);
    if (command === "UNDELETE") return this.undeleteRecords(line, rest);
    if (command === "FREQ") return this.frequency(line, rest);
    if (command === "LIST") return this.list(line, rest);
    if (command === "TABLES") return this.tables(line, rest);
    if (command === "MATCH") return this.match(line, rest);
    if (command === "LOGISTIC") return this.logistic(line, rest);
    if (command === "MEANS") return this.means(line, rest);
    if (command === "SUMMARIZE") return this.summarize(line, rest);
    if (command === "GRAPH") return this.graph(line, rest);
    if (command === "HEADER") return this.header(line, rest);
    if (command === "TYPEOUT") return this.typeout(line, rest);
    if (command === "ROUTEOUT") return this.routeout(line, rest);
    if (command === "CLOSEOUT") return this.closeout(line, rest);
    if (command === "PRINTOUT") return this.printout(line, rest);
    if (command === "DIALOG") return this.dialog(line, rest);
    if (command === "BEEP") return this.beep(line, rest);
    if (command === "SET") return this.setOption(line, rest);
    if (command === "EPIAI") return this.epiAi(line, rest);
    if (command === "FILE") return this.file(line, rest);
    if (command === "DEFINE") return this.define(line, rest, restColumn);
    if (command === "ASSIGN") return this.assign(line, rest, restColumn);
    if (command === "UNDEFINE") return this.undefine(line, rest);
    if (command === "DISPLAY") return this.display(line, rest);
    if (command === "SELECT") return this.select(line, rest, restColumn);
    if (command === "CANCEL" && /^SELECT$/i.test(rest.trim())) return { type: "SelectStatement", mode: "cancel", span: lineSpan(line) };
    if (command === "SORT") return this.sort(line, rest);
    if (command === "CANCEL" && /^SORT$/i.test(rest.trim())) return { type: "SortStatement", mode: "cancel", items: [], span: lineSpan(line) };
    if (command === "RECODE") return this.recode(line, rest);
    if (command === "IF") return this.ifStatement(line, rest, restColumn);
    throw new ClassicSyntaxError(line.line, 1, `Unsupported command: ${line.trimmed}`);
  }

  private header(line: SourceLine, rest: string): ClassicHeaderStatement {
    const match = rest.match(/^(\d+)\s+"((?:[^"]|"")*)"$/);
    if (!match) throw new ClassicSyntaxError(line.line, 1, 'This bounded HEADER slice uses HEADER 1 "literal text"; font and style options remain a preserved gap.');
    if (match[1] !== "1") throw new ClassicSyntaxError(line.line, 1, "The reviewed browser slice supports legacy HEADER level 1 only.");
    const text = match[2]!.replace(/""/g, '"');
    if (!text.trim()) throw new ClassicSyntaxError(line.line, 1, "HEADER text cannot be blank.");
    if (text.length > 4000) throw new ClassicSyntaxError(line.line, 1, "HEADER text cannot exceed 4,000 characters.");
    return { type: "HeaderStatement", level: 1, text, span: lineSpan(line) };
  }

  private typeout(line: SourceLine, rest: string): ClassicTypeoutStatement {
    if (/^'/.test(rest.trim())) throw new ClassicSyntaxError(line.line, 1, "TYPEOUT file input requires a reviewed browser file adapter and remains fail-closed.");
    const match = rest.match(/^"((?:[^"]|"")*)"$/);
    if (!match) throw new ClassicSyntaxError(line.line, 1, 'This bounded TYPEOUT slice uses TYPEOUT "literal text"; file, font, and style options remain preserved gaps.');
    const text = match[1]!.replace(/""/g, '"');
    if (!text.trim()) throw new ClassicSyntaxError(line.line, 1, "TYPEOUT text cannot be blank.");
    if (text.length > 4000) throw new ClassicSyntaxError(line.line, 1, "TYPEOUT text cannot exceed 4,000 characters.");
    return { type: "TypeoutStatement", text, span: lineSpan(line) };
  }

  private routeout(line: SourceLine, rest: string): ClassicRouteoutStatement {
    const match = rest.match(/^"((?:[^"]|"")*)"(?:\s+(APPEND|REPLACE))?$/i);
    if (!match) throw new ClassicSyntaxError(line.line, 1, 'ROUTEOUT requires a quoted file and optional APPEND or REPLACE.');
    const fileName = match[1]!.replace(/""/g, '"');
    if (!fileName.trim()) throw new ClassicSyntaxError(line.line, 1, "ROUTEOUT file cannot be blank.");
    return { type: "RouteoutStatement", fileName, mode: (match[2]?.toUpperCase() ?? "APPEND") as "APPEND" | "REPLACE", span: lineSpan(line) };
  }

  private closeout(line: SourceLine, rest: string): ClassicCloseoutStatement {
    if (rest.trim()) throw new ClassicSyntaxError(line.line, 1, "CLOSEOUT does not accept arguments.");
    return { type: "CloseoutStatement", span: lineSpan(line) };
  }

  private printout(line: SourceLine, rest: string): ClassicPrintoutStatement {
    const source = rest.trim();
    if (!source) return { type: "PrintoutStatement", span: lineSpan(line) };
    const match = source.match(/^'((?:[^']|'')*)'$/);
    if (!match) throw new ClassicSyntaxError(line.line, 1, "PRINTOUT accepts no argument or one single-quoted legacy file.");
    const fileName = match[1]!.replace(/''/g, "'");
    if (!fileName.trim()) throw new ClassicSyntaxError(line.line, 1, "PRINTOUT file cannot be blank.");
    return { type: "PrintoutStatement", fileName, span: lineSpan(line) };
  }

  private dialog(line: SourceLine, rest: string): ClassicDialogStatement {
    let body = rest.trim();
    const titleMatch = body.match(/\s+TITLETEXT\s*=\s*"((?:[^"]|"")*)"\s*$/i);
    const title = titleMatch?.[1]?.replace(/""/g, '"');
    if (titleMatch?.index !== undefined) body = body.slice(0, titleMatch.index).trim();
    const promptMatch = body.match(/^"((?:[^"]|"")*)"(?:\s+(.+))?$/);
    if (!promptMatch) throw new ClassicSyntaxError(line.line, 1, 'DIALOG requires a quoted prompt followed by an optional target and legacy input format.');
    const prompt = promptMatch[1]!.replace(/""/g, '"');
    if (!prompt.trim()) throw new ClassicSyntaxError(line.line, 1, "DIALOG prompt cannot be blank.");
    if (prompt.length > 4000) throw new ClassicSyntaxError(line.line, 1, "DIALOG prompt cannot exceed 4,000 characters.");
    if (title !== undefined && !title.trim()) throw new ClassicSyntaxError(line.line, 1, "DIALOG TITLETEXT cannot be blank.");
    if (title !== undefined && title.length > 200) throw new ClassicSyntaxError(line.line, 1, "DIALOG TITLETEXT cannot exceed 200 characters.");
    const tail = promptMatch[2]?.trim();
    if (!tail) return { type: "DialogStatement", prompt, ...(title !== undefined ? { title } : {}), input: { kind: "message" }, span: lineSpan(line) };

    const targetMatch = tail.match(/^(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)(?:\s+(.+))?$/);
    if (!targetMatch) throw new ClassicSyntaxError(line.line, 1, "DIALOG input requires a target variable.");
    const target = identifier(targetMatch[1]!, line);
    const format = targetMatch[2]?.trim();
    if (!format) return { type: "DialogStatement", prompt, ...(title !== undefined ? { title } : {}), target, input: { kind: "numeric", implicit: true }, span: lineSpan(line) };

    const scalar = format.match(/^(TEXTINPUT|NUMERIC|DATEFORMAT|TIMEFORMAT|DATETIMEFORMAT)(?:\s+"((?:[^"]|"")*)")?$/i);
    let input: ClassicDialogInput;
    if (scalar) {
      const modifier = scalar[1]!.toUpperCase();
      const mask = scalar[2]?.replace(/""/g, '"');
      const withMask = mask === undefined ? {} : { mask };
      input = modifier === "TEXTINPUT" ? { kind: "text", ...withMask }
        : modifier === "NUMERIC" ? { kind: "numeric", implicit: false, ...withMask }
        : { kind: modifier === "DATEFORMAT" ? "date" : modifier === "TIMEFORMAT" ? "time" : "datetime", ...withMask };
    } else if (/^YN$/i.test(format)) input = { kind: "yes-no" };
    else if (/^(DBVIEWS|DATABASES|DBVARIABLES)$/i.test(format)) {
      const modifier = format.toUpperCase();
      input = { kind: modifier === "DBVIEWS" ? "db-views" : modifier === "DATABASES" ? "databases" : "db-variables" };
    } else {
      const dbValues = format.match(/^DBVALUES\s+(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)\s+(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)$/i);
      const file = format.match(/^(READ|WRITE)(?:\s+"((?:[^"]|"")*)")?$/i);
      if (dbValues) input = { kind: "db-values", table: identifier(dbValues[1]!, line), variable: identifier(dbValues[2]!, line) };
      else if (file) input = {
        kind: file[1]!.toUpperCase() === "READ" ? "read-file" : "write-file",
        ...(file[2] === undefined ? {} : { filter: file[2].replace(/""/g, '"') }),
      };
      else {
        const values: string[] = [];
        const listPattern = /\s*"((?:[^"]|"")*)"\s*(?:,|$)/gy;
        let cursor = 0;
        while (cursor < format.length) {
          listPattern.lastIndex = cursor;
          const value = listPattern.exec(format);
          if (!value || value.index !== cursor) throw new ClassicSyntaxError(line.line, 1, "DIALOG choice values must be quoted and comma-separated.");
          values.push(value[1]!.replace(/""/g, '"'));
          cursor = listPattern.lastIndex;
        }
        if (!values.length || values.some((value) => !value.trim())) throw new ClassicSyntaxError(line.line, 1, "DIALOG requires one or more nonblank choice values.");
        if (values.length > 500) throw new ClassicSyntaxError(line.line, 1, "DIALOG cannot exceed 500 choice values in the browser.");
        input = { kind: "choices", values };
      }
    }
    return { type: "DialogStatement", prompt, ...(title !== undefined ? { title } : {}), target, input, span: lineSpan(line) };
  }

  private beep(line: SourceLine, rest: string): ClassicBeepStatement {
    if (rest.trim()) throw new ClassicSyntaxError(line.line, 1, "BEEP does not accept arguments.");
    return { type: "BeepStatement", span: lineSpan(line) };
  }

  private epiAi(line: SourceLine, rest: string): EpiAiQualityStatement | EpiAiSpaceTimeClusterStatement | EpiAiClusterRenderStatement | EpiAiRecordLinkStatement {
    const tokens = words(rest);
    if (tokens[0]?.toUpperCase() === "QUALITY") {
      if (tokens.length === 2 && tokens[1] === "*") return { type: "EpiAiQualityStatement", span: lineSpan(line) };
      throw new ClassicSyntaxError(line.line, 1, "This bounded new branch uses EPIAI QUALITY * only.");
    }
    if (tokens[0]?.toUpperCase() === "CLUSTER" && tokens[1]?.toUpperCase() === "RENDER") {
      if (tokens.length !== 3) throw new ClassicSyntaxError(line.line, 1, "EPIAI CLUSTER RENDER requires exactly RESULT=name.");
      const result = optionValue(tokens, 2, line);
      if (result.key !== "RESULT" || result.next !== tokens.length) throw new ClassicSyntaxError(line.line, 1, "EPIAI CLUSTER RENDER requires exactly RESULT=name.");
      return { type: "EpiAiClusterRenderStatement", resultName: identifier(result.value, line), span: lineSpan(line) };
    }
    if (tokens[0]?.toUpperCase() === "RECORDLINK") {
      const settings = new Map<string, string>();
      let cursor = 1;
      while (cursor < tokens.length) {
        const parsed = optionValue(tokens, cursor, line);
        cursor = parsed.next;
        if (settings.has(parsed.key)) throw new ClassicSyntaxError(line.line, 1, `EPIAI RECORDLINK repeats ${parsed.key}.`);
        settings.set(parsed.key, parsed.value);
      }
      const allowed = new Set(["SOURCEA", "SOURCEB", "IDA", "IDB", "TRUTH", "TRUTHA", "TRUTHB", "BLOCK", "EXACT", "FUZZY", "FUZZYTHRESHOLD", "REVIEWTHRESHOLD", "MATCHTHRESHOLD", "MAXCANDIDATES", "RESULT"]);
      for (const key of settings.keys()) if (!allowed.has(key)) throw new ClassicSyntaxError(line.line, 1, `Unsupported EPIAI RECORDLINK option ${key}.`);
      const required = (key: string): string => {
        const value = settings.get(key);
        if (value === undefined) throw new ClassicSyntaxError(line.line, 1, `EPIAI RECORDLINK requires ${key}.`);
        return value;
      };
      const finite = (key: string): number => {
        const value = Number(required(key));
        if (!Number.isFinite(value)) throw new ClassicSyntaxError(line.line, 1, `${key} must be a finite number.`);
        return value;
      };
      const integer = (key: string): number => {
        const value = finite(key);
        if (!Number.isInteger(value)) throw new ClassicSyntaxError(line.line, 1, `${key} must be an integer.`);
        return value;
      };
      const pairs = (key: string): EpiAiRecordLinkFieldPair[] => {
        const rawPairs = required(key).split(",");
        if (!rawPairs.length || rawPairs.some((value) => !value)) throw new ClassicSyntaxError(line.line, 1, `${key} requires one or more sourceA:sourceB field pairs.`);
        return rawPairs.map((raw) => {
          const separator = raw.indexOf(":");
          if (separator <= 0 || separator !== raw.lastIndexOf(":") || separator === raw.length - 1) throw new ClassicSyntaxError(line.line, 1, `${key} entries must use sourceA:sourceB field pairs.`);
          return { sourceA: identifier(raw.slice(0, separator), line), sourceB: identifier(raw.slice(separator + 1), line) };
        });
      };
      const truthValues = [settings.get("TRUTH"), settings.get("TRUTHA"), settings.get("TRUTHB")];
      if (truthValues.some((value) => value !== undefined) && truthValues.some((value) => value === undefined)) {
        throw new ClassicSyntaxError(line.line, 1, "EPIAI RECORDLINK requires TRUTH, TRUTHA, and TRUTHB together.");
      }
      return {
        type: "EpiAiRecordLinkStatement",
        sourceA: identifier(required("SOURCEA"), line), sourceB: identifier(required("SOURCEB"), line),
        idA: identifier(required("IDA"), line), idB: identifier(required("IDB"), line),
        ...(truthValues[0] !== undefined ? {
          truthSource: identifier(truthValues[0], line), truthIdA: identifier(truthValues[1]!, line), truthIdB: identifier(truthValues[2]!, line),
        } : {}),
        blockPairs: pairs("BLOCK"), exactPairs: pairs("EXACT"), fuzzyPairs: pairs("FUZZY"),
        fuzzyThreshold: finite("FUZZYTHRESHOLD"), reviewThreshold: finite("REVIEWTHRESHOLD"),
        matchThreshold: finite("MATCHTHRESHOLD"), maxCandidates: integer("MAXCANDIDATES"),
        resultName: identifier(required("RESULT"), line), span: lineSpan(line),
      };
    }
    if (tokens[0]?.toUpperCase() !== "CLUSTER" || tokens[1]?.toUpperCase() !== "SPACE_TIME") {
      throw new ClassicSyntaxError(line.line, 1, "This new-branch AST slice supports EPIAI QUALITY, EPIAI CLUSTER SPACE_TIME, EPIAI CLUSTER RENDER, and EPIAI RECORDLINK.");
    }
    const settings = new Map<string, string>();
    let cursor = 2;
    while (cursor < tokens.length) {
      const parsed = optionValue(tokens, cursor, line);
      cursor = parsed.next;
      if (settings.has(parsed.key)) throw new ClassicSyntaxError(line.line, 1, `EPIAI CLUSTER SPACE_TIME repeats ${parsed.key}.`);
      settings.set(parsed.key, parsed.value);
    }
    const allowed = new Set(["ID", "DATE", "LATITUDE", "LONGITUDE", "RESULT", "START", "END", "UNIT", "LENGTH", "MAXDISTANCEKM", "MAXCASEFRACTION", "MAXTIMEUNITS", "MAXTIMEFRACTION", "REPLICATIONS", "SEED"]);
    for (const key of settings.keys()) if (!allowed.has(key)) throw new ClassicSyntaxError(line.line, 1, `Unsupported EPIAI CLUSTER SPACE_TIME option ${key}.`);
    const required = (key: string): string => {
      const value = settings.get(key);
      if (value === undefined) throw new ClassicSyntaxError(line.line, 1, `EPIAI CLUSTER SPACE_TIME requires ${key}.`);
      return value;
    };
    const finite = (key: string): number => {
      const raw = required(key);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new ClassicSyntaxError(line.line, 1, `${key} must be a finite number.`);
      return value;
    };
    const integer = (key: string): number => {
      const value = finite(key);
      if (!Number.isInteger(value)) throw new ClassicSyntaxError(line.line, 1, `${key} must be an integer.`);
      return value;
    };
    const date = (key: string): string => {
      const value = required(key);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new ClassicSyntaxError(line.line, 1, `${key} must use YYYY-MM-DD.`);
      return value;
    };
    const timeUnit = required("UNIT").toUpperCase();
    if (!(["DAY", "WEEK", "MONTH"] as const).includes(timeUnit as "DAY" | "WEEK" | "MONTH")) throw new ClassicSyntaxError(line.line, 1, "UNIT must be DAY, WEEK, or MONTH.");
    return {
      type: "EpiAiSpaceTimeClusterStatement",
      idField: identifier(required("ID"), line), dateField: identifier(required("DATE"), line),
      latitudeField: identifier(required("LATITUDE"), line), longitudeField: identifier(required("LONGITUDE"), line),
      resultName: identifier(required("RESULT"), line),
      studyStart: date("START"), studyEnd: date("END"), timeUnit: timeUnit as "DAY" | "WEEK" | "MONTH",
      timeLength: integer("LENGTH"), maxDistanceKm: finite("MAXDISTANCEKM"), maxCaseFraction: finite("MAXCASEFRACTION"),
      maxTimeUnits: integer("MAXTIMEUNITS"), maxTimeFraction: finite("MAXTIMEFRACTION"),
      replications: integer("REPLICATIONS"), seed: integer("SEED"), span: lineSpan(line),
    };
  }

  private setOption(line: SourceLine, rest: string): ClassicSetStatement {
    const setting = rest.trim();
    const missing = setting.match(/^(MISSING|IGNORE)\s*=\s*(ON|OFF|TRUE|FALSE|\(\+\)|\(-\))$/i);
    if (missing) {
      const switchedOn = ["ON", "TRUE", "(+)"].includes(missing[2]!.toUpperCase());
      return { type: "SetStatement", option: "MISSING", enabled: missing[1]!.toUpperCase() === "IGNORE" ? !switchedOn : switchedOn, span: lineSpan(line) };
    }
    const representation = setting.match(/^\(\.\)\s*=\s*"((?:[^"]|"")*)"$/);
    if (representation?.[1]) return { type: "SetStatement", option: "REPRESENTATION_OF_MISSING", value: representation[1].replace(/""/g, '"'), span: lineSpan(line) };
    throw new ClassicSyntaxError(line.line, 1, "This SET slice supports MISSING/IGNORE ON or OFF, and (.)=\"missing label\".");
  }

  private file(line: SourceLine, rest: string): FileConvertStatement {
    const match = rest.match(/^CONVERT\s+"([^"]+)"\s+TO\s+"([^"]+)"$/i);
    if (!match) throw new ClassicSyntaxError(line.line, 1, 'This new-branch slice uses FILE CONVERT "input.mdb" TO "output.sqlite" or "output.duckdb".');
    if (!/\.(?:mdb|accdb)$/i.test(match[1]!)) throw new ClassicSyntaxError(line.line, 1, "FILE CONVERT input must be an .mdb or .accdb file.");
    if (!/\.(?:sqlite|duckdb)$/i.test(match[2]!)) throw new ClassicSyntaxError(line.line, 1, "FILE CONVERT output must be a .sqlite or .duckdb file.");
    return { type: "FileConvertStatement", inputFile: match[1]!, outputFile: match[2]!, span: lineSpan(line) };
  }

  private relate(line: SourceLine, rest: string): ClassicRelateStatement {
    const match = rest.match(/^(\{[^}]+\}:\s*(?:\[[^\]]+\]|\S+)|\[[^\]]+\]|\S+)\s+(.+?)(?:\s+(MATCHING|ALL))?$/i);
    if (!match) throw new ClassicSyntaxError(line.line, 1, "RELATE requires a table, key definition, and optional MATCHING or ALL.");
    const rawTarget = match[1]!.trim();
    const external = rawTarget.match(/^(\{[^}]+\}):\s*(.+)$/);
    const target = external
      ? { kind: "external-table" as const, source: external[1]!.slice(1, -1), table: identifierName(external[2]!), raw: rawTarget }
      : { kind: "current-project-table" as const, table: identifierName(rawTarget), raw: rawTarget };
    const keySource = match[2]!.trim();
    const clauses = keySource.split(/\s+AND\s+/i);
    const keys = clauses.map((clause) => {
      const pair = clause.match(/^(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)\s*::\s*(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)$/);
      if (!pair) throw new ClassicSyntaxError(line.line, 1, "Each RELATE key must use current-field :: related-field.");
      return { current: identifier(pair[1]!, line), related: identifier(pair[2]!, line) };
    });
    return { type: "RelateStatement", target, keys, join: match[3]?.toUpperCase() === "ALL" ? "all" : "matching", span: lineSpan(line) };
  }

  private match(line: SourceLine, rest: string): ClassicMatchStatement {
    const optionPattern = /(?:^|\s)(WEIGHTVAR|MATCHVAR|STATISTICS|PROCESS|BOOLEAN|YN|DELETED|PERCENTS|MISSING|IGNORE|SELECT|FREQGRAPH|HYPERLINKS|SHOWPROMPTS|TABLES|USEBROWSER)\s*=/gi;
    const optionMatches = [...rest.matchAll(optionPattern)];
    const base = rest.slice(0, optionMatches[0]?.index ?? rest.length).trim();
    const baseTokens = words(base);
    let selection: ClassicMatchStatement["selection"];
    if (baseTokens[0] === "*") {
      if (baseTokens[1]?.toUpperCase() === "EXCEPT") {
        if (baseTokens.length < 4) throw new ClassicSyntaxError(line.line, 1, "MATCH * EXCEPT requires excluded row variables followed by one outcome variable.");
        selection = {
          kind: "row-all-except",
          excludedRows: baseTokens.slice(2, -1).map((value) => identifier(value, line)),
          outcome: identifier(baseTokens.at(-1)!, line),
        };
      } else {
        if (baseTokens.length !== 2) throw new ClassicSyntaxError(line.line, 1, "MATCH * requires one outcome variable.");
        selection = { kind: "row-all", outcome: identifier(baseTokens[1]!, line) };
      }
    } else {
      if (baseTokens.length < 2) throw new ClassicSyntaxError(line.line, 1, "MATCH requires row and column selections.");
      const exposure = identifier(baseTokens[0]!, line);
      if (baseTokens[1] === "*") {
        if (baseTokens[2]?.toUpperCase() === "EXCEPT") {
          if (baseTokens.length < 4) throw new ClassicSyntaxError(line.line, 1, "MATCH exposure * EXCEPT requires at least one excluded column variable.");
          selection = { kind: "column-all-except", exposure, excludedColumns: baseTokens.slice(3).map((value) => identifier(value, line)) };
        } else {
          if (baseTokens.length !== 2) throw new ClassicSyntaxError(line.line, 1, "MATCH exposure * does not accept additional row or column variables.");
          selection = { kind: "column-all", exposure };
        }
      } else {
        if (baseTokens.length !== 2) throw new ClassicSyntaxError(line.line, 1, "MATCH row-column requires exactly one exposure and one outcome variable before its options.");
        selection = { kind: "row-column", exposure, outcome: identifier(baseTokens[1]!, line) };
      }
    }
    let weightBy: ClassicIdentifier | undefined;
    let matchBy: ClassicIdentifier[] = [];
    const settings: ClassicMatchStatement["settings"] = [];
    const seen = new Set<string>();
    for (const [index, matchOption] of optionMatches.entries()) {
      const name = matchOption[1]!.toUpperCase();
      if (seen.has(name)) throw new ClassicSyntaxError(line.line, 1, `MATCH option ${name} may appear only once.`);
      seen.add(name);
      const start = matchOption.index! + matchOption[0].length;
      const end = optionMatches[index + 1]?.index ?? rest.length;
      const value = rest.slice(start, end).trim();
      if (!value) throw new ClassicSyntaxError(line.line, 1, `MATCH option ${name} requires a value.`);
      if (name === "WEIGHTVAR") {
        const values = words(value);
        if (values.length !== 1) throw new ClassicSyntaxError(line.line, 1, "MATCH WEIGHTVAR requires exactly one variable.");
        weightBy = identifier(values[0]!, line);
      } else if (name === "MATCHVAR") {
        matchBy = words(value).map((item) => identifier(item, line));
        if (!matchBy.length) throw new ClassicSyntaxError(line.line, 1, "MATCH MATCHVAR requires one or more variables.");
      } else {
        if (name === "STATISTICS" && value.toUpperCase() !== "NONE") throw new ClassicSyntaxError(line.line, 1, "The legacy MATCH STATISTICS option accepts NONE only.");
        settings.push({ name, value });
      }
    }
    return { type: "MatchStatement", selection, ...(weightBy ? { weightBy } : {}), matchBy, settings, span: lineSpan(line) };
  }

  private logistic(line: SourceLine, rest: string): ClassicLogisticStatement {
    const assignment = rest.match(/^(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)\s*=\s*(.+)$/);
    if (!assignment) throw new ClassicSyntaxError(line.line, 1, "LOGISTIC requires LOGISTIC <outcome> = <term list> followed by optional settings.");
    const outcome = identifier(assignment[1]!, line);
    const right = assignment[2]!.trim();
    const optionPattern = /(?:^|\s)(TITLETEXT|WEIGHTVAR|LINKFUNCTION|MATCHVAR|PVALUE|OUTTABLE)\s*=\s*|(?:^|\s)(NOINTERCEPT)(?=\s|$)/gi;
    const optionMatches = [...right.matchAll(optionPattern)];
    const termSource = right.slice(0, optionMatches[0]?.index ?? right.length).trim();
    const termTokens = words(termSource);
    if (!termTokens.length) throw new ClassicSyntaxError(line.line, 1, "LOGISTIC requires at least one independent-variable term.");
    const terms: ClassicLogisticTerm[] = termTokens.map((termToken) => {
      const factorTokens = termToken.split("*");
      if (factorTokens.some((factor) => !factor.trim())) throw new ClassicSyntaxError(line.line, 1, `Invalid LOGISTIC interaction term ${JSON.stringify(termToken)}.`);
      return {
        factors: factorTokens.map((factorToken) => {
          const categorical = factorToken.startsWith("(") && factorToken.endsWith(")");
          const raw = categorical ? factorToken.slice(1, -1) : factorToken;
          return { field: identifier(raw, line), categorical };
        }),
      };
    });
    let matchBy: ClassicIdentifier | undefined;
    let weightBy: ClassicIdentifier | undefined;
    let title: string | undefined;
    let confidenceLevel: number | undefined;
    let outputTable: ClassicIdentifier | undefined;
    let linkFunction: "LOG" | undefined;
    let noIntercept = false;
    const seen = new Set<string>();
    for (const [index, optionMatch] of optionMatches.entries()) {
      const name = (optionMatch[1] ?? optionMatch[2])!.toUpperCase();
      if (seen.has(name)) throw new ClassicSyntaxError(line.line, 1, `LOGISTIC option ${name} may appear only once.`);
      seen.add(name);
      if (name === "NOINTERCEPT") { noIntercept = true; continue; }
      const start = optionMatch.index! + optionMatch[0].length;
      const end = optionMatches[index + 1]?.index ?? right.length;
      const value = right.slice(start, end).trim();
      if (!value) throw new ClassicSyntaxError(line.line, 1, `LOGISTIC option ${name} requires a value.`);
      if (name === "MATCHVAR") matchBy = identifier(value, line);
      else if (name === "WEIGHTVAR") weightBy = identifier(value, line);
      else if (name === "OUTTABLE") {
        const values = words(value);
        if (values.length !== 1) throw new ClassicSyntaxError(line.line, 1, "LOGISTIC OUTTABLE requires exactly one table name.");
        outputTable = identifier(values[0]!, line);
      }
      else if (name === "TITLETEXT") {
        const quoted = value.match(/^"((?:[^"]|"")*)"$/);
        if (!quoted) throw new ClassicSyntaxError(line.line, 1, "LOGISTIC TITLETEXT requires one quoted string.");
        title = quoted[1]!.replace(/""/g, '"');
      } else if (name === "PVALUE") {
        const normalized = value.endsWith("%") ? Number(value.slice(0, -1)) / 100 : Number(value);
        if (!(normalized > 0 && normalized < 1)) throw new ClassicSyntaxError(line.line, 1, "LOGISTIC PVALUE must be a confidence proportion or percentage between zero and one hundred.");
        confidenceLevel = normalized;
      } else if (name === "LINKFUNCTION") {
        if (value.toUpperCase() !== "LOG") throw new ClassicSyntaxError(line.line, 1, "The retained LOGISTIC LINKFUNCTION option accepts LOG only.");
        linkFunction = "LOG";
      }
    }
    return {
      type: "LogisticStatement", outcome, terms, ...(matchBy ? { matchBy } : {}), ...(weightBy ? { weightBy } : {}),
      ...(title !== undefined ? { title } : {}), ...(confidenceLevel !== undefined ? { confidenceLevel } : {}),
      ...(outputTable ? { outputTable } : {}), ...(linkFunction ? { linkFunction } : {}), noIntercept, span: lineSpan(line),
    };
  }

  private write(line: SourceLine, rest: string): ClassicWriteStatement {
    const match = rest.match(/^(APPEND|REPLACE)\s+"(Epi7|Epi2000|Epi 2000|Excel 8\.0|Text)"\s+(\{[^}]+\}(?:\s*:\s*(?:\[[^\]]+\]|\S+))?|\S+)\s+(.+)$/i);
    if (!match) throw new ClassicSyntaxError(line.line, 1, "WRITE requires APPEND or REPLACE, a legacy output format, a destination, and variables or '*'.");
    const rawTarget = match[3]!.trim();
    const targetMatch = rawTarget.match(/^\{([^}]+)\}(?:\s*:\s*(.+))?$/);
    const target = targetMatch
      ? { source: targetMatch[1]!, ...(targetMatch[2] ? { table: identifierName(targetMatch[2]) } : {}), raw: rawTarget }
      : { source: identifierName(rawTarget), raw: rawTarget };
    const tokens = words(match[4]!);
    let selection: ClassicWriteStatement["selection"];
    if (tokens[0] === "*") {
      if (tokens.length === 1) selection = { kind: "all" };
      else if (tokens[1]?.toUpperCase() === "EXCEPT" && tokens.length > 2) selection = { kind: "all-except", fields: tokens.slice(2).map((value) => identifier(value, line)) };
      else throw new ClassicSyntaxError(line.line, 1, "WRITE '*' accepts only an optional EXCEPT variable list.");
    } else {
      if (!tokens.length) throw new ClassicSyntaxError(line.line, 1, "WRITE requires one or more variables or '*'.");
      selection = { kind: "fields", fields: tokens.map((value) => identifier(value, line)) };
    }
    const format = match[2]!.toLocaleLowerCase("en-US") === "text" ? "Text"
      : match[2]!.toLocaleLowerCase("en-US") === "epi7" ? "Epi7"
      : match[2]!.toLocaleLowerCase("en-US") === "epi2000" ? "Epi2000"
      : match[2]!.toLocaleLowerCase("en-US") === "epi 2000" ? "Epi 2000" : "Excel 8.0";
    return { type: "WriteStatement", mode: match[1]!.toUpperCase() as "APPEND" | "REPLACE", format, target, selection, span: lineSpan(line) };
  }

  private merge(line: SourceLine, rest: string): ClassicMergeStatement {
    const match = rest.match(/^(\{[^}]+\}:\s*(?:\[[^\]]+\]|\S+)|\[[^\]]+\]|\S+)\s+(.+?)(?:\s+(APPEND|UPDATE|RELATE))?$/i);
    if (!match) throw new ClassicSyntaxError(line.line, 1, "MERGE requires a source table, one or more destination :: source keys, and an optional legacy mode.");
    const rawTarget = match[1]!.trim();
    const external = rawTarget.match(/^(\{[^}]+\}):\s*(.+)$/);
    const target = external
      ? { kind: "external-table" as const, source: external[1]!.slice(1, -1), table: identifierName(external[2]!), raw: rawTarget }
      : { kind: "current-project-table" as const, table: identifierName(rawTarget), raw: rawTarget };
    const clauses = match[2]!.trim().split(/\s+AND\s+/i);
    const keys = clauses.map((clause) => {
      const pair = clause.match(/^(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)\s*::\s*(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)$/);
      if (!pair) throw new ClassicSyntaxError(line.line, 1, "Each MERGE key must use destination-field :: source-field.");
      return { current: identifier(pair[1]!, line), source: identifier(pair[2]!, line) };
    });
    return {
      type: "MergeStatement", target, keys,
      mode: (match[3]?.toUpperCase() ?? "default") as ClassicMergeStatement["mode"], span: lineSpan(line),
    };
  }

  private deleteFileOrTable(line: SourceLine, rest: string): ClassicDeleteStatement {
    let body = rest.trim();
    const options = new Set<string>();
    while (true) {
      const option = body.match(/\s+(PERMANENT|SAVEDATA|RUNSILENT)\s*$/i);
      if (!option) break;
      options.add(option[1]!.toUpperCase());
      body = body.slice(0, option.index).trim();
    }
    const permanent = options.has("PERMANENT");
    const runSilent = options.has("RUNSILENT");
    const saveData = options.has("SAVEDATA");
    const withoutOptions = words(body);
    if (!withoutOptions.length) throw new ClassicSyntaxError(line.line, 1, "DELETE requires a record expression, file, or TABLES target.");
    if (withoutOptions[0]!.toUpperCase() !== "TABLES") {
      const raw = withoutOptions.join(" ");
      const file = raw.match(/^\{([^}]+)\}$/);
      if (file) return { type: "DeleteStatement", target: { kind: "external-file", source: file[1]!, raw }, permanent, runSilent, saveData, span: lineSpan(line) };
      if (raw === "*") return { type: "DeleteStatement", target: { kind: "records", selection: "all", raw }, permanent, runSilent, saveData, span: lineSpan(line) };
      const expressionRaw = raw.startsWith("(") && raw.endsWith(")") ? raw.slice(1, -1).trim() : raw;
      if (!expressionRaw) throw new ClassicSyntaxError(line.line, 1, "DELETE record criteria cannot be empty.");
      return {
        type: "DeleteStatement", target: { kind: "records", selection: parseExpression(expressionRaw, line, line.text.indexOf(expressionRaw) + 1), raw },
        permanent, runSilent, saveData, span: lineSpan(line),
      };
    }
    const raw = withoutOptions.slice(1).join(" ").trim();
    if (!raw) throw new ClassicSyntaxError(line.line, 1, "DELETE TABLES requires a table or data source.");
    const externalLong = raw.match(/^\{([^}]+)\}\s*:\s*(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)$/);
    if (externalLong) return {
      type: "DeleteStatement",
      target: { kind: "external-table", source: externalLong[1]!, table: identifierName(externalLong[2]!), raw },
      permanent, runSilent, saveData, span: lineSpan(line),
    };
    const externalShort = raw.match(/^\{([^}]+)\}$/);
    if (externalShort) return {
      type: "DeleteStatement", target: { kind: "external-table", source: externalShort[1]!, raw },
      permanent, runSilent, saveData, span: lineSpan(line),
    };
    if (!/^\[[^\]]+\]$/.test(raw)) identifier(raw, line);
    return {
      type: "DeleteStatement", target: { kind: "current-project-table", table: identifierName(raw), raw },
      permanent, runSilent, saveData, span: lineSpan(line),
    };
  }

  private undeleteRecords(line: SourceLine, rest: string): ClassicUndeleteStatement {
    let body = rest.trim();
    const option = body.match(/\s+RUNSILENT\s*$/i);
    const runSilent = Boolean(option);
    if (option) body = body.slice(0, option.index).trim();
    if (!body) throw new ClassicSyntaxError(line.line, 1, "UNDELETE requires a record expression or '*'.");
    if (body === "*") return { type: "UndeleteStatement", selection: "all", raw: body, runSilent, span: lineSpan(line) };
    const expressionRaw = body.startsWith("(") && body.endsWith(")") ? body.slice(1, -1).trim() : body;
    if (!expressionRaw) throw new ClassicSyntaxError(line.line, 1, "UNDELETE record criteria cannot be empty.");
    return {
      type: "UndeleteStatement", selection: parseExpression(expressionRaw, line, line.text.indexOf(expressionRaw) + 1),
      raw: body, runSilent, span: lineSpan(line),
    };
  }

  private summarize(line: SourceLine, rest: string): ClassicSummarizeStatement {
    const match = rest.match(/^(.+?)\s+TO\s+(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)(.*)$/i);
    if (!match) throw new ClassicSyntaxError(line.line, 1, "SUMMARIZE requires aggregate expressions followed by TO and an output table name.");
    const aggregateSource = match[1]!.trim();
    const aggregatePattern = /(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)\s*::\s*(AVG|COUNT|FIRST|LAST|MAX|MIN|STDEV|STDEVP|SUM|VAR|VARP)\s*\(\s*(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)?\s*\)/gi;
    const aggregates: ClassicSummarizeStatement["aggregates"] = [];
    let consumed = "";
    for (const aggregate of aggregateSource.matchAll(aggregatePattern)) {
      consumed += aggregate[0];
      aggregates.push({
        target: identifier(aggregate[1]!, line), aggregate: aggregate[2]!.toUpperCase() as ClassicAggregateFunction,
        ...(aggregate[3] ? { field: identifier(aggregate[3], line) } : {}),
      });
    }
    const normalizedExpected = aggregateSource.replace(/[\s,]+/g, "").toLocaleLowerCase("en-US");
    const normalizedConsumed = consumed.replace(/[\s,]+/g, "").toLocaleLowerCase("en-US");
    if (!aggregates.length || normalizedExpected !== normalizedConsumed) throw new ClassicSyntaxError(line.line, 1, "Each SUMMARIZE aggregate must use result :: FUNCTION(field), or result :: COUNT().");
    const options = match[3]!.trim();
    const weight = options.match(/(?:^|\s)WEIGHTVAR\s*=\s*(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)/i);
    const strata = options.match(/(?:^|\s)STRATAVAR\s*=\s*(.+?)(?=\s+WEIGHTVAR\s*=|$)/i);
    const stripped = options.replace(/(?:^|\s)WEIGHTVAR\s*=\s*(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)/ig, "").replace(/(?:^|\s)STRATAVAR\s*=\s*(.+?)(?=\s+WEIGHTVAR\s*=|$)/ig, "").trim();
    if (stripped) throw new ClassicSyntaxError(line.line, 1, `Unsupported SUMMARIZE option: ${stripped}.`);
    return {
      type: "SummarizeStatement", aggregates, outputTable: identifier(match[2]!, line),
      stratifyBy: strata ? words(strata[1]!).map((name) => identifier(name, line)) : [],
      ...(weight ? { weightBy: identifier(weight[1]!, line) } : {}), span: lineSpan(line),
    };
  }

  private graph(line: SourceLine, rest: string): ClassicGraphStatement {
    const fieldMatch = rest.match(/^(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)(?:\s+|$)(.*)$/);
    if (!fieldMatch) throw new ClassicSyntaxError(line.line, 1, "GRAPH requires at least one graph variable.");
    const optionsSource = fieldMatch[2]!.trim();
    const options = new Map<string, string>();
    const optionPattern = /(GRAPHTYPE|TITLETEXT|XTITLE|YTITLE)\s*=\s*"((?:[^"]|"")*)"/gi;
    let consumed = "";
    for (const option of optionsSource.matchAll(optionPattern)) {
      const key = option[1]!.toUpperCase();
      if (options.has(key)) throw new ClassicSyntaxError(line.line, 1, `GRAPH option ${key} may appear only once.`);
      options.set(key, option[2]!.replace(/""/g, '"'));
      consumed += option[0];
    }
    if (optionsSource.replace(/\s+/g, "").toLocaleLowerCase("en-US") !== consumed.replace(/\s+/g, "").toLocaleLowerCase("en-US")) {
      throw new ClassicSyntaxError(line.line, 1, "This GRAPH AST slice supports one variable plus quoted GRAPHTYPE, TITLETEXT, XTITLE, and YTITLE options.");
    }
    const graphType = options.get("GRAPHTYPE") ?? "Bar";
    return {
      type: "GraphStatement", field: identifier(fieldMatch[1]!, line), graphType,
      ...(options.has("TITLETEXT") ? { title: options.get("TITLETEXT")! } : {}),
      ...(options.has("XTITLE") ? { xTitle: options.get("XTITLE")! } : {}),
      ...(options.has("YTITLE") ? { yTitle: options.get("YTITLE")! } : {}),
      span: lineSpan(line),
    };
  }

  private read(line: SourceLine, rest: string): ClassicReadStatement {
    if (!rest.trim()) throw new ClassicSyntaxError(line.line, line.text.length + 1, "READ requires a table or data source.");
    const raw = rest.trim();
    const external = raw.match(/^(\{[^}]+\})\s*:\s*(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_]*)$/);
    const target = external
      ? { kind: "external-table" as const, source: external[1]!, table: identifierName(external[2]!), raw }
      : { kind: "current-project-table" as const, table: identifierName(raw), raw };
    if (target.kind === "current-project-table" && !/^\[[^\]]+\]$/.test(raw)) identifier(target.table, line);
    return { type: "ReadStatement", target, span: lineSpan(line) };
  }

  private undefine(line: SourceLine, rest: string): ClassicUndefineStatement {
    const tokens = words(rest);
    if (tokens.length === 1 && tokens[0] === "*") return { type: "UndefineStatement", mode: "all-standard", span: lineSpan(line) };
    if (tokens.length === 2 && tokens[0] === "*" && tokens[1]!.toUpperCase() === "GLOBAL") {
      return { type: "UndefineStatement", mode: "all-global", span: lineSpan(line) };
    }
    if (tokens.length !== 1) throw new ClassicSyntaxError(line.line, 1, "UNDEFINE requires one variable, '*', or '* GLOBAL'.");
    return { type: "UndefineStatement", mode: "one", variable: identifier(tokens[0]!, line), span: lineSpan(line) };
  }

  private display(line: SourceLine, rest: string): ClassicDisplayStatement {
    const tokens = words(rest);
    if (tokens[0]?.toUpperCase() !== "DBVARIABLES") {
      throw new ClassicSyntaxError(line.line, 1, "This AST slice supports DISPLAY DBVARIABLES only; DBVIEWS and TABLES remain preserved gaps.");
    }
    const options = tokens.slice(1);
    if (options.some((token) => /^OUTTABLE(?:=|$)/i.test(token))) {
      throw new ClassicSyntaxError(line.line, 1, "DISPLAY OUTTABLE requires a reviewed browser storage adapter.");
    }
    if (!options.length) return { type: "DisplayStatement", displayType: "DBVARIABLES", mode: "all", variables: [], span: lineSpan(line) };
    if (options.length === 1 && options[0]!.toUpperCase() === "DEFINE") {
      return { type: "DisplayStatement", displayType: "DBVARIABLES", mode: "defined", variables: [], span: lineSpan(line) };
    }
    if (options.length === 1 && options[0]!.toUpperCase() === "FIELDVAR") {
      return { type: "DisplayStatement", displayType: "DBVARIABLES", mode: "fields", variables: [], span: lineSpan(line) };
    }
    const list = options[0]!.toUpperCase() === "LIST" ? options.slice(1) : options;
    if (!list.length) throw new ClassicSyntaxError(line.line, 1, "DISPLAY DBVARIABLES LIST requires at least one variable.");
    return { type: "DisplayStatement", displayType: "DBVARIABLES", mode: "list", variables: list.map((value) => identifier(value, line)), span: lineSpan(line) };
  }

  private frequency(line: SourceLine, rest: string): ClassicFrequencyStatement {
    const tokens = words(rest);
    if (!tokens.length) throw new ClassicSyntaxError(line.line, line.text.length + 1, "FREQ requires one or more variables or '*'.");
    const optionIndex = tokens.findIndex(optionStart);
    const selectionTokens = tokens.slice(0, optionIndex < 0 ? tokens.length : optionIndex);
    const options = analysisOptions(tokens, optionIndex < 0 ? tokens.length : optionIndex, line);
    let selection: ClassicFrequencyStatement["selection"];
    if (selectionTokens[0] === "*") {
      if (selectionTokens.length === 1) selection = { kind: "all" };
      else if (selectionTokens[1]?.toUpperCase() === "EXCEPT" && selectionTokens.length > 2) {
        selection = { kind: "all-except", fields: selectionTokens.slice(2).map((value) => identifier(value, line)) };
      } else throw new ClassicSyntaxError(line.line, 1, "FREQ '*' accepts only an optional EXCEPT variable list.");
    } else selection = { kind: "fields", fields: selectionTokens.map((value) => identifier(value, line)) };
    if (selection.kind === "fields" && selection.fields.length === 0) throw new ClassicSyntaxError(line.line, 1, "FREQ requires a variable.");
    return { type: "FrequencyStatement", selection, options, span: lineSpan(line) };
  }

  private list(line: SourceLine, rest: string): ClassicListStatement {
    const tokens = words(rest);
    if (!tokens.length) throw new ClassicSyntaxError(line.line, line.text.length + 1, "LIST requires one or more variables or '*'.");
    let selection: ClassicListStatement["selection"];
    if (tokens[0] === "*") {
      if (tokens.length === 1) selection = { kind: "all" };
      else if (tokens[1]?.toUpperCase() === "EXCEPT" && tokens.length > 2) selection = { kind: "all-except", fields: tokens.slice(2).map((value) => identifier(value, line)) };
      else throw new ClassicSyntaxError(line.line, 1, "LIST '*' accepts only an optional EXCEPT variable list.");
    } else selection = { kind: "fields", fields: tokens.map((value) => identifier(value, line)) };
    return { type: "ListStatement", selection, span: lineSpan(line) };
  }

  private tables(line: SourceLine, rest: string): ClassicTablesStatement {
    const tokens = words(rest);
    const optionIndex = tokens.findIndex(optionStart);
    const variables = tokens.slice(0, optionIndex < 0 ? tokens.length : optionIndex);
    if (variables.length < 1 || variables.length > 2) throw new ClassicSyntaxError(line.line, 1, "TABLES requires an exposure and an optional outcome variable.");
    const exposure = variables[0] === "*" ? "*" : identifier(variables[0]!, line);
    const outcome = variables[1] ? identifier(variables[1], line) : undefined;
    return {
      type: "TablesStatement", exposure,
      ...(outcome ? { outcome } : {}),
      options: analysisOptions(tokens, optionIndex < 0 ? tokens.length : optionIndex, line),
      span: lineSpan(line),
    };
  }

  private means(line: SourceLine, rest: string): ClassicMeansStatement {
    const tokens = words(rest);
    const optionIndex = tokens.findIndex(optionStart);
    const variables = tokens.slice(0, optionIndex < 0 ? tokens.length : optionIndex);
    if (variables.length < 1 || variables.length > 2) throw new ClassicSyntaxError(line.line, 1, "MEANS requires one numeric variable and an optional cross-tabulation variable.");
    return { type: "MeansStatement", field: identifier(variables[0]!, line), ...(variables[1] ? { crossTab: identifier(variables[1], line) } : {}), options: analysisOptions(tokens, optionIndex < 0 ? tokens.length : optionIndex, line), span: lineSpan(line) };
  }

  private define(line: SourceLine, rest: string, restColumn: number): ClassicDefineStatement | ClassicDefineGroupStatement {
    const group = rest.match(/^(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)\s+GROUPVAR\s+(.+)$/i);
    if (group) {
      const members = words(group[2]!).map((value) => identifier(value, line));
      if (!members.length) throw new ClassicSyntaxError(line.line, restColumn, "DEFINE GROUPVAR requires at least one member variable.");
      return { type: "DefineGroupStatement", group: identifier(group[1]!, line), members, span: lineSpan(line) };
    }
    const initializer = rest.match(/^(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)\s*=\s*(.+)$/);
    if (initializer) return {
      type: "DefineStatement", variable: identifier(initializer[1]!, line), scope: "STANDARD",
      initializer: parseExpression(initializer[2]!, line, line.text.indexOf(initializer[2]!) + 1), span: lineSpan(line),
    };
    const match = rest.match(/^(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)(?:\s+(STANDARD|GLOBAL|PERMANENT))?(?:\s+(NUMERIC|TEXTINPUT|YN|DATEFORMAT|DATETIMEFORMAT|TIMEFORMAT))?(?:\s+(.*))?$/i);
    if (!match || !match[3]) throw new ClassicSyntaxError(line.line, restColumn, "DEFINE requires a variable and type, or a variable initializer.");
    const promptRaw = match[4]?.trim();
    let prompt: string | undefined;
    if (promptRaw) {
      const promptMatch = promptRaw.match(/^(?:\(\s*)?"((?:[^"]|"")*)"(?:\s*\))?$/);
      if (!promptMatch) throw new ClassicSyntaxError(line.line, line.text.indexOf(promptRaw) + 1, "DEFINE prompt must be a quoted string.");
      prompt = promptMatch[1]!.replace(/""/g, '"');
    }
    return {
      type: "DefineStatement", variable: identifier(match[1]!, line), scope: (match[2]?.toUpperCase() ?? "STANDARD") as ClassicVariableScope,
      variableType: match[3].toUpperCase() as ClassicVariableType, ...(prompt === undefined ? {} : { prompt }), span: lineSpan(line),
    };
  }

  private assign(line: SourceLine, rest: string, restColumn: number): ClassicAssignStatement {
    const match = rest.match(/^(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)\s*=\s*(.+)$/);
    if (!match) throw new ClassicSyntaxError(line.line, restColumn, "ASSIGN requires <variable> = <expression>.");
    return {
      type: "AssignStatement", target: identifier(match[1]!, line),
      value: parseExpression(match[2]!, line, line.text.indexOf(match[2]!) + 1), span: lineSpan(line),
    };
  }

  private select(line: SourceLine, rest: string, restColumn: number): ClassicSelectStatement {
    if (!rest.trim()) return { type: "SelectStatement", mode: "clear", span: lineSpan(line) };
    return { type: "SelectStatement", mode: "apply", expression: parseExpression(rest, line, restColumn), span: lineSpan(line) };
  }

  private sort(line: SourceLine, rest: string): ClassicSortStatement {
    const tokens = words(rest);
    if (!tokens.length) return { type: "SortStatement", mode: "clear", items: [], span: lineSpan(line) };
    const items: ClassicSortStatement["items"] = [];
    let cursor = 0;
    while (cursor < tokens.length) {
      const field = identifier(tokens[cursor++]!, line);
      const option = tokens[cursor]?.toUpperCase();
      const direction = option === "DESC" || option === "DESCENDING" ? "DESC" : "ASC";
      if (["ASC", "ASCENDING", "DESC", "DESCENDING"].includes(option ?? "")) cursor++;
      items.push({ field, direction });
    }
    return { type: "SortStatement", mode: "apply", items, span: lineSpan(line) };
  }

  private recode(line: SourceLine, rest: string): ClassicRecodeStatement {
    const match = rest.match(/^(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)\s+TO\s+(\[[^\]]+\]|[A-Za-z_][A-Za-z0-9_.]*)$/i);
    if (!match) throw new ClassicSyntaxError(line.line, 1, "RECODE requires <source> TO <target>.");
    const clauses: ClassicRecodeClause[] = [];
    let endLine: SourceLine | undefined;
    while (this.cursor < this.lines.length) {
      const clauseLine = this.lines[this.cursor++]!;
      if (/^END$/i.test(clauseLine.trimmed)) { endLine = clauseLine; break; }
      const equals = clauseLine.trimmed.indexOf("=");
      if (equals < 0) throw new ClassicSyntaxError(clauseLine.line, 1, "RECODE clause requires '='.");
      const left = clauseLine.trimmed.slice(0, equals).trim();
      const right = clauseLine.trimmed.slice(equals + 1).trim();
      const result = parseExpression(right, clauseLine, clauseLine.text.indexOf(right) + 1);
      if (/^ELSE$/i.test(left)) clauses.push({ type: "RecodeElseClause", result, span: lineSpan(clauseLine) });
      else {
        const range = left.match(/^(.+?)\s+-\s+(.+)$/);
        const fromRaw = range?.[1] ?? left;
        const toRaw = range?.[2];
        const from = parseExpression(fromRaw, clauseLine, clauseLine.text.indexOf(fromRaw) + 1);
        const to = toRaw ? parseExpression(toRaw, clauseLine, clauseLine.text.indexOf(toRaw) + 1) : undefined;
        clauses.push({ type: "RecodeValueClause", from, ...(to ? { to } : {}), result, span: lineSpan(clauseLine) });
      }
    }
    if (!endLine) throw new ClassicSyntaxError(line.line, 1, "RECODE is missing END.");
    if (!clauses.length) throw new ClassicSyntaxError(line.line, 1, "RECODE requires at least one clause.");
    return { type: "RecodeStatement", source: identifier(match[1]!, line), target: identifier(match[2]!, line), clauses, span: lineSpan(line, endLine) };
  }

  private ifStatement(line: SourceLine, rest: string, restColumn: number): ClassicIfStatement {
    const match = rest.match(/^(.+)\s+THEN$/i);
    if (!match) throw new ClassicSyntaxError(line.line, restColumn, "IF requires <expression> THEN.");
    const testText = match[1]!;
    const consequent = this.block(new Set(["ELSE", "END"]));
    let alternate: ClassicStatement[] = [];
    if (this.cursor < this.lines.length && splitCommand(this.lines[this.cursor]!).command === "ELSE") {
      this.cursor++;
      alternate = this.block(new Set(["END"]));
    }
    const endLine = this.lines[this.cursor];
    if (!endLine || splitCommand(endLine).command !== "END") throw new ClassicSyntaxError(line.line, 1, "IF is missing END.");
    this.cursor++;
    return {
      type: "IfStatement", test: parseExpression(testText, line, line.text.indexOf(testText) + 1),
      consequent, alternate, span: lineSpan(line, endLine),
    };
  }
}

export function parseClassicProgram(source: string): ClassicProgramAst {
  const normalized = source.replace(/\r\n?/g, "\n");
  const rawLines = normalized.split("\n");
  let offset = 0;
  const lines: SourceLine[] = [];
  for (const [index, text] of rawLines.entries()) {
    const trimmed = text.trim();
    if (trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("***")) {
      lines.push({ text, trimmed, line: index + 1, offset });
    }
    offset += text.length + 1;
  }
  if (!lines.length) throw new ClassicSyntaxError(1, 1, "Enter an Epi Info program.");
  return new ProgramParser(normalized, lines).parse();
}
