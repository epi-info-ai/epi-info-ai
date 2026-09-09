import type { FieldDefinition } from "../contracts/core.ts";
import type { MapDataSource } from "../contracts/maps.ts";
import { parseClassicProgram, type ClassicAnalysisOptions } from "./classic-ast.ts";
import { buildClassicSelectionCommand, resolveClassicSelectionCommand, type ClassicSelectionOperator } from "./classic-selection.ts";
import { buildClassicSortCommand, resolveClassicSortCommand, type ClassicSortDirection } from "./classic-sort.ts";
import { buildClassicAssignmentCommand, buildClassicUndefineCommand, resolveClassicAssignCommand, resolveClassicDefineCommand, resolveClassicUndefineCommand, type ClassicSessionVariableDefinition, type ClassicVariableValue } from "./classic-assignment.ts";
import { buildClassicIfCommand, resolveClassicIfCommand, type ClassicIfInput } from "./classic-if.ts";
import { buildClassicDisplayCommand, resolveClassicDisplayCommand, type ClassicDisplayMode } from "./classic-display.ts";
import { buildClassicDefineGroupCommand, expandClassicGroupNames, resolveClassicDefineGroupCommand, type ClassicGroupDefinition } from "./classic-group.ts";
import { buildClassicRelateCommand, resolveClassicRelateCommand, type ClassicRelateKey } from "./classic-relate.ts";
import { buildClassicWriteCommand, resolveClassicWriteCommand } from "./classic-write.ts";
import { buildClassicMergeCommand, resolveClassicMergeCommand, type ClassicMergeKey } from "./classic-merge.ts";
import { buildClassicDeleteTableCommand, resolveClassicDeleteTableCommand } from "./classic-delete.ts";
import { buildClassicDeleteRecordsCommand, resolveClassicDeleteRecordsCommand, type ClassicDeleteRecordsInput } from "./classic-delete-records.ts";
import { buildClassicUndeleteRecordsCommand, resolveClassicUndeleteRecordsCommand, type ClassicUndeleteRecordsInput } from "./classic-undelete-records.ts";
import { buildClassicSummarizeCommand, resolveClassicSummarizeCommand, type ClassicSummarizeInput } from "./classic-summarize.ts";
import { buildClassicGraphCommand, resolveClassicGraphCommand, type ClassicGraphInput } from "./classic-graph.ts";
import { buildEpiAiQualityCommand, resolveEpiAiQualityCommand } from "./epi-ai-quality.ts";
import { buildFileConvertCommand, resolveFileConvertCommand } from "./file-convert.ts";

export type ClassicAnalysisCommandKind = "read" | "relate" | "write" | "merge" | "delete-table" | "delete-records" | "undelete-records" | "define" | "define-group" | "undefine" | "assign" | "recode" | "display" | "select" | "cancel-select" | "if" | "sort" | "cancel-sort" | "list" | "frequency" | "means" | "tables" | "summarize" | "graph" | "set-missing" | "set-missing-label" | "quality" | "file-convert";

export type ClassicDefineVariableType = "NUMERIC" | "TEXTINPUT" | "YN" | "DATEFORMAT" | "DATETIMEFORMAT" | "TIMEFORMAT";
export type ClassicDefineVariableScope = "STANDARD" | "GLOBAL" | "PERMANENT";
export interface ClassicRecodeRangeInput { from: string; to?: string; result: string }

export type ClassicAnalysisCommandInput =
  | { kind: "read"; table: string }
  | { kind: "relate"; relatedForm: string; keys: ClassicRelateKey[]; join: "matching" | "all" }
  | { kind: "write"; fileName: string; fields: string[] }
  | { kind: "merge"; sourceForm: string; keys: ClassicMergeKey[] }
  | { kind: "delete-table"; formName: string }
  | ({ kind: "delete-records" } & ClassicDeleteRecordsInput)
  | ({ kind: "undelete-records" } & ClassicUndeleteRecordsInput)
  | ({ kind: "summarize" } & ClassicSummarizeInput)
  | ({ kind: "graph" } & ClassicGraphInput)
  | { kind: "quality" }
  | { kind: "file-convert"; inputFile: string; outputFile: string }
  | { kind: "set-missing"; enabled: boolean }
  | { kind: "set-missing-label"; value: string }
  | { kind: "define"; variable: string; scope: ClassicDefineVariableScope; variableType: ClassicDefineVariableType; prompt?: string }
  | { kind: "define-group"; group: string; members: string[] }
  | { kind: "undefine"; variable: string | "*" }
  | { kind: "assign"; variable: string; value: ClassicVariableValue }
  | { kind: "recode"; sourceField: string; targetVariable: string; ranges: ClassicRecodeRangeInput[]; elseResult?: string }
  | { kind: "display"; mode: ClassicDisplayMode; variables?: string[] }
  | { kind: "select"; field: string; operator: ClassicSelectionOperator; value: string | number | boolean; expression?: never }
  | { kind: "select"; expression: string; field?: never; operator?: never; value?: never }
  | { kind: "cancel-select" }
  | ({ kind: "if" } & ClassicIfInput)
  | { kind: "sort"; items: Array<{ field: string; direction: ClassicSortDirection }> }
  | { kind: "cancel-sort" }
  | { kind: "list"; fields: string[] }
  | { kind: "frequency"; field: string; stratifyBy?: string; weightBy?: string; psuBy?: string; outputTable?: string }
  | { kind: "means"; field: string; crossTabBy?: string; stratifyBy?: string; weightBy?: string; psuBy?: string; outputTable?: string }
  | { kind: "tables"; exposure: string; exposures?: string[]; outcome: string; stratifyBy?: string[]; weightBy?: string; psuBy?: string; statistics?: "NONE" | "FISHER"; outputTable?: string; oneIsYes?: boolean; noWrap?: boolean; columnSize?: number };

type SelectedExecutableClassicCommandInput = Exclude<ClassicAnalysisCommandInput, { kind: "recode" }>;
export type ResolvedClassicAnalysisCommand = SelectedExecutableClassicCommandInput & { source: string };
export const CLASSIC_TABLES_EXPANSION_PLAN_VERSION = "classic-tables-expansion-v0.1.0" as const;

const fieldToken = (name: string): string => name === "*" ? "*" : /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `[${name}]`;
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
  if (input.kind === "relate") return buildClassicRelateCommand(input.relatedForm, input.keys, input.join);
  if (input.kind === "write") return buildClassicWriteCommand({ fileName: input.fileName, fields: input.fields });
  if (input.kind === "merge") return buildClassicMergeCommand(input.sourceForm, input.keys);
  if (input.kind === "delete-table") return buildClassicDeleteTableCommand(input.formName);
  if (input.kind === "delete-records") return buildClassicDeleteRecordsCommand(input);
  if (input.kind === "undelete-records") return buildClassicUndeleteRecordsCommand(input);
  if (input.kind === "summarize") return buildClassicSummarizeCommand(input);
  if (input.kind === "graph") return buildClassicGraphCommand(input);
  if (input.kind === "quality") return buildEpiAiQualityCommand({ mode: "profile" });
  if (input.kind === "file-convert") return buildFileConvertCommand(input.inputFile, input.outputFile);
  if (input.kind === "set-missing") return `SET MISSING=${input.enabled ? "ON" : "OFF"}`;
  if (input.kind === "set-missing-label") {
    if (!input.value.trim()) throw new RangeError("The missing-value display label cannot be blank.");
    return `SET (.)=${JSON.stringify(input.value.trim())}`;
  }
  if (input.kind === "define") {
    const scope = input.scope === "STANDARD" ? "" : ` ${input.scope}`;
    const prompt = input.prompt?.trim() ? ` ${JSON.stringify(input.prompt.trim())}` : "";
    return `DEFINE ${variableToken(input.variable)}${scope} ${input.variableType}${prompt}`;
  }
  if (input.kind === "define-group") return buildClassicDefineGroupCommand(input.group, input.members);
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
  if (input.kind === "display") return buildClassicDisplayCommand(input);
  if (input.kind === "select") return input.expression === undefined
    ? buildClassicSelectionCommand(input.field, input.operator, input.value)
    : `SELECT ${input.expression}`;
  if (input.kind === "cancel-select") return "CANCEL SELECT";
  if (input.kind === "if") return buildClassicIfCommand(input);
  if (input.kind === "sort") return buildClassicSortCommand(input.items);
  if (input.kind === "cancel-sort") return "CANCEL SORT";
  if (input.kind === "list") return `LIST ${input.fields.length ? input.fields.map(fieldToken).join(" ") : "*"}`;
  if (input.kind === "frequency") return `FREQ ${fieldToken(input.field)}${input.stratifyBy ? ` STRATAVAR=${fieldToken(input.stratifyBy)}` : ""}${input.weightBy ? ` WEIGHTVAR=${fieldToken(input.weightBy)}` : ""}${input.psuBy ? ` PSUVAR=${fieldToken(input.psuBy)}` : ""}${input.outputTable ? ` OUTTABLE=${fieldToken(input.outputTable)}` : ""}`;
  if (input.kind === "means") return `MEANS ${fieldToken(input.field)}${input.crossTabBy ? ` ${fieldToken(input.crossTabBy)}` : ""}${input.stratifyBy ? ` STRATAVAR=${fieldToken(input.stratifyBy)}` : ""}${input.weightBy ? ` WEIGHTVAR=${fieldToken(input.weightBy)}` : ""}${input.outputTable ? ` OUTTABLE=${fieldToken(input.outputTable)}` : ""}${input.psuBy ? ` PSUVAR=${fieldToken(input.psuBy)}` : ""}`;
  return `TABLES ${fieldToken(input.exposure)} ${fieldToken(input.outcome)}${input.stratifyBy?.length ? ` STRATAVAR=${input.stratifyBy.map(fieldToken).join(" ")}` : ""}${input.weightBy ? ` WEIGHTVAR=${fieldToken(input.weightBy)}` : ""}${input.psuBy ? ` PSUVAR=${fieldToken(input.psuBy)}` : ""}${input.statistics ? ` STATISTICS=${input.statistics}` : ""}${input.outputTable ? ` OUTTABLE=${fieldToken(input.outputTable)}` : ""}${input.oneIsYes ? " ONEISYES" : ""}${input.noWrap ? " NOWRAP" : ""}${input.columnSize !== undefined ? ` COLUMNSIZE=${input.columnSize}` : ""}`;
}

function resolvedField(fields: readonly FieldDefinition[], requested: string): string {
  const field = fields.find((candidate) => candidate.name.toLocaleLowerCase("en-US") === requested.toLocaleLowerCase("en-US"));
  if (!field) throw new RangeError(`${requested} is not a field in the current form.`);
  return field.name;
}

function assertBoundedOptions(options: ClassicAnalysisOptions, allowStrata: boolean, allowFisher = false): string | undefined {
  if (options.weightBy || options.outputTable || options.psuVariable || (options.statistics && !(allowFisher && options.statistics === "FISHER")) || options.columnSize || options.noWrap || options.oneIsYes) {
    throw new RangeError("The selected command uses options that are not enabled in this bounded executor.");
  }
  if (!allowStrata && options.stratifyBy.length) throw new RangeError("This selected command does not support STRATAVAR yet.");
  if (options.stratifyBy.length > 1) throw new RangeError("Only one STRATAVAR is supported in this slice.");
  return options.stratifyBy[0]?.name;
}

export function resolveSelectedClassicAnalysisCommand(source: string, fields: readonly FieldDefinition[], dataSources: readonly MapDataSource[] = [], variables: readonly ClassicSessionVariableDefinition[] = [], groups: readonly ClassicGroupDefinition[] = []): ResolvedClassicAnalysisCommand {
  if (!source.trim()) throw new RangeError("Select one complete READ, RELATE, WRITE, MERGE, DELETE TABLES, DELETE RECORDS, UNDELETE RECORDS, DEFINE, DEFINE GROUPVAR, UNDEFINE, ASSIGN, DISPLAY, SELECT, CANCEL SELECT, IF, SORT, CANCEL SORT, LIST, FREQ, MEANS, TABLES, SUMMARIZE, GRAPH, or SET MISSING command in the Program Editor.");
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1) throw new RangeError("Select exactly one complete command. Multiple statements were not run.");
  const statement = ast.body[0]!;
  if (statement.type === "SetStatement") return statement.option === "MISSING"
    ? { kind: "set-missing", enabled: statement.enabled, source }
    : { kind: "set-missing-label", value: statement.value, source };
  if (statement.type === "DefineStatement") {
    const definition = resolveClassicDefineCommand(source, fields, variables, groups);
    return { kind: "define", variable: definition.name, scope: definition.scope, variableType: definition.variableType, ...(definition.prompt ? { prompt: definition.prompt } : {}), source };
  }
  if (statement.type === "DefineGroupStatement") {
    const plan = resolveClassicDefineGroupCommand(source, fields, variables, groups);
    return { kind: "define-group", group: plan.name, members: plan.members, source };
  }
  if (statement.type === "UndefineStatement") {
    const plan = resolveClassicUndefineCommand(source, fields, variables);
    return { kind: "undefine", variable: plan.mode === "all-standard" ? "*" : plan.variable!.name, source };
  }
  if (statement.type === "DisplayStatement") {
    const plan = resolveClassicDisplayCommand(source, fields, variables.map((variable) => ({ ...variable, value: null })));
    return {
      kind: "display", mode: plan.mode,
      ...(plan.mode === "list" ? { variables: [...plan.fields.map(({ name }) => name), ...plan.variables.map(({ name }) => name)] } : {}), source,
    };
  }
  if (statement.type === "AssignStatement") {
    const assignment = resolveClassicAssignCommand(source, fields, variables);
    return { kind: "assign", variable: assignment.variable.name, value: assignment.value, source };
  }
  if (statement.type === "SelectStatement") {
    const sessionVariables = variables.map((variable) => ({ ...variable, value: null }));
    const selection = resolveClassicSelectionCommand(source, fields, sessionVariables);
    if (selection.kind === "cancel") return { kind: "cancel-select", source };
    return selection.mode === "comparison"
      ? { kind: "select", field: selection.field, operator: selection.operator, value: selection.value, source }
      : { kind: "select", expression: selection.canonicalSource.replace(/^SELECT\s+/i, ""), source };
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
  if (statement.type === "RelateStatement") {
    const plan = resolveClassicRelateCommand(source, fields, dataSources);
    return { kind: "relate", relatedForm: plan.relatedForm, keys: plan.keys, join: plan.join, source };
  }
  if (statement.type === "WriteStatement") {
    const plan = resolveClassicWriteCommand(source, fields, groups);
    return { kind: "write", fileName: plan.fileName, fields: plan.fields.map(({ name }) => name), source };
  }
  if (statement.type === "MergeStatement") {
    const plan = resolveClassicMergeCommand(source, fields, dataSources);
    return { kind: "merge", sourceForm: plan.sourceForm, keys: plan.keys, source };
  }
  if (statement.type === "DeleteStatement") {
    if (statement.target.kind === "records") {
      const plan = resolveClassicDeleteRecordsCommand(source, fields);
      return plan.selection.kind === "all"
        ? { kind: "delete-records", all: true, source }
        : { kind: "delete-records", all: false, field: plan.selection.field, operator: plan.selection.operator, value: plan.selection.value, source };
    }
    const plan = resolveClassicDeleteTableCommand(source, dataSources);
    return { kind: "delete-table", formName: plan.formName, source };
  }
  if (statement.type === "UndeleteStatement") {
    const plan = resolveClassicUndeleteRecordsCommand(source, fields);
    return plan.selection.kind === "all"
      ? { kind: "undelete-records", all: true, source }
      : { kind: "undelete-records", all: false, field: plan.selection.field, operator: plan.selection.operator, value: plan.selection.value, source };
  }
  if (statement.type === "SummarizeStatement") {
    const plan = resolveClassicSummarizeCommand(source, fields);
    return {
      kind: "summarize", aggregate: plan.aggregate, ...(plan.field ? { field: plan.field } : {}), resultField: plan.resultField,
      outputTable: plan.outputTable, ...(plan.stratifyBy ? { stratifyBy: plan.stratifyBy } : {}), source,
    };
  }
  if (statement.type === "GraphStatement") {
    const plan = resolveClassicGraphCommand(source, fields);
    return {
      kind: "graph", field: plan.field, graphType: plan.graphType,
      ...(plan.title ? { title: plan.title } : {}), ...(plan.xTitle ? { xTitle: plan.xTitle } : {}),
      ...(plan.yTitle ? { yTitle: plan.yTitle } : {}), source,
    };
  }
  if (statement.type === "EpiAiQualityStatement") {
    const plan = resolveEpiAiQualityCommand(source, fields);
    return { kind: "quality", source };
  }
  if (statement.type === "FileConvertStatement") {
    const plan = resolveFileConvertCommand(source);
    return { kind: "file-convert", inputFile: plan.inputFile, outputFile: plan.outputFile, source };
  }
  if (statement.type === "ListStatement") {
    if (statement.selection.kind === "all") return { kind: "list", fields: fields.map((field) => field.name), source };
    if (statement.selection.kind === "all-except") {
      const excluded = new Set(expandClassicGroupNames(statement.selection.fields.map((field) => field.name), groups).map((name) => resolvedField(fields, name)));
      return { kind: "list", fields: fields.map((field) => field.name).filter((field) => !excluded.has(field)), source };
    }
    return { kind: "list", fields: expandClassicGroupNames(statement.selection.fields.map((field) => field.name), groups).map((name) => resolvedField(fields, name)), source };
  }
  if (statement.type === "FrequencyStatement") {
    if (statement.selection.kind !== "fields" || statement.selection.fields.length !== 1) throw new RangeError("Selected FREQ execution requires exactly one field.");
    if (statement.options.statistics || statement.options.columnSize || statement.options.noWrap || statement.options.oneIsYes) throw new RangeError("The selected FREQ uses options that are not enabled in this bounded executor.");
    if (statement.options.stratifyBy.length > 1) throw new RangeError("Complex Sample Frequencies currently accepts the legacy dialog's single STRATAVAR design stratum.");
    if (!statement.options.psuVariable && (statement.options.weightBy || statement.options.outputTable)) throw new RangeError("FREQ WEIGHTVAR and OUTTABLE are enabled with the Complex Sample Frequencies PSUVAR path in this slice.");
    const field = resolvedField(fields, statement.selection.fields[0]!.name);
    const strata = statement.options.stratifyBy[0] ? resolvedField(fields, statement.options.stratifyBy[0].name) : undefined;
    const weightBy = statement.options.weightBy ? resolvedField(fields, statement.options.weightBy.name) : undefined;
    const psuBy = statement.options.psuVariable ? resolvedField(fields, statement.options.psuVariable.name) : undefined;
    if (statement.options.outputTable && dataSources.some((source) => source.formName.toLocaleLowerCase("en-US") === statement.options.outputTable!.name.toLocaleLowerCase("en-US"))) {
      throw new RangeError(`${statement.options.outputTable.name} conflicts with an existing project form; choose a distinct in-session OUTTABLE name.`);
    }
    if (weightBy && fields.find((candidate) => candidate.name === weightBy)?.type !== "number") throw new RangeError(`${weightBy} must be a Number field for Complex Sample Frequencies WEIGHTVAR.`);
    const selected = [field, strata, weightBy, psuBy].filter((value): value is string => Boolean(value));
    if (new Set(selected.map((name) => name.toLocaleLowerCase("en-US"))).size !== selected.length) throw new RangeError("FREQ, STRATAVAR, WEIGHTVAR, and PSUVAR must use different fields.");
    return {
      kind: "frequency", field, ...(strata ? { stratifyBy: strata } : {}),
      ...(weightBy ? { weightBy } : {}), ...(psuBy ? { psuBy } : {}),
      ...(statement.options.outputTable ? { outputTable: statement.options.outputTable.name } : {}), source,
    };
  }
  if (statement.type === "MeansStatement") {
    const field = resolvedField(fields, statement.field.name);
    if (fields.find((candidate) => candidate.name === field)?.type !== "number") throw new RangeError(`${field} must be a Number field for MEANS.`);
    if (statement.options.statistics || statement.options.oneIsYes || statement.options.columnSize || statement.options.noWrap) throw new RangeError("The selected MEANS uses options that are not enabled in this bounded executor.");
    if (statement.options.stratifyBy.length > 1) throw new RangeError("Complex Sample Means currently accepts one design STRATAVAR.");
    const crossTabBy = statement.crossTab ? resolvedField(fields, statement.crossTab.name) : undefined;
    const stratifyBy = statement.options.stratifyBy[0] ? resolvedField(fields, statement.options.stratifyBy[0].name) : undefined;
    const weightBy = statement.options.weightBy ? resolvedField(fields, statement.options.weightBy.name) : undefined;
    const psuBy = statement.options.psuVariable ? resolvedField(fields, statement.options.psuVariable.name) : undefined;
    if (!psuBy && (crossTabBy || stratifyBy || weightBy || statement.options.outputTable)) throw new RangeError("MEANS cross-tabulation, STRATAVAR, WEIGHTVAR, and adapted OUTTABLE are enabled with the Complex Sample Means PSUVAR path in this slice.");
    if (statement.options.outputTable && dataSources.some((source) => source.formName.toLocaleLowerCase("en-US") === statement.options.outputTable!.name.toLocaleLowerCase("en-US"))) {
      throw new RangeError(`${statement.options.outputTable.name} conflicts with an existing project form; choose a distinct in-session OUTTABLE name.`);
    }
    if (weightBy && fields.find((candidate) => candidate.name === weightBy)?.type !== "number") throw new RangeError(`${weightBy} must be a Number field for Complex Sample Means WEIGHTVAR.`);
    const selected = [field, crossTabBy, stratifyBy, weightBy, psuBy].filter((value): value is string => Boolean(value));
    if (new Set(selected.map((name) => name.toLocaleLowerCase("en-US"))).size !== selected.length) throw new RangeError("MEANS, cross-tabulation, STRATAVAR, WEIGHTVAR, and PSUVAR must use different fields.");
    return { kind: "means", field, ...(crossTabBy ? { crossTabBy } : {}), ...(stratifyBy ? { stratifyBy } : {}), ...(weightBy ? { weightBy } : {}), ...(statement.options.outputTable ? { outputTable: statement.options.outputTable.name } : {}), ...(psuBy ? { psuBy } : {}), source };
  }
  if (statement.type === "TablesStatement") {
    if (!statement.outcome) throw new RangeError("Selected TABLES execution requires an outcome field.");
    if (statement.options.psuVariable && (statement.options.statistics || statement.options.oneIsYes)) throw new RangeError("Complex Sample Tables does not combine PSUVAR with ordinary TABLES STATISTICS or ONEISYES.");
    const outcome = resolvedField(fields, statement.outcome.name);
    const strata = statement.options.stratifyBy.map(({ name }) => resolvedField(fields, name));
    const weightBy = statement.options.weightBy ? resolvedField(fields, statement.options.weightBy.name) : undefined;
    const psuBy = statement.options.psuVariable ? resolvedField(fields, statement.options.psuVariable.name) : undefined;
    if (weightBy && fields.find((candidate) => candidate.name === weightBy)?.type !== "number") throw new RangeError(`${weightBy} must be a Number field for TABLES WEIGHTVAR.`);
    if (weightBy && statement.options.statistics === "FISHER") throw new RangeError("TABLES STATISTICS=FISHER is not available with WEIGHTVAR because exact tests require unweighted integer observations.");
    const unavailable = new Set([outcome, ...strata, ...(weightBy ? [weightBy] : []), ...(psuBy ? [psuBy] : [])].map((name) => name.toLocaleLowerCase("en-US")));
    let exposure = "*";
    let exposures: string[];
    if (statement.exposure === "*") {
      exposures = fields
        .filter(({ type }) => type !== "command-button")
        .map(({ name }) => name)
        .filter((name) => !unavailable.has(name.toLocaleLowerCase("en-US")));
    } else {
      const requestedExposure = statement.exposure.name;
      const direct = fields.find((field) => field.name.toLocaleLowerCase("en-US") === requestedExposure.toLocaleLowerCase("en-US"));
      const group = groups.find((candidate) => candidate.name.toLocaleLowerCase("en-US") === requestedExposure.toLocaleLowerCase("en-US"));
      if (!direct && !group) throw new RangeError(`${requestedExposure} is not a field or GROUPVAR in the current Classic session.`);
      exposure = direct?.name ?? group!.name;
      exposures = expandClassicGroupNames([exposure], groups).map((name) => resolvedField(fields, name));
    }
    if (!exposures.length) throw new RangeError("TABLES exposure expansion did not contain any eligible current fields.");
    if (statement.options.outputTable && dataSources.some((source) => source.formName.toLocaleLowerCase("en-US") === statement.options.outputTable!.name.toLocaleLowerCase("en-US"))) {
      throw new RangeError(`${statement.options.outputTable.name} conflicts with an existing project form; choose a distinct in-session OUTTABLE name.`);
    }
    const conflict = exposures.find((name) => unavailable.has(name.toLocaleLowerCase("en-US")));
    if (conflict) throw new RangeError(`${conflict} cannot be both a TABLES exposure and its outcome, STRATAVAR, WEIGHTVAR, or PSUVAR.`);
    return {
      kind: "tables", exposure, ...(exposures.length > 1 || exposure === "*" ? { exposures } : {}), outcome,
      ...(strata.length ? { stratifyBy: strata } : {}), source,
      ...(weightBy ? { weightBy } : {}),
      ...(psuBy ? { psuBy } : {}),
      ...(statement.options.statistics ? { statistics: statement.options.statistics } : {}),
      ...(statement.options.outputTable ? { outputTable: statement.options.outputTable.name } : {}),
      ...(statement.options.oneIsYes ? { oneIsYes: true } : {}),
      ...(statement.options.noWrap ? { noWrap: true } : {}),
      ...(statement.options.columnSize !== undefined ? { columnSize: statement.options.columnSize } : {}),
    };
  }
  throw new RangeError("Only selected READ, RELATE, WRITE, MERGE, DELETE TABLES, DELETE RECORDS, UNDELETE RECORDS, DEFINE, DEFINE GROUPVAR, UNDEFINE, ASSIGN, DISPLAY, SELECT, CANCEL SELECT, IF, SORT, CANCEL SORT, LIST, FREQ, MEANS, TABLES, SUMMARIZE, GRAPH, and SET MISSING commands are enabled in this slice.");
}
