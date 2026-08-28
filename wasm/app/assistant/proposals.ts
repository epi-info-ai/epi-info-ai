import type { EpiAssistAction, EpiAssistContext, EpiAssistProposal } from "../contracts/assistant.ts";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, label: string, maximum = 800): string {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label} must be non-empty text.`);
  return value.trim().slice(0, maximum);
}

function knownField(context: EpiAssistContext, value: unknown, label: string): string {
  const name = text(value, label, 160);
  if (!context.fields.some((field) => field.name === name)) throw new RangeError(`${label} is not a field in the current form.`);
  return name;
}

function parseAction(value: unknown, context: EpiAssistContext): EpiAssistAction {
  if (!isObject(value)) throw new TypeError("Each proposed action must be an object.");
  if (value.kind === "open-data-quality") {
    if (!Array.isArray(value.fieldNames)) throw new TypeError("Data Quality fieldNames must be an array.");
    return { kind: value.kind, fieldNames: value.fieldNames.slice(0, 10).map((name) => knownField(context, name, "Data Quality field")) };
  }
  if (value.kind === "run-frequency") {
    const fieldName = knownField(context, value.fieldName, "Frequency field");
    const stratifyBy = value.stratifyBy === undefined || value.stratifyBy === ""
      ? undefined
      : knownField(context, value.stratifyBy, "Frequency stratification field");
    if (stratifyBy === fieldName) throw new TypeError("The Frequency and stratification fields must be different.");
    return { kind: value.kind, fieldName, ...(stratifyBy ? { stratifyBy } : {}) };
  }
  if (value.kind === "run-epi-curve") {
    const dateField = knownField(context, value.dateField, "Epi Curve date field");
    if (context.fields.find((field) => field.name === dateField)?.type !== "date") throw new TypeError("The Epi Curve date field must have Date type.");
    const groupField = value.groupField === undefined || value.groupField === ""
      ? undefined
      : knownField(context, value.groupField, "Epi Curve group field");
    return { kind: value.kind, dateField, ...(groupField ? { groupField } : {}) };
  }
  throw new RangeError("Granite proposed an action that Epi Info AI does not allow.");
}

export function parseEpiAssistProposal(value: unknown, context: EpiAssistContext): EpiAssistProposal {
  if (!isObject(value)) throw new TypeError("Granite did not return a proposal object.");
  if (!Array.isArray(value.actions)) throw new TypeError("The proposal must include an actions array.");
  return {
    summary: text(value.summary, "Proposal summary"),
    rationale: text(value.rationale, "Proposal rationale", 1600),
    actions: value.actions.slice(0, 5).map((action) => parseAction(action, context)),
  };
}

export function parseEpiAssistJson(response: string, context: EpiAssistContext): EpiAssistProposal {
  const fenced = response.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced ?? response.slice(response.indexOf("{"), response.lastIndexOf("}") + 1);
  if (!source.trim()) throw new SyntaxError("Granite did not return JSON. No action can be run.");
  return parseEpiAssistProposal(JSON.parse(source) as unknown, context);
}

function toolAction(value: unknown, context: EpiAssistContext): EpiAssistAction {
  if (!isObject(value)) throw new TypeError("A Granite tool call must be an object.");
  const name = text(value.name, "Tool name", 100);
  let argumentsValue = value.arguments;
  if (typeof argumentsValue === "string") argumentsValue = JSON.parse(argumentsValue) as unknown;
  if (!isObject(argumentsValue)) throw new TypeError(`${name} arguments must be an object.`);
  if (name === "open_data_quality") {
    return parseAction({ kind: "open-data-quality", fieldNames: argumentsValue.field_names }, context);
  }
  if (name === "run_frequency") {
    return parseAction({
      kind: "run-frequency",
      fieldName: argumentsValue.field_name,
      ...(argumentsValue.stratify_by === undefined ? {} : { stratifyBy: argumentsValue.stratify_by }),
    }, context);
  }
  if (name === "run_epi_curve") {
    return parseAction({
      kind: "run-epi-curve",
      dateField: argumentsValue.date_field,
      ...(argumentsValue.group_field === undefined ? {} : { groupField: argumentsValue.group_field }),
    }, context);
  }
  throw new RangeError(`Granite called unknown tool ${name}.`);
}

export function parseEpiAssistToolCalls(response: string, context: EpiAssistContext): EpiAssistProposal {
  const matches = [...response.matchAll(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi)];
  if (!matches.length) throw new SyntaxError("Granite did not return a complete native tool call.");
  const actions: EpiAssistAction[] = [];
  const rejected: string[] = [];
  for (const [index, match] of matches.entries()) {
    try {
      const source = match[1];
      if (!source) throw new SyntaxError("The tool call was empty.");
      actions.push(toolAction(JSON.parse(source) as unknown, context));
    } catch (error) {
      rejected.push(`call ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const unique = actions.filter((action, index) => actions.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(action)) === index);
  if (!unique.length) throw new TypeError(`No Granite tool call passed validation${rejected.length ? ` (${rejected.join("; ")})` : ""}.`);
  return {
    summary: `Granite proposed ${unique.length} reviewed action${unique.length === 1 ? "" : "s"} for ${context.formName}.`,
    rationale: `Each action came from a complete native Granite tool call and passed the host field/type allowlist.${rejected.length ? ` ${rejected.length} other call${rejected.length === 1 ? " was" : "s were"} discarded.` : ""}`,
    actions: unique,
  };
}

export function buildGuidedProposal(context: EpiAssistContext): EpiAssistProposal {
  const missing = [...context.fields].filter((field) => field.missing > 0).sort((a, b) => b.missingPercent - a.missingPercent);
  const category = context.fields.find((field) => !["command-button", "multiline"].includes(field.type));
  const date = context.fields.find((field) => field.type === "date");
  const actions: EpiAssistAction[] = [];
  if (missing.length) actions.push({ kind: "open-data-quality", fieldNames: missing.slice(0, 5).map((field) => field.name) });
  if (category) actions.push({ kind: "run-frequency", fieldName: category.name });
  if (date) actions.push({ kind: "run-epi-curve", dateField: date.name });
  return {
    summary: `Review ${context.formName} with existing Epi Info AI tools.`,
    rationale: "These deterministic guided suggestions use schema and completeness counts only. Load Granite to interpret a natural-language request locally.",
    actions,
  };
}
