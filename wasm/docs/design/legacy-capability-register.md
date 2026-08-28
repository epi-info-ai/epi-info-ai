# Legacy capability register

## Role in the project

This register is the primary source for current-to-future product gaps. It links
the familiar Epi Info workflow tree to the code assets that implement it, records
what Epi Info AI can do today, and identifies deliberate new branches.

The legacy application is not a specification in every implementation detail,
but it is the starting point for capability discovery. A feature is not treated
as absent merely because it is missing from the current browser prototype.

## Register method

Each module inventory must record:

1. the manual path and terminology users already know;
2. the C# projects, classes, interfaces, resources, and tests that implement it;
3. the observable behavior and important edge cases;
4. the Epi Info AI implementation and automated coverage, if present;
5. a disposition: preserve, adapt, defer, extend, or retire;
6. one or more stable gap IDs for incomplete work; and
7. dependencies, security constraints, and validation requirements.

Every entry also has a lifecycle state:

- **legacy-floor**: an old-tree capability that remains required;
- **parity-in-progress**: implementation exists but has not met the closure gate;
- **parity-complete**: observable behavior and tests have been reviewed;
- **new-branch**: an intentional extension attached to a named old-tree parent;
- **deprecated**: still visible and supported during a documented transition;
- **retired**: removed only after explicit review, replacement documentation, and
  release communication.

Gap IDs use `LEGACY-<MODULE>-NNN`. They remain stable when implementation tasks
move between phases, so documentation, issues, commits, tests, and releases can
refer to the same capability.

## Module inventories

| Module / old-tree branch | Inventory | Status |
|---|---|---|
| Main Menu and shell | `shell-compatibility-inventory.md` | Initial C#/XAML/manual audit complete; Phase 3A responsive contract recorded |
| Create Forms / Form Designer | `form-designer-compatibility-inventory.md` | Initial manual/C#/runtime audit complete; Phase 4 gaps and safe skip subset recorded |
| Enter Data | `enter-data-compatibility-inventory.md` | Initial C#/manual audit and Phase 3B responsive contract recorded |
| Classic Analysis / Programming IDE | `programming-ide-compatibility-inventory.md` | Legacy IDE floor and ordered future-IDE roadmap recorded; full command inventory pending |
| Visual Dashboard | `rates-compatibility-inventory.md`, `charts-compatibility-inventory.md` | Rates V0.11 and Epi Curve V0.16 bounded slices recorded; general gadget canvas and broader chart inventory remain open |
| Create Maps / Enter Data > Maps | `maps-compatibility-inventory.md` | Initial C# and manual audit complete; gap IDs below |
| StatCalc / Classic Analysis TABLES | `statcalc-compatibility-inventory.md` | Eight-tool StatCalc menu floor recorded; direct/stratified 2 x 2 and the first three sample-size branches implemented as candidates |
| Storage / project formats | `storage-compatibility-inventory.md` | Initial legacy/browser boundary audit and Phase 3C state contract recorded |
| Tools / Epi Assist (new branch) | `epi-assist-compatibility-inventory.md` | Local Granite V0.1 proposal and reviewed-action boundary implemented; production governance and distribution open |

## Maps gap register

| Gap ID | Old branch or capability | Current browser state | Intended closure / extension |
|---|---|---|---|
| LEGACY-MAPS-001 | Case Cluster aggregation and flare behavior | Individual record points | Reproduce recognizable clustering, separation, and small-cluster inspection |
| LEGACY-MAPS-002 | Case Cluster filters and stratification | Not present | Typed filters and multiple styled case layers |
| LEGACY-MAPS-003 | Choropleth joins and classification | GeoJSON polygons only | Feature/data keys, value field, classes, schemes, missing values, legend |
| LEGACY-MAPS-004 | Dot Density | Not present | Typed joins and auditable dot-value semantics |
| LEGACY-MAPS-005 | Reference layers: shapefile, KML, map server | GeoJSON local file | Safe browser adapters for reviewed formats and HTTPS services |
| LEGACY-MAPS-006 | Layer management | Visibility and remove for selected layers | Ordered move/edit/remove, data/reference identity, legends |
| LEGACY-MAPS-007 | Marker, Label, and Zone | Current-location overlay only | User-authored marker, text, and radius-zone overlays |
| LEGACY-MAPS-008 | Save/Open Map and Save Image | Not present | Versioned portable map document and image export |
| LEGACY-MAPS-009 | Time lapse distribution chart and controls | Cumulative play/slider | Complete familiar control set and distribution summary |
| LEGACY-MAPS-010 | Coordinate systems and reprojection | WGS 84 only | Explicit CRS detection/selection and deterministic reprojection |
| LEGACY-MAPS-011 | Satellite/Street/Blank backgrounds | Street/Blank | Policy-approved satellite provider and clear online/offline behavior |
| LEGACY-MAPS-012 | Enter Data record linkage | Double-click popup linkage | Preserve and test record selection across all record-backed layers |
| LEGACY-MAPS-013 | H3 aggregation (new branch) | Working prototype | Persistable layer definition, legends, filters, and validation |
| LEGACY-MAPS-014 | Browser geolocation (new branch) | Working prototype | Permission, privacy, accuracy, and mobile-field workflow hardening |
| LEGACY-MAPS-015 | GeoTIFF raster (new branch) | WGS 84 first-band renderer with limits, ramp, opacity, visibility, removal, and raster pane | Reprojection, multiband styles/legends, persistence, richer nodata controls |
| LEGACY-MAPS-016 | Click map to populate record fields (possible new branch) | Not present | Add only as an explicitly labeled extension after preserving the legacy GEOCODE/GPS acquisition paths |

## Shell gap register

The detailed evidence and closure gates for `LEGACY-SHELL-001` through
`LEGACY-SHELL-007` are maintained in `shell-compatibility-inventory.md`. Phase 3A
adapts the same old-tree launcher across screen sizes; it does not add, deprecate,
or retire a workflow branch.

## Enter Data gap register

The detailed evidence and closure gates for `LEGACY-ENTER-001` through
`LEGACY-ENTER-010` are maintained in `enter-data-compatibility-inventory.md`.
Phase 3B changes the narrow-screen presentation only. It preserves the Enter Data
branch, field order, storage contracts, wider-screen panels, and linked Maps path.

## Form Designer gap register

The detailed evidence and closure gates for `LEGACY-FORM-001` through
`LEGACY-FORM-012` are maintained in `form-designer-compatibility-inventory.md`.
Skip patterns remain two distinct legacy concepts: persisted tab-stop navigation
and event-driven Check Code. Phase 4 must not collapse them into an ordinary
validation rule or execute arbitrary imported code.

## Programming IDE gap register

The detailed evidence, ordered implementation roadmap, and closure rules for
`LEGACY-PROGRAM-001` through `LEGACY-PROGRAM-020` are maintained in
`programming-ide-compatibility-inventory.md`. The legacy Classic Analysis Program
Editor and Check Code Editor are the floor. Syntax assistance, program tests,
debugging, provenance, source history, AI assistance, and responsive authoring are
explicit new branches attached to that familiar workflow. The visual dataflow
canvas is another synchronized view over the typed program model, not a replacement
for PGM source.

## Storage gap register

The detailed evidence and closure gates for `LEGACY-STORAGE-001` through
`LEGACY-STORAGE-009` are maintained in `storage-compatibility-inventory.md`.
Direct SQL Server and Access behavior remains on the compatibility floor through
safe browser-appropriate adapters; the prototype does not erase those branches.

## StatCalc and Classic Analysis TABLES gap register

The detailed floor and closure evidence for `LEGACY-STATCALC-001` through
`LEGACY-STATCALC-010` and
`LEGACY-ANALYSIS-001` through `LEGACY-ANALYSIS-006` are maintained in
`statcalc-compatibility-inventory.md`. Candidate adjusted estimates do not close
the dataset-selection, exact-stratified, homogeneity, or validation gaps.

## Visual Dashboard gap register

The initial floor and closure evidence for `LEGACY-DASHBOARD-001` through
`LEGACY-DASHBOARD-010` are maintained in `rates-compatibility-inventory.md`;
`LEGACY-DASHBOARD-011` through `LEGACY-DASHBOARD-020` are maintained in
`charts-compatibility-inventory.md`.
The V0.11 COUNT-based Rates candidate restores a distinct old-tree launcher but
does not claim parity with the general gadget canvas or the full Rates property
panels.

## Change control

- New feature proposals first identify the old-tree parent and either close an
  existing gap or add an explicitly labeled new branch.
- Migration commits cite the affected gap IDs but do not claim closure until the
  observable behavior and tests are complete.
- A retired implementation detail must state its browser replacement or explain
  why the behavior is unsafe or inapplicable.
- Module inventories are reviewed with experienced Epi Info users before their
  gaps are considered complete.
- Release notes list closed gaps and known gaps; the prototype is never described
  as feature-parity merely because its currently visible controls work.
- Every new branch and every deprecation or retirement of an old branch adds a
  row to the registry change log in the same change that implements the decision.
- Deprecation rows state the reason, replacement workflow, compatibility period,
  data migration/export effect, reviewer, decision date, and target release.
- A deprecated item remains part of the compatibility floor until its retirement
  row is approved; removing it from menus, contracts, tests, or documentation
  before that point is a regression.

## Registry change log

| Change ID | Branch / gap | Change | Reason and replacement | Review / date | Release state |
|---|---|---|---|---|---|
| REG-0001 | LEGACY-MAPS-013 | New branch: H3 aggregation under Maps data layers | Adds configurable hexagonal aggregation; does not replace Case Cluster | Project direction / 2026-08-26 | Prototype, open gap |
| REG-0002 | LEGACY-MAPS-014 | New branch: browser geolocation under Maps | Adds permission-gated field location; does not replace record coordinate fields | Project direction / 2026-08-26 | Prototype, open gap |
| REG-0003 | LEGACY-MAPS-015 | New branch: bounded GeoTIFF raster reference layer | Adds browser-local WGS 84 first-band rendering beneath vector layers; unsupported projections fail closed | Project direction; implemented 2026-08-27 | Prototype, extension gaps open |
| REG-0004 | LEGACY-STORAGE-006 | New branch: browser-local project working copy | Adds an offline-capable browser persistence path; does not replace portable/legacy project compatibility | Registry audit / 2026-08-26 | Prototype, open gap |
| REG-0005 | LEGACY-STORAGE-007 | New branch: authenticated Supabase hosted copy | Adds optional HTTPS synchronization with RLS; does not replace legacy project/data-store adapters | Registry audit / 2026-08-26 | Prototype, open gap |
| REG-0006 | LEGACY-STORAGE-008 | New branch planned: multi-user record merge | Extends hosted copies with reviewed record-level collaboration; does not weaken whole-project conflict rejection until validated | Project direction / 2026-08-26 | TODO, open gap |
| REG-0007 | LEGACY-ENTER-006 | New branch: browser tabular adapters for TSV, JSON records, and Excel `.xlsx` | Extends the familiar import/create-form workflow without replacing CSV or legacy data-store compatibility; `.xls` remains open | Project direction / 2026-08-26 | Prototype, open gap |
| REG-0008 | LEGACY-FORM-006 | Adapted branch: typed same-form skip navigation | Begins legacy Check Code compatibility with field After events, optional equality conditions, and validated `GOTO` targets; does not claim page/form or arbitrary Check Code parity | Legacy code audit / 2026-08-26 | Phase 4 prototype, open gap |
| REG-0009 | LEGACY-STORAGE-002, LEGACY-STORAGE-003 | Adapted branch: validated portable V2 project envelope and read-only Access converter | Adds familiar File > Open Project / Save Project As and preserves the official Sample project inventory; does not claim direct browser `.mdb`, SQLite/OPFS, or final container parity | Legacy code/data audit / 2026-08-26 | Prototype, open gaps |
| REG-0010 | LEGACY-FORM-003, LEGACY-ENTER-004 | Adapted branch: typed browser validation and calculated age | Implements the Phase 4 safe vertical slice across entry, imports, and restore; does not replace unimplemented legacy field semantics | Migration plan / 2026-08-27 | Phase 4 slice complete, parity gaps open |
| REG-0011 | LEGACY-FORM-006, LEGACY-FORM-007, LEGACY-FORM-008 | Adapted branch: allowlisted Check Code field actions | Adds validated same-form After-event navigation and field-state actions while preserving arbitrary legacy source as non-executable migration metadata | Legacy safety review / 2026-08-27 | Phase 4 slice complete, parity gaps open |
| REG-0012 | LEGACY-ENTER-003 | Adapted branch: audited browser Recycle Bin | Replaces an unguarded destructive prototype path with comparison, reason, confirmation, persisted recovery, and audit history; general legacy record lifecycle remains open | Migration plan / 2026-08-27 | Phase 4 slice complete, parity gap open |
| REG-0013 | LEGACY-PROGRAM-012 through LEGACY-PROGRAM-019 | New branches: modern Epi Info programming assistance | Adds language assistance, diagnostics, provenance, program tests, debugger/replay, source history, optional reviewed AI assistance, and responsive authoring around—not instead of—the familiar Program Editor | Programming IDE gap audit / 2026-08-27 | Roadmap, open gaps |
| REG-0014 | LEGACY-PROGRAM-020 | New branch: Visual Epi Info dataflow programming | Adds typed connected input/transform/analysis/output nodes synchronized through the same typed IR; the traditional Program Editor always exposes the complete effective source, and unsupported source remains visible and is never silently converted | Project direction / 2026-08-27 | Roadmap, open gap |
| REG-0015 | LEGACY-ANALYSIS-003, LEGACY-ANALYSIS-004 | Adapted branch: candidate Rust/WASM Mantel-Haenszel summary | Ports the legacy adjusted OR/RR, confidence-limit, and association-test formulas behind `epi.stratified2x2`; manual strata entry demonstrates the output but does not replace Classic Analysis TABLES variable selection | Legacy code audit / 2026-08-27 | Phase 5 candidate, parity gaps open |
| REG-0016 | LEGACY-ANALYSIS-001, LEGACY-ANALYSIS-002 | Adapted branch: current-form TABLES selector and auditable derivation | Restores the familiar exposure/outcome/stratify sequence for one stratifier, displays generated PGM syntax, explicitly classifies imported text values, and reports missing exclusions; weights, filters, multiple stratifiers, and saved execution remain open | Legacy dialog/code audit / 2026-08-27 | Phase 5 prototype, parity gaps open |
| REG-0017 | LEGACY-ANALYSIS-006 | Adapted and clarified branch: candidate OR/RR homogeneity tests | Ports the legacy Tarone and legacy-labelled Woolf OR/RR formulas, preserves their familiar output labels, and adds a separately identified standard fixed-margin Breslow-Day OR result; expanded corpora and formal review remain open | `Single2x2.cs` audit / 2026-08-27 | Phase 5 V0.7 candidate, parity gap open |
| REG-0018 | LEGACY-ANALYSIS-005 | Adapted branch: bounded exact adjusted OR inference | Ports the conditional product-hypergeometric CMLE and central Fisher limits with explicit zero/infinity/unavailable states, reviewed support/work limits, pathological and maximum-strata regression evidence, and cancellable Worker isolation; broader reviewed legacy-output parity and consolidated G5 approval remain open | `Strat2X2.vb` audit plus V0.8 evidence packet / 2026-08-27 | Phase 5 V0.8 candidate, operational gaps closed; review gap open |
| REG-0019 | LEGACY-ANALYSIS-007 | Adapted branch: current-form single-variable FREQ | Adds familiar variable selection and generated `FREQ` syntax, typed category grouping, missing-value control, cumulative output, and candidate legacy exact/Wilson confidence limits; multiple variables, `* EXCEPT`, strata, weights, `OUTTABLE`, filters, saved execution, and consolidated G5 approval remain open | `FrequencyDialog.cs`, `Frequency.cs`, and `freq.vb` audit / 2026-08-27 | Phase 5 V0.9 candidate, parity gaps open |
| REG-0020 | LEGACY-ANALYSIS-008 | Adapted branch: current-form single-variable MEANS | Adds familiar numeric-variable selection and generated `MEANS` syntax with candidate descriptive statistics and audited legacy quartiles/mode; cross-tabulation, t tests, ANOVA, Bartlett, Kruskal-Wallis, strata, weights, `OUTTABLE`, settings, saved execution, Complex Sample Means, and consolidated G5 approval remain open | `MeansDialog.cs`, `Means.cs`, and `cWorkingTable.cs` audit / 2026-08-27 | Phase 5 V0.10 candidate, parity gaps open |
| REG-0021 | LEGACY-DASHBOARD-001 through LEGACY-DASHBOARD-010 | Adapted branch: distinct Visual Dashboard Rates candidate | Restores the learned Visual Dashboard path and legacy aggregate-of / PER / aggregate-of shape with COUNT equality and non-missing denominator semantics; all other aggregates, conditions, distinct counts, grouping, sorting, filters, display, export, saved canvas behavior, and consolidated G5 approval remain open | `RatesProperties.xaml(.cs)`, `RatesControl.xaml.cs`, and `RatesParameters.cs` audit / 2026-08-27 | Phase 5 V0.11 candidate, parity gaps open |
| REG-0022 | LEGACY-STATCALC-002, LEGACY-STATCALC-003 | Adapted branch: Population Survey sample-size candidate | Restores the first learned StatCalc menu item, legacy defaults/input order, simple-random-sampling guidance, and seven-row cluster/total table using the audited C# calculation sequence; Save as Image, Print, broader corpora, and consolidated G5 approval remain open | `StatCalcMenu.xaml` and `PopulationSurvey.xaml(.cs)` audit / 2026-08-27 | Phase 5 V0.12 candidate, parity gaps open |
| REG-0023 | LEGACY-STATCALC-004 | Adapted branch: Cohort or Cross-Sectional sample-size candidate | Restores the second learned StatCalc menu item, linked risk/odds/outcome inputs, and exposed/unexposed/total Kelsey and Fleiss output table using the audited C# sequence; Save as Image, Print, broader corpora, and consolidated G5 approval remain open | `StatCalcMenu.xaml` and `Cohort.xaml(.cs)` audit / 2026-08-27 | Phase 5 V0.13 candidate, parity gaps open |
| REG-0024 | LEGACY-STATCALC-005 | Adapted branch: Unmatched Case-Control sample-size candidate | Restores the third learned StatCalc menu item, linked odds/case-exposure inputs, and cases/controls/total Kelsey and Fleiss table using a distinct contract over the shared audited core; Save as Image, Print, broader corpora, and consolidated G5 approval remain open | `StatCalcMenu.xaml` and `UnmatchedCaseControl.xaml(.cs)` audit / 2026-08-27 | Phase 5 V0.14 candidate, parity gaps open |
| REG-0025 | LEGACY-STATCALC-006 | Adapted branch: Chi Square for Trend candidate | Restores the fourth learned StatCalc menu item, editable Exposure Score/Cases/Controls rows, Add Row, reference-row odds ratios, and Extended Mantel-Haenszel result using audited Rust/WASM formulas; Save/Print, broader corpora, zero-cell decisions, and G5 remain open | `ChiSquareControl.xaml(.cs)` audit / 2026-08-27 | Phase 5 V0.15 candidate, parity gaps open |
| REG-0026 | LEGACY-FORM-003 | Clarified branch: validation rules follow field data type | Filters the rule editor by field type and rejects incompatible serialized combinations at the project boundary; incompatible saved rules are disclosed before removal rather than silently executed | Demo review / 2026-08-27 | Phase 4 hardening, broader rule parity open |
| REG-0027 | LEGACY-FORM-003, LEGACY-MAPS-001 | New branch: coordinate-aware Number validation | Allows a Number field to be designated latitude or longitude, enforces signed decimal-degree range and at least five retained decimal places across entry/import validation, and adds the rule automatically when tabular schema inference recognizes coordinate columns | Demo review / 2026-08-27 | Phase 4/Maps hardening; CRS and directional-notation adapters remain open |
| REG-0028 | LEGACY-FORM-012, LEGACY-ENTER-010, LEGACY-MAPS-016 | Clarified legacy floor and bounded implementation: acquire coordinates before mapping | Implements the documented Address -> Get Coordinates/GEOCODE -> review/select -> coordinate fields workflow as a four-field template, typed Click statement, provider boundary, failure-without-mutation behavior, and Case Cluster handoff. Map clicks in the inspected desktop implementation add marker/text/zone overlays; click-to-record harvesting remains a possible new branch | Epi Info 7 User Guide plus `Geo_Location.xml`, `GuiMediator.IEnterCheckCode.cs`, `Rule_Geocode.cs`, geocode-result dialog, and map-control audit / 2026-08-28 | Desktop parity candidate; approved scalable provider, provenance, fuller result semantics, and user review open |
| REG-0029 | LEGACY-ENTER-010, LEGACY-MAPS-014, LEGACY-MAPS-016 | New branches: resilient coordinate acquisition without geocoding | Keeps manual/imported coordinates available, adapts permission-gated browser GPS, and reserves a click-map picker over online/cached/blank maps; never fabricates a geocode and always exposes acquisition status/provenance | Demo review / 2026-08-27 | Design recorded; entry workflow not started |
| REG-0030 | LEGACY-DASHBOARD-011 through LEGACY-DASHBOARD-020 | Adapted branch: bounded Visual Dashboard Epi Curve | Restores the familiar main-date, grouping, interval/step, bounds, and missing-value entry path with a browser-rendered stacked histogram and accessible data table; stacking is provisional and does not replace legacy faceting, while weighting, chart properties, export, persistence, the general gadget canvas, and all other chart types remain open | `DashboardControl.xaml`, `ChartControl.xaml(.cs)`, and `HistogramChartProperties.xaml(.cs)` audit / 2026-08-28 | Phase 5 V0.16 prototype, parity gaps open |
| REG-0031 | LEGACY-AI-001 through LEGACY-AI-006 | New branch: Epi Assist with local IBM Granite | Adds user-initiated browser-local inference and typed, reviewed handoffs to existing Data Quality, FREQ, and Epi Curve workflows; it does not replace familiar screens or deterministic Rust/TypeScript operations | Project direction / 2026-08-28 | V0.1 prototype; distribution, device, security, privacy, and governance gaps open |
| REG-0032 | LEGACY-ANALYSIS-007, LEGACY-AI-003 | Adapted branch: bounded single-variable FREQ stratification | Restores one legacy `STRATAVAR` selector and within-stratum output, renders canonical `FREQ field STRATAVAR=strata`, and permits Epi Assist to select the same typed operation; Granite cannot submit or execute free-form program source | `FrequencyDialog.cs`, `Frequency.cs`, demo review / 2026-08-28 | Phase 5 V0.9.1 candidate; multiple strata, broader corpus, and G5 remain open |
| REG-0033 | LEGACY-PROGRAM-014, LEGACY-PROGRAM-017, LEGACY-AI-005 | New branch: unified command and run history | Requires every manual, user-program, visual-flow, reviewed-AI, and approved-plugin operation to append the same canonical command and immutable provenance while retaining its origin and approval state | Project direction / 2026-08-28 | Phase 5B design requirement, implementation open |
| REG-0034 | LEGACY-AI-006 | New branch planned: governed cross-instance learning events | Separates local audit history from explicit opt-in, minimized, previewable submissions to a CDC-controlled quarantine and review pipeline; raw history and live synchronization stores are prohibited as direct fine-tuning sources | Project direction / 2026-08-28 | Governance design, implementation prohibited until approval |
| REG-0035 | LEGACY-PROGRAM-015 | Clarified legacy evidence: classified programming curriculum corpus | Catalogues representative command sequences taught by CDC, links each to its source and browser execution policy, and promotes them progressively into parser, execution, parity, and reviewed fixtures; training priority does not override legacy semantics | CDC training/User Guide/NIOSH materials / 2026-08-28 | IDE-0 registry established; executable fixtures open |
| REG-0036 | LEGACY-PROGRAM-001, LEGACY-PROGRAM-004, LEGACY-PROGRAM-005, LEGACY-PROGRAM-009, LEGACY-PROGRAM-014, LEGACY-PROGRAM-015 | Adapted branch: first bounded executable Classic Program | Adds visible editable source, line diagnostics, typed/canonical `DEFINE TEXTINPUT -> numeric RECODE -> FREQ [STRATAVAR]`, structured output, and local verify/run/reject history over the foodborne AgeGroup example; source is never evaluated and appended `EXECUTE` fails closed | CDC RECODE example plus legacy grammar/source audit / 2026-08-28 | Phase 5B V0.1 candidate; general IDE and unified-history gaps open |
| REG-0037 | LEGACY-PROGRAM-003, LEGACY-PROGRAM-009, LEGACY-PROGRAM-012 | New branch: schema-aware Program Editor assistance | Replaces the bounded plain text control with CodeMirror 6 while preserving editable Epi Info source; adds syntax highlighting, line numbers, `Ln/Col`, persistent tab width and tabs/spaces settings, live bounded-parser diagnostics, and deterministic type-filtered completion after `RECODE`, `TO`, `FREQ`, and `STRATAVAR`, without changing execution authority | Legacy `ProgramEditor` source audit, CodeMirror 6 official completion/lint APIs, and foodborne browser test / 2026-08-28 | Phase 5B IDE enhancement prototype; familiar command dialogs, broader grammar assistance, accessibility review, and bundle-budget review remain open |
| REG-0038 | LEGACY-PROGRAM-007, LEGACY-PROGRAM-009 | Clarified legacy parser asset: GOLD Parser LALR grammar and interpreter rules | Records that Analysis and Enter use `.grm` -> compiled `.cgt` grammar tables, Calitha GOLD Parser Engine LALR parsing, and nonterminal-to-rule-object construction; `cAST` classes exist, but this is not ASN.1 and the reviewed Analysis runtime does not expose a portable versioned AST contract | `EpiInfo7EventGrammar.cs`, `AnalysisRule.cs`, grammar projects, and `cAST.cs` audit / 2026-08-28 | Phase 5B parser migration input; initial browser AST delivered in REG-0039 |
| REG-0039 | LEGACY-PROGRAM-004, LEGACY-PROGRAM-007, LEGACY-PROGRAM-009, LEGACY-PROGRAM-018, LEGACY-PROGRAM-020 | New branch foundation: versioned typed browser AST | Adds TypeScript AST `0.1.0`, statement/expression source spans, nested-block parsing, and syntax diagnostics for `READ`, `FREQ`, `TABLES`, `RECODE`, `DEFINE`, `ASSIGN`, `IF`, and `SELECT`. Parsing never evaluates source and does not expand the existing bounded executor; semantic resolution, canonical printing, planning, and broader execution remain separate gates | Legacy Analysis grammar and rules plus Phase 0 AST fixtures / 2026-08-28 | Phase 5B parser V0.1; compatibility expansion and semantic/planning layers open |
| REG-0040 | LEGACY-PROGRAM-004, LEGACY-PROGRAM-005, LEGACY-PROGRAM-015 | Adapted branch: dataset-bound runnable example programs | Adds a versioned program catalog beside the checksummed foodborne CSV/XLSX with examples for life-stage groups by Sex, broad age bands by Case Status, and age decades. Selection loads ordinary visible/editable source with declared required fields; every example passes the same AST, semantic checks, bounded planner, history, and output path as user source | Foodborne fixture/catalog and Program Editor browser test / 2026-08-28 | Phase 5B dataset example library V0.1; portable-project attachment and broader curriculum promotion remain open |

No legacy branch is currently approved for deprecation or retirement.

## Compatibility floor

The reviewed legacy capability set is a floor, not an aspirational menu. Epi
Info AI may initially leave a capability open as a named gap, but it must not:

- silently remove the capability from the backlog because the prototype lacks it;
- reuse familiar terminology for a materially narrower behavior without saying so;
- close a gap based only on the presence of a control;
- replace a learned menu path without experienced-user review; or
- let a new branch displace an unfinished legacy branch.

A legacy capability can leave the floor only through an explicit, reviewed
**retire** decision that documents why reproducing it would be unsafe,
unsupported, or inapplicable and identifies the replacement workflow. Releases
must report any floor regression as a blocking defect.
