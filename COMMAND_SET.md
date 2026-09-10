# Epi Info AI command-set progress

This is the concise progress dashboard for porting the Epi Info 7 Classic
Analysis programming language. It does not redefine parity. The authoritative
machine-readable inventory is
[`wasm/app/programming/classic-command-parity.ts`](wasm/app/programming/classic-command-parity.ts),
and the evidence rules and detailed gaps are in the
[`Classic Analysis command compatibility registry`](wasm/docs/design/classic-command-compatibility-registry.md).

## Snapshot

Last reconciled: **2026-09-10**

| Measure | Count |
|---|---:|
| Legacy enum entries retained as the compatibility floor | 49 |
| Visible in the legacy Command Explorer | 45 |
| Typed AST/parser branches | 28 |
| Typed source dialogs | 28 |
| Selected execution or explicit reviewed handoff | 27 |
| Bounded full-program components | 8 |
| Browser-verified using checked-in `.pgm` and expected output | 21 |
| Legacy-parity-verified against reviewed desktop Epi Info output | 0 |
| Untouched command entries | 21 |

These counts describe implementation progress, not full parity. A command is
not parity-complete merely because its syntax parses or one browser workflow
runs.

## Status legend

- **BV** — browser-verified with a checked-in foodborne `.pgm` and asserted
  expected output.
- **Candidate** — typed parser/dialog and some execution exist, but the full
  browser/legacy evidence gate is incomplete.
- **Gap** — the command remains inventoried but does not yet have a typed port.
- **Reviewed** — the operation is intentionally non-automatic and requires a
  visible confirmation or browser adaptation.
- **Legacy differential** — captured output from desktop Epi Info is still
  required before any command can be marked `legacy-parity-verified`.

## Detailed command inventory

| Legacy group | Command entry | Source spelling | Current implementation | Overall evidence |
|---|---|---|---|---|
| Data | Read | `READ` | Typed parser/dialog; selected execution | BV |
| Data | Relate | `RELATE` | Typed parser/dialog; selected execution | BV |
| Data | Write | `WRITE` | Typed parser/dialog; browser download adapter | BV |
| Data | Merge | `MERGE` | Typed parser/dialog; reviewed current-project upsert | BV |
| Data | DeleteFile | `DELETE` | Typed parser/dialog; reviewed table deletion | BV, Reviewed |
| Data | DeleteRecord | `DELETE` | Typed parser/dialog; reviewed recoverable record deletion | BV, Reviewed |
| Data | UndeleteRecord | `UNDELETE` | Typed parser/dialog; reviewed record restoration | BV, Reviewed |
| Variables | Define | `DEFINE` | Typed parser/dialog; selected and bounded program execution | Candidate |
| Variables | DefineGroup | `DEFINE GROUPVAR` | Typed parser/dialog; selected execution | BV |
| Variables | Undefine | `UNDEFINE` | Typed parser/dialog; selected execution | BV |
| Variables | Assign | `ASSIGN` | Typed parser/dialog; selected execution | Candidate |
| Variables | Recode | `RECODE` | Typed parser/dialog; bounded program component | Candidate |
| Variables | Display | `DISPLAY` | Typed parser/dialog; selected execution | BV |
| Select/If | Select | `SELECT` | Typed parser/dialog; selected execution | Candidate |
| Select/If | CancelSelect | `CANCEL SELECT` | Typed parser/dialog; selected execution | Candidate |
| Select/If | If | `IF` | Typed parser/dialog; selected execution | BV |
| Select/If | Sort | `SORT` | Typed parser/dialog; selected execution | Candidate |
| Select/If | CancelSort | `CANCEL SORT` | Typed parser/dialog; selected execution | Candidate |
| Statistics | List | `LIST` | Typed parser/dialog; selected execution | BV |
| Statistics | Frequencies | `FREQ` | Typed parser/dialog; selected and bounded program execution | BV |
| Statistics | Tables | `TABLES` | Typed parser/dialog; selected and bounded program execution | BV |
| Statistics | Match | `MATCH` | Legacy enum only | Gap |
| Statistics | Means | `MEANS` | Typed parser/dialog; selected execution | BV |
| Statistics | Summarize | `SUMMARIZE` | Typed parser/dialog; selected execution | BV |
| Statistics | Graph | `GRAPH` | Typed parser/dialog; selected execution | BV |
| Statistics | Map | `MAP` | Legacy enum only | Gap |
| Advanced Statistics | LinearRegression | `REGRESS` | Inventoried | Gap |
| Advanced Statistics | LogisticRegression | `LOGISTIC` | Inventoried | Gap |
| Advanced Statistics | KaplanMeierSurvival | `KMSURVIVAL` | Inventoried | Gap |
| Advanced Statistics | CoxProportionalHazards | `COXPH` | Inventoried | Gap |
| Advanced Statistics | ComplexSampleFrequencies | `FREQ` | Typed `PSUVAR` branch; bounded program execution | BV |
| Advanced Statistics | ComplexSampleTables | `TABLES` | Typed `PSUVAR` branch; bounded program execution | BV |
| Advanced Statistics | ComplexSampleMeans | `MEANS` | Typed complex-sample branch; bounded program execution | BV |
| Output | Header | `HEADER` | Browser output adaptation not started | Gap |
| Output | Type | `TYPEOUT` | Browser output adaptation not started | Gap |
| Output | Routeout | `ROUTEOUT` | Browser output adaptation not started | Gap |
| Output | Closeout | `CLOSEOUT` | Browser output adaptation not started | Gap |
| Output | Printout | `PRINTOUT` | Browser output adaptation not started | Gap |
| Output | Reports | `REPORT` | Legacy enum only; browser adaptation not started | Gap |
| Output | StoreOutput | `STORE` | Browser output adaptation not started | Gap |
| User-Defined Commands | DefineCommand | `DEFINE COMMAND` | Inventoried | Gap |
| User-Defined Commands | UserCommand | `USERCOMMAND` | Inventoried | Gap |
| User-Defined Commands | RunSavedProgram | `RUNPGM` | Project-scoped browser adaptation not started | Gap |
| User-Defined Commands | ExecuteFile | `EXECUTE` | Arbitrary execution is blocked; safe adaptation required | Gap |
| User Interaction | Dialog | `DIALOG` | Browser dialog adaptation not started | Gap |
| User Interaction | Beep | `BEEP` | Browser audio adaptation not started | Gap |
| User Interaction | Help | `HELP` | Legacy enum only; browser adaptation not started | Gap |
| User Interaction | Quit | `QUIT` | Browser lifecycle adaptation not started | Gap |
| Options | Set | `SET` | Typed parser/dialog; selected and bounded program execution | BV |

## What “full parity” requires

Every applicable command must close discovery, syntax, dialog, canonical source,
semantics, selected-run behavior, full-program sequencing, output, browser
safety/adaptation, automated validation, and experienced-user review. A BV
command still needs desktop Epi Info differential evidence before its status can
be raised to legacy parity.

The acceptance path is deliberately visible: load the canonical foodborne
project, open the command's `.pgm` in the Program Editor, review diagnostics,
run it, verify Output and session effects, and assert command history. Direct
parser tests support this path but do not replace it.

## Test and example locations

- Browser command fixtures and expected outputs:
  [`wasm/tests/fixtures/classic-command-parity`](wasm/tests/fixtures/classic-command-parity)
- Foodborne command-tour programs:
  [`wasm/demo/examples`](wasm/demo/examples)
- Program and browser acceptance tests:
  [`wasm/tests/phase0-smoke.mjs`](wasm/tests/phase0-smoke.mjs) and
  [`wasm/tests/browser/application-shell.spec.mjs`](wasm/tests/browser/application-shell.spec.mjs)
- Algorithm validation contracts and JupyterLite evidence:
  [`wasm/docs/validation`](wasm/docs/validation) and
  [`wasm/validation-lab`](wasm/validation-lab)
- New-branch commands, which do not silently count as legacy parity:
  [`wasm/docs/design/new-branch-command-registry.md`](wasm/docs/design/new-branch-command-registry.md)

## Maintenance rule

Update the TypeScript registry and its evidence first. Then update this dashboard
in the same commit. Tests assert the registry totals and require this document
to remain present; any status promotion must name its `.pgm`, expected output,
and, for legacy parity, reviewed desktop output.
