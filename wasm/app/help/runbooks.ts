export interface UiRunbookStep {
  id: string;
  title: string;
  instruction: string;
  target: string;
  advanceOn?: "click" | "change";
}

export interface UiRunbook {
  id: string;
  title: string;
  description: string;
  prerequisite: string;
  module: "classic" | "forms" | "data" | "dashboard" | "maps" | "statcalc";
  steps: readonly UiRunbookStep[];
}

export const UI_RUNBOOKS_VERSION = "ui-runbooks-v0.1.0" as const;

export const UI_RUNBOOKS: readonly UiRunbook[] = [{
  id: "foodborne-program-editor",
  title: "Foodborne Program Editor walkthrough",
  description: "Open, verify, run, and audit a dataset-matched foodborne example in the Program Editor.",
  prerequisite: "The Foodborne Outbreak Investigation form and its 96 example records must be loaded.",
  module: "classic",
  steps: [
    {
      id: "orient",
      title: "Orient to the Program Editor",
      instruction: "The runbook has opened Classic Analysis. The familiar Program Editor remains the visible, auditable source of every command. Select Next when you are ready.",
      target: "#classic-program-title",
    },
    {
      id: "open-program",
      title: "Open a program",
      instruction: "Select Open Pgm. The runbook will continue when the program dialog opens.",
      target: "#classic-program-toolbar-open",
      advanceOn: "click",
    },
    {
      id: "choose-example",
      title: "Choose the foodborne example",
      instruction: "Choose a foodborne example from the list. Examples are offered only when their matching dataset is loaded; Life-stage age groups by sex is a concise first run.",
      target: "#classic-program-example",
      advanceOn: "change",
    },
    {
      id: "load-example",
      title: "Load visible source",
      instruction: "Select Load Example. This loads source into the editor but does not execute it.",
      target: "#classic-program-load-example",
      advanceOn: "click",
    },
    {
      id: "verify",
      title: "Verify the typed program",
      instruction: "Select Verify Program. Review the live syntax result before deciding whether to run anything.",
      target: "#classic-program-verify",
      advanceOn: "click",
    },
    {
      id: "run",
      title: "Run the reviewed commands",
      instruction: "Select Run Commands only after reviewing the source. Wait for the Program completed message before continuing.",
      target: "#classic-program-run",
    },
    {
      id: "history",
      title: "Inspect the audit history",
      instruction: "After the run completes, select History to inspect command source, status, plan version, and result summaries.",
      target: "#classic-output-history",
      advanceOn: "click",
    },
    {
      id: "complete",
      title: "Runbook complete",
      instruction: "The foodborne program remains visible in the editor, its outputs remain available, and its command history can be inspected immediately.",
      target: "#classic-program-history-output",
    },
  ],
}];

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing runbook element ${selector}`);
  return element;
}

export function initializeUiRunbooks(): void {
  const library = requiredElement<HTMLDialogElement>("#runbook-library-dialog");
  const select = requiredElement<HTMLSelectElement>("#runbook-select");
  const description = requiredElement<HTMLElement>("#runbook-description");
  const prerequisite = requiredElement<HTMLElement>("#runbook-prerequisite");
  const start = requiredElement<HTMLButtonElement>("#runbook-start");
  const coach = requiredElement<HTMLElement>("#runbook-coach");
  const progress = requiredElement<HTMLElement>("#runbook-progress");
  const title = requiredElement<HTMLElement>("#runbook-step-title");
  const instruction = requiredElement<HTMLElement>("#runbook-step-instruction");
  const back = requiredElement<HTMLButtonElement>("#runbook-back");
  const next = requiredElement<HTMLButtonElement>("#runbook-next");
  const stop = requiredElement<HTMLButtonElement>("#runbook-stop");
  let active: UiRunbook | undefined;
  let stepIndex = 0;
  let highlighted: HTMLElement | undefined;

  select.replaceChildren(...UI_RUNBOOKS.map((runbook) => new Option(runbook.title, runbook.id)));

  const selectedRunbook = (): UiRunbook => UI_RUNBOOKS.find(({ id }) => id === select.value) ?? UI_RUNBOOKS[0]!;
  const renderLibrary = (): void => {
    const runbook = selectedRunbook();
    description.textContent = runbook.description;
    prerequisite.textContent = `Before you begin: ${runbook.prerequisite}`;
  };
  renderLibrary();
  select.addEventListener("change", renderLibrary);

  const clearHighlight = (): void => {
    highlighted?.classList.remove("runbook-highlight");
    highlighted = undefined;
  };
  const stopRunbook = (): void => {
    clearHighlight();
    active = undefined;
    coach.hidden = true;
  };
  const renderStep = (): void => {
    if (!active) return;
    clearHighlight();
    const step = active.steps[stepIndex];
    if (!step) return stopRunbook();
    progress.textContent = `Step ${stepIndex + 1} of ${active.steps.length}`;
    title.textContent = step.title;
    instruction.textContent = step.instruction;
    back.disabled = stepIndex === 0;
    next.textContent = stepIndex === active.steps.length - 1 ? "Finish" : "Next";
    next.disabled = Boolean(step.advanceOn);
    const target = document.querySelector<HTMLElement>(step.target);
    if (target) {
      highlighted = target;
      target.classList.add("runbook-highlight");
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  };
  const move = (offset: number): void => {
    if (!active) return;
    const candidate = stepIndex + offset;
    if (candidate >= active.steps.length) return stopRunbook();
    stepIndex = Math.max(0, candidate);
    window.setTimeout(renderStep, 0);
  };

  for (const trigger of document.querySelectorAll<HTMLElement>("#help-runbooks, [aria-label='Help'].icon-button")) {
    trigger.addEventListener("click", () => {
      document.querySelector<HTMLDetailsElement>("#help-menu")?.removeAttribute("open");
      renderLibrary();
      library.showModal();
    });
  }
  start.addEventListener("click", () => {
    active = selectedRunbook();
    stepIndex = 0;
    library.close("start");
    requiredElement<HTMLButtonElement>(`[data-module="${active.module}"]`).click();
    coach.hidden = false;
    window.setTimeout(renderStep, 0);
  });
  back.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  stop.addEventListener("click", stopRunbook);
  library.addEventListener("close", () => {
    if (library.returnValue !== "start") clearHighlight();
  });

  const advanceFromAction = (event: Event): void => {
    if (!active) return;
    const step = active.steps[stepIndex];
    if (!step?.advanceOn || step.advanceOn !== event.type) return;
    const origin = event.target instanceof Element ? event.target.closest(step.target) : null;
    if (origin) move(1);
  };
  document.addEventListener("click", advanceFromAction);
  document.addEventListener("change", advanceFromAction);
}
