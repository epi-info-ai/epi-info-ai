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
| LEGACY-FORM-005 | Check Code editor with field/view/page/record events | Check Code editor, grammar, and metadata Before/After/Click blocks | Rules dialog authors one typed After statement; imported legacy source is preserved only | Preserve learned full editor path and broader reviewed event/language compatibility. |
| LEGACY-FORM-006 | Unconditional and conditional skip patterns | `GOTO`, `GOTOPAGE`, `GOTOFORM`, `IF/THEN/ELSE`; Enter runtime focus/page navigation | Same-form unconditional/equality `GOTO`, target validation, and cycle rejection | Field slice implemented; page/form targets, ELSE/composition, and full event semantics remain open. |
| LEGACY-FORM-007 | Dynamic field state | `HIDE/UNHIDE`, `ENABLE/DISABLE`, `SET-REQUIRED/SET-NOT-REQUIRED`, group targeting | Allowlisted field-level actions in an After event | Field slice implemented; groups, multiple statements, event reset semantics, and broader compatibility remain open. |
| LEGACY-FORM-008 | Verify Check Code and reject invalid references | parser validation and command-variable checks | Author/restore validation, same-form references, tab-stop target rules, statement limit, and GOTO cycle checks | Expand diagnostics and add compatibility fixtures for the remaining language. |
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
validation-rule union. The first allowlisted subset is field `After` event,
optional equals/not-equals condition on that field, and same-form field target.

## Safety and compatibility requirements

- A target must exist in the same saved schema before the rule can run.
- A navigation action may run at most once for a single field-leave event.
- Self-targets are rejected and cycles are diagnosed before saving the form.
- Hidden, disabled, or non-tab-stop targets require explicit future semantics;
  the initial subset does not silently redirect around them.
- Imported or restored rules are runtime-validated before use.
- Unsupported legacy Check Code remains preserved as an open compatibility gap;
  it is never silently translated to broader JavaScript execution.
- A phone presentation may change panels but not tab order, field identity, event
  timing, or saved rule semantics.

## Automated evidence required for closure

- Contract round trips and malformed/self/missing-target rejection.
- Static tab-stop keyboard behavior.
- Unconditional and conditional same-form `GOTO` after a field value changes.
- Loop protection and deterministic behavior after project restore.
- Required/range/legal/pattern/unique parity for manual and imported records.
- Phone/tablet/desktop Form Designer composition without lost fields or rules.
- Geo-location template contract, explicit result selection, coordinate precision,
  failure-without-mutation behavior, and Case Cluster field handoff.

Phase 4 completes the tested browser-safe vertical slice without declaring any
`LEGACY-FORM-*` gap parity-complete.
