import type { RecordValue, FormSchema } from "../contracts/core.js";
import type { FieldCheckCode, SafeCheckCodeStatement, SafeFieldAction } from "../contracts/check-code.js";

export const CHECK_CODE_AST_SCHEMA = "epi-check-code-ast/0.1" as const;

export type CheckCodeScope = "form" | "record" | "page" | "field";
export type CheckCodeEvent = "before" | "after" | "click";

export interface CheckCodeOperand {
  kind: "literal" | "reference";
  value: RecordValue | string;
}

export interface CheckCodeComparison {
  left: string;
  operator: "equals" | "not-equals";
  right: CheckCodeOperand;
}

export type CheckCodeStatement =
  | { kind: "goto"; target: string; line: number }
  | { kind: "field-action"; action: SafeFieldAction; targets: string[]; line: number }
  | { kind: "geocode"; addressField: string; latitudeField: string; longitudeField: string; line: number }
  | { kind: "assign"; target: string; value: CheckCodeOperand; line: number }
  | { kind: "clear"; targets: string[]; line: number }
  | { kind: "dialog"; message: string; line: number }
  | { kind: "if"; condition: CheckCodeComparison; then: CheckCodeStatement[]; otherwise: CheckCodeStatement[]; line: number };

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
  blocks: CheckCodeBlock[];
}

export interface CheckCodeCompileResult {
  executable: boolean;
  ast: CheckCodeProgramAst;
  fieldCheckCode: ReadonlyMap<string, FieldCheckCode>;
  reasons: string[];
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

function identifiers(source: string, line: number): string[] {
  const values = source.split(/[\s,]+/).filter(Boolean).map((value) => value === "*" ? value : identifier(value, line));
  if (values.length === 0) throw new CheckCodeParseError(line, "Expected at least one field identifier.");
  return values;
}

function operand(source: string, line: number): CheckCodeOperand {
  const token = source.trim();
  const quoted = token.match(/^(["'])(.*)\1$/);
  if (quoted) return { kind: "literal", value: quoted[2] ?? "" };
  if (/^(?:TRUE|YES)$/i.test(token)) return { kind: "literal", value: true };
  if (/^(?:FALSE|NO)$/i.test(token)) return { kind: "literal", value: false };
  if (/^(?:NULL|\(\.\))$/i.test(token)) return { kind: "literal", value: null };
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) return { kind: "literal", value: Number(token) };
  return { kind: "reference", value: identifier(token, line) };
}

function comparison(source: string, line: number): CheckCodeComparison {
  const match = source.match(/^(.+?)\s*(<>|!=|=)\s*(.+)$/);
  if (!match) throw new CheckCodeParseError(line, "The bounded IF condition must compare a field or variable with =, <>, or !=.");
  return {
    left: identifier(match[1] ?? "", line),
    operator: match[2] === "=" ? "equals" : "not-equals",
    right: operand(match[3] ?? "", line),
  };
}

function parseStatements(lines: readonly SourceLine[], cursor: Cursor, endTokens: ReadonlySet<string>, depth = 0): CheckCodeStatement[] {
  if (depth > 8) throw new CheckCodeParseError(lines[cursor.index]?.number ?? 1, "IF nesting exceeds the browser limit of 8.");
  const statements: CheckCodeStatement[] = [];
  while (cursor.index < lines.length) {
    const current = lines[cursor.index]!;
    const upper = current.text.toUpperCase();
    if (endTokens.has(upper)) break;
    const ifMatch = current.text.match(/^IF\s+(.+?)\s+THEN$/i);
    if (ifMatch) {
      cursor.index += 1;
      const thenStatements = parseStatements(lines, cursor, new Set(["ELSE", "END", "END-IF"]), depth + 1);
      let otherwise: CheckCodeStatement[] = [];
      if (lines[cursor.index]?.text.toUpperCase() === "ELSE") {
        cursor.index += 1;
        otherwise = parseStatements(lines, cursor, new Set(["END", "END-IF"]), depth + 1);
      }
      const closing = lines[cursor.index];
      if (!closing || !["END", "END-IF"].includes(closing.text.toUpperCase())) {
        throw new CheckCodeParseError(current.number, "IF is missing END-IF.");
      }
      cursor.index += 1;
      statements.push({ kind: "if", condition: comparison(ifMatch[1] ?? "", current.number), then: thenStatements, otherwise, line: current.number });
      continue;
    }
    const gotoMatch = current.text.match(/^GOTO\s+(.+)$/i);
    const actionMatch = current.text.match(/^(ENABLE|DISABLE|HIDE|UNHIDE|SET-REQUIRED|SET-NOT-REQUIRED)\s+(.+)$/i);
    const geocodeMatch = current.text.match(/^GEOCODE\s+([^,]+),\s*([^,]+),\s*([^,]+)$/i);
    const clearMatch = current.text.match(/^CLEAR\s+(.+)$/i);
    const assignMatch = current.text.match(/^(?:ASSIGN\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/i);
    const dialogMatch = current.text.match(/^DIALOG\s+(["'])(.*)\1$/i);
    if (gotoMatch) statements.push({ kind: "goto", target: identifier(gotoMatch[1] ?? "", current.number), line: current.number });
    else if (actionMatch) statements.push({
      kind: "field-action",
      action: actionMatch[1]!.toLocaleLowerCase() as SafeFieldAction,
      targets: identifiers(actionMatch[2] ?? "", current.number),
      line: current.number,
    });
    else if (geocodeMatch) statements.push({
      kind: "geocode",
      addressField: identifier(geocodeMatch[1] ?? "", current.number),
      latitudeField: identifier(geocodeMatch[2] ?? "", current.number),
      longitudeField: identifier(geocodeMatch[3] ?? "", current.number),
      line: current.number,
    });
    else if (clearMatch) statements.push({ kind: "clear", targets: identifiers(clearMatch[1] ?? "", current.number), line: current.number });
    else if (assignMatch) statements.push({ kind: "assign", target: identifier(assignMatch[1] ?? "", current.number), value: operand(assignMatch[2] ?? "", current.number), line: current.number });
    else if (dialogMatch) statements.push({ kind: "dialog", message: dialogMatch[2] ?? "", line: current.number });
    else throw new CheckCodeParseError(current.number, `Unsupported or malformed Check Code statement: ${current.text}`);
    cursor.index += 1;
    if (statements.length > 128) throw new CheckCodeParseError(current.number, "An event exceeds the browser limit of 128 statements.");
  }
  return statements;
}

function sourceLines(source: string): SourceLine[] {
  if (source.length > 100_000) throw new CheckCodeParseError(1, "Check Code source exceeds 100,000 characters.");
  return source.split(/\r?\n/).map((text, index) => ({ number: index + 1, text: text.trim() }))
    .filter((line) => line.text !== "" && !line.text.startsWith("//") && !line.text.startsWith("***"));
}

export function parseCheckCodeProgram(source: string): CheckCodeProgramAst {
  const lines = sourceLines(source);
  const cursor: Cursor = { index: 0 };
  const definitions: CheckCodeDefinition[] = [];
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
    const opening = current.text.match(/^(FIELD|PAGE)\s+(.+)$/i) ?? current.text.match(/^(FORM|VIEW|RECORD)$/i);
    if (!opening) throw new CheckCodeParseError(current.number, "Expected DefineVariables, Field, Page, Form/View, or Record.");
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
  return { schema: CHECK_CODE_AST_SCHEMA, definitions, blocks };
}

function compareName(name: string): string { return name.toLocaleLowerCase(); }

export function compileFieldCheckCodeSubset(ast: CheckCodeProgramAst, schema: FormSchema): CheckCodeCompileResult {
  const names = new Map(schema.fields.map((field) => [compareName(field.name), field.name]));
  const variables = new Map<string, CheckCodeDefinition>();
  const compiled = new Map<string, FieldCheckCode>();
  const navigation = new Map<string, Set<string>>();
  const reasons: string[] = [];
  for (const definition of ast.definitions) {
    const normalized = compareName(definition.name);
    if (variables.has(normalized) || names.has(normalized)) reasons.push(`Line ${definition.line}: ${JSON.stringify(definition.name)} duplicates a field or variable name.`);
    else variables.set(normalized, definition);
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
  const validateStatement = (statement: CheckCodeStatement): void => {
    if (statement.kind === "goto") resolveField(statement.target, statement.line);
    else if (statement.kind === "field-action") {
      for (const target of statement.targets) if (target !== "*") resolveField(target, statement.line);
    } else if (statement.kind === "geocode") {
      resolveField(statement.addressField, statement.line);
      resolveField(statement.latitudeField, statement.line);
      resolveField(statement.longitudeField, statement.line);
    } else if (statement.kind === "assign") {
      resolveValue(statement.target, statement.line);
      if (statement.value.kind === "reference") resolveValue(String(statement.value.value), statement.line);
    } else if (statement.kind === "clear") {
      for (const target of statement.targets) if (target !== "*") resolveValue(target, statement.line);
    } else if (statement.kind === "if") {
      resolveValue(statement.condition.left, statement.line);
      if (statement.condition.right.kind === "reference") resolveValue(String(statement.condition.right.value), statement.line);
      statement.then.forEach(validateStatement);
      statement.otherwise.forEach(validateStatement);
    }
  };
  const collectGotoTargets = (statements: readonly CheckCodeStatement[], targets: Set<string>): void => {
    for (const statement of statements) {
      if (statement.kind === "goto") targets.add(compareName(statement.target));
      else if (statement.kind === "if") {
        collectGotoTargets(statement.then, targets);
        collectGotoTargets(statement.otherwise, targets);
      }
    }
  };
  const compileAfter = (statement: CheckCodeStatement, blockField: string, when?: SafeCheckCodeStatement["when"]): SafeCheckCodeStatement[] => {
    if (statement.kind === "goto") {
      const targetField = names.get(compareName(statement.target));
      return targetField ? [{ kind: "goto", targetField, ...(when ? { when } : {}) }] : [];
    }
    if (statement.kind === "field-action") {
      const targets = statement.targets.includes("*") ? [...names.values()] : statement.targets;
      return targets.flatMap((target) => {
        const targetField = names.get(compareName(target));
        return targetField ? [{ kind: "field-action" as const, action: statement.action, targetField, ...(when ? { when } : {}) }] : [];
      });
    }
    if (statement.kind === "if") {
      const left = names.get(compareName(statement.condition.left));
      if (left !== blockField || statement.condition.right.kind !== "literal" || statement.otherwise.length > 0) return [];
      const nestedWhen = { operator: statement.condition.operator, value: statement.condition.right.value as RecordValue };
      return statement.then.flatMap((child) => compileAfter(child, blockField, nestedWhen));
    }
    return [];
  };
  const seenBlocks = new Set<string>();
  for (const block of ast.blocks) {
    const blockKey = `${block.scope}:${compareName(block.name ?? "")}`;
    if (seenBlocks.has(blockKey)) reasons.push(`Line ${block.line}: duplicate ${block.scope} Check Code block.`);
    seenBlocks.add(blockKey);
    for (const statements of Object.values(block.events)) statements?.forEach(validateStatement);
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
