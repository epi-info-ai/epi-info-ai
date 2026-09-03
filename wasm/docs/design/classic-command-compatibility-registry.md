# Classic Analysis command compatibility registry

## Purpose

Programming commands are a distinct compatibility floor. A familiar Command
Explorer label is not command parity, and a parser node is not execution parity.
The machine-readable registry is
[`app/programming/classic-command-parity.ts`](../../app/programming/classic-command-parity.ts).
It is seeded from the legacy `Epi.Windows.Analysis/Enums.cs`, reconciled with the
shipped `CommandExplorer` tree, dialogs, interpreter rules, Output rendering,
Sample programs, and training corpus.

The initial inventory contains **49 legacy enum entries in nine groups**. Of
these, **45 are visible in the shipped Command Explorer**. Match, Map, Reports,
and Help remain recorded as `legacy-enum-only`; they are not silently promoted
into the learned browser tree.

## Parity dimensions

Every command closes independently across these dimensions:

| Dimension | Required evidence |
|---|---|
| Discovery | Correct group, label, order, visibility, enabled state, and keyboard path |
| Syntax | Legacy forms/options parse with precise spans; malformed and ambiguous variants fail clearly |
| Dialog | Familiar fields, defaults, filtering, validation, source preview, OK/Save/Cancel behavior, and focus order |
| Source | Dialog, direct typing, visual flow, and reviewed AI proposal produce the same visible canonical command |
| Semantics | Field/variable scope, types, missing values, selection, sorting, weights, strata, and session effects match |
| Selected run | Exact legacy selection behavior, statement boundaries, failure behavior, cancellation, and output append behavior |
| Full program | Sequencing, state transitions, rollback, reusable programs, and unsupported-source preservation match |
| Output | Tables/text/graphs, headings, warnings, confidence methods, navigation, export, and print behavior match |
| Safety/adaptation | Files, databases, processes, network, credentials, dialogs, printers, and destructive effects use explicit browser policy |
| Validation | Legacy differential fixtures, independent algorithm references, hostile inputs, browser tests, and experienced-user review pass |

No command is reported as parity-complete until every applicable dimension is
closed. `parser: syntax-v0.8`, for example, means only that syntax is understood;
it does not authorize execution.

The machine-readable inventory also carries one explicit overall status:
`not-started`, `browser-verified`, or `legacy-parity-verified`. Any status above
`not-started` requires a checked-in `.pgm` and machine-asserted expected-output
file over the canonical foodborne corpus. `legacy-parity-verified` additionally
requires captured, reviewed output from desktop Epi Info for the same program.
This prevents a browser-only test from being mislabeled as parity with the old
interpreter.

The `.pgm` must also pass through the visible Program Editor acceptance path:
load the foodborne project, use **Open Pgm**, inspect the CodeMirror source and
diagnostics, verify/run it, compare Output and session effects, and assert its
history entry. Direct parser or engine invocation is supporting evidence only
and cannot by itself earn `browser-verified` status.

Program-level completion is stricter still: every distinct legacy command family
referenced by a `.pgm7` acceptance program must be `legacy-parity-verified` before
that program may be described as parity-complete. Successful bounded composition
or sequential browser execution does not waive unimplemented syntax variants,
session semantics, errors, output behavior, or desktop-differential evidence.
The foodborne command tour is therefore an acceptance target, not yet a parity
demo.

## Current group baseline

| Group | Legacy entries | Explorer-visible | Current implementation floor |
|---|---:|---:|---|
| Data | 7 | 7 | READ selects a current-project form; RELATE joins forms; WRITE downloads selected fields; MERGE previews and confirms current-project upserts; DELETE TABLES clears a reviewed form data table; recoverable DELETE/UNDELETE RECORDS archive and restore matching records; external storage and other destructive variants require reviewed adapters |
| Variables | 6 | 6 | DEFINE, UNDEFINE, and ASSIGN have bounded Standard session-variable execution; DEFINE GROUPVAR stores named field/Standard-variable groups and LIST expands field members; DISPLAY DBVARIABLES renders field/defined metadata; DEFINE and numeric RECODE also author the bounded full-program component |
| Select/If | 5 | 5 | SELECT/CANCEL SELECT and SORT/CANCEL SORT have typed source dialogs and bounded selected execution; IF adds a browser-verified Standard-variable branch while record-context semantics remain open |
| Statistics | 8 | 6 | LIST, FREQ, MEANS, TABLES, SUMMARIZE, and GRAPH have typed dialogs and selected execution; TABLES renders categorical M×N counts, row/column percentages, totals, expected counts, and Pearson results without inferring exposed/case values, while the separate stratified 2 x 2 workflow retains explicit classification review; GRAPH renders bounded horizontal Bar, vertical Column, and category-share Pie branches |
| Advanced Statistics | 7 | 7 | Visible gaps; algorithm and dialog parity tracked independently |
| Output | 7 | 6 | Visible gaps; every file/print route requires an explicit browser adaptation |
| User-Defined Commands | 4 | 4 | Visible gaps; RUNPGM requires bounded project resolution; arbitrary EXECUTE is blocked |
| User Interaction | 4 | 3 | Visible gaps; browser dialog/audio/help/quit adaptations required |
| Options | 1 | 1 | Visible gap; session-scoped SET semantics required |

## Port inventory snapshot

The authoritative inventory remains the 49-entry TypeScript registry; this
snapshot makes its current implementation states easy to review:

| State | Count | Commands |
|---|---:|---|
| Typed AST/parser | 24 | `READ`, `RELATE`, `WRITE`, `MERGE`, `DELETE TABLES`, `DELETE RECORDS`, `UNDELETE RECORDS`, `DEFINE`, `DEFINE GROUPVAR`, `UNDEFINE`, `ASSIGN`, `RECODE`, `DISPLAY`, `SELECT`, `CANCEL SELECT`, `IF`, `SORT`, `CANCEL SORT`, `LIST`, `FREQ`, `MEANS`, `TABLES`, `SUMMARIZE`, `GRAPH` |
| Typed source dialog | 24 | Same 24 commands |
| Selected execution or reviewed handoff | 23 | All above except `RECODE`; `TABLES` executes a categorical cross-tab, while `DELETE TABLES`, `DELETE RECORDS`, and `UNDELETE RECORDS` require reviewed mutation handoffs |
| Bounded full-program component | 3 | `DEFINE`, `RECODE`, `FREQ` |
| Completely untouched | 25 | Recorded individually in the machine registry; none may disappear from the compatibility floor |
| Browser-verified with foodborne `.pgm` + expected output | 17 | `READ`, `IF`, `UNDEFINE`, `DISPLAY`, `DEFINE GROUPVAR`, `RELATE`, `WRITE`, `MERGE`, `DELETE TABLES`, `DELETE RECORDS`, `UNDELETE RECORDS`, `LIST`, `FREQ`, `MEANS`, `TABLES`, `SUMMARIZE`, `GRAPH` |
| Legacy-parity-verified | 0 | No command may enter this row without reviewed desktop Epi Info output |

The implementation columns describe port progress, not parity closure. For
example, selected execution can be browser-tested while its command remains
`not-started` under the stricter program/output differential gate.

## Current command candidates

| Command | Parser | Typed dialog | Selected run | Full-program role | Important open parity gaps |
|---|---|---|---|---|---|
| `READ` | AST 0.8 | V0.1 | Selects one named current-project form and records history | None | External file/database adapters, passwords/SQL policy, record state, exact project/table syntax |
| `RELATE` | AST 0.8 | V0.1 one-key builder; composite keys accepted in source | Validates same-type keys, performs one-to-many MATCHING or ALL joins, renames collisions, enforces a reviewed 250,000-row browser limit, and activates the combined table | None | External source adapters, dialog UI for additional key pairs, exact legacy field naming/type coercion/missing behavior, page-table metadata, desktop differential Output |
| `WRITE` | AST 0.9 | V0.1 familiar filename and variable selector | `REPLACE "Text"` downloads selected active fields and records the action in history | None | APPEND choose-file/schema-preview/confirmation adapter, portable upload/merge/download fallback, Epi7/Excel/database drivers, defined-variable output, desktop differential encoding/quoting/missing behavior |
| `MERGE` | AST 1.0 | V0.1 source-form and one-key builder; composite keys accepted in source | Stages updates to uniquely matched destination rows and inserts unmatched source rows; preview plus explicit Apply persists a saved project form | None | External source adapters, multi-key dialog rows, exact legacy collation/coercion/missing/insert mapping, desktop differential Output, and meaning of parsed-but-unused APPEND/UPDATE/RELATE modes |
| `DELETE FILE/TABLE` | AST 1.0 | V0.1 current-project form data-table selector | Stages removal of all records, requires separate review plus acknowledgement, then preserves the form/schema while clearing its browser working-copy records | None | External file/database and Project Files adapters, wildcards, desktop physical-table/form-metadata semantics, `RUNSILENT`, `SAVEDATA`, legacy dialogs/output, and differential validation |
| `DELETE RECORDS` | AST 1.0 | V0.1 all-record toggle or one typed field/literal comparison | Intersects criteria with active READ/SELECT records, stages counts, then archives matches with original indexes and audit events after acknowledgement | None | `PERMANENT`, compound expressions/functions, exact RecStatus/SELECT/missing semantics, related-view cascade, large-operation policy, legacy output, and desktop differential validation |
| `UNDELETE RECORDS` | AST 1.0 | V0.1 all-record toggle or one typed field/literal comparison | Evaluates the current form's Recycle Bin, previews lifecycle counts, then restores matching records near original positions with audit events after acknowledgement | None | Compound expressions/functions, exact RecStatus/missing semantics, related-view cascade, `RUNSILENT`, legacy output, and desktop differential validation |
| `LIST` | AST 0.7 | V0.1 | Renders explicit fields, `*`, `* EXCEPT`, or field GROUPVAR expansion from the active session | None | Standard-variable group members, group expansion in other commands, legacy display variants, output append/export/print behavior, large-list paging |
| `FREQ` | AST 0.7 | V0.1 | Executes one field with optional one `STRATAVAR` against the active session | Final step of bounded DEFINE/RECODE/FREQ | Multiple fields and GROUPVAR expansion, `* EXCEPT`, weights, more strata, options, output tables, exact legacy output behavior |
| `MEANS` | AST 0.7 | V0.1 | Executes one numeric field against the active session | None | GROUPVAR expansion, cross-tabulation, tests/ANOVA, strata, weights, options, output tables |
| `SUMMARIZE` | AST 1.0 | V0.1 one aggregate, source field, result name, output table, and optional group selector | Computes the aggregate against active READ/SELECT records, renders the named table, and retains it for READ during the session | None | Multiple aggregates, `COUNT()` without a field in the dialog, multiple strata, `WEIGHTVAR`, persistence/export, exact aggregate types/order/missing semantics, desktop differential output |
| `GRAPH` | AST 1.0 bounded one-variable form | V0.3 variable, Bar/Column/Pie type, title, and axis titles | Uses the typed FREQ operation over active READ/SELECT records and renders accessible horizontal Bar, vertical Column, or Pie SVG plus an auditable data table | None | Area, Bubble, Epi Curve, Histogram, Line, Rotated Bar, Scatter, Weight Bar, multiple variables/cross-tabs, strata, weights/aggregates, templates, date intervals, 3D, exact legacy sizing/colors/window/output, desktop differential validation |
| `TABLES` | AST 0.8 | V0.7 | Produces unstratified categorical M×N output or the Cartesian strata defined by one or more `STRATAVAR` fields; honors session `SET MISSING=OFF/ON` with legacy default OFF and label `Missing`; `STATISTICS=FISHER` adds bounded 2 × N exact enumeration; true observed 2 × 2 tables add validated Rust/WASM statistics | Sequential command-tour component, including two-field stratification | General R × C Fisher, multiple exposure/outcome forms, weights, match variables, stratified 2 × 2 MH/homogeneity, reviewed `OUTTABLE`, exact legacy Output, desktop differential capture, Rust `epi-lang` migration |
| `DEFINE` | AST 0.7 | V0.1 | Declares one Standard typed scalar in the Classic session | Bounded Standard text variable | Global/Permanent lifetimes, initializers, full variable-expression integration, differential validation |
| `DEFINE GROUPVAR` | AST 0.7 | V0.1 field/Standard-variable selector | Stores a named session group; LIST expands field members in declared order | None | Nested groups, group replacement/error wording, expansion in FREQ/MEANS/TABLES/other commands, Standard-variable LIST output, desktop differential output |
| `UNDEFINE` | AST 0.7 | V0.1 Standard-variable selector/all toggle | Removes one or all Standard session variables | None | Global/Permanent lifetime, legacy no-op/error wording, full-program sequencing, desktop differential output |
| `DISPLAY` | AST 0.7 | V0.1 familiar DBVARIABLES choices | Renders all, defined, field, or selected variable metadata in Output | None | DBVIEWS/TABLES, external database choice, OUTTABLE persistence, exact legacy formatting/type labels, desktop differential HTML |
| `RECODE` | AST 0.7 | V0.1 numeric range grid | No | Bounded numeric ranges to text | Value/date recodes, fill-ranges/reverse options, missing rules, broader target types, selected execution |
| `ASSIGN` | AST 0.7 | V0.1 literal assignment | Assigns one type-compatible literal to a defined Standard session variable | None | Record-by-record field mutation, missing syntax, identifiers/functions/operators, Global/Permanent variables, full-program sequencing |
| `SELECT`, `CANCEL SELECT` | AST 1.0 | V0.2 | Typed compound expressions apply cumulative session filtering; supports parentheses, `AND`/`OR`/`XOR`/`NOT`, comparisons, case-insensitive legacy `LIKE` with `*`, missing `(.)`, concatenation, arithmetic, Standard-variable references, and a reviewed initial function set; cancel restores the READ source | General sequential `.pgm7` runner | Complete legacy function catalog and arity/type behavior, date arithmetic, exact CurrentCulture collation/conversions, legacy Output wording, desktop differential validation, experienced-user review |
| `SORT`, `CANCEL SORT` | AST 0.7 | V0.1 | Stable typed multi-field ordering replaces prior sort; cancel restores source order without changing selection | None | Exact DataView culture/case/null collation, defined variables, full-program sequencing, differential validation |
| `IF` | AST 0.7 | V0.1 Standard-variable condition/branches | Executes one validated literal ASSIGN in THEN or ELSE | None | Record-by-record field context, compound expressions/functions, arbitrary/nested statement blocks, missing-value parity, full-program transactions, desktop differential output |

### SELECT expression-function parity set

The legacy `Rule_FunctionCall` dispatcher is the parity floor: 46 callable names,
not an inferred set of modern JavaScript helpers. The names are `ABS`, `COS`,
`DAY`, `DAYS`, `FORMAT`, `HOUR`, `HOURS`, `MINUTE`, `MINUTES`, `MONTH`, `MONTHS`,
`NUMTODATE`, `NUMTOTIME`, `RECORDCOUNT`, `GROUPROWINDEX`, `LAGVALUE`, `SECOND`,
`SECONDS`, `SYSTEMDATE`, `SYSTEMTIME`, `TXTTODATE`, `TXTTONUM`, `YEAR`, `YEARS`,
`STRLEN`, `SUBSTRING`, `RND`, `EXP`, `LN`, `ROUND`, `LOG`, `SQRT`, `POISSONLCL`,
`POISSONUCL`, `SIN`, `TAN`, `TRUNC`, `STEP`, `UPPERCASE`, `FINDTEXT`, `ENVIRON`,
`EXISTS`, `FILEDATE`, `ZSCORE`, `PFROMZ`, and `EPIWEEK`.

V0.2 parity-reviews `ABS`, `ROUND`, `STRLEN`, and `UPPERCASE`, including argument
counts, null propagation, and `ROUND` midpoint-away-from-zero behavior. The other
42 remain fail-closed. `LEN`, `LENGTH`, `LOWERCASE`, and `TRIM` are deliberately
not treated as aliases because the legacy dispatcher does not expose them; adding
one would require an explicit new-branch registry entry. Promotion of SELECT to
`legacy-parity-verified` requires every dispatcher function applicable to an
expression to have a typed contract and legacy differential fixture, or an
explicitly documented browser adaptation/deprecation decision.

`DEFINE`, `RECODE`, and `FREQ` are now one explicit full-parity work set. The
foodborne age-group PGM is its non-regression anchor, not the definition of
completeness. Their authoritative clause/type/option matrix and promotion gates
are recorded in
`docs/design/programming-ide-compatibility-inventory.md#define-recode-and-freq-full-parity-set`;
all three remain below `legacy-parity-verified` until that matrix and desktop
differential fixtures pass.

## Browser policy

- `candidate`: the command can be reproduced through typed browser/WASM
  operations once semantic and validation gates pass.
- `adapt-required`: legacy behavior depends on files, databases, printers,
  destructive state, UI effects, or another capability requiring a mediated
  browser workflow and explicit registry decision.
- `blocked`: ambient desktop authority is not reproduced. Legacy `EXECUTE`
  cannot launch arbitrary processes, scripts, DLLs, or shell commands.

Adaptation never grants a command direct DOM, network, credential, filesystem,
database, or process authority. Unsupported source remains visible and portable.
The reference adaptation is WRITE: keep the learned command and dialog concepts,
request a capability only through a user gesture, validate and preview before a
mutation, audit the result, and offer a portable fallback where a browser-native
capability is unavailable. MERGE and DELETE TABLES now follow that pattern;
external DELETE FILE/TABLE, ROUTEOUT, RUNPGM, and other desktop-bound variants
remain disabled until their reviewed adapters exist.

## Closure order

1. Freeze command identity, group, visibility, and source keyword from legacy
   evidence; add aliases and variants without overwriting the canonical entry.
2. Capture dialog fields/defaults and syntax productions, including invalid
   examples, from source and the manual.
3. Add AST and schema-aware semantic fixtures without execution.
4. Add a capability-labelled plan and explicit session effects.
5. Bind validated statistical work to the Rust/WASM kernel and orchestration to
   TypeScript; never duplicate formulas in a command-specific evaluator.
6. Validate selected and full-program execution, Output, failure, cancellation,
   history, and round-trip source behavior.
7. Close only after legacy differential and experienced-user review.

## Current wave and next closure

The first `READ -> LIST` slice now establishes explicit current-project dataset
state and line-list Output. Existing selected FREQ and MEANS consume that same
active session. TABLES deliberately refuses a non-current-form session until its
value-classification UI can be bound safely to that form. External READ targets
fail closed rather than receiving ambient browser filesystem or database access.

Typed DEFINE and numeric RECODE dialogs now let the bounded foodborne program be
authored through the familiar tree while keeping its complete source visible.
Their controls intentionally exceed current execution authority: broader DEFINE
types/scopes and general RECODE syntax remain source-only unless a reviewed plan
supports them. Typed `SELECT` V0.2 validates compound expressions, including
parentheses, boolean/comparison operators, legacy `LIKE "pattern*"`, missing
`(.)`, arithmetic, Standard variables, and a reviewed initial function set. It
narrows the active session cumulatively with legacy `AND` semantics, reports
total/selected/excluded/missing counts, and makes LIST/FREQ/MEANS consume the
selected records. Bare `SELECT` and `CANCEL SELECT` restore the READ source.
Unreviewed functions remain fail-closed. Typed `SORT` now validates ordered
current-form fields, replaces the prior sort, applies stable type-aware ascending
or descending ordering, and leaves SELECT membership intact; bare `SORT` and
`CANCEL SORT` restore source order. Exact legacy culture/case/null collation is
still a differential-validation gap. LIST output parity, external data
adapters, destructive commands, RUNPGM, and advanced statistics remain separately
reviewed waves.

Selected `DEFINE` and `ASSIGN` now add the first bounded variable runtime:
Standard scalar definitions and type-compatible literal values live only in the
Classic session, appear in status/history, and reset on READ. Data-source fields
remain immutable in selected execution. Missing values, field references,
functions, arithmetic, Global/Permanent lifetime, and record-by-record program
context fail closed. This infrastructure is the prerequisite for a bounded IF
control-flow slice rather than an implicit expansion of expression authority.
That bounded IF slice now evaluates one initialized Standard variable against a
type-compatible literal and runs exactly one prevalidated ASSIGN branch. Its
foodborne `.pgm` and expected-output fixture make it `browser-verified`; the
registry deliberately withholds `legacy-parity-verified` until the identical
program and output have been reviewed in desktop Epi Info. Record fields,
missing-value comparisons, compound expressions, functions, nesting, and other
branch commands remain fail-closed.

`DEFINE name GROUPVAR members...` now has its familiar Variables-tree path and
typed multi-select dialog. Definitions live in the Classic session, preserve
declared member order, appear in status/history, reset on READ, and expand field
members when LIST resolves. The slice does not create a synthetic data column.
Nested groups, replacement semantics, Standard-variable values in LIST, and
expansion in FREQ/MEANS/TABLES or other consumers remain fail-closed/open until
their legacy behavior and output have separate differential evidence.

`RELATE` now restores the familiar Data-tree path for forms already available
in the current project. Its typed join engine accepts one or more
`current-field :: related-field` key pairs, requires compatible field types,
supports legacy matched-only (`MATCHING`/default) and retained-parent (`ALL`)
behavior, preserves one-to-many rows, renames related-field collisions, and
makes the combined table active for later LIST/FREQ/MEANS commands. A reviewed
250,000-output-row ceiling rejects explosive joins before adding further rows.
The dialog
authors one key pair; composite key source is already parsed and executed.
External project/file/database sources remain explicit browser-adapter work,
and exact desktop column naming, missing/coercion behavior, page metadata, and
Output require differential evidence.

`WRITE REPLACE "Text"` now preserves the familiar Data-tree workflow while
adapting its destination to an explicit browser download. The selected command
exports the active READ/RELATE/SELECT/SORT record set, respects explicit fields
or `* EXCEPT`, and emits UTF-8 CSV without ambient path access. APPEND is not
silently treated as REPLACE: it fails closed pending an adapter that asks the
user to choose an existing CSV, validates its schema and encoding, previews the
append, confirms the mutation, writes through a granted file handle when
available, and otherwise returns a replacement download.

`MERGE` now follows the same mediated-mutation rule. The active saved project
form is the destination; another current-project form is the source. A staged
result reports destination/source/update/insert/final counts, and nothing is
persisted until the user selects Apply Merge. Destination keys must be unique,
shared fields must retain compatible types, and the mutation cannot introduce
new field-validation issues. The legacy parser accepts APPEND, UPDATE, and
RELATE, but the reviewed C# execution path stores that mode without branching on
it; Epi Info AI therefore parses those tokens but rejects them pending desktop
differential evidence rather than inventing three behaviors.

`DELETE TABLES` now restores the familiar Data-tree entry without granting
ambient path authority. The enabled subset targets one named form data table in
the current browser project. Running selected source stages the record count;
nothing changes until the review dialog's acknowledgement is checked and Delete
Table Records is selected. The mutation clears records and dataset provenance
but preserves the project, form schema, rules, Check Code, and programs. The
legacy external-file, external-database, wildcard, `RUNSILENT`, and `SAVEDATA`
variants fail closed. The reviewed C# short external-table rule throws Not
Implemented; Epi Info AI records that fact instead of inventing behavior.

Ordinary `DELETE RECORDS` preserves the legacy recoverable intent for Epi
project views. The dialog authors `DELETE *` or one schema-checked field/literal
comparison. Criteria operate on the active READ/SELECT set, while the staged
mutation is reconciled to the saved form with duplicate-safe record counts.
Confirmation moves matches to the existing project Recycle Bin with original
positions and per-record audit events. `PERMANENT`, `RUNSILENT`, `SAVEDATA`,
compound expressions/functions, derived RELATE tables, and related-child cascade
remain fail-closed pending separate evidence and adapters.

`UNDELETE RECORDS` completes the recoverable lifecycle pair. Legacy C# evaluates
its expression over the complete Epi project table, marks matching rows active,
reruns the current READ, and reports the restored count. The browser adaptation
evaluates the same bounded criterion against Recycle Bin records, previews the
active/archive transition, rejects a stale preview, and preserves archive IDs in
audit events. It requires the complete saved form; active SELECT and RELATE
results must be cancelled or reread before restoration. `RUNSILENT` remains
disabled because this adapted lifecycle requires visible confirmation.

`SUMMARIZE` preserves the legacy named-output-table workflow rather than
reducing it to an unlabeled chart. The V0.1 dialog authors one
`result :: aggregate(field)` expression, a `TO` table name, and optional one
`STRATAVAR`. The typed executor supports the legacy aggregate names, applies
numeric type constraints, includes active SELECT membership, renders the table
in Output, and retains it in the Classic session so a subsequent READ can use
it. Multiple aggregate expressions, multiple strata, and `WEIGHTVAR` are parsed
or rejected explicitly and remain differential-validation gaps.
