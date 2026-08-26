# Epi Info AI

Browser-first modernization of CDC's Epi Info using a deterministic WebAssembly epidemiology engine, offline local storage, familiar modernized workflows, and optional auditable AI assistance.

## Current project materials

Project materials currently live in [`wasm/`](wasm/):

- [`project.md`](wasm/project.md) - original project concept;
- [`feasibility-analysis.md`](wasm/feasibility-analysis.md) - source and WASM feasibility assessment;
- [`docs/research/rust-epidemiology-landscape.md`](wasm/docs/research/rust-epidemiology-landscape.md) - assessed Rust algorithm and crate candidates;
- [`docs/validation/algorithm-validation-standard.md`](wasm/docs/validation/algorithm-validation-standard.md) - mandatory evidence and release gates for every algorithm;
- [`docs/design/ui-compatibility-strategy.md`](wasm/docs/design/ui-compatibility-strategy.md) - familiar-but-modern UI strategy;
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

Current capabilities include:

- drag-and-drop form design with optional snap-to-grid behavior;
- automatic form and record creation from CSV, plus CSV import/export;
- browser-local projects with optional authenticated Supabase snapshot synchronization;
- standalone and current-form map workflows, browser geolocation, and an optional online OpenStreetMap basemap;
- browser-local GeoJSON upload, polygon-label field selection, zoom-dependent interior labels, and label visibility controls;
- compact map-layer controls, fullscreen mapping, and cumulative date/time animation;
- configurable Uber H3 resolutions from 0 through 15, with mapped records aggregated into toggleable hexagon layers; and
- deterministic 2 x 2 calculations backed by the Rust WebAssembly kernel.

Install the pinned toolchain, validate the source, and create the production artifact:

```shell
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```

Preview the generated artifact with `pnpm run preview`, then open the URL printed by the command. GitLab Pages publishes this same generated artifact rather than copying the transitional source directly.

## Updates on August 25, 2026

- Added configurable H3 case aggregation layers with cell-count popups.
- Added GeoJSON data layers, selectable polygon-label fields, zoom-dependent interior labels, and label toggles.
- Added compact/minimizable layer controls and improved Fit Layers behavior.
- Added a cumulative case-cluster time-lapse workflow based on date/time fields.
- Fixed fullscreen mapping so the complete map workspace remains visible after expansion.
- Enforced the cartographic drawing hierarchy: points above lines, lines above polygons, and polygons above raster basemaps.
- Preserved the separate legacy workflows for Main Menu > Create Maps and Enter Data > Maps.

## TODO

- Add a Visual Dashboard data-quality and missingness assessment workflow:
  - field-level present, missing, and completeness counts and percentages;
  - record-level missing-field counts and configurable completeness thresholds;
  - missingness matrix/heatmap and common missing-data patterns;
  - filtering and stratification to explore whether missingness differs by key variables;
  - CSV/report export with explicit treatment of blank, unknown, not applicable, and structural missing values; and
  - later-phase MCAR diagnostics, imputation, and sensitivity analysis only after statistical validation requirements are defined.
- Complete multi-user, record-level synchronization and conflict resolution; Supabase currently synchronizes a single-user whole-project snapshot.
- Migrate browser feature code from JavaScript to TypeScript while retaining JavaScript only for loading/glue and keeping epidemiologic algorithms in Rust/WASM.
- Add explicit coordinate reference system detection and reprojection for imported spatial data; current case coordinates and GeoJSON are expected in WGS 84 longitude/latitude.
- Add browser-local GeoTIFF raster layers under Maps > Add Data Layer, with CRS detection/reprojection, nodata and transparency controls, safe file/memory limits, raster styling, and placement beneath polygon, line, and point layers.
- Add offline basemap packages, choropleths, spatial analysis, geocoding, and additional legacy map workflows.
- Replace `localStorage` project persistence with SQLite WASM and OPFS.
- Implement the versioned plugin runtime, capability API, permissions, and plugin catalog described in the architecture plan.
- Execute the algorithm validation standard: import and classify the legacy 2 x 2 corpus, add independent/pathological fixtures, and complete native/WASM parity and review gates before expanding the Rust epidemiology kernel.
- Continue mobile-first adaptation without removing familiar desktop visual landmarks and workflows.
