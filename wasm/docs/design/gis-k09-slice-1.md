# GIS-K09-S1 — governed advanced spatial-operation contracts

K09-S1 establishes the contract and registry boundary for advanced spatial
analytics. It does not execute an operation, load GDAL, open a filesystem path,
or expose record values to a renderer or network service.

## Registered operations

The registry reserves explicit names for:

- spatial weights;
- Moran's I, LISA, and Getis-Ord statistics;
- H3 aggregation and bounded density;
- spatial cluster methods;
- source-preserving geometry repair; and
- raster zonal statistics.

Every operation is `unvalidated` and `planned` in this slice. A registry entry
is not evidence that the method has been implemented or is equivalent to a
legacy desktop result.

## Governance boundary

Each plan carries:

- digest- and byte-length-bound inputs with an explicit role and CRS;
- bounded input, output, feature, coordinate, cell, permutation, and timeout
  limits;
- explicit output disclosure (`aggregate`, `record-level`, or
  `renderer-only`); and
- a privacy assertion that record values remain local, with record-level export
  disabled unless explicitly requested by a later reviewed operation.

Unknown properties, operations, methods, policies, invalid numeric bounds,
missing fields, and unsafe privacy combinations fail closed. Geometry repair
requires `preserveSource: true`; no source mutation is authorized by this
contract.

## Evidence

`wasm/tests/gis-k09-s1-contract-smoke.mjs` verifies valid plan creation,
registry coverage, planned execution status, unknown-operation rejection,
privacy enforcement, method-specific required fields, and positive resource
limits. The smoke test is included in `check`, GitLab GIS enforcement, and
GitHub Pages validation.

Scientific expected results, independent notebooks, Rust/WASM execution,
privacy review, browser resource measurements, and desktop differential review
remain gates for K09 operation slices and are intentionally not claimed here.

## K09-S2 — deterministic spatial weights

The first executable K09 operation is now a source-preserving spatial-weights
builder. It supports queen and rook shared-boundary adjacency, WGS84
distance-band neighbors, and deterministic k-nearest neighbors. Feature ids and
neighbor rows are sorted stably; distance methods use bounded haversine meters;
weights are row-standardized; and isolated features produce visible
diagnostics.

The builder rejects duplicate or empty ids, non-finite or out-of-range WGS84
coordinates, invalid method parameters, and input counts above the plan limit.
It does not repair geometry, mutate inputs, execute a spatial statistic, or
claim equivalence to desktop GIS software. Independent statistical validation,
projection-aware distance policy, large-dataset performance, and Rust/WASM
promotion remain open gates.

Evidence is in `wasm/tests/gis-k09-s2-spatial-weights-smoke.mjs`, enforced by
the standard check, GitLab GIS job, and GitHub Pages workflow.

## K09-S3 — Moran's I and LISA candidate statistics

The spatial-statistics candidate consumes a verified K09-S2 weights result and
aligned numeric observations. It computes global Moran's I or local indicators
of spatial association (LISA), with stable id ordering, explicit missing-value
policy, seeded permutation p-values, constant-value handling, and isolated
feature diagnostics. Record values remain in the local execution boundary.

This is a candidate mathematical implementation, not a legacy-parity or
validated epidemiological claim. The independent expected-result notebook,
permutation-method review, multiple-testing policy for LISA, numerical
tolerance policy, Rust/WASM promotion, and experienced-user review remain open
release gates.

For this corrective follow-up, global Moran permutation comparisons are
centered on the randomization expectation `-1/(n-1)`. LISA permutations keep
the focal observation fixed and shuffle only the remaining observations. These
choices are explicit candidate conventions and still require independent
statistical review before promotion.

Evidence is in `wasm/tests/gis-k09-s3-spatial-statistics-smoke.mjs`, enforced by
the standard check, GitLab GIS job, and GitHub Pages workflow.

## K09-S4 — Getis-Ord Gi* candidate hotspots

The Getis-Ord candidate consumes K09-S2 weights and aligned numeric values.
K09-S4 makes the Gi* self-inclusion rule explicit, uses deterministic seeded
permutations for z-scores and two-sided p-values, and classifies results as
hot, cold, or neutral using the disclosed candidate threshold. Missing values,
constant values, and features with no included neighbors produce diagnostics.

The reported statistic is the standard local Getis-Ord Gi* z-score: the
self-inclusive weighted sum is centered by the global mean and divided by the
finite-population variance term derived from the included weights. It is not a
weighted local mean. The independent validation notebook records the expected
values for the hand-audited fixture.

This is not yet a validated hotspot method or desktop-parity claim. The exact
Gi* inferential convention, independent expected results, multiple-testing
policy, numerical tolerances, privacy review, and Rust/WASM promotion remain
release gates.

Evidence is in `wasm/tests/gis-k09-s4-getis-ord-smoke.mjs`, enforced by the
standard check, GitLab GIS job, and GitHub Pages workflow.

## K09-S5 — bounded H3 aggregation

The H3 candidate aggregates validated signed WGS84 point observations by H3
cell at an explicit resolution. Count, sum, and mean are supported; cell and
observation limits are enforced; cells are emitted in stable order; and
missing/invalid coordinates, missing values, invalid values, and cell-limit
events produce diagnostics. The H3 indexer is injected at this boundary so the
contract remains independent of a UI vendor bundle and can later be promoted
to the Epi-owned Rust/WASM kernel.

This slice does not claim H3 scientific validation, desktop parity, or a
particular H3 library implementation. Independent expected results, library
version/license review, large-dataset measurements, and Rust/WASM promotion
remain open gates.

Evidence is in `wasm/tests/gis-k09-s5-h3-aggregation-smoke.mjs`, enforced by
the standard check, GitLab GIS job, and GitHub Pages workflow.

## K09-S6 — bounded density surface

The density candidate converts valid signed WGS84 observations into a bounded
equirectangular grid and evaluates a deterministic Gaussian kernel with an
explicit bandwidth and cell size. Observation and cell limits are enforced;
invalid coordinates and weights are diagnosed; and the source observations are
not mutated. The method and parameters are recorded in the result so the
renderer cannot silently change the analytical meaning.

This is a candidate surface calculation, not a validated epidemiological
estimator or desktop-parity claim. Projection error bounds, edge correction,
weighted-denominator policy, independent expected results, privacy review, and
Rust/WASM promotion remain release gates.

Evidence is in `wasm/tests/gis-k09-s6-density-smoke.mjs`, enforced by the
standard check, GitLab GIS job, and GitHub Pages workflow.

## K09-S7 — governed spatial clusters

The spatial-cluster candidate supports deterministic DBSCAN-style clusters and
an explicitly overlapping exploratory-circle summary over signed WGS84 points.
The exploratory method is not a scan statistic and has no likelihood,
population-denominator, or significance interpretation.
Radius, minimum-member, and observation limits are explicit; cluster members,
centers, noise, and invalid-coordinate diagnostics are stably ordered; and no
source records are mutated.

This slice is not a validated outbreak-detection method or a claim of SaTScan
or desktop Epi Info equivalence. Method-specific statistical review,
independent expected results, multiple-testing and population-at-risk policy,
privacy review, and Rust/WASM promotion remain release gates.

Evidence is in `wasm/tests/gis-k09-s7-spatial-cluster-smoke.mjs`, enforced by
the standard check, GitLab GIS job, and GitHub Pages workflow.

## K09-S8 — source-preserving geometry repair

The geometry-repair candidate validates bounded GeoJSON point, line, and
polygon coordinate structures. Report-only mode preserves the source and
returns diagnostics; bounded-repair mode removes consecutive duplicate
vertices and closes polygon rings while returning the original geometry,
repaired geometry, change flag, and validity status. WGS84 coordinate ranges,
feature counts, and coordinate counts are bounded, and unsupported geometry
types fail closed with diagnostics.

This is not automatic topology repair and does not claim validity for
self-intersections, holes, winding order, or desktop GDAL equivalence. Those
cases require separate reviewed policies and independent expected results.

Evidence is in `wasm/tests/gis-k09-s8-geometry-repair-smoke.mjs`, enforced by
the standard check, GitLab GIS job, and GitHub Pages workflow.

## K09-S9 — bounded raster zonal statistics

The zonal-statistics candidate calculates count, sum, mean, minimum, or
maximum over the centers of an explicit WGS84 raster grid contained by
Polygon or MultiPolygon zones. Raster dimensions, cell count, zone count,
finite values, NoData policy, and WGS84 extent are bounded. Results are
deterministically ordered by zone id and report excluded NoData or empty-zone
diagnostics without mutating source inputs.

This is a candidate grid estimator, not a validated GDAL/rasterio equivalent.
Cell-center inclusion, resampling, partial-cell weighting, CRS transformation,
independent expected results, privacy review, and Rust/WASM promotion remain
release gates.

Evidence is in `wasm/tests/gis-k09-s9-zonal-statistics-smoke.mjs`, enforced by
the standard check, GitLab GIS job, and GitHub Pages workflow.

## K09-S10 — advanced spatial integration release gate

The K09 integration boundary now exposes a machine-readable audit for every
registered advanced operation. Each operation requires independent scientific
evidence, privacy review, measured resource validation, browser validation,
and Rust/WASM parity evidence. Missing evidence is reported by gate key;
unknown operations fail closed. Even a fully referenced audit keeps
`executionAllowed` false until a maintainer promotes the operation through the
reviewed validation process.

This slice is governance and integration plumbing, not scientific validation.
It deliberately prevents candidate implementations from being presented as
production-ready or legacy-parity verified.

Evidence is in `wasm/tests/gis-k09-s10-gate-audit-smoke.mjs`, enforced by the
standard check, GitLab GIS job, and GitHub Pages workflow.
