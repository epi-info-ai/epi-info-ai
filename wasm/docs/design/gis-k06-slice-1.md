# GIS-K06 slice 1 — typed choropleth contract

K06 begins with a renderer-independent recipe for a legacy-style Choropleth.
The recipe names the boundary asset and layer, the data form and value/key
fields, the join normalization policy, classification method, colors,
opacity, NoData treatment, legend, and an optional bounded filter.

This slice validates intent only. It does not read boundary files, join rows
to polygons, calculate classes, or render a map. Those responsibilities remain
later K06 slices so that data quality and presentation behavior can be tested
independently.

Supported classification methods are `manual`, `equal-interval`, and
`quantile`. Manual breaks must be finite and strictly increasing. Automatic
methods do not accept caller-supplied breaks. Class counts are bounded to 2–12,
and the palette must contain exactly one six-digit hexadecimal color per class.

The contract preserves the historical manual-color path. Palette enhancements
remain an adapted/new branch until legacy evidence establishes their behavior.

## Evidence

- `wasm/app/gis/choropleth.ts` contains the typed recipe and fail-closed
  validation.
- `wasm/tests/gis-choropleth-smoke.mjs` covers valid recipes, manual-break
  ordering, palette length, opacity, and filter requirements.
- `wasm/app/gis/choropleth-join.ts` performs the deterministic key join used
  by the next slice, including exact or trim/case-fold normalization and
  fail-closed handling for duplicate boundary keys.
- Polygon geometry joining, unmatched diagnostics, classification calculations,
  legends, UI controls, persistence, and cross-browser evidence are deferred
  to subsequent K06 slices.

## K06 slice 2 — deterministic boundary/data key join

The key-join contract now normalizes supported string, number, and boolean key
values according to the recipe policy. It preserves every data row for a
matched boundary so aggregation can be governed in a later slice. Missing or
unrecognized data keys are returned as unmatched rows. Duplicate boundary keys
are never selected silently: affected data rows are returned as ambiguous and
the duplicate normalized keys are reported. Boundary features without a usable
data match are returned separately. Results are sorted by boundary feature
index for deterministic downstream rendering and receipts.

## K06 slice 3 — join-quality diagnostics

The join result now distinguishes missing and invalid data keys from keys that
are valid but unmatched. It also reports invalid boundary keys, unmatched
boundary features, duplicate normalized boundary keys, ambiguous data rows,
and boundaries with multiple data rows that require a later aggregation rule.
Diagnostics are structured and deterministic; no duplicate boundary is chosen
silently and no aggregation is performed in this slice.

## K06 slice 4 — deterministic classification

The classification contract now assigns finite numeric values to manual,
equal-interval, or quantile classes. It returns breaks, per-feature class
assignments, class counts, valid/invalid counts, and observed minimum/maximum
values. Empty, non-numeric, and non-finite values remain unclassified rather
than being coerced into a visual class. Equal values may produce repeated
automatic breaks and empty classes; that condition remains visible in the
returned class counts for later legend and diagnostics work.

## K06 slice 5 — color and legend model

The presentation contract now maps each class to its reviewed palette color,
opacity, deterministic range label, and classified feature count. NoData has an
explicit color and optional legend entry. Labels are generated from the
classification breaks and remain visible when automatic methods produce equal
breaks or empty classes. This model is renderer-independent and does not yet
add browser controls or draw polygon features.

## K06 slice 6 â€” bounded filtering and feature selection

The interaction contract now applies the recipe filter to data rows before a
join, preserving included and filtered rows for diagnostics. It supports the
same typed comparison operators as the Choropleth recipe. A deterministic
feature-selection helper returns the normalized key, boundary feature, and
associated data rows for an identified feature, or fails closed when the
feature is not present. Browser click handling and record linkback remain UI
integration work.

## K06 slice 8 — persistence and provenance contract

Choropleth layer snapshots now preserve the validated recipe together with
layer identity, visibility, source asset digest, data-form revision, and
lineage identifiers. Serialization and parsing validate the schema, digest,
lineage, and agreement between recipe and provenance before a snapshot can be
accepted. The contract is ready for project-package integration; browser
layer restoration and missing-asset recovery remain application work.

## K06 slice 7 — teaching fixture and CI evidence

`wasm/demo/examples/gis-k06-choropleth/` provides a synthetic polygon and
value dataset covering matched values, filtering, unmatched keys, missing
keys, and NoData classes. The fixture smoke test runs the filter, key join,
classification, and legend model together. Artifact smoke and both GitLab and
GitHub validation workflows require the fixture assets and end-to-end test.
This evidence package is a candidate release gate; experienced-user and
legacy desktop differential review remain required for parity claims.
