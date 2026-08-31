export type FormDesignerMenuState = "always" | "active-project" | "recent-projects";
export type FormDesignerMenuDisposition = "implemented" | "legacy-gap" | "new-branch";

export interface FormDesignerMenuCommand {
  kind: "command";
  key: string;
  label: string;
  domId?: string;
  shortcut?: string;
  state: FormDesignerMenuState;
  disposition: FormDesignerMenuDisposition;
  unavailableReason?: string;
}

export interface FormDesignerMenuSeparator { kind: "separator" }

export interface FormDesignerMenuSubmenu {
  kind: "submenu";
  key: string;
  label: string;
  state: FormDesignerMenuState;
  children: readonly FormDesignerMenuEntry[];
}

export type FormDesignerMenuEntry = FormDesignerMenuCommand | FormDesignerMenuSeparator | FormDesignerMenuSubmenu;

export interface FormDesignerTopMenu {
  key: "file" | "edit" | "view" | "insert" | "format" | "tools" | "help";
  label: string;
  entries: readonly FormDesignerMenuEntry[];
}

const gap = (key: string, label: string, state: FormDesignerMenuState = "active-project", shortcut?: string): FormDesignerMenuCommand => ({
  kind: "command", key, label, state, ...(shortcut ? { shortcut } : {}), disposition: "legacy-gap",
  unavailableReason: "Legacy Form Designer command is not implemented in this browser slice.",
});

const command = (key: string, label: string, domId: string, state: FormDesignerMenuState = "active-project", shortcut?: string): FormDesignerMenuCommand => ({
  kind: "command", key, label, domId, state, ...(shortcut ? { shortcut } : {}), disposition: "implemented",
});

const separator: FormDesignerMenuSeparator = { kind: "separator" };

export const FORM_DESIGNER_MENUS: readonly FormDesignerTopMenu[] = [
  {
    key: "file", label: "File", entries: [
      command("new-project", "New Project...", "designer-new-project", "always"),
      gap("new-project-template", "New Project from Template...", "always"),
      gap("new-project-data-dictionary", "New Project from Data Dictionary...", "always"),
      command("new-form", "New Form", "designer-new-form"),
      gap("new-page", "New Page"),
      separator,
      command("open-project", "Open Project...", "designer-open-project", "always", "Ctrl+O"),
      gap("open-project-web", "Open Project from Web...", "always"),
      command("close-project", "Close Project", "designer-close-project"),
      gap("get-template", "Get Template...", "always"),
      gap("print", "Print..."),
      gap("copy-mobile", "Copy Form to Mobile Device..."),
      gap("publish-cloud", "Publish Form to Cloud Data Capture..."),
      gap("publish-web", "Publish Form to Web Survey..."),
      separator,
      { kind: "submenu", key: "recent-projects", label: "Recent Projects", state: "recent-projects", children: [] },
      separator,
      command("exit", "Exit", "designer-exit", "always"),
      separator,
      {
        kind: "command", key: "project-storage", label: "Project Storage...", domId: "designer-project-storage",
        state: "active-project", disposition: "new-branch",
      },
    ],
  },
  {
    key: "edit", label: "Edit", entries: [
      gap("undo", "Undo"), gap("redo", "Redo"), separator,
      gap("cut", "Cut"), gap("copy", "Copy"), gap("paste", "Paste"),
      gap("delete-page", "Delete Page"), gap("rename-page", "Rename Page"),
    ],
  },
  {
    key: "view", label: "View", entries: [
      gap("status-bar", "Status Bar", "always"), gap("vocabulary-fields", "Vocabulary Fields"),
      gap("field-names", "Field Names"), gap("tab-order", "Tab Order"),
      gap("logs", "Epi Info Logs", "always"),
    ],
  },
  {
    key: "insert", label: "Insert", entries: [
      {
        kind: "submenu", key: "page", label: "Page", state: "active-project",
        children: [gap("insert-page", "Insert Page"), gap("add-page", "Add Page")],
      },
      gap("group", "Group"),
    ],
  },
  {
    key: "format", label: "Format", entries: [
      gap("default-prompt-font", "Set Default Prompt Font"),
      gap("default-input-font", "Set Default Input Font"),
      {
        kind: "submenu", key: "alignment", label: "Alignment", state: "active-project",
        children: [gap("alignment-stack", "As Stack"), gap("alignment-table", "As Table")],
      },
      gap("background", "Background"), gap("grid-settings", "Grid Settings"), gap("page-setup", "Page Setup"),
    ],
  },
  {
    key: "tools", label: "Tools", entries: [
      gap("data-dictionary", "Data Dictionary"), gap("check-code", "Check Code Editor"), separator,
      gap("import-epi6-rec", "Import Epi 6 Rec File"), gap("import-check-code", "Import Check Code"),
      gap("make-form-data-table", "Make Form from Data Table"),
      {
        kind: "submenu", key: "upgrade-project", label: "Upgrade Project", state: "always",
        children: [gap("upgrade-35x", "Epi Info 3.5.x (.MDB)", "always"), gap("upgrade-6x", "Epi Info 6.x (.REC)", "always")],
      },
      {
        kind: "submenu", key: "make-prj", label: "Make PRJ File", state: "always",
        children: [
          gap("make-prj-access", "From Epi Info 7 project (MS Access)", "always"),
          gap("make-prj-sqlite", "From Epi Info 7 project (SQLite)", "always"),
          gap("make-prj-sql-server", "From Epi Info 7 project (SQL Server)", "always"),
        ],
      },
      gap("create-data-table", "Create Data Table"), gap("delete-data-table", "Delete Data Table"),
      gap("copy-form", "Copy Form"), command("enter-data", "Enter Data", "designer-menu-enter-data"),
      separator, gap("options", "Options", "always"),
    ],
  },
  {
    key: "help", label: "Help", entries: [
      gap("contents", "Contents", "always"), gap("about", "About Epi Info 7", "always"),
    ],
  },
] as const;

function renderCommand(entry: FormDesignerMenuCommand): HTMLButtonElement {
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

function renderEntries(entries: readonly FormDesignerMenuEntry[]): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const entry of entries) {
    if (entry.kind === "separator") {
      const separatorElement = document.createElement("div");
      separatorElement.className = "legacy-menu-separator";
      separatorElement.setAttribute("role", "separator");
      fragment.append(separatorElement);
      continue;
    }
    if (entry.kind === "command") {
      fragment.append(renderCommand(entry));
      continue;
    }
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
    if (entry.key === "recent-projects") {
      trigger.id = "designer-recent-projects";
      children.id = "designer-recent-project-list";
    } else children.append(renderEntries(entry.children));
    submenu.append(trigger, children);
    fragment.append(submenu);
  }
  return fragment;
}

export function renderFormDesignerMenuContract(menuBar: ParentNode): void {
  for (const menu of FORM_DESIGNER_MENUS) {
    const host = menuBar.querySelector<HTMLElement>(`[data-designer-menu-host="${menu.key}"]`);
    if (!host) throw new Error(`Form Designer menu host is missing: ${menu.key}`);
    host.replaceChildren(renderEntries(menu.entries));
  }
}
