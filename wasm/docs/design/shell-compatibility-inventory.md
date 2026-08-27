# Main Menu and application shell compatibility inventory

## Scope and evidence

This inventory covers the old-tree application launcher and the persistent shell
that leads to Create Forms, Enter Data, Classic Analysis, Visual Dashboard,
Create Maps, and StatCalc. Its evidence sources are:

- the Epi Info 7 User Guide main-menu workflow and terminology;
- `Epi.Windows.Menu/MenuMainForm.cs`, its designer and resources;
- `Epi.Windows.Menu/MainWindow.xaml` and `MainWindow.xaml.cs`; and
- the current browser shell in `demo/index.html`, `demo/styles.css`, and
  `demo/shell.ts`.

The C# and XAML implementations are complementary legacy assets. The browser
does not need to reproduce their desktop toolkit, but it must retain the learned
workflow tree, recognizable identity, command names, and visible status feedback.

## Compatibility floor

| Gap ID | Familiar capability | Legacy evidence | Browser state | Disposition and closure gate |
|---|---|---|---|---|
| LEGACY-SHELL-001 | Main launcher branches and Analyze Data grouping | User Guide; `MenuMainForm`; `MainWindow` | Familiar launcher present | Preserve. Automated checks must protect names, grouping, and working destinations. |
| LEGACY-SHELL-002 | File, View, Tools, StatCalc, and Help menu paths | `MenuMainForm` menu definitions and resources | Initial menu paths present; some commands disabled | Parity in progress. Inventory every legacy command and either implement it or retain a named gap. |
| LEGACY-SHELL-003 | Epi Info identity and module terminology | User Guide; menu resources | Epi Info AI titlebar and legacy module names present | Preserve while adding the AI suffix as an approved product extension. |
| LEGACY-SHELL-004 | Ready/status feedback | User Guide screenshots; Windows status bars | Main-menu live status and local/online indicator present | Adapt. Keep feedback visible and announce changes to assistive technology. |
| LEGACY-SHELL-005 | Desktop launcher composition and module navigation | User Guide; `MenuMainForm`; `MainWindow` | Two-column desktop launcher and left module rail present | Preserve on wide screens; test desktop landmarks and destinations. |
| LEGACY-SHELL-006 | Narrow-screen field use | No equivalent legacy browser layout | Mobile-first reflow present | Adaptation, not a replacement branch. Keep the same labels and task order, 44px targets, visible focus, and no page-level horizontal overflow. |
| LEGACY-SHELL-007 | Help and external-resource destinations | Help menu and website commands | Visible but unavailable in the prototype | Defer with explicit disabled states until destinations and offline policy are reviewed. |

## Phase 3A responsive contract

The narrow layout is now the base CSS. At phone width, the familiar launcher is
a single column, status and Help remain visible, the classic visual ornament is
omitted, and the module rail becomes a horizontally reachable strip. Tablet and
desktop enhancements use `min-width` queries; desktop restores the technical
visual, two-column launcher, and left module tree.

This is a presentation adaptation of the same old tree. It does not introduce,
deprecate, retire, rename, or reorder a workflow branch. Any later change that
does so must update the master registry change log in the same change.

## Automated evidence

`tests/browser/application-shell.spec.mjs` checks the legacy menus and navigation,
phone/tablet/desktop launcher visibility, local status, 44 by 44 CSS pixel launch
targets, visible keyboard focus, live status text, and absence of page-level
horizontal overflow.

## Remaining audit work

- Enumerate every command and launch option in both legacy Windows menu variants.
- Reconcile resource/localization strings and keyboard access keys.
- Define reviewed browser replacements for Exit, User Guide, logs, Options, and
  external website/help destinations.
- Add experienced-user review evidence before any shell gap is marked complete.

