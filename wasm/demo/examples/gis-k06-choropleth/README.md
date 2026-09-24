# GIS-K06 Choropleth teaching fixture

This fixture exercises the K06 typed Choropleth contract and key-join path.

- `county-boundaries.geojson` contains four simple polygon features.
- `county-values.csv` contains matched rows, a filtered row, an unmatched key,
  a missing key, and a duplicate boundary-key case used by the smoke test.

The intended teaching sequence is:

1. Import the CSV as a form or data source.
2. Inspect the boundary `GEOID` field and data `county_fips` field.
3. Use `case_rate` as the numeric value and `status` as an optional filter.
4. Compare manual breaks `10,25` with equal-interval and quantile classes.
5. Review unmatched, missing, duplicate, and invalid-value diagnostics before
   treating a rendered class as an epidemiologic result.

This is a synthetic evaluation fixture. It is not surveillance data and does
not establish legacy desktop parity by itself.
