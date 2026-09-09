export type ClassicCommandDisposition = "implemented" | "legacy-gap";

export interface ClassicCommand {
  key: string;
  label: string;
  disposition: ClassicCommandDisposition;
  domId?: string;
  shortcut?: string;
  unavailableReason?: string;
  newBranch?: boolean;
}

export interface ClassicCommandGroup {
  key: string;
  label: string;
  commands: readonly ClassicCommand[];
}

export interface ClassicTopMenu {
  key: "file" | "view" | "tools" | "help";
  label: string;
  commands: readonly ClassicCommand[];
}

const gap = (key: string, label: string, shortcut?: string): ClassicCommand => ({
  key,
  label,
  disposition: "legacy-gap",
  ...(shortcut ? { shortcut } : {}),
  unavailableReason: "Legacy Classic Analysis command is not implemented in this browser slice.",
});

const command = (key: string, label: string, domId: string): ClassicCommand => ({
  key,
  label,
  domId,
  disposition: "implemented",
});

const newBranchCommand = (key: string, label: string, domId: string): ClassicCommand => ({
  ...command(key, label, domId), newBranch: true,
});

// AnalysisMainForm.Designer.cs and AnalysisMainForm.resx define this four-menu shell.
export const CLASSIC_ANALYSIS_MENUS: readonly ClassicTopMenu[] = [
  { key: "file", label: "File", commands: [gap("statistics-plugins", "Add Statistics Plug-ins..."), gap("exit", "Exit")] },
  { key: "view", label: "View", commands: [
    command("command-explorer", "Command Explorer", "classic-menu-command-explorer"),
    command("status-bar", "Status Bar", "classic-menu-status-bar"),
    gap("logs", "Epi Info Logs..."),
  ] },
  { key: "tools", label: "Tools", commands: [gap("options", "Options...")] },
  { key: "help", label: "Help", commands: [gap("contents", "Contents", "F1"), gap("about", "About Epi Info 7")] },
] as const;

// Order and labels follow the visible CommandExplorer.resx tree. Commands present
// only in internal enums but absent from the shipped tree are not promoted here.
export const CLASSIC_COMMAND_GROUPS: readonly ClassicCommandGroup[] = [
  { key: "data", label: "Data", commands: [
    command("read", "Read", "classic-command-read"), command("relate", "Relate", "classic-command-relate"), command("write", "Write (Export)", "classic-command-write"), command("merge", "Merge", "classic-command-merge"),
    command("delete-file-table", "Delete File/Table", "classic-command-delete-file-table"), command("delete-records", "Delete Records", "classic-command-delete-records"), command("undelete-records", "Undelete Records", "classic-command-undelete-records"),
  ] },
  { key: "variables", label: "Variables", commands: [
    command("define", "Define", "classic-command-define"), command("define-group", "DefineGroup", "classic-command-define-group"), command("undefine", "Undefine", "classic-command-undefine"),
    command("assign", "Assign", "classic-command-assign"), command("recode", "Recode", "classic-command-recode"), command("display", "Display", "classic-command-display"),
  ] },
  { key: "select-if", label: "Select/If", commands: [
    command("select", "Select", "classic-command-select"), command("cancel-select", "Cancel Select", "classic-command-cancel-select"), command("if", "If", "classic-command-if"), command("sort", "Sort", "classic-command-sort"), command("cancel-sort", "Cancel Sort", "classic-command-cancel-sort"),
  ] },
  { key: "statistics", label: "Statistics", commands: [
    command("list", "List", "classic-command-list"), command("frequencies", "Frequencies", "classic-command-frequencies"),
    command("tables", "Tables", "classic-command-tables"), command("means", "Means", "classic-command-means"),
    command("summarize", "Summarize", "classic-command-summarize"), command("graph", "Graph", "classic-command-graph"),
  ] },
  { key: "advanced-statistics", label: "Advanced Statistics", commands: [
    gap("linear-regression", "Linear Regression"), gap("logistic-regression", "Logistic Regression"),
    gap("kaplan-meier", "Kaplan-Meier Survival"), gap("cox", "Cox Proportional Hazards"),
    command("complex-frequencies", "Complex Sample Frequencies", "classic-command-complex-frequencies"), command("complex-tables", "Complex Sample Tables", "classic-command-complex-tables"),
    command("complex-means", "Complex Sample Means", "classic-command-complex-means"),
  ] },
  { key: "output", label: "Output", commands: [
    gap("header", "Header"), gap("type", "Type"), gap("routeout", "RouteOut"), gap("closeout", "CloseOut"),
    gap("printout", "PrintOut"), gap("store-output", "Storing Output"),
  ] },
  { key: "user-defined", label: "User-Defined Commands", commands: [
    gap("define-command", "Define Command"), gap("user-command", "User Command"),
    gap("run-saved-program", "Run Saved Program"), gap("execute-file", "Execute File"),
  ] },
  { key: "user-interaction", label: "User Interaction", commands: [
    gap("dialog", "Dialog"), gap("beep", "Beep"), gap("quit-program", "Quit Program"),
  ] },
  { key: "options", label: "Options", commands: [command("set", "Set", "classic-command-set")] },
  { key: "new-branches", label: "New Branches — Epi Info AI", commands: [
    newBranchCommand("quality", "Quality Profile", "classic-command-quality"),
    newBranchCommand("file-convert", "Convert Access Database", "classic-command-file-convert"),
  ] },
] as const;

function renderCommand(entry: ClassicCommand, surface: "menu" | "tree"): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("role", surface === "menu" ? "menuitem" : "treeitem");
  button.dataset.classicCommand = entry.key;
  button.dataset.menuDisposition = entry.disposition;
  if (entry.newBranch) {
    button.classList.add("classic-new-branch-command");
    button.dataset.newBranch = "true";
  }
  if (entry.domId) button.id = entry.domId;
  const label = document.createElement("span");
  label.textContent = entry.label;
  button.append(label);
  if (entry.shortcut) {
    const shortcut = document.createElement("kbd");
    shortcut.textContent = entry.shortcut;
    button.append(shortcut);
  }
  if (entry.disposition === "legacy-gap") {
    button.setAttribute("aria-disabled", "true");
    button.dataset.unavailableReason = entry.unavailableReason ?? "Not implemented.";
    button.title = entry.unavailableReason ?? "Not implemented.";
  }
  return button;
}

function renderCommandGroup(group: ClassicCommandGroup): HTMLDetailsElement {
  const details = document.createElement("details");
  details.className = "classic-command-group";
  details.open = group.key === "statistics";
  const summary = document.createElement("summary");
  summary.textContent = group.label;
  const commands = document.createElement("div");
  commands.className = "classic-command-group-items";
  commands.setAttribute("role", "group");
  commands.setAttribute("aria-label", group.label);
  commands.append(...group.commands.map((entry) => renderCommand(entry, "tree")));
  details.append(summary, commands);
  return details;
}

export function renderClassicAnalysisContract(menuBar: ParentNode, commandExplorer: ParentNode): void {
  for (const menu of CLASSIC_ANALYSIS_MENUS) {
    const host = menuBar.querySelector<HTMLElement>(`[data-classic-menu-host="${menu.key}"]`);
    if (!host) throw new Error(`Classic Analysis menu host is missing: ${menu.key}`);
    host.replaceChildren(...menu.commands.map((entry) => renderCommand(entry, "menu")));
  }
  commandExplorer.replaceChildren(...CLASSIC_COMMAND_GROUPS.map(renderCommandGroup));
}
