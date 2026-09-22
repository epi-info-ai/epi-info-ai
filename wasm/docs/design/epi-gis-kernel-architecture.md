# `epi-gis` kernel architecture

Status: proposed architecture foundation
Primary parity reference: Epi Info 7 User Guide, Chapter 10 - Maps
Historical reference: Epi Map DOS manual
Scope: foundations for preserving Epi Map behavior in Epi Info AI

## Purpose

The `epi-gis` kernel is the computation, evidence, and provenance foundation
for Epi Info AI mapping. Its first responsibility is to preserve the historical
Epi Map mental model and operational workflow for experienced Epi Info users.

The Epi Info 7 Windows mapping workflow is the primary parity reference for
user-visible behavior. The DOS Epi Map manual supplies historical context for
boundary-file workflows, manual data entry, range shading, legends, map files,
and dot-density presentation. Browser capabilities may require adaptations, but
an adaptation must preserve user intent and remain visibly labeled. New Epi Info
AI capabilities must remain separate from the legacy parity floor.

This document establishes the architectural boundary. It does not claim that
the current prototype has achieved mapping parity.

## First spike: GIS-K01 contract and registry

The first implementation spike lives under [`wasm/app/gis/`](../../app/gis/)
and is intentionally engine-free. It provides the v0.1 plan, result, receipt,
input, limits, diagnostic, and derived-asset contracts; validates required
fields and rejects unknown properties; canonicalizes plans for future digests;
and exposes the four registered operations through a fixed registry. It does
not create a Worker, load GDAL, access files, or claim execution support.

The focused smoke test is [`gis-contract-smoke.mjs`](../../tests/gis-contract-smoke.mjs)
and is run with `pnpm run test:gis`. This establishes the fail-closed boundary
before an execution adapter or browser Worker is introduced.

GIS-K02 now adds [`worker-client.ts`](../../app/gis/worker-client.ts) and the
bundled [`gis-worker.ts`](../../demo/gis-worker.ts). The first executable
operation is a bounded, read-only GeoJSON inspection adapter. It verifies the
input digest and byte length, applies feature/coordinate/nesting limits, and
returns candidate metadata plus a receipt. It is a Worker boundary spike, not
yet the GDAL-backed production adapter and not yet connected to the main map UI.

The static [`gis-kernel-spike.html`](../../demo/gis-kernel-spike.html) page and
[`gis-kernel.spec.mjs`](../../tests/browser/gis-kernel.spec.mjs) provide the
browser acceptance surface for this slice. The browser test requires the
managed Playwright Chromium binary in the local environment or CI.

GIS-K03 adds the engine-free [`ingestion.ts`](../../app/gis/ingestion.ts)
preflight. It currently accepts only GeoJSON media types and rejects inputs
that exceed byte, feature, coordinate, nesting, or property-count limits. It
also rejects non-finite and out-of-range geographic coordinates before any
renderer or GDAL adapter can receive them. The engine-free ZIP preflight now
checks central-directory bounds, entry counts, expansion budgets, compression
ratios, encryption, UTF-8 names, and traversal paths, and identifies likely
Shapefile/GeoPackage/GeoJSON bundles without extracting them. GDAL driver and
virtual-filesystem allowlists remain deferred to the adapter slice.

## Reference hierarchy

### Primary: Epi Info 7 Windows Maps

The Epi Info 7 User Guide Chapter 10 is the first reference for parity decisions.
It describes the recognizable map window and the following workflows:

- Spot Map and Case Cluster layers from numeric latitude and longitude fields;
- zoom-dependent case-cluster expansion and record inspection;
- data filtering, stratification, cumulative time lapse, and distribution output;
- Choropleth and Dot Density layers using Shapefile, map-server, and KML
  boundaries;
- explicit data-key and feature-key selection for boundary joins;
- class/range, quantile, color, opacity, legend, label, and filter controls;
- independent Reference Layers from map servers, Shapefiles, and KML;
- markers, zones, labels, navigation, orientation, scale, and layer management;
- Street and Blank background choices;
- `.map7` save/open behavior and PNG image export; and
- the Enter Data > Maps path that links a displayed case back to its record.

The Windows guide is the source of truth when a newer behavior conflicts with
the DOS workflow or with an assumption made by a browser implementation.

### Historical context: Epi Map DOS

The DOS manual remains important evidence for the lineage of Epi Map. It
describes a menu-driven workflow organized around Map, Boundary, Data, Info,
Map Type, Annotate, Output, and related commands. Important historical concepts
include:

- loading complete or partial boundary files and editing regional boundaries;
- entering values manually for named geographic entities;
- joining external data when names match boundary-file entities;
- shaded/range maps with editable ranges, titles, and legends;
- map files that preserve the constructed map; and
- dot-density maps where a declared dot value represents a quantity.

DOS behavior is not automatically a Windows parity requirement. It is evidence
for terminology, user expectations, and compatibility decisions where the
Windows guide is silent.

### Supporting project records

Implementation decisions must also remain consistent with:

- [`Epi Info 7 User Guide`](../reference/Epi-Info-7-User-Guide.pdf), especially
  Chapter 10 - Maps;
- [`Epi Map DOS manual`](../reference/Epi-Map-DOS-125842.pdf), for historical
  Epi Map concepts and operational context;
- [`epi-gis-kernel-v0.1.md`](epi-gis-kernel-v0.1.md), the bounded compute-kernel
  design;
- [`../review/geospatial_mapping.md`](../review/geospatial_mapping.md), the
  legacy capability inventory and parity gates;
- [`../../architecture.md`](../../architecture.md), the application language and
  trust-boundary architecture; and
- [`../validation/algorithm-validation-standard.md`](../validation/algorithm-validation-standard.md),
  the scientific evidence standard.

If these records disagree, the discrepancy must be recorded and resolved. A
visible UI or a plausible map is not evidence that parity has been achieved.

## Parity and adaptation policy

Every GIS capability has two separate descriptions:

1. the historical behavior being preserved; and
2. the browser implementation and any deliberate adaptation.

The capability registry must expose both. A feature is not marked legacy-parity-
verified merely because it can draw similar geometry.

### Legacy parity

Legacy parity requires reviewed Windows source/manual evidence, frozen fixtures,
browser workflow tests, and experienced-user or desktop differential review where
the behavior is material. The status remains `candidate` until the evidence gates
are complete.

### Browser adaptation

The browser may replace desktop mechanics with:

- explicit file and directory grants;
- OPFS-backed project assets;
- Worker-isolated processing;
- downloads instead of ambient desktop output paths;
- explicit network/provider state;
- offline PMTiles or other governed local assets; and
- visible review and Apply steps for mutating operations.

These changes preserve intent but do not silently claim desktop parity.

### New branch

H3 aggregation, Epi Assist proposals, space-time cluster analysis, modern
privacy/disclosure controls, and other Epi Info AI additions are new branches.
They may reuse kernel contracts, but they must not repurpose a familiar legacy
control in a way that changes its meaning.

## Architectural boundary

```text
Windows parity workflow / DOS historical evidence
                       |
                       v
        TypeScript GIS parity and policy facade
       inspect -> bind -> validate -> review -> authorize
                       |
                       v
               canonical GisPlan
                       |
                       v
             dedicated lazy GIS Worker
       operation registry -> bounded adapters/methods
                       |
                       v
          GisResult + derived bytes + receipt
                       |
                       v
       host verifies -> OPFS/project commit -> renderer
```

The kernel computes bounded, typed operations. The host owns policy and product
authority.

### TypeScript host responsibilities

The TypeScript host owns:

- Epi Info 7 menu/dialog and Enter Data integration;
- explicit source and asset selection;
- project revision, permissions, and user review;
- network/provider policy and credentials;
- OPFS, encrypted project packages, and downloads;
- canonical plan construction and schema validation;
- operation registry lookup and capability status;
- privacy/disclosure policy, history, and audit events;
- Worker lifecycle, cancellation, timeout, and retry; and
- rendering, legends, annotations, record linkback, and accessibility.

The host must not become a second geometry or statistical authority. It may
orchestrate and render typed results, but it must not reinterpret kernel output.

### GIS Worker responsibilities

The Worker receives only:

- bounded input bytes explicitly granted by the host;
- a validated canonical plan;
- an effective versioned limits profile; and
- a structured cancellation/request channel.

The Worker must not discover ambient files, access OPFS, fetch the network,
read credentials, mutate project state, invoke arbitrary GDAL arguments, run
arbitrary SQL, or return raw engine handles. Cancellation terminates the active
Worker for the initial release and discards all uncommitted output.

### Adapter responsibilities

GDAL/PROJ/GEOS or other engines are private implementation details behind fixed
operation adapters. Adapters translate validated typed parameters into fixed
calls, normalize upstream diagnostics, enforce driver and creation-option
allowlists, and return Epi-owned result schemas. No UI, Epi Assist proposal, or
`.pgm7` program may construct raw GDAL argument arrays.

## Historical capability model

The kernel and product must retain the distinctions below.

| Historical capability | Required Epi Info AI meaning | Kernel foundation |
|---|---|---|
| Spot Map | Display individual valid record locations with selected description/style and filters | Coordinate binding, validation, bounded point result |
| Case Cluster | Visually aggregate nearby cases and reveal/select members as the user zooms | Deterministic point indexing, cluster display result, record linkback |
| Choropleth | Join data to boundaries and shade areas using reviewed classes/ranges or quantiles | Boundary inspection, CRS normalization, key/spatial join, classification contract |
| Dot Density | Represent a value as deterministic dots within geographic boundaries | Boundary join, disclosed dot value, deterministic seed/placement, clipping |
| Reference Layer | Display geography or context independently of an analytic data join | Format/layer inspection, CRS review, normalized vector/raster asset |
| Layer manager | Show count, type, order, visibility, edit, remove, and clear state | Versioned layer recipe and map-document persistence |
| Filters | Reopen and apply a reviewed subset to a layer | Typed bounded predicate, visible exclusions, canonical plan |
| Legends | Explain actual rendered classes, colors, missing values, and layer meaning | Renderer-independent legend recipe |
| Time lapse | Cumulative temporal playback with date/time eligibility and distribution context | Temporal field contract, bounded stops, deterministic time slices |
| Annotations | Add and preserve markers, zones, and labels | Map-document graphics model with audit and persistence |
| Save/Open | Reopen a map with its sources, layers, styles, and background state | Portable project/map contract, lineage, missing-source diagnostics |
| Save as image | Produce a clean user-requested image of the map layout | Export adapter, attribution, privacy warning, and visual fixture |
| Enter Data linkback | Open the authorized source record represented by a map item | Opaque record identity within project scope and explicit authorization |

The kernel does not force all these controls into one operation. It provides the
typed results and durable contracts that let the product preserve the workflow.

## Versioned kernel contracts

The initial public boundary is a discriminated, schema-validated contract:

```ts
type GisOperationV01 =
  | "gis.dataset.inspect"
  | "gis.vector.normalize"
  | "gis.geometry.validate"
  | "gis.vector.spatialJoin";

interface GisPlanV01 {
  schema: "epi-gis-plan/0.1";
  id: string;
  operation: GisOperationV01;
  projectRevision: string;
  inputs: readonly GisInputRefV01[];
  parameters: unknown;
  limits: GisLimitsProfileV01;
  requestedOutputs: readonly GisOutputRequestV01[];
}
```

The concrete TypeScript interfaces and JSON Schemas must reject unknown
operations, properties, fields, options, and unsafe effects before Worker
creation. Each operation gets its own typed parameter and result schema.

### Required contract properties

- Input assets have stable IDs, byte lengths, SHA-256 digests, semantic roles,
  media types, and declared or explicitly unknown CRS.
- CRS is normalized with authority, axis-order policy, dimensionality, and
  confidence/warnings. CRS84 and EPSG:4326 must not be conflated silently.
- Spatial bindings identify geometry roles, coordinate fields, join keys,
  predicates, boundary behavior, and missing/ambiguous handling.
- Results distinguish source assets, immutable derived assets, record-level
  artifacts, aggregate outputs, and renderer-only state.
- Every operation records an Epi-owned status and normalized error code.
- Rejection, cancellation, timeout, crash, and failure behavior is defined for
  both ephemeral diagnostics and persisted audit/receipt records.

### Canonicalization and digests

Plan, result, receipt, and cache-key canonicalization must be specified before
implementation. The contract must define object-key ordering, Unicode handling,
number serialization, `null`/omission rules, date/time representation, and
unsupported values. A standard such as RFC 8785 may be adopted if it satisfies
the cross-language Rust/TypeScript requirements.

Timing and runtime metadata may be recorded in a receipt but must not change the
deterministic analytical content digest.

### Receipt minimum

Each attempted operation records or returns:

- contract and operation implementation versions;
- canonical plan digest and project revision;
- input IDs, roles, sizes, and hashes;
- source, detected, and output CRS with warnings;
- effective parameters and limits profile;
- feature, geometry, row, pixel, skipped, excluded, unmatched, and ambiguous
  counts as applicable;
- output IDs, media types, sizes, hashes, and lineage;
- engine, adapter, GDAL, PROJ, GEOS, and algorithm versions;
- terminal status, normalized error code, start/finish time, and duration; and
- validation status from the operation registry.

Receipt fields must carry disclosure classification so exact coordinates,
record IDs, and sensitive bounds do not leak into aggregate Output or general
history by default.

## Initial operation registry

The first kernel implementation remains deliberately small:

1. `gis.dataset.inspect` - inventory formats, layers, fields, geometry/raster
   metadata, CRS, extent, and estimated work without project mutation.
2. `gis.vector.normalize` - select one reviewed Shapefile ZIP or GeoPackage
   vector layer, reproject to CRS84, and emit a normalized vector artifact.
3. `gis.geometry.validate` - report geometry defects without modifying source
   geometry.
4. `gis.vector.spatialJoin` - perform a bounded deterministic point-in-polygon
   join with matched, unmatched, boundary, and ambiguous diagnostics.

Repair, raster warp, zonal statistics, COG windows, GeoPackage writing, H3,
spatial statistics, and cluster detection remain separate roadmap operations
until their own contracts and validation evidence exist.

The operation registry, not the presence of a GDAL driver, defines the supported
surface. UI labels, Epi Assist tools, documentation, and future commands must
derive status from the registry.

## Data and persistence model

### Source assets

Source records, boundary files, map-service snapshots, rasters, tiles, and
imported files remain immutable and authoritative. The kernel never silently
repairs or overwrites source bytes.

### Derived assets

Normalization, reprojection, repair, joins, raster windows, classifications,
and other computations create new assets with new IDs, hashes, lineage, and
receipts. A derived asset must identify its source assets and canonical plan.

### Layer recipes

A layer recipe declares epidemiologic meaning independently from bytes and
renderer objects. It includes layer kind, source/derived asset IDs, CRS, style,
legend, filter, join, extent, visibility, order, disclosure classification,
and record-linkback policy.

### Map documents

Map documents preserve layer order, visibility, editable configuration, filters,
styles, legends, annotations, extent, background, source provenance, and CRS.
Presentation edits must not mutate analytical artifacts.

### Two-phase project commit

The host must:

1. resolve explicit grants and verify input hashes;
2. validate the plan, schema, CRS, limits, and user authorization;
3. execute in the Worker;
4. recompute and verify result hashes and schemas;
5. write temporary OPFS objects; and
6. commit metadata, lineage, receipt, and layer state through a recoverable
   journal or commit marker.

OPFS and project metadata do not share one browser transaction. Recovery must
remove orphaned temporary objects and reject incomplete metadata after a crash.
Project revision comparison must provide compare-and-swap behavior before commit.

## Safety and resource controls

Before production ingestion, enforce versioned limits for input bytes, archive
entries, expanded bytes and expansion ratio, layers, fields, strings, features,
vertices, rings, bands, pixels, output bytes, elapsed time, and Worker memory
proxy.

Reject archive traversal, nested archives, ambient paths, network virtual
filesystems, arbitrary SQL, unreviewed drivers/options, missing or ambiguous CRS
where reprojection is required, and outputs over budget. Preflight archive and
driver controls must run before GDAL receives untrusted bytes.

WASM and Workers improve isolation and responsiveness but are not security
boundaries. The host remains responsible for network policy, authorization,
credentials, privacy, and project mutation.

## Validation and parity gates

### Evidence levels

- `spike`: exploratory implementation or external lab evidence;
- `candidate`: production facade, frozen fixtures, limits, browser tests, and
  project round-trip exist;
- `browser-verified`: candidate behavior passes local/CI browser checks;
- `legacy-parity-verified`: Windows workflow/source/manual and experienced-user
  or desktop differential gates are complete; and
- `validated`: independent expected results and named geospatial review approve
  the method and terminology.

### Required fixture families

The GIS fixture suite must include:

- the foodborne neighborhood join and comparison with the existing field;
- valid and invalid coordinate ranges, signed coordinates, precision retention,
  missing rows, duplicate IDs, and skipped-row diagnostics;
- CRS84/EPSG:4326 axis-order and known-control reprojection cases;
- polygons with holes, multipolygons, touching boundaries, overlaps, empty
  geometry, antimeridian cases, and invalid topology;
- Shapefile ZIP and GeoPackage layer selection, Unicode/null attributes, corrupt
  inputs, archive traversal, decompression bombs, and resource limits;
- unmatched, ambiguous, boundary, and deterministic-order spatial joins;
- deterministic dot placement with declared value, seed, clipping, and rounding;
- temporal fields, cumulative time-lapse stops, and distribution output;
- map-document round trips, missing-source diagnostics, OPFS recovery, and
  encrypted `.epiax` package replay; and
- renderer-neutral output compared through Leaflet and a test renderer.

Expected results must be independently derived and must record method identity,
reference implementation/version, tolerance, missing-value behavior, and review
state. A single implementation must not serve as its own oracle.

### Windows parity review

For each Windows Maps workflow, acceptance must verify:

1. the correct launch context and familiar dialog intent;
2. field/source/key selection and effective canonical plan;
3. visible assumptions, exclusions, filters, styles, legends, and layer state;
4. output and linkback behavior;
5. save/open and project round-trip behavior; and
6. keyboard, focus, narrow viewport, Chromium, Firefox, and WebKit behavior.

The Windows user guide is the first differential checklist. Reviewed Windows
source and experienced-user comparison are required where the manual does not
specify exact behavior.

## Delivery sequence

### GIS-K01 - contracts and registry

Create versioned plan/result/receipt/error schemas, canonicalization, disclosure
classes, operation registry, and fixture format. Unknown operations and
properties must fail before Worker creation.

### GIS-K02 - Worker facade

Create a lazy GIS Worker with request correlation, progress, cancellation,
timeout, crash recovery, transfer ownership, and no initial GDAL fetch during
ordinary application startup.

### GIS-K03 - defensive ingestion

K03 accepts record coordinates only as signed decimal-degree WGS84 values. UTM
Easting/Northing and degrees-minutes-seconds text are not alternate accepted
input formats. The kernel may identify a suitable WGS84 UTM zone from valid
latitude/longitude values for a later reprojection workflow, but zone detection
does not convert coordinates and is never permission to accept projected input.
The deterministic TypeScript helper covers the standard Norway and Svalbard
UTM-zone exceptions and reports when a set of points spans multiple zones.

Add driver and virtual-filesystem allowlists, archive fixtures covering hostile
compression and malformed metadata, and lowest-supported-device memory tests.

### GIS-K04 - reference-layer parity slice

Implement Add Reference Layer for a reviewed Shapefile ZIP or GeoPackage. The
slice must exercise explicit file grant, inspect, layer choice, CRS review,
normalization, lineage, packaging, diagnostics, and renderer integration.

### GIS-K05 - Spot Map and Case Cluster

Preserve the Windows coordinate-field dialog intent, valid-row diagnostics,
description/style/filter controls, zoom-dependent visual aggregation, and
authorized record linkback. Keep visual Case Cluster distinct from statistical
cluster detection.

### GIS-K06 - Choropleth

Implement explicit boundary/data-key joins, unmatched/missing diagnostics,
classes/ranges, quantiles, colors, opacity, labels, legends, filters, and source
provenance. Preserve the legacy manual color path; label ColorBrewer and other
enhancements as new branches.

### GIS-K07 - Dot Density

Implement a deterministic, disclosed value-per-dot contract with a reviewed
seed/placement policy, clipping behavior, rounding, legend, filters, and
unmatched diagnostics.

### GIS-K08 - map document and output parity

Complete layer ordering/edit/remove/clear, annotations, backgrounds, time lapse,
PNG export, `.epia`/`.epiax` round trips, and visible recovery for missing assets.

### GIS-K09 - governed advanced spatial operations

Promote geometry repair, raster operations, zonal statistics, H3, spatial
statistics, and cluster methods only after separate scientific, privacy,
resource, and browser validation contracts.

### GIS-K10 - Classic `MAP` revival

Only after the named layer workflows and typed contracts are stable should a
future Classic `MAP` command produce a reviewed `GisPlan`. It must not become an
arbitrary GDAL or SQL escape hatch.

## Non-goals for the first kernel release

The first release does not include arbitrary GDAL commands, a public SQL escape
hatch, ambient filesystem access, automatic geometry repair, geocoding, live map
services, server processing, unrestricted raster processing, statistical cluster
detection, or AI-driven execution.

## Completion definition

`epi-gis` v0.1 is ready for candidate status when the four initial operations use
the production facade, pass schema and hostile-input fixtures, enforce measured
limits, produce deterministic receipts, survive project/package round trips, and
leave state unchanged on failure or cancellation.

It is not legacy-parity-verified until the Epi Info 7 Maps workflows are reviewed
against the primary manual/source evidence and experienced users or desktop
differential checks accept the visible behavior. Successful rendering alone is
not sufficient.
