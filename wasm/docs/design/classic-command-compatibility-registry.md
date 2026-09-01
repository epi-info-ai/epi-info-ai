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
closed. `parser: syntax-v0.5`, for example, means only that syntax is understood;
it does not authorize execution.

The machine-readable inventory also carries one explicit overall status:
`not-started`, `browser-verified`, or `legacy-parity-verified`. Any status above
`not-started` requires a checked-in `.pgm` and machine-asserted expected-output
file over the canonical foodborne corpus. `legacy-parity-verified` additionally
requires captured, reviewed output from desktop Epi Info for the same program.
This prevents a browser-only test from being mislabeled as parity with the old
interpreter.

## Current group baseline

| Group | Legacy entries | Explorer-visible | Current implementation floor |
|---|---:|---:|---|
| Data | 7 | 7 | READ selects a current-project form for the Classic session; external storage and destructive commands require reviewed browser adapters |
| Variables | 6 | 6 | DEFINE, UNDEFINE, and ASSIGN have bounded Standard session-variable execution; DEFINE and numeric RECODE also author the bounded full-program component |
| Select/If | 5 | 5 | SELECT/CANCEL SELECT and SORT/CANCEL SORT have typed source dialogs and bounded selected execution; IF adds a browser-verified Standard-variable branch while record-context semantics remain open |
| Statistics | 8 | 6 | LIST, FREQ, MEANS, and TABLES have typed dialogs; selected LIST/FREQ/MEANS execute; TABLES requires value review |
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
| Typed AST/parser | 14 | `READ`, `DEFINE`, `UNDEFINE`, `ASSIGN`, `RECODE`, `SELECT`, `CANCEL SELECT`, `IF`, `SORT`, `CANCEL SORT`, `LIST`, `FREQ`, `MEANS`, `TABLES` |
| Typed source dialog | 14 | Same 14 commands |
| Selected execution or reviewed handoff | 13 | All above except `RECODE`; `TABLES` is a review-required handoff rather than calculation |
| Bounded full-program component | 3 | `DEFINE`, `RECODE`, `FREQ` |
| Completely untouched | 35 | Recorded individually in the machine registry; none may disappear from the compatibility floor |
| Browser-verified with foodborne `.pgm` + expected output | 2 | `IF`, `UNDEFINE` |
| Legacy-parity-verified | 0 | No command may enter this row without reviewed desktop Epi Info output |

The implementation columns describe port progress, not parity closure. For
example, selected execution can be browser-tested while its command remains
`not-started` under the stricter program/output differential gate.

## Current command candidates

| Command | Parser | Typed dialog | Selected run | Full-program role | Important open parity gaps |
|---|---|---|---|---|---|
| `READ` | AST 0.5 | V0.1 | Selects one named current-project form and records history | None | External file/database adapters, passwords/SQL policy, record state, exact project/table syntax |
| `LIST` | AST 0.5 | V0.1 | Renders explicit fields, `*`, or `* EXCEPT` from the active session | None | Legacy display variants, output append/export/print behavior, large-list paging |
| `FREQ` | AST 0.5 | V0.1 | Executes one field with optional one `STRATAVAR` against the active session | Final step of bounded DEFINE/RECODE/FREQ | Multiple fields, `* EXCEPT`, weights, more strata, options, output tables, exact legacy output behavior |
| `MEANS` | AST 0.5 | V0.1 | Executes one numeric field against the active session | None | Cross-tabulation, tests/ANOVA, strata, weights, options, output tables |
| `TABLES` | AST 0.5 | V0.1 | Field validation and current-form handoff only | None | Active-session value classification, source-level exposed/case semantics, unstratified and multi-strata behavior, weights, match variables, options, output parity |
| `DEFINE` | AST 0.5 | V0.1 | Declares one Standard typed scalar in the Classic session | Bounded Standard text variable | Global/Permanent lifetimes, initializers, full variable-expression integration, differential validation |
| `UNDEFINE` | AST 0.5 | V0.1 Standard-variable selector/all toggle | Removes one or all Standard session variables | None | Global/Permanent lifetime, legacy no-op/error wording, full-program sequencing, desktop differential output |
| `RECODE` | AST 0.5 | V0.1 numeric range grid | No | Bounded numeric ranges to text | Value/date recodes, fill-ranges/reverse options, missing rules, broader target types, selected execution |
| `ASSIGN` | AST 0.5 | V0.1 literal assignment | Assigns one type-compatible literal to a defined Standard session variable | None | Record-by-record field mutation, missing syntax, identifiers/functions/operators, Global/Permanent variables, full-program sequencing |
| `SELECT`, `CANCEL SELECT` | AST 0.5 | V0.1 | One typed field-to-literal comparison applies cumulative session filtering; cancel restores the READ source | None | AND/OR/LIKE/functions/arithmetic, missing-value syntax, exact collation, full-program sequencing, differential validation |
| `SORT`, `CANCEL SORT` | AST 0.5 | V0.1 | Stable typed multi-field ordering replaces prior sort; cancel restores source order without changing selection | None | Exact DataView culture/case/null collation, defined variables, full-program sequencing, differential validation |
| `IF` | AST 0.5 | V0.1 Standard-variable condition/branches | Executes one validated literal ASSIGN in THEN or ELSE | None | Record-by-record field context, compound expressions/functions, arbitrary/nested statement blocks, missing-value parity, full-program transactions, desktop differential output |

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
supports them. Typed `SELECT` now validates one field-to-literal comparison,
narrows the active session cumulatively with legacy `AND` semantics, reports
total/selected/excluded/missing counts, and makes LIST/FREQ/MEANS consume the
selected records. Bare `SELECT` and `CANCEL SELECT` restore the READ source.
Wider expression semantics remain fail-closed. Typed `SORT` now validates ordered
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
