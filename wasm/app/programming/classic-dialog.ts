import type { MapDataSource } from "../contracts/maps.ts";
import { CLASSIC_AST_VERSION, parseClassicProgram, type ClassicDialogInput, type ClassicDialogStatement, type ClassicIdentifier } from "./classic-ast.ts";
import type { ClassicSessionVariableDefinition, ClassicVariableValue } from "./classic-assignment.ts";

export const CLASSIC_DIALOG_PLAN_VERSION = "classic-dialog-v0.3.0" as const;

export interface ClassicDialogCommandInput {
  prompt: string;
  title?: string;
  target?: string;
  input?: Exclude<ClassicDialogInput, { kind: "db-values" }> | { kind: "db-values"; table: string | ClassicIdentifier; variable: string | ClassicIdentifier };
}

export interface ClassicDialogPlan {
  kind: "dialog";
  version: typeof CLASSIC_DIALOG_PLAN_VERSION;
  astVersion: typeof CLASSIC_AST_VERSION;
  source: string;
  canonicalSource: string;
  prompt: string;
  title?: string;
  target?: ClassicSessionVariableDefinition;
  input: ClassicDialogInput;
  choices: string[];
  binding?: { requestedForm: string; resolvedForm: string; resolution: "single-compatible-form" };
}

const quote = (value: string): string => `"${value.replace(/"/g, '""')}"`;
const variableToken = (name: string): string => {
  const trimmed = name.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) throw new RangeError("DIALOG target names must be valid Epi Info identifiers.");
  return trimmed;
};
const dataIdentifierToken = (name: string): string => {
  const trimmed = name.trim();
  if (/^(?:[A-Za-z_][A-Za-z0-9_]*)(?:\.(?:[A-Za-z_][A-Za-z0-9_]*))*$/.test(trimmed)) return trimmed;
  if (!trimmed || /[\[\]\r\n]/.test(trimmed)) throw new RangeError("DIALOG data identifiers must be valid Epi Info identifiers or bracketable names.");
  return `[${trimmed}]`;
};

export function buildClassicDialogCommand(input: ClassicDialogCommandInput): string {
  const prompt = input.prompt.trim();
  if (!prompt) throw new RangeError("DIALOG prompt cannot be blank.");
  const format = input.input ?? { kind: "message" as const };
  let suffix = "";
  if (format.kind !== "message") {
    if (!input.target) throw new RangeError("Input-producing DIALOG requires a target variable.");
    const target = variableToken(input.target);
    const mask = "mask" in format && format.mask !== undefined ? ` ${quote(format.mask)}` : "";
    if (format.kind === "numeric") suffix = ` ${target}${format.implicit ? "" : ` NUMERIC${mask}`}`;
    else if (format.kind === "text") suffix = ` ${target} TEXTINPUT${mask}`;
    else if (format.kind === "yes-no") suffix = ` ${target} YN`;
    else if (format.kind === "date" || format.kind === "time" || format.kind === "datetime") {
      const modifier = format.kind === "date" ? "DATEFORMAT" : format.kind === "time" ? "TIMEFORMAT" : "DATETIMEFORMAT";
      suffix = ` ${target} ${modifier}${mask}`;
    } else if (format.kind === "choices") {
      if (!format.values.length || format.values.some((value) => !value.trim())) throw new RangeError("DIALOG choice values cannot be blank.");
      suffix = ` ${target} ${format.values.map(quote).join(", ")}`;
    } else if (format.kind === "db-values") {
      const table = typeof format.table === "string" ? format.table : format.table.name;
      const variable = typeof format.variable === "string" ? format.variable : format.variable.name;
      suffix = ` ${target} DBVALUES ${dataIdentifierToken(table)} ${dataIdentifierToken(variable)}`;
    } else if (format.kind === "db-views") suffix = ` ${target} DBVIEWS`;
    else if (format.kind === "databases") suffix = ` ${target} DATABASES`;
    else if (format.kind === "db-variables") suffix = ` ${target} DBVARIABLES`;
    else if (format.kind === "read-file" || format.kind === "write-file") suffix = ` ${target} ${format.kind === "read-file" ? "READ" : "WRITE"}${format.filter === undefined ? "" : ` ${quote(format.filter)}`}`;
    else throw new RangeError("Unsupported DIALOG input format.");
  }
  const title = input.title?.trim() ? ` TITLETEXT=${quote(input.title.trim())}` : "";
  return `DIALOG ${quote(prompt)}${suffix}${title}`;
}

function caseInsensitive<T extends { name: string }>(values: readonly T[], requested: string): T | undefined {
  return values.find((value) => value.name.toLocaleLowerCase("en-US") === requested.toLocaleLowerCase("en-US"));
}

function expectedVariableType(input: ClassicDialogInput): ClassicSessionVariableDefinition["variableType"] | undefined {
  if (input.kind === "message") return undefined;
  if (input.kind === "numeric") return "NUMERIC";
  if (input.kind === "yes-no") return "YN";
  if (input.kind === "date") return "DATEFORMAT";
  if (input.kind === "time") return "TIMEFORMAT";
  if (input.kind === "datetime") return "DATETIMEFORMAT";
  return "TEXTINPUT";
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))].sort((left, right) => left.localeCompare(right, "en-US", { numeric: true, sensitivity: "base" }));
}

function resolveChoices(statement: ClassicDialogStatement, dataSources: readonly MapDataSource[], variables: readonly ClassicSessionVariableDefinition[]): string[] {
  const input = statement.input;
  if (input.kind === "choices") return [...input.values];
  if (input.kind === "db-variables") return unique(variables.filter((variable) => variable.name !== statement.target?.name).map((variable) => variable.name));
  if (input.kind === "db-views") return unique(dataSources.map((source) => source.formName));
  if (input.kind === "databases") return unique(dataSources.map((source) => source.projectName));
  if (input.kind === "db-values") {
    const source = dataSources.find((candidate) => [candidate.formId, candidate.formName].some((name) => name.toLocaleLowerCase("en-US") === input.table.name.toLocaleLowerCase("en-US")));
    if (!source) throw new RangeError(`${input.table.name} is not an available project form identifier for DIALOG DBVALUES.`);
    const field = source.fields.find((candidate) => candidate.name.toLocaleLowerCase("en-US") === input.variable.name.toLocaleLowerCase("en-US"));
    if (!field) throw new RangeError(`${input.variable.name} is not a field in ${source.formName}.`);
    return unique(source.records.map((record) => String(record[field.name] ?? "")));
  }
  return [];
}

export function resolveClassicDialogCommand(
  source: string,
  variables: readonly ClassicSessionVariableDefinition[],
  dataSources: readonly MapDataSource[],
): ClassicDialogPlan {
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "DialogStatement") throw new RangeError("Select exactly one complete DIALOG command.");
  const statement = ast.body[0];
  const expected = expectedVariableType(statement.input);
  const target = statement.target ? caseInsensitive(variables, statement.target.name) : undefined;
  if (expected && !target) throw new RangeError(`${statement.target?.name ?? "DIALOG target"} is not a defined Standard variable. Run a matching DEFINE command first.`);
  if (target && target.variableType !== expected) throw new RangeError(`${target.name} is ${target.variableType}; this DIALOG variant requires ${expected}.`);
  let resolvedInput = statement.input;
  let binding: ClassicDialogPlan["binding"];
  if (statement.input.kind === "db-values") {
    const dbInput = statement.input;
    const requestedForm = dbInput.table.name;
    let resolvedSource = dataSources.find((candidate) => [candidate.formId, candidate.formName].some((name) => name.toLocaleLowerCase("en-US") === requestedForm.toLocaleLowerCase("en-US")));
    if (!resolvedSource) {
      const compatibleSources = dataSources.filter((candidate) => candidate.fields.some((field) => field.name.toLocaleLowerCase("en-US") === dbInput.variable.name.toLocaleLowerCase("en-US")));
      if (compatibleSources.length !== 1) throw new RangeError(`${requestedForm} is not an available project form identifier for DIALOG DBVALUES.`);
      resolvedSource = compatibleSources[0]!;
      binding = { requestedForm, resolvedForm: resolvedSource.formName, resolution: "single-compatible-form" };
    }
    const resolvedField = resolvedSource.fields.find((field) => field.name.toLocaleLowerCase("en-US") === dbInput.variable.name.toLocaleLowerCase("en-US"));
    if (!resolvedField) throw new RangeError(`${dbInput.variable.name} is not a field in ${resolvedSource.formName}.`);
    resolvedInput = {
      ...dbInput,
      table: { ...dbInput.table, name: resolvedSource.formName },
      variable: { ...dbInput.variable, name: resolvedField.name },
    };
  }
  const resolvedStatement = resolvedInput === statement.input ? statement : { ...statement, input: resolvedInput };
  const choices = resolveChoices(resolvedStatement, dataSources, variables);
  if (["choices", "db-values", "db-views", "databases", "db-variables"].includes(resolvedInput.kind) && choices.length === 0) {
    throw new RangeError(`DIALOG ${resolvedInput.kind.toUpperCase()} has no available choices.`);
  }
  const canonicalSource = buildClassicDialogCommand({
    prompt: statement.prompt,
    ...(statement.title ? { title: statement.title } : {}),
    ...(target ? { target: target.name } : {}),
    input: resolvedInput,
  });
  return {
    kind: "dialog", version: CLASSIC_DIALOG_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION, source, canonicalSource,
    prompt: statement.prompt, ...(statement.title ? { title: statement.title } : {}), ...(target ? { target } : {}), input: resolvedInput, choices, ...(binding ? { binding } : {}),
  };
}

export function validateClassicDialogValue(plan: ClassicDialogPlan, value: string | boolean): ClassicVariableValue {
  if (!plan.target || plan.input.kind === "message") throw new RangeError("This DIALOG does not produce a value.");
  if (plan.input.kind === "numeric") {
    const numeric = Number(value);
    if (typeof value !== "string" || !value.trim() || !Number.isFinite(numeric)) throw new RangeError(`${plan.target.name} requires a finite number.`);
    return numeric;
  }
  if (plan.input.kind === "yes-no") return value === true || value === "true";
  if (["choices", "db-values", "db-views", "databases", "db-variables"].includes(plan.input.kind)) {
    if (typeof value !== "string" || !plan.choices.includes(value)) throw new RangeError("Choose one of the displayed DIALOG values.");
    return value;
  }
  if (typeof value !== "string" || !value.trim()) throw new RangeError(`${plan.target.name} requires a value.`);
  if (plan.input.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError(`${plan.target.name} requires a date.`);
  if (plan.input.kind === "time" && !/^\d{2}:\d{2}(?::\d{2})?$/.test(value)) throw new RangeError(`${plan.target.name} requires a time.`);
  if (plan.input.kind === "datetime" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) throw new RangeError(`${plan.target.name} requires a date and time.`);
  return value;
}
