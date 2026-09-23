# Accessibility testing plan

Status: proposed baseline for the Epi Info AI `0.2` release line

Epi Info AI must remain usable by public-health practitioners using keyboards,
screen readers, magnification, high-contrast settings, speech input, or limited
pointer precision. Accessibility is a release property of complete workflows,
not a one-time scan or a claim inferred from semantic HTML.

## Standards and scope

The initial conformance target is WCAG 2.2 Level AA and the applicable US
Section 508 requirements. Testing covers the application shell, Form Designer,
Enter Data, Visual Dashboard, Classic Analysis and its editors, Maps, StatCalc,
Epi Assist, project/package dialogs, runbooks, teaching repositories, validation
lab entry points, and error/recovery paths.

Conformance claims require a separate reviewed Accessibility Conformance Report.
Until that evidence exists, releases should say that accessibility is tested
against the target—not that the product is fully conformant.

## Layered test strategy

### 1. Static and component checks

- Validate accessible names, roles, states, label/control relationships,
  landmark structure, heading order, table headers, live regions, and dialog
  ownership.
- Run an automated WCAG rules engine such as `@axe-core/playwright` against
  stable states of every primary module and modal.
- Treat serious and critical automated violations as merge blockers. Record
  reviewed false positives with the exact rule, component, rationale, owner,
  and expiry date rather than disabling a rule globally.
- Lint new UI code for mouse-only handlers, positive `tabindex`, missing button
  types, inaccessible icon-only controls, and unannounced status changes.

Automated scans are a floor. They do not validate task completion, reading
order, understandable error recovery, chart meaning, or map alternatives.

### 2. Keyboard workflow tests

Playwright tests should complete representative workflows using only keyboard
input:

- open and close every main menu and return focus with Escape;
- create a form, add/edit/delete a field, and author Check Code;
- enter, validate, save, import, and package a record;
- open a program, edit source, run selected/all commands, navigate Output, and
  cancel a running operation;
- operate dialogs, disclosure widgets, tabular controls, runbooks, and Epi
  Assist without a pointer;
- reach map-layer controls and obtain the non-map data alternative;
- recover from validation, permission, integrity, and offline failures.

Each test must assert visible focus, logical focus order, absence of keyboard
traps, focus restoration, and meaningful status feedback—not merely that a key
press was accepted.

### 3. Screen-reader evaluation

Manual release-candidate testing uses at least:

| Platform | Browser | Assistive technology | Purpose |
|---|---|---|---|
| Windows | Edge or Chrome | JAWS | Primary CDC enterprise workflow |
| Windows | Firefox | NVDA | Independent Windows/browser engine coverage |
| macOS | Safari | VoiceOver | WebKit and Apple accessibility coverage |
| iOS | Safari | VoiceOver | Touch exploration and narrow viewport |

TalkBack/Chrome on Android is a follow-up target. Playwright WebKit is useful
regression evidence but is not a substitute for real Safari plus VoiceOver.

Testers record the exact application commit, browser/AT versions, task script,
result, defects, and any workaround. Experienced Epi Info users with assistive
technology should participate before a broad release.

### 4. Visual and cognitive checks

- Test browser zoom at 200% and text-only enlargement where supported.
- Test reflow at 320 CSS pixels without loss of controls, content, or two-axis
  scrolling except where a data table or map genuinely requires it.
- Verify Windows forced-colors/high-contrast mode and prefers-contrast/reduced-
  motion behavior.
- Measure text, control, focus-indicator, chart, and map-symbol contrast. Never
  use color alone for validation, category, cluster, or selection state.
- Keep instructions consistent, error messages specific, and destructive or
  mutating actions previewable and recoverable.
- Verify pointer targets and alternatives for drag, draw, resize, hover, and
  fine-coordinate placement actions.

## Specialized Epi Info surfaces

### Program and Check Code editors

CodeMirror must expose an accessible textarea/editing model, line and diagnostic
context, keyboard commands, and a non-color-only error list. Font, tab, cursor,
and high-contrast preferences must not suppress focus or caret visibility.
Every toolbar action must have an equivalent keyboard-operable control.

### Data tables, charts, and statistical output

Tables require programmatic captions and row/column headers. Charts require a
concise text summary plus access to the underlying aggregate table. Confidence
intervals, exclusions, missingness, warnings, method identity, and validation
status must remain available without interpreting position or color.

### Maps and geospatial workflows

Maps require a keyboard-operable layer list, textual feature/cluster inventory,
current extent and selection summary, and a tabular alternative for plotted
records or aggregates. Hover tooltips must also be available through focus and
selection. Bounding-box drawing and point movement require numeric/manual
alternatives. Story-map motion must be pausable and respect reduced motion.

### Long-running Workers and offline operations

Progress updates should use a restrained live region and must not repeatedly
interrupt screen-reader speech. Completion, cancellation, failure, elapsed
time, and recovery actions must be announced and remain visible. Offline and
permission failures must identify what remains safely stored.

## CI and release gates

### Per merge request

- Existing keyboard/focus Playwright regression suite.
- Automated accessibility scans for the shell and every UI state changed by the
  merge request.
- Chromium is the fast gate; Firefox and WebKit run for shared navigation,
  dialog, editor, and responsive behavior.
- Screenshots and accessibility-tree excerpts are retained for failures without
  capturing sensitive record values.

### Scheduled and release-candidate testing

- Weekly full-module automated scan against synthetic example projects.
- Manual keyboard, zoom/reflow, forced-colors, and screen-reader task matrix for
  each minor release candidate.
- Real Safari/VoiceOver and Windows JAWS evidence before an external conformance
  statement.

A release is blocked by an inaccessible critical workflow, keyboard trap,
missing accessible name on an operative control, loss of focus, serious/critical
automated violation without an approved exception, or lack of an equivalent
for information conveyed only by a map or chart.

## Evidence record

Create `wasm/docs/validation/accessibility/` when execution begins. Each test
record should contain:

- application version and exact Git commit;
- environment and assistive-technology versions;
- tested project/data classification (synthetic by default);
- task steps and expected outcome;
- automated rule-set version and results;
- manual findings with severity, owner, disposition, and retest evidence;
- remaining limitations and the next review date.

Accessibility evidence must be reproducible and must not contain PHI, precise
operational locations, credentials, or private learner information.

## Initial implementation slices

1. Add `@axe-core/playwright`, a shared scan helper, and shell/menu/dialog scans.
2. Add keyboard-only tests for Form Designer, Enter Data, Program Editor, Check
   Code Editor, Output, and package workflows.
3. Add chart data-table and map textual-alternative contracts.
4. Establish the Windows JAWS/NVDA and macOS/iOS VoiceOver manual scripts.
5. Produce the first release-candidate evidence bundle and prioritized defect
   backlog; only then decide whether an Accessibility Conformance Report is
   supportable.
