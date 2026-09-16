import type { EpiRecord, FieldDefinition } from "../contracts/core.ts";
import { parseClassicProgram, type ClassicMatchStatement } from "./classic-ast.ts";

export interface ClassicMatchInput {
  selection:
    | { kind: "row-all"; outcome: string }
    | { kind: "row-all-except"; excludedRows: string[]; outcome: string }
    | { kind: "column-all"; exposure: string }
    | { kind: "column-all-except"; exposure: string; excludedColumns: string[] }
    | { kind: "row-column"; exposure: string; outcome: string };
  weightBy?: string;
  matchBy?: string[];
  settings?: Array<{ name: string; value: string }>;
}

export interface ExecutableClassicMatchInput {
  selection: { kind: "row-column"; exposure: string; outcome: string };
  matchBy: [string];
}

export interface PlausibleClassicMatchVariable {
  name: string;
  prompt: string;
  populatedRecords: number;
  distinctSets: number;
  repeatedSets: number;
  singletonSets: number;
  maximumSetSize: number;
  exactPairSets: number;
}

function observedMatchKey(value: EpiRecord[string] | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized ? `${typeof value}:${normalized}` : null;
}

/**
 * Suggest fields whose observed values look like matched-set identifiers.
 * Unique record IDs have no repeated sets; broad categorical fields have groups
 * larger than the bounded pair/1:2 review surface. Both are excluded.
 */
export function plausibleClassicMatchVariables(
  fields: readonly FieldDefinition[],
  records: readonly EpiRecord[],
): PlausibleClassicMatchVariable[] {
  return fields.flatMap((field, fieldIndex) => {
    if (field.type === "command-button") return [];
    const counts = new Map<string, number>();
    for (const record of records) {
      const key = observedMatchKey(record[field.name]);
      if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const sizes = [...counts.values()];
    const populatedRecords = sizes.reduce((total, size) => total + size, 0);
    const repeatedSets = sizes.filter((size) => size >= 2).length;
    const singletonSets = sizes.filter((size) => size === 1).length;
    const maximumSetSize = Math.max(0, ...sizes);
    const exactPairSets = sizes.filter((size) => size === 2).length;
    const maximumSingletons = Math.max(1, Math.floor(sizes.length * 0.1));
    const identifierHint = /(?:match|pair|set|strat|group|cluster|household|identifier|(?:^|[_\s])id(?:$|[_\s]))/i.test(`${field.name} ${field.prompt}`);
    const plausible = populatedRecords >= 2
      && identifierHint
      && sizes.length >= 1
      && repeatedSets >= 1
      && maximumSetSize <= 3
      && singletonSets <= maximumSingletons
      && sizes.length / populatedRecords >= 0.25;
    if (!plausible) return [];
    return [{
      name: field.name,
      prompt: field.prompt,
      populatedRecords,
      distinctSets: sizes.length,
      repeatedSets,
      singletonSets,
      maximumSetSize,
      exactPairSets,
      fieldIndex,
    }];
  }).sort((left, right) => {
    const leftExact = left.exactPairSets / left.distinctSets;
    const rightExact = right.exactPairSets / right.distinctSets;
    if (leftExact !== rightExact) return rightExact - leftExact;
    const leftHint = /(?:match|pair|set)/i.test(`${left.name} ${left.prompt}`) ? 1 : 0;
    const rightHint = /(?:match|pair|set)/i.test(`${right.name} ${right.prompt}`) ? 1 : 0;
    return rightHint - leftHint || left.fieldIndex - right.fieldIndex;
  }).map(({ fieldIndex: _fieldIndex, ...candidate }) => candidate);
}

const token = (value: string): string => {
  const name = value.trim();
  if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name)) return name;
  if (!name || /[\[\]\r\n]/.test(name)) throw new RangeError("MATCH variables must be valid Epi Info identifiers or bracketable names.");
  return `[${name}]`;
};

export function buildClassicMatchCommand(input: ClassicMatchInput): string {
  const selection = input.selection;
  let source: string;
  if (selection.kind === "row-all") source = `MATCH * ${token(selection.outcome)}`;
  else if (selection.kind === "row-all-except") {
    if (!selection.excludedRows.length) throw new RangeError("MATCH row-all-except requires at least one excluded row variable.");
    source = `MATCH * EXCEPT ${selection.excludedRows.map(token).join(" ")} ${token(selection.outcome)}`;
  } else if (selection.kind === "column-all") source = `MATCH ${token(selection.exposure)} *`;
  else if (selection.kind === "column-all-except") {
    if (!selection.excludedColumns.length) throw new RangeError("MATCH column-all-except requires at least one excluded column variable.");
    source = `MATCH ${token(selection.exposure)} * EXCEPT ${selection.excludedColumns.map(token).join(" ")}`;
  } else source = `MATCH ${token(selection.exposure)} ${token(selection.outcome)}`;
  if (input.weightBy) source += ` WEIGHTVAR=${token(input.weightBy)}`;
  if (input.matchBy?.length) source += ` MATCHVAR=${input.matchBy.map(token).join(" ")}`;
  for (const setting of input.settings ?? []) {
    const name = setting.name.trim().toUpperCase();
    const value = setting.value.trim();
    if (!/^(?:STATISTICS|PROCESS|BOOLEAN|YN|DELETED|PERCENTS|MISSING|IGNORE|SELECT|FREQGRAPH|HYPERLINKS|SHOWPROMPTS|TABLES|USEBROWSER)$/.test(name) || !value) {
      throw new RangeError("MATCH settings must use a retained legacy SET clause with a nonblank value.");
    }
    if (name === "STATISTICS" && value.toUpperCase() !== "NONE") throw new RangeError("The legacy MATCH STATISTICS option accepts NONE only.");
    source += ` ${name}=${value}`;
  }
  return source;
}

export function parseClassicMatchCommand(source: string): ClassicMatchStatement {
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "MatchStatement") throw new RangeError("Select exactly one complete MATCH command.");
  return ast.body[0];
}

function resolvedField(fields: readonly FieldDefinition[], requested: string): string {
  const field = fields.find((candidate) => candidate.name.toLocaleLowerCase("en-US") === requested.toLocaleLowerCase("en-US"));
  if (!field) throw new RangeError(`${requested} is not a field in the current form.`);
  return field.name;
}

export function resolveExecutableClassicMatchCommand(
  source: string,
  fields: readonly FieldDefinition[],
): ExecutableClassicMatchInput {
  const statement = parseClassicMatchCommand(source);
  if (statement.selection.kind !== "row-column") {
    throw new RangeError("MATCH V0.1 execution requires one explicit exposure field and one explicit outcome field; wildcard and EXCEPT forms remain syntax-only.");
  }
  if (statement.weightBy) throw new RangeError("MATCH WEIGHTVAR remains syntax-only in the bounded 1:1 executor.");
  if (statement.matchBy.length !== 1) throw new RangeError("MATCH V0.1 execution requires exactly one MATCHVAR identifier field.");
  if (statement.settings.length) throw new RangeError("MATCH retained SET-clause options remain syntax-only in the bounded 1:1 executor.");
  const exposure = resolvedField(fields, statement.selection.exposure.name);
  const outcome = resolvedField(fields, statement.selection.outcome.name);
  const matchBy = resolvedField(fields, statement.matchBy[0]!.name);
  if (new Set([exposure, outcome, matchBy].map((name) => name.toLocaleLowerCase("en-US"))).size !== 3) {
    throw new RangeError("MATCH exposure, outcome, and MATCHVAR must use three different fields.");
  }
  return { selection: { kind: "row-column", exposure, outcome }, matchBy: [matchBy] };
}
