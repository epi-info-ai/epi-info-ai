# GDAL/WASM browser-kernel spike

Status: isolated new-branch architecture example; not integrated GIS parity and
not an approved production processing engine.

Open `examples/gdal-wasm/reprojection/index.html` from the built static site.
The tabbed mini-lab keeps each workload and its evidence in a separate folder:

| Tab/folder | Browser GIS workload | Validation |
|---|---|---|
| [`reprojection/`](reprojection/) | Checksummed three-point EPSG:3857 GeoJSON to RFC 7946 EPSG:4326 through `ogr2ogr` | Input digest, feature count, CRS, bounds, and output digest |
| [`raster/`](raster/) | WorldPop-derived GeoTIFF clip, EPSG:3857 warp, bilinear resampling, tiled DEFLATE output, and PNG preview | Source digest and metadata, selected dimensions, projected bounds, CRS, GeoTIFF/PNG digests, and elapsed time |
| [`shapefile/`](shapefile/) | Generate 300–30,000 points, export the Shapefile component set, ZIP it, restart the Worker, reopen through `/vsizip/`, and normalize to GeoJSON | Required components, entry digests, feature count, geometry type, archive/output digests, and elapsed time |
| [`spatial-join/`](spatial-join/) | Join 100–5,000 deterministic points to a 100-zone polygon grid with an intentionally unindexed SQLite-dialect `ST_Intersects` workload (10,000–500,000 candidate predicates); an auditable calibration probe selects 1, 2, or 4 independent Workers from measured cost plus browser CPU/memory caps | Exact cardinality, unique point IDs, represented zones, per-zone counts, hashes, SQL, calibration inputs/decision, per-Worker timing, and total elapsed time |
| [`dirty-boundaries/`](dirty-boundaries/) | Inspect and repair replicated self-intersections and holes outside their shells with GEOS, then overlay points covering lobes, intersections, detached rings, valid holes, boundaries, envelope false positives, and outside locations | Source-validity counts, geometry-type changes, exact reviewed point assignments, mismatches, SQL, output hashes, and elapsed time |
| [`zonal-statistics/`](zonal-statistics/) | Mask a WorldPop-derived population surface by rectangles, a polygon hole, an irregular zone, partial coverage, and an outside-raster zone; calculate coverage-aware denominators and rates; optionally repeat four passes | Source digests, mask/statistics parameters, independent GeoTIFF cell-center reference comparisons, NoData and outside handling, repeatability delta, CSV digest, and elapsed time |
| [`cog-offline/`](cog-offline/) | Read a 256 x 256 window from a 9.57 MB Cloud Optimized GeoTIFF using HTTP byte ranges, preserve its original values, render a default five-quantile ColorBrewer preview, persist the checksummed derived GeoTIFF in OPFS, and replay it with the browser genuinely offline | COG layout metadata, HTTP 206 range log, transferred-byte reduction, source/window hashes, GDAL statistics, quantile breaks and counts, OPFS integrity, and zero source requests during offline replay |
| [`geopackage/`](geopackage/) | Write points, polygons, and a nonspatial metadata table into one GeoPackage; destroy the writer; reopen in a fresh Worker; inventory layers before explicit export | Package and layer hashes, discovered names, geometry and field types, stable FIDs, Unicode/null/date values, feature counts, geometries, exact GDAL arguments, and elapsed time |

The dirty-boundary tab renders the representative source and repair side by
side at a shared scale, with keyboard-focusable boundary and point tooltips.
The selected replication profile still controls the full measured workload;
the visual comparison deliberately remains legible rather than drawing every
replicated feature.

The zonal-statistics tab treats raster values as population units only for the
architecture test because the fixture does not carry authoritative semantic
metadata. Production use must require confirmation of year, population concept,
units, CRS, resolution, and fitness for the study. Its frozen validation values
come from `wasm/tests/reference/zonal-statistics-reference.mjs`, which reads the
GeoTIFF independently of GDAL and applies a separate cell-center point-in-
polygon implementation.

The GeoPackage tab deliberately refuses to choose among multiple layers. It
discovers the complete inventory first and requires an explicit layer name.
Because RFC 7946 GeoJSON does not automatically emit OGR feature identifiers,
the reviewed export projects `fid AS _gpkg_fid` and verifies those identifiers
along with the attributes and geometry. Selecting a discovered output renders
its exported GeoJSON inline: spatial layers receive a keyboard-focusable SVG
preview and every layer, including the nonspatial table, exposes formatted
GeoJSON without inventing geometry. The inventory and preview metadata report
GDAL's layer CRS; nonspatial tables explicitly report `Not applicable` instead
of inheriting an unrelated spatial reference.

## Separation of concerns demonstrated

- The page owns user intent, progress, cancellation, validation, and download.
- A typed Epi Info client owns one dedicated upstream GDAL Worker; GDAL
  initialization and deterministic processing stay off the UI thread.
- GDAL/PROJ/GEOS assets are vendored into the static build; the operation does
  not call a processing service or transmit the fixture.
- Only the bounded input, GDAL handles, and result bytes cross the typed Worker
  RPC boundary.
- The processing receipt records engine versions, parameters, hashes, CRS,
  feature count, bounds, warnings, byte counts, and elapsed time.
- Cancelling terminates the Worker. No partially processed output is accepted.

The raster profiles allocate approximately 4, 16, or 64 MiB of raw single-band
output before compression. The Shapefile profiles exercise multi-file output,
ZIP packaging, GDAL virtual file-system input, and sequential Worker teardown.
These are reproducible architecture probes, not permission to accept arbitrary
files without the byte, feature, geometry, nesting, and timeout limits still
listed below.

The dirty-boundary fixture deliberately demonstrates that a technically valid
repair can change meaning: GEOS turns the ring outside its shell into a detached
polygon, while the bow-tie's exact self-intersection node is unassigned by the
reviewed overlay. Epi Info therefore preserves the source, labels the repair as
a derived artifact, and requires review rather than silently treating repair as
truth.

## Runtime and provenance

JupyterGIS 0.16.3 depends on `gdal3.js` `^2.8.1`. Its current helper initializes
that package with `useWorker: false`; this Epi Info AI example instead controls
the package's dedicated Worker through a typed client so UI responsiveness,
cancellation, and authority remain under the application contract.

`gdal3.js` is LGPL-2.1-or-later and reports compiled GDAL 3.8.4, PROJ 9.3.1,
and GEOS 3.12.1 components. Any production adoption requires the dependency and
license inventory in `wasm/docs/design/jupytergis-architecture-spike.md`,
including corresponding-source/relinking obligations and transitive notices.

Upstream references:

- <https://github.com/geojupyter/jupytergis/blob/main/packages/base/src/gdal.ts>
- <https://github.com/bugra9/gdal3.js/tree/v2.8.1>
- <https://gdal.org/programs/ogr2ogr.html>
- <https://gdal.org/programs/gdalwarp.html>

## Go/no-go evidence still required

- measure first and cached load time, peak Worker memory, and browser failures;
- repeat the demonstrated OPFS replay across supported managed Chrome and Edge
  versions and test browser-storage eviction behavior;
- add hard byte, feature, coordinate, nesting, time, and memory limits;
- promote the demonstrated source/window digests and OPFS persistence into
  project-owned GIS receipts;
- test cancellation during a materially longer operation;
- test Chrome/Edge and browser-storage eviction behavior on managed devices;
- complete security, accessibility, and license review; and
- independently compare transformed control points with another GDAL build.
