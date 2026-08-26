# Integrated test examples

These two files exercise the form, data-entry, mapping, labeling, and time-lapse
workflow together. They are copied into the production demo so testers can download
them directly from GitLab Pages.

## Foodborne outbreak investigation

[`foodborne-outbreak-investigation.csv`](foodborne-outbreak-investigation.csv) is a
synthetic line list supplied by the project owner for demonstration and regression
testing. It contains 96 coded records and 27 columns. It contains no names, street
addresses, contact details, or direct personal identifiers. `ID` values such as
`P001` are synthetic record identifiers.

SHA-256: `B6E855C8CC6990ABB4C25C4A1D9EE5DDEA3C0016567BFC30F372FAAA07DF9CF5`

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

## Browser workflow

1. Use **Create Forms > New Project > Create from CSV** and choose the outbreak CSV.
2. Open **Enter Data** to inspect the 96 imported records.
3. Open **Maps** to plot the `Latitude` and `Longitude` fields.
4. Choose **Add Data Layer > GeoJSON Layer** and select the Toledo file.
5. Select `name` as the polygon label field, then test label visibility, zoom,
   Fit Layers, fullscreen, H3 aggregation, and time lapse.

These examples are demonstrations, not algorithm-validation reference data and not
real outbreak surveillance records.
