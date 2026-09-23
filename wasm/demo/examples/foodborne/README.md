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

## Check Code exercise

- [`foodborne-check-code-tour.chk`](foodborne-check-code-tour.chk) is the
  form-bound, event-driven Check Code tour. It is deliberately separate from
  Classic Analysis programs and demonstrates definitions, Form/Page/Record/
  Field events, type-aware compound `IF/ELSE` expressions, `ASSIGN`, `CLEAR`, field state, yellow
  `HIGHLIGHT`/`UNHIGHLIGHT`, same-form field `GOTO`, a titled typed
  Yes/No `DIALOG` response, and a bounded `AUTOSEARCH` preview for an existing
  ID. The search shows reviewed fields without replacing the learner's current
  draft. Its age rule visibly flags values outside 0–120;
  its null-aware onset rule demonstrates parentheses, `NOT`, `OR`, and `(.)`.
  The packaged form assigns fields to EntryPage, Clinical, and ExposureLocation.
  The tour demonstrates both a cross-page field `GOTO` and explicit
  legacy `GOTOPAGE ExposureLocation`; only the active page receives its Page
  Before/After events. The same source is retained as a reviewable `check-code`
  project program and as the active form program.
- [`foodborne-check-code-expressions.chk`](foodborne-check-code-expressions.chk)
  exercises bounded arithmetic and concatenation plus `ABS`, `ROUND`, `STRLEN`,
  `SUBSTRING`, `UPPERCASE`, `TXTTONUM`, and ISO-date `YEAR` without evaluating
  generated JavaScript.

- [`foodborne-check-code.runbook.json`](foodborne-check-code.runbook.json)
  guides a learner through reviewing and verifying the source, applying it,
  and triggering its visible behavior in Enter Data. The packaged foodborne
  project carries both the source and this runbook.
- [`foodborne-database-dialog-tour.chk`](foodborne-database-dialog-tour.chk)
  is an optional focused tour for browser-adapted `DBVARIABLES`, `DBVALUES`,
  `DBVIEWS`, and `DATABASES`. It lists the active schema, bounded distinct
  values, registered project forms, and the active project store without
  permitting arbitrary SQL or filesystem discovery.

## Form Designer lab

- [`foodborne-form-designer.runbook.json`](foodborne-form-designer.runbook.json)
  is a learner-executed lab available from **Help > Automated Runbooks** after
  importing this project. The learner adds a typed field, configures a
  type-appropriate validation pattern, saves the form, inspects the separate
  Check Code boundary, and tests the field in Enter Data.
- Selected steps include bounded completion checks over visible control state.
  The host reports verified/incomplete feedback and emits only the runbook ID,
  step ID, outcome, and check kinds. It does not record field values, patient
  data, or arbitrary screen telemetry. Reimporting the teaching project resets
  the browser working copy.

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

The learner-facing [`GIS_WORKFLOW_V0.1.md`](GIS_WORKFLOW_V0.1.md) explains the
role, authority, and limitations of each asset. The packaged
[`foodborne-gis-investigation.runbook.json`](foodborne-gis-investigation.runbook.json)
walks through the workflow in the live Maps interface while clearly separating
current behavior from the planned `epi-gis` processing and receipt boundary.

## Demo workflow

1. Import the complete checksummed foodborne `.epia` package from
   **File > Import Example Project**. The same download carries both map assets.
2. Inspect the 96 records in Enter Data.
3. Open the Program Editor and choose a dataset-bound example or upload a tour.
4. Plot `Latitude` and `Longitude` in Maps.
5. Confirm the restored Toledo neighborhood layer has `name` labels enabled.
6. Confirm the restored WorldPop GeoTIFF remains below vectors and points.
7. Open **Help > Run Books > Foodborne GIS investigation v0.1** to compare raw
   points, an H3 summary, neighborhood context, and raster context.

The map assets are supporting artifacts for this foodborne example, not a
separate epidemiologic dataset. The generator embeds their bytes, metadata,
and digests in
[`../projects/foodborne-outbreak-investigation.epia`](../projects/foodborne-outbreak-investigation.epia);
import validates them before restoring their OPFS copies and project layers.
