# Foodborne outbreak investigation example

This is the canonical integrated demonstration. Its synthetic line list,
Classic Analysis programs, neighborhood boundaries, and population-density
raster belong to one outbreak-investigation workflow.

## Data

- [`foodborne-outbreak-investigation.csv`](foodborne-outbreak-investigation.csv)
  contains 96 synthetic coded records and 27 columns. It contains no names,
  addresses, contact details, or direct personal identifiers. SHA-256:
  `b6e855c8cc6990abb4c25c4a1d9ee5ddea3c0016567bfc30f372faaa07df9cf5`.
- [`foodborne-outbreak-investigation.xlsx`](foodborne-outbreak-investigation.xlsx)
  contains the same 96 records and is the native Excel import fixture.
  SHA-256:
  `ed94c4201abd251304db8b3fddf3c8733bbc46d46bbbcb0f115b7804c6740b9d`.

## Program Editor exercises

- [`foodborne-outbreak-investigation.programs.json`](foodborne-outbreak-investigation.programs.json)
  is the versioned, dataset-bound catalog loaded by the Program Editor.
- [`foodborne-age-groups-by-sex.pgm`](foodborne-age-groups-by-sex.pgm) is the
  small runnable `DEFINE -> RECODE -> FREQ` exercise.
- [`foodborne-classic-command-tour.pgm7`](foodborne-classic-command-tour.pgm7)
  composes the currently bounded Classic Analysis paths in source order. It is
  an acceptance target, not a claim that every command has desktop parity.
- [`foodborne-dialog-tour.pgm7`](foodborne-dialog-tour.pgm7) exercises the
  interactive `DIALOG` variants and downloads a separate CSV copy with `WRITE`.

## Maps used by this investigation

- [`maps/city-of-toledo-neighborhoods.geojson`](maps/city-of-toledo-neighborhoods.geojson)
  contains 87 named `MultiPolygon` features in CRS84. It was supplied by the
  project owner from the City of Toledo GIS Neighborhoods layer. SHA-256:
  `c557159ea94def64612731542ede3ec70362cc3c4af2e99e2dafc7d264aa97b1`.
- [`maps/worldpop-toledo-population-density.tif`](maps/worldpop-toledo-population-density.tif)
  is a 365 by 207 pixel, single-band WorldPop-derived WGS 84 GeoTIFF clip.
  Its upstream dataset identifier, vintage, and formal citation still need to
  be recorded before use outside project testing. SHA-256:
  `cf7ec32de75d9b782a141e0e8e361216d9c74a71b467486aaa4f0c1782060df1`.

## Demo workflow

1. Import the complete checksummed foodborne `.epia` package from
   **File > Import Example Project**. The same download carries both map assets.
2. Inspect the 96 records in Enter Data.
3. Open the Program Editor and choose a dataset-bound example or upload a tour.
4. Plot `Latitude` and `Longitude` in Maps.
5. Confirm the restored Toledo neighborhood layer has `name` labels enabled.
6. Confirm the restored WorldPop GeoTIFF remains below vectors and points.

The map assets are supporting artifacts for this foodborne example, not a
separate epidemiologic dataset. The generator embeds their bytes, metadata,
and digests in
[`../projects/foodborne-outbreak-investigation.epia`](../projects/foodborne-outbreak-investigation.epia);
import validates them before restoring their OPFS copies and project layers.
