import type {
  EpiAssistContext,
  EpiAssistGatewayRequest,
  EpiAssistGatewayResponse,
  EpiAssistRunMetadata,
} from "../contracts/assistant.ts";

export const EPI_ASSIST_GATEWAY_PATH = "api/epi-assist/v1/propose";

export type EpiAssistCloudChoice = {
  key: "openai-chatgpt" | "anthropic-claude";
  provider: "openai" | "anthropic";
  modelAlias: "chatgpt" | "claude";
  label: string;
};

export const EPI_ASSIST_CLOUD_CHOICES: readonly EpiAssistCloudChoice[] = [
  { key: "openai-chatgpt", provider: "openai", modelAlias: "chatgpt", label: "OpenAI — ChatGPT models" },
  { key: "anthropic-claude", provider: "anthropic", modelAlias: "claude", label: "Anthropic — Claude models" },
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function epiAssistGatewayUrl(documentBase = document.baseURI): URL {
  return new URL(EPI_ASSIST_GATEWAY_PATH, documentBase);
}

export async function requestCloudProposal(
  choice: EpiAssistCloudChoice,
  prompt: string,
  context: EpiAssistContext,
  fetcher: typeof fetch = fetch,
  endpoint = epiAssistGatewayUrl(),
  expectedOrigin = location.origin,
): Promise<{ response: EpiAssistGatewayResponse; metadata: EpiAssistRunMetadata }> {
  if (endpoint.origin !== expectedOrigin) throw new Error("Epi Assist cloud gateways must be same-origin.");
  const request: EpiAssistGatewayRequest = {
    schemaVersion: "1.0.0",
    provider: choice.provider,
    modelAlias: choice.modelAlias,
    prompt,
    context,
  };
  const result = await fetcher(endpoint, {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(request),
  });
  if (!result.ok) throw new Error(`The Epi Assist gateway returned HTTP ${result.status}.`);
  const value: unknown = await result.json();
  if (!isObject(value) || value.schemaVersion !== "1.0.0") throw new Error("The Epi Assist gateway returned an unsupported response.");
  if (value.provider !== choice.provider) throw new Error("The Epi Assist gateway returned the wrong provider.");
  if (!isObject(value.model) || typeof value.model.id !== "string" || typeof value.model.revision !== "string") throw new Error("The gateway response did not identify the resolved model.");
  if (typeof value.requestId !== "string" || !value.requestId) throw new Error("The gateway response did not include an audit request ID.");
  if (!Array.isArray(value.toolCalls)) throw new Error("The gateway response did not include native tool calls.");
  if (!isObject(value.audit) || typeof value.audit.systemVersion !== "string" || typeof value.audit.toolSchemaVersion !== "string") throw new Error("The gateway response did not include prompt and tool audit versions.");
  const response = value as unknown as EpiAssistGatewayResponse;
  return {
    response,
    metadata: {
      schemaVersion: "1.0.0",
      provider: { id: choice.provider, mode: "gateway" },
      model: { id: response.model.id, revision: response.model.revision, device: "managed", dtype: "provider-managed" },
      runtime: { name: "epi-assist-gateway", version: response.schemaVersion },
      prompt: { systemVersion: response.audit.systemVersion, system: "Managed by the configured Epi Assist gateway.", user: prompt },
      toolSchemaVersion: response.audit.toolSchemaVersion,
      contextVersion: context.version,
      generation: { providerManaged: true },
      requestId: response.requestId,
    },
  };
}
