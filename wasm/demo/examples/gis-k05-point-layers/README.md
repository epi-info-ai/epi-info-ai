# GIS-K05 point-layer teaching fixture

This small uploadable CSV supports the Spot Map and visual Case Cluster
parity workflow. It intentionally includes valid points, a nearby pair for
Case Cluster aggregation, a missing coordinate, an out-of-range coordinate,
and a control row for filter review.

Teaching path:

1. Open Form Designer and import `gis-k05-point-layer.csv` with rows.
2. Open Maps → Add Data Layer → Spot Map.
3. Select `Latitude`, `Longitude`, and `Description`; filter `Status` to
   `Case`; choose a marker style and color.
4. Review the skipped-row diagnostics in Map Layers.
5. Edit the point layer, then use Case Cluster and zoom in/out around the
   first two case points.

The fixture contains synthetic values only. It is not an epidemiologic
dataset and does not claim desktop Epi Map differential parity by itself.
