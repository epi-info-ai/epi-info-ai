# Epi Info AI command-set progress

This is the concise progress dashboard for porting the Epi Info 7 Classic
Analysis programming language. It does not redefine parity. The authoritative
machine-readable inventory is
[`wasm/app/programming/classic-command-parity.ts`](wasm/app/programming/classic-command-parity.ts),
and the evidence rules and detailed gaps are in the
[`Classic Analysis command compatibility registry`](wasm/docs/design/classic-command-compatibility-registry.md).

## Snapshot

Last reconciled: **2026-09-15**

| Measure | Count |
|---|---:|
| Legacy enum entries retained as the compatibility floor | 49 |
| Visible in the legacy Command Explorer | 45 |
| Typed AST/parser branches | 36 |
| Typed source dialogs | 36 |
| Selected execution or explicit reviewed handoff | 34 |
| Bounded full-program components | 15 |
| Browser-verified using checked-in `.pgm` and expected output | 28 |
| Legacy-parity-verified against reviewed desktop Epi Info output | 0 |
| Browser-verified non-command settings entries | 1 |
| Untouched command entries | 12 |

These counts describe implementation progress, not full parity. A command is
not parity-complete merely because its syntax parses or one browser workflow
runs.

## Status legend

- **BV** — browser-verified with a checked-in `.pgm`/`.pgm7`, compatible test
  data, and asserted expected output. Commands are dataset-independent; example
  catalogs only determine which teaching programs the editor offers.
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
| Statistics | Match | `MATCH` | Typed AST preserves all five retained grammar forms and options; the Program Editor executes the explicit unweighted `MATCH exposure outcome MATCHVAR=id` 1:1 boundary through typed record-to-pair derivation, the V0.16 Rust/WASM statistics Worker, visible Output, common history, dataset-bound multi-command tours, explicit infinity/no-discordance boundary programs, and fingerprinted aggregate-only field-review JSON export; [archived sources and candidate corpora](wasm/docs/research/match-command-sources-and-data.md), the [bounded method contract](wasm/docs/validation/matched-pairs-method-contract.md), and an [independent JupyterLite comparison](wasm/validation-lab/content/validate-match.ipynb) govern it | Browser-verified bounded revival; field-user legacy workflow comparison pending; wildcard, weight, multiple-match-field, variable-ratio, and SET-option execution gaps preserved |
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
| Output | Header | `HEADER` | Typed level-1 literal; selected and bounded program execution | BV |
| Output | Type | `TYPEOUT` | Typed safe literal; selected and bounded program execution | BV |
| Output | Routeout | `ROUTEOUT` | Typed in-session HTML destination; selected and bounded program execution | BV |
| Output | Closeout | `CLOSEOUT` | Finalizes active browser report for explicit download | BV |
| Output | Printout | `PRINTOUT` | Reviewed handoff of current Output to browser Print | BV, Reviewed |
| Output | Reports | `REPORT` | Legacy enum only; browser adaptation not started | Gap |
| Output | StoreOutput | N/A (settings dialog) | Familiar prefix, sequence, and result-flag settings persist in browser-local storage; session results can be inspected | BV UI |
| User-Defined Commands | DefineCommand | `DEFINE COMMAND` | Inventoried | Gap |
| User-Defined Commands | UserCommand | `USERCOMMAND` | Inventoried | Gap |
| User-Defined Commands | RunSavedProgram | `RUNPGM` | Project-scoped browser adaptation not started | Gap |
| User-Defined Commands | ExecuteFile | `EXECUTE` | Arbitrary execution is blocked; safe adaptation required | Gap |
| User Interaction | Dialog | `DIALOG` | Full legacy grammar parsed and authored; message, typed scalar, fixed/project choices, and explicit browser file/name prompts execute against Standard session variables | BV candidate |
| User Interaction | Beep | `BEEP` | No-option typed command; local Web Audio notification with visible audited fallback | BV |
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
