# GIS-K08 slice 1 — layer lifecycle contract

K08 begins with the map-document lifecycle rather than renderer-specific
controls. The typed lifecycle contract preserves layer order and supports
visibility changes, removal, and clear-all operations. Invalid ids, duplicate
layers, invalid indexes, and unknown targets fail closed.

This slice is renderer-independent. The existing Maps adapter remains
responsible for applying these operations to Leaflet and persisting the
resulting ordered `ProjectMapLayer[]` in later K08 integration slices.

## Evidence

- `wasm/app/gis/map-layer-lifecycle.ts` contains the bounded lifecycle contract.
- `wasm/tests/gis-k08-layer-lifecycle-smoke.mjs` covers reorder, visibility,
  removal, clear, invalid targets, and duplicate ids.

## K08 slice 3 — named GIS results

`map-named-result.ts` provides typed names for validated map-document plans.
Names are case-insensitive for lookup, replacements are explicit, failed
results require a diagnostic, and unresolved names fail closed. Registering or
restoring a named result does not execute a map operation.

## K08 slice 4 — annotation contract

The map document can now carry bounded title, subtitle, note, legend, north
arrow, and scale-bar intent. Text lengths and boolean display flags are
validated, and an entirely empty presentation is rejected. Rendering remains a
later adapter concern; these values are document state, not DOM-only state.

## K08 slice 2 — canonical map-document plan

`map-document-plan.ts` adds a renderer-independent document plan with stable
project revision, ordered layer references, visibility, background choice, and
requested output. It is validated and canonically serialized for receipts,
cache keys, and future `.map7`/`.epia` integration. Opening a plan only
describes state; execution remains an explicit user action.

## K08 slice 5 — background and study-area contract

The document model now has a bounded background plan for street, blank, and
offline sources. Offline backgrounds require an explicit stored asset id;
street and blank backgrounds cannot carry one. Optional study-area bounds and
buffer distance are validated as signed WGS 84 degrees and kilometers. No
ambient filesystem or network authority is implied.

## K08 slice 9 — cross-browser release gates

The K08 browser gate now checks the map-document shell, layer panel, basemap
controls, and enabled Choropleth/Dot Density actions. It runs as a dedicated
Playwright spec in Chromium plus Firefox, WebKit, and Mobile WebKit projects.
The gate verifies UI availability and keyboard dismissal; it does not claim
desktop parity or replace the deeper feature-specific tests.

## K08 slice 6 — time-lapse contract

Time-lapse intent now records the source form, temporal field and value kind,
maximum stop count, playback interval, and autoplay preference. Stop and timing
limits are bounded, and autoplay is only a persisted preference; restoring a
project does not start playback automatically.

## K08 slice 7 — PNG export contract

PNG export intent now has bounded dimensions, scale, safe filename, pixel
budget, and explicit inclusion flags for background, legend, and annotations.
The Maps renderer now captures local vector overlays, legends, and annotations
to a bounded canvas and downloads a verified PNG. Cross-origin street tiles are
disclosed and excluded from the local readback.

## K08 slice 8 — package round-trip integrity

The package audit now verifies unique asset and layer ids, SHA-256 and byte
length metadata, missing layer assets, and orphaned stored assets. Missing or
invalid references make the document non-restorable and are reported without
deleting or mutating project data. Maps now probes persisted GeoJSON and
GeoTIFF assets, lists unavailable files with recovery controls, accepts only
matching verified replacements, updates the project snapshot, and re-renders
restored layers. Offline PMTiles recovery remains available through its
dedicated integrity-checked control.
