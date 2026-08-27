# Integrated test examples

These five files exercise project migration, form, data-entry, mapping, labeling, and time-lapse
workflow together. They are copied into the production demo so testers can download
them directly from GitLab Pages.

## Official Epi Info Sample project

[`sample-project.epia.json`](sample-project.epia.json) is a reproducible,
browser-native conversion of the Community Edition `Sample.mdb`. It preserves 18
forms, 26 pages, 417 legacy fields, 22 code tables, and the saved `Statistics`
Classic Analysis program. Use **File > Open Project...** to load it. The current
UI renders its supported field projection and records; complete legacy metadata
and unsupported-command findings remain in the package for compatibility work.

The source database is part of the tracked legacy source tree. Regeneration and
format details are documented in
[`project-package-v2.md`](../../docs/design/project-package-v2.md).

SHA-256: `E23DDA745FF351B153158ECB920785933AAF077355CBBCAD9AA8E84E54CD693B`

## Foodborne outbreak investigation

[`foodborne-outbreak-investigation.csv`](foodborne-outbreak-investigation.csv) is a
synthetic line list supplied by the project owner for demonstration and regression
testing. It contains 96 coded records and 27 columns. It contains no names, street
addresses, contact details, or direct personal identifiers. `ID` values such as
`P001` are synthetic record identifiers.

SHA-256: `B6E855C8CC6990ABB4C25C4A1D9EE5DDEA3C0016567BFC30F372FAAA07DF9CF5`

[`foodborne-outbreak-investigation.xlsx`](foodborne-outbreak-investigation.xlsx)
contains the same 96 synthetic records and 27 columns as the CSV fixture. It is
the browser and CI regression fixture for native Excel `.xlsx` parsing.

SHA-256: `ED94C4201ABD251304DB8B3FDDF3C8733BBC46D46BBBCB0F115B7804C6740B9D`

## City of Toledo neighborhoods

[`city-of-toledo-neighborhoods.geojson`](city-of-toledo-neighborhoods.geojson) is a
public GIS-style boundary export supplied by the project owner. It contains 87
named `MultiPolygon` features in GeoJSON CRS84 longitude/latitude coordinates. The
authoritative public service is the City of Toledo GIS
[`Neighborhoods` layer](https://gis.toledo.oh.gov/arcgis/rest/services/Public_Application_Services/Neighbohoods_and_Housing/MapServer/0),
which identifies `name` as its display field and supports GeoJSON queries. The
service currently publishes no copyright text; retain this attribution and verify
applicable source terms before using the data outside project testing.

SHA-256: `C557159EA94DEF64612731542EDE3EC70362CC3C4AF2E99E2DAFC7D264AA97B1`

## WorldPop Toledo population-density clip

[`worldpop-toledo-population-density.tif`](worldpop-toledo-population-density.tif)
is a WorldPop-derived GeoTIFF clip supplied by the project owner to accompany the
outbreak points and Toledo neighborhood polygons. It is a 365 by 207 pixel,
single-band `float32` GeoTIFF in WGS 84 (`EPSG:4326`) with approximately
0.000833333-degree pixels and nodata value `-99999`. Its approximate bounds are
longitude -83.6950 to -83.3908 and latitude 41.5808 to 41.7533.

WorldPop's general data policy permits redistribution with attribution under CC BY
4.0, while some datasets derived from OpenStreetMap or Microsoft sources use ODbL.
The exact upstream WorldPop dataset identifier, vintage, variable definition, and
suggested citation were not included with this clip and must be recorded before it
is used outside project testing. Source and licensing guidance:
[`WorldPop FAQ`](https://www.worldpop.org/faq/).

SHA-256: `CF7EC32DE75D9B782A141E0E8E361216D9C74A71B467486AAA4F0C1782060DF1`

## Browser workflow

1. Use **Create Forms > New Project > Create from Data File** and choose either
   the outbreak CSV or Excel workbook.
2. Open **Enter Data** to inspect the 96 imported records.
3. Open **Maps** to plot the `Latitude` and `Longitude` fields.
4. Choose **Add Data Layer > GeoJSON Layer** and select the Toledo file.
5. Select `name` as the polygon label field, then test label visibility, zoom,
   Fit Layers, fullscreen, H3 aggregation, and time lapse.
6. Choose **Add Data Layer > GeoTIFF Raster**, select the WorldPop fixture,
   adjust its opacity, and confirm that the raster remains beneath polygons,
   lines, and points. The bounded demo accepts local WGS 84 GeoTIFFs; projected
   rasters and general reprojection remain tracked gaps under `LEGACY-MAPS-015`.

These examples are demonstrations, not algorithm-validation reference data and not
real outbreak surveillance records.
