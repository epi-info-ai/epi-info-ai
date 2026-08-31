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
closed. `parser: syntax-v0.3`, for example, means only that syntax is understood;
it does not authorize execution.

## Current group baseline

| Group | Legacy entries | Explorer-visible | Current implementation floor |
|---|---:|---:|---|
| Data | 7 | 7 | READ selects a current-project form for the Classic session; external storage and destructive commands require reviewed browser adapters |
| Variables | 6 | 6 | DEFINE and numeric RECODE have typed source dialogs and form the bounded full-program execution component; ASSIGN remains syntax only |
| Select/If | 5 | 5 | SELECT/CANCEL SELECT/IF syntax only |
| Statistics | 8 | 6 | LIST, FREQ, MEANS, and TABLES have typed dialogs; selected LIST/FREQ/MEANS execute; TABLES requires value review |
| Advanced Statistics | 7 | 7 | Visible gaps; algorithm and dialog parity tracked independently |
| Output | 7 | 6 | Visible gaps; every file/print route requires an explicit browser adaptation |
| User-Defined Commands | 4 | 4 | Visible gaps; RUNPGM requires bounded project resolution; arbitrary EXECUTE is blocked |
| User Interaction | 4 | 3 | Visible gaps; browser dialog/audio/help/quit adaptations required |
| Options | 1 | 1 | Visible gap; session-scoped SET semantics required |

## Current command candidates

| Command | Parser | Typed dialog | Selected run | Full-program role | Important open parity gaps |
|---|---|---|---|---|---|
| `READ` | AST 0.3 | V0.1 | Selects one named current-project form and records history | None | External file/database adapters, passwords/SQL policy, record state, exact project/table syntax |
| `LIST` | AST 0.3 | V0.1 | Renders explicit fields, `*`, or `* EXCEPT` from the active session | None | Legacy display variants, sorting/selection state, output append/export/print behavior, large-list paging |
| `FREQ` | AST 0.3 | V0.1 | Executes one field with optional one `STRATAVAR` against the active session | Final step of bounded DEFINE/RECODE/FREQ | Multiple fields, `* EXCEPT`, weights, more strata, options, output tables, filters, exact legacy selection behavior |
| `MEANS` | AST 0.3 | V0.1 | Executes one numeric field against the active session | None | Cross-tabulation, tests/ANOVA, strata, weights, options, output tables, filters |
| `TABLES` | AST 0.3 | V0.1 | Field validation and current-form handoff only | None | Active-session value classification, source-level exposed/case semantics, unstratified and multi-strata behavior, weights, match variables, options, output parity |
| `DEFINE` | AST 0.3 | V0.1 | No | Bounded Standard text variable | Runtime semantics for all displayed types/scopes/prompts, session persistence, collision rules, initializers |
| `RECODE` | AST 0.3 | V0.1 numeric range grid | No | Bounded numeric ranges to text | Value/date recodes, fill-ranges/reverse options, missing rules, broader target types, selected execution |
| `ASSIGN`, `SELECT`, `IF` | AST 0.3 | Gap | No | No | Semantic resolver, expression/function coverage, transactional session effects, output/history |

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
supports them. The next closure should establish `SELECT`/`CANCEL SELECT` session
state before sorting and wider statistics. LIST output parity, external data
adapters, destructive commands, RUNPGM, and advanced statistics remain separately
reviewed waves.
