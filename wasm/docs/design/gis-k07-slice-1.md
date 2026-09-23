# GIS-K07 slice 1 — typed Dot Density contract

K07 begins with a renderer-independent Dot Density recipe. It makes the
visualization policy explicit: boundary and data bindings, value-per-dot,
rounding, deterministic seed, placement method, polygon-interior clipping,
style, legend, and resource limits.

The contract does not generate dots or inspect polygon geometry. It rejects
non-positive value-per-dot settings, unsupported policies, invalid colors,
unsafe seeds, and limits that could exceed the total dot budget. Dot Density
remains a visualization and must not be described as inferential spatial
cluster detection.

## Evidence

- `wasm/app/gis/dot-density.ts` contains the typed recipe and fail-closed
  validation.
- `wasm/tests/gis-dot-density-smoke.mjs` covers valid recipes, seed bounds,
  value-per-dot, clipping, and resource limits.
- `wasm/app/gis/dot-density-values.ts` normalizes numeric values, applies the
  declared rounding policy, and reports missing, invalid, negative, and
  resource-limit diagnostics before placement.
- Deterministic generation, polygon clipping, legends, UI controls,
  persistence, and cross-browser evidence are deferred to later K07 slices.

## K07 slice 2 — value normalization and diagnostics

The value preview now converts finite numeric values and numeric strings into
bounded dot counts using the recipe's value-per-dot and rounding policy. Empty,
non-numeric, negative, per-feature-limit, and total-limit cases are retained as
structured diagnostics and are not silently rendered. The preview reports
total represented value, total dots, valid rows, and skipped rows for later
placement and legend work.

## K07 slice 3 — deterministic candidate placement

The placement contract now produces reproducible candidate points within each
feature bounding box using either seeded jitter or a deterministic grid. The
seed is mixed with the feature index, dot order is stable, and repeated runs
with the same recipe produce identical candidates. These are explicitly
pre-clipping candidates; they are not yet claimed to lie inside polygon
interiors.

## K07 slice 4 â€” polygon-interior clipping

Candidate points can now be clipped against validated GeoJSON Polygon and
MultiPolygon boundaries. Outer rings use inclusive point-in-ring semantics;
holes exclude candidates, and candidates outside the polygon are removed while
their feature and dot indices remain stable. Unsupported, malformed, or
missing geometries produce structured diagnostics and fail closed. This slice
does not claim support for arbitrary geometry types or replace a full GeoJSON
ingestion validator.

## K07 slice 5 — legend and render summary

The renderer-independent output now includes a deterministic legend model with
the configured title, value-per-dot label, dot style, input totals, rendered
and clipped dot counts, and no-data/diagnostic counts. This keeps the displayed
legend and audit summary tied to the validated recipe and bounded preview; map
UI rendering and persistence remain later integration work.

## K07 slice 6 — boundary/data key binding

Dot Density now has a deterministic join contract for boundary properties and
data rows. Exact and trim-casefold normalization are supported; missing,
unmatched, and duplicate keys remain structured diagnostics. Duplicate data
matches are retained as ambiguous rather than silently selecting a row, so the
value-normalization stage can fail closed for that feature.

## K07 slice 7 — composed bounded pipeline

The join, value normalization, deterministic placement, polygon clipping, and
legend stages are now composed by one renderer-independent pipeline. Duplicate
data keys become an ambiguous value and therefore do not produce dots; all
resource limits and geometry diagnostics remain visible in the returned stages.
The pipeline is ready for a Maps UI adapter, but it does not yet persist or
render a Dot Density layer.
## K07 slice 8 — point presentation adapter

Clipped candidates can now be emitted as a bounded GeoJSON FeatureCollection of
Point features. Each point retains feature and dot indices for provenance and
carries the validated color, radius, and opacity policy. The presentation
adapter also returns the K07 legend model and rejects non-finite coordinates;
it remains independent of a specific map renderer.

## K07 remaining vertical slice — Maps integration and release evidence

The Maps shell now exposes Dot Density beside the existing layer types. Users
can select a stored GeoJSON boundary, form, key fields, value field, value per
dot, placement method, color, opacity, and legend title. The application runs
the bounded K07 pipeline, renders the clipped points and legend, reports join
and value diagnostics, and persists/restores the layer through the validated
project snapshot contract. A synthetic teaching fixture and installed-Chrome
browser test cover the real import, render, diagnostic, and restore workflow.
