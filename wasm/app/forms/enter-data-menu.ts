export type EnterDataMenuState = "always" | "active-project" | "has-records";
export type EnterDataMenuDisposition = "implemented" | "legacy-gap" | "adapted" | "new-branch";

export interface EnterDataMenuCommand {
  kind: "command";
  key: string;
  label: string;
  domId?: string;
  shortcut?: string;
  state: EnterDataMenuState;
  disposition: EnterDataMenuDisposition;
  unavailableReason?: string;
}

export interface EnterDataMenuSeparator { kind: "separator" }

export interface EnterDataMenuSubmenu {
  kind: "submenu";
  key: string;
  label: string;
  state: EnterDataMenuState;
  children: readonly EnterDataMenuEntry[];
}

export type EnterDataMenuEntry = EnterDataMenuCommand | EnterDataMenuSeparator | EnterDataMenuSubmenu;

export interface EnterDataTopMenu {
  key: "file" | "edit" | "view" | "tools" | "help";
  label: string;
  entries: readonly EnterDataMenuEntry[];
}

const gap = (key: string, label: string, state: EnterDataMenuState = "active-project", shortcut?: string): EnterDataMenuCommand => ({
  kind: "command", key, label, state, ...(shortcut ? { shortcut } : {}), disposition: "legacy-gap",
  unavailableReason: "Legacy Enter Data command is not implemented in this browser slice.",
});

const command = (
  key: string,
  label: string,
  domId: string,
  state: EnterDataMenuState = "active-project",
  shortcut?: string,
  disposition: EnterDataMenuDisposition = "implemented",
): EnterDataMenuCommand => ({ kind: "command", key, label, domId, state, ...(shortcut ? { shortcut } : {}), disposition });

const separator: EnterDataMenuSeparator = { kind: "separator" };

// Order and wording follow EnterMainForm.Designer.cs / EnterMainForm.resx.
export const ENTER_DATA_MENUS: readonly EnterDataTopMenu[] = [
  {
    key: "file", label: "File", entries: [
      command("new-record", "New Record", "enter-menu-new-record"),
      gap("open-form", "Open Form...", "always", "Ctrl+O"),
      command("edit-form", "Edit Form", "enter-menu-edit-form"),
      gap("close-form", "Close Form", "active-project", "Alt+F4"),
      separator,
      command("save", "Save", "enter-menu-save", "active-project", "Ctrl+S"),
      {
        kind: "submenu", key: "import-data", label: "Import Data", state: "active-project", children: [
          gap("import-mobile", "From Mobile Device"),
          gap("import-web-survey", "From Web Survey"),
          gap("import-cloud", "From Cloud Data Capture"),
          gap("import-project", "From Epi Info 7 Project"),
          command("import-package", "From Data Package", "enter-menu-import-package", "active-project", undefined, "adapted"),
        ],
      },
      command("package-transport", "Package For Transport", "enter-menu-package-transport", "active-project", undefined, "adapted"),
      command("secure-share", "Secure Epi Info Share...", "enter-menu-secure-share", "active-project", undefined, "new-branch"),
      separator,
      gap("print", "Print...", "active-project", "Ctrl+P"),
      separator,
      gap("recent-forms", "Recent Forms", "always"),
      separator,
      command("exit", "Exit", "enter-menu-exit", "always"),
      separator,
      command("import-browser-file", "Import Browser Data File...", "enter-menu-import-file", "active-project", undefined, "new-branch"),
    ],
  },
  {
    key: "edit", label: "Edit", entries: [
      gap("find", "Find", "has-records"),
      gap("mark-deleted", "Mark as Deleted", "has-records"),
      gap("undelete", "Undelete", "has-records"),
    ],
  },
  {
    key: "view", label: "View", entries: [
      command("status-bar", "Status Bar", "enter-menu-status-bar", "always"),
      gap("logs", "Epi Info Logs", "always"),
    ],
  },
  {
    key: "tools", label: "Tools", entries: [
      gap("data-dictionary", "Data Dictionary"),
      separator,
      gap("compact-database", "Compact Database"),
      separator,
      gap("options", "Options...", "always"),
      gap("check-code", "Enable Check Code Execution"),
      gap("check-code-errors", "Enable Check Code Error Suppression"),
      gap("copy-shortcut", "Copy Shortcut to Clipboard"),
      separator,
      command("data-quality", "Data Quality...", "enter-menu-data-quality", "active-project", undefined, "new-branch"),
    ],
  },
  {
    key: "help", label: "Help", entries: [
      gap("contents", "Contents", "always"),
      gap("about", "About Epi Info 7", "always"),
    ],
  },
] as const;

function renderCommand(entry: EnterDataMenuCommand): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("role", "menuitem");
  button.dataset.menuCommand = entry.key;
  button.dataset.menuState = entry.state;
  button.dataset.menuDisposition = entry.disposition;
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
  } else if (entry.disposition === "new-branch") {
    button.classList.add("legacy-menu-new-branch");
    button.dataset.newBranch = "true";
  }
  return button;
}

function renderEntries(entries: readonly EnterDataMenuEntry[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const entry of entries) {
    if (entry.kind === "separator") {
      const element = document.createElement("div");
      element.className = "legacy-menu-separator";
      element.setAttribute("role", "separator");
      fragment.append(element);
    } else if (entry.kind === "command") fragment.append(renderCommand(entry));
    else {
      const submenu = document.createElement("div");
      submenu.className = "legacy-contract-submenu";
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.setAttribute("role", "menuitem");
      trigger.setAttribute("aria-haspopup", "menu");
      trigger.setAttribute("aria-expanded", "false");
      trigger.dataset.menuState = entry.state;
      trigger.dataset.menuSubmenu = entry.key;
      trigger.textContent = entry.label;
      const arrow = document.createElement("span");
      arrow.className = "legacy-submenu-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "\u25B8";
      trigger.append(arrow);
      const children = document.createElement("div");
      children.className = "legacy-recent-project-list";
      children.setAttribute("role", "menu");
      children.setAttribute("aria-label", entry.label);
      children.hidden = true;
      children.append(renderEntries(entry.children));
      submenu.append(trigger, children);
      fragment.append(submenu);
    }
  }
  return fragment;
}

export function renderEnterDataMenuContract(menuBar: ParentNode): void {
  for (const menu of ENTER_DATA_MENUS) {
    const host = menuBar.querySelector<HTMLElement>(`[data-enter-menu-host="${menu.key}"]`);
    if (!host) throw new Error(`Enter Data menu host is missing: ${menu.key}`);
    host.replaceChildren(renderEntries(menu.entries));
  }
}
