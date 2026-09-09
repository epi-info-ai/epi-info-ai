import { buildGuidedProposal, parseEpiAssistNativeToolCalls, parseEpiAssistToolCalls } from "../app/assistant/proposals.ts";
import { resolveEpiAssistFrequencyIntent } from "../app/assistant/intent.ts";
import { EPI_ASSIST_MODELS, epiAssistModel } from "../app/assistant/models.ts";
import { EPI_ASSIST_CLOUD_CHOICES, requestCloudProposal, type EpiAssistCloudChoice } from "../app/assistant/gateway.ts";
import { EPI_ASSIST_CONTEXT_VERSION, type EpiAssistAction, type EpiAssistContext, type EpiAssistProposal, type EpiAssistRunMetadata } from "../app/contracts/assistant.ts";
import type { MapDataSource } from "../app/contracts/maps.ts";
import { buildDataQualityReport } from "../app/forms/data-quality.ts";

function requiredElement<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required Epi Assist element is missing: ${selector}`);
  return element;
}

function contextFrom(source: MapDataSource): EpiAssistContext {
  const report = buildDataQualityReport(source.formId, { name: source.formName, fields: source.fields }, source.records);
  return {
    version: EPI_ASSIST_CONTEXT_VERSION,
    projectName: source.projectName,
    formName: source.formName,
    recordCount: source.records.length,
    fields: source.fields.filter((field) => field.type !== "command-button").map((field) => {
      const quality = report.fields.find((candidate) => candidate.fieldName === field.name);
      return {
        name: field.name,
        prompt: field.prompt,
        type: field.type,
        missing: quality?.missing ?? 0,
        missingPercent: Number((((quality?.missing ?? 0) / Math.max(1, report.recordCount)) * 100).toFixed(1)),
        violations: quality?.violations ?? 0,
      };
    }),
  };
}

function actionLabel(action: EpiAssistAction, context: EpiAssistContext): string {
  const prompt = (name: string) => context.fields.find((field) => field.name === name)?.prompt ?? name;
  if (action.kind === "open-data-quality") return `Open Data Quality${action.fieldNames.length ? `: ${action.fieldNames.map(prompt).join(", ")}` : ""}`;
  if (action.kind === "run-frequency") return `Run Frequency: ${prompt(action.fieldName)}${action.stratifyBy ? ` by ${prompt(action.stratifyBy)}` : ""}`;
  return `Generate Epi Curve: ${prompt(action.dateField)}${action.groupField ? ` by ${prompt(action.groupField)}` : ""}`;
}

function clickModule(name: string): void {
  requiredElement<HTMLButtonElement>(`[data-module="${name}"]`).click();
}

function runAction(action: EpiAssistAction): void {
  requiredElement<HTMLDialogElement>("#epi-assist-dialog").close();
  if (action.kind === "open-data-quality") {
    clickModule("data");
    requiredElement<HTMLButtonElement>("#enter-data-quality").click();
    requestAnimationFrame(() => {
      document.querySelectorAll("#data-quality-fields tr").forEach((row) => row.classList.remove("assistant-focus-row"));
      const target = action.fieldNames.map((name) => document.querySelector<HTMLElement>(`#data-quality-fields tr[data-field-name="${CSS.escape(name)}"]`)).find(Boolean);
      target?.classList.add("assistant-focus-row");
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
    return;
  }
  if (action.kind === "run-frequency") {
    clickModule("classic");
    const field = requiredElement<HTMLSelectElement>("#frequency-field");
    const strata = requiredElement<HTMLSelectElement>("#frequency-strata-field");
    field.value = action.fieldName;
    field.dispatchEvent(new Event("change", { bubbles: true }));
    strata.value = action.stratifyBy ?? "";
    strata.dispatchEvent(new Event("change", { bubbles: true }));
    const runButton = requiredElement<HTMLButtonElement>("#frequency-run");
    if (runButton.form) runButton.form.requestSubmit(runButton);
    else runButton.click();
    return;
  }
  clickModule("dashboard");
  const date = requiredElement<HTMLSelectElement>("#epi-curve-date-field");
  const group = requiredElement<HTMLSelectElement>("#epi-curve-status-field");
  date.value = action.dateField;
  group.value = action.groupField ?? "";
  date.dispatchEvent(new Event("change", { bubbles: true }));
  group.dispatchEvent(new Event("change", { bubbles: true }));
  requiredElement<HTMLButtonElement>("#epi-curve-run").click();
}

function isRunMetadata(value: unknown): value is EpiAssistRunMetadata {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<EpiAssistRunMetadata>;
  return candidate.schemaVersion === "1.0.0"
    && typeof candidate.model?.id === "string"
    && typeof candidate.model.revision === "string"
    && typeof candidate.prompt?.system === "string"
    && typeof candidate.prompt.user === "string";
}

function renderRunMetadata(metadata?: EpiAssistRunMetadata): void {
  const details = requiredElement<HTMLDetailsElement>("#epi-assist-run-details");
  details.hidden = !metadata;
  details.open = false;
  if (!metadata) return;
  requiredElement("#epi-assist-run-model").textContent = `${metadata.model.id} @ ${metadata.model.revision} · ${metadata.model.device}/${metadata.model.dtype}`;
  requiredElement("#epi-assist-run-runtime").textContent = `${metadata.runtime.name} ${metadata.runtime.version} · ${metadata.prompt.systemVersion} · ${metadata.toolSchemaVersion}`;
  requiredElement("#epi-assist-run-user-prompt").textContent = metadata.prompt.user;
  requiredElement("#epi-assist-run-system-prompt").textContent = metadata.prompt.system;
  requiredElement("#epi-assist-run-generation").textContent = JSON.stringify(metadata.generation, null, 2);
  const requestRow = requiredElement<HTMLElement>("#epi-assist-run-request-row");
  requestRow.hidden = !metadata.requestId;
  requiredElement("#epi-assist-run-request-id").textContent = metadata.requestId ?? "";
}

function renderProposal(proposal: EpiAssistProposal, context: EpiAssistContext, source: "granite" | "guided" | "granite-fallback" | "cloud" | "cloud-fallback", metadata?: EpiAssistRunMetadata): void {
  const modelLabel = metadata ? EPI_ASSIST_MODELS.find((model) => model.modelId === metadata.model.id)?.label ?? metadata.model.id : "IBM Granite";
  requiredElement("#epi-assist-result").hidden = false;
  requiredElement("#epi-assist-result-source").textContent = source === "granite"
    ? `Local proposal from ${modelLabel}`
    : source === "cloud"
      ? `Gateway proposal from ${metadata?.provider?.id ?? "configured foundation model"} · ${metadata?.model.id ?? "model not reported"}`
      : source === "cloud-fallback"
        ? "Safe guided fallback after a foundation-model gateway error"
    : source === "granite-fallback"
      ? "Safe guided fallback after an incomplete Granite response"
      : "Deterministic guided suggestions (Granite not used)";
  requiredElement("#epi-assist-result-summary").textContent = proposal.summary;
  requiredElement("#epi-assist-result-rationale").textContent = proposal.rationale;
  renderRunMetadata(metadata);
  const actions = proposal.actions.map((action) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "primary-button";
    button.textContent = actionLabel(action, context);
    button.addEventListener("click", () => runAction(action));
    item.append(button);
    return item;
  });
  if (!actions.length) {
    const item = document.createElement("li");
    item.textContent = "No allowed action was proposed. Nothing will run.";
    actions.push(item);
  }
  requiredElement("#epi-assist-actions").replaceChildren(...actions);
}

export function initializeEpiAssist(getSource: () => MapDataSource): void {
  const dialog = requiredElement<HTMLDialogElement>("#epi-assist-dialog");
  const status = requiredElement("#epi-assist-status");
  const loadButton = requiredElement<HTMLButtonElement>("#epi-assist-load");
  const askButton = requiredElement<HTMLButtonElement>("#epi-assist-ask");
  const prompt = requiredElement<HTMLTextAreaElement>("#epi-assist-prompt");
  const modelSelect = requiredElement<HTMLSelectElement>("#epi-assist-model");
  const modelDescription = requiredElement<HTMLElement>("#epi-assist-model-description");
  const providerBadge = requiredElement<HTMLElement>("#epi-assist-provider-badge");
  const privacy = requiredElement<HTMLElement>("#epi-assist-privacy");
  let worker: Worker | null = null;
  let ready = false;
  let pendingContext: EpiAssistContext | null = null;
  let startupTimer: number | null = null;
  let workerFailed = false;
  const selectedModel = () => epiAssistModel(modelSelect.value);
  const selectedCloud = (): EpiAssistCloudChoice | undefined => EPI_ASSIST_CLOUD_CHOICES.find((choice) => choice.key === modelSelect.value);

  const clearStartupTimer = () => {
    if (startupTimer !== null) window.clearTimeout(startupTimer);
    startupTimer = null;
  };

  const reportWorkerStartupFailure = (message: string) => {
    clearStartupTimer();
    workerFailed = true;
    ready = false;
    status.textContent = `${message} The model was not loaded and no project data was sent.`;
    loadButton.disabled = false;
    askButton.disabled = true;
  };

  const renderSelectedModel = () => {
    const cloud = selectedCloud();
    if (cloud) {
      modelDescription.textContent = `${cloud.label} through a deployment-configured, same-origin Epi Assist gateway. The gateway resolves and audits the exact model version.`;
      providerBadge.textContent = "Managed gateway";
      privacy.innerHTML = "<strong>Only the prompt, field definitions, and aggregate quality counts leave the browser.</strong> Record values and provider API keys are never sent to or stored in this client. Review your organization's approved AI and data-use policy before enabling a gateway.";
      loadButton.textContent = `Use ${cloud.modelAlias === "chatgpt" ? "ChatGPT" : "Claude"}`;
      askButton.textContent = `Ask ${cloud.modelAlias === "chatgpt" ? "ChatGPT" : "Claude"}`;
      return;
    }
    const selected = selectedModel();
    const execution = selected.device === "wasm" ? "CPU via WebAssembly; broad browser compatibility but slower inference" : "WebGPU; requires a usable GPU adapter";
    modelDescription.textContent = `${execution}; approximately ${selected.approximateSize} for the selected ${selected.dtype} model files. Changing models unloads the current Worker.`;
    loadButton.textContent = `Load ${selected.label.replace(" Instruct", "")}`;
    askButton.textContent = "Ask local Granite";
    providerBadge.textContent = "Local inference";
    privacy.innerHTML = "<strong>Your prompt and project data stay in this browser.</strong> First use retrieves model weights from the model host and stores them in browser cache when supported. Epi Assist supplies only field definitions and aggregate quality counts—not record values—to Granite.";
  };
  renderSelectedModel();

  const ensureWorker = () => {
    if (worker) return worker;
    // Resolve from the deployed page, not import.meta.url: esbuild may place this
    // module in /chunks while the worker entry point remains at the app root.
    worker = new Worker(new URL("./epi-assist-worker.js?v=8", document.baseURI), { type: "module" });
    worker.addEventListener("message", (event: MessageEvent<Record<string, unknown>>) => {
      if (workerFailed) return;
      clearStartupTimer();
      if (event.data.type === "status") status.textContent = String(event.data.message ?? "Working locally…");
      if (event.data.type === "progress") {
        const percent = typeof event.data.progress === "number" ? ` ${Math.round(event.data.progress)}%` : "";
        const file = typeof event.data.file === "string" ? ` · ${event.data.file.split("/").at(-1)}` : "";
        const stage = typeof event.data.status === "string" ? ` (${event.data.status})` : "";
        status.textContent = `Preparing Granite model${percent}${stage}${file}. First use downloads model weights; later uses can open the browser cache.`;
      }
      if (event.data.type === "ready") {
        ready = true;
        loadButton.disabled = true;
        askButton.disabled = false;
        status.textContent = `${String(event.data.label ?? selectedModel().label)} is ready for local inference.`;
      }
      if (event.data.type === "result") {
        try {
          if (!pendingContext) throw new Error("The current form context is no longer available.");
          const metadata = isRunMetadata(event.data.metadata) ? event.data.metadata : undefined;
          const proposal = parseEpiAssistToolCalls(String(event.data.response ?? ""), pendingContext);
          const expectedFrequency = resolveEpiAssistFrequencyIntent(metadata?.prompt.user ?? "", pendingContext);
          if (expectedFrequency && !proposal.actions.some((action) => action.kind === "run-frequency"
            && action.fieldName === expectedFrequency.fieldName
            && action.stratifyBy === expectedFrequency.stratifyBy)) {
            throw new Error(`Granite did not preserve the requested ${expectedFrequency.fieldName} by ${expectedFrequency.stratifyBy} distribution.`);
          }
          renderProposal(proposal, pendingContext, "granite", metadata);
          status.textContent = "Proposal ready. Review an action before running it.";
        } catch (error) {
          if (!pendingContext) {
            status.textContent = `${error instanceof Error ? error.message : String(error)} No action was enabled.`;
          } else {
            renderProposal(buildGuidedProposal(pendingContext), pendingContext, "granite-fallback");
            status.textContent = `${error instanceof Error ? error.message : String(error)} Granite's text was not trusted; safe schema-derived actions are available below.`;
          }
        } finally {
          askButton.disabled = !ready;
        }
      }
      if (event.data.type === "error") {
        reportWorkerStartupFailure(String(event.data.message ?? "Granite failed to start."));
      }
    });
    worker.addEventListener("error", (event) => {
      const detail = event.message ? `: ${event.message}` : ".";
      reportWorkerStartupFailure(`The local Granite worker could not start${detail}`);
    });
    worker.addEventListener("messageerror", () => {
      reportWorkerStartupFailure("The browser could not read a message from the local Granite worker.");
    });
    return worker;
  };

  for (const opener of document.querySelectorAll<HTMLElement>("[data-open-epi-assist]")) opener.addEventListener("click", () => dialog.showModal());
  for (const closer of document.querySelectorAll<HTMLElement>("[data-close-epi-assist]")) closer.addEventListener("click", () => dialog.close());
  modelSelect.addEventListener("change", () => {
    worker?.terminate();
    clearStartupTimer();
    worker = null;
    workerFailed = false;
    ready = false;
    pendingContext = null;
    loadButton.disabled = false;
    askButton.disabled = true;
    requiredElement<HTMLElement>("#epi-assist-result").hidden = true;
    renderSelectedModel();
    const cloud = selectedCloud();
    status.textContent = cloud
      ? `${cloud.label} selected. Click Use to acknowledge the managed gateway boundary; no request is sent until Ask.`
      : `${selectedModel().label} selected. Loading is user initiated.`;
  });
  loadButton.addEventListener("click", () => {
    const cloud = selectedCloud();
    if (cloud) {
      ready = true;
      loadButton.disabled = true;
      askButton.disabled = false;
      status.textContent = `${cloud.label} is enabled through the configured gateway. No provider request has been made yet.`;
      return;
    }
    workerFailed = false;
    loadButton.disabled = true;
    status.textContent = "Starting the local Granite model…";
    startupTimer = window.setTimeout(() => {
      reportWorkerStartupFailure("The local Granite worker did not respond within 15 seconds. Check browser content-blocking policies or choose the CPU compatibility model.");
      worker?.terminate();
      worker = null;
    }, 15_000);
    ensureWorker().postMessage({ type: "load", modelKey: selectedModel().key });
  });
  requiredElement("#epi-assist-guided").addEventListener("click", () => {
    const context = contextFrom(getSource());
    renderProposal(buildGuidedProposal(context), context, "guided");
    status.textContent = "Guided suggestions ready. Granite was not loaded or used.";
  });
  askButton.addEventListener("click", () => {
    const request = prompt.value.trim();
    if (!request) {
      status.textContent = "Describe the review or analysis you want Epi Assist to propose.";
      prompt.focus();
      return;
    }
    pendingContext = contextFrom(getSource());
    askButton.disabled = true;
    const cloud = selectedCloud();
    if (cloud) {
      status.textContent = `Sending minimized context to the configured ${cloud.provider} gateway…`;
      void requestCloudProposal(cloud, request, pendingContext).then(({ response, metadata }) => {
        if (!pendingContext) throw new Error("The current form context is no longer available.");
        const proposal = parseEpiAssistNativeToolCalls(response.toolCalls, pendingContext, cloud.modelAlias === "chatgpt" ? "ChatGPT" : "Claude");
        const expectedFrequency = resolveEpiAssistFrequencyIntent(request, pendingContext);
        if (expectedFrequency && !proposal.actions.some((action) => action.kind === "run-frequency"
          && action.fieldName === expectedFrequency.fieldName
          && action.stratifyBy === expectedFrequency.stratifyBy)) {
          throw new Error(`The model did not preserve the requested ${expectedFrequency.fieldName} by ${expectedFrequency.stratifyBy} distribution.`);
        }
        renderProposal(proposal, pendingContext, "cloud", metadata);
        status.textContent = "Proposal ready. Review an action before running it.";
      }).catch((error: unknown) => {
        if (pendingContext) renderProposal(buildGuidedProposal(pendingContext), pendingContext, "cloud-fallback");
        status.textContent = `${error instanceof Error ? error.message : String(error)} No provider output was trusted; safe guided actions are shown instead.`;
      }).finally(() => { askButton.disabled = !ready; });
      return;
    }
    status.textContent = "Sending schema and aggregate counts to Granite inside this browser…";
    ensureWorker().postMessage({ type: "generate", modelKey: selectedModel().key, prompt: request, context: pendingContext });
  });
}
