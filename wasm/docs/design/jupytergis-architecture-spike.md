# JupyterGIS architecture spike

Status: deferred architecture candidate; no runtime dependency or parity claim.

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

Defer implementation until the current command-parity and record-linkage work
reaches its planned checkpoint. At that point, start with JGIS-01 and JGIS-02.
Do not describe JupyterGIS as the Epi Info AI GIS kernel unless the adapter and
processing spikes demonstrate that its separable components can satisfy these
contracts.

## Upstream references

- [JupyterGIS repository](https://github.com/geojupyter/jupytergis)
- [JupyterGIS architecture](https://jupytergis.readthedocs.io/en/latest/about/index.html)
- [JupyterGIS JupyterLite deployment](https://github.com/geojupyter/jupytergis#deploying-with-jupyterlite)
