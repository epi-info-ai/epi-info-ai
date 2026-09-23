# GIS defensive-ingestion test package

These small files are uploadable test assets for the GIS-K03 preflight slice.
They are intentionally synthetic and contain no public-health records.

The expected behavior is recorded in ingestion-test-package.json. The package
distinguishes automatic rejection from cases that are valid bytes but require
user review. Swapped latitude/longitude and incorrect geographic signs cannot
be inferred from a coordinate pair alone; they require an explicit field
binding, expected study area, or reviewed CRS/axis-order declaration.

| Asset | Expected result | Purpose |
|---|---|---|
| valid-control.geojson | accept | Valid WGS 84 point control |
| misformatted.csv | reject as unsupported media | Malformed CSV with an unclosed quoted field |
| corrupt-geojson.geojson | reject | Invalid JSON/GeoJSON bytes |
| swapped-latitude-longitude.geojson | accept with review | Both axes are numerically valid, but intended axis order is reversed |
| incorrect-coordinate-sign.geojson | accept with review | Both values are numerically valid, but expected regional sign is wrong |
| out-of-range-coordinate.geojson | reject | Longitude exceeds the WGS 84 range |
| non-finite-coordinate.geojson | reject | JSON number becomes non-finite during parsing |
| too-many-features.geojson | reject under package limits | Feature-count budget is one |
| deeply-nested-geometry.geojson | reject under package limits | Nesting-depth budget is eight |
| property-limit.geojson | reject under package limits | Property-count budget is twenty |

The CSV cases are deliberately not treated as GeoJSON. CSV coordinate-field
binding belongs to the later Spot Map/Case Cluster parity slice, where field
roles, latitude/longitude order, signs, missing rows, and study-area review can
be represented explicitly.
