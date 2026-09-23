# GIS-K05 slice 1 — typed point-layer contract

Status: implemented foundation; visual parity remains a candidate.

This slice establishes the Epi-owned, engine-free contract for Spot Map and
visual Case Cluster point data. It is implemented in
`wasm/app/gis/point-layer.ts` and exported through the GIS kernel index.

## Contract

- Coordinate fields are selected explicitly by the caller.
- Coordinates must be finite signed WGS 84 decimal degrees: latitude `-90`
  through `90`, longitude `-180` through `180`.
- A bounded point preview returns valid record references and transparent
  diagnostics for filtered, missing, invalid, and limit-exceeded rows.
- Filters use a typed allowlist of comparison operators; arbitrary code,
  expressions, SQL, and GDAL arguments are not accepted.
- Display clustering is deterministic, screen-space aggregation for visual
  rendering only. It is not statistical cluster detection.

## Evidence

`wasm/tests/gis-point-layer-smoke.mjs` covers explicit filtering, missing and
out-of-range coordinates, case-insensitive text matching, filter validation,
and deterministic aggregation of nearby points. The package `check` script
executes this smoke test in addition to the existing GIS checks.

## K05 slice 2 — Spot Map workflow

The Maps Add Data Layer menu now exposes Spot Map separately from Case Cluster.
Both workflows keep explicit source, latitude, longitude, and display-label
selection, while Spot Map additionally exposes:

- circle or square marker style;
- marker color;
- an allowlisted field/operator/value filter; and
- visible skipped-row counts after preview.

Point-layer kind, style, color, and filter state are included in project map
layer persistence. Existing Case Cluster snapshots remain readable through
defaults for the new style fields.

## K05 slice 3 — coordinate diagnostics

Point-layer preview diagnostics are now summarized in the Maps layer panel and
retain the source row number for the first 100 displayed details. The summary
separates filtered rows from missing coordinates, invalid WGS 84 coordinates,
and resource-limit exclusions. Source records are never rewritten, corrected,
or silently reclassified. Larger diagnostic sets remain bounded while the
aggregate counts stay visible.

The pure `summarizePointLayerDiagnosticsV01` helper and GIS smoke test provide
stable coverage for these categories.

The remaining K05 work is zoom-driven visual Case Cluster aggregation,
authorized record linkback evidence, and broader teaching-project/browser
coverage.

## K05 slice 4 — visual Case Cluster aggregation

Case Cluster now uses the typed screen-space clustering primitive at the
legacy-inspired 15-pixel display radius. It re-renders when the map zoom
changes, shows aggregate count markers, zooms toward a cluster when selected,
and exposes up to ten authorized member-record actions in the cluster popup.
Spot Map remains an individual-record representation and is not aggregated.

This is display aggregation only; it does not perform inferential spatial
cluster detection or alter the source records.

## K05 slice 5 — authorized record linkback

Point members now carry an explicit `{ sourceFormId, recordIndex }` reference
before Maps invokes the supplied Enter Data callback. Individual markers offer
an accessible “Open source record” action, and Case Cluster popups expose the
same action for up to ten visible members. Linkback fails closed outside the
current-form launch context, when the active source has changed, or when the
host callback rejects the record. No record values are sent to the GIS kernel
or persisted as part of the link reference.

## K05 slice 6 — point-layer persistence and editing

The active point layer now has an explicit Edit point layer action in the Maps
layer panel. Reopening the dialog restores the source form, coordinate and
label fields, layer kind, marker style, marker color, and typed filter. Apply
replaces the active point-layer recipe and persists the updated configuration
through the existing project snapshot/package path. The project contract
accepts both `spot-map` and `case-cluster` kinds and supplies safe defaults for
older snapshots that lack the new style fields.

## K05 slice 7 — teaching fixture and browser evidence

`wasm/demo/examples/gis-k05-point-layers/` now contains a synthetic CSV and
teaching README covering valid points, a nearby Case Cluster pair, a filtered
control, a missing coordinate, and an out-of-range coordinate. The artifact
smoke includes both files. The Chromium GIS browser spec imports the fixture,
opens Maps from Enter Data, configures Spot Map, verifies diagnostics, reopens
the editor, and confirms the saved filter/style state. The focused test passed
against the installed Chrome channel; the Playwright-downloaded headless
Chromium binary is not installed locally, so the full CI browser matrix
remains the cross-browser evidence gate.
