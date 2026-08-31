export type ClassicCommandGroupKey = "data" | "variables" | "select-if" | "statistics" | "advanced-statistics" | "output" | "user-defined" | "user-interaction" | "options";
export type ClassicCommandParserState = "none" | "syntax-v0.3";
export type ClassicCommandDialogState = "gap" | "typed-source-v0.1";
export type ClassicCommandSelectedState = "none" | "executes-v0.1" | "review-required-v0.1";
export type ClassicCommandFullProgramState = "none" | "bounded-component-v0.1";
export type ClassicCommandBrowserPolicy = "candidate" | "adapt-required" | "blocked";

export interface ClassicCommandParityEntry {
  id: `CLASSIC-CMD-${string}`;
  group: ClassicCommandGroupKey;
  key: string;
  legacyName: string;
  sourceCommand: string;
  explorer: "visible" | "legacy-enum-only";
  parser: ClassicCommandParserState;
  dialog: ClassicCommandDialogState;
  selectedExecution: ClassicCommandSelectedState;
  fullProgramExecution: ClassicCommandFullProgramState;
  browserPolicy: ClassicCommandBrowserPolicy;
  evidence: string;
}

type EntryOverrides = Partial<Omit<ClassicCommandParityEntry, "id" | "group" | "key" | "legacyName" | "sourceCommand" | "evidence">>;
const entry = (group: ClassicCommandGroupKey, key: string, legacyName: string, sourceCommand: string, overrides: EntryOverrides = {}): ClassicCommandParityEntry => ({
  id: `CLASSIC-CMD-${group.toUpperCase().replace(/-/g, "_")}-${key.toUpperCase().replace(/-/g, "_")}`,
  group, key, legacyName, sourceCommand,
  explorer: "visible", parser: "none", dialog: "gap", selectedExecution: "none", fullProgramExecution: "none", browserPolicy: "candidate",
  evidence: `Epi.Windows.Analysis/Enums.cs:${legacyName}`,
  ...overrides,
});

export const CLASSIC_COMMAND_PARITY: readonly ClassicCommandParityEntry[] = [
  entry("data", "read", "Read", "READ", { parser: "syntax-v0.3", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", browserPolicy: "adapt-required" }),
  entry("data", "relate", "Relate", "RELATE", { browserPolicy: "adapt-required" }),
  entry("data", "write", "Write", "WRITE", { browserPolicy: "adapt-required" }),
  entry("data", "merge", "Merge", "MERGE", { browserPolicy: "adapt-required" }),
  entry("data", "delete-file-table", "DeleteFile", "DELETE", { browserPolicy: "adapt-required" }),
  entry("data", "delete-records", "DeleteRecord", "DELETE", { browserPolicy: "adapt-required" }),
  entry("data", "undelete-records", "UndeleteRecord", "UNDELETE", { browserPolicy: "adapt-required" }),

  entry("variables", "define", "Define", "DEFINE", { parser: "syntax-v0.3", dialog: "typed-source-v0.1", fullProgramExecution: "bounded-component-v0.1" }),
  entry("variables", "define-group", "DefineGroup", "DEFINE GROUPVAR"),
  entry("variables", "undefine", "Undefine", "UNDEFINE"),
  entry("variables", "assign", "Assign", "ASSIGN", { parser: "syntax-v0.3" }),
  entry("variables", "recode", "Recode", "RECODE", { parser: "syntax-v0.3", dialog: "typed-source-v0.1", fullProgramExecution: "bounded-component-v0.1" }),
  entry("variables", "display", "Display", "DISPLAY"),

  entry("select-if", "select", "Select", "SELECT", { parser: "syntax-v0.3" }),
  entry("select-if", "cancel-select", "CancelSelect", "CANCEL SELECT", { parser: "syntax-v0.3" }),
  entry("select-if", "if", "If", "IF", { parser: "syntax-v0.3" }),
  entry("select-if", "sort", "Sort", "SORT"),
  entry("select-if", "cancel-sort", "CancelSort", "CANCEL SORT"),

  entry("statistics", "list", "List", "LIST", { parser: "syntax-v0.3", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1" }),
  entry("statistics", "frequencies", "Frequencies", "FREQ", { parser: "syntax-v0.3", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", fullProgramExecution: "bounded-component-v0.1" }),
  entry("statistics", "tables", "Tables", "TABLES", { parser: "syntax-v0.3", dialog: "typed-source-v0.1", selectedExecution: "review-required-v0.1" }),
  entry("statistics", "match", "Match", "MATCH", { explorer: "legacy-enum-only" }),
  entry("statistics", "means", "Means", "MEANS", { parser: "syntax-v0.3", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1" }),
  entry("statistics", "summarize", "Summarize", "SUMMARIZE"),
  entry("statistics", "graph", "Graph", "GRAPH"),
  entry("statistics", "map", "Map", "MAP", { explorer: "legacy-enum-only" }),

  entry("advanced-statistics", "linear-regression", "LinearRegression", "REGRESS"),
  entry("advanced-statistics", "logistic-regression", "LogisticRegression", "LOGISTIC"),
  entry("advanced-statistics", "kaplan-meier", "KaplanMeierSurvival", "KMSURVIVAL"),
  entry("advanced-statistics", "cox", "CoxProportionalHazards", "COXPH"),
  entry("advanced-statistics", "complex-frequencies", "ComplexSampleFrequencies", "FREQ"),
  entry("advanced-statistics", "complex-tables", "ComplexSampleTables", "TABLES/MATCH"),
  entry("advanced-statistics", "complex-means", "ComplexSampleMeans", "MEANS"),

  entry("output", "header", "Header", "HEADER", { browserPolicy: "adapt-required" }),
  entry("output", "type", "Type", "TYPEOUT", { browserPolicy: "adapt-required" }),
  entry("output", "routeout", "Routeout", "ROUTEOUT", { browserPolicy: "adapt-required" }),
  entry("output", "closeout", "Closeout", "CLOSEOUT", { browserPolicy: "adapt-required" }),
  entry("output", "printout", "Printout", "PRINTOUT", { browserPolicy: "adapt-required" }),
  entry("output", "reports", "Reports", "REPORT", { explorer: "legacy-enum-only", browserPolicy: "adapt-required" }),
  entry("output", "store-output", "StoreOutput", "STORE", { browserPolicy: "adapt-required" }),

  entry("user-defined", "define-command", "DefineCommand", "DEFINE COMMAND"),
  entry("user-defined", "user-command", "UserCommand", "USERCOMMAND"),
  entry("user-defined", "run-saved-program", "RunSavedProgram", "RUNPGM", { browserPolicy: "adapt-required" }),
  entry("user-defined", "execute-file", "ExecuteFile", "EXECUTE", { browserPolicy: "blocked" }),

  entry("user-interaction", "dialog", "Dialog", "DIALOG", { browserPolicy: "adapt-required" }),
  entry("user-interaction", "beep", "Beep", "BEEP", { browserPolicy: "adapt-required" }),
  entry("user-interaction", "help", "Help", "HELP", { explorer: "legacy-enum-only", browserPolicy: "adapt-required" }),
  entry("user-interaction", "quit-program", "Quit", "QUIT", { browserPolicy: "adapt-required" }),

  entry("options", "set", "Set", "SET", { browserPolicy: "adapt-required" }),
] as const;

export function classicCommandParityEntry(group: ClassicCommandGroupKey, key: string): ClassicCommandParityEntry | undefined {
  return CLASSIC_COMMAND_PARITY.find((candidate) => candidate.group === group && candidate.key === key);
}
