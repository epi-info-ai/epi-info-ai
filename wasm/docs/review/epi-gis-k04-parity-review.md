# Epi-GIS K04 parity review

Status: browser candidate; experienced-user sign-off required.

## Review scope

K04 covers importing a reviewed Shapefile ZIP or GeoPackage reference layer,
requiring an explicit CRS decision, selecting one GeoPackage layer, converting
the selected vector layer to CRS84 GeoJSON, preserving source/derived lineage,
and reopening the result from a portable project package.

## Evidence recorded

| Concern | Evidence | Disposition |
| --- | --- | --- |
| Shapefile bundle completeness | Engine-free ZIP preflight and installed-Chrome normalization test | Browser candidate |
| GeoPackage ambiguity | GDAL-generated three-layer fixture requires explicit `case_sites` selection | Adapted browser workflow |
| CRS policy | CRS84/EPSG:4326 accepted; EPSG:3857 disclosed as reprojection; unknown rejected | Browser candidate |
| Source integrity | SHA-256, byte length, package header, OPFS, and `.epia` round-trip checks | Browser candidate |
| Derived output | Fixed GDAL adapter, CRS84 GeoJSON validation, exact three-record control comparison | Browser candidate |
| Legacy Epi-Map mental model | Add Reference Layer, explicit source review, visible diagnostics, no implicit layer choice | Requires experienced-user review |

## Known adaptation

The browser workflow makes file selection, CRS review, GeoPackage layer choice,
Worker execution, and project persistence explicit. These controls preserve the
source/derived distinction and prevent an ambiguous database from being opened
implicitly. This is an intentional browser adaptation, not a claim of exact
desktop Epi-Map dialog parity.

## Sign-off required

An experienced Epi-Map/Epi Info user must review the workflow against the
Windows Epi-Map reference and record one of `agrees`, `agrees-with-adaptation`,
or `needs-change`, with notes and date. Until that review is recorded, K04 must
remain `candidate`.
