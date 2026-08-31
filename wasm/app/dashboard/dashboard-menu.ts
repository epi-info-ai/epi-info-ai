export type DashboardCommandDisposition = "implemented" | "legacy-gap";

export interface DashboardCommand {
  kind: "command";
  key: string;
  label: string;
  domId?: string;
  disposition: DashboardCommandDisposition;
  unavailableReason?: string;
}

export interface DashboardSeparator { kind: "separator" }

export interface DashboardSubmenu {
  kind: "submenu";
  key: string;
  label: string;
  children: readonly DashboardMenuEntry[];
}

export type DashboardMenuEntry = DashboardCommand | DashboardSeparator | DashboardSubmenu;

const gap = (key: string, label: string): DashboardCommand => ({
  kind: "command", key, label, disposition: "legacy-gap",
  unavailableReason: "Legacy Visual Dashboard command is not implemented in this browser slice.",
});

const command = (key: string, label: string, domId: string): DashboardCommand => ({
  kind: "command", key, label, domId, disposition: "implemented",
});

const separator: DashboardSeparator = { kind: "separator" };

// Toolbar order follows User Guide Figures 7.8 and 7.14 and DashboardControl.xaml.
export const DASHBOARD_TOOLBAR: readonly DashboardCommand[] = [
  gap("refresh", "Refresh"), gap("set-data-source", "Set Data Source"), gap("open-canvas", "Open"),
  gap("save-canvas", "Save"), gap("save-canvas-as", "Save As"),
] as const;

// Visible canvas context tree from EpiDashboard/DashboardControl.xaml.
export const DASHBOARD_CANVAS_MENU: readonly DashboardMenuEntry[] = [
  gap("set-data-source", "Set data source..."), gap("add-related-data", "Add related data source..."),
  gap("open-canvas", "Open canvas..."), gap("save-canvas", "Save canvas"), gap("save-canvas-as", "Save canvas as..."),
  separator, gap("save-output-html", "Save output as HTML"),
  { kind: "submenu", key: "send-output", label: "Send output to", children: [
    gap("send-excel", "Microsoft Excel"), gap("send-word", "Microsoft Word"), gap("send-web", "Web"),
  ] },
  gap("export-data", "Export data"), separator,
  {
    kind: "submenu", key: "add-analysis", label: "Add Analysis Gadget", children: [
      gap("line-list", "Line list"), command("rates", "Rates", "dashboard-menu-rates"),
      gap("frequency", "Frequency"), gap("word-cloud", "Word cloud"), gap("combined-frequency", "Combined frequency"),
      gap("mxn", "M x N / 2 x 2 Table"), gap("matched-pair", "Matched pair case-control"),
      gap("means", "Means"), gap("duplicates", "Duplicates List"),
      { kind: "submenu", key: "charts", label: "Charts", children: [
        gap("column-chart", "Column chart"), gap("line-chart", "Line chart"), gap("area-chart", "Area chart"),
        gap("pie-chart", "Pie chart"), gap("aberration-chart", "Aberration Detection chart"),
        gap("pareto-chart", "Pareto chart"), gap("scatter-chart", "Scatter chart"),
        command("epi-curve", "Epi Curve chart", "dashboard-menu-epi-curve"),
      ] },
      { kind: "submenu", key: "advanced-statistics", label: "Advanced Statistics", children: [
        gap("linear-regression", "Linear Regression"), gap("logistic-regression", "Logistic Regression"),
        gap("kaplan-meier", "Kaplan Meier Survival"), gap("cox", "Cox Proportional Hazards"),
        gap("complex-frequency", "Complex Sample Frequencies"), gap("complex-means", "Complex Sample Means"),
        gap("complex-tables", "Complex Sample Tables"),
      ] },
      gap("custom-gadgets", "Custom gadgets"),
    ],
  },
  { kind: "submenu", key: "add-statcalc", label: "Add StatCalc Calculator", children: [
    gap("statcalc-tables", "Tables (2 x 2, 2 x n)"),
    { kind: "submenu", key: "sample-size", label: "Sample size and power", children: [
      gap("population-survey", "Population survey"), gap("cohort", "Cohort or cross-sectional"),
      gap("unmatched", "Unmatched case-control"),
    ] },
    gap("chi-square-trend", "Chi square for trend"), gap("poisson", "Poisson (Rare event vs. std.)"),
    gap("binomial", "Binomial (Proportion vs. std.)"), gap("matched-pair-calculator", "Matched pair case control"),
  ] },
  { kind: "submenu", key: "add-report", label: "Add Report Gadget", children: [
    gap("simple-text", "Simple text box"), gap("image-box", "Image box"),
  ] },
  separator, gap("data-dictionary", "Show data dictionary"), gap("canvas-properties", "Canvas properties"),
  gap("auto-arrange", "Auto-arrange gadgets"), gap("refresh-data", "Refresh data source"),
  gap("reset-dashboard", "Reset Dashboard"),
] as const;

function renderCommand(entry: DashboardCommand): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("role", "menuitem");
  button.dataset.dashboardCommand = entry.key;
  button.dataset.menuDisposition = entry.disposition;
  if (entry.domId) button.id = entry.domId;
  button.textContent = entry.label;
  if (entry.disposition === "legacy-gap") {
    button.setAttribute("aria-disabled", "true");
    button.dataset.unavailableReason = entry.unavailableReason ?? "Not implemented.";
    button.title = entry.unavailableReason ?? "Not implemented.";
  }
  return button;
}

function renderEntries(entries: readonly DashboardMenuEntry[]): DocumentFragment {
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
      trigger.dataset.dashboardSubmenu = entry.key;
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

export function renderDashboardCommandContract(toolbar: ParentNode, canvasMenu: ParentNode): void {
  toolbar.replaceChildren(...DASHBOARD_TOOLBAR.map((entry) => {
    const button = renderCommand(entry);
    button.removeAttribute("role");
    return button;
  }));
  canvasMenu.replaceChildren(renderEntries(DASHBOARD_CANVAS_MENU));
}
