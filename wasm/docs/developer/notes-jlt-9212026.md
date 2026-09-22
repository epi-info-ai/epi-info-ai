# `epi-gis` kernel v0.1 review notes

Review date: 2026-09-21
Reviewer branch: `epi-gis-kernel-jlt`

## Overall assessment

The design is directionally strong. It clearly separates policy, computation,
persistence, rendering, and scientific validation. The main implementation risk
is that several critical semantics remain implicit, which could produce
incompatible implementations or incorrect spatial results.

## Findings

### High — canonicalization is underspecified

`epi-gis-kernel-v0.1.md` requires canonical JSON and deterministic digests but
does not define key ordering, Unicode normalization, number formatting,
`-0`, large integers, non-finite values, date/time serialization, or omission
versus explicit `null`.

Adopt RFC 8785 or specify an equivalent byte-for-byte algorithm before
implementing receipt digests or derived-artifact cache keys.

### High — spatial semantics need a normative contract

The design names `within` and point-in-polygon joins, but the operation-specific
parameter schemas are omitted. Define boundary behavior, holes and multipolygons,
antimeridian handling, coordinate precision/tolerance, duplicate polygon identity,
invalid-geometry behavior, and deterministic ordering of multiple matches.

This is especially important because the foodborne acceptance path compares the
derived neighborhood with an existing neighborhood field.

### High — CRS representation is too weak for safe reprojection

`declaredCrs: string | "unknown"` does not capture authority, axis order,
dimensionality, datum epoch, or confidence. CRS84 and EPSG:4326 are treated
together in the design even though their axis conventions can differ.

Add a normalized CRS object and explicit axis-order policy. Make transformation
behavior a tested contract rather than adapter metadata.

### High — the project transaction is not atomic as written

The proposed commit spans OPFS files and project metadata, which do not share one
transaction. A crash can leave an orphaned OPFS asset, metadata pointing to a
missing asset, or a committed result without its receipt.

Define a journal/state machine with recovery and idempotent commit markers. Reserve
the term “atomic” for the observable recovery guarantee.

### Medium — `projectRevision` needs compare-and-swap semantics

Define whether `projectRevision` is a monotonic revision, content hash, or opaque
token. The host should verify it immediately before commit so stale plans cannot
commit after a project switch.

### Medium — resource limits are deferred too far

The design correctly requires limits but postpones numerical defaults. Establish a
versioned baseline profile for archive expansion, feature counts, vertices,
memory, runtime, and output size before implementing GDAL/WASM integration.

### Medium — independent validation needs a named oracle

The foodborne fixture is a good end-to-end case but is insufficient by itself.
Add independent expected outputs for CRS transformation, geometry validity,
boundary cases, antimeridian behavior, multipolygons, and spatial joins. The
oracle should be independent of the implementation.

### Medium — receipt privacy classifications are incomplete

Receipts include input IDs, lineage, bounds, diagnostics, and hashes. The design
should explicitly classify which receipt fields may appear in general Output,
history, exports, or encrypted packages. Record-level derived artifacts need an
explicit disclosure policy.

## Recommended implementation order

1. Define canonical JSON and versioned JSON Schemas.
2. Define CRS and spatial-join semantics.
3. Implement host-side preflight and transaction recovery.
4. Add independent edge-case fixtures and expected outputs.
5. Implement the four Worker operations.

The proposed repository paths are currently absent, which is consistent with the
document’s proposed-architecture status rather than a code defect.

## `geospatial_mapping.md` review

### Overall assessment

This review is a strong product and evidence companion to the kernel design. It
correctly separates legacy parity from adapted browser behavior and new branches,
keeps records authoritative, treats CRS/privacy/offline behavior as correctness
concerns, and avoids claiming spatial-processing parity from a runnable demo.

### Findings

#### High — the operation registry has two competing v0.1 scopes

The kernel design limits the first implementation increment to four operations:
inspect, normalize, geometry validation, and spatial join. The geospatial review's
initial production contract also lists repair, raster warp, zonal statistics, COG
materialization, and GeoPackage writing.

These documents should distinguish one authoritative `v0.1` registry from a
roadmap catalog. Otherwise UI capability claims, fixtures, and implementation
work can diverge. Mark the additional operations explicitly as `roadmap` or
`deferred` in the shared registry.

#### High — implementation order conflicts with the kernel delivery sequence

The geospatial review recommends completing visual Spot/Case Cluster work,
Choropleth, Dot Density, and PNG export before explicit CRS/reprojection and
kernel work. The kernel design identifies Add Reference Layer as the first
production slice and treats CRS, normalization, lineage, and receipts as its
core boundaries.

For the `epi-gis-kernel-jlt` branch, choose and document one dependency order.
The kernel should at least establish the shared contracts, CRS policy, limits,
and receipt model before UI features create competing representations.

#### High — study-area and population-raster provenance remain an explicit gap

The evaluation records incomplete population-raster provenance and says that the
structured investigation question remains a follow-up. Because study area,
population concept, vintage, units, NoData, and coverage affect epidemiologic
interpretation, these should be represented in the asset/plan contracts before
zonal statistics or denominator-based products are promoted.

#### Medium — receipt requirements need one lifecycle rule

The review requires deterministic receipts for processing, but also states that
some failures, cancellations, and preflight rejections must leave no artifact.
Define whether rejected/cancelled operations receive a persisted failure receipt,
an ephemeral diagnostic, or both. The rule should be shared by the kernel,
history, package, and privacy contracts.

#### Medium — renderer independence needs a conformance fixture

The review requires the same committed analytical result to render through Leaflet
and a test renderer without changing result content. Add a fixture that compares
the renderer-neutral layer recipe/result, not screenshots alone, and verifies that
style, legend, ordering, and map interaction cannot mutate analytical bytes.

#### Medium — privacy policy metadata is still a design gate

The review correctly distinguishes raw points, H3 cells, aggregates, record
linkback, history, exports, and encrypted packages, but does not yet define a
machine-readable disclosure classification. Add a policy field to layer recipes,
derived artifacts, and receipts so exact-location and record-level results cannot
silently flow into aggregate Output or general history.

#### Medium — the defensive-input requirements need executable ownership

The review lists archive, GDAL driver, virtual filesystem, memory, timeout, and
adversarial-input controls. Assign each control to the host preflight, Worker
facade, adapter, or CI fixture layer. In particular, archive expansion and driver
allowlisting should be enforced before GDAL receives bytes, while geometry and
CRS validation belong to operation contracts.

#### Low — dependency/runtime integrity should be made release-visible

The review calls for self-hosted pinned runtimes, dependency/license checks, and
Pages/offline support. Add runtime artifact digests, build provenance, and SBOM
verification to the release gate so “pinned” means reproducible rather than only
version-labeled.

### Recommended follow-up for this branch

1. Reconcile the shared operation registry and mark roadmap operations clearly.
2. Freeze canonical CRS, spatial semantics, disclosure, and receipt lifecycle
   contracts.
3. Add contract/fixture ownership for defensive ingestion and renderer neutrality.
4. Establish provenance requirements for study areas and population surfaces.
5. Align the kernel and UI delivery sequences before implementation begins.
