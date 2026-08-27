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
- [`docs/design/maps-compatibility-inventory.md`](wasm/docs/design/maps-compatibility-inventory.md) - C# Maps assets, manual behaviors, browser status, and adaptation decisions;
- [`docs/reference/`](wasm/docs/reference/) - official historical reference material.

The upstream Epi Info Community Edition source is tracked as a submodule under `wasm/source/Epi-Info-Community-Edition` for behavioral and algorithmic reference.

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

## Browser demo

The current GitLab Pages demo provides a recognizable Epi Info-style launcher and working vertical slices for form design, record entry, mapping, project synchronization, and StatCalc 2 x 2 analysis.

**[Launch Epi Info AI](https://epi-info-ai-2859c9.gitpages.cdc.gov/)** — the latest GitLab Pages application build, published from the default branch after CI validation. CDC GitLab authentication may be required by the Pages access policy.

**[Open Validation Lab V0.12](https://epi-info-ai-2859c9.gitpages.cdc.gov/validation-lab/lab/index.html?path=validate-population-survey.ipynb)** — opens the current StatCalc Population Survey validation notebook directly. The [Rates notebook](https://epi-info-ai-2859c9.gitpages.cdc.gov/validation-lab/lab/index.html?path=validate-rate.ipynb), [means notebook](https://epi-info-ai-2859c9.gitpages.cdc.gov/validation-lab/lab/index.html?path=validate-means.ipynb), [frequency notebook](https://epi-info-ai-2859c9.gitpages.cdc.gov/validation-lab/lab/index.html?path=validate-frequency.ipynb), [stratified notebook](https://epi-info-ai-2859c9.gitpages.cdc.gov/validation-lab/lab/index.html?path=validate-stratified2x2.ipynb), and [standalone 2 × 2 notebook](https://epi-info-ai-2859c9.gitpages.cdc.gov/validation-lab/lab/index.html?path=validate-table2x2.ipynb) remain available. The same CDC GitLab Pages access policy applies.

Current capabilities include:

- drag-and-drop form design with optional snap-to-grid behavior;
- automatic form and record creation from CSV, TSV, JSON records, and Excel `.xlsx`, plus CSV export;
- browser-local projects with optional authenticated Supabase snapshot synchronization;
- validated File > Open Project and Save Project As using a portable V2 package,
  plus a reproducible conversion of the official legacy Sample project;
- standalone and current-form map workflows, browser geolocation, and an optional online OpenStreetMap basemap;
- browser-local GeoJSON upload, polygon-label field selection, zoom-dependent interior labels, and label visibility controls;
- compact map-layer controls, fullscreen mapping, and cumulative date/time animation;
- configurable Uber H3 resolutions from 0 through 15, with mapped records aggregated into toggleable hexagon layers;
- a distinct Visual Dashboard Rates candidate using the familiar numerator PER denominator workflow;
- a StatCalc Population Survey candidate preserving the familiar five inputs and seven-level cluster/total sample table;
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

GitLab CI also builds the V0.12 JupyterLite lab into `/validation-lab/`. The lab
derives the canonical potato-salad 2 x 2 table from the frozen 96-record
foodborne-outbreak corpus, then compares the release Rust/WASM estimates,
confidence intervals, chi-square p-values, Fisher exact tails, and mid-p tails
plus the conditional-MLE odds ratio and exact confidence limits with SciPy and
candidate goldens. It is
a transparent validation demonstration and does not replace the algorithm gates or
appear in the Epi Info workflow menus. Its current Pyodide runtime and scientific
packages are fetched on demand, so the first notebook run requires network access.
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

## Integrated browser test examples

The production demo includes the official migrated Epi Info Sample project, the same 96-record synthetic foodborne-outbreak line
list as CSV and Excel `.xlsx`, an
87-feature City of Toledo neighborhood GeoJSON layer, and a WorldPop-derived
Toledo GeoTIFF fixture. The raster is downloadable and verified in the Pages
artifact, but rendering remains the open `LEGACY-MAPS-015` task. Their provenance,
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
  Recycle Bin.
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

## Updates on August 27, 2026

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

## TODO

- Add a reusable, optional UI walkthrough to every user-facing page after the
  core migration phases are complete:
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
- Add browser-local GeoTIFF raster layers under Maps > Add Data Layer, with CRS detection/reprojection, nodata and transparency controls, safe file/memory limits, raster styling, and placement beneath polygon, line, and point layers.
- Add offline basemap packages, choropleths, spatial analysis, geocoding, and additional legacy map workflows.
- Replace `localStorage` project persistence with SQLite WASM and OPFS.
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
- Expand Classic Analysis `FREQ` from the V0.9 single-variable slice to multiple
  variables, `* EXCEPT`, strata, weights, `OUTTABLE`, filters, and saved program
  execution. Complete G5 once for all candidate outputs, as planned.
- Expand Classic Analysis `MEANS` from the V0.10 descriptive slice to cross-tab
  group summaries, t tests, ANOVA, Bartlett and Kruskal-Wallis tests, strata,
  weights, `OUTTABLE`, settings, filters, saved execution, and Complex Sample
  Means under separate reviewed contracts. Keep G5 consolidated.
- Expand Visual Dashboard `Rates` from the V0.11 COUNT slice to the audited
  aggregate list, condition builders, distinct counts, grouping, sorting,
  filters, colors, exports, and saved gadget canvas. Keep G5 consolidated.
- Expand StatCalc beyond the V0.12 Population Survey candidate in legacy menu
  order, beginning with Cohort or Cross-Sectional and Unmatched Case-Control;
  retain Chi Square for Trend, 2 x 2 x N, Poisson, Population Binomial, and
  Matched Pair Case-Control as explicit compatibility-floor branches.
- Complete legacy Epi Info and independent review of the Phase 5 V0.4 confidence
  intervals, exact tails, conditional odds ratios, and exact limits; the browser now
  obtains those results from Rust/WASM, but the registry remains `candidate`.
