# Integrated demo examples

Examples are organized by **use case**, so a dataset travels with the programs,
maps, provenance, and instructions needed to demonstrate it. The build copies
this directory tree unchanged to GitLab Pages and GitHub Pages.

| Bundle | Purpose | Contents |
|---|---|---|
| [`foodborne/`](foodborne/) | Canonical outbreak-investigation demonstration and regression harness | Synthetic line list in CSV/XLSX, Classic and Check Code tours including typed expressions, program catalog, Toledo neighborhood polygons, and WorldPop population-density raster |
| [`matched-case-control/`](matched-case-control/) | `MATCH` revival and matched-analysis validation | Legacy 65-pair teaching workbook, scalable dataset-bound catalogs, command tours, hand-audit and zero-cell/no-discordance boundary data, and bounded executable MATCH programs |
| [`cluster/`](cluster/) | New-branch Space-Time Cluster Detection demonstration | Synthetic 30-case line list, planted-cluster command tour, dataset-bound catalog, privacy boundary, and attributed external-data candidate |
| [`recordlink/`](recordlink/) | New-branch patient record-linkage contract and future evaluation harness | Two differently shaped synthetic sources, complete truth links, typed command tour, generation manifest, and explicit acceptance boundary |
| [`gdal-wasm/`](gdal-wasm/) | Browser GIS-kernel architecture spikes | Four folder-scoped tabs for vector reprojection, raster warp/clip/resample, zipped Shapefile round-trip, and calibrated multi-Worker spatial join, each with validation receipts and cancellation boundaries |
| [`gis-defensive-ingestion/`](gis-defensive-ingestion/) | Uploadable GIS-K03 defensive-ingestion cases | Synthetic malformed, corrupt, out-of-range, limit, axis-order-review, and coordinate-sign-review assets with an expected-behavior manifest |
| [`projects/`](projects/) | Whole-project migration examples | Browser-native conversion of the legacy Epi Info Sample project |

## Organization rules

- Keep all artifacts for one epidemiologic use case together.
- Put data-bound `.pgm`/`.pgm7` files beside their dataset.
- Put supporting map layers below that use case rather than in a generic map
  folder.
- Give each bundle a README with provenance, limitations, checksums, and a
  reproducible workflow.
- Keep algorithm truth fixtures under `wasm/tests/fixtures`; a demo dataset is
  not automatically an independently validated statistical reference.
- Do not add sensitive, identifiable, or operational surveillance data.

The examples are published for testing and demonstration. Their presence does
not establish command parity or approve a statistical method.

[`program-catalogs.json`](program-catalogs.json) is the validated discovery
index used by the Program Editor. To add another dataset family, place its files
in a use-case folder, add a fingerprinted `.programs.json` catalog, and register
that catalog in the index. No command implementation should contain the dataset
identifier; catalogs govern teaching-program visibility only.
