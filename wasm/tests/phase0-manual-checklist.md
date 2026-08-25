# Phase 0 manual browser checklist

## Purpose

Use this checklist to confirm that a migration has not broken the recognizable Epi
Info AI demo. Use only synthetic data. Record the tested commit, browser, operating
system, viewport, and result in the review or release notes.

## Test record

| Item | Value |
|---|---|
| Commit | |
| Tester | |
| Date | |
| Browser/version | |
| Operating system | |
| Phone/tablet/desktop viewport | |
| Local or GitLab Pages URL | |

## Main menu and navigation

- [ ] The initial page resembles the familiar blue Epi Info launcher.
- [ ] Create Forms opens Form Designer.
- [ ] Enter Data opens the current form and line list.
- [ ] Create Maps opens the standalone Map workflow.
- [ ] StatCalc opens the 2 x 2 table.
- [ ] Main Menu returns from a module without losing the current local project.
- [ ] Disabled future modules are clearly disabled rather than silently failing.

## Form Designer

- [ ] Project Explorer, field palette, canvas, and field properties are visible on desktop.
- [ ] A field can be dragged from the palette to the canvas.
- [ ] Snap to Grid aligns a moved field; disabling it allows free positioning.
- [ ] Saving rejects a missing field name/prompt and duplicate field names.
- [ ] Saving a valid form updates Enter Data.
- [ ] Create from CSV with `fixtures/phase0/csv-roundtrip.csv` creates seven fields.
- [ ] Selecting “Also import rows” imports three synthetic records without garbling quotes or `José`.

## Enter Data and CSV

- [ ] A required field prevents an incomplete record from being saved.
- [ ] A complete synthetic record saves and appears in the line list.
- [ ] Clear resets the entry controls.
- [ ] Export CSV downloads the current records.
- [ ] Re-importing that export preserves headers and representative quoted/Unicode values.
- [ ] Refreshing the page preserves the browser-local project and records.

## Maps

- [ ] Standalone Create Maps requests a project/form data source.
- [ ] Add Data Layer > Case Cluster accepts latitude and longitude fields.
- [ ] Valid points render and invalid/blank coordinates are skipped.
- [ ] Add Data Layer > GeoJSON Layer accepts a `.geojson` or `.json` file and renders its points, lines, and polygons.
- [ ] An uploaded GeoJSON layer can be hidden, shown, removed, and included by Fit Layers.
- [ ] The fullscreen icon is visible by default, expands the complete map workspace, and exits from the icon or Escape.
- [ ] Invalid JSON, invalid GeoJSON, and files over 10 MB produce feedback without removing existing layers.
- [ ] Enter Data > Maps opens the current-form-linked map and automatically plots records when latitude and longitude fields are available.
- [ ] Current Location requests browser permission only after the user activates it.
- [ ] If online tiles fail, the app reports the basemap failure without losing local points.

## StatCalc 2 x 2

- [ ] The outbreak example displays totals of 100, 100, 50, 150, and 200.
- [ ] Calculate reports risk ratio 4.00, odds ratio 6.00, and risk difference 30.0%.
- [ ] The page identifies the Rust WASM engine and local calculation.
- [ ] Negative, fractional, all-zero, and unsupported-confidence inputs are rejected.
- [ ] A sparse/zero-cell table produces an appropriate warning rather than a crash.

## Project storage and Supabase

- [ ] Test Connection reports feedback directly below the connection buttons.
- [ ] GitHub sign-in is enabled only when the Supabase provider reports it enabled.
- [ ] A completed OAuth return identifies the signed-in account without exposing tokens.
- [ ] Missing `epi_projects` schema produces the setup-SQL instruction.
- [ ] With the schema installed, Upload Current Project creates revision 1.
- [ ] Closing and reopening Project Storage lists the hosted project.
- [ ] Download Hosted Copy requires confirmation before replacing the local working copy.
- [ ] A stale revision produces a conflict message rather than overwriting the hosted copy.
- [ ] A different authenticated user cannot list or download the first user’s project.

## Responsive and accessibility observation

- [ ] At a phone width, primary actions remain reachable and status feedback remains near its trigger.
- [ ] At a tablet width, controls do not overlap or become clipped.
- [ ] At a desktop width, the legacy multi-pane character remains recognizable.
- [ ] All workflows can be navigated with a keyboard and visible focus.
- [ ] Status/error messages are announced or exposed through semantic status/alert regions.
- [ ] Content remains usable at 200% browser zoom.

## Result

- [ ] Pass
- [ ] Pass with documented limitations
- [ ] Fail - block migration/deployment

Notes:

```text

```
