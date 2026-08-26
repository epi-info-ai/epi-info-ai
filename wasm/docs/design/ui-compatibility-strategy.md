# UI compatibility strategy

## Decision

Epi Info Next will present a familiar face to experienced Epi Info users. It will preserve recognizable terminology, module boundaries, workspace layouts, and common task sequences while implementing them with modern, accessible browser components.

The target is **interaction continuity**, not a pixel-for-pixel copy of the Windows application.

## What should remain familiar

### Product structure

Retain recognizable entry points for:

- Create Forms;
- Enter Data;
- Visual Dashboard;
- Classic Analysis;
- Maps;
- StatCalc;
- project open, save, import, and export.

The initial home screen should resemble the existing Epi Info launchpad closely enough that an experienced user can immediately identify where to begin.

### Terminology

Use established Epi Info names when they remain accurate. Avoid renaming familiar concepts merely to make the product sound newer. When a term must change, show the legacy name in migration help and search aliases.

### Workspace patterns

Preserve the major spatial relationships users already know:

- project/form navigation on the left;
- the primary form, dashboard, map, or editor canvas in the center;
- properties, field configuration, and contextual tools on the right;
- commands, status, results, or messages in a lower panel where appropriate;
- menu and toolbar actions in predictable locations.

Panels may become resizable, collapsible, and responsive, but their default arrangement should remain recognizable.

### Core task sequences

Where practical, preserve the order and language of familiar operations:

1. open or create a project;
2. select or design a form;
3. enter and validate records;
4. select variables for analysis;
5. run a deterministic calculation;
6. inspect, save, or export results.

Legacy keyboard shortcuts should be retained when they do not conflict with browser or accessibility conventions.

### Menu contract

The Epi Info 7 User Guide is authoritative for default menu names, grouping, and workflow placement. The browser shell currently follows this main-menu structure:

- **File** contains **Exit**; project commands are not added to this application-level menu;
- **View** contains **Status Bar** and **Epi Info Logs**;
- **Tools** launches **Create Forms**, **Enter Data**, **Classic**, **Visual Dashboard**, **Create Maps**, and **Options**;
- **StatCalc** remains a top-level command;
- **Help** retains the User Guide, videos, discussion forum, and help-desk paths.

Within Form Designer, **File** owns **New Project** and **Recent Projects**, matching the legacy workflow. **Project Storage** is an additive browser-era branch in that same project-oriented menu and opens the local/Supabase synchronization panel. Browser-specific actions must not replace a familiar command whose behavior is materially different. Commands that are planned but unavailable should remain recognizable and disabled rather than being moved or renamed.

Think of this as extending the old menu tree: preserve its trunk, familiar branches, names, and ordering, then attach new browser, cloud, mobile, plug-in, and AI branches at the closest familiar point. New branches should be visually separated where useful and must not silently redefine an old command.

## What should be modernized

- Native HTML controls and accessible component primitives replace WinForms/WPF widgets.
- Layouts adapt to laptops and tablets without changing the desktop mental model.
- Dialogs become focused panels or modern modal dialogs with clear validation.
- Long-running calculations and imports show progress and can be cancelled.
- Errors identify the affected field, command, file, or calculation and suggest recovery.
- Undo/redo is available for form and dashboard design.
- Autosave protects browser-local work, while explicit Save/Export remains visible.
- Empty states teach the next action without requiring the user guide.
- Searchable command palettes supplement menus but do not replace them.
- Contextual help links directly to the corresponding legacy-manual concept and new documentation.

## What should not be copied

- Windows-only chrome, installation concepts, and filesystem assumptions;
- inaccessible color, focus, keyboard, or screen-reader behavior;
- fixed-size dialogs and layouts that fail on smaller screens;
- hidden state, silent failures, or destructive actions without confirmation;
- HTML-formatted strings emitted by the statistical engine;
- unsafe Check Code capabilities;
- obsolete modules whose function is better supplied by a compatible browser-native workflow.

## Compatibility views

The default experience should use a familiar desktop-style shell. Modern accelerators can be layered on top:

- a searchable command palette;
- recent projects and pinned workflows;
- guided analysis and form-building assistance;
- optional AI suggestions;
- compact and touch-friendly density settings.

These additions must not move or obscure the familiar paths used by returning users.

## Component architecture

Build a reusable component layer rather than styling each screen independently:

- application shell, module launcher, menu bar, and toolbar;
- project tree and explorer;
- resizable/collapsible panel layout;
- property grid and field editor;
- form canvas and field toolbox;
- data-entry controls and validation summary;
- variable picker and analysis configuration panels;
- results table, statistical callout, chart, and export controls;
- program/check-code editor and diagnostics;
- map workspace and layer controls;
- status, progress, notification, and confirmation patterns.

Use design tokens for spacing, typography, density, color, elevation, borders, and focus states. A "classic" token theme can preserve Epi Info's visual identity without coupling application behavior to a particular component library.

## Manual-driven inventory

The official [`Epi Info 7 User Guide`](../reference/Epi-Info-7-User-Guide.pdf) is the initial source for screen and workflow inventory. For each module, capture:

| Field | Purpose |
|---|---|
| Legacy screen/task | Name used by existing users |
| User goal | Outcome the screen supports |
| Familiar elements | Labels, ordering, layout, shortcuts, and interaction patterns to retain |
| Pain points | Behavior that should be improved rather than copied |
| Browser equivalent | Proposed modern component/workflow |
| Compatibility level | Exact, functionally equivalent, import-only, or unsupported |
| Validation scenario | Task an experienced user can perform to confirm familiarity |

Screenshots from the manual should be used as design references, not copied as application assets unless their reuse status has been confirmed.

## Validation standard

UI compatibility is successful when experienced users can complete representative tasks with minimal retraining, not when screenshots are visually identical.

Test at least these journeys with current or former Epi Info users:

1. create a questionnaire with validation and skip logic;
2. enter, find, and edit a case record;
3. produce a frequency table and 2×2 analysis;
4. build and refresh a Visual Dashboard;
5. run or import a Classic Analysis program;
6. create an epidemic curve and point map;
7. save, export, reopen, and recover an offline project.

Track task completion, errors, time, points of hesitation, terminology mismatches, and user confidence. Familiarity findings should drive the default layout; optional modern shortcuts can remain additive.

## First UI milestone

Build a non-functional but navigable shell containing:

1. the familiar module launcher;
2. a project explorer;
3. Form Designer, Enter, Visual Dashboard, Classic Analysis, Maps, and StatCalc workspace frames;
4. shared menus, toolbars, status, and help patterns;
5. desktop, narrow-laptop, and tablet layouts.

Review that shell with experienced Epi Info users before implementing deep module behavior. This will validate the product's visual and navigational continuity early, while changes are inexpensive.
