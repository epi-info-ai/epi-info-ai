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

## Legacy floor and future gap register

| Gap ID | Old IDE capability / learned workflow | Current browser state | Future IDE closure or new branch |
|---|---|---|---|
| LEGACY-PROGRAM-001 | Open Classic Analysis and retain the command tree, Program Editor, and Output relationship | Classic Analysis is a placeholder; Sample PGM source is preserved | Reproduce the familiar three-part workspace responsively before introducing alternate layouts. |
| LEGACY-PROGRAM-002 | New, open, save, save-as, print, project-backed programs, and external `.pgm7` files | Portable project packages preserve named PGM source but have no editor | Add project program CRUD plus explicit `.pgm7` import/export; adapt printing to browser print/export. |
| LEGACY-PROGRAM-003 | Direct text editing, selection, undo/redo, find, find-next, replace, and replace-all | No programming editor | Preserve familiar edit commands and keyboard paths with accessible browser controls. |
| LEGACY-PROGRAM-004 | Command tree and command-specific dialogs generate editable source | Not implemented | Inventory every command/dialog; implement typed generators that produce canonical source without hiding it. |
| LEGACY-PROGRAM-005 | Run the full PGM or selected commands and append results to Output | Source is non-executable | Add parser, execution plan, selected/full run, cancellation, structured output, and deterministic state transitions. |
| LEGACY-PROGRAM-006 | Save and compose reusable programs with `RUNPGM` | Package can carry multiple programs; no composition | Resolve project/package program references safely, reject cycles, cap nesting, and preserve call provenance. |
| LEGACY-PROGRAM-007 | Analysis language for data management, statistics, graphs, reports, variables, conditions, and functions | Only individual prototype features exist outside a PGM interpreter | Build a complete command inventory. Dispatch validated epidemiologic operations to Rust and keep orchestration/output in TypeScript. |
| LEGACY-PROGRAM-008 | Check Code tree, event blocks, generated command dialogs, direct source editing, verification, and Enter execution | Phase 4 exposes one typed field After statement and preserves arbitrary source without executing it | Expand by reviewed event and command subsets while retaining the full editor path and unsupported-source visibility. |
| LEGACY-PROGRAM-009 | Syntax verification and invalid-reference reporting | Contract validation covers only the browser-safe Check Code subset | Add a versioned parser and language service with source ranges, actionable diagnostics, symbol/type/reference checks, and compatibility classification. |
| LEGACY-PROGRAM-010 | Dataset/project context, standard/global/permanent variables, selection/sort state, and output routing | No program session model | Define an explicit, serializable execution session; adapt permanent state to scoped project/user storage with audit and reset controls. |
| LEGACY-PROGRAM-011 | Desktop integration through filesystem paths, `EXECUTE`, DLL objects, external Python/R processes, SQL, and printers | Not executed | Block ambient OS/process access. Replace only with permissioned file pickers, mediated plugins/services, validated Pyodide labs, safe database adapters, and browser print/export. |
| LEGACY-PROGRAM-012 | Basic rich-text presentation | Not implemented | **New branch:** syntax highlighting, bracket/block matching, indentation, folding, command completion, signature help, and hover documentation. |
| LEGACY-PROGRAM-013 | Run-time errors and Output feedback | Not implemented | **New branch:** inline diagnostics, warnings before run, data/schema preview, quick navigation to errors, and explainable compatibility messages. |
| LEGACY-PROGRAM-014 | Program execution produces output | Not implemented | **New branch:** immutable run history recording source hash, project revision, input selection, engine/plugin versions, results, warnings, duration, and cancellation. |
| LEGACY-PROGRAM-015 | Sample programs and training exercises | Official Sample PGM and course references are preserved | **New branch:** first-class program tests using reviewed fixtures, expected outputs/tolerances, native/WASM parity, and regression reports. |
| LEGACY-PROGRAM-016 | No source-level debugger | Not implemented | **New branch:** safe breakpoints, statement stepping, inspected scoped variables, execution limits, and deterministic replay after interpreter semantics stabilize. |
| LEGACY-PROGRAM-017 | Manual file copies/version naming | Portable package carries source | **New branch:** source diff, version history, restore, authorship, and optional repository integration without placing access tokens in programs. |
| LEGACY-PROGRAM-018 | Manual authoring and help | Not implemented | **New branch:** optional AI explanation and drafting through typed commands; generated changes require review, validation, and explicit application and never bypass the interpreter. |
| LEGACY-PROGRAM-019 | Desktop-oriented editor layout | Not implemented | **New branch/adaptation:** mobile read/run/review flow and tablet/desktop authoring layout while retaining terminology, source, command ordering, and keyboard accessibility. |
| LEGACY-PROGRAM-020 | Commands are composed as generated or directly edited sequential text | Not implemented | **New branch:** a typed visual dataflow canvas where users connect data sources, transforms, analyses, and outputs; keep synchronized PGM/source and never imply lossless visual round-trip for unsupported control flow or side effects. |

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
