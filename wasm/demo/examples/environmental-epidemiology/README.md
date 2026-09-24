# Environmental Epidemiology teaching project

Status: **bounded demonstration candidate in the bundled capability-package and example-project catalogs**

This folder will become the Epi Info AI teaching and evaluation project for the
Environmental Epidemiology capability. It is separate from the governed
capability-package repository:

- the package repository defines provider, exposure, provenance, validation,
  and host-capability contracts; and
- this example project gives learners a bounded dataset, programs, assets,
  expected results, and a runbook that exercises an approved capability.

The first implemented lesson uses twelve synthetic heat-health observations to
show the separation between an inert capability package, an importable teaching
project, descriptive Epi Info analysis, the emerging `epi-gis` Worker boundary,
and map presentation. Provider catalogue entries for CDC Environmental Public
Health Tracking, NOAA/NCEI, and Copernicus C3S remain disabled planning assets;
the demo performs no live retrieval, individual exposure assignment, or causal
health-effect analysis.

## Proposed learner outcome

The learner should be able to:

1. identify the difference between a provider catalogue, retrieval plan,
   downloaded environmental asset, and exposure estimate;
2. select an environmental variable, study envelope, and time range;
3. review exactly what information would leave the browser;
4. recognize credential and dataset-terms requirements;
5. acquire or load a small approved environmental fixture;
6. inspect its format, units, time coverage, extent, CRS/grid, missingness, and
   provenance;
7. decide whether to add the reviewed asset to the project; and
8. explain why successful retrieval does not establish scientific suitability
   for exposure assessment.

## Planned project contents

```text
environmental-epidemiology/
  README.md
  PROJECT_PLAN.md
  environmental-heat-health.runbook.json
  environmental-heat-health-tour.pgm7
  environmental-heat-health.programs.json
  data/
    synthetic-heat-health-observations.csv
  maps/
    synthetic-heat-health-observations.geojson
  package/
    epi-info-capability.json
    provider-catalog.json
    validation/package-boundary.json
    docs/capability-boundary.md
```

The generated `environmental-heat-health-candidate.epia` is checksummed in
`wasm/demo/examples/projects/epi-info-projects.json`. The capability package is
imported separately through Help > Capability Packages; the teaching project is
imported through File > Import Example Project. Neither import runs code,
contacts a provider, or grants the package GIS/network authority.

## Data policy

- Health-event records must be synthetic and clearly labeled.
- Recorded provider responses must be public, redistribution-compatible,
  bounded, dated, and accompanied by source URLs and hashes.
- Large or mutable provider downloads, NetCDF/GRIB/Parquet working files,
  credentials, tokens, addresses, and real patient coordinates must not be
  committed here.
- A synthetic CF-like raster fixture may be used until a small C3S subset and
  its redistribution terms are reviewed.
- Exact coordinates must remain signed and retain at least five decimal places
  when point precision is analytically relevant.

## Check Code relevance

This provider-access lesson does not currently require Check Code. Do not add a
`.chk` file merely to satisfy a generic teaching-project pattern. Add Check Code
only if a later form-based lesson has a defensible entry-time rule, such as
validating measurement units, sample dates, detection-limit fields, or signed
coordinates. Record the relevance decision in the project manifest and tests.

## Execution boundary

Importing the project must never contact a provider, use a credential, download
an asset, run a program, execute Check Code, or invoke the GIS kernel. The
learner performs each substantive action through the runbook after reviewing
the effective plan. Offline mode uses only explicitly packaged fixtures.

## Related planning records

- Package workspace:
  `C:/Users/cke1/OneDrive - CDC/Epi-Info-AI-Environment`
- Provider-access plan:
  `docs/design/provider-access-spike.md` in that workspace
- GIS integration plan:
  `docs/design/gis-kernel-integration.md` in that workspace
- Epi Info AI example-project contract:
  `wasm/docs/design/example-project-repository-contract.md`
