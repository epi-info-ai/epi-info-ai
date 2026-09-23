# Form Designer compatibility inventory

## Scope and evidence

This inventory covers the learned **Create Forms > Form Designer** workflow for
projects, forms/pages, field placement, field attributes, tab order, Check Code,
templates, and entry validation. The compatibility floor is derived from the Epi
Info 7 User Guide and these legacy code areas:

- `Epi.Windows.MakeView/Forms/MakeViewMainForm*`, `Forms/Canvas.cs`, and
  `PresentationLogic/GuiMediator.cs`;
- `Epi.Windows.MakeView/Dialogs/FieldDefinitionDialogs/`;
- `Epi.Windows.MakeView/Forms/CheckCodeEditor/` and
  `Dialogs/CheckCodeCommandDialogs/`;
- `Epi.Core.EnterInterpreter/grammar/EpiInfo.Enter.Grammar.grm` and its `Rules/`;
- `Epi.Windows.Enter/Forms/Canvas.cs` and
  `PresentationLogic/GuiMediator.IEnterCheckCode.cs`; and
- field/check-code metadata in `Epi.Core/Data/Services/Metadata*Provider.cs`.

The browser prototype is evidence of current implementation only. It does not
narrow this floor.

## Capability and gap register

| Gap ID | Familiar capability | Legacy implementation evidence | Current browser state | Disposition and closure gate |
|---|---|---|---|---|
| LEGACY-FORM-001 | Project Explorer with projects, forms/pages, fields, and templates | MakeView tree/canvas and template code | Project/form/field tree; pages and reusable templates absent | Preserve hierarchy and terminology; add pages/templates before parity. |
| LEGACY-FORM-002 | Drag fields onto a dotted canvas and position them | MakeView canvas and mediator | Drag/drop canvas with optional snapping | Parity in progress; add selection, resizing, keyboard movement, ordering, and reviewed mobile adaptation. |
| LEGACY-FORM-003 | Field definitions and type-specific attributes | `FieldDefinitionDialogs/` | Name, prompt, type, required, range, pattern, legal/comment-legal, unique, tab-stop, and calculated age | Preserve remaining read-only, repeat-last, groups, type-specific attributes, and legacy edge cases. |
| LEGACY-FORM-004 | Tab order, Set First Tab, and Enable/Disable Tab | `HasTabStop`, `TabIndex`, and MakeView tab-order context menu | Schema order and per-field tab-stop | Preserve explicit ordering commands and reviewed keyboard behavior; disabling a tab does not hide or delete the field. |
| LEGACY-FORM-005 | Check Code editor with field/view/page/record events | Check Code editor, grammar, and metadata Before/After/Click blocks | Dedicated CodeMirror source editor with `.chk` open/save, syntax highlighting, line numbers, Ln/Col, persistent font and tab settings, Undo/Redo buttons and keyboard history, find/replace, typed line diagnostics, typed AST, and bounded Form → Page → Record → Field Before/After/Click runtime | Editor usability and event structure are restored for the disclosed subset; expand source-level legacy grammar and complete experienced-user review before parity. |
| LEGACY-FORM-006 | Unconditional and conditional skip patterns | Retained grammar `GOTO field`, `GOTO page-number`, `GOTO +1`, and `GOTO -1`; desktop runtime also contains `GOTOPAGE`/`GOTOFORM`; `IF/THEN/ELSE` composes navigation | Same-form field `GOTO`, page navigation, and adapted project-bounded `GOTOFORM` execute only after whole-source verification. Cross-form navigation validates and retains the current draft, runs exit/entry events in order, resets destination page/focus state, and stops probable cycles | Browser candidate complete for same-form, page, and current-project form navigation. Desktop `GOTOFORM` was oriented to related-view fields; exact relationship-key behavior, save semantics, timing, and experienced-user differential review remain open. |
| LEGACY-FORM-007 | Dynamic field state and visual emphasis | `HIDE/UNHIDE`, `ENABLE/DISABLE`, `HIGHLIGHT/UNHIGHLIGHT`, `SET-REQUIRED/SET-NOT-REQUIRED`, group targeting | Allowlisted field actions execute in bounded event blocks, including wildcard expansion; highlight uses the legacy yellow visual convention with browser-visible contrast | Field actions candidate complete for individual fields and wildcard targets; groups, `EXCEPT`, and exact legacy reset/timing semantics require recovery and review. |
| LEGACY-FORM-008 | Verify Check Code and reject invalid references | parser validation and command-variable checks | Whole-program verification validates fields/variables, duplicate scopes/names, statement limits, and GOTO cycles; any gap disables Apply | Add broader legacy grammar fixtures and line/column editor diagnostics; never partially execute rejected source. |
| LEGACY-FORM-009 | Preview/test through Enter Data | MakeView-to-Enter workflow | Form Designer opens Enter Data | Preserve schema order and validation behavior across both modules. |
| LEGACY-FORM-010 | Create/import forms from existing data | legacy project/data adapters | CSV, TSV, JSON records, and `.xlsx` adapters | New browser branch under the familiar form-creation workflow; legacy project/data adapters remain open. |
| LEGACY-FORM-011 | Phone form-design workflow | No equivalent desktop-era layout | Wide canvas currently overflows narrow screens | New responsive adaptation: retain the old tree and canvas on wide screens; use focused explorer/canvas/properties views on phones. |
| LEGACY-FORM-012 | Geo-location template with Address, Get Coordinates, Latitude, and Longitude | User Guide Geo-location template; `GEOCODE` Check Code command and dialog | Four-field template, Command Button type, typed `GEOCODE` Click statement, coordinate validation, and Enter Data handoff are implemented | Bounded parity candidate. Add reusable template persistence, full Check Code editor representation, approved production provider configuration, and experienced-user review before closure. |

## Skip-pattern implementation floor

The legacy code has no standalone `SkipPattern` entity. It represents skipping in
two ways:

1. Static navigation uses `TabIndex` and `HasTabStop`. Form Designer persists the
   choice and Enter bypasses fields without a tab stop.
2. Dynamic navigation is stored as textual Check Code in event blocks. The parser
   creates `Rule_GoTo`; the Enter interface then saves current field state and
   focuses a field or changes page/form. `IF/THEN/ELSE` composes conditional
   behavior rather than creating a separate skip-rule type.

For the browser, tab-stop metadata therefore belongs to field presentation and
navigation. Safe `GOTO` belongs to a versioned Check Code contract, not the field
validation-rule union. The current allowlisted subset covers Form, one or more
named Page blocks, Record, and Field `Before`/`After` plus Field `Click`; typed
definitions, equality and inequality `IF/ELSE`, `ASSIGN`, `CLEAR`, same-form
`GOTO`, type-aware compound `IF` expressions (`AND`/`OR`/`NOT`, parentheses,
relational comparisons, and missing `(.)`), field-state actions including
`HIGHLIGHT`/`UNHIGHLIGHT`, titled message
`DIALOG`, typed text/numeric/Yes-No/date/time/date-time responses, fixed-choice
responses, `ELSE-IF`, `LET`, `ALWAYS`, bounded `SUB`/`CALL`, `UNDEFINE`, `BEEP`,
field actions using `* EXCEPT`, and governed `GEOCODE` are supported. Typed
arithmetic (`+`, `-`, `*`, `/`, `%`/`MOD`, `^`), text concatenation (`&`), and
the allowlisted `ABS`, `ROUND`, `STRLEN`, `SUBSTRING`, `UPPERCASE`, `TXTTONUM`,
`YEAR`, `MONTH`, and `DAY` functions use typed expression nodes; unknown
functions fail closed. `GLOBAL` has an adapted browser-tab lifetime and
`PERMANENT` uses local browser-profile storage. Restored values are type-checked,
can be removed by `UNDEFINE`, and are not implicitly added to portable project
archives. Exact desktop cross-project lifetime and clearing semantics remain a
differential evidence gate. Static
subroutine-cycle checks and an eight-call-depth runtime limit prevent recursive
runaway. `SAVE-RECORD`, `NEWRECORD`, and `QUIT`/`EXIT` are enabled only directly
inside a Command Button `Click` event; each terminates the originating event and
routes through the same validation, record-session, and draft-preservation
workflow as the visible UI. Dialog targets are checked
against field or defined-variable types before Apply. Browser-adapted
`DBVARIABLES` lists the active schema, while `DBVALUES table field` lists at
most 250 distinct non-missing values from a registered project form. Neither
accepts SQL or discovers files. `DBVIEWS` lists registered project forms and
`DATABASES` lists the active project store; both are disclosed browser
adaptations because their retained desktop runtime paths were stubs. Native
file dialogs remain an explicit browser-adaptation gap. Numeric and relative page
`GOTO` plus `GOTOPAGE` execute only against the validated page model. The
browser-adapted `GOTOFORM` resolves a unique form ID or name only from the open
project, validates and retains the current unsaved draft without silently adding
a record, executes origin Record/Page/Form After events, renders the destination
at its first page, and then executes destination Form/Page/Record Before events.
It terminates the originating event and shares the 32-navigation session budget;
self, absent, ambiguous, and exit-event targets fail closed. Legacy `//` and `/* ... */`
comments are removed before parsing while their newline positions are retained,
so runtime source and diagnostic line numbers remain auditable.

## Safety and compatibility requirements

- A target must exist in the same saved schema before the rule can run.
- Navigation is limited to 16 effects per event and 32 effects per record session.
- Self-targets and multi-field cycles are diagnosed before saving the form.
- Hidden, disabled, or non-tab-stop targets require explicit future semantics;
  the initial subset does not silently redirect around them.
- Imported or restored rules are runtime-validated before use.
- Unsupported legacy Check Code remains preserved as an open compatibility gap;
  it is never silently translated to broader JavaScript execution.
- A phone presentation may change panels but not tab order, field identity, event
  timing, or saved rule semantics.

## Deliberately excluded desktop authority

These retained grammar forms are compatibility evidence, but they are not
eligible for direct browser execution. Imported source containing one remains
visible and editable, while whole-source verification disables Apply before any
statement runs.

| Legacy surface | Desktop authority | Browser disposition |
|---|---|---|
| `EXECUTE`, including wait/no-wait file and URL variants | Launches an operating-system process, file association, or external URL | **Excluded.** No arbitrary process, shell, executable, or generated-code bridge will be added. A future named, allowlisted integration must use a separate reviewed capability contract and cannot inherit `EXECUTE` authority. |
| `DEFINE ... DLLOBJECT/NETOBJECT` and DLL assignment/calls | Loads native or managed code and invokes host functions | **Excluded.** WebAssembly modules and extensions must enter through the signed, versioned package/plugin governance path; Check Code cannot load a DLL, assembly, arbitrary WASM binary, or JavaScript module. |
| `COMMANDLINE` and retained external `RUNPGM` launch shapes | Reads process arguments or launches a program/database path | **Excluded as ambient authority.** Project-packaged programs may be selected by the user through the validated Program Editor, but Check Code cannot inspect the browser/OS launch command or bypass review. |
| `GETPATH`, `WAITFOR`, `WAITFOREXIT`, and `WAITFORFILEEXISTS` | Discovers or monitors desktop filesystem/process state | **Excluded.** Check Code has no ambient path, directory-watch, process-wait, or polling authority. |
| File-oriented `HELP file topic` | Opens desktop help/file targets | **Excluded in its legacy form.** Help content may be routed only to packaged, checksummed documentation or an explicit safe web route. |

The following are not approved yet, but are tracked separately as potential
browser adaptations rather than permanent exclusions: `DIALOG ... READ/WRITE`
and `FILEDIALOG` may eventually use an explicit user file picker; they must not
receive a path string or ambient filesystem access. `IOCODE` requires its own
recovered semantics, validation, privacy, and lifecycle tests before enablement.
`AUTOSEARCH` now has a bounded preview-only browser adaptation: it exact-matches
active-form records and displays reviewed fields, but cannot silently replace
the current draft or assume desktop record-edit identity. `IOCODE` now has a
typed seven-Text-field migration boundary but remains non-executable pending the
[browser-adapter gates](iocode-browser-adapter.md). The lifecycle commands now have the narrower Command Button
candidate described above; broader event placement and exact desktop behavior
remain closed.

## Automated evidence required for closure

- Contract round trips and malformed/self/missing-target rejection.
- Static tab-stop keyboard behavior.
- Unconditional and conditional same-form `GOTO` after a field value changes.
- Legacy `GOTOPAGE` plus absolute and relative page `GOTO` against a validated page model;
  active-page-only Before/After events; and cross-page field focus.
- Current-project `GOTOFORM` success, missing/self/ambiguous target rejection,
  draft validation/retention, deterministic exit/entry ordering, and cycle limits.
- Loop protection and deterministic behavior after project restore.
- Required/range/legal/pattern/unique parity for manual and imported records.
- Phone/tablet/desktop Form Designer composition without lost fields or rules.
- Geo-location template contract, explicit result selection, coordinate precision,
  failure-without-mutation behavior, and Case Cluster field handoff.

Phase 4 now includes a tested browser-safe event runtime, a durable audit trail,
and bounded page, current-project form, structured-control, subroutine, and
command-button lifecycle candidates. Remaining safe adapters, exact desktop
event timing, and experienced-user review remain open;
no parity-complete claim is made.
