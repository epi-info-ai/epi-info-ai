# `epi-gis` kernel v0.1 design

Status: proposed first production architecture, informed by the foodborne GIS
workflow and the legacy-versus-improved mental-model evaluation.

This document defines a bounded kernel design. It does not mark the GDAL/WASM
spikes as production code and it does not declare legacy mapping parity.

## Outcome and boundary

`epi-gis` v0.1 turns explicitly granted project assets and a reviewed, typed
plan into immutable derived assets, diagnostics, and a reproducible processing
receipt. It is a compute and evidence kernel, not a map UI, file browser,
arbitrary GDAL console, general SQL runtime, geocoder, tile provider, or
statistical-cluster implementation.

```text
Forms / Maps / epi-lang / Epi Assist proposal
                    |
                    v
          Epi-owned TypeScript policy facade
     validate -> review -> authorize -> resolve assets
                    |
                    v
          dedicated lazy-loaded GIS Worker
       operation registry -> GDAL adapter / Epi methods
                    |
                    v
       result manifest + derived bytes + receipt
                    |
                    v
     host verifies -> OPFS/project commit -> renderer
```

The host owns user authorization, project state, network access, credentials,
OPFS, packaging, history, and presentation. The Worker receives only bounded
bytes, a validated plan, and a cancellation token. It cannot discover ambient
files, mutate the project, fetch the network, or execute an arbitrary command.

## Versioned public contracts

The initial TypeScript contract should be expressible as discriminated unions
and mirrored by JSON Schema fixtures:

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
  parameters: InspectParams | NormalizeParams | ValidateParams | SpatialJoinParams;
  limits: GisLimitsProfileV01;
  requestedOutputs: readonly GisOutputRequestV01[];
}

interface GisInputRefV01 {
  assetId: string;
  sha256: string;
  role: "records" | "reference-geography" | "context";
  declaredCrs: string | "unknown";
}

interface GisResultV01 {
  schema: "epi-gis-result/0.1";
  planId: string;
  status: "succeeded" | "cancelled" | "rejected" | "failed";
  outputs: readonly GisDerivedAssetV01[];
  diagnostics: readonly GisDiagnosticV01[];
  receipt: GisReceiptV01;
}
```

Operation-specific parameter objects reject unknown properties. IDs, hashes,
CRS state, field names, predicates, and limits are data, never interpolated raw
GDAL arguments. A canonical JSON representation of the plan produces its plan
digest and derived-artifact cache key.

### Receipt minimum

Every attempted operation returns or records:

- plan schema, canonical plan digest, operation, and operation implementation
  version;
- project revision and input asset IDs, sizes, roles, and SHA-256 digests;
- declared, detected, source, and output CRS plus confidence/warnings;
- exact effective parameters and limits profile;
- feature/geometry/row/pixel counts, bounds, skipped/excluded counts, and
  operation-specific diagnostics;
- output IDs, media types, byte sizes, hashes, and source lineage;
- `epi-gis`, adapter, GDAL, PROJ, and GEOS versions;
- started/finished timestamps, elapsed duration, terminal status, and normalized
  error code; and
- validation status (`unvalidated`, `candidate`, or `validated`) sourced from
  the registry rather than inferred from successful execution.

Timing and runtime metadata do not participate in the deterministic receipt
content digest; analytical inputs, versions, parameters, diagnostics, and
outputs do.

## V0.1 operation registry

Only four operations enter the first implementation increment:

| Operation | Purpose | Why it is in v0.1 |
|---|---|---|
| `gis.dataset.inspect` | Identify format/layers/fields/geometry or raster metadata, CRS, extent, size, and estimated work without project mutation | Preview-first import and defensive limits depend on it |
| `gis.vector.normalize` | Select one Shapefile ZIP or GeoPackage vector layer, reproject to CRS84, and emit normalized GeoJSON | Delivers the highest-value Add Reference Layer parity path |
| `gis.geometry.validate` | Report topology defects without changing source geometry | Prevents readable-but-invalid boundaries from appearing trustworthy |
| `gis.vector.spatialJoin` | Deterministic bounded point-in-polygon join with matched/unmatched/ambiguous diagnostics | Makes the foodborne neighborhood relationship auditable |

Repair, raster warp, zonal statistics, COG windows, and GeoPackage output remain
registered as roadmap candidates, not hidden options in these four operations.
H3 remains in the Epi-owned spatial path until its contract is unified; it does
not need GDAL.

## Candidate spatial-index and trajectory engine: Spatio

[`spatio`](https://github.com/pkvartsianyi/spatio) is an MIT-licensed Rust
spatio-temporal database built on `geo` and `rstar`. It is useful input to the
Epi-owned spatial path, but it is not a replacement for `epi-gis`, GDAL, PROJ,
GEOS, epidemiologic spatial statistics, or the renderer. The reviewed `0.3.9`
core provides in-memory R*-tree indexes, radius and bounding-box queries,
nearest-neighbor search, point-in-polygon filtering, 2D/3D points, and movement
trajectories.

| Kernel need | Spatio fit | Epi Info AI decision |
|---|---|---|
| Point radius and bounding-box queries | Strong | Evaluate behind typed `epi-gis` operations |
| Point-in-polygon candidate filtering | Strong | Compare with the validated spatial-join path; do not silently substitute engines |
| Nearest-neighbor search | Promising | Require independent geographic-ordering tests before candidate status |
| Moving-object trajectories | Strong specialized capability | Defer until a governed epidemiologic use case and privacy model exist |
| Large point-set indexing | Strong | Benchmark the full core against direct `geo` plus `rstar` use |
| CRS detection and reprojection | Not provided | Keep in the GDAL/PROJ adapter |
| General vector formats and raster processing | Not provided | Keep in GDAL-WASM |
| Topology validation and repair | Not equivalent to GEOS | Keep in the geometry adapter |
| Epidemiologic spatial statistics | Not provided | Keep in Epi-owned, independently validated methods |
| Rendering and map interaction | Not provided | Keep outside the compute kernel |
| Browser storage and project transactions | Native append-only persistence does not match the browser contract | Keep OPFS, package authority, and commits in the TypeScript host |
| Browser/WASM API | No published browser binding was identified in the review | Prove compatibility in an isolated Worker spike before adoption |

Spatio was designed for real-time moving objects. Its Python binding, TCP
server, native persistence, recovery, and filesystem behavior must not enter a
browser bundle. A spike should compile only the minimum memory-safe core or,
if that boundary remains too broad, use `geo` and `rstar` directly. The host
must continue to supply bounded canonical inputs and persist canonical results;
the engine must not receive OPFS, network, project, or credential authority.

The candidate operation surface is deliberately smaller than Spatio's public
API:

- `gis.index.buildPoints`;
- `gis.query.radius`;
- `gis.query.boundingBox`;
- `gis.query.nearest`;
- `gis.query.pointsInPolygon`; and
- `gis.trajectory.window`, deferred until its use case is approved.

All operations remain registry-controlled, Worker-isolated, bounded by the
effective limits profile, and recorded with engine and algorithm versions in
the receipt. No UI, Epi Assist proposal, project, or `.pgm7` source receives a
raw Spatio handle.

### Scientific and browser validation gate

The spike must run in GitLab CI and a browser validation page; do not generate
native Rust test executables on CDC-managed Windows. It must:

1. compile the selected dependency graph to `wasm32` without server, Python,
   TCP, or native-filesystem dependencies;
2. run in the dedicated GIS Worker with cancellation, timeout, memory, and
   output limits;
3. compare results with a transparent brute-force geodesic reference and
   independently reviewed fixtures;
4. cover duplicate and invalid coordinates, empty input, exact-boundary
   points, ties, longitude wrap/date-line cases, high latitudes, polar limits,
   and large-radius queries;
5. verify that nearest-neighbor ordering is geographically correct rather than
   merely the planar longitude/latitude ordering used to identify candidates;
6. benchmark startup, WASM bytes, peak memory proxy, build time, insert time,
   and query latency at representative field-data sizes;
7. verify deterministic ordering, stable diagnostics, and equivalent results
   across supported browsers; and
8. compare the full Spatio core against a minimal Epi-owned wrapper around
   `geo` and `rstar`.

Adopt Spatio only if the measured implementation is smaller or safer to
maintain than the direct-crate alternative and passes every scientific gate.
Otherwise retain the algorithms and architecture review as evidence and use a
minimal Epi-owned index adapter. Spatio remains a roadmap candidate and does
not expand the four-operation v0.1 registry.

## Foodborne acceptance path

The first end-to-end acceptance case uses the existing foodborne package:

1. Inspect `city-of-toledo-neighborhoods.geojson` and the 96-record coordinate
   dataset without altering either source.
2. Confirm CRS84/WGS 84 roles, 87 polygon features, record-coordinate ranges,
   bounds, and configured resource limits.
3. Validate the neighborhood topology and retain findings in a receipt.
4. Run a reviewed `within` point-in-polygon spatial join from record coordinates
   to neighborhood polygons, retaining record IDs only inside the authorized
   project artifact.
5. Produce a derived join table with one row per source record and explicit
   `matched`, `unmatched`, or `ambiguous` state; never silently choose among
   multiple polygons.
6. Compare the derived neighborhood with the existing neighborhood field and
   report agreement, missing, mismatch, boundary, and exclusion counts.
7. Commit the derived artifact and receipt only after host-side hash and schema
   verification, then render from the committed result.
8. Package, encrypt, reopen offline, replay the same canonical plan, and obtain
   equivalent deterministic content and diagnostics.

No individual coordinates or record IDs appear in aggregate Output or general
command history. Authorized record-level artifacts stay inside the project.

## Worker and lifecycle design

- Lazy-load one dedicated module Worker on the first kernel request; normal app
  startup and non-GIS workflows must not fetch GDAL.
- Use request IDs and structured `accepted`, `progress`, `result`, and `error`
  messages. Progress reports operation phase and bounded counts, not optimistic
  percentages with no denominator.
- Cancellation terminates the active Worker for v0.1, discards all uncommitted
  outputs, and creates a fresh Worker for the next request.
- Apply operation timeout and memory/output budgets in both host and Worker.
- Transfer `ArrayBuffer` ownership. Do not clone large assets into several
  application objects.
- Reuse an initialized Worker sequentially after successful operations. Pooling
  is deferred until measurements demonstrate a bounded benefit on supported
  field hardware.
- A Worker crash returns `GIS_WORKER_CRASH`, leaves project state unchanged,
  and permits one clean user-initiated retry.

## Asset transaction

Processing is a two-phase transaction:

1. **Prepare:** host resolves explicit asset grants, verifies input hashes,
   validates plan/schema/limits, asks the user to review the effective plan, and
   transfers bounded inputs to the Worker.
2. **Commit:** Worker returns bytes and manifests; host recomputes hashes,
   validates result and receipt schemas, writes temporary OPFS objects, then
   atomically adds derived asset metadata, lineage, receipt, and optional layer
   recipe to the project revision.

On rejection, cancellation, failure, digest mismatch, storage exhaustion, or
project revision change, temporary objects are removed and the current project
and map remain unchanged. Source assets are never overwritten.

## Defensive limits profile

The initial `field-default-v0.1` profile must set explicit ceilings for input
bytes, archive entries, expanded bytes and ratio, layers, fields, string length,
features, vertices, rings, output bytes, elapsed time, and Worker memory proxy.
Only reviewed local formats and drivers are enabled. Reject archive traversal,
nested archives, ambient paths, `/vsicurl/` and other network virtual files,
arbitrary SQL, unreviewed creation options, missing/ambiguous CRS where an
operation requires reprojection, and outputs exceeding the declared budget.

Specific numerical defaults should be established by the defensive-input spike
and lowest-supported-device measurements rather than guessed in this contract.
The chosen values are versioned in the limits profile and copied into receipts.

## Error vocabulary

The facade normalizes upstream messages into stable codes such as:

- `GIS_PLAN_INVALID`, `GIS_OPERATION_UNSUPPORTED`, `GIS_OPTION_UNSUPPORTED`;
- `GIS_INPUT_MISSING`, `GIS_INPUT_DIGEST_MISMATCH`, `GIS_FORMAT_UNSUPPORTED`;
- `GIS_ARCHIVE_UNSAFE`, `GIS_LIMIT_EXCEEDED`, `GIS_CRS_UNKNOWN`,
  `GIS_CRS_AMBIGUOUS`, `GIS_GEOMETRY_INVALID`;
- `GIS_CANCELLED`, `GIS_TIMEOUT`, `GIS_WORKER_CRASH`, `GIS_ENGINE_FAILURE`;
- `GIS_OUTPUT_INVALID`, `GIS_OUTPUT_DIGEST_MISMATCH`, and
  `GIS_PROJECT_REVISION_CHANGED`.

Receipts may retain a bounded, sanitized adapter detail for diagnosis, but UI,
tests, and program semantics depend on Epi-owned codes.

## Repository shape

```text
wasm/app/gis/
  contracts.ts
  schemas/
  operation-registry.ts
  canonical-json.ts
  kernel-client.ts
  asset-transaction.ts
  receipts.ts
  layer-plan.ts
  adapters/gdal-adapter.ts
wasm/demo/gis-worker.ts
wasm/tests/fixtures/gis/
  foodborne-neighborhood-join/
  defensive-inputs/
```

The existing `demo/examples/gdal-wasm/` labs remain independent evidence while
their reusable host/Worker behavior is extracted. Production modules must not
import a demo page, and Maps must not import GDAL directly.

## Acceptance gates for v0.1

- Unknown operations and properties fail closed before Worker creation.
- The ordinary application shell does not download or initialize GDAL.
- Inspect is non-mutating and reports limits before expensive processing.
- The foodborne join fixture produces independently reviewed counts and stable
  output/receipt digests across supported browsers.
- Ambiguous and unmatched points remain visible diagnostics; no arbitrary match
  is selected.
- Cancel, timeout, crash, corrupt input, over-limit input, hash mismatch,
  project switch, and OPFS quota failure leave no committed derived artifact.
- Source, derived output, plan, receipt, and layer recipe survive `.epia` and
  encrypted `.epiax` round trips with every digest verified.
- The same committed analytical result can be rendered by current Leaflet and a
  test renderer without changing result content.
- Network-disabled replay works after the application/runtime and project
  assets have been intentionally prepared for offline use.
- Dependency versions, licenses, and self-hosted artifacts pass Pages and
  supply-chain checks.

After these gates pass, v0.1 is a **candidate** kernel. It becomes validated
only when its operation results have independent expected outputs and named
geospatial review; successful execution alone is not validation.

## Explicitly deferred

V0.1 does not include arbitrary GDAL commands, a public SQL escape hatch,
automatic repair, geocoding, live map services, server processing, full raster
processing, spatial statistics, cluster detection, AI-driven execution, or a
production Classic `MAP` command. Those consumers can propose a `GisPlan` only
after their own review and validation contracts exist.
