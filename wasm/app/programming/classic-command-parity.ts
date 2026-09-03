export type ClassicCommandGroupKey = "data" | "variables" | "select-if" | "statistics" | "advanced-statistics" | "output" | "user-defined" | "user-interaction" | "options";
export type ClassicCommandParserState = "none" | "syntax-v0.8" | "syntax-v0.9" | "syntax-v1.0";
export type ClassicCommandDialogState = "gap" | "typed-source-v0.1";
export type ClassicCommandSelectedState = "none" | "executes-v0.1" | "review-required-v0.1";
export type ClassicCommandFullProgramState = "none" | "bounded-component-v0.1";
export type ClassicCommandBrowserPolicy = "candidate" | "adapt-required" | "blocked";
export type ClassicCommandParityStatus = "not-started" | "browser-verified" | "legacy-parity-verified";

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
  parityStatus: ClassicCommandParityStatus;
  validationProgram?: string;
  expectedOutput?: string;
  legacyOutput?: string;
  evidence: string;
}

type EntryOverrides = Partial<Omit<ClassicCommandParityEntry, "id" | "group" | "key" | "legacyName" | "sourceCommand" | "evidence">>;
const entry = (group: ClassicCommandGroupKey, key: string, legacyName: string, sourceCommand: string, overrides: EntryOverrides = {}): ClassicCommandParityEntry => ({
  id: `CLASSIC-CMD-${group.toUpperCase().replace(/-/g, "_")}-${key.toUpperCase().replace(/-/g, "_")}`,
  group, key, legacyName, sourceCommand,
  explorer: "visible", parser: "none", dialog: "gap", selectedExecution: "none", fullProgramExecution: "none", browserPolicy: "candidate", parityStatus: "not-started",
  evidence: `Epi.Windows.Analysis/Enums.cs:${legacyName}`,
  ...overrides,
});

export const CLASSIC_COMMAND_PARITY: readonly ClassicCommandParityEntry[] = [
  entry("data", "read", "Read", "READ", {
    parser: "syntax-v0.9", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", browserPolicy: "adapt-required", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-read-current-form.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-read-current-form.expected.json",
  }),
  entry("data", "relate", "Relate", "RELATE", {
    parser: "syntax-v0.9", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", browserPolicy: "adapt-required", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-relate-by-id.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-relate-by-id.expected.json",
  }),
  entry("data", "write", "Write", "WRITE", {
    parser: "syntax-v0.9", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", browserPolicy: "adapt-required", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-write-csv.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-write-csv.expected.json",
  }),
  entry("data", "merge", "Merge", "MERGE", {
    parser: "syntax-v1.0", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", browserPolicy: "adapt-required", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-merge-by-id.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-merge-by-id.expected.json",
  }),
  entry("data", "delete-file-table", "DeleteFile", "DELETE", {
    parser: "syntax-v1.0", dialog: "typed-source-v0.1", selectedExecution: "review-required-v0.1",
    browserPolicy: "adapt-required", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-delete-table.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-delete-table.expected.json",
  }),
  entry("data", "delete-records", "DeleteRecord", "DELETE", {
    parser: "syntax-v1.0", dialog: "typed-source-v0.1", selectedExecution: "review-required-v0.1",
    browserPolicy: "adapt-required", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-delete-confirmed-records.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-delete-confirmed-records.expected.json",
  }),
  entry("data", "undelete-records", "UndeleteRecord", "UNDELETE", {
    parser: "syntax-v1.0", dialog: "typed-source-v0.1", selectedExecution: "review-required-v0.1",
    browserPolicy: "adapt-required", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-undelete-confirmed-records.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-undelete-confirmed-records.expected.json",
  }),

  entry("variables", "define", "Define", "DEFINE", { parser: "syntax-v0.8", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", fullProgramExecution: "bounded-component-v0.1" }),
  entry("variables", "define-group", "DefineGroup", "DEFINE GROUPVAR", {
    parser: "syntax-v0.8", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-define-group.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-define-group.expected.json",
  }),
  entry("variables", "undefine", "Undefine", "UNDEFINE", {
    parser: "syntax-v0.8", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-undefine-standard-variable.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-undefine-standard-variable.expected.json",
  }),
  entry("variables", "assign", "Assign", "ASSIGN", { parser: "syntax-v0.8", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1" }),
  entry("variables", "recode", "Recode", "RECODE", { parser: "syntax-v0.8", dialog: "typed-source-v0.1", fullProgramExecution: "bounded-component-v0.1" }),
  entry("variables", "display", "Display", "DISPLAY", {
    parser: "syntax-v0.8", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-display-dbvariables.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-display-dbvariables.expected.json",
  }),

  entry("select-if", "select", "Select", "SELECT", { parser: "syntax-v0.8", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1" }),
  entry("select-if", "cancel-select", "CancelSelect", "CANCEL SELECT", { parser: "syntax-v0.8", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1" }),
  entry("select-if", "if", "If", "IF", {
    parser: "syntax-v0.8", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-if-standard-variable.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-if-standard-variable.expected.json",
  }),
  entry("select-if", "sort", "Sort", "SORT", { parser: "syntax-v0.8", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1" }),
  entry("select-if", "cancel-sort", "CancelSort", "CANCEL SORT", { parser: "syntax-v0.8", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1" }),

  entry("statistics", "list", "List", "LIST", {
    parser: "syntax-v0.8", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-list-core-fields.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-list-core-fields.expected.json",
  }),
  entry("statistics", "frequencies", "Frequencies", "FREQ", {
    parser: "syntax-v0.8", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", fullProgramExecution: "bounded-component-v0.1", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-frequency-case-status.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-frequency-case-status.expected.json",
  }),
  entry("statistics", "tables", "Tables", "TABLES", {
    parser: "syntax-v0.8", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", fullProgramExecution: "bounded-component-v0.1", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-tables-fisher.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-tables-fisher.expected.json",
  }),
  entry("statistics", "match", "Match", "MATCH", { explorer: "legacy-enum-only" }),
  entry("statistics", "means", "Means", "MEANS", {
    parser: "syntax-v0.8", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-means-age.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-means-age.expected.json",
  }),
  entry("statistics", "summarize", "Summarize", "SUMMARIZE", {
    parser: "syntax-v1.0", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", browserPolicy: "adapt-required", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-summarize-age-by-sex.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-summarize-age-by-sex.expected.json",
  }),
  entry("statistics", "graph", "Graph", "GRAPH", {
    parser: "syntax-v1.0", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-graph-case-status.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-graph-case-status.expected.json",
  }),
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

  entry("options", "set", "Set", "SET", {
    parser: "syntax-v1.0", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", fullProgramExecution: "bounded-component-v0.1",
    parityStatus: "browser-verified", validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-tables-missing.pgm7",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-tables-missing.expected.json",
  }),
] as const;

export function classicCommandParityEntry(group: ClassicCommandGroupKey, key: string): ClassicCommandParityEntry | undefined {
  return CLASSIC_COMMAND_PARITY.find((candidate) => candidate.group === group && candidate.key === key);
}
