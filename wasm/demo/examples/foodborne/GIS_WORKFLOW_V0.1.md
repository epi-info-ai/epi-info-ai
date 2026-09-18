# Foodborne GIS workflow v0.1

This teaching workflow makes the emerging Epi Info AI GIS model concrete using
one investigation. It deliberately separates what the application demonstrates
now from what the first `epi-gis` production kernel must add.

## Investigation question

Where did the 96 synthetic foodborne illness reports occur, what geographic and
population context surrounds them, and what broad spatial pattern is visible?

The map helps investigate these questions. Visual proximity is not evidence of
exposure, transmission, statistical significance, or causation.

## Assets and their roles

| Asset | GIS role | Authority and limitation |
|---|---|---|
| Foodborne line list | Authoritative investigation records | `Latitude` and `Longitude` are explicit signed WGS 84 roles with at least five decimal places. |
| Toledo neighborhoods GeoJSON | Reference geography | 87 named polygons. A polygon does not become a record attribute without a reviewed spatial join. |
| WorldPop-derived GeoTIFF | Context raster | Useful for visual context. Dataset identifier, vintage, population concept, and units remain incomplete, so it is not yet a valid denominator. |
| Case Cluster layer | Point representation | A view of valid record coordinates with record linkback; it does not copy or replace source records. |
| H3 layer | Derived aggregate representation | Summarizes the current point layer at a declared resolution. It must remain distinguishable from raw records. |
| Map document | Investigation state | Preserves asset references, layer visibility, ordering, opacity, labels, and extent in the project package. |

## Runnable walkthrough

1. Import the complete Foodborne Outbreak Investigation example project.
2. Open **Help > Run Books** and select **Foodborne GIS investigation v0.1**.
3. Inspect the packaged neighborhood and population-raster layers.
4. Add a Case Cluster layer by explicitly binding `Latitude`, `Longitude`, and a
   display field.
5. Review the mapped and skipped-record counts, fit the layer extent, and retain
   source-record linkback.
6. Add an H3 layer and review the displayed relationship between resolution,
   average edge length, and area.
7. Compare the point, H3, boundary, and raster layers without treating any
   visual association as an analytical conclusion.

## Evidence produced today

- The project package carries the records, map assets, runbooks, asset digests,
  and layer state together.
- Map assets remain local to the browser and are restored through the project
  asset contract.
- Coordinate binding is explicit and invalid WGS 84 rows are skipped.
- Raw points, H3 aggregates, reference polygons, and raster context remain
  separate layer types.
- Visibility, labels, opacity, extent, and order are presentation state rather
  than mutations of the source line list.

## Evidence the production kernel must add

- preflight dataset inspection and explicit CRS confidence;
- canonical, reviewed `GisPlan` requests before processing;
- immutable derived artifacts for reprojection, repair, join, aggregation, and
  raster operations;
- processing receipts with input/output hashes, versions, effective parameters,
  warnings, exclusions, elapsed time, and validation status;
- deterministic record-to-neighborhood spatial-join diagnostics;
- denominator provenance and NoData/coverage disclosures before population
  values support epidemiologic rates; and
- replay and comparison tests independent of the renderer.

This boundary prevents the example from overstating unfinished GDAL/WASM
integration while giving the kernel an acceptance case grounded in a real Epi
Info workflow.
