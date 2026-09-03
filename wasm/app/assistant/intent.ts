import type { EpiAssistContext } from "../contracts/assistant.ts";

export interface EpiAssistFrequencyIntent {
  kind: "run-frequency";
  fieldName: string;
  stratifyBy: string;
}

function normalized(value: string): string {
  return value.trim().replace(/[?.!]+$/u, "").replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

function resolveField(context: EpiAssistContext, phrase: string): string | undefined {
  const candidate = normalized(phrase).replace(/^(?:the|a|an)\s+/u, "");
  return context.fields.find((field) => [field.name, field.prompt].some((value) => normalized(value) === candidate))?.name;
}

/**
 * Resolve the deliberately narrow V0.1 distribution-by grammar before Granite
 * sees the request. This grounds the model in real field identifiers; it does
 * not create or execute an analysis action.
 */
export function resolveEpiAssistFrequencyIntent(prompt: string, context: EpiAssistContext): EpiAssistFrequencyIntent | null {
  const request = prompt.trim();
  const match = request.match(/^(?:please\s+)?(?:show|display|run|generate|create|give me)\s+(?:the\s+)?(.+?)\s+distribution\s+by\s+(.+?)\s*[?.!]*$/iu)
    ?? request.match(/^(?:please\s+)?(?:show|display|run|generate|create|give me)\s+(?:the\s+)?distribution\s+of\s+(.+?)\s+by\s+(.+?)\s*[?.!]*$/iu);
  if (!match?.[1] || !match[2]) return null;
  const fieldName = resolveField(context, match[1]);
  const stratifyBy = resolveField(context, match[2]);
  if (!fieldName || !stratifyBy || fieldName === stratifyBy) return null;
  return { kind: "run-frequency", fieldName, stratifyBy };
}
