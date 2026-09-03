# Maps legacy compatibility inventory

## Purpose

The existing C# Epi Info Maps implementation and the Epi Info 7 User Guide are
the behavioral starting point for Epi Info AI Maps. The current Leaflet demo is
an implementation prototype, not the product definition. Phase 2 therefore
types the browser boundary around the legacy concepts before additional map
features are added.

This module inventory is governed by the
[legacy capability register](legacy-capability-register.md). Its stable Maps gap
IDs are the bridge from legacy discovery to implementation work.

This inventory separates four decisions:

- **Preserve**: keep the familiar workflow and terminology.
- **Adapt**: retain the capability using browser-appropriate technology.
- **Defer**: represent the capability in contracts and plans, but do not add it
  during the behavior-preserving TypeScript migration.
- **Retire**: do not reproduce a platform-specific implementation detail.

## Sources inspected

- `source/Epi-Info-Community-Edition/EpiDashboard/Mapping/StandaloneMapControl.xaml.cs`
- `source/Epi-Info-Community-Edition/EpiDashboard/Mapping/MapControl.xaml.cs`
- `source/Epi-Info-Community-Edition/EpiDashboard/Mapping/IMapControl.cs`
- `source/Epi-Info-Community-Edition/EpiDashboard/Mapping/ILayerProvider.cs`
- `source/Epi-Info-Community-Edition/EpiDashboard/Mapping/ILayerProperties.cs`
- `source/Epi-Info-Community-Edition/EpiDashboard/Mapping/IReferenceLayerProperties.cs`
- `source/Epi-Info-Community-Edition/EpiDashboard/Mapping/LayerList.xaml.cs`
- `source/Epi-Info-Community-Edition/EpiDashboard/Mapping/TimeLapse.xaml.cs`
- the layer provider/property classes in the same directory
- Epi Info 7 User Guide, Maps chapter, manual pages 10-1 through 10-36
- Epi Info 7 User Guide, Form Designer Geo-location template and Check Code
  GEOCODE workflow
- `Epi.Windows.Enter/PresentationLogic/GuiMediator.IEnterCheckCode.cs`
- `Epi.Core.EnterInterpreter/Rules/Rule_Geocode.cs`
- PMTiles v3 specification: <https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md>
- MapLibre GL JS custom protocol API:
  <https://maplibre.org/maplibre-gl-js/docs/API/functions/addProtocol/>
- OpenStreetMap Foundation Tile Usage Policy:
  <https://operations.osmfoundation.org/policies/tiles/>
- Origin Private File System overview:
  <https://developer.mozilla.org/docs/Web/API/File_System_API/Origin_private_file_system>

## Workflow baseline

The manual and C# code define two related entry points:

1. **Main Menu > Create Maps** opens a standalone mapping workspace where the
   user chooses a project/form data source.
2. **Enter Data > Maps** opens a map linked to the current form and records and
   can return to a selected record.

These entry points must remain distinct even when they share a browser map host.
The old menu tree remains the navigation tree; new browser capabilities are new
branches rather than replacements for learned paths.

Coordinate acquisition is a preceding Forms/Enter workflow, not a replacement
Maps workflow. The documented desktop sequence is Address -> Get Coordinates ->
GEOCODE result review -> Accept into Latitude/Longitude fields. Maps then selects
those existing numeric fields for Case Cluster or Point layers. The legacy map
surface allows manual markers, text, and zones at a clicked/right-clicked point;
the inspected manual and C# do not establish click-map-to-record-field harvesting.
A future browser point picker must therefore be registered as a new branch.

## Capability comparison

| Gap | Legacy capability | Evidence in C# / manual | Browser prototype | Decision |
|---|---|---|---|
| LEGACY-MAPS-001/002 | Case cluster data layer | `CaseCluster`, coordinate fields, filters, colors, flare behavior | Record points and popups | Preserve; adapt clustering/flare behavior after Phase 2 |
| LEGACY-MAPS-003 | Choropleth data layer | Shape, KML, and map-server providers; data/feature joins; classes and legends | GeoJSON polygon rendering and labels | Preserve; adapt sources and classification after Phase 2 |
| LEGACY-MAPS-004 | Dot-density data layer | Shape, KML, and map-server providers; joins and dot-value configuration | Not implemented | Defer, but reserve a typed layer kind |
| LEGACY-MAPS-001 | Point data layer | `Point` layer type and point provider | Record point layer | Preserve |
| LEGACY-MAPS-005 | Reference layers | Shapefile, KML, and map-server reference providers | Browser-local GeoJSON | Preserve concept; adapt file/service formats incrementally |
| LEGACY-MAPS-006 | Layer list | Ordered list, move up/down, close, edit, legend, data/reference distinction | Compact visibility controls | Preserve and extend to order/edit/remove |
| LEGACY-MAPS-006 | Layer drawing order | Provider movement and ordered layer list | Explicit raster/polygon/line/point panes | Preserve; enforce raster < polygon < line < point |
| LEGACY-MAPS-011 | Basemaps | Satellite, Street, Blank | Online street tiles and blank/offline mode | Preserve names; adapt providers and policy controls |
| LEGACY-MAPS-007 | Marker, text, and zone overlays | `Marker`, `Text`, and `Zone` layer types | Current-location marker only | Defer user-authored overlays; reserve typed kinds |
| LEGACY-MAPS-009 | Time lapse | Date/time field, cumulative stops, run/pause/step, distribution chart | Cumulative point animation | Preserve; type the time configuration and retain the 1,000-stop safety concept |
| LEGACY-MAPS-008 | Save/open map | `.map7` XML serializes layers and spatial reference | No portable map document | Adapt later to a versioned JSON map document with compatibility import where practical |
| LEGACY-MAPS-008 | Save image | PNG export | Not implemented | Defer |
| LEGACY-MAPS-002 | Filters and stratification | Filter requests and multiple colored case layers | Not implemented | Defer; keep filters in the layer definition |
| LEGACY-MAPS-003/006 | Legends | Per-layer legend stack | Counts and layer controls | Preserve and generalize |
| LEGACY-MAPS-012 | Record linkage | record-selected and date-range events | Popup can open an Enter Data record | Preserve with typed callbacks |
| LEGACY-MAPS-010 | Coordinate systems | ESRI spatial references | WGS 84 GeoJSON/record coordinates only | Adapt through explicit CRS metadata and reprojection; never silently guess |
| LEGACY-MAPS-013 | H3 aggregation | No legacy equivalent | Configurable H3 cells | Keep as a new branch under data layers |
| LEGACY-MAPS-014 | Browser geolocation | No desktop equivalent | One-shot browser geolocation | Keep as a new, permission-gated branch |
| LEGACY-MAPS-015 | GeoTIFF raster | No inspected legacy equivalent | Bounded WGS 84 first-band renderer with WorldPop fixture, color ramp, opacity, visibility, removal, and raster pane | Keep as a new branch; add reprojection, styling/legend breadth, persistence, and richer nodata controls |
| LEGACY-MAPS-016 | Click map to populate record coordinates | No inspected desktop manual/code equivalent; clicks support marker/text/zone placement | Not implemented | Optional future new branch only; do not substitute it for the legacy Geo-location/GEOCODE and Case Cluster field-selection workflows |
| LEGACY-MAPS-017 | Browser-local offline map package | No inspected desktop equivalent; legacy Street/Satellite providers are online mechanisms | New Project PMTiles v3 import validates signature/version, section bounds, WGS 84 coverage, zoom range, size, attribution, license, and SHA-256, then writes only an applied archive to OPFS and stores typed provenance. Maps re-verifies and renders raster packages through Leaflet or MVT through a local-protocol MapLibre canvas while suppressing Street requests. Save Project As embeds the raw archive in a bounded `.epia` backup; Open Project verifies and restores it under a new OPFS path. Missing/corrupt storage fails to blank and offers backup restore, exact-digest re-import, or detach | New branch. Browser-verified bounded raster/vector, backup/restore, and reactive eviction-recovery candidate; cartographic style review, exhaustive archive validation, proactive quota-pressure warning, and network-disabled field acceptance remain open |
| LEGACY-MAPS-018 | Classic Analysis `MAP` programming command revival | Grammar defines thematic `AVG`, `CASE_BASED`, `SUM`, `COUNT`, `MIN`, and `MAX` forms plus denominator, output-table, title, template, and silent options; the shipped Command Explorer calls “feature not implemented” and interpreter cases do not execute | Not implemented | Revival/new branch backlog. Preserve the dormant familiar `MAP` spelling and grammar where safe, establish legacy intent with programs/output evidence, and route results into typed map layers. Modern GeoJSON, H3, GeoTIFF, offline-package, and spatial-analysis syntax must be separately labeled new branches rather than silently attributed to the legacy command. |

## TypeScript layer model

The browser contract should model durable intent, not Leaflet runtime objects.
Every map layer definition needs:

- a stable layer ID, name, kind, visibility, and drawing order;
- a source definition (current form, project form, local file, or remote service);
- optional record filter and field mappings;
- style and legend configuration;
- optional data-to-feature join configuration;
- optional time-lapse configuration;
- source provenance and coordinate-reference-system metadata; and
- a version suitable for future project/map serialization.

Leaflet layers, event objects, controls, and map instances belong in a confined
adapter. They must not be stored in project snapshots or exposed as application
contracts. This mirrors the useful separation in the C# implementation between
layer properties, providers, and the map control while avoiding WPF/ESRI coupling.

## Platform adaptations

The following C# implementation details are platform-specific mechanisms that are
not ported directly; this does not retire the user-facing capabilities they serve:

- WPF controls, Windows dialogs, and `System.Windows` event types;
- ESRI ArcGIS WPF runtime objects as the serialized model;
- Bing/legacy provider credentials embedded in a desktop client;
- unrestricted local paths and synchronous file access; and
- XML type names that instantiate arbitrary .NET classes.

Browser replacements use user-selected files, HTTPS services with explicit
cross-origin support, permission-gated geolocation, versioned JSON contracts,
validated inputs, and provider adapters. A remote spatial service that requires
secrets must be accessed through an approved server-side boundary rather than
placing the secret in WASM or JavaScript.

### Browser-local offline basemap boundary

The public OpenStreetMap Standard endpoint remains an online preview provider;
ordinary HTTP cache entries are evictable and do not prove complete coverage.
The preferred offline branch is one explicit PMTiles v3 archive selected by the
user or retrieved from an approved source, with no runtime server dependency.
Before OPFS storage, the browser validates the header signature/version and
section ranges, requested study-area and zoom coverage, the 100 MiB project
limit, required attribution/license text, and a full-file SHA-256 digest.

Applying the study area writes the validated `File` to
`epi-info-ai/offline-maps/<import-id>-<sha256>.pmtiles`; cancelling/removing the pending
study area removes that uncommitted asset. The project snapshot stores only the
safe path, digest, byte length, coverage, formats, attribution/license,
imported-at timestamp, and persistent-versus-best-effort storage status. It does
not embed the archive. The portable plan remains `stored-unverified` because a
snapshot can move independently of browser storage. At Maps activation the
bounded reader reopens the local file, verifies its size, SHA-256, and recorded
header, decodes its PMTiles directory, and renders raster tile types through a
Leaflet grid layer or metadata-declared MVT source layers through a non-interactive
MapLibre canvas, with Street removed. Runtime verification does not rewrite
the portable snapshot. The binary project export includes the external archive
and restore creates a new verified OPFS copy. Maps classifies missing, corrupt,
and storage-unavailable states before claiming readiness and retains the expected
digest/provenance for recovery. True offline readiness still requires proactive
quota-pressure warning and network-disabled field acceptance.

## Phase 2 compatibility gate

The Maps conversion is complete only when:

- both legacy launch contexts still work;
- record coordinate inference, plotting, popups, Enter Data linkage, GeoJSON,
  labels, H3, time lapse, geolocation, fullscreen, and layer visibility retain
  their current behavior;
- external records, GeoJSON, geolocation, and browser-library values cross typed
  and validated boundaries;
- Leaflet-specific untyped code is confined to a documented adapter boundary;
- pure map transformations have automated tests; and
- no deferred legacy capability is presented as already implemented.
