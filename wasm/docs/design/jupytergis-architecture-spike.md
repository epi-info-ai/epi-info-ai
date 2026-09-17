# JupyterGIS architecture spike

Status: first bounded processing spike implemented; no JupyterGIS adoption or
mapping-parity claim.

## Question

Can Epi Info AI reuse JupyterGIS as the foundation for richer browser GIS
without replacing Epi Info's epidemiologic workflows, project contract, or
offline-first safety boundaries?

## Finding

JupyterGIS is a strong integration candidate, but it is not one drop-in GIS
kernel. It is a BSD-3-Clause monorepo built around JupyterLab, React, OpenLayers,
Yjs-backed `.jGIS` documents, Python APIs, and browser/server processing. Its
JupyterLite distribution runs in the browser through WebAssembly and its
published capabilities include GeoJSON, GeoTIFF/COG, GeoParquet, GeoPackage,
Shapefile, PMTiles, WMS/WMTS, story maps, and GDAL processing.

Those capabilities overlap substantially with the Epi Info AI roadmap. The
current Epi Info AI Maps module, however, uses MapLibre and project-owned
contracts for `.epiax` packaging, OPFS assets, offline provider policy,
geolocation, epidemiologic outputs, and audited command handoffs. Replacing
that foundation wholesale would add JupyterLab/Lumino integration and a second
document model before its value and offline cost are measured.

## Recommended boundary

Keep Epi Info AI as the host and stable public contract. Evaluate JupyterGIS
behind adapters and Workers:

1. Add lossless `.jGIS` import/export and allow a `.jGIS` document plus its
   referenced local assets to be carried in an encrypted `.epiax` package.
2. Spike browser GDAL operations in a dedicated Worker with explicit input,
   output, memory, elapsed-time, cancellation, and provenance contracts.
3. Embed a read-only JupyterGIS map/viewer in a new-branch prototype before
   considering its complete editing workspace.
4. Translate Epi Info map commands and reviewed statistical results into an
   engine-neutral layer plan; implement MapLibre and JupyterGIS adapters against
   that plan rather than coupling the command language to either renderer.
5. Keep Jupyter notebooks and Python APIs optional. Epi Info AI must remain
   usable as a static, offline-capable browser application without a server.

## Architecture spike slices

### JGIS-01 — dependency and license inventory

- Pin a reviewed JupyterGIS release and record its source commit.
- Inventory JavaScript, Python, WASM, font, and sample-data licenses.
- Measure compressed/uncompressed bundle sizes and browser cache impact.
- Produce attribution and modification notices required by BSD-3-Clause and
  transitive dependencies.

### JGIS-02 — document interchange

- Define mappings among `.jGIS`, the Epi Info map-layer plan, and `.epiax`.
- Round-trip vector, raster, style, view, projection, and story-map metadata.
- Reject ambient paths and unresolved remote assets with actionable messages.
- Preserve checksums and distinguish embedded, cached, and remote resources.

### JGIS-03 — browser processing Worker

- Prototype one bounded GDAL operation, such as GeoTIFF reprojection or vector
  format conversion, entirely in the browser.
- Enforce memory and pixel/feature limits before allocation.
- Support progress, cancellation, timeout, deterministic parameters, and an
  auditable processing receipt.

#### Implemented evidence: GDAL-WASM-01 through GDAL-WASM-08

`wasm/demo/examples/gdal-wasm/` now provides an independently runnable browser
spike using the same `gdal3.js` package family currently used by JupyterGIS. It
reprojects a checksummed, synthetic EPSG:3857 GeoJSON fixture to RFC 7946
EPSG:4326 GeoJSON through `ogr2ogr` in an Epi Info-owned dedicated Worker. The
page verifies feature count, output extent, CRS, and hashes, exposes the exact
arguments and engine versions in a processing receipt, and cancels by
terminating the Worker.

Three additional folder-scoped tabs extend the evidence without integrating a
production GIS kernel:

- GDAL-WASM-02 clips, reprojects, bilinearly resamples, tiles, and DEFLATE
  compresses the checksummed Toledo population GeoTIFF at 1024, 2048, or 4096
  square pixels, then creates a PNG preview. The profiles represent roughly 4,
  16, and 64 MiB of raw single-band output before compression.
- GDAL-WASM-03 creates an ESRI Shapefile component set, ZIPs it, destroys the
  first Worker, opens the archive through `/vsizip/` in a fresh Worker, and
  validates a 300- to 30,000-feature GeoJSON normalization.
- GDAL-WASM-04 performs an intentionally unindexed `ST_Intersects` point-in-
  polygon join through GDAL's SQLite dialect. An auditable 100-point probe,
  projected duration, `hardwareConcurrency`, and available `deviceMemory`
  select a pool of 1, 2, or 4 independent Workers. Fixed pool sizes remain
  available for comparison. Each Worker owns separate WASM memory; this is not
  shared-memory GDAL threading.
- GDAL-WASM-05 replicates two known-invalid boundaries and a valid polygon-hole
  control, reports `ST_IsValid`, derives `ST_MakeValid` geometry, and exercises
  `ST_Intersects` with reviewed points in repaired lobes, at an unassigned self-intersection,
  in a detached ring, in a valid hole, on a boundary, and outside. It records
  geometry-type changes and exact assignment mismatches, preserves the source,
  and labels repaired output as a review artifact because technical repair can
  change geographic meaning.
- GDAL-WASM-06 masks the local population surface against six epidemiologic
  zones with `gdalwarp`, calculates Worker-side statistics with `gdalinfo`,
  reports NoData coverage and rates, handles a completely outside zone, and can
  repeat 24 jobs in one Worker session. A separate GeoTIFF reader and cell-
  center point-in-polygon implementation freezes reference population sums;
  the receipt exposes every comparison and tolerance. Raster units remain an
  explicit unverified assumption, so the rates are test outputs rather than
  surveillance estimates.
- GDAL-WASM-07 performs range-aware access to a structurally verified Cloud
  Optimized GeoTIFF, extracts a bounded 256 x 256 study-area window, records
  every HTTP 206 response and transferred byte, stores a checksummed derived
  GeoTIFF in OPFS, and reproduces its GDAL statistics after the automated test
  places the browser in real offline mode. Network/OPFS authority remains in
  the browser adapter; the GDAL Worker receives only the bounded local file.
  The original raster values are not rewritten for display: a separate default
  five-quantile ColorBrewer preview records its positive-value breakpoints and
  class counts in the receipt and must reproduce identically offline.
- GDAL-WASM-08 creates a single GeoPackage containing an epidemiologic point
  layer, study-area polygon layer, and nonspatial metadata table. It terminates
  the writer Worker, reopens the package bytes in a fresh Worker, inventories
  all layers before selection, and exports each explicitly named layer for
  comparison. The receipt verifies stable FIDs, field and geometry types,
  Unicode, nulls, ISO dates, attributes, geometries, counts, and hashes. After
  explicit selection, the tab renders point or polygon GeoJSON in an inline
  SVG and exposes the formatted payload; nonspatial records remain visibly
  geometry-free. Layer inventory and preview metadata expose the GDAL-reported
  CRS, while nonspatial layers report that CRS is not applicable.

The spike deliberately does not import the JupyterLab, React, OpenLayers, Yjs,
or `.jGIS` document layers. An Epi Info typed client instantiates and owns the
upstream `gdal3.js` Worker. Its runtime setting is `useWorker: false` so that
single Worker does not create a nested Worker; the GDAL call therefore remains
off the UI thread. The approximately 40 MB uncompressed WASM/data payload is
isolated beneath this example and must not be treated as an accepted production
bundle cost.

Remaining JGIS-03 work includes enforced timeout and pre-allocation byte,
pixel, feature, geometry, and archive-nesting limits; hostile/corrupt inputs;
GeoPackage input; browser-memory measurements; storage-eviction behavior; and
cross-browser field testing. Those remain go/no-go gates rather than implied
capabilities.

#### Epi Info GIS-kernel readiness scorecard

The relevant denominator is ten Epi Info browser-GIS capability families, not
every driver and operation in the much larger GDAL project. Seven are now
demonstrated with deterministic fixtures and browser acceptance tests:

| Capability family | Evidence | Status |
|---|---|---|
| CRS transformation | GDAL-WASM-01 | Demonstrated |
| Raster warp, clip, resample, and preview | GDAL-WASM-02 | Demonstrated |
| Multi-file vector archive import/export | GDAL-WASM-03 | Demonstrated |
| Spatial join and calibrated Worker pool | GDAL-WASM-04 | Demonstrated |
| Topology validation, repair, and reviewed overlay | GDAL-WASM-05 | Demonstrated |
| Raster-vector zonal statistics | GDAL-WASM-06 | Demonstrated |
| COG range access, OPFS persistence, and offline replay | GDAL-WASM-07 | Demonstrated |
| Multi-layer GeoPackage round trip | GDAL-WASM-08 | Demonstrated |
| Defensive limits and hostile/corrupt inputs | Planned | Pending |
| Multidimensional scientific rasters, including NetCDF | Driver investigation required | Pending |

This is **8 of 10 families (80%)**. The agreed readiness threshold has been
met, so a deliberately narrow Epi Info GIS-kernel scaffold can begin while the
defensive-input and multidimensional-raster gates continue in parallel.
NetCDF is an independent format; GDAL support depends on compiling its NetCDF
driver and dependencies into the WASM bundle. The current `gdal3.js` bundle has
not demonstrated that driver, so NetCDF must not be advertised yet.

The current bundle advertises a Zarr raster driver, making chunked
multidimensional Zarr a viable future validation slice. It does not advertise
the Arrow/Parquet vector driver, so GeoParquet requires a custom GDAL/WASM build
or a separately governed browser Arrow/Parquet engine and must not be claimed
as a current GDAL/WASM capability.

### JGIS-04 — embedded viewer

- Render the foodborne and cluster examples through a JupyterGIS adapter.
- Verify keyboard access, tooltips, story tour, static export, offline PMTiles,
  and OPFS restoration.
- Compare output and interaction behavior with the existing MapLibre adapter.

### JGIS-05 — JupyterLite bridge

- Open a packaged `.jGIS` example from the existing validation lab.
- Demonstrate that notebook computation can update a map document without
  sending project records to a server.
- Clearly disclose that JupyterLite does not currently provide JupyterGIS
  real-time collaboration.

## Go/no-go gates

Adoption beyond the spike requires all of the following:

- static GitLab Pages and GitHub Pages builds remain supported;
- offline startup and packaged maps work after network removal;
- `.epiax` encryption and integrity checks cover every included GIS artifact;
- content-security policy does not require unsafe script execution;
- large raster operations fail safely and remain cancellable;
- no project record values are transmitted without an explicit reviewed action;
- accessibility and browser tests cover the integrated workflows;
- renderer output is validated independently for epidemiologic demonstrations;
- bundle/storage cost is measured and accepted rather than hidden.

## Decision

Defer broader integration until the current command-parity and record-linkage
work reaches its planned checkpoint. At that point, continue JGIS-01 and
JGIS-02 using GDAL-WASM-01 as measured evidence rather than a production
dependency decision.
Do not describe JupyterGIS as the Epi Info AI GIS kernel unless the adapter and
processing spikes demonstrate that its separable components can satisfy these
contracts.

## Upstream references

- [JupyterGIS repository](https://github.com/geojupyter/jupytergis)
- [JupyterGIS architecture](https://jupytergis.readthedocs.io/en/latest/about/index.html)
- [JupyterGIS JupyterLite deployment](https://github.com/geojupyter/jupytergis#deploying-with-jupyterlite)
