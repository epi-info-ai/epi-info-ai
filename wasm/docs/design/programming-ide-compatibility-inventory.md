# Epi Info programming IDE compatibility inventory and roadmap

## Purpose

The difference between the legacy Epi Info programming environments and the
future browser IDE is the implementation roadmap. The old editor is the
compatibility floor: familiar paths and behaviors are preserved or deliberately
adapted. Modern IDE capabilities are added as named new branches, not used as a
reason to replace the learned Epi Info workflow with an unrelated code editor.

This inventory covers both programming environments:

- **Classic Analysis Program Editor**, which authors and runs Analysis PGM source;
- **Form Designer Check Code Editor**, which authors event-driven form, page,
  record, and field behavior executed by Enter Data.

The reviewed Classic Analysis interface is a lightweight script IDE, not a
Python-IDLE-style interactive REPL. Its Program Editor contains a multiline
`RichTextBox`, a separate output pane, and a **Run Commands** action; Command
Explorer dialogs generate editable source, and `.PGM` programs can be saved or
launched from the application command line. Epi Info AI preserves that model.
An immediate prompt/console may be explored later only as a labelled new branch.

Primary legacy evidence includes:

- `Epi.Windows.Analysis/Forms/ProgramEditor*`, `PGM.cs`, `FileBasedPGM.cs`, and
  `ProjectBasedPGM.cs`;
- `Epi.Core.Interpreter/grammar/EpiInfo.Analysis.Grammar.grm` and its `Rules/`;
- `Epi.Windows.MakeView/Forms/CheckCodeEditor/` and command dialogs;
- `Epi.Core.EnterInterpreter/grammar/EpiInfo.Enter.Grammar.grm` and its rules; and
- the official User Guide, training corpus, and preserved Sample `Statistics.pgm`.

Representative taught sequences and their promotion states are maintained in the
[programming curriculum corpus](programming-curriculum-corpus.md), rather than
being inferred repeatedly from prose during implementation.

## Legacy parser architecture

The legacy language is not parsed with ASN.1 (Abstract Syntax Notation One). Its
Analysis and Enter grammars are authored as GOLD Parser `.grm` files, compiled
into embedded `.cgt` grammar tables, and loaded through Calitha GOLD Parser
Engine's LALR parser. On acceptance, the interpreter converts nonterminal tokens
into typed `AnalysisRule`/Enter rule objects and executes that rule structure.
The source tree also contains `cAST`/heterogeneous AST classes, but the reviewed
Analysis execution path is more accurately described as **LALR parse tree to
interpreter rule objects**, not a portable, serialized AST contract. This is a
valuable migration asset, but the browser should define its own versioned typed
AST/IR rather than porting the desktop parser's UI, process, and reflection
assumptions wholesale.

Browser AST 1.0 now establishes that contract in
`app/programming/classic-ast.ts`. It uses discriminated statement and expression
nodes, an explicit `1.0.0` version, and source spans. The parser recognizes
`READ`, `RELATE`, `WRITE`, `MERGE`, `DELETE TABLES`, `DELETE RECORDS`, `UNDELETE RECORDS`, `FREQ`, `LIST`, `MEANS`, `TABLES`, `SUMMARIZE`, `RECODE`, `DEFINE`, `DEFINE GROUPVAR`, `UNDEFINE`, `DISPLAY`, `ASSIGN`, `IF`, `SELECT`, and `SORT`, including
nested conditional blocks and the expression operators needed by those commands.
Parsing remains separate from authority: the bounded full-program
`DEFINE -> RECODE -> FREQ` plan and single selected FREQ/MEANS paths are distinct
allowlists. The
semantic resolver, canonical AST printer, capability-labelled planner, program
session, and differential parity corpus are tracked as separate acceptance gates
in the migration plan.

## Program Editor functionality parity set

`browser-verified` means the behavior has an automated browser test; it does not
claim desktop-output parity. No editor row is `legacy-parity-verified` until an
experienced Epi Info user reviews the same workflow against the desktop editor.

| ID | Familiar editor behavior | Browser state | Status |
|---|---|---|---|
| EDITOR-001 | Program Editor remains docked with Command Explorer, Output, and Message Area | Familiar four-area relationship is present; Command Explorer can collapse and resize, and the Program Editor title/menu/toolbar remain sticky while its source body scrolls | `browser-verified` candidate |
| EDITOR-002 | New, Open Pgm, Save Pgm, Save Pgm As, project programs, and metadata | The familiar Open Pgm dialog is the single selection surface for project-backed programs and bounded `.pgm`/`.pgm7` text import; it also contains a distinctly labeled new-branch dataset-example section. Save and Save As preserve metadata and `.pgm7` export | `browser-verified` candidate |
| EDITOR-003 | Print and Page Setup | Source-only browser print is active; page setup remains in the browser print dialog | `adapted`, review required |
| EDITOR-004 | Direct editing, selection, Undo, Redo, Select All, Program Beginning/End | Implemented through CodeMirror and familiar menu commands | `browser-verified` candidate |
| EDITOR-005 | Cut, Copy, and Paste menu commands | CodeMirror keyboard commands and the familiar explicit menu commands work. Menu actions use the permission-aware browser Clipboard API; Cut removes source only after a successful write, Paste preserves content and line structure without command-insertion formatting, and blocked organizational/browser policy produces an explicit keyboard-shortcut fallback without changing source | `browser-verified` adapted candidate |
| EDITOR-006 | Find, Find Next, Replace, and Replace All | Familiar dialogs operate on visible CodeMirror source | `browser-verified` candidate |
| EDITOR-007 | Fonts > Set Editor Font | Font family and 8–32 px size are selectable, previewed, applied only to the editor, and persisted in browser preferences | `browser-verified` candidate |
| EDITOR-008 | Run Commands and Cancel | Reviewed selected commands and sequential programs run through one exclusive lifecycle. Cancel is disabled while idle, enabled during execution, and cooperatively stops between statements; completed output/session effects remain and both command/program cancellation are audited | `browser-verified` adapted candidate; in-statement cancellation remains operation-dependent |
| EDITOR-009 | Visible source, diagnostics, line numbers, tabs, completion, and cursor position | CodeMirror new-branch assistance is active without expanding execution authority | `new branch`, browser tested |
| EDITOR-010 | Program Output navigation, saved-output Open, Bookmark, Print, Maximize/Restore, Clear, and history | Browser-verified toolbar behavior preserves the familiar order. Open accepts bounded HTML/XML/common images, sandboxes HTML without script/network authority, bookmarks the current document for the session, prints only the current output, and hides/restores the other tool windows when maximized. TIFF rendering and immutable cross-instance provenance remain open | `browser-verified` adapted candidate; provenance remains partial |

## Legacy floor and future gap register

| Gap ID | Old IDE capability / learned workflow | Current browser state | Future IDE closure or new branch |
|---|---|---|---|
| LEGACY-PROGRAM-001 | Open Classic Analysis and retain the command tree, Program Editor, and Output relationship | The four-area shell, nested Program Editor menu/toolbar, and Output toolbar are visible; Previous/Next/Last/History navigate browser output, and Clear Output blanks result documents while retaining history as the legacy handler does; panes are responsive sections rather than dockable desktop windows | Preserve and test the relationship on desktop/mobile; evaluate optional resizing only after workflow parity. |
| LEGACY-PROGRAM-002 | New, open, save, save-as, print, project-backed programs, and external `.pgm7` files | Program Editor has guarded New/Open/Save/Save As/Delete, the legacy Author/Comments/Created/Updated metadata, project-backed source, bounded 1 MB `.pgm7` text import/export, and source-only browser printing. Program selection and the new-branch compatible-example picker are consolidated in Open Pgm; the editor surface no longer duplicates the saved-program list. A separate Page Setup API and remote extras sync remain open | Extend sync/package conflict policy without weakening source preservation; evaluate experienced-user print fidelity and browser-specific print settings. |
| LEGACY-PROGRAM-003 | Direct text editing, selection, undo/redo, cut/copy/paste, find, find-next, replace, and replace-all | CodeMirror supplies direct editing plus explicit familiar Undo, Redo, Cut, Copy, Paste, Select All, Program Beginning/End, Find, Find Next, Replace, and Replace All operations. Clipboard menu actions use browser permissions and retain keyboard shortcuts as the policy-safe fallback | Compare desktop wording and expand search options only where legacy/user testing requires them. |
| LEGACY-PROGRAM-004 | Command tree and command-specific dialogs generate editable source | Read, Define, numeric Recode, List, Frequencies, Means, and Tables now open typed, context-aware builders that insert ordinary visible source; DEFINE/RECODE/FREQ can author the bounded foodborne program without hiding code | Inventory and implement the remaining dialogs through the same source-generating boundary; never confuse displayed source forms with reviewed execution authority. |
| LEGACY-PROGRAM-005 | Run the full PGM or selected commands and append results to Output | Reviewed selected commands and the general sequential runner share exclusive Run/Cancel state. Cancellation yields between statements, retains completed work, skips later statements, restores Run controls, and records `cancelled` history; TABLES still requires explicit value-classification review | Extend cooperative cancellation into each long-running Worker/file adapter, then expand command semantics, structured output, and transactional boundaries command by command. |
| LEGACY-PROGRAM-006 | Save and compose reusable programs with `RUNPGM` | Package can carry multiple programs; no composition | Resolve project/package program references safely, reject cycles, cap nesting, and preserve call provenance. |
| LEGACY-PROGRAM-007 | Analysis language for data management, statistics, graphs, reports, variables, conditions, and functions | Typed AST/parser V0.2 recognizes nine initial command families; only the bounded three-statement plan and separately resolved single FREQ/MEANS statements execute | Build the complete command inventory, semantic resolver, planner, and session. Dispatch validated epidemiologic operations to Rust and keep orchestration/output in TypeScript. |
| LEGACY-PROGRAM-008 | Check Code tree, event blocks, generated command dialogs, direct source editing, verification, and Enter execution | Phase 4 exposes one typed field After statement and preserves arbitrary source without executing it | Expand by reviewed event and command subsets while retaining the full editor path and unsupported-source visibility. |
| LEGACY-PROGRAM-009 | Syntax verification and invalid-reference reporting | Live checking parses the nine-command AST after a short typing pause, marks the affected line, and applies current-form checks only through separately allowlisted execution resolvers; broader parsing does not authorize execution | Expand to a versioned language service with recoverable multi-diagnostics, precise token ranges, semantic checks for every parsed node, quick fixes, and full compatibility classification. |
| LEGACY-PROGRAM-010 | Dataset/project context, standard/global/permanent variables, selection/sort state, and output routing | No program session model | Define an explicit, serializable execution session; adapt permanent state to scoped project/user storage with audit and reset controls. |
| LEGACY-PROGRAM-011 | Desktop integration through filesystem paths, `EXECUTE`, DLL objects, external Python/R processes, SQL, and printers | Not executed | Block ambient OS/process access. Replace only with permissioned file pickers, mediated plugins/services, validated Pyodide labs, safe database adapters, and browser print/export. |
| LEGACY-PROGRAM-012 | Basic rich-text presentation; `Fonts > Set Editor Font` opens the desktop font dialog, and the legacy `RichTextBox` accepts tabs and carries leading spaces/tabs to the next line, but the audited source exposes no line-number gutter, column ruler, or configured tab width; command dialogs provide the principal variable/option guidance | CodeMirror preserves the familiar font command with a browser-safe font-family/size dialog and persisted editor-only settings. It also supplies syntax highlighting, line numbers, `Ln/Col` status, persistent 2/4/8-column tab width and tabs/spaces preferences, plus schema-aware completion for V0.1 `RECODE`, `TO`, `FREQ`, and `STRATAVAR` | **New branch:** retain familiar command dialogs while expanding bracket/block matching, folding, command completion, signature help, and hover documentation. |
| LEGACY-PROGRAM-013 | Run-time errors and Output feedback | Not implemented | **New branch:** inline diagnostics, warnings before run, data/schema preview, quick navigation to errors, and explainable compatibility messages. |
| LEGACY-PROGRAM-014 | Program execution produces output | Browser-local V0.1 history records Program Editor verify/run/reject attempts; unified origins and immutable output references remain open | **New branch:** immutable run history recording source hash, project revision, input selection, engine/plugin versions, results, warnings, duration, and cancellation. |
| LEGACY-PROGRAM-015 | Sample programs and training exercises | Official Sample PGM and course references are preserved; the foodborne dataset now owns a versioned catalog of three selectable examples that execute through the bounded AST plan | **New branch:** expand to first-class portable-project program attachments and tests using reviewed fixtures, expected outputs/tolerances, native/WASM parity, and regression reports. |
| LEGACY-PROGRAM-016 | No source-level debugger | Not implemented | **New branch:** safe breakpoints, statement stepping, inspected scoped variables, execution limits, and deterministic replay after interpreter semantics stabilize. |
| LEGACY-PROGRAM-017 | Manual file copies/version naming | Portable package carries source | **New branch:** source diff, version history, restore, authorship, and optional repository integration without placing access tokens in programs. |
| LEGACY-PROGRAM-018 | Manual authoring and help | Not implemented | **New branch:** optional AI explanation and drafting through typed commands; generated changes require review, validation, and explicit application and never bypass the interpreter. |
| LEGACY-PROGRAM-019 | Desktop-oriented editor layout | Not implemented | **New branch/adaptation:** mobile read/run/review flow and tablet/desktop authoring layout while retaining terminology, source, command ordering, and keyboard accessibility. |
| LEGACY-PROGRAM-020 | Commands are composed as generated or directly edited sequential text | Not implemented | **New branch:** a typed visual dataflow canvas where users connect data sources, transforms, analyses, and outputs; keep synchronized PGM/source and never imply lossless visual round-trip for unsupported control flow or side effects. |

## Editor-driven PGM acceptance contract

Command parity is evaluated through the user-visible Program Editor, not only by
calling parser or engine functions directly. Every command promoted to
`browser-verified` must have a checked-in `.pgm` program and expected-output
fixture over a pinned example corpus, and its browser test must exercise this
learned workflow:

1. Load the example project and data in the browser.
2. Open the checked-in `.pgm` through **Open Pgm** into the CodeMirror editor.
3. Confirm that the complete editable source is visible and diagnostics run.
4. Verify or run the program through the familiar Program Editor command.
5. Compare Output and session effects with the machine-readable expectation.
6. Confirm that command/program history records the reviewed source and result.

The familiar **Run Commands** button is selection-aware, matching the legacy
`ProgramEditor.btnRun_Click`: highlighted source runs as one selected command or
block; with no selection, the parsed PGM runs sequentially. The foodborne command
tour verifies twelve statements, shared SELECT/SORT/output-table state, stop-on-
first-error behavior, per-command history, and a final program-level history row.
That functional run is necessary but not sufficient for parity. The tour cannot
be promoted from acceptance target to completed demo until `LIST`, `FREQ`,
`MEANS`, `SELECT`/`CANCEL SELECT`, `SORT`/`CANCEL SORT`, `SUMMARIZE`, and `GRAPH`
all reach `legacy-parity-verified` independently.

The foodborne investigation remains the canonical baseline corpus. Additional
domain repositories, including measles surveillance, may add Microsoft Access
conversion, vaccine-preventable-disease workflows, and longer surveillance
programs, but do not replace the foodborne regression floor. Parser, semantic,
engine, and conversion unit tests remain required supporting evidence; none is a
substitute for the editor-driven browser run.

Saving is part of the same acceptance path. A checked-in program must be saved to
the current browser project through **Save Pgm**, reopened without source changes,
and exported through **Save Pgm As** as the official Epi Info 7 `.pgm7` text
format. The browser test for `foodborne-age-groups-by-sex.pgm` also compares the
downloaded bytes with the source opened in the editor.

## DEFINE, RECODE, and FREQ full-parity set

The foodborne PGM is the first end-to-end acceptance program, but it does not
reduce the meaning of command parity. `DEFINE`, `RECODE`, and `FREQ` remain open
until every legacy branch below has typed-AST, semantic, execution, output,
failure, save/reopen, and desktop-differential evidence. Only then may their
registry status become `legacy-parity-verified`.

| Command | Legacy parity floor extracted from the Epi Info 7 grammar/rules | Current state | Required closure fixtures |
|---|---|---|---|
| `DEFINE` | `STANDARD`, `GLOBAL`, and `PERMANENT`; `NUMERIC`, `TEXTINPUT`, `YN`, `DATEFORMAT`, `DATETIMEFORMAT`, and `TIMEFORMAT`; optional quoted prompt with or without parentheses; `DEFINE name = expression`; duplicate/reserved/group-name handling and scope lifetimes | AST recognizes the syntax; execution is bounded to a Standard session scalar, while the foodborne full-program path creates one Standard `TEXTINPUT` derived field | One fixture per scope/type, prompt form, expression result/type, duplicate/error case, lifetime transition, and a saved/reopened multi-command PGM |
| `RECODE` | Exact values, inclusive legacy ranges, negative values, `LOVALUE`, `HIVALUE`, Boolean/string/number/date/identifier operands and results, `ELSE`, ordered first-match behavior, missing/type coercion, source/target compatibility, and replacement of an existing recode definition | AST preserves exact/range/`ELSE` clauses; execution is bounded to non-overlapping numeric ranges producing quoted text | Cross-product fixtures by source/target type; boundary, overlap/order, missing, identifier-result, duplicate/replace, malformed-block, and desktop-differential cases |
| `FREQ` | One or many variables, `*`, `* EXCEPT`; `STRATAVAR` lists; `WEIGHTVAR`; `OUTTABLE`; `STATISTICS=NONE|FISHER`; `NOWRAP`; `ONEISYES`; `COLUMNSIZE`; `PSUVAR`; missing/category ordering, prompts, totals, percentages/confidence limits, output/session effects, and errors | AST recognizes these forms; execution is bounded to one field and at most one stratum without weights or output-table/options | Selection/group expansion, multiple-field/multiple-strata, weighted, PSU, missing/category, every option, output-table/readback, zero-row/invalid-weight/error, and desktop-output fixtures |

The implementation order is `DEFINE` runtime/lifetimes, generalized `RECODE`,
then complete `FREQ` selection/options/output. The canonical foodborne PGM must
continue to pass after every expansion; no new branch may regress this floor.

## Visual Epi Info dataflow branch

The future **Visual Epi Info** IDE may offer a drag-and-drop canvas similar to a
flow-based programming tool. This is an additional view of the Epi Info
program—not a replacement for the familiar command tree or Program Editor.

### Source-visible contract

- The traditional Program Editor is always available from Visual Epi Info.
- Every visual node exposes the corresponding generated or preserved source.
- Users can switch between **Flow**, **Program**, and **Output** without leaving
  the programming workspace or losing selection and execution context.
- Visual edits regenerate source through the typed intermediate representation;
  source edits are reparsed before the Flow view changes.
- Generated changes are previewable as a source diff before they replace saved
  program text.
- Formatting and comments are preserved wherever the syntax permits a lossless
  round trip.
- Source that cannot be represented visually remains editable and visible in the
  traditional editor, with the Flow view clearly marked partial or source-only.
- A visual flow cannot be saved or executed unless its complete effective program
  can be inspected in the traditional editor.

Initial node families should follow the learned workflow:

- **Inputs:** current project/form, local file, approved hosted source, and a
  previous node's dataset;
- **Preparation:** `READ`, select/filter, sort, define, assign, recode, relate,
  merge, and summarize;
- **Analysis:** frequencies, means, tables/strata, rates, regression, survival,
  complex samples, and validated plugin operations;
- **Presentation:** line list, table, graph, map layer, report, dialog, and routed
  output; and
- **Outputs:** browser download, project table, dashboard result, map, or a
  permissioned hosted destination.

Ports and edges must be typed—for example Dataset, Field, Scalar, Table, Model,
Chart, and Map Layer—so invalid connections are rejected before execution. The
graph compiles to the same versioned intermediate representation used by typed PGM
source, and every executable analysis node calls a validated Rust/WASM operation.

PGM is historically sequential and can contain conditions, mutable variables,
`RUNPGM`, dialogs, output routing, and unsafe desktop side effects. A simple
directed acyclic data graph cannot represent all of that faithfully. The visual
model therefore also needs explicit control-flow nodes, bounded program-call nodes,
and a preserved source node for unsupported constructs. Source-to-graph conversion
must report whether it is lossless, partially visualized, or source-only; it must
never silently discard or reorder commands.

Visual Epi Info provides synchronized **Flow**, **Program**, and **Output** views.
Edits in either Flow or Program pass through the parser and typed intermediate
representation before updating the other view. Execution history records the graph
version, generated/source program hash, inputs, engines, outputs, and warnings.

## Ordered IDE roadmap

### IDE-0: inventory and executable specification

- Extract the complete Classic Analysis and Check Code command, function, event,
  dialog, and variable-scope inventories from grammar, rules, UI resources, manual,
  Sample assets, and training exercises.
- Classify official training examples in the curriculum registry and preserve
  their full command sequence, instructional goal, browser safety policy, and
  expected typed plan before implementing isolated commands.
- Classify each capability as preserve, adapt, blocked, deferred, or new branch.
- Create parser fixtures for valid, malformed, ambiguous, and unsupported source.

### IDE-1: familiar editor shell and durable source

- Implement `LEGACY-PROGRAM-001` through `003`: familiar workspace, editor,
  project program list, `.pgm7` exchange, and core edit commands.
- Source can be opened and saved before it can be executed; unsupported source is
  never lost or silently rewritten.

### IDE-2: parser, language service, and command generation

- Implement `LEGACY-PROGRAM-004` and `009`, then the first portions of `012` and
  `013`.
- Parse into a versioned typed intermediate representation with source locations.
- Command dialogs and direct typing must produce the same representation.

### IDE-3: safe program execution vertical slice

- Implement `LEGACY-PROGRAM-005`, `006`, and `010` for
  `READ -> LIST/FREQ/TABLES` and bounded `RUNPGM`.
- Dispatch statistics through versioned Rust/WASM operations; keep orchestration
  and rendering in TypeScript workers.
- Record an immutable execution history from the first runnable release.

### IDE-4: data management and Check Code expansion

- Add the synthetic NIOSH-derived `DEFINE -> RECODE -> FREQ -> WRITE` fixture.
- Expand Check Code from the Phase 4 allowlist using the CDC course fixture.
- Implement explicit browser adaptations for file, export, and user-dialog commands.

### IDE-5: statistical command coverage

- Progress through the official Sample `Statistics.pgm` in reviewed sections:
  descriptive operations, tables/strata, regression, survival, complex samples,
  graphs, and routed output.
- A command is supported only when its operation passes the algorithm validation
  standard and its program-level state/output behavior has browser tests.

### IDE-6: modern development assistance and visual flow

- Complete `LEGACY-PROGRAM-012` through `019`: richer language assistance,
  program tests, debugger/replay, source history, optional AI assistance, and
  responsive authoring/review.
- Implement `LEGACY-PROGRAM-020` incrementally for the already validated command
  subset, beginning with `READ -> filter/recode -> FREQ/TABLES -> graph/write`.
  Test graph/source/typed-IR round trips and explicit partial-conversion warnings.
- New branches remain optional enhancements around the familiar editor and never
  become prerequisites for opening, understanding, or running a compatible PGM.

## Closure rules

- Legacy gaps close only after source round-trip, observable behavior, failure
  behavior, and experienced-user review pass.
- New branches require security, accessibility, privacy, provenance, and offline
  behavior tests in addition to functional tests.
- Unsupported commands remain visible with precise diagnostics and preserved
  source; unsupported is never treated as successfully executed.
- Visual Epi Info never hides the effective source program or makes the traditional
  Program Editor unavailable.
- No PGM or Check Code is translated to arbitrary JavaScript or granted ambient
  DOM, network, credential, filesystem, database, or process access.
- The repository's legacy capability register and release notes identify each
  closed, open, deprecated, or newly introduced branch.

No `LEGACY-PROGRAM-*` gap is parity-complete yet.

The first executable evidence is defined by the
[Classic Program V0.1 contract](../validation/classic-program-v0.1-contract.md).
