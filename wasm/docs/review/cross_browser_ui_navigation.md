# Cross-browser UI navigation review

Status: initial code and standards review, 2026-09-18; first implementation
candidate, 2026-09-21; focused multi-engine smoke floor passed, 2026-09-24.
This document records testable compatibility risks and implemented gates. The
focused Playwright result is not a claim about every workflow or real Safari
hardware.

## First implementation candidate

The application now has a shared legacy-menu controller that:

- permits only one application/module menu to remain open;
- positions open popups as viewport overlays outside the former overflow clip;
- constrains popup width and height for narrow and enlarged-text layouts;
- supports Enter, Space, Up, Down, Left, Right, Home, End, Escape, and Tab;
- returns focus to the summary on Escape; and
- repositions the active popup after resize or nested scrolling.

`cross-browser-navigation.spec.mjs` covers the application, Form Designer,
Enter Data, Classic Analysis, and Program Editor menu surfaces, a menu-opened
dialog, narrow layout, and enlarged text. Playwright now runs the full suite in
Chromium and this focused suite in Desktop Firefox, Desktop WebKit, and a
Mobile WebKit profile. GitHub installs all three engines; the pinned GitLab
Playwright image supplies them.

GitLab pipeline
[`300787`](https://git.cdc.gov/epi-info-ai/epi-info-ai/-/pipelines/300787),
job `706245`, passed the four navigation tests in Chromium, Desktop Firefox,
Desktop WebKit, and Mobile WebKit at merge commit `88f66540` on 2026-09-24.
The job completed 158 browser tests overall with no navigation-project failure.
A follow-up adds Space activation, Tab dismissal, outside-click dismissal, and
visible Tools-summary focus restoration after the Options dialog closes. That
follow-up passes locally in Playwright Chromium using the recorded Node 24.19.0
runtime and awaits the next multi-engine CI run.

## Compatibility floor

Epi Info AI navigation must work with pointer, keyboard, and assistive
technology in the current stable releases of:

- Chromium/Chrome and Microsoft Edge;
- Firefox;
- Safari on macOS; and
- Mobile Safari for the responsive shell and essential project workflows.

A successful Chromium run is not sufficient evidence for this floor. The main
Playwright configuration therefore defines focused Firefox, Desktop WebKit, and
Mobile WebKit projects in addition to Chromium. WebKit is the CI engine floor
for Safari behavior; it does not replace final acceptance on current Safari and
Mobile Safari hardware. See <https://playwright.dev/docs/test-projects>.

## Initial findings

### P0: dropdowns live inside a scrolling overflow container

The application menubar in `wasm/demo/styles.css` sets `overflow-x: auto`.
Each `.legacy-menu-popup` is an absolutely positioned descendant of that same
menubar. CSS does not allow one axis to remain visibly overflowing while the
other is scrollable: a `visible` axis computes to `auto` when the other axis is
`auto`, `scroll`, or `hidden`. Consequently, a dropdown can be clipped, acquire
an unexpected scroll boundary, or place lower menu items outside the practical
hit-test region. See the CSS overflow rules documented by MDN:
<https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow-x>.

This is the leading explanation for a menu opening while some lower items seem
not to work, especially at narrower widths or with browser zoom. It should be
reproduced at 100%, 125%, 150%, and 200% zoom before changing the implementation.

Recommended correction: separate the horizontally scrollable row from the
overlay layer. Render an open menu in a non-clipping overlay/portal positioned
from its summary button, or use a progressively enhanced Popover implementation
with an explicit fallback. Do not merely raise `z-index`; stacking order cannot
escape an ancestor's overflow clip.

### Resolved smoke-floor gap: no Firefox or WebKit navigation acceptance gate

The original configuration contained one `chromium` project and installed only
Chromium. The first candidate added focused Firefox, Desktop WebKit, and Mobile
WebKit projects while retaining the full analytical suite in Chromium. Pipeline
`300787` passed that focused matrix. Real Safari/macOS, Mobile Safari/device,
Edge, assistive-technology, and wider workflow evidence remain open.

Add a small cross-browser navigation suite before duplicating the complete
long-running scientific suite. It should cover:

1. every top-level File/View/Tools/Help item that is enabled;
2. Form Designer, Enter Data, Classic Analysis, and Program Editor menus;
3. opening and closing every dialog from its menu item;
4. Escape, Tab, Shift+Tab, Enter, and Space behavior;
5. one menu at a time, outside-click dismissal, focus return, and reopening;
6. 100%, 200%, narrow desktop, and Mobile Safari-sized viewports; and
7. navigation after opening a new project and after closing a modal.

Run this smoke suite on Chromium, Firefox, and WebKit for every Pages build.
Keep the full analytical/browser suite on Chromium initially if total CI time
would otherwise delay feedback.

### P1: `<details>` is being used as an application menu

The shell uses `<details><summary>` as the disclosure mechanism and adds custom
`role="menu"`/`role="menuitem"` semantics. Native disclosure behavior is broadly
available, but it does not by itself implement the ARIA menu keyboard pattern.
The current shell closes sibling disclosures through asynchronous `toggle`
events and a document-level click listener. Engine differences in event timing,
focus placement, and disclosure activation therefore need direct tests.

The replacement menu controller should own an explicit open-menu state and
provide roving focus/arrow-key behavior. If `<details>` remains the progressive
fallback, its `open` attribute must be synchronized from that controller rather
than treated as the sole state model.

### P1: modal focus and dismissal need explicit assertions

The application correctly calls `HTMLDialogElement.showModal()` and `close()`
instead of manually toggling `open`. Native modal dialog support is broadly
available, but historical interop work has included initial-focus differences.
Safari added `<dialog>` in 15.4, and WebKit explicitly recommends using the API
so the browser retains correct focus and accessibility state:
<https://webkit.org/blog/12209/introducing-the-dialog-element/>.

For every menu-opened dialog, test initial focus, Escape/cancel, close-button
behavior, focus restoration to the invoking menu item, and immediate reopening.
Give important dialogs an intentional `autofocus` target rather than relying on
engine-specific default focus selection.

### P1: some apparent menu failures are capability failures after navigation

Several actions open correctly but the operation they start has a browser or
permission boundary:

- Clipboard reads and writes require secure contexts and transient activation;
  Firefox and Safari use a different paste-prompt model and do not implement the
  Chromium clipboard permission names. See
  <https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API>.
- Fullscreen is not a Baseline feature across all widely used browsers. See
  <https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen>.
- Offline packages, teaching repositories, DuckDB seed storage, and map assets
  rely on `navigator.storage.getDirectory()` and OPFS. OPFS is origin-private,
  quota-bound, and can be removed when site data is cleared. See
  <https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system>.

Each menu action must distinguish “the menu item did not activate” from “the
action activated but this capability is unavailable or permission was denied.”
Show a visible, browser-specific status message and preserve a safe fallback.

## Test matrix and evidence

For each enabled navigation item, record:

| Evidence | Required result |
| --- | --- |
| Pointer click | Exactly one action; menu closes or intentionally remains open |
| Keyboard Enter/Space | Same action as pointer |
| Arrow/Home/End | Predictable movement within application menus |
| Escape | Closes the current menu/dialog and restores focus |
| Zoom/reflow | Item remains visible, reachable, and inside the viewport |
| Unsupported capability | Explicit message; no silent no-op |
| Console | No uncaught exception or unhandled rejection |

Record the browser name, full version, operating system, input method, zoom,
viewport, action ID, observed result, screenshot/trace, and whether the failure
is navigation, layout/hit-testing, focus, permission, or downstream capability.

## Recommended implementation sequence

1. Add a short `cross-browser-navigation.spec.mjs` and Playwright Firefox/WebKit
   projects without expanding the entire scientific suite.
2. Reproduce and correct the menubar overflow/overlay boundary.
3. Centralize menu open/close/focus behavior in one controller shared by the
   application, Form Designer, Enter Data, Classic Analysis, and Program Editor.
4. Add capability detection and visible fallback messages to menu actions that
   depend on clipboard, fullscreen, OPFS, WebGPU, or other gated APIs.
5. Promote the cross-browser smoke suite to both GitLab and GitHub Pages gates.
6. Expand coverage based on field reports, retaining screenshots and traces as
   compatibility evidence.
