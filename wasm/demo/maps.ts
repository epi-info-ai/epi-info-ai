import { UNITS, cellToBoundary, getHexagonEdgeLengthAvg, latLngToCell } from "./vendor/h3-js/h3-js.es.js";
import { fromArrayBuffer } from "geotiff";
import { getHexagonAreaAvg } from "./vendor/h3-js/h3-js.es.js";
import type {
  GeoJsonCoordinates,
  GeoJsonFeature,
  GeoJsonGeometry,
  GeoJsonGeometryCollection,
  GeoJsonProperties,
  H3CellAggregate,
  InferredMapFields,
  MapDataSource,
  MapLaunchContext,
  OpenRecordHandler,
  ParsedGeoJson,
  SupportedGeoJson,
  SupportedGeoJsonGeometry,
  TimeLapseStop,
} from "../app/contracts/maps.js";
import type { EpiRecord, FieldDefinition, MapPoint, RecordValue } from "../app/contracts/core.js";

// Leaflet is a reviewed, pinned global script. Keep its untyped runtime surface
// confined to this adapter module until the vendored distribution carries types.
type LeafletHandle = any;
const L: LeafletHandle = (globalThis as typeof globalThis & { L?: LeafletHandle }).L;

type MapDomControl = HTMLElement & HTMLInputElement & HTMLSelectElement & HTMLDialogElement
  & HTMLFormElement & HTMLDetailsElement;

function requiredElement<T extends Element = MapDomControl>(selector: string): T {
  const element = globalThis.document.querySelector<T>(selector);
  if (!element) throw new Error(`Required Maps interface element is missing: ${selector}`);
  return element;
}

function requiredElements<T extends Element = MapDomControl>(selector: string): NodeListOf<T> {
  return globalThis.document.querySelectorAll<T>(selector);
}

function eventControl(event: Event): MapDomControl {
  if (!(event.target instanceof HTMLElement)) throw new Error("Maps event target is not an interface element.");
  return event.target as MapDomControl;
}

function eventForm(event: Event): HTMLFormElement {
  if (!(event.currentTarget instanceof HTMLFormElement)) throw new Error("Maps submit target is not a form.");
  return event.currentTarget;
}

type LeafletMap = LeafletHandle;
type LeafletLayer = LeafletHandle;
type LeafletBounds = LeafletHandle;

interface GeoJsonLabelAnchor {
  latitude: number;
  longitude: number;
  clearance: number;
  longitudeScale: number;
}

interface GeoJsonLabel {
  anchor: GeoJsonLabelAnchor;
  labelLayer: LeafletLayer;
  marker: LeafletLayer;
  requiredRadius: number;
}

interface GeoJsonLayerEntry {
  layer: LeafletLayer;
  name: string;
  featureCount: number;
  bounds: LeafletBounds;
  labelField: string;
  labels: GeoJsonLabel[];
  labelsEnabled: boolean;
}

interface H3LayerEntry {
  layer: LeafletLayer;
  name: string;
  resolution: number;
  cellCount: number;
  recordCount: number;
  bounds: LeafletBounds;
}

interface RasterLayerEntry {
  layer: LeafletLayer;
  name: string;
  bounds: LeafletBounds;
  sourceWidth: number;
  sourceHeight: number;
  displayWidth: number;
  displayHeight: number;
  opacity: number;
}

interface TemporalValue {
  timestamp: number;
  kind: "date" | "time" | "datetime";
}

interface TimeLapseState {
  field: string;
  index: number;
  stops: TimeLapseStop[];
  timer: ReturnType<typeof setInterval> | null;
  totalPoints: number;
}

type Point2D = [number, number];
type PolygonRings = Point2D[][];
type H3Indexer = (latitude: number, longitude: number, resolution: number) => string;

let map: LeafletMap | null = null;
let tileLayer: LeafletLayer | null = null;
let recordLayer: LeafletLayer | null = null;
let locationLayer: LeafletLayer | null = null;
let lastBounds: LeafletBounds | null = null;
let caseClusterAdded = false;
let locationAdded = false;
let mapContext: MapLaunchContext = "standalone";
let activeData: MapDataSource | null = null;
let fallbackFullscreen = false;
let activeRecordPoints: MapPoint[] = [];
let activeRecordLabelField = "";
let activeRecordOpenHandler: OpenRecordHandler | null = null;
let timeLapseState: TimeLapseState | null = null;
const geoJsonLayers = new Map<string, GeoJsonLayerEntry>();
const h3Layers = new Map<string, H3LayerEntry>();
const rasterLayers = new Map<string, RasterLayerEntry>();
const MAX_GEOJSON_BYTES = 10 * 1024 * 1024;
const MAX_GEOJSON_FEATURES = 10000;
const MAX_RASTER_BYTES = 50 * 1024 * 1024;
const MAX_RASTER_PIXELS = 1024 * 1024;
export const MAP_PANE_Z_INDEX = Object.freeze({
  raster: 200,
  polygon: 410,
  line: 420,
  point: 430,
  label: 440,
});

export function mapPaneForGeometryType(type: string): string {
  if (["Point", "MultiPoint"].includes(type)) return "epi-point-pane";
  if (["LineString", "MultiLineString"].includes(type)) return "epi-line-pane";
  if (["Polygon", "MultiPolygon"].includes(type)) return "epi-polygon-pane";
  return "epi-polygon-pane";
}

function updateLayerCount() {
  const count = Number(caseClusterAdded) + Number(locationAdded) + geoJsonLayers.size + h3Layers.size + rasterLayers.size;
  requiredElement("#map-layer-count").textContent = String(count);
}

function option(value: string, label: string): HTMLOptionElement {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = label;
  return item;
}

function likelyField(fields: FieldDefinition[], patterns: RegExp[]): string {
  return fields.find((field) => patterns.some((pattern) => (
    pattern.test(field.name || "") || pattern.test(field.prompt || "")
  )))?.name || "";
}

export function inferMapFields(fields: FieldDefinition[]): Pick<InferredMapFields, "latitude" | "longitude" | "label"> {
  return {
    latitude: likelyField(fields, [/^lat$/i, /latitude/i, /gps_?lat/i]),
    longitude: likelyField(fields, [/^(lon|lng|long)$/i, /longitude/i, /gps_?(lon|lng)/i]),
    label: likelyField(fields, [/case[\s_-]?id/i, /^id$/i, /name/i]),
  };
}

export function parseGeoJson(text: string, maximumFeatures = MAX_GEOJSON_FEATURES): ParsedGeoJson {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The file must contain a GeoJSON object.");
  }
  const geojson = parsed as Record<string, unknown>;
  const geometryTypes = new Set([
    "Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon", "GeometryCollection",
  ]);
  const validateGeometry: (geometry: unknown) => asserts geometry is SupportedGeoJsonGeometry | null = (geometry) => {
    if (geometry === null) return;
    if (!geometry || typeof geometry !== "object" || Array.isArray(geometry)) {
      throw new Error("A GeoJSON feature contains an invalid geometry.");
    }
    const candidate = geometry as Record<string, unknown>;
    if (typeof candidate.type !== "string" || !geometryTypes.has(candidate.type)) {
      throw new Error("A GeoJSON feature contains an invalid geometry.");
    }
    if (candidate.type === "GeometryCollection") {
      if (!Array.isArray(candidate.geometries)) throw new Error("A GeometryCollection must contain a geometries array.");
      candidate.geometries.forEach(validateGeometry);
    } else if (!Array.isArray(candidate.coordinates)) {
      throw new Error(`A ${candidate.type} geometry must contain coordinates.`);
    }
  };
  const validateFeature: (feature: unknown) => asserts feature is GeoJsonFeature = (feature) => {
    if (!feature || typeof feature !== "object" || Array.isArray(feature)) {
      throw new Error("Every item in a GeoJSON FeatureCollection must be a Feature.");
    }
    const candidate = feature as Record<string, unknown>;
    if (candidate.type !== "Feature") throw new Error("Every item in a GeoJSON FeatureCollection must be a Feature.");
    if (!("geometry" in candidate)) throw new Error("A GeoJSON Feature is missing its geometry.");
    validateGeometry(candidate.geometry);
    if (candidate.properties !== null && candidate.properties !== undefined
      && (typeof candidate.properties !== "object" || Array.isArray(candidate.properties))) {
      throw new Error("A GeoJSON Feature has invalid properties.");
    }
  };
  let featureCount = 1;
  if (geojson.type === "FeatureCollection") {
    if (!Array.isArray(geojson.features)) throw new Error("A GeoJSON FeatureCollection must contain a features array.");
    featureCount = geojson.features.length;
    geojson.features.forEach(validateFeature);
  } else if (geojson.type === "Feature") {
    validateFeature(geojson);
  } else if (typeof geojson.type !== "string" || !geometryTypes.has(geojson.type)) {
    throw new Error("Use a GeoJSON FeatureCollection, Feature, or geometry object.");
  } else {
    validateGeometry(geojson);
  }
  if (featureCount > maximumFeatures) {
    throw new Error(`This file has ${featureCount.toLocaleString()} features; the demo limit is ${maximumFeatures.toLocaleString()}.`);
  }
  return { geojson: geojson as unknown as SupportedGeoJson, featureCount };
}

export function listGeoJsonPolygonProperties(geojson: SupportedGeoJson): string[] {
  const features = geojson?.type === "FeatureCollection"
    ? geojson.features
    : geojson?.type === "Feature"
      ? [geojson]
      : [];
  const fields = new Set<string>();
  for (const feature of features || []) {
    if (!["Polygon", "MultiPolygon"].includes(feature?.geometry?.type ?? "")) continue;
    for (const [key, value] of Object.entries(feature.properties || {})) {
      if (value === null || ["string", "number", "boolean"].includes(typeof value)) fields.add(key);
    }
  }
  return [...fields].sort((left, right) => left.localeCompare(right));
}

function pointInRing([x, y]: Point2D, ring: Point2D[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi, yi] = ring[index]!;
    const [xj, yj] = ring[previous]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point: Point2D, rings: PolygonRings): boolean {
  return rings.length > 0 && pointInRing(point, rings[0]!) && !rings.slice(1).some((ring) => pointInRing(point, ring));
}

function distanceToSegmentSquared([x, y]: Point2D, [startX, startY]: Point2D, [endX, endY]: Point2D): number {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  let ratio = lengthSquared === 0 ? 0 : ((x - startX) * segmentX + (y - startY) * segmentY) / lengthSquared;
  ratio = Math.max(0, Math.min(1, ratio));
  const offsetX = x - (startX + segmentX * ratio);
  const offsetY = y - (startY + segmentY * ratio);
  return offsetX * offsetX + offsetY * offsetY;
}

function signedPolygonDistance(point: Point2D, rings: PolygonRings): number {
  let minimumSquared = Infinity;
  for (const ring of rings) {
    for (let index = 0; index < ring.length; index += 1) {
      minimumSquared = Math.min(
        minimumSquared,
        distanceToSegmentSquared(point, ring[index]!, ring[(index + 1) % ring.length]!),
      );
    }
  }
  const distance = Math.sqrt(minimumSquared);
  return pointInPolygon(point, rings) ? distance : -distance;
}

function ringCentroid(ring: Point2D[]): Point2D {
  let areaTwice = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index]!;
    const [x2, y2] = ring[(index + 1) % ring.length]!;
    const cross = x1 * y2 - x2 * y1;
    areaTwice += cross;
    x += (x1 + x2) * cross;
    y += (y1 + y2) * cross;
  }
  if (Math.abs(areaTwice) < Number.EPSILON) return ring[0] ?? [0, 0];
  return [x / (3 * areaTwice), y / (3 * areaTwice)];
}

function interiorPointForPolygon(coordinates: unknown): GeoJsonLabelAnchor | null {
  if (!Array.isArray(coordinates) || !Array.isArray(coordinates[0]) || coordinates[0].length < 3) return null;
  const sourceRings = coordinates as unknown[][][];
  const latitudes = sourceRings[0]!.map((position) => Number(position[1])).filter(Number.isFinite);
  if (latitudes.length < 3) return null;
  let minimumLatitude = Infinity;
  let maximumLatitude = -Infinity;
  for (const latitude of latitudes) {
    minimumLatitude = Math.min(minimumLatitude, latitude);
    maximumLatitude = Math.max(maximumLatitude, latitude);
  }
  const meanLatitude = (minimumLatitude + maximumLatitude) / 2;
  const longitudeScale = Math.max(0.01, Math.cos(meanLatitude * Math.PI / 180));
  const rings: PolygonRings = sourceRings.map((ring) => ring
    .map((position): Point2D => [Number(position[0]) * longitudeScale, Number(position[1])])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)))
    .filter((ring) => ring.length >= 3);
  if (rings.length === 0) return null;
  let minimumX = Infinity;
  let maximumX = -Infinity;
  let minimumY = Infinity;
  let maximumY = -Infinity;
  for (const [x, y] of rings[0]!) {
    minimumX = Math.min(minimumX, x);
    maximumX = Math.max(maximumX, x);
    minimumY = Math.min(minimumY, y);
    maximumY = Math.max(maximumY, y);
  }
  const width = maximumX - minimumX;
  const height = maximumY - minimumY;
  if (width === 0 || height === 0) return null;

  let bestPoint = ringCentroid(rings[0]!);
  let bestDistance = signedPolygonDistance(bestPoint, rings);
  const center: Point2D = [(minimumX + maximumX) / 2, (minimumY + maximumY) / 2];
  const centerDistance = signedPolygonDistance(center, rings);
  if (centerDistance > bestDistance) [bestPoint, bestDistance] = [center, centerDistance];

  const gridSize = 10;
  for (let xIndex = 0; xIndex < gridSize; xIndex += 1) {
    for (let yIndex = 0; yIndex < gridSize; yIndex += 1) {
      const candidate: Point2D = [
        minimumX + width * (xIndex + 0.5) / gridSize,
        minimumY + height * (yIndex + 0.5) / gridSize,
      ];
      const distance = signedPolygonDistance(candidate, rings);
      if (distance > bestDistance) [bestPoint, bestDistance] = [candidate, distance];
    }
  }

  let step = Math.max(width, height) / gridSize;
  for (let iteration = 0; iteration < 7; iteration += 1) {
    step /= 2;
    for (let xOffset = -2; xOffset <= 2; xOffset += 1) {
      for (let yOffset = -2; yOffset <= 2; yOffset += 1) {
        const candidate: Point2D = [bestPoint[0] + xOffset * step, bestPoint[1] + yOffset * step];
        const distance = signedPolygonDistance(candidate, rings);
        if (distance > bestDistance) [bestPoint, bestDistance] = [candidate, distance];
      }
    }
  }
  if (bestDistance <= 0) return null;
  return {
    latitude: bestPoint[1],
    longitude: bestPoint[0] / longitudeScale,
    clearance: bestDistance,
    longitudeScale,
  };
}

export function polygonLabelAnchor(geometry: SupportedGeoJsonGeometry | null): GeoJsonLabelAnchor | null {
  const polygons = geometry?.type === "Polygon"
    ? [geometry.coordinates]
    : geometry?.type === "MultiPolygon"
      ? geometry.coordinates
      : [];
  let best = null;
  for (const polygon of polygons || []) {
    const candidate = interiorPointForPolygon(polygon);
    if (candidate && (!best || candidate.clearance > best.clearance)) best = candidate;
  }
  return best;
}

function setMapHeading(data: MapDataSource | null = null): void {
  const heading = requiredElement("#map-project-name");
  if (!data) {
    heading.textContent = "Standalone map - no data source selected";
    return;
  }
  const linked = mapContext === "current-form" ? " - linked to Enter Data" : "";
  heading.textContent = `${data.projectName} / ${data.formName}${linked}`;
}

function populateFieldSelectors(data: MapDataSource): Pick<InferredMapFields, "latitude" | "longitude" | "label"> {
  const latitude = requiredElement("#map-latitude-field");
  const longitude = requiredElement("#map-longitude-field");
  const label = requiredElement("#map-label-field");
  const previous = { latitude: latitude.value, longitude: longitude.value, label: label.value };
  const inferred = inferMapFields(data.fields);
  const fieldOptions = data.fields.map((field) => option(field.name, `${field.prompt} (${field.name})`));
  latitude.replaceChildren(option("", "Select latitude"), ...fieldOptions.map((item) => item.cloneNode(true)));
  longitude.replaceChildren(option("", "Select longitude"), ...fieldOptions.map((item) => item.cloneNode(true)));
  label.replaceChildren(option("", "No label"), ...fieldOptions.map((item) => item.cloneNode(true)));
  latitude.value = data.fields.some((field) => field.name === previous.latitude)
    ? previous.latitude
    : inferred.latitude;
  longitude.value = data.fields.some((field) => field.name === previous.longitude)
    ? previous.longitude
    : inferred.longitude;
  label.value = data.fields.some((field) => field.name === previous.label)
    ? previous.label
    : inferred.label;
  return { latitude: latitude.value, longitude: longitude.value, label: label.value };
}

function ensureMap() {
  if (map) return map;
  if (!L) throw new Error("The map library could not be loaded.");
  map = L.map("epi-map", { zoomControl: true }).setView([39.8283, -98.5795], 4);
  for (const [name, zIndex] of Object.entries(MAP_PANE_Z_INDEX)) {
    const pane = map.createPane(`epi-${name}-pane`);
    pane.style.zIndex = String(zIndex);
  }
  tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    pane: "epi-raster-pane",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
  tileLayer.on("tileerror", () => {
    requiredElement("#map-status").textContent = "Basemap unavailable; local point layers still work.";
  });
  tileLayer.addTo(map);
  recordLayer = L.layerGroup().addTo(map);
  locationLayer = L.layerGroup().addTo(map);
  L.control.scale({ imperial: true, metric: true }).addTo(map);
  map.on("zoomend", updateGeoJsonLabelVisibility);
  return map;
}

function mapWindowElement(): MapDomControl {
  return requiredElement("[data-module-view='maps'] .map-window");
}

function updateFullscreenControl() {
  const target = mapWindowElement();
  const button = requiredElement("#map-fullscreen-toggle");
  const active = document.fullscreenElement === target || fallbackFullscreen;
  button.setAttribute("aria-pressed", String(active));
  button.setAttribute("aria-label", active ? "Exit map fullscreen" : "Enter map fullscreen");
  button.title = active ? "Exit map fullscreen" : "Enter map fullscreen";
  requestAnimationFrame(() => requestAnimationFrame(() => map?.invalidateSize({ pan: false })));
}

function setFallbackFullscreen(active: boolean): void {
  fallbackFullscreen = active;
  mapWindowElement().classList.toggle("map-window-maximized", active);
  document.body.classList.toggle("map-fullscreen-fallback", active);
  updateFullscreenControl();
}

async function toggleMapFullscreen() {
  const target = mapWindowElement();
  if (document.fullscreenElement === target) {
    await document.exitFullscreen();
    return;
  }
  if (fallbackFullscreen) {
    setFallbackFullscreen(false);
    return;
  }
  if (target.requestFullscreen) {
    try {
      await target.requestFullscreen();
      return;
    } catch {
      setFallbackFullscreen(true);
      requiredElement("#map-status").textContent = "Map expanded to fill this browser window.";
      return;
    }
  }
  setFallbackFullscreen(true);
  requiredElement("#map-status").textContent = "Map expanded to fill this browser window.";
}

function resetMapWorkspace() {
  ensureMap();
  closeTimeLapse(false);
  recordLayer.clearLayers();
  locationLayer.clearLayers();
  for (const entry of geoJsonLayers.values()) {
    if (map.hasLayer(entry.layer)) map.removeLayer(entry.layer);
  }
  geoJsonLayers.clear();
  renderGeoJsonLayerList();
  for (const entry of h3Layers.values()) {
    if (map.hasLayer(entry.layer)) map.removeLayer(entry.layer);
  }
  h3Layers.clear();
  renderH3LayerList();
  for (const entry of rasterLayers.values()) {
    if (map.hasLayer(entry.layer)) map.removeLayer(entry.layer);
  }
  rasterLayers.clear();
  renderRasterLayerList();
  lastBounds = null;
  caseClusterAdded = false;
  locationAdded = false;
  activeData = null;
  activeRecordPoints = [];
  activeRecordLabelField = "";
  activeRecordOpenHandler = null;
  requiredElement("#map-point-count").textContent = "0";
  requiredElement("#map-record-layer-name").textContent = "Case Cluster";
  requiredElement("#map-record-layer-toggle").checked = true;
  requiredElement("#map-location-layer-toggle").checked = true;
  requiredElement("#map-layer-panel").open = false;
  requiredElement("#map-empty-state").hidden = false;
  updateLayerCount();
  map.setView([39.8283, -98.5795], 4);
}

function markerPopup(record: EpiRecord, labelField: string, latitude: number, longitude: number): HTMLDivElement {
  const content = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = labelField && record[labelField] ? String(record[labelField]) : "Record location";
  const coordinates = document.createElement("div");
  coordinates.textContent = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  content.append(heading, coordinates);
  if (mapContext === "current-form") {
    const hint = document.createElement("small");
    hint.textContent = "Double-click to open this record in Enter Data.";
    content.append(hint);
  }
  return content;
}

function geoJsonPopup(feature: GeoJsonFeature): HTMLDivElement | null {
  const properties = feature?.properties && typeof feature.properties === "object" ? feature.properties : {};
  const entries = Object.entries(properties)
    .filter(([, value]) => value === null || ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 8);
  if (entries.length === 0) return null;
  const content = document.createElement("div");
  content.className = "geojson-popup";
  for (const [key, value] of entries) {
    const row = document.createElement("div");
    const label = document.createElement("strong");
    label.textContent = `${key}: `;
    row.append(label, document.createTextNode(value === null ? "" : String(value)));
    content.append(row);
  }
  return content;
}

function expandGeoJsonFeatures(geojson: SupportedGeoJson): GeoJsonFeature[] {
  const sourceFeatures = geojson.type === "FeatureCollection"
    ? geojson.features
    : geojson.type === "Feature"
      ? [geojson]
      : [{ type: "Feature", properties: {}, geometry: geojson }];
  const expanded: GeoJsonFeature[] = [];
  const addGeometry = (geometry: SupportedGeoJsonGeometry | null, properties: GeoJsonProperties | null): void => {
    if (!geometry) return;
    if (geometry.type === "GeometryCollection") {
      geometry.geometries.forEach((child: SupportedGeoJsonGeometry) => addGeometry(child, properties));
      return;
    }
    expanded.push({ type: "Feature", properties, geometry });
  };
  for (const feature of sourceFeatures) addGeometry(feature.geometry, feature.properties || {});
  return expanded;
}

function refreshMapEmptyState() {
  requiredElement("#map-empty-state").hidden = caseClusterAdded || locationAdded || geoJsonLayers.size > 0 || h3Layers.size > 0 || rasterLayers.size > 0;
}

function renderGeoJsonLayerList() {
  const container = requiredElement("#map-geojson-layers");
  const rows = [];
  for (const [id, entry] of geoJsonLayers) {
    const row = document.createElement("span");
    row.className = "map-geojson-layer";
    row.dataset.geojsonLayerId = id;
    const label = document.createElement("label");
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = map.hasLayer(entry.layer);
    toggle.dataset.geojsonToggle = id;
    const name = document.createElement("span");
    name.className = "map-geojson-layer-name";
    name.textContent = `${entry.name} (${entry.featureCount})${entry.labelField ? ` - labels: ${entry.labelField}` : ""}`;
    name.title = entry.labelField ? `${entry.name}; polygon labels: ${entry.labelField}` : entry.name;
    label.append(toggle, name);
    if (entry.labelField) {
      const labelToggleLabel = document.createElement("label");
      labelToggleLabel.className = "map-label-toggle";
      const labelToggle = document.createElement("input");
      labelToggle.type = "checkbox";
      labelToggle.checked = entry.labelsEnabled;
      labelToggle.dataset.geojsonLabelToggle = id;
      labelToggleLabel.append(labelToggle, document.createTextNode("Labels"));
      row.append(labelToggleLabel);
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "map-layer-remove";
    remove.dataset.geojsonRemove = id;
    remove.setAttribute("aria-label", `Remove ${entry.name}`);
    remove.title = `Remove ${entry.name}`;
    remove.textContent = "x";
    row.prepend(label);
    row.append(remove);
    rows.push(row);
  }
  container.replaceChildren(...rows);
}

function renderH3LayerList() {
  const container = requiredElement("#map-h3-layers");
  const rows = [];
  for (const [id, entry] of h3Layers) {
    const row = document.createElement("span");
    row.className = "map-h3-layer";
    const label = document.createElement("label");
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = map.hasLayer(entry.layer);
    toggle.dataset.h3Toggle = id;
    const name = document.createElement("span");
    name.className = "map-h3-layer-name";
    name.textContent = `${entry.name} (${entry.cellCount} cells)`;
    name.title = `${entry.recordCount} records aggregated at H3 resolution ${entry.resolution}`;
    label.append(toggle, name);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "map-layer-remove";
    remove.dataset.h3Remove = id;
    remove.setAttribute("aria-label", `Remove ${entry.name}`);
    remove.title = `Remove ${entry.name}`;
    remove.textContent = "x";
    row.append(label, remove);
    rows.push(row);
  }
  container.replaceChildren(...rows);
}

function renderRasterLayerList() {
  const container = requiredElement("#map-raster-layers");
  const rows = [];
  for (const [id, entry] of rasterLayers) {
    const row = document.createElement("span");
    row.className = "map-raster-layer";
    const label = document.createElement("label");
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = map.hasLayer(entry.layer);
    toggle.dataset.rasterToggle = id;
    const name = document.createElement("span");
    name.className = "map-raster-layer-name";
    name.textContent = entry.name;
    name.title = `${entry.sourceWidth} × ${entry.sourceHeight} source pixels; ${entry.displayWidth} × ${entry.displayHeight} displayed`;
    label.append(toggle, name);
    const opacity = document.createElement("input");
    opacity.type = "range";
    opacity.min = "10";
    opacity.max = "100";
    opacity.step = "5";
    opacity.value = String(Math.round(entry.opacity * 100));
    opacity.dataset.rasterOpacity = id;
    opacity.setAttribute("aria-label", `${entry.name} opacity`);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "map-layer-remove";
    remove.dataset.rasterRemove = id;
    remove.setAttribute("aria-label", `Remove ${entry.name}`);
    remove.textContent = "x";
    row.append(label, opacity, remove);
    rows.push(row);
  }
  container.replaceChildren(...rows);
}

function rasterColor(value: number, low: number, high: number): [number, number, number] {
  const fraction = Math.max(0, Math.min(1, (Math.log1p(Math.max(0, value)) - low) / Math.max(Number.EPSILON, high - low)));
  const stops: Array<[number, number, number]> = [[21, 67, 119], [38, 150, 170], [238, 218, 65], [184, 36, 50]];
  const scaled = fraction * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const local = scaled - index;
  const start = stops[index]!;
  const end = stops[index + 1]!;
  return [0, 1, 2].map((channel) => Math.round(start[channel]! + (end[channel]! - start[channel]!) * local)) as [number, number, number];
}

async function addRasterLayer(file: File, name: string, opacity: number): Promise<void> {
  if (file.size > MAX_RASTER_BYTES) throw new Error("This file is larger than the 50 MB demo limit.");
  const tiff = await fromArrayBuffer(await file.arrayBuffer());
  const image = await tiff.getImage();
  const geoKeys = image.getGeoKeys();
  const projectedCrs = Number(geoKeys?.ProjectedCSTypeGeoKey || 0);
  const geographicCrs = Number(geoKeys?.GeographicTypeGeoKey || 0);
  if (projectedCrs || (geographicCrs && geographicCrs !== 4326)) {
    throw new Error(`This demo currently accepts WGS 84 geographic GeoTIFFs (EPSG:4326). This file reports ${projectedCrs || geographicCrs}.`);
  }
  const [west, south, east, north] = image.getBoundingBox();
  if (![west, south, east, north].every(Number.isFinite) || west! < -180 || east! > 180 || south! < -90 || north! > 90 || west! >= east! || south! >= north!) {
    throw new Error("The GeoTIFF does not contain valid WGS 84 geographic bounds.");
  }
  const sourceWidth = image.getWidth();
  const sourceHeight = image.getHeight();
  const scale = Math.min(1, Math.sqrt(MAX_RASTER_PIXELS / (sourceWidth * sourceHeight)));
  const displayWidth = Math.max(1, Math.round(sourceWidth * scale));
  const displayHeight = Math.max(1, Math.round(sourceHeight * scale));
  const raster = await image.readRasters({ samples: [0], interleave: true, width: displayWidth, height: displayHeight, resampleMethod: "bilinear" });
  const noData = image.getGDALNoData();
  const finite = Array.from(raster, Number).filter((value) => Number.isFinite(value) && value !== noData && value > 0).sort((a, b) => a - b);
  if (finite.length === 0) throw new Error("The first GeoTIFF band contains no positive finite values to display.");
  const lowValue = finite[Math.floor((finite.length - 1) * 0.02)]!;
  const highValue = finite[Math.floor((finite.length - 1) * 0.98)]!;
  const low = Math.log1p(lowValue);
  const high = Math.log1p(Math.max(lowValue, highValue));
  const canvas = document.createElement("canvas");
  canvas.width = displayWidth;
  canvas.height = displayHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot create the raster display canvas.");
  const pixels = context.createImageData(displayWidth, displayHeight);
  for (let index = 0; index < raster.length; index += 1) {
    const value = Number(raster[index]);
    const outputIndex = index * 4;
    if (!Number.isFinite(value) || value === noData || value <= 0) {
      pixels.data[outputIndex + 3] = 0;
      continue;
    }
    const [red, green, blue] = rasterColor(value, low, high);
    pixels.data[outputIndex] = red;
    pixels.data[outputIndex + 1] = green;
    pixels.data[outputIndex + 2] = blue;
    pixels.data[outputIndex + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const bounds = L.latLngBounds([[south, west], [north, east]]);
  const layer = L.imageOverlay(canvas.toDataURL("image/png"), bounds, { pane: "epi-raster-pane", opacity, interactive: false });
  layer.addTo(ensureMap());
  const id = globalThis.crypto?.randomUUID?.() || `raster-${Date.now()}`;
  rasterLayers.set(id, { layer, name, bounds, sourceWidth, sourceHeight, displayWidth, displayHeight, opacity });
  renderRasterLayerList();
  updateLayerCount();
  refreshMapEmptyState();
  ensureMap().fitBounds(bounds.pad(0.08));
  requiredElement("#map-status").textContent = `Added GeoTIFF raster “${name}” beneath vector layers.`;
}

function combinedLayerBounds() {
  const bounds = L.latLngBounds([]);
  if (caseClusterAdded && map.hasLayer(recordLayer) && lastBounds?.isValid()) bounds.extend(lastBounds);
  for (const entry of geoJsonLayers.values()) {
    if (map.hasLayer(entry.layer) && entry.bounds?.isValid()) bounds.extend(entry.bounds);
  }
  for (const entry of h3Layers.values()) {
    if (map.hasLayer(entry.layer) && entry.bounds?.isValid()) bounds.extend(entry.bounds);
  }
  for (const entry of rasterLayers.values()) {
    if (map.hasLayer(entry.layer) && entry.bounds?.isValid()) bounds.extend(entry.bounds);
  }
  return bounds;
}

function labelClearanceInPixels(label: GeoJsonLabel): number {
  const zoom = map.getZoom();
  const center = map.project([label.anchor.latitude, label.anchor.longitude], zoom);
  const horizontalEdge = map.project([
    label.anchor.latitude,
    label.anchor.longitude + label.anchor.clearance / label.anchor.longitudeScale,
  ], zoom);
  const verticalEdge = map.project([
    label.anchor.latitude + label.anchor.clearance,
    label.anchor.longitude,
  ], zoom);
  return Math.min(Math.abs(horizontalEdge.x - center.x), Math.abs(verticalEdge.y - center.y));
}

function updateGeoJsonLabelVisibility() {
  if (!map) return;
  for (const entry of geoJsonLayers.values()) {
    const layerVisible = map.hasLayer(entry.layer);
    for (const label of entry.labels || []) {
      const shouldShow = layerVisible && entry.labelsEnabled && labelClearanceInPixels(label) >= label.requiredRadius;
      if (shouldShow && !label.labelLayer.hasLayer(label.marker)) label.marker.addTo(label.labelLayer);
      else if (!shouldShow && label.labelLayer.hasLayer(label.marker)) label.labelLayer.removeLayer(label.marker);
    }
  }
}

function addGeoJsonLayer(geojson: SupportedGeoJson, featureCount: number, name: string, labelField = ""): void {
  const currentMap = ensureMap();
  const labelLayer = L.layerGroup();
  const labels: GeoJsonLabel[] = [];
  const features = expandGeoJsonFeatures(geojson);
  const layerOptions = {
    style: (feature: GeoJsonFeature) => ["LineString", "MultiLineString"].includes(feature.geometry?.type ?? "")
      ? { color: "#2563a5", weight: 2.5, opacity: 0.9 }
      : { color: "#2563a5", weight: 2, fillColor: "#4f9dc7", fillOpacity: 0.22 },
    pointToLayer: (_feature: GeoJsonFeature, latlng: LeafletHandle) => L.circleMarker(latlng, {
      pane: "epi-point-pane",
      radius: 6,
      color: "#174f78",
      weight: 2,
      fillColor: "#66b5d4",
      fillOpacity: 0.9,
    }),
    onEachFeature: (feature: GeoJsonFeature, featureLayer: LeafletLayer) => {
      const popup = geoJsonPopup(feature);
      if (popup) featureLayer.bindPopup(popup);
      if (labelField && ["Polygon", "MultiPolygon"].includes(feature?.geometry?.type ?? "")) {
        const labelValue = feature.properties?.[labelField];
        if (labelValue !== null && labelValue !== undefined && typeof labelValue !== "object") {
          const anchor = polygonLabelAnchor(feature.geometry);
          if (!anchor) return;
          const text = String(labelValue);
          const label = document.createElement("span");
          label.className = "geojson-polygon-label";
          label.textContent = text;
          const marker = L.marker([anchor.latitude, anchor.longitude], {
            pane: "epi-label-pane",
            interactive: false,
            keyboard: false,
            icon: L.divIcon({
              className: "geojson-label-marker",
              html: label,
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            }),
          });
          const estimatedWidth = Math.min(190, Math.max(28, Array.from(text).length * 7 + 12));
          labels.push({
            anchor,
            labelLayer,
            marker,
            requiredRadius: Math.hypot(estimatedWidth / 2, 11),
          });
        }
      }
    },
  };
  const geometryLayers = [
    ["Polygon", "MultiPolygon"],
    ["LineString", "MultiLineString"],
    ["Point", "MultiPoint"],
  ].map((types: string[]) => L.geoJSON({
    type: "FeatureCollection",
    features: features.filter((feature) => types.includes(feature.geometry?.type ?? "")),
  }, { ...layerOptions, pane: mapPaneForGeometryType(types[0]!) }));
  const geometryLayer = L.featureGroup(geometryLayers);
  const layer = L.layerGroup([geometryLayer, labelLayer]);
  layer.addTo(currentMap);
  const bounds = geometryLayer.getBounds();
  const id = globalThis.crypto?.randomUUID?.() || `geojson-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  geoJsonLayers.set(id, { layer, name, featureCount, bounds, labelField, labels, labelsEnabled: true });
  renderGeoJsonLayerList();
  updateLayerCount();
  refreshMapEmptyState();
  const labelMessage = labelField ? ` Polygon labels use “${labelField}”.` : "";
  requiredElement("#map-status").textContent = `Added GeoJSON layer “${name}” with ${featureCount.toLocaleString()} feature${featureCount === 1 ? "" : "s"}.${labelMessage}`;
  if (bounds.isValid()) currentMap.fitBounds(bounds.pad(0.12), { maxZoom: 16 });
  updateGeoJsonLabelVisibility();
}

export function extractMapPoints(records: EpiRecord[], latitudeField: string, longitudeField: string): MapPoint[] {
  const points: MapPoint[] = [];
  records.forEach((record: EpiRecord, recordIndex: number) => {
    const rawLatitude = record[latitudeField];
    const rawLongitude = record[longitudeField];
    if (rawLatitude === null || rawLatitude === undefined || rawLongitude === null || rawLongitude === undefined) return;
    if (String(rawLatitude).trim() === "" || String(rawLongitude).trim() === "") return;
    const latitude = Number(rawLatitude);
    const longitude = Number(rawLongitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return;
    points.push({ record, recordIndex, latitude, longitude });
  });
  return points;
}

export function aggregateH3Cells(
  mappedRecords: MapPoint[],
  resolution: number,
  indexer: H3Indexer = latLngToCell,
): H3CellAggregate[] {
  if (!Number.isInteger(resolution) || resolution < 0 || resolution > 15) {
    throw new Error("H3 resolution must be a whole number from 0 through 15.");
  }
  const cells = new Map<string, H3CellAggregate>();
  for (const point of mappedRecords) {
    const cell = indexer(point.latitude, point.longitude, resolution);
    const entry = cells.get(cell) || { cell, count: 0, points: [] };
    entry.count += 1;
    entry.points.push(point);
    cells.set(cell, entry);
  }
  return [...cells.values()].sort((left, right) => right.count - left.count || left.cell.localeCompare(right.cell));
}

function h3FillColor(count: number, maximumCount: number): string {
  const ratio = maximumCount <= 1 ? 1 : count / maximumCount;
  if (ratio > 0.75) return "#a71918";
  if (ratio > 0.5) return "#d9472b";
  if (ratio > 0.25) return "#ed7b36";
  return "#f3bf5a";
}

function h3CellPopup(cell: string, resolution: number, count: number): HTMLDivElement {
  const content = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = `H3 cell ${cell}`;
  const detail = document.createElement("div");
  detail.textContent = `Resolution ${resolution} - ${count} record${count === 1 ? "" : "s"}`;
  content.append(heading, detail);
  return content;
}

function addH3Layer(resolution: number, name: string): void {
  if (activeRecordPoints.length === 0) throw new Error("Add a case-cluster layer before creating an H3 layer.");
  const cells = aggregateH3Cells(activeRecordPoints, resolution);
  const maximumCount = Math.max(...cells.map((entry) => entry.count));
  const layer = L.featureGroup();
  for (const entry of cells) {
    L.polygon(cellToBoundary(entry.cell), {
      pane: "epi-polygon-pane",
      color: "#743116",
      weight: 1.2,
      fillColor: h3FillColor(entry.count, maximumCount),
      fillOpacity: 0.58,
    }).bindPopup(h3CellPopup(entry.cell, resolution, entry.count)).addTo(layer);
  }
  layer.addTo(ensureMap());
  const bounds = layer.getBounds();
  const id = globalThis.crypto?.randomUUID?.() || `h3-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  h3Layers.set(id, {
    layer,
    name,
    resolution,
    cellCount: cells.length,
    recordCount: activeRecordPoints.length,
    bounds,
  });
  renderH3LayerList();
  updateLayerCount();
  refreshMapEmptyState();
  requiredElement("#map-status").textContent = `Added H3 layer "${name}" with ${cells.length.toLocaleString()} cell${cells.length === 1 ? "" : "s"} from ${activeRecordPoints.length.toLocaleString()} records.`;
  if (bounds.isValid()) map.fitBounds(bounds.pad(0.12), { maxZoom: 16 });
}

function temporalValue(value: RecordValue | undefined): TemporalValue | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const text = String(value).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const date = new Date(year, month, day);
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
    return { timestamp: date.getTime(), kind: "date" };
  }
  const timeOnly = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (timeOnly) {
    const hours = Number(timeOnly[1]);
    const minutes = Number(timeOnly[2]);
    const seconds = Number(timeOnly[3] || 0);
    if (hours > 23 || minutes > 59 || seconds > 59) return null;
    return { timestamp: new Date(1970, 0, 1, hours, minutes, seconds).getTime(), kind: "time" };
  }
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? { timestamp, kind: "datetime" } : null;
}

function formatTimeStop(timestamp: number, kind: TemporalValue["kind"]): string {
  const date = new Date(timestamp);
  if (kind === "time") return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (kind === "date") return date.toLocaleDateString();
  return date.toLocaleString();
}

export function buildTimeLapseStops(mappedRecords: MapPoint[], timeField: string, maximumStops = 1000): TimeLapseStop[] {
  const grouped = new Map<number, TemporalValue & { points: MapPoint[] }>();
  for (const point of mappedRecords) {
    const temporal = temporalValue(point.record?.[timeField]);
    if (!temporal) continue;
    const existing = grouped.get(temporal.timestamp) || { ...temporal, points: [] };
    existing.points.push(point);
    grouped.set(temporal.timestamp, existing);
  }
  if (grouped.size > maximumStops) {
    throw new Error(`The selected field creates ${grouped.size.toLocaleString()} time stops; the demo limit is ${maximumStops.toLocaleString()}.`);
  }
  return [...grouped.values()]
    .sort((left, right) => left.timestamp - right.timestamp)
    .map((stop) => ({ ...stop, label: formatTimeStop(stop.timestamp, stop.kind) }));
}

function renderRecordMarkers(mappedRecords: MapPoint[]): void {
  recordLayer.clearLayers();
  for (const { record, recordIndex, latitude, longitude } of mappedRecords) {
    const marker = L.circleMarker([latitude, longitude], {
      pane: "epi-point-pane",
      radius: 6,
      color: "#9f221b",
      weight: 2,
      fillColor: "#df291e",
      fillOpacity: 0.84,
    }).bindPopup(markerPopup(record, activeRecordLabelField, latitude, longitude));
    if (mapContext === "current-form" && activeRecordOpenHandler) {
      marker.on("dblclick", () => {
        if (activeRecordOpenHandler && activeData) activeRecordOpenHandler(activeData.formId, recordIndex);
      });
    }
    marker.addTo(recordLayer);
  }
}

function pauseTimeLapse() {
  if (!timeLapseState) return;
  if (timeLapseState.timer) clearInterval(timeLapseState.timer);
  timeLapseState.timer = null;
  const button = requiredElement("#map-time-lapse-play");
  button.textContent = "Play";
  button.setAttribute("aria-label", "Play time lapse");
}

function renderTimeLapseStep(index: number): void {
  if (!timeLapseState) return;
  const boundedIndex = Math.max(0, Math.min(index, timeLapseState.stops.length - 1));
  timeLapseState.index = boundedIndex;
  const currentStop = timeLapseState.stops[boundedIndex];
  if (!currentStop) return;
  const visiblePoints = timeLapseState.stops.slice(0, boundedIndex + 1).flatMap((stop) => stop.points);
  renderRecordMarkers(visiblePoints);
  requiredElement("#map-time-lapse-slider").value = String(boundedIndex);
  requiredElement("#map-time-lapse-date").textContent = currentStop.label;
  requiredElement("#map-time-lapse-count").textContent = `${visiblePoints.length} of ${timeLapseState.totalPoints}`;
  requiredElement("#map-point-count").textContent = String(visiblePoints.length);
  requiredElement("#map-status").textContent = `Time lapse: ${currentStop.label} - ${visiblePoints.length} mapped record${visiblePoints.length === 1 ? "" : "s"}.`;
}

function closeTimeLapse(restoreRecords = true) {
  pauseTimeLapse();
  timeLapseState = null;
  requiredElement("#map-time-lapse-controls").hidden = true;
  requiredElement(".map-canvas-wrap").classList.remove("time-lapse-active");
  if (restoreRecords && activeRecordPoints.length > 0) {
    renderRecordMarkers(activeRecordPoints);
    requiredElement("#map-point-count").textContent = String(activeRecordPoints.length);
    requiredElement("#map-status").textContent = `Time lapse closed; showing all ${activeRecordPoints.length} mapped records.`;
  }
}

function plotRecords(data: MapDataSource | null, openRecord: OpenRecordHandler): void {
  const latitudeField = requiredElement("#map-latitude-field").value;
  const longitudeField = requiredElement("#map-longitude-field").value;
  const labelField = requiredElement("#map-label-field").value;
  if (!data || !latitudeField || !longitudeField) {
    requiredElement("#map-status").textContent = "Select a data source, latitude, and longitude fields first.";
    return;
  }

  ensureMap();
  closeTimeLapse(false);
  const mappedRecords = extractMapPoints(data.records, latitudeField, longitudeField);
  activeData = data;
  activeRecordPoints = mappedRecords;
  activeRecordLabelField = labelField;
  activeRecordOpenHandler = openRecord;
  renderRecordMarkers(mappedRecords);
  const points = mappedRecords.map(({ latitude, longitude }) => [latitude, longitude]);
  setMapHeading(data);
  requiredElement("#map-record-layer-name").textContent = `Case Cluster: ${data.formName}`;
  requiredElement("#map-point-count").textContent = String(points.length);
  caseClusterAdded = points.length > 0;
  refreshMapEmptyState();
  updateLayerCount();
  requiredElement("#map-status").textContent = points.length > 0
    ? `Mapped ${points.length} valid record${points.length === 1 ? "" : "s"}.`
    : "No valid coordinates were found in the selected fields.";
  lastBounds = points.length > 0 ? L.latLngBounds(points) : null;
  if (lastBounds?.isValid()) map.fitBounds(lastBounds.pad(0.18), { maxZoom: 15 });
}

function captureLocation() {
  if (!navigator.geolocation) {
    requiredElement("#map-status").textContent = "Geolocation is not available in this browser.";
    return;
  }
  requiredElement("#map-status").textContent = "Waiting for location permission...";
  navigator.geolocation.getCurrentPosition((position) => {
    ensureMap();
    const { latitude, longitude, accuracy } = position.coords;
    locationLayer.clearLayers();
    L.circle([latitude, longitude], { pane: "epi-polygon-pane", radius: accuracy, color: "#d97706", weight: 1, fillColor: "#f0a202", fillOpacity: 0.12 }).addTo(locationLayer);
    L.circleMarker([latitude, longitude], { pane: "epi-point-pane", radius: 7, color: "#92400e", weight: 2, fillColor: "#f0a202", fillOpacity: 0.95 })
      .bindPopup(`Current location<br>Accuracy: ${Math.round(accuracy)} m`).addTo(locationLayer).openPopup();
    locationAdded = true;
    updateLayerCount();
    refreshMapEmptyState();
    map.setView([latitude, longitude], 15);
    requiredElement("#map-status").textContent = `Location captured with ${Math.round(accuracy)} m accuracy.`;
  }, (error) => {
    const messages: Record<number, string> = { 1: "Location permission was denied.", 2: "Location is unavailable.", 3: "Location request timed out." };
    requiredElement("#map-status").textContent = messages[error.code] || error.message || "Unable to capture location.";
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
}

function configureLaunch(context: MapLaunchContext, getCurrentData: () => MapDataSource, openRecord: OpenRecordHandler): void {
  mapContext = context;
  resetMapWorkspace();
  if (context === "current-form") {
    activeData = getCurrentData();
    setMapHeading(activeData);
    const selectedFields = populateFieldSelectors(activeData);
    if (selectedFields.latitude && selectedFields.longitude) {
      plotRecords(activeData, openRecord);
    } else {
      requiredElement("#map-empty-state").textContent = "The current form is linked, but its coordinate fields need to be selected.";
      requiredElement("#map-status").textContent = "Latitude and longitude fields were not identified. Use Add Data Layer > Case Cluster to select them.";
    }
  } else {
    setMapHeading();
    requiredElement("#map-empty-state").textContent = "Select Add Data Layer > Case Cluster, then choose a project form.";
    requiredElement("#map-status").textContent = "Standalone map ready.";
  }
}

function prepareCaseClusterDialog(
  getCurrentData: () => MapDataSource,
  getDataSources: () => MapDataSource[],
): MapDataSource[] {
  const source = requiredElement("#map-data-source");
  const title = requiredElement("#case-cluster-dialog-title");
  const description = requiredElement("#case-cluster-dialog-description");
  const sources = mapContext === "current-form" ? [getCurrentData()] : getDataSources();
  source.replaceChildren(option("", "Select a project form"), ...sources.map((data) => (
    option(data.formId, `${data.projectName} / ${data.formName} (${data.records.length} records)`)
  )));
  if (mapContext === "current-form") {
    title.textContent = "Case Cluster - Current Form";
    description.textContent = "Use the form currently open in Enter Data (equivalent to selecting No for external data in Epi Info 7).";
    source.value = sources[0]?.formId || "";
  } else {
    title.textContent = "Select Data Source";
    description.textContent = "Choose a project form for this standalone map.";
  }
  activeData = sources.find((data) => data.formId === source.value) || null;
  if (activeData) populateFieldSelectors(activeData);
  else {
    requiredElement("#map-latitude-field").replaceChildren(option("", "Select a data source first"));
    requiredElement("#map-longitude-field").replaceChildren(option("", "Select a data source first"));
    requiredElement("#map-label-field").replaceChildren(option("", "Select a data source first"));
  }
  return sources;
}

export function initializeMaps(
  getCurrentData: () => MapDataSource,
  getDataSources: () => MapDataSource[],
  openRecord: OpenRecordHandler,
): void {
  const caseClusterDialog = requiredElement("#case-cluster-dialog");
  const h3Dialog = requiredElement("#h3-dialog");
  const h3Form = requiredElement("#h3-form");
  const h3Resolution = requiredElement("#h3-resolution");
  const h3ResolutionValue = requiredElement("#h3-resolution-value");
  const h3ResolutionDetail = requiredElement("#h3-resolution-detail");
  const h3LayerName = requiredElement("#h3-layer-name");
  const h3Status = requiredElement("#h3-dialog-status");
  const rasterDialog = requiredElement("#raster-dialog");
  const rasterForm = requiredElement("#raster-form");
  const rasterFile = requiredElement("#raster-file");
  const rasterName = requiredElement("#raster-layer-name");
  const rasterOpacity = requiredElement("#raster-opacity");
  const rasterOpacityValue = requiredElement("#raster-opacity-value");
  const rasterStatus = requiredElement("#raster-dialog-status");
  const timeLapseDialog = requiredElement("#time-lapse-dialog");
  const timeLapseField = requiredElement("#time-lapse-field");
  const timeLapseStatus = requiredElement("#time-lapse-dialog-status");
  const geoJsonDialog = requiredElement("#geojson-dialog");
  const geoJsonForm = requiredElement("#geojson-form");
  const geoJsonFile = requiredElement("#geojson-file");
  const geoJsonName = requiredElement("#geojson-layer-name");
  const geoJsonLabelField = requiredElement("#geojson-label-field");
  const geoJsonStatus = requiredElement("#geojson-dialog-status");
  const layerPanel = requiredElement("#map-layer-panel");
  const layerPanelToggle = requiredElement("#map-layer-panel-toggle");
  let dialogSources: MapDataSource[] = [];
  let geoJsonInspectionVersion = 0;
  const updateH3ResolutionDescription = () => {
    const resolution = Number(h3Resolution.value);
    const edgeKilometers = getHexagonEdgeLengthAvg(resolution, UNITS.km);
    const areaSquareKilometers = getHexagonAreaAvg(resolution, UNITS.km2);
    h3ResolutionValue.textContent = String(resolution);
    h3LayerName.placeholder = `H3 Resolution ${resolution}`;
    const edge = edgeKilometers >= 1
      ? `${edgeKilometers.toLocaleString(undefined, { maximumFractionDigits: 2 })} km`
      : `${(edgeKilometers * 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} m`;
    const area = areaSquareKilometers >= 1
      ? `${areaSquareKilometers.toLocaleString(undefined, { maximumFractionDigits: 2 })} km²`
      : `${(areaSquareKilometers * 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 0 })} m²`;
    h3ResolutionDetail.textContent = `At resolution ${resolution}, an average hexagon has an edge about ${edge} long and covers about ${area}.`;
  };
  const updateLayerPanelToggle = () => {
    const action = layerPanel.open ? "Minimize" : "Maximize";
    layerPanelToggle.setAttribute("aria-label", `${action} map layers`);
    layerPanelToggle.setAttribute("aria-expanded", String(layerPanel.open));
    layerPanelToggle.title = `${action} map layers`;
  };
  layerPanel.addEventListener("toggle", updateLayerPanelToggle);
  updateLayerPanelToggle();
  for (const button of requiredElements('[data-module="maps"], [data-open-module="maps"]')) {
    button.addEventListener("click", () => {
      const context: MapLaunchContext = button.dataset.mapContext === "current-form" ? "current-form" : "standalone";
      setTimeout(() => {
        try {
          ensureMap();
          configureLaunch(context, getCurrentData, openRecord);
          map.invalidateSize();
        } catch (error) {
          requiredElement("#map-status").textContent = error instanceof Error ? error.message : "Unable to open Maps.";
        }
      }, 0);
    });
  }
  requiredElement("#map-add-case-cluster").addEventListener("click", () => {
    requiredElement("#map-add-layer-menu").open = false;
    dialogSources = prepareCaseClusterDialog(getCurrentData, getDataSources);
    caseClusterDialog.showModal();
  });
  requiredElement("#map-data-source").addEventListener("change", (event) => {
    const target = eventControl(event);
    activeData = dialogSources.find((data) => data.formId === target.value) || null;
    if (activeData) populateFieldSelectors(activeData);
  });
  for (const button of requiredElements("[data-close-case-cluster]")) {
    button.addEventListener("click", () => caseClusterDialog.close("cancel"));
  }
  requiredElement("#case-cluster-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!eventForm(event).reportValidity()) return;
    plotRecords(activeData, openRecord);
    caseClusterDialog.close("plot");
  });
  requiredElement("#map-create-timelapse").addEventListener("click", () => {
    if (!caseClusterAdded || !activeData || activeRecordPoints.length === 0) {
      requiredElement("#map-status").textContent = "Add a case-cluster layer before creating a time lapse.";
      return;
    }
    const temporalFields = activeData.fields.filter((field) => (
      ["date", "time", "datetime", "date-time"].includes(field.type)
      || /(date|time)/i.test(`${field.name} ${field.prompt || ""}`)
    ));
    if (temporalFields.length === 0) {
      requiredElement("#map-status").textContent = "The current case cluster has no date or time fields.";
      return;
    }
    timeLapseField.replaceChildren(
      option("", "Select a time field"),
      ...temporalFields.map((field) => option(field.name, `${field.prompt} (${field.name})`)),
    );
    timeLapseStatus.textContent = "Records with blank or invalid time values will be skipped. A maximum of 1,000 time stops is supported.";
    timeLapseDialog.showModal();
  });
  for (const button of requiredElements("[data-close-time-lapse]")) {
    button.addEventListener("click", () => timeLapseDialog.close("cancel"));
  }
  requiredElement("#time-lapse-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!eventForm(event).reportValidity()) return;
    try {
      const stops = buildTimeLapseStops(activeRecordPoints, timeLapseField.value);
      if (stops.length === 0) {
        timeLapseStatus.textContent = "No mapped records contain a valid value in the selected time field.";
        return;
      }
      closeTimeLapse(false);
      timeLapseState = {
        field: timeLapseField.value,
        index: 0,
        stops,
        timer: null,
        totalPoints: stops.reduce((total, stop) => total + stop.points.length, 0),
      };
      const slider = requiredElement("#map-time-lapse-slider");
      slider.max = String(stops.length - 1);
      slider.value = "0";
      requiredElement("#map-time-lapse-controls").hidden = false;
      requiredElement(".map-canvas-wrap").classList.add("time-lapse-active");
      renderTimeLapseStep(0);
      timeLapseDialog.close("create");
    } catch (error) {
      timeLapseStatus.textContent = error instanceof Error ? error.message : "Unable to create the time lapse.";
    }
  });
  requiredElement("#map-time-lapse-play").addEventListener("click", () => {
    if (!timeLapseState) return;
    if (timeLapseState.timer) {
      pauseTimeLapse();
      return;
    }
    if (timeLapseState.index >= timeLapseState.stops.length - 1) renderTimeLapseStep(0);
    const button = requiredElement("#map-time-lapse-play");
    button.textContent = "Pause";
    button.setAttribute("aria-label", "Pause time lapse");
    timeLapseState.timer = setInterval(() => {
      if (!timeLapseState || timeLapseState.index >= timeLapseState.stops.length - 1) {
        pauseTimeLapse();
        return;
      }
      renderTimeLapseStep(timeLapseState.index + 1);
    }, 900);
  });
  requiredElement("#map-time-lapse-slider").addEventListener("input", (event) => {
    pauseTimeLapse();
    renderTimeLapseStep(Number(eventControl(event).value));
  });
  requiredElement("#map-time-lapse-close").addEventListener("click", () => closeTimeLapse(true));
  requiredElement("#map-add-h3").addEventListener("click", () => {
    requiredElement("#map-add-layer-menu").open = false;
    if (!caseClusterAdded || activeRecordPoints.length === 0) {
      requiredElement("#map-status").textContent = "Add a case-cluster layer before creating an H3 layer.";
      return;
    }
    h3Form.reset();
    h3Resolution.value = "8";
    h3Status.textContent = "Coordinates are indexed locally in this browser.";
    updateH3ResolutionDescription();
    h3Dialog.showModal();
  });
  h3Resolution.addEventListener("input", updateH3ResolutionDescription);
  for (const button of requiredElements("[data-close-h3]")) {
    button.addEventListener("click", () => h3Dialog.close("cancel"));
  }
  h3Form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!eventForm(event).reportValidity()) return;
    try {
      const resolution = Number(h3Resolution.value);
      const layerName = h3LayerName.value.trim() || `H3 Resolution ${resolution}`;
      addH3Layer(resolution, layerName);
      h3Dialog.close("add");
    } catch (error) {
      h3Status.textContent = error instanceof Error ? error.message : "Unable to create the H3 layer.";
    }
  });
  requiredElement("#map-add-raster").addEventListener("click", () => {
    requiredElement("#map-add-layer-menu").open = false;
    rasterForm.reset();
    rasterOpacity.value = "70";
    rasterOpacityValue.textContent = "70%";
    rasterStatus.textContent = "Files stay in this browser. Maximum size: 50 MB; display is downsampled to at most 1,048,576 pixels.";
    rasterDialog.showModal();
  });
  rasterOpacity.addEventListener("input", () => { rasterOpacityValue.textContent = `${rasterOpacity.value}%`; });
  rasterFile.addEventListener("change", () => {
    const file = rasterFile.files?.[0];
    if (file && !rasterName.value.trim()) rasterName.value = file.name.replace(/\.tiff?$/i, "");
  });
  for (const button of requiredElements("[data-close-raster]")) {
    button.addEventListener("click", () => rasterDialog.close("cancel"));
  }
  rasterForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!eventForm(event).reportValidity()) return;
    const file = rasterFile.files?.[0];
    if (!file) {
      rasterStatus.textContent = "Choose a GeoTIFF file first.";
      return;
    }
    rasterStatus.textContent = "Reading and rendering the GeoTIFF locally...";
    try {
      await addRasterLayer(file, rasterName.value.trim() || file.name.replace(/\.tiff?$/i, "") || "GeoTIFF Raster", Number(rasterOpacity.value) / 100);
      rasterDialog.close("add");
    } catch (error) {
      rasterStatus.textContent = error instanceof Error ? error.message : "Unable to add this GeoTIFF raster.";
    }
  });
  requiredElement("#map-add-geojson").addEventListener("click", () => {
    requiredElement("#map-add-layer-menu").open = false;
    geoJsonForm.reset();
    geoJsonLabelField.replaceChildren(option("", "No polygon labels"));
    geoJsonLabelField.disabled = true;
    geoJsonStatus.textContent = "Files are read locally and are not uploaded to a server. Maximum size: 10 MB.";
    geoJsonDialog.showModal();
  });
  geoJsonFile.addEventListener("change", async () => {
    const inspectionVersion = ++geoJsonInspectionVersion;
    const file = geoJsonFile.files?.[0];
    geoJsonLabelField.replaceChildren(option("", "No polygon labels"));
    geoJsonLabelField.disabled = true;
    if (!file) return;
    if (!geoJsonName.value.trim()) geoJsonName.value = file.name.replace(/\.(?:geojson|json)$/i, "");
    if (file.size > MAX_GEOJSON_BYTES) {
      geoJsonStatus.textContent = "This file is larger than the 10 MB demo limit.";
      return;
    }
    geoJsonStatus.textContent = "Inspecting GeoJSON properties...";
    try {
      const { geojson, featureCount } = parseGeoJson(await file.text());
      if (inspectionVersion !== geoJsonInspectionVersion) return;
      const fields = listGeoJsonPolygonProperties(geojson);
      geoJsonLabelField.replaceChildren(
        option("", "No polygon labels"),
        ...fields.map((field) => option(field, field)),
      );
      geoJsonLabelField.disabled = fields.length === 0;
      geoJsonStatus.textContent = fields.length > 0
        ? `${featureCount.toLocaleString()} feature${featureCount === 1 ? "" : "s"}; choose one of ${fields.length} polygon label field${fields.length === 1 ? "" : "s"}, or use no labels.`
        : `${featureCount.toLocaleString()} feature${featureCount === 1 ? "" : "s"}; no simple polygon properties are available for labels.`;
    } catch (error) {
      if (inspectionVersion === geoJsonInspectionVersion) {
        geoJsonStatus.textContent = error instanceof Error ? error.message : "Unable to inspect this GeoJSON file.";
      }
    }
  });
  for (const button of requiredElements("[data-close-geojson]")) {
    button.addEventListener("click", () => geoJsonDialog.close("cancel"));
  }
  geoJsonForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!eventForm(event).reportValidity()) return;
    const file = geoJsonFile.files?.[0];
    if (!file) {
      geoJsonStatus.textContent = "Choose a GeoJSON file first.";
      return;
    }
    if (file.size > MAX_GEOJSON_BYTES) {
      geoJsonStatus.textContent = "This file is larger than the 10 MB demo limit.";
      return;
    }
    geoJsonStatus.textContent = "Reading GeoJSON...";
    try {
      const { geojson, featureCount } = parseGeoJson(await file.text());
      const layerName = geoJsonName.value.trim() || file.name.replace(/\.(?:geojson|json)$/i, "") || "GeoJSON Layer";
      addGeoJsonLayer(geojson, featureCount, layerName, geoJsonLabelField.value);
      geoJsonDialog.close("add");
    } catch (error) {
      geoJsonStatus.textContent = error instanceof Error ? error.message : "Unable to add this GeoJSON file.";
    }
  });
  requiredElement("#map-geojson-layers").addEventListener("change", (event) => {
    const target = eventControl(event);
    const labelToggleId = target.dataset.geojsonLabelToggle;
    if (labelToggleId) {
      const entry = geoJsonLayers.get(labelToggleId);
      if (!entry) return;
      entry.labelsEnabled = target.checked;
      updateGeoJsonLabelVisibility();
      requiredElement("#map-status").textContent = `${entry.name} labels ${entry.labelsEnabled ? "enabled" : "hidden"}.`;
      return;
    }
    const id = target.dataset.geojsonToggle;
    if (!id) return;
    const entry = geoJsonLayers.get(id);
    if (!entry) return;
    if (target.checked) entry.layer.addTo(ensureMap());
    else if (map.hasLayer(entry.layer)) map.removeLayer(entry.layer);
    updateGeoJsonLabelVisibility();
    requiredElement("#map-status").textContent = `${entry.name} ${target.checked ? "shown" : "hidden"}.`;
  });
  requiredElement("#map-geojson-layers").addEventListener("click", (event) => {
    const id = eventControl(event).dataset.geojsonRemove;
    if (!id) return;
    const entry = geoJsonLayers.get(id);
    if (!entry) return;
    if (map.hasLayer(entry.layer)) map.removeLayer(entry.layer);
    geoJsonLayers.delete(id);
    renderGeoJsonLayerList();
    updateLayerCount();
    refreshMapEmptyState();
    requiredElement("#map-status").textContent = `Removed GeoJSON layer “${entry.name}”.`;
  });
  requiredElement("#map-h3-layers").addEventListener("change", (event) => {
    const target = eventControl(event);
    const id = target.dataset.h3Toggle;
    if (!id) return;
    const entry = h3Layers.get(id);
    if (!entry) return;
    if (target.checked) entry.layer.addTo(ensureMap());
    else if (map.hasLayer(entry.layer)) map.removeLayer(entry.layer);
    requiredElement("#map-status").textContent = `${entry.name} ${target.checked ? "shown" : "hidden"}.`;
  });
  requiredElement("#map-h3-layers").addEventListener("click", (event) => {
    const id = eventControl(event).dataset.h3Remove;
    if (!id) return;
    const entry = h3Layers.get(id);
    if (!entry) return;
    if (map.hasLayer(entry.layer)) map.removeLayer(entry.layer);
    h3Layers.delete(id);
    renderH3LayerList();
    updateLayerCount();
    refreshMapEmptyState();
    requiredElement("#map-status").textContent = `Removed H3 layer "${entry.name}".`;
  });
  requiredElement("#map-raster-layers").addEventListener("input", (event) => {
    const target = eventControl(event);
    const id = target.dataset.rasterOpacity;
    if (!id) return;
    const entry = rasterLayers.get(id);
    if (!entry) return;
    entry.opacity = Number(target.value) / 100;
    entry.layer.setOpacity(entry.opacity);
    requiredElement("#map-status").textContent = `${entry.name} opacity ${target.value}%.`;
  });
  requiredElement("#map-raster-layers").addEventListener("change", (event) => {
    const target = eventControl(event);
    const id = target.dataset.rasterToggle;
    if (!id) return;
    const entry = rasterLayers.get(id);
    if (!entry) return;
    if (target.checked) entry.layer.addTo(ensureMap());
    else if (map.hasLayer(entry.layer)) map.removeLayer(entry.layer);
    requiredElement("#map-status").textContent = `${entry.name} ${target.checked ? "shown" : "hidden"}.`;
  });
  requiredElement("#map-raster-layers").addEventListener("click", (event) => {
    const id = eventControl(event).dataset.rasterRemove;
    if (!id) return;
    const entry = rasterLayers.get(id);
    if (!entry) return;
    if (map.hasLayer(entry.layer)) map.removeLayer(entry.layer);
    rasterLayers.delete(id);
    renderRasterLayerList();
    updateLayerCount();
    refreshMapEmptyState();
    requiredElement("#map-status").textContent = `Removed GeoTIFF raster “${entry.name}”.`;
  });
  requiredElement("#map-current-location").addEventListener("click", captureLocation);
  requiredElement("#map-fullscreen-toggle").addEventListener("click", async () => {
    try {
      await toggleMapFullscreen();
    } catch (error) {
      requiredElement("#map-status").textContent = error instanceof Error ? error.message : "Unable to change fullscreen mode.";
    }
  });
  document.addEventListener("fullscreenchange", updateFullscreenControl);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && fallbackFullscreen) setFallbackFullscreen(false);
  });
  updateFullscreenControl();
  requiredElement("#map-fit-points").addEventListener("click", () => {
    const bounds = combinedLayerBounds();
    if (bounds.isValid()) ensureMap().fitBounds(bounds.pad(0.18), { maxZoom: 15 });
    else requiredElement("#map-status").textContent = "Add or show a case-cluster, H3, GeoJSON, or GeoTIFF layer before fitting the map.";
  });
  for (const radio of requiredElements('[name="map-basemap"]')) {
    radio.addEventListener("change", (event) => {
      const currentMap = ensureMap();
      if (eventControl(event).value === "street") {
        if (!currentMap.hasLayer(tileLayer)) tileLayer.addTo(currentMap);
        requiredElement("#map-status").textContent = "Street background selected.";
      } else if (currentMap.hasLayer(tileLayer)) {
        currentMap.removeLayer(tileLayer);
        requiredElement("#map-status").textContent = "Blank background selected.";
      }
    });
  }
  requiredElement("#map-record-layer-toggle").addEventListener("change", (event) => {
    const currentMap = ensureMap();
    if (eventControl(event).checked) recordLayer.addTo(currentMap);
    else if (currentMap.hasLayer(recordLayer)) currentMap.removeLayer(recordLayer);
  });
  requiredElement("#map-location-layer-toggle").addEventListener("change", (event) => {
    const currentMap = ensureMap();
    if (eventControl(event).checked) locationLayer.addTo(currentMap);
    else if (currentMap.hasLayer(locationLayer)) currentMap.removeLayer(locationLayer);
  });
}
