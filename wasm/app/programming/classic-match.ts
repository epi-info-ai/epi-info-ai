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

export function matchExecutionUnavailable(): never {
  throw new RangeError("MATCH syntax is available for revival review, but execution remains disabled: the inspected Epi Info 7 Rule_Match executor reports that MATCH is not yet implemented.");
}
