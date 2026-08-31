export type ClassicProgramCommandDisposition = "implemented" | "legacy-gap";

export interface ClassicProgramCommand {
  kind: "command";
  key: string;
  label: string;
  disposition: ClassicProgramCommandDisposition;
  domId?: string;
  shortcut?: string;
  unavailableReason?: string;
}
export interface ClassicProgramSeparator { kind: "separator" }
export type ClassicProgramEntry = ClassicProgramCommand | ClassicProgramSeparator;
export interface ClassicProgramMenu { key: "file" | "edit" | "fonts"; label: string; entries: readonly ClassicProgramEntry[] }

const separator: ClassicProgramSeparator = { kind: "separator" };
const gap = (key: string, label: string, shortcut?: string): ClassicProgramCommand => ({
  kind: "command", key, label, disposition: "legacy-gap", ...(shortcut ? { shortcut } : {}),
  unavailableReason: "This legacy Program Editor command is not implemented in the browser yet.",
});
const command = (key: string, label: string, domId: string, shortcut?: string): ClassicProgramCommand => ({
  kind: "command", key, label, domId, disposition: "implemented", ...(shortcut ? { shortcut } : {}),
});

// ProgramEditor.Designer.cs and ProgramEditor.resx define this exact menu order.
export const CLASSIC_PROGRAM_MENUS: readonly ClassicProgramMenu[] = [
  { key: "file", label: "File", entries: [
    command("new", "New...", "classic-program-file-new", "Ctrl+N"), command("open", "Open Pgm...", "classic-program-file-open", "Ctrl+O"), separator,
    command("save", "Save Pgm", "classic-program-file-save", "Ctrl+S"), command("save-as", "Save Pgm As...", "classic-program-file-save-as"), separator,
    command("print", "Print...", "classic-program-file-print", "Ctrl+P"), {
      kind: "command", key: "page-setup", label: "Page Setup...", disposition: "legacy-gap",
      unavailableReason: "Browser applications expose page size, orientation, margins, and printer selection inside the Print dialog; there is no separate web Page Setup API.",
    },
  ] },
  { key: "edit", label: "Edit", entries: [
    command("undo", "Undo", "classic-program-edit-undo", "Ctrl+Z"), command("redo", "Redo", "classic-program-edit-redo", "Ctrl+Y"), separator,
    gap("cut", "Cut", "Ctrl+X"), gap("copy", "Copy", "Ctrl+C"), gap("paste", "Paste", "Ctrl+V"), separator,
    command("find", "Find", "classic-program-edit-find", "Ctrl+F"), command("find-next", "Find Next", "classic-program-edit-find-next", "F3"), command("replace", "Replace", "classic-program-edit-replace", "Ctrl+R"), separator,
    command("select-all", "Select All", "classic-program-edit-select-all", "Ctrl+A"), separator,
    command("beginning", "Program Beginning", "classic-program-edit-beginning"), command("end", "Program End", "classic-program-edit-end"), separator,
    command("insert-command", "Insert command at cursor", "classic-program-edit-insert-command"),
  ] },
  { key: "fonts", label: "Fonts", entries: [gap("editor-font", "Set Editor Font")] },
] as const;

// ProgramEditor.Designer.cs defines this exact toolbar order and labels.
export const CLASSIC_PROGRAM_TOOLBAR: readonly ClassicProgramCommand[] = [
  command("new", "New Pgm", "classic-program-toolbar-new"), command("open", "Open Pgm", "classic-program-toolbar-open"), command("save", "Save Pgm", "classic-program-toolbar-save"), command("print", "Print...", "classic-program-toolbar-print"),
  command("run", "Run Commands", "classic-program-toolbar-run"), gap("cancel", "Cancel"),
] as const;

// OutputWindow.Designer.cs defines this exact toolbar order and labels.
export const CLASSIC_OUTPUT_TOOLBAR: readonly ClassicProgramEntry[] = [
  command("previous", "Previous", "classic-output-previous"), command("next", "Next", "classic-output-next"),
  command("last", "Last", "classic-output-last"), command("history", "History", "classic-output-history"), separator,
  gap("open", "Open"), gap("bookmark", "Bookmark"), separator, gap("print", "Print"), separator,
  gap("maximize", "Maximize"), gap("clear", "Clear Output"),
] as const;

function renderCommand(entry: ClassicProgramCommand): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.classicProgramCommand = entry.key;
  button.dataset.menuDisposition = entry.disposition;
  if (entry.domId) button.id = entry.domId;
  const label = document.createElement("span"); label.textContent = entry.label; button.append(label);
  if (entry.shortcut) { const shortcut = document.createElement("kbd"); shortcut.textContent = entry.shortcut; button.append(shortcut); }
  if (entry.disposition === "legacy-gap") {
    button.setAttribute("aria-disabled", "true");
    button.dataset.unavailableReason = entry.unavailableReason ?? "Not implemented.";
    button.title = entry.unavailableReason ?? "Not implemented.";
  }
  return button;
}

function renderEntries(entries: readonly ClassicProgramEntry[], menu: boolean): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const entry of entries) {
    if (entry.kind === "separator") {
      const element = document.createElement("div"); element.className = "legacy-menu-separator"; element.setAttribute("role", "separator"); fragment.append(element);
    } else {
      const button = renderCommand(entry); if (menu) button.setAttribute("role", "menuitem"); fragment.append(button);
    }
  }
  return fragment;
}

export function renderClassicProgramSurface(menuBar: ParentNode, programToolbar: ParentNode, outputToolbar: ParentNode): void {
  for (const menu of CLASSIC_PROGRAM_MENUS) {
    const host = menuBar.querySelector<HTMLElement>(`[data-classic-program-menu-host="${menu.key}"]`);
    if (!host) throw new Error(`Program Editor menu host is missing: ${menu.key}`);
    host.replaceChildren(renderEntries(menu.entries, true));
  }
  programToolbar.replaceChildren(renderEntries(CLASSIC_PROGRAM_TOOLBAR, false));
  outputToolbar.replaceChildren(renderEntries(CLASSIC_OUTPUT_TOOLBAR, false));
}
