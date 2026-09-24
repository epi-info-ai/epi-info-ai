# Environmental Epidemiology teaching-project plan

Status: first bounded demonstration candidate generated; provider access and exposure assignment remain planned

## Relationship to the provider spike

This example is the acceptance harness for the Environmental Epidemiology
provider-access spike. The package-level contracts are authoritative for
provider behavior. This project supplies only safe teaching inputs and expected
observable outcomes.

## Implemented first scenario

The bundled demonstration separates two imports:

1. an inert Environmental Epidemiology capability package containing only a
   disabled provider catalogue, validation assertions, and documentation; and
2. a portable teaching project containing twelve synthetic heat-health
   observations, a saved descriptive program, a learner-run runbook, and a
   packaged point layer.

The GIS Kernel Lab runs `gis.dataset.inspect` against the synthetic GeoJSON in
a bounded Worker and shows the effective limits, aggregate output, and receipt.
The Maps module renders the project point layer. K09 advanced spatial
statistics, provider retrieval, exposure assignment, and causal analysis are
not part of this candidate.

## Provider-access follow-on

Use a synthetic set of health-event dates and a non-identifying study envelope
to compare three environmental asset paths:

| Provider | Teaching asset | First workflow boundary |
|---|---|---|
| CDC Tracking | one bounded aggregate environmental measure | catalogue, retrieval-plan review, tabular inspection |
| NOAA/NCEI | station metadata and a short daily weather series | station selection, token disclosure, units/time inspection |
| Copernicus C3S | C3S Atlas collection metadata plus a small reviewed or synthetic gridded fixture | terms/job planning and `epi-gis` raster inspection boundary |

The three assets are deliberately not presented as interchangeable exposure
estimates.

## Runbook outline

1. Open the imported Environmental Epidemiology project.
2. Review the synthetic event schema and study-area definition.
3. Open Environmental Assets and choose a provider.
4. Inspect the discovered dataset, version, licence, coverage, and variable.
5. Construct a bounded retrieval plan.
6. Verify that no person-level fields appear in the egress summary.
7. Use an offline fixture or explicitly authorize a live metadata/retrieval
   action when that slice becomes available.
8. Inspect the staged asset and its provenance receipt.
9. Review the proposed GIS/data operation and effective limits.
10. Add the asset to the project only after inspection succeeds.
11. Compare measured, modeled, reanalysis, projection, and aggregate-indicator
    meanings.
12. Export the project and verify that the permitted fixture, plan, and receipts
    reopen offline with matching hashes.

The runbook observes and verifies learner actions; it does not perform them.

## Required evidence before catalog publication

- project source and generated `.epia` validate under Project Package V2;
- every asset is declared with byte length, media type, SHA-256, source,
  licence, and privacy classification;
- all records are synthetic and all provider fixtures are approved for
  redistribution;
- expected provider-candidate normalization and asset-inspection results are
  independently reviewed;
- program source parses and either runs completely or is visibly labeled as a
  non-runnable future command tour;
- the runbook completes only after the learner performs each substantive step;
- import clears stale outputs and never executes, fetches, or mutates
  automatically;
- offline reopen produces matching fixture and receipt hashes;
- keyboard, screen-reader, zoom/reflow, and narrow-viewport tests pass;
- Chromium, Firefox, and WebKit CI pass; and
- environmental epidemiology, GIS, privacy/security, accessibility, and data
  owner reviewers are recorded.

## Promotion sequence

1. Planning scaffold — current.
2. Synthetic project schema and study-area fixture.
3. Recorded provider metadata fixtures and expected normalized candidates.
4. Provider-plan review UI and runbook.
5. Data/GIS inspection handoff using offline fixtures.
6. Optional live metadata smoke tests outside deterministic CI.
7. Small authorized retrievals after credential, terms, CORS/relay, and quota
   decisions.
8. Generated `.epia`, catalog registration, import/offline tests, and teaching
   review.
9. Exposure-assignment lesson as a later, separately validated increment.
