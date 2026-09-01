import type { FieldDefinition } from "../contracts/core.ts";
import type { MapDataSource } from "../contracts/maps.ts";
import { parseClassicProgram, type ClassicAnalysisOptions } from "./classic-ast.ts";
import { buildClassicSelectionCommand, resolveClassicSelectionCommand, type ClassicSelectionOperator } from "./classic-selection.ts";
import { buildClassicSortCommand, resolveClassicSortCommand, type ClassicSortDirection } from "./classic-sort.ts";
import { buildClassicAssignmentCommand, buildClassicUndefineCommand, resolveClassicAssignCommand, resolveClassicDefineCommand, resolveClassicUndefineCommand, type ClassicSessionVariableDefinition, type ClassicVariableValue } from "./classic-assignment.ts";
import { buildClassicIfCommand, resolveClassicIfCommand, type ClassicIfInput } from "./classic-if.ts";

export type ClassicAnalysisCommandKind = "read" | "define" | "undefine" | "assign" | "recode" | "select" | "cancel-select" | "if" | "sort" | "cancel-sort" | "list" | "frequency" | "means" | "tables";

export type ClassicDefineVariableType = "NUMERIC" | "TEXTINPUT" | "YN" | "DATEFORMAT" | "DATETIMEFORMAT" | "TIMEFORMAT";
export type ClassicDefineVariableScope = "STANDARD" | "GLOBAL" | "PERMANENT";
export interface ClassicRecodeRangeInput { from: string; to?: string; result: string }

export type ClassicAnalysisCommandInput =
  | { kind: "read"; table: string }
  | { kind: "define"; variable: string; scope: ClassicDefineVariableScope; variableType: ClassicDefineVariableType; prompt?: string }
  | { kind: "undefine"; variable: string | "*" }
  | { kind: "assign"; variable: string; value: ClassicVariableValue }
  | { kind: "recode"; sourceField: string; targetVariable: string; ranges: ClassicRecodeRangeInput[]; elseResult?: string }
  | { kind: "select"; field: string; operator: ClassicSelectionOperator; value: string | number | boolean }
  | { kind: "cancel-select" }
  | ({ kind: "if" } & ClassicIfInput)
  | { kind: "sort"; items: Array<{ field: string; direction: ClassicSortDirection }> }
  | { kind: "cancel-sort" }
  | { kind: "list"; fields: string[] }
  | { kind: "frequency"; field: string; stratifyBy?: string }
  | { kind: "means"; field: string }
  | { kind: "tables"; exposure: string; outcome: string; stratifyBy: string };

type SelectedExecutableClassicCommandInput = Exclude<ClassicAnalysisCommandInput, { kind: "recode" }>;
export type ResolvedClassicAnalysisCommand = SelectedExecutableClassicCommandInput & { source: string };

const fieldToken = (name: string): string => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `[${name}]`;
const variableToken = (name: string): string => {
  const trimmed = name.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) throw new RangeError("Variable names must begin with a letter or underscore and contain only letters, numbers, and underscores.");
  return trimmed;
};
const recodeBoundary = (value: string): string => {
  const trimmed = value.trim();
  if (/^(?:LOVALUE|HIVALUE)$/i.test(trimmed)) return trimmed.toUpperCase();
  const number = Number(trimmed);
  if (!trimmed || !Number.isFinite(number)) throw new RangeError("RECODE boundaries must be finite numbers, LOVALUE, or HIVALUE.");
  return String(number);
};

export function buildClassicAnalysisCommand(input: ClassicAnalysisCommandInput): string {
  if (input.kind === "read") return `READ ${fieldToken(input.table)}`;
  if (input.kind === "define") {
    const scope = input.scope === "STANDARD" ? "" : ` ${input.scope}`;
    const prompt = input.prompt?.trim() ? ` ${JSON.stringify(input.prompt.trim())}` : "";
    return `DEFINE ${variableToken(input.variable)}${scope} ${input.variableType}${prompt}`;
  }
  if (input.kind === "undefine") return buildClassicUndefineCommand(input.variable);
  if (input.kind === "assign") return buildClassicAssignmentCommand(input.variable, input.value);
  if (input.kind === "recode") {
    if (!input.ranges.length && input.elseResult === undefined) throw new RangeError("RECODE requires at least one range or ELSE result.");
    const lines = input.ranges.map((range) => {
      if (!range.result.trim()) throw new RangeError("Every RECODE range requires a result label.");
      const from = recodeBoundary(range.from);
      const to = range.to?.trim() ? ` - ${recodeBoundary(range.to)}` : "";
      return `  ${from}${to} = ${JSON.stringify(range.result)}`;
    });
    if (input.elseResult !== undefined && input.elseResult.trim()) lines.push(`  ELSE = ${JSON.stringify(input.elseResult)}`);
    return `RECODE ${fieldToken(input.sourceField)} TO ${variableToken(input.targetVariable)}\n${lines.join("\n")}\nEND`;
  }
  if (input.kind === "select") return buildClassicSelectionCommand(input.field, input.operator, input.value);
  if (input.kind === "cancel-select") return "CANCEL SELECT";
  if (input.kind === "if") return buildClassicIfCommand(input);
  if (input.kind === "sort") return buildClassicSortCommand(input.items);
  if (input.kind === "cancel-sort") return "CANCEL SORT";
  if (input.kind === "list") return `LIST ${input.fields.length ? input.fields.map(fieldToken).join(" ") : "*"}`;
  if (input.kind === "frequency") return `FREQ ${fieldToken(input.field)}${input.stratifyBy ? ` STRATAVAR=${fieldToken(input.stratifyBy)}` : ""}`;
  if (input.kind === "means") return `MEANS ${fieldToken(input.field)}`;
  return `TABLES ${fieldToken(input.exposure)} ${fieldToken(input.outcome)}${input.stratifyBy ? ` STRATAVAR=${fieldToken(input.stratifyBy)}` : ""}`;
}

function resolvedField(fields: readonly FieldDefinition[], requested: string): string {
  const field = fields.find((candidate) => candidate.name.toLocaleLowerCase("en-US") === requested.toLocaleLowerCase("en-US"));
  if (!field) throw new RangeError(`${requested} is not a field in the current form.`);
  return field.name;
}

function assertBoundedOptions(options: ClassicAnalysisOptions, allowStrata: boolean): string | undefined {
  if (options.weightBy || options.outputTable || options.psuVariable || options.statistics || options.columnSize || options.noWrap || options.oneIsYes) {
    throw new RangeError("The selected command uses options that are not enabled in this bounded executor.");
  }
  if (!allowStrata && options.stratifyBy.length) throw new RangeError("This selected command does not support STRATAVAR yet.");
  if (options.stratifyBy.length > 1) throw new RangeError("Only one STRATAVAR is supported in this slice.");
  return options.stratifyBy[0]?.name;
}

export function resolveSelectedClassicAnalysisCommand(source: string, fields: readonly FieldDefinition[], dataSources: readonly MapDataSource[] = [], variables: readonly ClassicSessionVariableDefinition[] = []): ResolvedClassicAnalysisCommand {
  if (!source.trim()) throw new RangeError("Select one complete DEFINE, UNDEFINE, ASSIGN, READ, SELECT, CANCEL SELECT, IF, SORT, CANCEL SORT, LIST, FREQ, MEANS, or TABLES command in the Program Editor.");
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1) throw new RangeError("Select exactly one complete command. Multiple statements were not run.");
  const statement = ast.body[0]!;
  if (statement.type === "DefineStatement") {
    const definition = resolveClassicDefineCommand(source, fields, variables);
    return { kind: "define", variable: definition.name, scope: definition.scope, variableType: definition.variableType, ...(definition.prompt ? { prompt: definition.prompt } : {}), source };
  }
  if (statement.type === "UndefineStatement") {
    const plan = resolveClassicUndefineCommand(source, fields, variables);
    return { kind: "undefine", variable: plan.mode === "all-standard" ? "*" : plan.variable!.name, source };
  }
  if (statement.type === "AssignStatement") {
    const assignment = resolveClassicAssignCommand(source, fields, variables);
    return { kind: "assign", variable: assignment.variable.name, value: assignment.value, source };
  }
  if (statement.type === "SelectStatement") {
    const selection = resolveClassicSelectionCommand(source, fields);
    if (selection.kind === "cancel") return { kind: "cancel-select", source };
    return { kind: "select", field: selection.field, operator: selection.operator, value: selection.value, source };
  }
  if (statement.type === "IfStatement") {
    const plan = resolveClassicIfCommand(source, fields, variables);
    return {
      kind: "if", conditionVariable: plan.condition.variable.name, operator: plan.condition.operator, compareValue: plan.condition.value,
      thenVariable: plan.consequent.variable.name, thenValue: plan.consequent.value,
      ...(plan.alternate ? { elseAssignment: { variable: plan.alternate.variable.name, value: plan.alternate.value } } : {}), source,
    };
  }
  if (statement.type === "SortStatement") {
    const sort = resolveClassicSortCommand(source, fields);
    if (sort.kind === "cancel") return { kind: "cancel-sort", source };
    return { kind: "sort", items: sort.items.map(({ field, direction }) => ({ field, direction })), source };
  }
  if (statement.type === "ReadStatement") {
    if (statement.target.kind !== "current-project-table") throw new RangeError("Selected READ supports current-project forms only; external paths require a reviewed browser adapter.");
    const matches = dataSources.filter((candidate) => candidate.formName.toLocaleLowerCase("en-US") === statement.target.table.toLocaleLowerCase("en-US"));
    if (matches.length !== 1) throw new RangeError(matches.length ? `${statement.target.table} is ambiguous in the current project.` : `${statement.target.table} is not a form in the current project.`);
    return { kind: "read", table: matches[0]!.formName, source };
  }
  if (statement.type === "ListStatement") {
    if (statement.selection.kind === "all") return { kind: "list", fields: fields.map((field) => field.name), source };
    if (statement.selection.kind === "all-except") {
      const excluded = new Set(statement.selection.fields.map((field) => resolvedField(fields, field.name)));
      return { kind: "list", fields: fields.map((field) => field.name).filter((field) => !excluded.has(field)), source };
    }
    return { kind: "list", fields: statement.selection.fields.map((field) => resolvedField(fields, field.name)), source };
  }
  if (statement.type === "FrequencyStatement") {
    if (statement.selection.kind !== "fields" || statement.selection.fields.length !== 1) throw new RangeError("Selected FREQ execution requires exactly one field.");
    const strata = assertBoundedOptions(statement.options, true);
    if (strata && strata.toLocaleLowerCase("en-US") === statement.selection.fields[0]!.name.toLocaleLowerCase("en-US")) throw new RangeError("FREQ and STRATAVAR must use different fields.");
    return {
      kind: "frequency", field: resolvedField(fields, statement.selection.fields[0]!.name),
      ...(strata ? { stratifyBy: resolvedField(fields, strata) } : {}), source,
    };
  }
  if (statement.type === "MeansStatement") {
    const field = resolvedField(fields, statement.field.name);
    if (fields.find((candidate) => candidate.name === field)?.type !== "number") throw new RangeError(`${field} must be a Number field for MEANS.`);
    return { kind: "means", field, source };
  }
  if (statement.type === "TablesStatement") {
    if (statement.exposure === "*" || !statement.outcome) throw new RangeError("Selected TABLES execution requires exposure and outcome fields.");
    const strata = assertBoundedOptions(statement.options, true);
    if (!strata) throw new RangeError("Selected TABLES execution requires one STRATAVAR for the current stratified 2 x 2 slice.");
    const names = [statement.exposure.name, statement.outcome.name, strata].map((name) => name.toLocaleLowerCase("en-US"));
    if (new Set(names).size !== names.length) throw new RangeError("TABLES exposure, outcome, and STRATAVAR must use three different fields.");
    return {
      kind: "tables", exposure: resolvedField(fields, statement.exposure.name), outcome: resolvedField(fields, statement.outcome.name),
      stratifyBy: resolvedField(fields, strata), source,
    };
  }
  throw new RangeError("Only selected DEFINE, UNDEFINE, ASSIGN, READ, SELECT, CANCEL SELECT, IF, SORT, CANCEL SORT, LIST, FREQ, MEANS, and TABLES commands are enabled in this slice.");
}
