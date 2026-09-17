# Legacy Epi Info geospatial mapping review

**Review date:** 2026-09-17  
**Legacy baselines:** Epi Map 2 for the Epi Info 6/DOS generation, plus Epi
Info Community Edition commit `4cd353c62c40b78d9d1f013b0f5a2bb685a5fca6`  
**Purpose:** establish the minimum geospatial behavior that Epi Info AI must
preserve or deliberately adapt before it can claim mapping parity.

## Executive conclusion

There are two distinct historical baselines. In the Epi Info 6/DOS generation,
**Epi Map 2** was a companion mapping application. Epi Info `ANALYSIS` programs
prepared summary `.REC` data, and a DOS batch file then launched `EPIMAP` with a
saved `.MAP` document. Epi Map also had its own `.EMP` interaction programs.
This was genuine geospatial functionality, but the reviewed manual does not
document a Classic `MAP ...` analysis-language statement.

Epi Info 7 later exposed one shared mapping engine through two user workflows:

1. **Main Menu > Create Maps** opened a standalone mapping workspace and asked
   the user to select a data source.
2. **Enter Data > Maps** opened the same mapping workspace in the context of the
   current form and allowed a mapped record to reopen in Enter Data.

The legacy parity floor is therefore larger than displaying points on a web map.
It includes four data-layer types, three reference-layer sources, filters,
thematic styling and legends, time lapse, layer ordering, portable `.map7` map
documents, PNG export, and the linked Enter Data workflow.

Several important boundaries must remain explicit:

- Legacy **Case Cluster** is display-scale aggregation using an ESRI
  `FlareClusterer`; it is not an inferential cluster-detection method.
- The Classic Analysis **`MAP`** command is present in the grammar but was
  explicitly marked unimplemented in the inspected desktop UI and interpreter.
  Implementing it in Epi Info AI is a revival/new branch, not restored executable
  Epi Info 7 parity. The Epi Map 2 evidence does not change that conclusion:
  its executable command was `EPIMAP`, not the later grammar's `MAP ...`
  statement.
- The active desktop geocoding workflow uses an address, an online Bing/Virtual
  Earth service, a result-selection dialog, and latitude/longitude fields. The
  inspected source does not establish map-click coordinate harvesting as the
  legacy record-entry workflow.
- H3, GeoJSON/GeoTIFF project assets, PMTiles offline packages, browser
  geolocation, space-time cluster detection, and story tours are valuable Epi
  Info AI additions, but they are new branches and do not replace the legacy
  floor.

## Evidence and status vocabulary

This review treats the Epi Info 7 checked-in source and the CDC Epi Map 2 manual
as primary evidence. It distinguishes:

- **Active legacy:** an exposed control calls a concrete implementation.
- **Partial/disabled legacy:** implementation artifacts exist, but the inspected
  surface comments out, hides, or disables the path.
- **Dormant legacy:** syntax or a menu entry exists, but execution explicitly
  reports that the feature is not implemented.
- **AI adaptation:** the same user capability is implemented with a safe browser
  mechanism.
- **New branch:** a capability has no demonstrated legacy equivalent.

Source presence alone is not proof that a user could successfully complete the
workflow in every Epi Info 7 release. Nor should Epi Map 2 terminology be
silently projected onto Epi Info 7. Differential testing by experienced users
remains the acceptance authority for details that cannot be proven from the
source or manual.

## Legacy workflow surfaces

### Historical Epi Info 6 and Epi Map 2

The uncommitted reference PDF
`../reference/Epi-Map-DOS-125842.pdf` is the 148-page **Epi Map 2 User's Guide**
for the Epi Info 6/DOS generation (SHA-256
`0a10c8732f8ba437f659ff21f2fcb8770effe3fc01f62ee365ee149e94d90eb5`). It
establishes a broader historical mapping baseline than the later Epi Info 7
source alone:

- color/pattern maps, dot-density maps, and value-scaled cartograms;
- editable polygon boundary (`.BND`) files and Epi Info/dBASE data;
- map type, class/pattern/color, dot value, boundary color/thickness, labels,
  legends, titles, text, boxes, lines, and three-dimensional shading;
- several maps on one screen and saved `.MAP` documents;
- printed output and CGM, TIFF, DXF, IMG, PCX, NAPLPS, and WordPerfect Graphics
  export formats;
- point-and-click geographic regions that can display Epi Info records, text,
  hypertext, another map, or commands from an Epi Map `.EMP` program; and
- automated surveillance mapping through Epi Info 6 `ANALYSIS` `.PGM` files,
  DOS batch files, and command-line `EPIMAP <map>` invocation.

The manual's supplied `HEPRATES` example makes the integration boundary clear:
an Epi Info `ANALYSIS HEPRATES.PGM` program uses commands such as `READ`,
`SELECT`, `ROUTE`, and `OUTPUT TABLES` to produce a rate data file. The batch
workflow then opens a previously configured Epi Map `.MAP` document. Therefore:

- `.MAP` is primarily an Epi Map document and **SAVE MAP** is an Epi Map menu
  action in this generation;
- `EPIMAP` is the DOS executable/command used to display or print that document;
- `.EMP` is Epi Map's separate interaction-program format; and
- this manual does not establish the Epi Info 7-style `MAP AVG(...)`,
  `MAP CASE_BASED(...)`, or related forms as executable Epi Info 6 `ANALYSIS`
  commands.

For parity planning, Epi Info 7 remains the immediate UI floor. Epi Map 2 is a
historical capability inventory: features absent from Epi Info 7, such as
cartograms or active-region `.EMP` behavior, require an explicit preserve,
adapt, defer, or retire decision rather than being silently lost.

### Standalone Create Maps

The desktop main menu registers **Create Maps** as an application module. Its
`MapMainForm` hosts `StandaloneMapControl` and handles data-source requests with
the standard Read dialog. It also reports the mouse latitude/longitude in the
window title and supports maximize/restore behavior.

Relevant evidence:

- `../../source/Epi-Info-Community-Edition/Epi.Core/Data/Services/AppData.cs`
- `../../source/Epi-Info-Community-Edition/Epi.Windows.Menu/MenuMainForm.cs`
- `../../source/Epi-Info-Community-Edition/Epi.Windows.Mapping/MapMainForm.cs`
- `../../source/Epi-Info-Community-Edition/EpiDashboard/Mapping/StandaloneMapControl.xaml.cs`

### Enter Data > Maps

`MapViewer` hosts the same standalone map control. When a layer requests data,
the user is asked whether to use external data. Choosing No supplies the current
project and view; choosing Yes opens the standard Read dialog. A selected map
record raises `RecordSelected`, and Enter Data calls `LoadRecord(id)`.

This linked-record behavior is part of parity. A generic point popup without a
path back to the record is insufficient for the Enter Data launch context.

Relevant evidence:

- `../../source/Epi-Info-Community-Edition/Epi.Windows.Enter/Forms/MapViewer.cs`
- `../../source/Epi-Info-Community-Edition/Epi.Windows.Enter/Forms/EnterMainForm.cs`
- `../../source/Epi-Info-Community-Edition/EpiDashboard/Mapping/ClusterLayerProvider.cs`

### Coordinate acquisition before mapping

The supplied Geo-location field template creates Address, Latitude, Longitude,
and Get Coordinates fields. Its Click Check Code runs:

```text
GEOCODE Address, Latitude, Longitude
```

The Enter interpreter sends the address to the configured Bing/Virtual Earth
REST endpoint, offers up to seven results, and assigns the selected latitude and
longitude only after confirmation. The Check Code design dialog restricts the
address selector to text fields and the coordinate selectors to numeric fields.
No-result, invalid-key, and connectivity messages are explicit.

Browser parity should preserve the recognizable Address -> Get Coordinates ->
review/select -> populate numeric coordinate fields sequence, while replacing
the retired provider and secret handling. Manual coordinate entry must remain
available when no geocoder is reachable.

Relevant evidence:

- `../../source/Epi-Info-Community-Edition/Epi.Core/Templates/Fields/Geo_Location.xml`
- `../../source/Epi-Info-Community-Edition/Epi.Core.EnterInterpreter/Rules/Rule_Geocode.cs`
- `../../source/Epi-Info-Community-Edition/Epi.Windows.Enter/PresentationLogic/GuiMediator.IEnterCheckCode.cs`
- `../../source/Epi-Info-Community-Edition/Epi.Windows.Enter/Dialogs/GeocodeSelectionDialog.cs`
- `../../source/Epi-Info-Community-Edition/Epi.Windows.MakeView/Dialogs/CheckCodeCommandDialogs/GeocodeDialog.cs`

## Legacy capability inventory and parity floor

| Capability | Observed legacy behavior | Classification | Minimum Epi Info AI parity |
|---|---|---|---|
| Separate launch contexts | Create Maps selects a source; Enter Data Maps can use the current form or external data and return to a record | Active legacy | Keep both entry points and context-specific defaults; share an internal map host without erasing the workflow distinction |
| Spot Map | Select data source, latitude field, longitude field, description, marker style, and color; optionally filter the layer | Active legacy | Plot valid record coordinates, expose source/field/style choices, report skipped rows, support filtering, and preserve record linkage where launched from Enter Data |
| Case Cluster | Select source, latitude/longitude, description, color, and filter; render records through `FlareClusterer` with radius 15, maximum 10 flares, zoom-dependent separation, and record selection | Active legacy | Provide visual aggregation that expands with zoom and can reveal/select member records; do not describe statistical CLUSTER output as this parity feature |
| Choropleth | Use Shapefile, KML, or ArcGIS Map Server boundaries; select data key, feature key, and value; configure classes/ranges, quantiles, start/end/missing colors, opacity, legend text/title, polygon labels, and filters | Active legacy | Join tabular data to polygons with explicit unmatched/missing diagnostics; offer classification, editable legend/style, opacity, labels, filters, and all supported boundary-source adapters |
| Dot Density | Use Shapefile, KML, or Map Server boundaries; select data key, feature key, and value; configure dot value and color; apply filters | Active legacy | Join data to boundaries and generate deterministic dots with disclosed value-per-dot, seed/placement policy, unmatched diagnostics, legend, style, and filters |
| Reference/base layer | Add Shapefile, KML, or ArcGIS Map Server content independently of a data join | Active legacy | Add non-analytic reference layers through explicit local-file/service adapters; retain provenance, CRS, visibility, order, edit, and remove state |
| Data sources | Standard Read dialog supports a selected source/member and, in standalone mapping, an SQL query | Active legacy | Support current-project forms first; add governed external/file sources through explicit user grants. Never infer ambient filesystem access |
| Layer list and order | Shows map-layer count; closes individual/all layers; moves layers up/down; serializes layers; distinguishes data and reference layers | Active legacy | Persistent layer panel with visibility, order, edit, remove, count, layer kind, legend, and deterministic draw order |
| Layer editing and filters | Generated data layers can reopen their configuration and attach row filters | Active legacy | A saved layer must retain editable source mappings, styling, filter expression, and provenance; edits must be auditable and reversible |
| Legends | Choropleth/range and layer legends appear in a legend stack that can be shown/hidden | Active legacy | Render accessible legends derived from actual classification/style state, including missing/excluded values |
| Street and blank backgrounds | Uses an online OpenStreetMap layer unless Sparse Connection is enabled; blank is used for sparse/offline operation | Active legacy | Preserve Street and Blank choices, show network/provider state, attribution, and a clean no-network failure path |
| Satellite background | Enum/default and some labels remain, but the inspected standalone control comments out satellite switching | Partial/disabled legacy | Do not claim active desktop parity from source presence alone. Treat a configured imagery provider as an adaptation requiring licensing, attribution, and credential review |
| Navigation and orientation | Pan/zoom navigation control, constrained extent, wraparound, north arrow, scale line, scale-color option, maximize/restore, and fit through layer extents | Active legacy | Retain keyboard/mouse/touch pan and zoom, fit layers, fullscreen, scale, orientation, and accessible controls; show CRS and pointer coordinates |
| Mouse coordinates | Standalone host updates its title with latitude/longitude as the pointer moves | Active legacy | Display WGS 84 pointer coordinates with sufficient precision and an explicit sign; never silently swap latitude/longitude |
| Marker and label overlays | Right-click location can add a configurable marker or text label | Active legacy | Add/edit/move/remove user annotations and preserve them with the map/project |
| Zone overlay | Provider/properties and handler exist, but the standalone context-menu item is commented out | Partial/disabled legacy | Do not count Zone as an active parity blocker until desktop differential review establishes a reachable workflow; track it separately |
| Scale bar | Right-click menu can toggle it; double-click/configuration supports units and automatic contrast | Active legacy | Visible, unit-correct scale with show/hide and contrast behavior |
| Time lapse | Select a Date, DateTime, or Time field; reject more than 1,000 stops; use cumulative-from-start animation with play/slider and an interval distribution chart | Active legacy | Select eligible temporal fields, enforce a disclosed stop limit, provide play/pause/step/slider, cumulative counts, date label, and distribution chart |
| Save/Open map | `.map7` XML stores serialized data/reference/graphics layers and `street` or `blank` background; open reconstructs sources and reports failures | Active legacy | Versioned portable map document or project state that round-trips layer order/configuration, filters, styles, legends, annotations, source provenance, CRS, extent, and background; stale/missing sources must fail visibly |
| Save as image | Hides editing/navigation chrome and writes a PNG of the map layout | Active legacy | User-initiated PNG export with map, visible overlays, legend, title/attribution, and a privacy warning where appropriate |
| Clear map | Closes all layers and clears legend content | Active legacy | Explicit clear action with confirmation when unsaved layer state would be lost |
| CRS handling | ESRI spatial references are used; Shapefile extent code specially transforms WKID 4326 to Web Mercator | Active but narrow legacy | Store source CRS explicitly, reproject through a reviewed adapter, show the display CRS, and reject ambiguous CRS rather than guessing |
| Localization | Mapping strings are drawn from shared resources and localized mapping resource assemblies are present | Active legacy | Put all user-visible mapping strings in the localization catalog; do not embed English-only errors in adapters |

## Layer-specific details to preserve

### Spot and Case Cluster data

The property surfaces enumerate numeric fields for latitude and longitude. The
providers skip unusable coordinates and attach record identifiers to rendered
graphics. Time extent can also be attached when the map has a selected time
variable. Epi Info AI should therefore preserve:

- explicit coordinate-field selection rather than name-only guessing;
- validation of finite signed WGS 84 values and transparent skipped-row counts;
- a display label/description that does not disclose protected fields by
  default;
- filter state scoped to the layer;
- record identity sufficient for an authorized return to Enter Data; and
- a distinct Spot Map representation and Case Cluster aggregation behavior.

### GIS data quality and spatial validation

Epi Info AI should provide a reviewable GIS data-quality report before a layer
is analyzed, exported, or used to calculate spatial statistics. Checks must
produce flags and evidence, not silently rewrite epidemiologic records. Any
suggested correction—particularly a sign change, axis swap, CRS assignment, or
geocoded replacement—requires explicit user review and must be recorded in
history with the original value, proposed value, reason, and actor.

For point data, the minimum checks are:

- missing, blank, non-numeric, non-finite, and out-of-range latitude/longitude;
- explicit signs and at least five decimal places where that precision exists
  in the source, without inventing false precision;
- suspicious `(0, 0)` and default/facility centroid values;
- likely latitude/longitude reversal, misplaced sign, degree/minute/second
  text, or values that appear to be projected coordinates in geographic fields;
- coordinates outside the declared study-area polygon or bounding box, with
  distance and direction to the nearest boundary;
- robust spatial outliers relative to the study area and observed distribution,
  reported separately from the authoritative outside-study-area test;
- exact and near-duplicate coordinates, including many records collapsed onto
  one rounded position, while distinguishing legitimate shared households or
  facilities;
- precision/rounding distribution and geocoding provenance so manually entered,
  map-picked, imported, and address-derived coordinates can be audited; and
- disagreement between coordinates and available administrative codes or
  addresses, labeled as a possible miscoding rather than an automatic error.

For vector and raster assets, checks should include declared/identifiable CRS,
axis order, extent plausibility, empty or invalid geometry, self-intersection,
duplicate features, unclosed rings, unexpected geometry types, extreme vertex
counts, invalid or missing NoData, raster dimensions/bands, pixel size,
geotransform, and overlap with the declared study area. Joins must report
matched, unmatched, multiply matched, duplicate-key, missing-key, and
outside-boundary counts. A spatial join must detect points matching zero or more
than one supposedly non-overlapping polygon.

Every report must disclose its denominator and thresholds. At minimum it should
show total records, records with usable geometry, records excluded from the
map/analysis, counts and percentages by issue code, affected field/layer, and a
record-level review path. Study-area rules, CRS, distance units, duplicate
tolerance, rounding threshold, and outlier method belong in the project or
analysis receipt so reruns are reproducible. Aggregate diagnostics must avoid
revealing sensitive coordinates in exported reports.

These checks extend general `QUALITY` output but do not redefine statistical
outliers as data errors. A geographically unusual case can be epidemiologically
important and must remain available after review unless an authorized user
changes or excludes it.

### Choropleth

The legacy dialog is a multi-stage workflow: data source, boundary source,
variables/join keys, and colors/ranges. It includes up to ten editable classes,
quantile selection, missing/excluded color, low/high ramp colors, opacity,
editable range bounds, editable legend labels, a legend title, optional polygon
labels, and data filters.

Parity must be evaluated against the workflow and output, not merely the ability
to draw a GeoJSON polygon. Required acceptance fixtures should include matched,
unmatched, duplicate, missing, text-key, and numeric-key joins.

#### ColorBrewer enhancement boundary

The inspected legacy source contains no explicit ColorBrewer library, named
scheme catalog, or ColorBrewer selector. Its parity floor is the existing
start/end color ramp, missing/excluded color, quantile or editable class breaks,
and per-class color overrides. Saved Dashboard `palette` and `paletteColorN`
values do not establish a ColorBrewer capability in Epi Map.

Epi Info AI should add ColorBrewer as a labeled new-branch Choropleth
enhancement. The style contract should offer named sequential, diverging, and
qualitative schemes; constrain each scheme to its supported class counts;
identify colorblind-friendly and print-appropriate choices; reverse schemes
without mutating the underlying data; retain an explicit missing/excluded
color; and persist the scheme name, direction, class count, classification
method, breaks, opacity, and any manual overrides. Legends and exports must use
the resolved colors actually rendered. Automated fixtures should verify exact
hex colors and legends for representative 3-, 5-, 7-, and 9-class schemes and
must preserve the legacy manual-ramp path independently.

ColorBrewer palette definitions require attribution to Cynthia Brewer, Mark
Harrower, and The Pennsylvania State University and a license review before
their values are vendored. This enhancement is not evidence of desktop parity.

### Dot density

Dot density is a thematic polygon layer, not a point-record layer. The selected
value and **Dot Value** determine how many dots represent each boundary. A browser
implementation must disclose rounding, deterministic placement/seed, clipping,
maximum-dot safety limits, and zero/missing/negative treatment so repeat runs are
auditable.

### Reference sources

The old source offers:

- paired Shapefile geometry/DBF attributes;
- KML from a location/URL; and
- ArcGIS REST Map Server with feature selection.

Browser adaptations may use file pickers, HTTPS/CORS-safe services, GeoJSON, or
approved conversion tooling. Format substitution is acceptable only when the
user capability and provenance remain visible; adding GeoJSON does not by itself
complete Shapefile, KML, and map-service parity.

## Persistence and project-asset implications

The desktop `.map7` is a map document, not proof that all referenced source files
were embedded. Its XML serializes layer configuration and data-source information,
then reloads the referenced source. Missing views, files, permissions, database
connections, and cryptographic keys are caught and reported during open.

Epi Info AI has chosen a stronger portable-project adaptation: validated map
assets may be stored in OPFS with digest/provenance records and embedded in
portable `.epia`/encrypted `.epiax` packages. That is a new storage behavior, but
it should satisfy the legacy outcome more reliably by keeping code, data, and map
assets together. Round-trip tests must still prove that:

- every visible layer and its order/style/filter/legend return;
- every embedded asset matches its recorded SHA-256 digest;
- missing or evicted OPFS data fails visibly and offers recovery;
- encrypted project import decrypts and validates before changing current state;
- online services and non-embedded references are clearly identified; and
- closing or changing projects clears map outputs that do not belong to the new
  project.

## Dormant Classic Analysis `MAP` command

The grammar contains thematic forms for `AVG`, `CASE_BASED`, `SUM`, `COUNT`,
`MIN`, and `MAX`, plus `DENOMINATOR`, `OUTTABLE`, `TITLETEXT`, `TEMPLATE`, and
`RUNSILENT` variants. However:

- the Command Explorer handles `StatisticsCommands.Map` by displaying the
  feature-not-implemented message;
- the proposed Map dialog invocation is commented out; and
- every `<Map_*_Statement>` falls into the interpreter's explicit unimplemented
  group.

The Epi Map 2 manual documents a related but different programmable workflow:
an Epi Info 6 Analysis program prepares data, then a batch file invokes the
separate `EPIMAP` executable with a saved `.MAP` document. It does not supply
evidence that the Epi Info 7 grammar forms were an executable Epi Info 6 command.

Consequently, Epi Info AI must not describe a future executable `MAP` command as
old executable parity. It should be governed as a revival with:

1. a typed AST and canonical source;
2. field/type and data-source validation;
3. a reviewed layer plan before execution;
4. deterministic joins/classification and bounded output;
5. an audit-history event containing source, normalized plan, versions, and
   aggregate diagnostics; and
6. `.pgm7` fixtures plus independent expected map-layer/output contracts.

Relevant evidence:

- `../../source/Epi-Info-Community-Edition/Epi.Core/Resources/EpiInfoGrammar.txt`
- `../../source/Epi-Info-Community-Edition/Epi.Windows.Analysis/Forms/CommandExplorer.cs`
- `../../source/Epi-Info-Community-Edition/Epi.Core.Interpreter/AnalysisRule.cs`

## Current Epi Info AI comparison

This table is a planning snapshot, not a parity claim.

| Area | Current browser state | Parity assessment |
|---|---|---|
| Standalone and current-form launch | Both contexts exist; current-form is preselected when launched from Enter Data | Strong candidate; external-source behavior remains narrower |
| Record points | Project form, coordinate fields, label, WGS 84 checks, popups, fit, and Enter Data double-click linkage | Partial Spot/Case Cluster parity; missing legacy style/filter controls and flare clustering |
| Choropleth | GeoJSON polygons and labels can render, but the Choropleth command is disabled | Gap; geometry display is not thematic-join parity |
| Dot Density | Disabled | Gap |
| Reference layers | GeoJSON and GeoTIFF project assets render; legacy Add Reference Layer is disabled | Useful new branches, but legacy Shapefile/KML/Map Server floor is incomplete |
| Layer management | Visibility and removal exist for stored GeoJSON, H3, and raster layers; core record/current-location toggles exist | Partial; ordering, complete editing, legends, filters, and annotation layers remain |
| Backgrounds/offline | Street, Blank, and integrity-checked PMTiles are available; Satellite is disabled | Street/Blank adapted; offline is a new branch; satellite needs a governed provider |
| Time lapse | Cumulative stops, play/slider, temporal fields, and 1,000-stop bound exist | Partial; legacy distribution chart and full control/output comparison remain |
| Map persistence | GeoJSON/GeoTIFF assets and configuration plus PMTiles can round-trip through project packages | Strong new adaptation; complete legacy layer/style/filter/annotation round-trip remains |
| Image export | No general Map Save as Image workflow | Gap |
| Coordinate collection | Address lookup, manual coordinates, OpenStreetMap preview, and draggable point update the form | Adapted/new branch; provider governance, offline behavior, provenance, and field acceptance remain |
| H3 aggregation | Implemented with resolution/size guidance | New branch |
| Space-time cluster result map and story tour | Implemented for aggregate ranked results | New branch; not Case Cluster or `MAP` parity |
| Classic `MAP` command | Not implemented | Correctly remains a declared revival gap |

## Parity acceptance gates

Mapping parity should not be declared until the following are demonstrated with
saved fixtures, screenshots, and repeatable browser tests.

### Workflow and navigation

- Create Maps and Enter Data > Maps both open the correct context.
- Enter Data can open the exact authorized record selected on the map.
- Project change/unload removes stale map state and restores only the selected
  project's map artifacts.
- Keyboard, mouse, and touch navigation; focus order; dialogs; and layer controls
  pass accessibility review.

### Data and layers

- Spot Map and visual Case Cluster are separately selectable and testable.
- Row filters, invalid-coordinate diagnostics, layer descriptions, styling, and
  record linkage round-trip.
- Choropleth joins, classifications, missing values, legends, labels, opacity,
  and all supported boundary sources pass golden-fixture comparison.
- Dot Density passes deterministic count/placement and legend tests.
- Reference Shapefile, KML, and approved map-service adapters either work or are
  visibly marked as unresolved gaps.
- Layer order, visibility, edit, remove, clear, and map/project reload are tested.

### Temporal and output

- Time lapse accepts only appropriate temporal fields, is cumulative, enforces
  the 1,000-stop bound, and includes the distribution chart.
- Save/Open preserves the complete supported map state or emits precise
  unsupported-source diagnostics.
- PNG export includes the intended map, legend, annotations, title, scale, and
  required attribution without authoring chrome.

### Spatial correctness and safety

- Latitude/longitude signs, order, ranges, and at least five retained decimal
  places are validated through entry and import.
- CRS is recorded and reprojection is tested against known control points.
- Geocoder failure never clears or silently replaces existing coordinates.
- Network requests, provider attribution/licensing, credentials, and transmitted
  fields are disclosed.
- Exact locations and record identifiers are excluded from aggregate output and
  history unless explicitly required and authorized.

## Future architectural intent: browser GIS kernel

This section records a proposed Epi Info AI architecture, not legacy behavior,
implemented parity, or a commitment to a particular upstream library. The
browser GIS kernel should separate its control, computation, and rendering
concerns rather than adopt JupyterGIS or another GIS application wholesale.

The intended boundary is:

```text
TypeScript control plane
  UI, commands, project state, permissions, and audit history
                         |
                         v
WASM compute plane in dedicated Web Workers
  geometry, projections, indexing, joins, rasters, and spatial statistics
                         |
                         v
Browser rendering plane
  Leaflet/MapLibre, WebGL, charts, legends, and story maps
```

Epi Info AI remains the host and stable public contract. A typed,
engine-neutral `MapPlan`/`LayerPlan` should connect reviewed commands and UI
actions to processing and rendering adapters. The command language must not
emit Leaflet-, MapLibre-, OpenLayers-, or JupyterGIS-specific objects.

### WASM compute plane

WASM is appropriate for deterministic, CPU-intensive, reusable geospatial
operations that can run without blocking the browser UI:

| Component | Candidate implementation | Kernel responsibility |
|---|---|---|
| Format and raster engine | GDAL-WASM | Inspect and convert formats; clip, resample, reproject, rasterize, and translate rasters |
| Coordinate engine | PROJ-compatible WASM, directly or through GDAL | Identify and transform coordinate reference systems; handle axis order and datum transformations explicitly |
| Geometry engine | GEOS-compatible WASM | Validate and repair geometry; buffer, intersect, union, dissolve, clip, simplify, and calculate centroids or convex hulls |
| Spatial indexing | Rust/WASM | Build bounded spatial indexes; perform extent, proximity, and nearest-neighbor searches |
| Spatial joins and aggregation | Rust/WASM | Point-in-polygon, layer-to-layer joins, geographic summaries, and unmatched-feature diagnostics |
| H3 operations | H3 WASM or reviewed Rust bindings | Assign points to cells, change resolution, find neighbors/rings, and aggregate records |
| Epidemiologic spatial statistics | Epi Info-owned Rust/WASM | Spatial weights, Moran's I, local Moran's I, Getis-Ord statistics, density estimation, clustering, and space-time detection with epidemiologic result contracts |
| Large vector processing | Rust/WASM or GDAL-WASM | Normalize, filter, simplify, repair, and convert large layers under explicit limits |

The Epi Info-owned statistical component must define epidemiologic meaning.
JupyterGIS may contribute processing and interchange components, but it must not
define Epi Info concepts such as a case, population denominator, surveillance
interval, cluster result, disclosure rule, or project workflow.

Small transformations that are already fast, legible, and well tested in
TypeScript should remain there. WASM adoption should be justified by correctness,
reuse, determinism, isolation, or measured performance rather than used as a
default implementation language.

### TypeScript control plane

TypeScript should retain responsibility for:

- `MAP`, `EPIAI CLUSTER`, and related command orchestration;
- typed plan construction, field/type validation, and user review;
- project, layer-catalog, and active-data state;
- file pickers, OPFS access, and online/offline provider policy;
- `.epia` and encrypted `.epiax` packaging;
- progress, elapsed-time, timeout, and cancellation controls;
- authorization, privacy prompts, history, and processing receipts; and
- UI accessibility, legends, tooltips, story tours, and navigation.

The rendering layer should retain panning, zooming, WebGL drawing, labels,
symbols, hit testing, popups, and story-map animation. It consumes normalized
layer plans and results; it does not own spatial-analysis semantics.

### Kernel contract and worker safety

The compute plane should expose a small capability-oriented interface, such as
`inspect_dataset`, `normalize_vector`, `validate_geometry`, `reproject_layer`,
`spatial_join`, `aggregate_to_h3`, `calculate_spatial_weights`,
`calculate_morans_i`, `calculate_local_morans_i`, `detect_clusters`, and
`process_raster`.

Every completed operation must return both its result and a processing receipt
containing, at minimum:

- operation and engine versions;
- normalized parameters and input digests;
- input/output CRS where applicable;
- record, feature, pixel, or cell counts;
- warnings, exclusions, and unmatched counts; and
- elapsed time.

Large data should cross Worker boundaries through transferable `ArrayBuffer`s
or a reviewed columnar representation rather than repeated large GeoJSON string
serialization. JSON remains appropriate for plans, receipts, small fixtures,
and interoperability.

WASM is not by itself a security boundary. Processing modules must run in
dedicated Workers with validated inputs, memory and complexity limits,
timeouts, cancellation, no ambient network or filesystem authority, explicit
asset handles, and fail-closed errors. Browser Web Crypto, project encryption,
network policy, and user authorization remain outside the GIS compute kernel.

### JupyterGIS adoption boundary

JupyterGIS should first be evaluated as a source of separable GDAL/WASM,
document-interchange, or optional-viewer capabilities. Epi Info AI should not
adopt the complete JupyterLab/React/OpenLayers/Yjs application stack as its GIS
kernel unless measured spikes demonstrate that this is necessary and that it
preserves static hosting, offline operation, accessibility, project packaging,
privacy, and bundle/storage limits.

The first bounded kernel spike should import a zipped Shapefile and `.prj`, use
a Worker to identify and reproject it to WGS 84, normalize it to GeoJSON, store
the derived asset through the existing project/OPFS contract, render it through
the existing map adapter, and produce a complete processing receipt. It must be
repeatable with the network disabled after the application is cached.

The supporting JupyterGIS evaluation and its go/no-go gates are maintained in
`../design/jupytergis-architecture-spike.md`.

The runnable `examples/gdal-wasm/dirty-boundaries/` architecture spike now
provides a deterministic browser fixture for this quality boundary. It checks
self-intersections and holes outside their shells, retains the source validity
finding, produces a separate GEOS repair, and compares point overlays with
reviewed expectations. Its detached-ring case is intentionally prominent:
valid output topology does not prove that the repaired geography matches the
investigator's intended study boundary.

The companion `examples/gdal-wasm/zonal-statistics/` spike exercises a second
quality boundary: population denominators must disclose raster coverage, NoData,
outside-study-area zones, resampling, and the semantic provenance of raster
values. It refuses to describe the fixture-derived rates as surveillance
estimates because population year, concept, and units have not been established.

## Recommended implementation order

1. Complete the visual Spot Map/Case Cluster distinction, filters, style controls,
   skipped-row report, and Enter Data linkage tests.
2. Complete the layer manager: ordering, edit, remove/clear confirmation,
   legends, annotations, and complete project round-trip.
3. Implement Choropleth with deterministic joins/classification and reference
   source adapters; preserve the legacy manual ramp and add separately labeled,
   attributed ColorBrewer schemes.
4. Implement deterministic Dot Density.
5. Finish time-lapse distribution output and general PNG export.
6. Add explicit CRS/reprojection handling, governed GIS data-quality reports,
   and differential spatial fixtures.
7. Only then revive the Classic `MAP` command through typed layer plans and
   `.pgm7` validation programs.

New branches may continue in parallel, but demos and documentation must label
them as additions rather than evidence that the legacy floor is complete.

## Source index

The review directly inspected these source groups:

- `../reference/Epi-Map-DOS-125842.pdf` (Epi Map 2 User's Guide for the Epi
  Info 6/DOS generation)
- `../../source/Epi-Info-Community-Edition/Epi.Windows.Mapping/MapMainForm.cs`
- `../../source/Epi-Info-Community-Edition/Epi.Windows.Enter/Forms/MapViewer.cs`
- `../../source/Epi-Info-Community-Edition/EpiDashboard/Mapping/StandaloneMapControl.xaml`
- `../../source/Epi-Info-Community-Edition/EpiDashboard/Mapping/StandaloneMapControl.xaml.cs`
- `../../source/Epi-Info-Community-Edition/EpiDashboard/Mapping/LayerList.xaml.cs`
- `../../source/Epi-Info-Community-Edition/EpiDashboard/Mapping/ClusterLayerProvider.cs`
- `../../source/Epi-Info-Community-Edition/EpiDashboard/Mapping/PointLayerProperties.xaml.cs`
- `../../source/Epi-Info-Community-Edition/EpiDashboard/Controls/CaseClusterProperties.cs`
- `../../source/Epi-Info-Community-Edition/EpiDashboard/Controls/ChoroplethProperties.xaml`
- `../../source/Epi-Info-Community-Edition/EpiDashboard/Controls/DotDensityProperties.xaml`
- reference providers/properties under
  `../../source/Epi-Info-Community-Edition/EpiDashboard/Mapping/`
- geocoding/template sources listed in Coordinate acquisition above; and
- Classic grammar/UI/interpreter sources listed under the dormant `MAP` review.

The existing design inventory remains the stable gap-ID crosswalk:
`../design/maps-compatibility-inventory.md` and
`../design/legacy-capability-register.md`.
