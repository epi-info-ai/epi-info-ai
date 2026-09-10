export interface UiRunbookStep {
  id: string;
  title: string;
  instruction: string;
  target: string;
  advanceOn?: "click" | "change";
  advanceTargets?: readonly string[];
}

export interface UiRunbook {
  id: string;
  title: string;
  description: string;
  prerequisite: string;
  module: "classic" | "forms" | "data" | "dashboard" | "maps" | "statcalc";
  steps: readonly UiRunbookStep[];
}

export const UI_RUNBOOKS_VERSION = "ui-runbooks-v0.3.1" as const;

export const UI_RUNBOOKS: readonly UiRunbook[] = [
  {
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
        title: "Choose a foodborne program",
        instruction: "Choose the saved foodborne command tour or a dataset-matched example. Compatible examples appear only when their matching dataset is loaded.",
        target: ".classic-program-dialog-body",
        advanceOn: "change",
        advanceTargets: ["#classic-program-dialog-project", "#classic-program-example", "#classic-program-file"],
      },
      {
        id: "load-example",
        title: "Load visible source",
        instruction: "Select Open for a saved program or Load Example for a compatible example. This loads visible source but does not execute it.",
        target: ".legacy-dialog-actions",
        advanceOn: "click",
        advanceTargets: ["#classic-program-dialog-primary", "#classic-program-load-example"],
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
  },
  {
    id: "encrypted-project-package",
    title: "Encrypted complete-project package walkthrough",
    description: "Inventory, archive, encrypt, and hand off a complete portable project while keeping its passphrase separate.",
    prerequisite: "Open the project you intend to share. Any attached offline PMTiles archive must still be available and pass its integrity checks.",
    module: "data",
    steps: [
      {
        id: "orient",
        title: "Confirm the active project",
        instruction: "The runbook has opened Enter Data so you can confirm the active project and records. The encrypted project export includes every project form—not just the current form—plus saved programs, code tables, study-area metadata, audit history, PMTiles, GeoJSON, and GeoTIFF map assets.",
        target: "#data-title",
      },
      {
        id: "open-application-file",
        title: "Open the application File menu",
        instruction: "Open the top-level File menu. Complete-project backup and restore belong here; Enter Data's Package For Transport remains the familiar filtered, data-only workflow.",
        target: "#file-menu",
        advanceOn: "click",
      },
      {
        id: "open-encrypted-export",
        title: "Choose Save Encrypted Project",
        instruction: "Choose Save Encrypted Project. This opens an inventory before any archive is created or downloaded.",
        target: "#file-save-encrypted-project",
        advanceOn: "click",
      },
      {
        id: "review-inventory",
        title: "Review the artifact inventory",
        instruction: "Confirm the project, form, record, program, and embedded-map-asset counts. The disclosure identifies the current V0.2 attachment boundary; unsupported assets must never be silently omitted.",
        target: "#encrypted-project-save-summary",
      },
      {
        id: "name-package",
        title: "Name the portable package",
        instruction: "Choose a recognizable package name. The downloaded encrypted file uses the .epiax extension.",
        target: "#encrypted-project-save-name",
      },
      {
        id: "protect-package",
        title: "Protect the complete archive",
        instruction: "Enter and verify a strong passphrase of at least 12 characters. The passphrase is neither stored in the project nor included with the package.",
        target: "#encrypted-project-save-security",
      },
      {
        id: "create-package",
        title: "Create the encrypted project",
        instruction: "Select Create Encrypted Project. Epi Info AI first assembles and validates the portable .epia archive, then applies authenticated encryption and downloads the resulting .epiax. Nothing is transmitted automatically.",
        target: "#encrypted-project-save-create",
        advanceOn: "click",
      },
      {
        id: "confirm-package",
        title: "Confirm successful creation",
        instruction: "Wait for the completion message and verify its artifact counts. Retain the encrypted file; communicate its passphrase through a different trusted channel.",
        target: "#encrypted-project-save-status",
      },
      {
        id: "close-export",
        title: "Close the exporter",
        instruction: "Close the exporter after the .epiax download completes. The active project remains unchanged.",
        target: "#encrypted-project-save-close",
        advanceOn: "click",
      },
      {
        id: "open-enter-file",
        title: "Open the Enter Data File menu",
        instruction: "Open Enter Data's File menu to reach the optional direct browser handoff. You may instead transfer the encrypted file through an approved external channel.",
        target: "#enter-file-menu",
        advanceOn: "click",
      },
      {
        id: "open-secure-share",
        title: "Open Secure Epi Info Share",
        instruction: "Choose Secure Epi Info Share. It sends only the already encrypted package and never sends its passphrase.",
        target: "#enter-menu-secure-share",
        advanceOn: "click",
      },
      {
        id: "handoff",
        title: "Hand off the encrypted package",
        instruction: "The package just created is available to the sender, or you may select another .epiax file. Continue with the dedicated Secure Epi Info Share runbook for peer pairing and fingerprint verification. On the receiving browser, use File > Open Encrypted Project to decrypt, validate, review, and explicitly open the complete project.",
        target: "#secure-share-send-selection",
      },
    ],
  },
  {
    id: "secure-epi-info-share",
    title: "Secure Epi Info Share walkthrough",
    description: "Pair two browsers manually, verify their fingerprints, transfer an encrypted .epiax package, and review it before import.",
    prerequisite: "Open a project with records and create or obtain an encrypted .epiax package. To complete the walkthrough, have Epi Info AI open in a second browser or device and use a trusted channel for the pairing codes.",
    module: "data",
    steps: [
      {
        id: "orient",
        title: "Orient to Enter Data",
        instruction: "Secure Epi Info Share is a new branch beside the familiar encrypted Package For Transport workflow. It transfers only an already encrypted .epiax package.",
        target: "#data-title",
      },
      {
        id: "open-file-menu",
        title: "Open the File menu",
        instruction: "Open File. If you do not yet have an .epiax package, first use Package For Transport and keep its passphrase separate from the package.",
        target: "#enter-file-menu",
        advanceOn: "click",
      },
      {
        id: "open-share",
        title: "Open Secure Epi Info Share",
        instruction: "Choose Secure Epi Info Share. This opens the manual pairing workspace; it does not send anything automatically.",
        target: "#enter-menu-secure-share",
        advanceOn: "click",
      },
      {
        id: "review-boundary",
        title: "Review the connection boundary",
        instruction: "Read the V0.1 warning. There is no discovery, signaling, or TURN service, so restrictive networks may prevent a direct connection.",
        target: "#secure-share-dialog .data-import-preview-warning",
      },
      {
        id: "choose-package",
        title: "Choose the encrypted package",
        instruction: "On the sending browser, select the .epiax package. The encrypted bytes are transferred; the package passphrase is not transmitted.",
        target: "#secure-share-send-file",
        advanceOn: "change",
      },
      {
        id: "create-offer",
        title: "Create the sender offer",
        instruction: "Select 1. Create Offer, then send the offer code to the receiver through a trusted channel. Do not treat an offer code as a package passphrase.",
        target: "#secure-share-create-offer",
      },
      {
        id: "create-answer",
        title: "Create the receiver answer",
        instruction: "On the receiving browser, paste the sender offer and select 1. Create Answer. Return the answer code to the sender through the trusted channel.",
        target: "#secure-share-receive-offer",
      },
      {
        id: "verify-fingerprints",
        title: "Verify both fingerprints",
        instruction: "Compare the displayed sender and receiver DTLS fingerprints through the trusted channel before accepting the answer. Stop if they do not match.",
        target: "#secure-share-receive-fingerprint",
      },
      {
        id: "send",
        title: "Apply the answer and send",
        instruction: "Paste the receiver answer on the sender, verify the fingerprints again, and then select 2. Apply Answer and Send. Watch both progress indicators and status messages.",
        target: "#secure-share-send-answer",
      },
      {
        id: "review-import",
        title: "Decrypt and review the received package",
        instruction: "On the receiver, enter the package passphrase and select 2. Review Received Package. Decryption leads to the ordinary non-mutating import preview; records are still not imported automatically.",
        target: "#secure-share-receive-passphrase",
      },
      {
        id: "complete",
        title: "Share walkthrough complete",
        instruction: "Review the proposed import counts, duplicate warning, and import mode before applying anything. Close or cancel to leave project records unchanged.",
        target: "#secure-share-receive-status",
      },
    ],
  },
];

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
  const coachHome = document.createComment("runbook-coach-home");
  coach.before(coachHome);
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
  const restoreCoachHome = (): void => {
    coachHome.parentNode?.insertBefore(coach, coachHome.nextSibling);
  };
  const stopRunbook = (): void => {
    clearHighlight();
    active = undefined;
    coach.hidden = true;
    restoreCoachHome();
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
    // Automatic advancement is convenient, but Next must always remain an
    // escape hatch when a browser event is unavailable or an equivalent legacy
    // workflow has already completed the requested action.
    next.disabled = false;
    const target = document.querySelector<HTMLElement>(step.target);
    const targetDialog = target?.closest<HTMLDialogElement>("dialog[open]");
    if (targetDialog) targetDialog.append(coach);
    else restoreCoachHome();
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
    const targets = step.advanceTargets ?? [step.target];
    const origin = event.target instanceof Element
      ? targets.some((target) => event.target instanceof Element && Boolean(event.target.closest(target)))
      : false;
    if (origin) move(1);
  };
  document.addEventListener("click", advanceFromAction);
  document.addEventListener("change", advanceFromAction);
}
