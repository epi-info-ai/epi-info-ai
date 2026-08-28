import { buildGuidedProposal, parseEpiAssistJson } from "../app/assistant/proposals.ts";
import { EPI_ASSIST_CONTEXT_VERSION, type EpiAssistAction, type EpiAssistContext, type EpiAssistProposal } from "../app/contracts/assistant.ts";
import type { MapDataSource } from "../app/contracts/maps.ts";
import { buildDataQualityReport } from "../app/forms/data-quality.ts";

const MODEL_LABEL = "IBM Granite 4.0 350M Instruct";

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
  if (action.kind === "run-frequency") return `Run Frequency: ${prompt(action.fieldName)}`;
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
    field.value = action.fieldName;
    field.dispatchEvent(new Event("change", { bubbles: true }));
    requiredElement<HTMLButtonElement>("#frequency-run").click();
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

function renderProposal(proposal: EpiAssistProposal, context: EpiAssistContext, source: "granite" | "guided" | "granite-fallback"): void {
  requiredElement("#epi-assist-result").hidden = false;
  requiredElement("#epi-assist-result-source").textContent = source === "granite"
    ? `Local proposal from ${MODEL_LABEL}`
    : source === "granite-fallback"
      ? "Safe guided fallback after an incomplete Granite response"
      : "Deterministic guided suggestions (Granite not used)";
  requiredElement("#epi-assist-result-summary").textContent = proposal.summary;
  requiredElement("#epi-assist-result-rationale").textContent = proposal.rationale;
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
  let worker: Worker | null = null;
  let ready = false;
  let pendingContext: EpiAssistContext | null = null;

  const ensureWorker = () => {
    if (worker) return worker;
    worker = new Worker(new URL("./epi-assist-worker.js", import.meta.url), { type: "module" });
    worker.addEventListener("message", (event: MessageEvent<Record<string, unknown>>) => {
      if (event.data.type === "status") status.textContent = String(event.data.message ?? "Working locally…");
      if (event.data.type === "progress") {
        const percent = typeof event.data.progress === "number" ? ` ${Math.round(event.data.progress)}%` : "";
        status.textContent = `Preparing Granite model${percent}. First use downloads model weights; later uses can open the browser cache.`;
      }
      if (event.data.type === "ready") {
        ready = true;
        loadButton.disabled = true;
        askButton.disabled = false;
        status.textContent = `${MODEL_LABEL} is ready for local inference.`;
      }
      if (event.data.type === "result") {
        try {
          if (!pendingContext) throw new Error("The current form context is no longer available.");
          renderProposal(parseEpiAssistJson(String(event.data.response ?? ""), pendingContext), pendingContext, "granite");
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
        status.textContent = `${String(event.data.message ?? "Granite failed to start.")} No project data was sent to a server.`;
        loadButton.disabled = false;
        askButton.disabled = true;
      }
    });
    return worker;
  };

  for (const opener of document.querySelectorAll<HTMLElement>("[data-open-epi-assist]")) opener.addEventListener("click", () => dialog.showModal());
  for (const closer of document.querySelectorAll<HTMLElement>("[data-close-epi-assist]")) closer.addEventListener("click", () => dialog.close());
  loadButton.addEventListener("click", () => {
    loadButton.disabled = true;
    status.textContent = "Starting the local Granite model…";
    ensureWorker().postMessage({ type: "load" });
  });
  requiredElement("#epi-assist-guided").addEventListener("click", () => {
    const context = contextFrom(getSource());
    renderProposal(buildGuidedProposal(context), context, "guided");
    status.textContent = "Guided suggestions ready. Granite was not loaded or used.";
  });
  askButton.addEventListener("click", () => {
    const request = prompt.value.trim();
    if (!request) {
      status.textContent = "Describe the review or analysis you want Granite to propose.";
      prompt.focus();
      return;
    }
    pendingContext = contextFrom(getSource());
    askButton.disabled = true;
    status.textContent = "Sending schema and aggregate counts to Granite inside this browser…";
    ensureWorker().postMessage({ type: "generate", prompt: request, context: pendingContext });
  });
}
