# Menu structure and function compatibility registry

## Purpose

Menus are part of the Epi Info compatibility floor. Experienced users have
learned not only command names, but where commands live, when they become
available, and what state changes follow them. A browser control does not meet
parity merely because it has the same label.

This registry spans the application shell and every module workspace. The Epi
Info 7 User Guide supplies the learned workflow; the checked-out legacy C#/XAML,
resources, and tests supply the detailed behavior. Module capability inventories
remain authoritative for the underlying feature.

## Menu-item contract

Every legacy menu item must eventually record and test:

1. its full path, label, order, grouping/separators, and access key;
2. the application/module context in which it is visible;
3. its enabled, disabled, checked, and selected states and their preconditions;
4. its invocation behavior, including dialogs, defaults, cancellation, and
   keyboard shortcuts;
5. project, form, record, program, map, or view state changed by the command;
6. autosave, synchronization, recovery, and failure behavior;
7. visible and accessible feedback after success, cancellation, or failure;
8. its browser implementation and automated evidence; and
9. its disposition: preserve, adapt, defer, new branch, deprecate, or retire.

Moving, renaming, hiding, or materially changing an old command requires a
reviewed registry entry. A new browser, cloud, plug-in, mobile, or AI command
must be marked as a **new branch** and attached to the nearest familiar parent.
It must not displace an unfinished old branch.

## Cross-module gaps

| Gap ID | Compatibility requirement | Current state | Closure gate |
|---|---|---|---|
| LEGACY-MENU-001 | Complete menu tree for the shell and every module | Form Designer, Enter Data, Visual Dashboard, and Classic Analysis are encoded in typed contracts; Maps and StatCalc remain partial | Reconcile the User Guide, localized resources, C#/XAML definitions, and context menus into reviewed ordered trees for the remaining modules. |
| LEGACY-MENU-002 | Context-sensitive command state | Form Designer and Enter Data encode project/record requirements; selection/dirty/running state remains incomplete | Test visible/enabled/checked state for active form/page/record, dirty state, selection, and running operations across every module. |
| LEGACY-MENU-003 | Project lifecycle through familiar File commands | Guarded New/Open/Close/Recent transitions, browser autosave, durable recent snapshots, failure-without-close, and a true no-project state are implemented | Parity candidate. Reconcile exact legacy Access/SQL project variants, remote synchronization policy, recent-list management, cancellation details, and experienced-user review. |
| LEGACY-MENU-004 | Keyboard access keys and shortcuts | Form Designer `Ctrl+O`, Enter Data `Ctrl+S`, Escape closure, focusable disclosed gaps, and nested submenu semantics are implemented; broader shortcuts/access keys remain partial | Reconcile remaining legacy access keys/shortcuts, browser conflicts, focus return, and screen-reader announcements. |
| LEGACY-MENU-005 | Menu, toolbar, and context-menu equivalence | Form Designer and Enter Data share implemented operations across surfaces; Visual Dashboard restores its toolbar/right-click tree; Classic Analysis restores its shell and Command Explorer with FREQ, MEANS, and TABLES routes | Commands sharing an old action must invoke the same application operation and state transition from every surface. |
| LEGACY-MENU-006 | Reviewed browser equivalents for desktop-only commands | Form Designer Exit safely closes and returns to Main Menu; logs, options, help, printing, legacy repositories, and publishing remain visible named gaps | Define explicit equivalents or retain visible named gaps; do not silently remove commands. |
| LEGACY-MENU-007 | Governed new branches | Project Storage, Enter Data browser-file import, and Data Quality are contract-classified and visually marked new branches; Epi Assist remains labeled under application Tools | Record the parent path, capability boundary, permissions, and non-displacement test for every addition. |
| LEGACY-MENU-008 | Menu structure and behavior regression suite | Typed Form Designer, Enter Data, Visual Dashboard, and Classic Analysis checks cover order, gaps, nested paths, command selection, and implemented actions; Maps and StatCalc remain incomplete | Extend contract-driven browser tests to every module and block regressions in CI. |

## Form Designer typed contract

`app/forms/form-designer-menu.ts` is the machine-readable source for the browser
Form Designer menu. It preserves the C# resource order for **File, Edit, View,
Insert, Format, Tools, and Help**, including Page, Alignment, Upgrade Project,
Make PRJ File, and Recent Projects submenus. The User Guide pages 2-3 and 2-4
confirm the no-active-project presentation and File > Recent Projects workflow.

Commands are classified as:

- `implemented`: invokes an existing shared browser operation;
- `legacy-gap`: stays visible, focusable, and explicitly reports that the old
  command is not implemented; or
- `new-branch`: visibly extends the closest familiar parent without replacing an
  old command.

This contract establishes structure and state evidence; it does not claim
functional parity for commands still classified `legacy-gap`.

## Enter Data typed contract

`app/forms/enter-data-menu.ts` preserves the legacy C# order for **File, Edit,
View, Tools, and Help** and the five-child File > Import Data branch. The User
Guide pages 4-47 through 4-67 confirm the learned Open Form, Recent Forms, New
Record, Save, Find, delete/undelete, Status Bar, Check Code, and import paths.

Existing browser operations are shared by menu and toolbar surfaces for New
Record, Edit Form, Save (`Ctrl+S`), Status Bar, Exit, browser data-file import,
and Data Quality. Commands whose desktop semantics are not yet ported remain
visible `legacy-gap` entries. Import Browser Data File and Data Quality are
visibly classified `new-branch`; neither replaces the legacy import subtree or
other old commands. This is a structural parity candidate, not a claim that
record navigation, search, deletion, printing, legacy transport, or Check Code
switching is complete.

## Visual Dashboard command-surface contract

`app/dashboard/dashboard-menu.ts` models the interface that Visual Dashboard
actually taught: the blue **Refresh, Set Data Source, Open, Save, Save As**
toolbar and the canvas right-click command tree. It does not invent a
File/Edit/View menu bar for a module that did not use one. The canvas tree
preserves the visible `EpiDashboard/DashboardControl.xaml` order, including
output, analysis gadget, chart, advanced-statistics, StatCalc, report, data
dictionary, properties, auto-arrange, refresh, and reset branches.

The browser exposes the same tree through right-click and a touch/keyboard
`Canvas commands` disclosure. **Add Analysis Gadget > Rates** and **Add Analysis
Gadget > Charts > Epi Curve chart** select the existing browser gadgets. Other
commands remain visible `legacy-gap` entries with immediate feedback. The
toolbar reports the current project/form and record count, as described in User
Guide pages 8-1 through 8-8. Saved canvases, movable/resizable gadget state,
filters, defined variables, exports, and the remaining gadgets remain open.

## Classic Analysis command-surface contract

`app/analysis/classic-analysis-menu.ts` preserves the shipped **File, View,
Tools, Help** shell and the nine-folder **Analysis Commands** tree: Data,
Variables, Select/If, Statistics, Advanced Statistics, Output, User-Defined
Commands, User Interaction, and Options. Labels and ordering come from
`AnalysisMainForm` and `CommandExplorer` resources rather than from a generic
web navigation pattern.

The browser restores the learned four-area frame described in User Guide pages
9-1 through 9-4: Command Explorer, Program Editor, Output, and Message Area.
Statistics > Frequencies, Tables, and Means select the existing audited command
panels and move keyboard focus into their first enabled control. Unported items
remain visible, focusable `legacy-gap` entries with immediate Message Area
feedback. View > Status Bar is functional. The nested Program Editor now preserves
the shipped File/Edit/Fonts menus and New/Open/Save/Print/Run/Cancel toolbar order.
New/Open/Save/Save As, Undo, Redo, Find/Find Next/Replace, Select All, Program
Beginning/End, Command Explorer handoff, and Run Commands use reviewed browser
operations. Project programs and `.pgm7` files share one guarded document state;
the project dialog also preserves Author, Comments, Created, Updated, and
confirmed Delete. File and toolbar Print share a source-only browser print path,
while Page Setup remains a visible platform limitation whose settings are
available within the browser print dialog.
Command Explorer Frequencies, Means, and Tables now open typed variable dialogs
that insert visible source. Run Selected Command accepts exactly one supported
statement: FREQ and MEANS execute through existing typed operations, while TABLES
stops at explicit exposed/case value review because those classifications are not
present in its source text.
The Output toolbar preserves
Previous/Next/Last/History/Open/Bookmark/Print/Maximize/Clear Output order; its
navigation and History paths are active. Clipboard commands, Output printing,
bookmarks, clearing, Supabase program synchronization,
command-specific dialogs, and complete command execution remain visible named gaps.

## Immediate Form Designer File-menu matrix

This lifecycle matrix complements the now-complete structural Form Designer menu
inventory. Functional gaps remain visible in the typed contract.

| Familiar command | Legacy behavior to preserve | Browser state | Required action |
|---|---|---|---|
| File > New Project | Closes the current project through the common close path before creating another | Uses the guarded close/autosave transition; failed persistence keeps the old project active | Candidate implemented; review exact cancellation/default behavior. |
| File > Open Project | Closes the current project before opening the selected project | Form Designer Open Project and the application package picker use the guarded transition after package validation | Candidate implemented; distinguish legacy project opening from portable-package import in final terminology. |
| File > Close Project | Saves/synchronizes pending project/form state, clears the active workspace, and returns to a no-project state; it does not delete the project | Saves the browser working copy and recent snapshot, then displays a no-project workspace; storage failure leaves the project open | Candidate implemented; define authenticated remote-upload policy without making safe local close network-dependent. |
| File > Recent Projects | Lists recent projects and closes the current project before switching | Bounded durable browser list reopens validated snapshots through the guarded transition | Candidate implemented; add remove/pin/missing-store behavior and review legacy ordering. |
| Save/Save As and browser package export | Legacy persistence and browser file download are not necessarily the same operation | `Save Project As...` currently exports a portable package | Preserve familiar save semantics and label materially different package export as an adaptation/new branch rather than silently redefining Save. |
| Project Storage | No equivalent legacy command | Local/Supabase storage panel exists in Form Designer | Keep visibly identified as a new branch under the project-oriented menu; it does not replace Open, Close, or Save. |

## Evidence and review

Menu parity closes only when both structure and function pass review:

- a machine-readable menu manifest or equivalent typed contract covers each
  module and responsive presentation;
- browser tests verify menu path, order, command state, invocation, state
  transition, and feedback rather than labels alone;
- representative keyboard-only and assistive-technology journeys pass;
- an experienced Epi Info user confirms the learned path remains recognizable;
  and
- all adaptations, additions, deprecations, and retirements are reflected in the
  master legacy capability register and release notes.

The current automated candidate covers active-to-closed state, persistence over
reload, recent-project reopen, project-only control state, and simulated browser
storage failure that must leave the active project untouched.
