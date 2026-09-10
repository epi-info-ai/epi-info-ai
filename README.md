# Epi Info AI

Browser-first modernization of CDC's Epi Info using a deterministic WebAssembly epidemiology engine, offline local storage, familiar modernized workflows, and optional auditable AI assistance.

## Current project materials

Project materials currently live in [`wasm/`](wasm/):

- [`project.md`](wasm/project.md) - original project concept;
- [`feasibility-analysis.md`](wasm/feasibility-analysis.md) - source and WASM feasibility assessment;
- [`docs/research/rust-epidemiology-landscape.md`](wasm/docs/research/rust-epidemiology-landscape.md) - assessed Rust algorithm and crate candidates;
- [`docs/validation/algorithm-validation-standard.md`](wasm/docs/validation/algorithm-validation-standard.md) - mandatory evidence and release gates for every algorithm;
- [`validation-lab.md`](wasm/validation-lab.md) - validation-corpus governance, executable-notebook contract, and foodborne-outbreak validation roadmap;
- [`docs/design/ui-compatibility-strategy.md`](wasm/docs/design/ui-compatibility-strategy.md) - familiar-but-modern UI strategy;
- [`docs/design/legacy-capability-register.md`](wasm/docs/design/legacy-capability-register.md) - compatibility floor, backlog gap IDs, new branches, and deprecation/retirement log;
- [`docs/design/menu-compatibility-registry.md`](wasm/docs/design/menu-compatibility-registry.md) - item-level menu paths, command-state/function parity, and lifecycle gaps;
- [`docs/design/classic-command-compatibility-registry.md`](wasm/docs/design/classic-command-compatibility-registry.md) - all 49 legacy Classic Analysis command entries and their independent syntax/dialog/execution/output parity dimensions;
- [`docs/design/charts-compatibility-inventory.md`](wasm/docs/design/charts-compatibility-inventory.md) - the 8 Classic GRAPH types, 8 Visual Dashboard chart branches, source-only variants, properties, and independent parity gates;
- [`docs/design/new-branch-command-registry.md`](wasm/docs/design/new-branch-command-registry.md) - explicit Epi Info AI command extensions kept separate from the legacy parity floor;
- [`docs/demo-runbook.md`](wasm/docs/demo-runbook.md) - a short, failure-aware demo path for experienced Epi Info and global-health surveillance users;
- [`docs/demo-runbook-feltp.md`](wasm/docs/demo-runbook-feltp.md) - a field-investigation demo path for FELTP/FETP epidemiology and laboratory trainees;
- [`docs/design/maps-compatibility-inventory.md`](wasm/docs/design/maps-compatibility-inventory.md) - C# Maps assets, manual behaviors, browser status, and adaptation decisions;
- [`docs/reference/`](wasm/docs/reference/) - official historical reference material.

The Epi Info Community Edition source is tracked as an optional submodule under
`wasm/source/Epi-Info-Community-Edition` for behavioral and algorithmic reference.
Its complete upstream history is mirrored in the private CDC GitLab project
[`epi-info-community-edition`](https://git.cdc.gov/epi-info-ai/epi-info-community-edition),
while the submodule remains pinned to reviewed upstream commit `4cd353c6`.
Ordinary application builds, CI, and demos do not require the approximately
260 MiB working-tree checkout; initialize it only for legacy audits.

Clone it with:

```shell
git clone --recurse-submodules https://git.cdc.gov/epi-info-ai/epi-info-ai.git
```

For an existing clone:

```shell
git submodule update --init --recursive
```

## Current direction

- Browser-first and offline-first
- Familiar Epi Info workflows implemented with accessible modern components
- Deterministic, independently tested WASM epidemiology engine
- Kernel technology selected through a measured .NET-versus-Rust spike
- SQLite WASM and OPFS for browser-local project data
- Explicit import, export, backup, and audit history
- Optional AI that calls deterministic tools and is never required for core operation
- Provider-selectable Epi Assist: local IBM Granite plus optional OpenAI
  (ChatGPT-model) and Anthropic (Claude-model) adapters through a same-origin,
  administrator-configured gateway; all use aggregate-only context and typed,
  reviewed actions
- Help > Automated Runbooks new branch with a reusable, action-aware walkthrough
  engine and an initial foodborne Program Editor example

## Browser demo

The current GitLab Pages demo provides a recognizable Epi Info-style launcher and working vertical slices for form design, record entry, mapping, project synchronization, and StatCalc 2 x 2 analysis.

**[Launch Epi Info AI](https://epi-info-ai-2859c9.gitpages.cdc.gov/)** — the latest GitLab Pages application build, published from the default branch after CI validation. CDC GitLab authentication may be required by the Pages access policy.

**[Launch the GitHub Pages mirror](https://epi-info-ai.github.io/epi-info-ai/)** — the same validated `main` build published by GitHub Actions for external replication testing.

## JupyterLite validation labs

GitLab CI and GitHub Actions build and publish the same complete JupyterLite lab from `wasm/validation-lab/content`. CDC GitLab authentication may be required for GitLab Pages; the public GitHub mirror runs the same notebooks and deployed Rust/WASM kernel.

| Validation notebook | GitLab Pages | GitHub Pages |
| --- | --- | --- |
| TABLES V0.11 + Complex Samples | [Open](https://epi-info-ai-2859c9.gitpages.cdc.gov/validation-lab/lab/index.html?path=validate-tables.ipynb) | [Open](https://epi-info-ai.github.io/epi-info-ai/validation-lab/lab/index.html?path=validate-tables.ipynb) |
| Chi Square for Trend | [Open](https://epi-info-ai-2859c9.gitpages.cdc.gov/validation-lab/lab/index.html?path=validate-chi-square-trend.ipynb) | [Open](https://epi-info-ai.github.io/epi-info-ai/validation-lab/lab/index.html?path=validate-chi-square-trend.ipynb) |
| Unmatched Case-Control | [Open](https://epi-info-ai-2859c9.gitpages.cdc.gov/validation-lab/lab/index.html?path=validate-unmatched-case-control.ipynb) | [Open](https://epi-info-ai.github.io/epi-info-ai/validation-lab/lab/index.html?path=validate-unmatched-case-control.ipynb) |
| Cohort or Cross-Sectional | [Open](https://epi-info-ai-2859c9.gitpages.cdc.gov/validation-lab/lab/index.html?path=validate-cohort-cross-sectional.ipynb) | [Open](https://epi-info-ai.github.io/epi-info-ai/validation-lab/lab/index.html?path=validate-cohort-cross-sectional.ipynb) |
| Population Survey | [Open](https://epi-info-ai-2859c9.gitpages.cdc.gov/validation-lab/lab/index.html?path=validate-population-survey.ipynb) | [Open](https://epi-info-ai.github.io/epi-info-ai/validation-lab/lab/index.html?path=validate-population-survey.ipynb) |
| Rates | [Open](https://epi-info-ai-2859c9.gitpages.cdc.gov/validation-lab/lab/index.html?path=validate-rate.ipynb) | [Open](https://epi-info-ai.github.io/epi-info-ai/validation-lab/lab/index.html?path=validate-rate.ipynb) |
| Means | [Open](https://epi-info-ai-2859c9.gitpages.cdc.gov/validation-lab/lab/index.html?path=validate-means.ipynb) | [Open](https://epi-info-ai.github.io/epi-info-ai/validation-lab/lab/index.html?path=validate-means.ipynb) |
| Frequencies | [Open](https://epi-info-ai-2859c9.gitpages.cdc.gov/validation-lab/lab/index.html?path=validate-frequency.ipynb) | [Open](https://epi-info-ai.github.io/epi-info-ai/validation-lab/lab/index.html?path=validate-frequency.ipynb) |
| Stratified 2 × 2 | [Open](https://epi-info-ai-2859c9.gitpages.cdc.gov/validation-lab/lab/index.html?path=validate-stratified2x2.ipynb) | [Open](https://epi-info-ai.github.io/epi-info-ai/validation-lab/lab/index.html?path=validate-stratified2x2.ipynb) |
| Standalone 2 × 2 | [Open](https://epi-info-ai-2859c9.gitpages.cdc.gov/validation-lab/lab/index.html?path=validate-table2x2.ipynb) | [Open](https://epi-info-ai.github.io/epi-info-ai/validation-lab/lab/index.html?path=validate-table2x2.ipynb) |

Current capabilities include:

- drag-and-drop form design with optional snap-to-grid behavior;
- the familiar Geo-location form template (Address, Get Coordinates, Latitude,
  Longitude), explicit geocode-result review/selection, and current-form Case
  Cluster handoff;
- automatic form and record creation from CSV, TSV, JSON records, and Excel `.xlsx`, plus CSV export;
- non-mutating Enter Data import preview with file-digest repeat warnings,
  suggested identity-field matching, new/matching/changed/unchanged counts, and
  explicit update-and-append, update-only, append-new, or replace choices;
- the familiar Enter Data **Package For Transport** and **From Data Package**
  paths: V0.1 can filter records, blank selected optional fields, create and
  read password-protected `.epiax` packages using PBKDF2-SHA-256 plus
  AES-256-GCM authenticated encryption, and route decrypted records into the
  same non-mutating import preview; legacy `.edp7` remains an explicit gap;
- a **Secure Epi Info Share** new branch that manually pairs two browsers with
  exchanged WebRTC offer/answer codes and visible DTLS fingerprints, transfers
  only the encrypted `.epiax` bytes in bounded chunks with backpressure and
  SHA-256 verification, and requires passphrase validation plus import preview;
- typed, regression-tested Form Designer and Enter Data menus that preserve the
  legacy C# order, expose unported commands as named gaps, and mark browser-only
  additions as new branches;
- browser-local projects with optional authenticated Supabase snapshot synchronization;
- optional New Project study-area capture without a dataset: draw or enter a
  signed WGS 84 bounding box, review approximate dimensions and a size-based
  zoom recommendation, and preserve the GeoJSON boundary plus an explicit
  100 MiB offline-map plan in the portable project snapshot;
- provider-aware offline-map planning that counts intersecting Web Mercator
  tiles, estimates bytes, checks the project limit and browser-reported quota,
  keeps OpenStreetMap Standard preview-only, and identifies browser-local
  PMTiles in OPFS as the preferred guaranteed-offline path;
- PMTiles v3 archive import with fail-closed header/section, study-area/zoom,
  size, attribution/license, and SHA-256 validation; applying the study area
  writes the archive to browser OPFS and records portable provenance while
  cancellation removes an uncommitted asset. Maps reopens a raster PNG, JPEG,
  WebP, or AVIF package from OPFS, verifies its size, SHA-256, and header before
  activation, displays its attribution/license, and suppresses online street
  tiles. Vector MVT packages lazy-load a self-hosted MapLibre canvas beneath
  the existing Leaflet overlays and use a local custom protocol; only declared
  `vector_layers` are styled, so ordinary startup does not load MapLibre.
  Project-package backup embeds and restores these map archives. Maps detects
  missing/corrupt OPFS copies before claiming readiness and offers backup
  restore, exact-digest PMTiles re-import, blank continuation, or detach;
  proactive quota-pressure warning and network-disabled field acceptance remain open;
- validated File > Open Project and Save Project As using a portable binary
  `.epia` package; attached PMTiles archives are embedded, integrity-checked,
  and restored to browser-local OPFS, while older JSON-only V2 packages remain readable,
  plus a reproducible conversion of the official legacy Sample project;
- standalone and current-form map workflows, browser geolocation, and an optional online OpenStreetMap basemap;
- browser-local GeoJSON upload, polygon-label field selection, zoom-dependent interior labels, and label visibility controls;
- compact map-layer controls, fullscreen mapping, and cumulative date/time animation;
- configurable Uber H3 resolutions from 0 through 15, with mapped records aggregated into toggleable hexagon layers;
- live H3 resolution guidance showing how higher resolutions produce smaller hexagons, including approximate average edge length and area;
- browser-local WGS 84 GeoTIFF upload with bounded downsampling, a population-density color ramp, opacity/visibility/removal controls, and raster-below-vector drawing order;
- distinct Visual Dashboard Rates and Epi Curve slices using familiar gadget-property workflows, including a foodborne onset-date chart and auditable chart-data table;
- the familiar Visual Dashboard blue toolbar and right-click canvas command tree,
  with implemented Rates and Charts > Epi Curve paths and explicit gaps for the
  remaining legacy gadgets and canvas operations;
- the familiar Classic Analysis shell, nine-folder Command Explorer, nested
  Program Editor File/Edit/Fonts menus and toolbar, and Output navigation toolbar;
  safe editor navigation, undo/redo/cut/copy/paste/select-all, bounded Run/Cancel,
  source-only browser printing, Output navigation/Open/Bookmark/Print/Maximize/Clear,
  and command History;
  clipboard policy blocks retain explicit keyboard-shortcut guidance, while
  other unported operations remain named gaps;
- guarded Classic Program New/Open/Save/Save As/Delete with project-backed
  source, Author/Comments/Created/Updated metadata, dirty-state feedback,
  familiar Find/Replace, source-only browser printing, and official `.pgm7`
  text-file import/export; saved programs and dataset-compatible examples are
  selected through the familiar Open Pgm dialog rather than a duplicate editor
  library; unsupported legacy commands remain editable but
  non-executable;
- typed Frequencies, Means, and Tables builders that insert visible Epi Info
  source, plus fail-closed execution of one selected FREQ, MEANS, or categorical
  TABLES statement. TABLES preserves all observed categories and reports M×N
  counts, row/column percentages, totals, expected counts, Pearson statistics,
  and sparse-cell warnings without inventing an exposed/case classification; the separate stratified
  2 x 2 workflow still requires explicit value review;
- a Tools > Epi Assist **new branch** that can run IBM Granite 4.0 350M
  through a CPU/WebAssembly compatibility path (q4) or compare the WebGPU 350M
  (fp16) and 1B (q4) options, or use optional OpenAI (ChatGPT-model) and Anthropic
  (Claude-model) choices through a deployment-managed gateway, then propose
  reviewed handoffs to Data Quality, Classic `FREQ`, and Epi Curve; the non-AI
  preview demonstrates the same handoff without loading or contacting a model;
- a StatCalc Population Survey candidate preserving the familiar five inputs and seven-level cluster/total sample table;
- a StatCalc Cohort or Cross-Sectional candidate with linked effect measures and Kelsey/Fleiss sample-size output;
- a StatCalc Unmatched Case-Control candidate with linked exposure measures and cases/controls sample-size output;
- a StatCalc Chi Square for Trend candidate preserving the familiar editable exposure-score/case/control table, Add Row action, row odds ratios, and Extended Mantel-Haenszel output;
- deterministic 2 x 2 calculations backed by the Rust WebAssembly kernel; and
- an optional JupyterLite validation lab that compares the deployed Rust/WASM
  calculation with independent Python references without changing the familiar UI.

Install the pinned toolchain, validate the source, and create the production artifact:

```shell
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```

Preview the generated artifact with `pnpm run preview`, then open the URL printed by the command. GitLab Pages publishes this same generated artifact rather than copying the transitional source directly.

GitLab CI also builds the V0.15 JupyterLite lab into `/validation-lab/`. The lab
derives the canonical potato-salad 2 x 2 table from the frozen 96-record
foodborne-outbreak corpus, then compares the release Rust/WASM estimates,
confidence intervals, chi-square p-values, Fisher exact tails, and mid-p tails
plus the conditional-MLE odds ratio and exact confidence limits with SciPy and
candidate goldens. It is
a transparent validation demonstration and does not replace the algorithm gates or
appear in the Epi Info workflow menus. Its current Pyodide runtime and scientific
packages are fetched on demand, so the first notebook run requires network access.

The Epi Assist prototype distinguishes local inference, offline distribution,
and managed inference. Its first user-initiated Granite load retrieves
approximately 576 MB for the default CPU-compatible model, 709 MB for 350M
WebGPU, or 1.78 GB for 1B WebGPU, and enables browser caching. Granite prompts
and minimized context stay in the local Worker. ChatGPT/Claude choices require a
separately deployed same-origin gateway: the browser sends only the prompt,
field metadata, and aggregate quality counts—not record values—and never holds a
provider API key. Static Pages without that gateway retain Granite and non-AI
preview behavior. See the
[Epi Assist new-branch inventory](wasm/docs/design/epi-assist-compatibility-inventory.md)

[AI enablement lessons learned](wasm/ai-lessons-learned.md)
for the allowlist and production-readiness gates.
The companion stratified notebook compares deployed WASM Mantel-Haenszel
estimates and tests with direct independent Python formulas. The frequency
notebook re-derives the foodborne Case Status distribution and compares the
deployed exact/Wilson Rust exports with independent SciPy formulas.
The means notebook re-derives the foodborne Age summaries and independently
checks the deployed Rust/WASM sample statistics and audited legacy quartiles.
The Rates notebook re-derives the Confirmed-case count per non-missing ID and
checks the deployed Rust/WASM ratio-times-multiplier operation.
The Population Survey notebook independently translates the audited legacy
normal approximation and compares all seven defaults plus a clustered design
with the deployed Rust/WASM sample-size operation.
The Cohort or Cross-Sectional notebook independently translates the legacy
effect conversions and Kelsey/Fleiss formulas, checking equal and unequal group
ratios against the deployed Rust/WASM sample-size operation.
The Unmatched Case-Control notebook independently translates the legacy
exposure conversion and Kelsey/Fleiss formulas, checking equal and unequal
controls-to-cases ratios against its distinct deployed Rust/WASM operation.
The Chi Square for Trend notebook independently recomputes the Extended
Mantel-Haenszel statistic, reference-row odds ratios, and one-degree-of-freedom
p value against the deployed Rust/WASM operation.

## Integrated browser test examples

The production demo includes the official migrated Epi Info Sample project, the same 96-record synthetic foodborne-outbreak line
list as CSV and Excel `.xlsx`, an
87-feature City of Toledo neighborhood GeoJSON layer, and a WorldPop-derived
Toledo GeoTIFF fixture. The raster is downloadable, verified, and renderable as
a bounded WGS 84 local raster layer in the Pages artifact. Their provenance,
checksums, expected metadata, and combined testing workflow are documented in
[`wasm/demo/examples/README.md`](wasm/demo/examples/README.md).

## Updates on August 25, 2026

- Added configurable H3 case aggregation layers with cell-count popups.
- Added GeoJSON data layers, selectable polygon-label fields, zoom-dependent interior labels, and label toggles.
- Added compact/minimizable layer controls and improved Fit Layers behavior.
- Added a cumulative case-cluster time-lapse workflow based on date/time fields.
- Fixed fullscreen mapping so the complete map workspace remains visible after expansion.
- Enforced the cartographic drawing hierarchy: points above lines, lines above polygons, and polygons above raster basemaps.
- Preserved the separate legacy workflows for Main Menu > Create Maps and Enter Data > Maps.

## Updates on August 26, 2026

- Added the user-supplied WorldPop Toledo GeoTIFF as a checksummed Pages test
  fixture while keeping raster rendering explicitly open under `LEGACY-MAPS-015`.
- Added a validated portable Project Package V2, familiar File > Open Project and
  Save Project As commands, a read-only Access conversion tool, and a migrated
  official Sample fixture preserving 18 forms, 26 pages, 417 fields, 22 code
  tables, and the `Statistics` Classic Analysis program.
- Added one typed tabular-input path for CSV, TSV, JSON record arrays, and Excel
  `.xlsx`; all formats share schema inference and record validation. Legacy `.xls`
  remains an explicit future adapter rather than being interpreted as text.
- Completed migration Phase 3C: phone-first project/storage dialogs, action-local
  connection/account/sync feedback, and explicit offline/local/pending/connected/
  synchronized/failed states.
- Completed the Phase 4 validation and Data Quality slice: typed field rules,
  auditable calculated age, safe allowlisted Check Code field actions, validation
  across entry/import/restore, duplicate comparison, and an audited recoverable
  Recycle Bin. Field completeness now includes proportional Missing mini-bars
  with quiet zero, amber partial, and red high-missingness states while retaining
  exact counts and accessible percentage metadata.
- Hardened field validation so rule choices match the field data type. Number
  fields can be designated latitude or longitude, with signed decimal-degree
  ranges and at least five retained decimal places enforced before records save
  or import.
- Clarified the coordinate workflow compatibility floor: desktop Epi Info uses
  Address > Get Coordinates (GEOCODE) > review/Accept before Maps selects the
  resulting Latitude/Longitude fields. Coordinate validation is a new branch;
  a future click-map picker must also remain an explicitly labeled new branch.
- Locked familiar launcher order at phone, tablet, and desktop widths and added a
  storage compatibility inventory covering legacy stores and new hosted branches.
- Completed migration Phase 3B for Enter Data: phone-first record entry, a
  reachable Saved records view, unchanged prompt order, and retained tablet and
  desktop line-list layouts.
- Added browser coverage for record save/count feedback, CSV import status, and
  responsive panel composition, plus stable `LEGACY-ENTER-*` compatibility gaps.
- Completed migration Phase 3A for the shared shell: mobile-first base styles,
  reusable design tokens, 44px touch targets, visible focus, retained status/Help,
  and familiar tablet/desktop layouts.
- Added automated phone, tablet, and desktop shell checks plus a C#/XAML/manual
  shell compatibility inventory with stable `LEGACY-SHELL-*` gaps.
- Completed Phase 2: all maintained browser feature modules now use strict TypeScript; generated and pinned vendor files are the only JavaScript artifacts.
- Added explicit Maps/layer and versioned 2 x 2 request/result contracts.
- Extracted CSV/schema inference, project snapshot recovery, and browser persistence from the transitional forms controller.
- Audited the legacy C# Maps subsystem and manual as the behavioral starting point rather than treating the current Leaflet demo as the specification.
- Established the legacy capability register as the backlog and compatibility floor, with stable gap IDs and a required change log for new, deprecated, and retired branches.
- Passed source/fixture/WASM checks, production-artifact verification, and all 22 Chromium workflow tests.

## Progress from August 27 through September 9, 2026

The August 27 validation milestone expanded into a working migration prototype
with matching GitLab and GitHub Pages deployments. Since that milestone, the
project has:

- expanded the typed Classic Analysis AST, Program Editor, command dialogs,
  saved foodborne `.pgm7` tour, output history, and browser-verified command
  inventory while continuing to record legacy-parity gaps explicitly;
- completed the ordinary TABLES V0.11 candidate and bounded Complex Sample
  Tables, Frequencies, and Means slices, including `PSUVAR`, survey variance,
  design effects, `OUTTABLE`, session `READ`/`LIST`, fixtures, and independent
  notebook evidence;
- grown the JupyterLite validation lab to ten notebooks, all built and linked
  on both GitLab Pages and the public GitHub Pages mirror;
- added Visual Dashboard Epi Curve and Rates slices, Data Quality missingness
  bars, type-aware validation, import preview and duplicate warnings, secure
  `.epiax` packages, and reviewed browser-to-browser Secure Epi Info Share;
- advanced familiar mapping and geolocation workflows with draggable point
  preview, GeoJSON, H3, GeoTIFF, offline study-area planning, and validated local
  PMTiles/OPFS project packaging;
- prototyped local IBM Granite Epi Assist with typed native tool calls, prompt
  provenance, fail-closed execution, optional managed-model gateway choices,
  and recorded AI enablement lessons;
- added guarded Access-to-SQLite/DuckDB conversion candidates, automated UI
  runbooks, reproducible browser acceptance gates, and matched GitLab/GitHub
  Pages deployment pipelines; and
- mirrored the inspected legacy C# source into the Epi Info AI GitLab group and
  retained it as the compatibility floor—the old tree from which documented new
  branches grow.

The detailed cumulative changes and validation increments follow.

- Added the Validation Lab charter, corpus-governance rules, evidence hierarchy,
  notebook contract, and staged roadmap in `wasm/validation-lab.md`.
- Promoted the synthetic 96-record foodborne example to a frozen candidate corpus
  with a checksummed, machine-readable potato-salad 2 x 2 derivation.
- Migrated Katz risk-ratio, Wald odds-ratio, unpooled Wald risk-difference
  confidence intervals, and one-degree-of-freedom chi-square p-values from
  TypeScript into the `epi-core-wasm` Rust kernel.
- Added explicit method identities to result schema V0.2, native Rust fixtures,
  TypeScript/WASM parity checks, and an independently reproduced SciPy candidate
  reference. The operation remains `candidate` pending legacy comparison and G5
  review.
- Upgraded the Pages Validation Lab to V0.2 so its notebook derives `36/12/8/40`
  from the record-level CSV and compares the deployed WASM estimates, intervals,
  and p-values with SciPy and candidate goldens.
- Changed GitLab CI artifact flow so source tests and the Pages build consume the
  WASM binary compiled by the pinned Rust job, with notebook schema, syntax,
  corpus-hash, and derivation checks before publication.
- Migrated fixed-margin Fisher and mid-p exact tails from TypeScript into Rust/WASM,
  retaining Epi Info's named one-/two-tailed behavior and `1.000001` two-sided
  probability-ordering tolerance in result schema V0.3.
- Added CI parity for all 100 legacy-derived 2 x 2 Fisher cases and upgraded the
  foodborne Validation Lab to V0.3 with independent SciPy exact enumeration.
- Migrated the conditional-MLE odds ratio and exact Fisher/Mid-P confidence
  limits into Rust/WASM, with explicit zero/infinity/unavailable endpoint states.
- Upgraded the Validation Lab to V0.4 and added all 100 legacy Fisher interval
  expectations plus independent SciPy noncentral-hypergeometric comparisons.
- Added the V0.5 candidate `epi.stratified2x2` operation with adjusted MH odds and
  risk ratios, legacy confidence limits, corrected/uncorrected association tests,
  a familiar manual-strata browser panel, and a companion Validation Lab notebook.
- Connected Classic Analysis TABLES to the current form: users select exposure,
  outcome, positive values, and a stratifier; the browser reports missing/reference
  classifications, shows generated PGM syntax, and fills auditable stratum tables.
- Added the V0.6 odds-ratio homogeneity slice: familiar Breslow-Day-Tarone and
  legacy Breslow-Day output, a separately identified standard fixed-margin
  Breslow-Day result, Rust/WASM chi-square p-values for arbitrary degrees of
  freedom, and independent Python/SciPy Validation Lab evidence.
- Added the V0.7 risk-ratio homogeneity slice, directly porting the legacy
  weighted log-risk method, preserving its familiar output label, and extending
  the Rust, browser, fixture, and independent Python/SciPy evidence.
- Added the V0.8 exact adjusted-odds-ratio slice: bounded conditional
  product-hypergeometric CMLE and central Fisher limits, explicit boundary and
  unavailable states, familiar Classic Analysis output, and independent
  log-binomial/SciPy validation anchors.
- Closed the V0.8 operational gaps with a pathological/metamorphic corpus,
  maximum-strata CI performance guard, native/release-WASM parity, dedicated
  cancellable Worker execution, recovery testing, and a consolidated-review
  evidence packet. The operation remains a candidate until the batched G5 review.
- Added the V0.9 Classic Analysis `FREQ` slice for one current-form variable:
  familiar command preview, typed categories, optional missing values, frequency,
  percent, cumulative percent, and candidate legacy exact/Wilson 95% limits.
- Extended FREQ with one typed `STRATAVAR` field and within-stratum output. The
  same safe plan lets Epi Assist map “age by sex” to the inspectable command
  `FREQ age STRATAVAR=sex` without executing model-authored program text.
- Added a provenance-tracked programming curriculum corpus that classifies the
  representative Check Code and Classic Analysis command sequences taught in CDC
  tutorials, the NIOSH recoding lesson, command-reference examples, and Sample
  programs for progressive parser and execution acceptance tests.
- Epi Assist now exposes local AI run details: exact user/system prompts,
  prompt/tool/context versions, model ID/revision, WebGPU dtype, Transformers.js
  version, and generation settings. Prompts stay local by default; the current
  mutable model revision remains a production TODO.
- Added the first executable Classic Analysis Program Editor slice. Users can
  verify and run the CDC-taught `DEFINE AgeGroup -> RECODE Age -> FREQ AgeGroup
  STRATAVAR=Sex` program against the foodborne data, inspect trusted canonical
  source and structured output, and review local run history. Unsupported commands
  such as `EXECUTE` are rejected before anything runs.
- Upgraded that bounded Program Editor to CodeMirror 6 with Epi Info syntax
  highlighting and deterministic Command Assist. Typing `RECODE ` offers only
  numeric fields from the current form; `TO`, `FREQ`, and `STRATAVAR=` suggestions
  remain schema-aware and feed the unchanged typed parser rather than executing
  editor or model-generated code directly.
- Added Program Editor line numbers, live `Ln/Col` status, persistent 2/4/8-column
  and tabs/spaces settings under View, and debounced live syntax diagnostics from
  the maintained typed parser plus bounded field validation for the executable
  demonstration. Live checks mark and explain invalid source but never execute it.
- Started the modern interpreter boundary with a versioned TypeScript AST and
  source-span parser for `READ`, `LIST`, `FREQ`, `TABLES`, `RECODE`, `DEFINE`, `ASSIGN`,
  `IF`, and `SELECT`, including typed expressions and nested conditional blocks.
  The editor can validate this broader syntax, while execution remains restricted
  to the previously reviewed `DEFINE -> RECODE -> FREQ` demonstration.
- Added three selectable, editable, and runnable foodborne Program Editor examples:
  life-stage groups by Sex, broad age bands by Case Status, and an overall age-by-
  decade distribution. Their versioned catalog is packaged beside the foodborne
  CSV/XLSX as part of that example dataset. Every program uses the reviewed
  AST-to-plan path, displays its required fields, and remains visible for review
  before Verify or Run.
- Added the first explicit Classic Analysis data session: familiar `READ` and
  `LIST` dialogs generate visible source, selected `READ` chooses a named form in
  the current project, and selected `LIST` renders an auditable line list. FREQ
  and MEANS now consume the active READ session; external READ paths remain
  blocked pending reviewed browser adapters, and every run enters command history.
- Added familiar `DEFINE` and `RECODE` source-authoring dialogs. DEFINE exposes
  variable name, Standard/Global/Permanent scope, supported legacy types, and an
  optional prompt; RECODE exposes the legacy From/To variable path, editable
  value/to-value/result rows, ELSE, and the inherited `lower < value ≤ upper`
  numeric boundary rule. Together with Frequencies, they can author and run the
  bounded foodborne age-group program without hiding its Epi Info source.
- Added familiar `SELECT` and `CANCEL SELECT` authoring and selected execution.
  A schema-aware dialog generates ordinary visible source; repeated SELECT
  commands narrow the active Classic Analysis session with the legacy cumulative
  `AND` behavior. The UI reports total, selected, excluded, and missing-comparison
  counts, and LIST/FREQ/MEANS use the selected records until selection is cancelled.
  Compound expressions and functions remain fail-closed pending parity work.
- Added familiar `SORT` and `CANCEL SORT` authoring and selected execution. The
  ordered variable grid supports ascending/descending multi-field priority,
  LIST reflects the active order, and cancelling sorting restores source order
  without changing SELECT membership. AST V0.4 and local history retain the
  exact reviewed command; legacy collation remains a differential-validation gap.
- Added bounded selected `DEFINE` and `ASSIGN` session-variable execution. A
  Standard scalar must be explicitly defined before assignment; the typed Assign
  dialog accepts type-compatible literals and displays current values in session
  status. READ clears Standard variables. Data-field mutation, expressions,
  functions, and Global/Permanent lifetimes remain fail-closed.
- Added bounded `IF / ELSE / END` authoring and selected execution for initialized
  Standard variables. Both literal ASSIGN branches are validated before one is
  chosen, history records the decision, and record data remains immutable. The
  command inventory now requires a checked-in `.pgm` and asserted foodborne
  expected output for `browser-verified`, plus reviewed desktop output before
  the stronger `legacy-parity-verified` status can be used.
- Added familiar `UNDEFINE variable` and `UNDEFINE *` authoring and selected
  execution for Standard session variables. Removed variables immediately leave
  the ASSIGN/IF choices; data records remain unchanged. `UNDEFINE * GLOBAL` is
  parsed for source fidelity but fails closed until Global lifetime exists.
- Added familiar `DISPLAY DBVARIABLES` authoring for all available, defined,
  field, or selected variables. Output preserves the legacy metadata column
  order and exposes Standard values without changing records or session state.
  DBVIEWS, database TABLES, and OUTTABLE persistence remain explicit gaps.
- Added familiar `DEFINE name GROUPVAR ...` authoring and bounded Classic-session
  storage. A named foodborne symptom group expands in `LIST` without creating a
  data column; `READ` clears it. Expansion in FREQ/MEANS/TABLES, nested groups,
  and desktop differential parity remain explicit gaps.
- Added familiar `RELATE table current-key :: related-key MATCHING|ALL`
  authoring and selected execution for forms in the current project. The typed
  join supports composite keys, one-to-many output, matched-only or retained
  unmatched parent records, collision-safe related fields, and auditable active
  table replacement. External data sources remain mediated browser adapters.
- Added familiar `WRITE REPLACE "Text" destination fields` authoring and
  selected execution as an explicit UTF-8 CSV download. The foodborne fixture
  verifies 96 exported records and selected-field order. Legacy APPEND remains
  fail-closed until a reviewed choose-file, schema-preview, confirmation, and
  writable-handle adapter is added, with upload/merge/download as its portable
  fallback.
- Added familiar `MERGE source destination-key :: source-key` authoring for
  current-project forms. Running selected source stages legacy-style updates
  and inserts in a review dialog; project records change only after explicit
  confirmation. Non-unique destination keys, new validation violations,
  external sources, and ambiguous legacy APPEND/UPDATE/RELATE modes fail closed.
- Added familiar Data > Delete File/Table authoring for the reviewed
  `DELETE TABLES <current-project form>` browser subset. Execution first shows
  the affected foodborne record count, requires an acknowledgement, and only
  then clears records while preserving the project form and its fields. External
  files/databases, `RUNSILENT`, `SAVEDATA`, and the C# interpreter's unimplemented
  short external-table form remain fail-closed and explicitly registered gaps.
- Added familiar Data > Delete Records authoring for recoverable deletion.
  `DELETE *` or one typed criterion is intersected with the active selection;
  the review shows saved, active, matching, and remaining counts. Confirmed
  matches enter the existing Recycle Bin with their original indexes and audit
  events. `PERMANENT`, `RUNSILENT`, compound expressions, RELATE results, and
  legacy related-view cascade remain explicit gaps.
- Added the matching Data > Undelete Records lifecycle. `UNDELETE *` or one
  typed criterion evaluates records in the current form's Recycle Bin, previews
  active/deleted/restored counts, and restores only after acknowledgement. The
  original archive identity remains in audit history; `RUNSILENT`, compound
  expressions, and related-view cascade remain fail-closed.
- Added the familiar Statistics > Summarize command with visible Epi Info
  source. The reviewed browser subset creates one named in-session output table
  from one aggregate and optional grouping field; the foodborne example computes
  average age by sex. Multiple aggregates and `WEIGHTVAR` remain explicit gaps.
- Added Classic `TABLES ... WEIGHTVAR=<number field>` frequency weights from the
  legacy C# working-table behavior. The typed dialog lists numeric fields,
  weighted counts/totals and invalid or zero weights are auditable, and exact
  and 2 × 2 risk/odds inference remain disabled for weighted observations. The
  foodborne command tour uses Age only as a deterministic mechanical test
  weight; it is explicitly not presented as a defensible survey weight.
- Added the first three Statistics > Graph parity slices based on the legacy C#
  `GraphDialog`, grammar, and test programs. A visible one-variable
  `GRAPH` command now distinguishes familiar horizontal `Bar`, vertical
  `Column`, and category-share `Pie`; all three use the typed FREQ operation and
  render accessible SVG plus their authoritative data table.
  Other legacy chart types, cross-tabs, strata, weights, templates, and date
  intervals remain registered gaps rather than receiving invented behavior.
- Added a checksummed foodborne Case Status fixture and a V0.9 JupyterLite
  notebook that independently checks the deployed Rust/WASM frequency kernel.
- Added the V0.10 Classic Analysis `MEANS` slice for one current-form numeric
  variable, preserving familiar Obs, Total, Mean, Variance, Std Dev, minimum,
  quartiles, median, maximum, mode, and generated command output.
- Fixed Pyodide WASM loading in the frequency and stratified notebooks by using
  the supported `FetchResponse.buffer()` interface, with a regression assertion.
- Added the V0.11 Visual Dashboard `Rates` slice as a separate familiar old-tree
  branch: COUNT of a selected value PER COUNT of a non-missing field, configurable
  multiplier, familiar output, a fail-closed Rust/WASM kernel, foodborne fixture,
  browser coverage, and an independent JupyterLite notebook.
- Added the V0.12 StatCalc `Population Survey` slice with the legacy input order,
  defaults, seven confidence levels, cluster and total sample output, audited
  C# formula sequence in Rust/WASM, strict contracts, browser coverage, and a
  JupyterLite validation notebook with an independent SciPy comparison.
- Added the V0.13 StatCalc `Cohort or Cross-Sectional` slice with the familiar
  linked risk/odds/outcome inputs, Kelsey and Fleiss exposed/unexposed/total
  output, audited Rust/WASM formulas, fixtures, browser coverage, and an
  independent JupyterLite notebook.
- Added the V0.14 StatCalc `Unmatched Case-Control` slice with the familiar
  linked control/case exposure inputs, cases/controls/total Kelsey and Fleiss
  output, a distinct Rust/WASM contract over the audited shared core, fixtures,
  browser coverage, and an independent JupyterLite notebook.
- Added the V0.15 StatCalc `Chi Square for Trend` slice with the familiar
  exposure-score table, Add Row workflow, relative odds ratios, audited Extended
  Mantel-Haenszel Rust/WASM formula, fixture, browser coverage, and independent lab.
- Added a bounded WGS 84 GeoTIFF raster demo using the included WorldPop example,
  plus H3 size guidance, a sticky desktop module tree, type-aware field-rule UI,
  and a bundled/cache-busted stratified Worker to prevent the observed failure.
- Restored the first legacy desktop Geo-location vertical slice: Form Designer
  adds the official four-field template, its typed Click Check Code invokes a
  provider adapter, Enter Data requires explicit result selection before copying
  signed coordinates, and Maps recognizes those fields for Case Cluster. The
  public Nominatim endpoint is demonstration-only, not a production-scale service.
- Added the V0.16 Visual Dashboard `Epi Curve` slice with familiar main-date,
  grouping, interval/step, x-axis-bound, and missing-value controls; the canonical
  foodborne example plots 44 onset dates across three days, reports 52 missing
  dates, and exposes an accessible chart-data table. The Charts compatibility
  inventory keeps the remaining legacy chart and gadget behaviors explicit.
- Corrected dataset-scoped Program Editor examples. Tabular imports now persist
  dataset ID, original filename, and SHA-256 provenance on the form. The browser
  neither fetches nor displays the foodborne program catalog for an empty or
  unrelated project; after the canonical dataset is loaded, each program is
  enabled only when its required field names and data types are compatible. The
  checksum records the original import and does not invalidate legitimate record
  edits.
- Added Form Designer project-lifecycle parity candidate: familiar File > Open,
  Close, and Recent Projects commands; a true no-project workspace; guarded
  autosave before New/Open/Close/Recent/hosted-project transitions; durable
  browser recent snapshots; context-sensitive project commands; and
  failure-without-close regression coverage.
- Added a typed Form Designer menu contract derived from the User Guide and
  legacy C# resources. File, Edit, View, Insert, Format, Tools, Help, and their
  nested branches now render in familiar order; implemented items share toolbar
  operations, `Ctrl+O` opens a project, unported commands remain visible as
  disclosed compatibility gaps, and Project Storage is marked as a new branch.
- Restored the Classic Analysis shell and Command Explorer from the manual and
  legacy C# resources: File/View/Tools/Help, all nine familiar command folders,
  the Program Editor/Output/Message Area frame, and tested routes from
  Statistics to the existing Frequencies, Tables, and Means panels. Unported
  commands remain visible compatibility gaps.

## TODO

- **Write and maintain the Epi Info AI Manual.** Use the Epi Info 7 manual as
  the familiar workflow and terminology floor—the old tree—while documenting
  restored behavior, intentional browser adaptations, deprecated branches, and
  clearly labeled new branches. Cover every user-facing module, menu, dialog,
  Program Editor command, example project/program, offline and collaboration
  workflow, validation status, and Help walkthrough. Version the manual with
  releases and check it against the capability, menu, command, chart, and
  validation registries so published guidance never claims unverified parity.

- **Secure Epi Info Share hardening:** V0.1 now provides authenticated `.epiax`
  packaging and manual direct WebRTC exchange. Add reviewed legacy `.edp7`
  reading, Argon2id, QR/short-code signaling, explicit STUN/TURN policy and route
  reporting, quota preflight, cancellation/resume, durable quarantine, transfer
  receipts, cross-device testing, and independent security review. It must not
  claim automatic nearby-device discovery or silently import received data.

- **Ordinary Classic Analysis `TABLES` candidate complete at V0.11.** The
  browser-verified floor renders unstratified and multi-stratum categorical counts, row/column
  percentages, totals, expected counts, Pearson chi-square/df/probability, and
  sparse-cell warnings for two fields and one `STRATAVAR`. A true observed 2 × 2
  table also receives the familiar Single Table Analysis: odds ratios, risk
  ratio, risk difference, chi-square variants, mid-p, Fisher, and confidence
  limits from the validated Rust/WebAssembly kernel. The JupyterLite TABLES and
  2 × 2 labs independently check the statistical contracts.
  `STATISTICS=FISHER` supplies bounded general R × C exact
  testing with a visible 200,000-table limit. `SET MISSING=OFF/ON`, inverse
  `SET IGNORE`, and `SET (.)="label"` preserve the legacy OFF/`Missing`
  defaults in ordered programs. A stratified binary TABLES command now sends
  its displayed cells to the validated Rust/WASM Worker and appends adjusted
  Mantel–Haenszel OR/RR, confidence limits, association tests, conditional OR,
  and homogeneity tests.
  `WEIGHTVAR` now supplies finite, non-negative numeric frequency weights with
  an independent JupyterLite check. Legacy exposure-position `GROUPVAR` and `*`
  now expand into one separately labeled, auditable TABLES output per field in
  declared/project order; the foodborne command tour exercises a three-food
  group. `OUTTABLE` creates the inspected long-form table for session READ-back;
  expanded exposures preserve the desktop final-exposure replacement behavior.
  `STATISTICS=NONE`, numeric `ONEISYES`, and the inspected no-op handling of
  `NOWRAP`/`COLUMNSIZE` are covered. Multiple outcome fields are not claimed
  because the inspected legacy grammar accepts one outcome per TABLES command.
  `PSUVAR` now switches to a bounded V0.2 Complex Sample Tables engine from the
  familiar Advanced Statistics path. It ports the inspected PSU-within-stratum
  Taylor variance, design df/t limits, design effects, and 2 × 2 survey OR/RR/RD;
  a clearly labeled mechanical foodborne fixture uses Household Neighborhood as
  a PSU proxy and Age as a test weight. Complex `OUTTABLE`, meaningful survey
  corpora, desktop differential evidence, Rust migration, and review remain open.
  See the [Complex Sample Tables method contract](wasm/docs/validation/complex-sample-tables-method-contract.md).

- **Complex Sample Frequencies V0.1 candidate.** `FREQ ... PSUVAR=...` now restores the legacy Advanced Statistics path with optional design stratum, numeric weight, linear/logit limits, the inspected legacy design-effect behavior, and session `OUTTABLE` read-back. The foodborne design fields are explicitly mechanical test proxies. See the [CSF method contract](wasm/docs/validation/complex-sample-frequency-method-contract.md).

- **Complex Sample Means V0.1 candidate.** `MEANS ... PSUVAR=...` now reports
  survey-domain means, Taylor standard errors, legacy t limits, and a two-domain
  mean difference. Its foodborne design fields are mechanical test proxies; the
  JupyterLite lab independently reproduces the calculations in Python. A clearly
  labeled browser adaptation can materialize the visible result rows with
  `OUTTABLE` for session `READ`/`LIST`; desktop CSM displays that control disabled
  and supplies no result-table schema. Desktop differential review remains open.
  See the [CSM method contract](wasm/docs/validation/complex-sample-means-method-contract.md).
  Preserve the legacy dialog and visible command source, add foodborne `.pgm`
  fixtures and expected results for every increment, and do not mark TABLES
  legacy-parity-verified until desktop differential output is reviewed.
  Sequential Program Editor runs now retain a numbered, read-only Output
  document for every statement, including snapshots from repeated FREQ, LIST,
  and TABLES commands, so later output cannot make earlier commands appear skipped.
- **Menu parity:** complete the legacy item-level context-state matrix,
  shortcuts, and behavior inventory across every module. Form Designer, Enter
  Data, Visual Dashboard, and Classic Analysis now have typed structural
  contracts; their command-level functional gaps remain open. Apply the contract
  pattern to Maps and StatCalc next. Keep portable package export
  and Project Storage explicitly identified where they adapt or extend rather
  than redefine legacy behavior.
- Implement the unified, append-only command history for manual dialogs, user
  programs, Visual Epi Info flows, reviewed Epi Assist plans, and approved
  plugins, with canonical source, origin, approval, revision, engine, status,
  diagnostics, and immutable output provenance.
- Design and obtain approval for optional cross-instance learning events as a
  separate pipeline: minimized/redacted metadata, transmission preview and
  consent, authenticated CDC intake, quarantine, retention controls, and human
  promotion to versioned evaluation/training corpora. Never train directly from
  raw project history or live synchronization storage.
- Expand the implemented Help > Automated Runbooks V0.1 foundation to every
  user-facing page after the core migration phases are complete:
  - launch from the page Help control and allow replay at any time;
  - highlight real controls with concise Back, Next, Finish, and Exit steps;
  - preserve keyboard focus, screen-reader announcements, reduced-motion support,
    phone/tablet/desktop layouts, and user-entered state;
  - version walkthrough content with the page so renamed or removed controls fail
    automated coverage instead of producing stale guidance; and
  - expose a host walkthrough API for approved plugin pages without allowing
    plugins unrestricted DOM access.
- Add a Visual Dashboard data-quality and missingness assessment workflow:
  - field-level present, missing, and completeness counts and percentages;
  - record-level missing-field counts and configurable completeness thresholds;
  - missingness matrix/heatmap and common missing-data patterns;
  - filtering and stratification to explore whether missingness differs by key variables;
  - CSV/report export with explicit treatment of blank, unknown, not applicable, and structural missing values; and
  - later-phase MCAR diagnostics, imputation, and sensitivity analysis only after statistical validation requirements are defined.
- Complete multi-user, record-level synchronization and conflict resolution; Supabase currently synchronizes a single-user whole-project snapshot.
- Continue decomposing the typed Forms controller into designer, validation,
  Data Quality, and record-lifecycle modules before expanding legacy parity.
- Add explicit coordinate reference system detection and reprojection for imported spatial data; current case coordinates and GeoJSON are expected in WGS 84 longitude/latitude.
- Revive the dormant Classic Analysis `MAP` programming command as a documented revival/new branch: reconcile its legacy thematic grammar (`AVG`, `CASE_BASED`, `SUM`, `COUNT`, `MIN`, `MAX`) with typed map-layer plans and test programs. Keep modern GeoJSON, H3, GeoTIFF, offline-package, and future spatial-analysis commands explicitly labeled as new branches.
- Expand GeoTIFF beyond the bounded WGS 84 first-band demo with deterministic reprojection, multiband styling, legends, persisted layer definitions, and richer nodata controls.
- Replace the demonstration Nominatim geocoder with an approved, configurable
  provider/backend for production scale, privacy controls, rate limits, audit,
  and service-independent test fixtures; then extend legacy GEOCODE compatibility.
- Complete the browser-local PMTiles branch: expand corrupt directory/tile
  validation and vector-style review, warn proactively about quota pressure and
  best-effort eviction risk, and pass
  field-offline tests. Package backup/export and restore are now present. Raster
  archives already render from OPFS after runtime integrity verification. Do
  not treat evictable browser HTTP cache as complete coverage.
  Then add choropleths, spatial analysis, and additional legacy map workflows.
- Replace `localStorage` project persistence with SQLite WASM and OPFS.
- Harden the browser-verified V0.1 `FILE CONVERT` facility for legacy Epi Info
  `.mdb` and `.accdb` projects. It reads an explicitly selected local file with
  `mdb-reader`; `.sqlite` builds an in-memory official SQLite WASM operational
  database while `.duckdb` builds a self-hosted DuckDB-Wasm analytical database. Both embed a
  migration manifest, and downloads it without changing the source. Move large
  conversions into a Worker and add progress/cancellation. Extend migration to
  preserve Epi Info
  project/form/page metadata, code tables, relationships, keys/indexes, field
  types, records, deleted-state metadata, and Check Code source where available;
  report unsupported Access objects instead of silently dropping them. Validate
  table/row/column counts, null/type conversions, representative checksums, and
  referential integrity before a conversion result can be accepted or imported into `.epia`.
  DuckDB V0.1 currently fetches DuckDB's public test database as a cleanable
  writable seed; self-host and checksum that reviewed seed before offline or
  production use. The selected Access file and its records remain browser-local.
- Implement the versioned plugin runtime, capability API, permissions, and plugin catalog described in the architecture plan.
- Execute the algorithm validation standard: complete provenance review of the
  imported legacy 2 x 2 corpus, add independent/pathological exact fixtures, and
  complete native/WASM parity and review gates before expanding the Rust kernel.
- Evaluate and, if required, self-host a pinned Pyodide distribution and scientific wheels before claiming that the validation lab or a future Advanced Analysis workspace works offline.
- Continue Phase 5 validation for the candidate stratified 2 x 2
  Mantel-Haenszel OR/RR, confidence limits, and association tests. The automated
  pathological, metamorphic, maximum-strata, performance, and Worker-isolation
  evidence is now implemented; add familiar multiple-stratifier/weight/filter
  support and broader reviewed legacy-output corpora without removing the direct
  StatCalc branch. Complete G5 once for the consolidated set of candidate outputs.
- Expand Classic Analysis `FREQ` from the V0.9/V0.9.1 single-variable and
  single-stratifier slices to multiple variables, `* EXCEPT`, multiple strata,
  weights, `OUTTABLE`, filters, and saved program
  execution. Complete G5 once for all candidate outputs, as planned.
- Expand Classic Analysis `MEANS` from the V0.10 descriptive slice to cross-tab
  group summaries, t tests, ANOVA, Bartlett and Kruskal-Wallis tests, strata,
  weights, `OUTTABLE`, settings, filters, saved execution, and Complex Sample
  Means under separate reviewed contracts. Keep G5 consolidated.
- Expand Visual Dashboard `Rates` from the V0.11 COUNT slice to the audited
  aggregate list, condition builders, distinct counts, grouping, sorting,
  filters, colors, exports, and saved gadget canvas. Keep G5 consolidated.
- Expand Visual Dashboard `Charts` from the V0.16 bounded Epi Curve slice to the
  general gadget canvas, legacy faceting and weighting, complete display/export
  properties, saved state, and Column, Line, Area, Pie, Aberration Detection,
  Pareto, and Scatter branches documented in the Charts compatibility inventory.
- Expand StatCalc beyond the first three sample-size candidates and Chi Square
  for Trend in legacy menu order; retain 2 x 2 x N, Poisson, Population Binomial, and
  Matched Pair Case-Control as explicit compatibility-floor branches.
- Complete legacy Epi Info and independent review of the Phase 5 V0.4 confidence
  intervals, exact tails, conditional odds ratios, and exact limits; the browser now
  obtains those results from Rust/WASM, but the registry remains `candidate`.
