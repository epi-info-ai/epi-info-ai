export type ClassicCommandGroupKey = "data" | "variables" | "select-if" | "statistics" | "advanced-statistics" | "output" | "user-defined" | "user-interaction" | "options";
export type ClassicCommandParserState = "none" | "syntax-v0.8" | "syntax-v0.9" | "syntax-v1.0";
export type ClassicCommandDialogState = "gap" | "typed-source-v0.1" | "typed-source-v0.2" | "settings-v0.1";
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
  validationFixture?: string;
  expectedOutput?: string;
  legacyOutput?: string;
  evidence: string;
}

type EntryOverrides = Partial<Omit<ClassicCommandParityEntry, "id" | "group" | "key" | "legacyName" | "sourceCommand">>;
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
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-tables-stratified-two-by-two.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-tables-stratified-two-by-two.expected.json",
  }),
  entry("statistics", "match", "Match", "MATCH", {
    explorer: "legacy-enum-only", parser: "syntax-v1.0", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", fullProgramExecution: "bounded-component-v0.1", browserPolicy: "adapt-required", parityStatus: "browser-verified",
    validationProgram: "wasm/demo/examples/matched-case-control/match-hand-audit.pgm7",
    expectedOutput: "wasm/tests/fixtures/algorithm-validation/matched-pairs-contract-v0.1.json",
    evidence: "Typed syntax preserves all five EpiInfoGrammar.txt Match_* productions plus WEIGHTVAR, MATCHVAR, and SET-clause options. The browser executes only the explicit row-column, single-MATCHVAR, unweighted 1:1 boundary through the V0.16 Rust/WASM candidate. The inspected Rule_Match.cs reports NOT yet implemented, so experienced field users will perform historical workflow comparison; browser-verified is not legacy-parity-verified.",
  }),
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
  entry("advanced-statistics", "logistic-regression", "LogisticRegression", "LOGISTIC", {
    parser: "syntax-v1.0", selectedExecution: "executes-v0.1", fullProgramExecution: "bounded-component-v0.1", browserPolicy: "adapt-required",
    validationProgram: "wasm/demo/examples/matched-case-control/matched-case-control-command-tour.pgm7",
    validationFixture: "wasm/demo/examples/matched-case-control/case-control-database-example.xlsx",
    evidence: "The retained Epi Info 7 grammar and LogisticRegression dialog define outcome, terms, MATCHVAR, WEIGHTVAR, TITLETEXT, PVALUE, OUTTABLE, LINKFUNCTION, and NOINTERCEPT syntax. Browser V0.1 executes only simple numeric/binary terms with one MATCHVAR through an explicit TypeScript conditional-likelihood kernel. Ordinary logistic regression, categorical expansion, interactions, weights, OUTTABLE, Rust/WASM migration, and desktop differential output remain fail-closed; status therefore remains not-started under the strict parity gate.",
  }),
  entry("advanced-statistics", "kaplan-meier", "KaplanMeierSurvival", "KMSURVIVAL"),
  entry("advanced-statistics", "cox", "CoxProportionalHazards", "COXPH"),
  entry("advanced-statistics", "complex-frequencies", "ComplexSampleFrequencies", "FREQ", {
    parser: "syntax-v0.8", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", fullProgramExecution: "bounded-component-v0.1",
    parityStatus: "browser-verified", validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-frequency-psuvar.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-frequency-psuvar.expected.json",
  }),
  entry("advanced-statistics", "complex-tables", "ComplexSampleTables", "TABLES", {
    parser: "syntax-v0.8", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", fullProgramExecution: "bounded-component-v0.1",
    parityStatus: "browser-verified", validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-tables-psuvar.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-tables-psuvar.expected.json",
  }),
  entry("advanced-statistics", "complex-means", "ComplexSampleMeans", "MEANS", { parser: "syntax-v0.8", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", fullProgramExecution: "bounded-component-v0.1", browserPolicy: "adapt-required", parityStatus: "browser-verified", validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-means-psuvar-outtable.pgm", expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-means-psuvar-outtable.expected.json" }),

  entry("output", "header", "Header", "HEADER", {
    parser: "syntax-v1.0", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", fullProgramExecution: "bounded-component-v0.1",
    browserPolicy: "adapt-required", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-header.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-header.expected.json",
  }),
  entry("output", "type", "Type", "TYPEOUT", {
    parser: "syntax-v1.0", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", fullProgramExecution: "bounded-component-v0.1",
    browserPolicy: "adapt-required", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-typeout.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-typeout.expected.json",
  }),
  entry("output", "routeout", "Routeout", "ROUTEOUT", {
    parser: "syntax-v1.0", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", fullProgramExecution: "bounded-component-v0.1",
    browserPolicy: "adapt-required", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-routeout.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-routeout.expected.json",
  }),
  entry("output", "closeout", "Closeout", "CLOSEOUT", {
    parser: "syntax-v1.0", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", fullProgramExecution: "bounded-component-v0.1",
    browserPolicy: "adapt-required", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-closeout.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-closeout.expected.json",
  }),
  entry("output", "printout", "Printout", "PRINTOUT", {
    parser: "syntax-v1.0", dialog: "typed-source-v0.1", selectedExecution: "review-required-v0.1", fullProgramExecution: "bounded-component-v0.1",
    browserPolicy: "adapt-required", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-printout.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-printout.expected.json",
  }),
  entry("output", "reports", "Reports", "REPORT", { explorer: "legacy-enum-only", browserPolicy: "adapt-required" }),
  entry("output", "store-output", "StoreOutput", "N/A (settings dialog)", {
    dialog: "settings-v0.1", browserPolicy: "adapt-required", parityStatus: "browser-verified",
    validationFixture: "wasm/tests/fixtures/classic-command-parity/output-storage-settings.input.json",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/output-storage-settings.expected.json",
    evidence: "Epi.Windows.Analysis/Dialogs/StoringOutputDialog.cs (configuration dialog; no generated command text)",
  }),

  entry("user-defined", "define-command", "DefineCommand", "DEFINE COMMAND"),
  entry("user-defined", "user-command", "UserCommand", "USERCOMMAND"),
  entry("user-defined", "run-saved-program", "RunSavedProgram", "RUNPGM", { browserPolicy: "adapt-required" }),
  entry("user-defined", "execute-file", "ExecuteFile", "EXECUTE", { browserPolicy: "blocked" }),

  entry("user-interaction", "dialog", "Dialog", "DIALOG", {
    parser: "syntax-v1.0", dialog: "typed-source-v0.2", selectedExecution: "executes-v0.1", fullProgramExecution: "bounded-component-v0.1",
    browserPolicy: "adapt-required", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-dialog-variants.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-dialog-variants.expected.json",
    evidence: "Epi.Core/Resources/EpiInfoGrammar.txt: Simple_Dialog_Statement; Epi.Windows.Analysis/Dialogs/DialogDialog.cs",
  }),
  entry("user-interaction", "beep", "Beep", "BEEP", {
    parser: "syntax-v1.0", dialog: "typed-source-v0.1", selectedExecution: "executes-v0.1", fullProgramExecution: "bounded-component-v0.1",
    browserPolicy: "adapt-required", parityStatus: "browser-verified",
    validationProgram: "wasm/tests/fixtures/classic-command-parity/foodborne-beep.pgm",
    expectedOutput: "wasm/tests/fixtures/classic-command-parity/foodborne-beep.expected.json",
    evidence: "Epi.Core/Resources/EpiInfoGrammar.txt: Beep_Statement; Epi.Windows.Analysis/Dialogs/BeepDialog.cs; AnalysisMainForm.cs: Action.Beep",
  }),
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
