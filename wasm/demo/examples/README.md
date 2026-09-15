# Integrated demo examples

Examples are organized by **use case**, so a dataset travels with the programs,
maps, provenance, and instructions needed to demonstrate it. The build copies
this directory tree unchanged to GitLab Pages and GitHub Pages.

| Bundle | Purpose | Contents |
|---|---|---|
| [`foodborne/`](foodborne/) | Canonical outbreak-investigation demonstration and regression harness | Synthetic line list in CSV/XLSX, Program Editor tours, program catalog, Toledo neighborhood polygons, and WorldPop population-density raster |
| [`matched-case-control/`](matched-case-control/) | `MATCH` revival and matched-analysis validation | Legacy 65-pair teaching workbook, synthetic 1:2 stress data, and syntax-only MATCH program |
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
