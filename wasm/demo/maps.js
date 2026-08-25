let map = null;
let tileLayer = null;
let recordLayer = null;
let locationLayer = null;
let lastBounds = null;
let caseClusterAdded = false;
let locationAdded = false;
let mapContext = "standalone";
let activeData = null;
let fallbackFullscreen = false;
let activeRecordPoints = [];
let activeRecordLabelField = "";
let activeRecordOpenHandler = null;
let timeLapseState = null;
const geoJsonLayers = new Map();
const MAX_GEOJSON_BYTES = 10 * 1024 * 1024;
const MAX_GEOJSON_FEATURES = 10000;

function updateLayerCount() {
  const count = Number(caseClusterAdded) + Number(locationAdded) + geoJsonLayers.size;
  document.querySelector("#map-layer-count").textContent = String(count);
}

function option(value, label) {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = label;
  return item;
}

function likelyField(fields, patterns) {
  return fields.find((field) => patterns.some((pattern) => (
    pattern.test(field.name || "") || pattern.test(field.prompt || "")
  )))?.name || "";
}

export function inferMapFields(fields) {
  return {
    latitude: likelyField(fields, [/^lat$/i, /latitude/i, /gps_?lat/i]),
    longitude: likelyField(fields, [/^(lon|lng|long)$/i, /longitude/i, /gps_?(lon|lng)/i]),
    label: likelyField(fields, [/case[\s_-]?id/i, /^id$/i, /name/i]),
  };
}

export function parseGeoJson(text, maximumFeatures = MAX_GEOJSON_FEATURES) {
  let geojson;
  try {
    geojson = JSON.parse(text);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!geojson || typeof geojson !== "object" || Array.isArray(geojson)) {
    throw new Error("The file must contain a GeoJSON object.");
  }
  const geometryTypes = new Set([
    "Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon", "GeometryCollection",
  ]);
  const validateGeometry = (geometry) => {
    if (geometry === null) return;
    if (!geometry || typeof geometry !== "object" || !geometryTypes.has(geometry.type)) {
      throw new Error("A GeoJSON feature contains an invalid geometry.");
    }
    if (geometry.type === "GeometryCollection") {
      if (!Array.isArray(geometry.geometries)) throw new Error("A GeometryCollection must contain a geometries array.");
      geometry.geometries.forEach(validateGeometry);
    } else if (!Array.isArray(geometry.coordinates)) {
      throw new Error(`A ${geometry.type} geometry must contain coordinates.`);
    }
  };
  const validateFeature = (feature) => {
    if (!feature || feature.type !== "Feature") throw new Error("Every item in a GeoJSON FeatureCollection must be a Feature.");
    if (!("geometry" in feature)) throw new Error("A GeoJSON Feature is missing its geometry.");
    validateGeometry(feature.geometry);
  };
  let featureCount = 1;
  if (geojson.type === "FeatureCollection") {
    if (!Array.isArray(geojson.features)) throw new Error("A GeoJSON FeatureCollection must contain a features array.");
    featureCount = geojson.features.length;
    geojson.features.forEach(validateFeature);
  } else if (geojson.type === "Feature") {
    validateFeature(geojson);
  } else if (!geometryTypes.has(geojson.type)) {
    throw new Error("Use a GeoJSON FeatureCollection, Feature, or geometry object.");
  } else {
    validateGeometry(geojson);
  }
  if (featureCount > maximumFeatures) {
    throw new Error(`This file has ${featureCount.toLocaleString()} features; the demo limit is ${maximumFeatures.toLocaleString()}.`);
  }
  return { geojson, featureCount };
}

export function listGeoJsonPolygonProperties(geojson) {
  const features = geojson?.type === "FeatureCollection"
    ? geojson.features
    : geojson?.type === "Feature"
      ? [geojson]
      : [];
  const fields = new Set();
  for (const feature of features || []) {
    if (!["Polygon", "MultiPolygon"].includes(feature?.geometry?.type)) continue;
    for (const [key, value] of Object.entries(feature.properties || {})) {
      if (value === null || ["string", "number", "boolean"].includes(typeof value)) fields.add(key);
    }
  }
  return [...fields].sort((left, right) => left.localeCompare(right));
}

function pointInRing([x, y], ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInPolygon(point, rings) {
  return rings.length > 0 && pointInRing(point, rings[0]) && !rings.slice(1).some((ring) => pointInRing(point, ring));
}

function distanceToSegmentSquared([x, y], [startX, startY], [endX, endY]) {
  const segmentX = endX - startX;
  const segmentY = endY - startY;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  let ratio = lengthSquared === 0 ? 0 : ((x - startX) * segmentX + (y - startY) * segmentY) / lengthSquared;
  ratio = Math.max(0, Math.min(1, ratio));
  const offsetX = x - (startX + segmentX * ratio);
  const offsetY = y - (startY + segmentY * ratio);
  return offsetX * offsetX + offsetY * offsetY;
}

function signedPolygonDistance(point, rings) {
  let minimumSquared = Infinity;
  for (const ring of rings) {
    for (let index = 0; index < ring.length; index += 1) {
      minimumSquared = Math.min(
        minimumSquared,
        distanceToSegmentSquared(point, ring[index], ring[(index + 1) % ring.length]),
      );
    }
  }
  const distance = Math.sqrt(minimumSquared);
  return pointInPolygon(point, rings) ? distance : -distance;
}

function ringCentroid(ring) {
  let areaTwice = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[(index + 1) % ring.length];
    const cross = x1 * y2 - x2 * y1;
    areaTwice += cross;
    x += (x1 + x2) * cross;
    y += (y1 + y2) * cross;
  }
  if (Math.abs(areaTwice) < Number.EPSILON) return ring[0];
  return [x / (3 * areaTwice), y / (3 * areaTwice)];
}

function interiorPointForPolygon(coordinates) {
  if (!Array.isArray(coordinates?.[0]) || coordinates[0].length < 3) return null;
  const latitudes = coordinates[0].map((position) => Number(position[1])).filter(Number.isFinite);
  if (latitudes.length < 3) return null;
  let minimumLatitude = Infinity;
  let maximumLatitude = -Infinity;
  for (const latitude of latitudes) {
    minimumLatitude = Math.min(minimumLatitude, latitude);
    maximumLatitude = Math.max(maximumLatitude, latitude);
  }
  const meanLatitude = (minimumLatitude + maximumLatitude) / 2;
  const longitudeScale = Math.max(0.01, Math.cos(meanLatitude * Math.PI / 180));
  const rings = coordinates.map((ring) => ring
    .map(([longitude, latitude]) => [Number(longitude) * longitudeScale, Number(latitude)])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)))
    .filter((ring) => ring.length >= 3);
  if (rings.length === 0) return null;
  let minimumX = Infinity;
  let maximumX = -Infinity;
  let minimumY = Infinity;
  let maximumY = -Infinity;
  for (const [x, y] of rings[0]) {
    minimumX = Math.min(minimumX, x);
    maximumX = Math.max(maximumX, x);
    minimumY = Math.min(minimumY, y);
    maximumY = Math.max(maximumY, y);
  }
  const width = maximumX - minimumX;
  const height = maximumY - minimumY;
  if (width === 0 || height === 0) return null;

  let bestPoint = ringCentroid(rings[0]);
  let bestDistance = signedPolygonDistance(bestPoint, rings);
  const center = [(minimumX + maximumX) / 2, (minimumY + maximumY) / 2];
  const centerDistance = signedPolygonDistance(center, rings);
  if (centerDistance > bestDistance) [bestPoint, bestDistance] = [center, centerDistance];

  const gridSize = 10;
  for (let xIndex = 0; xIndex < gridSize; xIndex += 1) {
    for (let yIndex = 0; yIndex < gridSize; yIndex += 1) {
      const candidate = [
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
        const candidate = [bestPoint[0] + xOffset * step, bestPoint[1] + yOffset * step];
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

export function polygonLabelAnchor(geometry) {
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

function setMapHeading(data = null) {
  const heading = document.querySelector("#map-project-name");
  if (!data) {
    heading.textContent = "Standalone map - no data source selected";
    return;
  }
  const linked = mapContext === "current-form" ? " - linked to Enter Data" : "";
  heading.textContent = `${data.projectName} / ${data.formName}${linked}`;
}

function populateFieldSelectors(data) {
  const latitude = document.querySelector("#map-latitude-field");
  const longitude = document.querySelector("#map-longitude-field");
  const label = document.querySelector("#map-label-field");
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
  if (!globalThis.L) throw new Error("The map library could not be loaded.");
  map = L.map("epi-map", { zoomControl: true }).setView([39.8283, -98.5795], 4);
  tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
  tileLayer.on("tileerror", () => {
    document.querySelector("#map-status").textContent = "Basemap unavailable; local point layers still work.";
  });
  tileLayer.addTo(map);
  recordLayer = L.layerGroup().addTo(map);
  locationLayer = L.layerGroup().addTo(map);
  L.control.scale({ imperial: true, metric: true }).addTo(map);
  map.on("zoomend", updateGeoJsonLabelVisibility);
  return map;
}

function mapWindowElement() {
  return document.querySelector("[data-module-view='maps'] .map-window");
}

function updateFullscreenControl() {
  const target = mapWindowElement();
  const button = document.querySelector("#map-fullscreen-toggle");
  const active = document.fullscreenElement === target || fallbackFullscreen;
  button.setAttribute("aria-pressed", String(active));
  button.setAttribute("aria-label", active ? "Exit map fullscreen" : "Enter map fullscreen");
  button.title = active ? "Exit map fullscreen" : "Enter map fullscreen";
  requestAnimationFrame(() => requestAnimationFrame(() => map?.invalidateSize({ pan: false })));
}

function setFallbackFullscreen(active) {
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
      document.querySelector("#map-status").textContent = "Map expanded to fill this browser window.";
      return;
    }
  }
  setFallbackFullscreen(true);
  document.querySelector("#map-status").textContent = "Map expanded to fill this browser window.";
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
  lastBounds = null;
  caseClusterAdded = false;
  locationAdded = false;
  activeData = null;
  activeRecordPoints = [];
  activeRecordLabelField = "";
  activeRecordOpenHandler = null;
  document.querySelector("#map-point-count").textContent = "0";
  document.querySelector("#map-record-layer-name").textContent = "Case Cluster";
  document.querySelector("#map-record-layer-toggle").checked = true;
  document.querySelector("#map-location-layer-toggle").checked = true;
  document.querySelector("#map-layer-panel").open = false;
  document.querySelector("#map-empty-state").hidden = false;
  updateLayerCount();
  map.setView([39.8283, -98.5795], 4);
}

function markerPopup(record, labelField, latitude, longitude) {
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

function geoJsonPopup(feature) {
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

function refreshMapEmptyState() {
  document.querySelector("#map-empty-state").hidden = caseClusterAdded || locationAdded || geoJsonLayers.size > 0;
}

function renderGeoJsonLayerList() {
  const container = document.querySelector("#map-geojson-layers");
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

function combinedLayerBounds() {
  const bounds = L.latLngBounds([]);
  if (caseClusterAdded && map.hasLayer(recordLayer) && lastBounds?.isValid()) bounds.extend(lastBounds);
  for (const entry of geoJsonLayers.values()) {
    if (map.hasLayer(entry.layer) && entry.bounds?.isValid()) bounds.extend(entry.bounds);
  }
  return bounds;
}

function labelClearanceInPixels(label) {
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

function addGeoJsonLayer(geojson, featureCount, name, labelField = "") {
  const currentMap = ensureMap();
  const labelLayer = L.layerGroup();
  const labels = [];
  const geometryLayer = L.geoJSON(geojson, {
    style: { color: "#2563a5", weight: 2, fillColor: "#4f9dc7", fillOpacity: 0.22 },
    pointToLayer: (_feature, latlng) => L.circleMarker(latlng, {
      radius: 6,
      color: "#174f78",
      weight: 2,
      fillColor: "#66b5d4",
      fillOpacity: 0.9,
    }),
    onEachFeature: (feature, featureLayer) => {
      const popup = geoJsonPopup(feature);
      if (popup) featureLayer.bindPopup(popup);
      if (labelField && ["Polygon", "MultiPolygon"].includes(feature?.geometry?.type)) {
        const labelValue = feature.properties?.[labelField];
        if (labelValue !== null && labelValue !== undefined && typeof labelValue !== "object") {
          const anchor = polygonLabelAnchor(feature.geometry);
          if (!anchor) return;
          const text = String(labelValue);
          const label = document.createElement("span");
          label.className = "geojson-polygon-label";
          label.textContent = text;
          const marker = L.marker([anchor.latitude, anchor.longitude], {
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
  });
  const layer = L.layerGroup([geometryLayer, labelLayer]);
  layer.addTo(currentMap);
  const bounds = geometryLayer.getBounds();
  const id = globalThis.crypto?.randomUUID?.() || `geojson-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  geoJsonLayers.set(id, { layer, name, featureCount, bounds, labelField, labels, labelsEnabled: true });
  renderGeoJsonLayerList();
  updateLayerCount();
  refreshMapEmptyState();
  const labelMessage = labelField ? ` Polygon labels use “${labelField}”.` : "";
  document.querySelector("#map-status").textContent = `Added GeoJSON layer “${name}” with ${featureCount.toLocaleString()} feature${featureCount === 1 ? "" : "s"}.${labelMessage}`;
  if (bounds.isValid()) currentMap.fitBounds(bounds.pad(0.12), { maxZoom: 16 });
  updateGeoJsonLabelVisibility();
}

export function extractMapPoints(records, latitudeField, longitudeField) {
  const points = [];
  records.forEach((record, recordIndex) => {
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

function temporalValue(value) {
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

function formatTimeStop(timestamp, kind) {
  const date = new Date(timestamp);
  if (kind === "time") return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (kind === "date") return date.toLocaleDateString();
  return date.toLocaleString();
}

export function buildTimeLapseStops(mappedRecords, timeField, maximumStops = 1000) {
  const grouped = new Map();
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

function renderRecordMarkers(mappedRecords) {
  recordLayer.clearLayers();
  for (const { record, recordIndex, latitude, longitude } of mappedRecords) {
    const marker = L.circleMarker([latitude, longitude], {
      radius: 6,
      color: "#9f221b",
      weight: 2,
      fillColor: "#df291e",
      fillOpacity: 0.84,
    }).bindPopup(markerPopup(record, activeRecordLabelField, latitude, longitude));
    if (mapContext === "current-form" && activeRecordOpenHandler) {
      marker.on("dblclick", () => activeRecordOpenHandler(activeData.formId, recordIndex));
    }
    marker.addTo(recordLayer);
  }
}

function pauseTimeLapse() {
  if (!timeLapseState) return;
  if (timeLapseState.timer) clearInterval(timeLapseState.timer);
  timeLapseState.timer = null;
  const button = document.querySelector("#map-time-lapse-play");
  button.textContent = "Play";
  button.setAttribute("aria-label", "Play time lapse");
}

function renderTimeLapseStep(index) {
  if (!timeLapseState) return;
  const boundedIndex = Math.max(0, Math.min(index, timeLapseState.stops.length - 1));
  timeLapseState.index = boundedIndex;
  const visiblePoints = timeLapseState.stops.slice(0, boundedIndex + 1).flatMap((stop) => stop.points);
  renderRecordMarkers(visiblePoints);
  document.querySelector("#map-time-lapse-slider").value = String(boundedIndex);
  document.querySelector("#map-time-lapse-date").textContent = timeLapseState.stops[boundedIndex].label;
  document.querySelector("#map-time-lapse-count").textContent = `${visiblePoints.length} of ${timeLapseState.totalPoints}`;
  document.querySelector("#map-point-count").textContent = String(visiblePoints.length);
  document.querySelector("#map-status").textContent = `Time lapse: ${timeLapseState.stops[boundedIndex].label} - ${visiblePoints.length} mapped record${visiblePoints.length === 1 ? "" : "s"}.`;
}

function closeTimeLapse(restoreRecords = true) {
  pauseTimeLapse();
  timeLapseState = null;
  document.querySelector("#map-time-lapse-controls").hidden = true;
  document.querySelector(".map-canvas-wrap").classList.remove("time-lapse-active");
  if (restoreRecords && activeRecordPoints.length > 0) {
    renderRecordMarkers(activeRecordPoints);
    document.querySelector("#map-point-count").textContent = String(activeRecordPoints.length);
    document.querySelector("#map-status").textContent = `Time lapse closed; showing all ${activeRecordPoints.length} mapped records.`;
  }
}

function plotRecords(data, openRecord) {
  const latitudeField = document.querySelector("#map-latitude-field").value;
  const longitudeField = document.querySelector("#map-longitude-field").value;
  const labelField = document.querySelector("#map-label-field").value;
  if (!data || !latitudeField || !longitudeField) {
    document.querySelector("#map-status").textContent = "Select a data source, latitude, and longitude fields first.";
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
  document.querySelector("#map-record-layer-name").textContent = `Case Cluster: ${data.formName}`;
  document.querySelector("#map-point-count").textContent = String(points.length);
  caseClusterAdded = points.length > 0;
  refreshMapEmptyState();
  updateLayerCount();
  document.querySelector("#map-status").textContent = points.length > 0
    ? `Mapped ${points.length} valid record${points.length === 1 ? "" : "s"}.`
    : "No valid coordinates were found in the selected fields.";
  lastBounds = points.length > 0 ? L.latLngBounds(points) : null;
  if (lastBounds?.isValid()) map.fitBounds(lastBounds.pad(0.18), { maxZoom: 15 });
}

function captureLocation() {
  if (!navigator.geolocation) {
    document.querySelector("#map-status").textContent = "Geolocation is not available in this browser.";
    return;
  }
  document.querySelector("#map-status").textContent = "Waiting for location permission...";
  navigator.geolocation.getCurrentPosition((position) => {
    ensureMap();
    const { latitude, longitude, accuracy } = position.coords;
    locationLayer.clearLayers();
    L.circle([latitude, longitude], { radius: accuracy, color: "#d97706", weight: 1, fillColor: "#f0a202", fillOpacity: 0.12 }).addTo(locationLayer);
    L.circleMarker([latitude, longitude], { radius: 7, color: "#92400e", weight: 2, fillColor: "#f0a202", fillOpacity: 0.95 })
      .bindPopup(`Current location<br>Accuracy: ${Math.round(accuracy)} m`).addTo(locationLayer).openPopup();
    locationAdded = true;
    updateLayerCount();
    refreshMapEmptyState();
    map.setView([latitude, longitude], 15);
    document.querySelector("#map-status").textContent = `Location captured with ${Math.round(accuracy)} m accuracy.`;
  }, (error) => {
    const messages = { 1: "Location permission was denied.", 2: "Location is unavailable.", 3: "Location request timed out." };
    document.querySelector("#map-status").textContent = messages[error.code] || error.message || "Unable to capture location.";
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
}

function configureLaunch(context, getCurrentData, openRecord) {
  mapContext = context;
  resetMapWorkspace();
  if (context === "current-form") {
    activeData = getCurrentData();
    setMapHeading(activeData);
    const selectedFields = populateFieldSelectors(activeData);
    if (selectedFields.latitude && selectedFields.longitude) {
      plotRecords(activeData, openRecord);
    } else {
      document.querySelector("#map-empty-state").textContent = "The current form is linked, but its coordinate fields need to be selected.";
      document.querySelector("#map-status").textContent = "Latitude and longitude fields were not identified. Use Add Data Layer > Case Cluster to select them.";
    }
  } else {
    setMapHeading();
    document.querySelector("#map-empty-state").textContent = "Select Add Data Layer > Case Cluster, then choose a project form.";
    document.querySelector("#map-status").textContent = "Standalone map ready.";
  }
}

function prepareCaseClusterDialog(getCurrentData, getDataSources) {
  const source = document.querySelector("#map-data-source");
  const title = document.querySelector("#case-cluster-dialog-title");
  const description = document.querySelector("#case-cluster-dialog-description");
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
    document.querySelector("#map-latitude-field").replaceChildren(option("", "Select a data source first"));
    document.querySelector("#map-longitude-field").replaceChildren(option("", "Select a data source first"));
    document.querySelector("#map-label-field").replaceChildren(option("", "Select a data source first"));
  }
  return sources;
}

export function initializeMaps(getCurrentData, getDataSources, openRecord) {
  const caseClusterDialog = document.querySelector("#case-cluster-dialog");
  const timeLapseDialog = document.querySelector("#time-lapse-dialog");
  const timeLapseField = document.querySelector("#time-lapse-field");
  const timeLapseStatus = document.querySelector("#time-lapse-dialog-status");
  const geoJsonDialog = document.querySelector("#geojson-dialog");
  const geoJsonForm = document.querySelector("#geojson-form");
  const geoJsonFile = document.querySelector("#geojson-file");
  const geoJsonName = document.querySelector("#geojson-layer-name");
  const geoJsonLabelField = document.querySelector("#geojson-label-field");
  const geoJsonStatus = document.querySelector("#geojson-dialog-status");
  const layerPanel = document.querySelector("#map-layer-panel");
  const layerPanelToggle = document.querySelector("#map-layer-panel-toggle");
  let dialogSources = [];
  let geoJsonInspectionVersion = 0;
  const updateLayerPanelToggle = () => {
    const action = layerPanel.open ? "Minimize" : "Maximize";
    layerPanelToggle.setAttribute("aria-label", `${action} map layers`);
    layerPanelToggle.setAttribute("aria-expanded", String(layerPanel.open));
    layerPanelToggle.title = `${action} map layers`;
  };
  layerPanel.addEventListener("toggle", updateLayerPanelToggle);
  updateLayerPanelToggle();
  for (const button of document.querySelectorAll('[data-module="maps"], [data-open-module="maps"]')) {
    button.addEventListener("click", () => {
      const context = button.dataset.mapContext || "standalone";
      setTimeout(() => {
        try {
          ensureMap();
          configureLaunch(context, getCurrentData, openRecord);
          map.invalidateSize();
        } catch (error) {
          document.querySelector("#map-status").textContent = error.message;
        }
      }, 0);
    });
  }
  document.querySelector("#map-add-case-cluster").addEventListener("click", () => {
    document.querySelector("#map-add-layer-menu").open = false;
    dialogSources = prepareCaseClusterDialog(getCurrentData, getDataSources);
    caseClusterDialog.showModal();
  });
  document.querySelector("#map-data-source").addEventListener("change", (event) => {
    activeData = dialogSources.find((data) => data.formId === event.target.value) || null;
    if (activeData) populateFieldSelectors(activeData);
  });
  for (const button of document.querySelectorAll("[data-close-case-cluster]")) {
    button.addEventListener("click", () => caseClusterDialog.close("cancel"));
  }
  document.querySelector("#case-cluster-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    plotRecords(activeData, openRecord);
    caseClusterDialog.close("plot");
  });
  document.querySelector("#map-create-timelapse").addEventListener("click", () => {
    if (!caseClusterAdded || !activeData || activeRecordPoints.length === 0) {
      document.querySelector("#map-status").textContent = "Add a case-cluster layer before creating a time lapse.";
      return;
    }
    const temporalFields = activeData.fields.filter((field) => (
      ["date", "time", "datetime", "date-time"].includes(field.type)
      || /(date|time)/i.test(`${field.name} ${field.prompt || ""}`)
    ));
    if (temporalFields.length === 0) {
      document.querySelector("#map-status").textContent = "The current case cluster has no date or time fields.";
      return;
    }
    timeLapseField.replaceChildren(
      option("", "Select a time field"),
      ...temporalFields.map((field) => option(field.name, `${field.prompt} (${field.name})`)),
    );
    timeLapseStatus.textContent = "Records with blank or invalid time values will be skipped. A maximum of 1,000 time stops is supported.";
    timeLapseDialog.showModal();
  });
  for (const button of document.querySelectorAll("[data-close-time-lapse]")) {
    button.addEventListener("click", () => timeLapseDialog.close("cancel"));
  }
  document.querySelector("#time-lapse-form").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
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
      const slider = document.querySelector("#map-time-lapse-slider");
      slider.max = String(stops.length - 1);
      slider.value = "0";
      document.querySelector("#map-time-lapse-controls").hidden = false;
      document.querySelector(".map-canvas-wrap").classList.add("time-lapse-active");
      renderTimeLapseStep(0);
      timeLapseDialog.close("create");
    } catch (error) {
      timeLapseStatus.textContent = error instanceof Error ? error.message : "Unable to create the time lapse.";
    }
  });
  document.querySelector("#map-time-lapse-play").addEventListener("click", () => {
    if (!timeLapseState) return;
    if (timeLapseState.timer) {
      pauseTimeLapse();
      return;
    }
    if (timeLapseState.index >= timeLapseState.stops.length - 1) renderTimeLapseStep(0);
    const button = document.querySelector("#map-time-lapse-play");
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
  document.querySelector("#map-time-lapse-slider").addEventListener("input", (event) => {
    pauseTimeLapse();
    renderTimeLapseStep(Number(event.target.value));
  });
  document.querySelector("#map-time-lapse-close").addEventListener("click", () => closeTimeLapse(true));
  document.querySelector("#map-add-geojson").addEventListener("click", () => {
    document.querySelector("#map-add-layer-menu").open = false;
    geoJsonForm.reset();
    geoJsonLabelField.replaceChildren(option("", "No polygon labels"));
    geoJsonLabelField.disabled = true;
    geoJsonStatus.textContent = "Files are read locally and are not uploaded to a server. Maximum size: 10 MB.";
    geoJsonDialog.showModal();
  });
  geoJsonFile.addEventListener("change", async () => {
    const inspectionVersion = ++geoJsonInspectionVersion;
    const file = geoJsonFile.files[0];
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
  for (const button of document.querySelectorAll("[data-close-geojson]")) {
    button.addEventListener("click", () => geoJsonDialog.close("cancel"));
  }
  geoJsonForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const file = geoJsonFile.files[0];
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
  document.querySelector("#map-geojson-layers").addEventListener("change", (event) => {
    const labelToggleId = event.target.dataset.geojsonLabelToggle;
    if (labelToggleId) {
      const entry = geoJsonLayers.get(labelToggleId);
      if (!entry) return;
      entry.labelsEnabled = event.target.checked;
      updateGeoJsonLabelVisibility();
      document.querySelector("#map-status").textContent = `${entry.name} labels ${entry.labelsEnabled ? "enabled" : "hidden"}.`;
      return;
    }
    const id = event.target.dataset.geojsonToggle;
    if (!id) return;
    const entry = geoJsonLayers.get(id);
    if (!entry) return;
    if (event.target.checked) entry.layer.addTo(ensureMap());
    else if (map.hasLayer(entry.layer)) map.removeLayer(entry.layer);
    updateGeoJsonLabelVisibility();
    document.querySelector("#map-status").textContent = `${entry.name} ${event.target.checked ? "shown" : "hidden"}.`;
  });
  document.querySelector("#map-geojson-layers").addEventListener("click", (event) => {
    const id = event.target.dataset.geojsonRemove;
    if (!id) return;
    const entry = geoJsonLayers.get(id);
    if (!entry) return;
    if (map.hasLayer(entry.layer)) map.removeLayer(entry.layer);
    geoJsonLayers.delete(id);
    renderGeoJsonLayerList();
    updateLayerCount();
    refreshMapEmptyState();
    document.querySelector("#map-status").textContent = `Removed GeoJSON layer “${entry.name}”.`;
  });
  document.querySelector("#map-current-location").addEventListener("click", captureLocation);
  document.querySelector("#map-fullscreen-toggle").addEventListener("click", async () => {
    try {
      await toggleMapFullscreen();
    } catch (error) {
      document.querySelector("#map-status").textContent = error instanceof Error ? error.message : "Unable to change fullscreen mode.";
    }
  });
  document.addEventListener("fullscreenchange", updateFullscreenControl);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && fallbackFullscreen) setFallbackFullscreen(false);
  });
  updateFullscreenControl();
  document.querySelector("#map-fit-points").addEventListener("click", () => {
    const bounds = combinedLayerBounds();
    if (bounds.isValid()) ensureMap().fitBounds(bounds.pad(0.18), { maxZoom: 15 });
    else document.querySelector("#map-status").textContent = "Add or show a case-cluster or GeoJSON layer before fitting the map.";
  });
  for (const radio of document.querySelectorAll('[name="map-basemap"]')) {
    radio.addEventListener("change", (event) => {
      const currentMap = ensureMap();
      if (event.target.value === "street") {
        if (!currentMap.hasLayer(tileLayer)) tileLayer.addTo(currentMap);
        document.querySelector("#map-status").textContent = "Street background selected.";
      } else if (currentMap.hasLayer(tileLayer)) {
        currentMap.removeLayer(tileLayer);
        document.querySelector("#map-status").textContent = "Blank background selected.";
      }
    });
  }
  document.querySelector("#map-record-layer-toggle").addEventListener("change", (event) => {
    const currentMap = ensureMap();
    if (event.target.checked) recordLayer.addTo(currentMap);
    else if (currentMap.hasLayer(recordLayer)) currentMap.removeLayer(recordLayer);
  });
  document.querySelector("#map-location-layer-toggle").addEventListener("change", (event) => {
    const currentMap = ensureMap();
    if (event.target.checked) locationLayer.addTo(currentMap);
    else if (currentMap.hasLayer(locationLayer)) currentMap.removeLayer(locationLayer);
  });
}
