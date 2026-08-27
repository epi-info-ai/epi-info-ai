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

## Workflow baseline

The manual and C# code define two related entry points:

1. **Main Menu > Create Maps** opens a standalone mapping workspace where the
   user chooses a project/form data source.
2. **Enter Data > Maps** opens a map linked to the current form and records and
   can return to a selected record.

These entry points must remain distinct even when they share a browser map host.
The old menu tree remains the navigation tree; new browser capabilities are new
branches rather than replacements for learned paths.

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
| LEGACY-MAPS-015 | GeoTIFF raster | No inspected legacy equivalent | Checksummed WGS 84 WorldPop test fixture; renderer TODO | Defer as a new reference/raster layer |

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
