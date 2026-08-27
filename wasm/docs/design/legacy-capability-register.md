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
| Visual Dashboard | Pending | Code-asset and feature inventory pending |
| Create Maps / Enter Data > Maps | `maps-compatibility-inventory.md` | Initial C# and manual audit complete; gap IDs below |
| StatCalc / Classic Analysis TABLES | `statcalc-compatibility-inventory.md` | Direct and stratified 2 x 2 floor recorded; candidate MH slice implemented |
| Storage / project formats | `storage-compatibility-inventory.md` | Initial legacy/browser boundary audit and Phase 3C state contract recorded |

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
| LEGACY-MAPS-015 | GeoTIFF raster (new branch) | WorldPop test fixture included; renderer TODO | Local raster import, CRS/nodata/style controls, limits, raster pane |

## Shell gap register

The detailed evidence and closure gates for `LEGACY-SHELL-001` through
`LEGACY-SHELL-007` are maintained in `shell-compatibility-inventory.md`. Phase 3A
adapts the same old-tree launcher across screen sizes; it does not add, deprecate,
or retire a workflow branch.

## Enter Data gap register

The detailed evidence and closure gates for `LEGACY-ENTER-001` through
`LEGACY-ENTER-009` are maintained in `enter-data-compatibility-inventory.md`.
Phase 3B changes the narrow-screen presentation only. It preserves the Enter Data
branch, field order, storage contracts, wider-screen panels, and linked Maps path.

## Form Designer gap register

The detailed evidence and closure gates for `LEGACY-FORM-001` through
`LEGACY-FORM-011` are maintained in `form-designer-compatibility-inventory.md`.
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

The detailed floor and closure evidence for `LEGACY-STATCALC-001` and
`LEGACY-ANALYSIS-001` through `LEGACY-ANALYSIS-006` are maintained in
`statcalc-compatibility-inventory.md`. Candidate adjusted estimates do not close
the dataset-selection, exact-stratified, homogeneity, or validation gaps.

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
| REG-0003 | LEGACY-MAPS-015 | New branch planned: GeoTIFF raster reference layer | Adds browser-local raster support beneath vector layers | Project direction / 2026-08-26 | TODO, open gap |
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
| REG-0018 | LEGACY-ANALYSIS-005 | Adapted branch: bounded exact adjusted OR inference | Ports the conditional product-hypergeometric CMLE and central Fisher limits with explicit zero/infinity/unavailable states and reviewed support/work limits; broader legacy parity, performance evidence, and formal review remain open | `Strat2X2.vb` audit / 2026-08-27 | Phase 5 V0.8 candidate, parity gap open |

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
