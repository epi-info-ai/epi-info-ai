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
  setTimeout(() => map?.invalidateSize(), 0);
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
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "map-layer-remove";
    remove.dataset.geojsonRemove = id;
    remove.setAttribute("aria-label", `Remove ${entry.name}`);
    remove.title = `Remove ${entry.name}`;
    remove.textContent = "x";
    row.append(label, remove);
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

function addGeoJsonLayer(geojson, featureCount, name, labelField = "") {
  const currentMap = ensureMap();
  const layer = L.geoJSON(geojson, {
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
          const label = document.createElement("span");
          label.textContent = String(labelValue);
          featureLayer.bindTooltip(label, {
            permanent: true,
            direction: "center",
            className: "geojson-polygon-label",
          });
        }
      }
    },
  });
  layer.addTo(currentMap);
  const bounds = layer.getBounds();
  const id = globalThis.crypto?.randomUUID?.() || `geojson-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  geoJsonLayers.set(id, { layer, name, featureCount, bounds, labelField });
  renderGeoJsonLayerList();
  updateLayerCount();
  refreshMapEmptyState();
  document.querySelector("#map-layer-panel").open = true;
  const labelMessage = labelField ? ` Polygon labels use “${labelField}”.` : "";
  document.querySelector("#map-status").textContent = `Added GeoJSON layer “${name}” with ${featureCount.toLocaleString()} feature${featureCount === 1 ? "" : "s"}.${labelMessage}`;
  if (bounds.isValid()) currentMap.fitBounds(bounds.pad(0.12), { maxZoom: 16 });
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

function plotRecords(data, openRecord) {
  const latitudeField = document.querySelector("#map-latitude-field").value;
  const longitudeField = document.querySelector("#map-longitude-field").value;
  const labelField = document.querySelector("#map-label-field").value;
  if (!data || !latitudeField || !longitudeField) {
    document.querySelector("#map-status").textContent = "Select a data source, latitude, and longitude fields first.";
    return;
  }

  ensureMap();
  recordLayer.clearLayers();
  const mappedRecords = extractMapPoints(data.records, latitudeField, longitudeField);
  const points = [];
  for (const { record, recordIndex, latitude, longitude } of mappedRecords) {
    const marker = L.circleMarker([latitude, longitude], {
      radius: 6,
      color: "#9f221b",
      weight: 2,
      fillColor: "#df291e",
      fillOpacity: 0.84,
    }).bindPopup(markerPopup(record, labelField, latitude, longitude));
    if (mapContext === "current-form") marker.on("dblclick", () => openRecord(data.formId, recordIndex));
    marker.addTo(recordLayer);
    points.push([latitude, longitude]);
  }

  activeData = data;
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
      document.querySelector("#map-layer-panel").open = caseClusterAdded;
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
  const geoJsonDialog = document.querySelector("#geojson-dialog");
  const geoJsonForm = document.querySelector("#geojson-form");
  const geoJsonFile = document.querySelector("#geojson-file");
  const geoJsonName = document.querySelector("#geojson-layer-name");
  const geoJsonLabelField = document.querySelector("#geojson-label-field");
  const geoJsonStatus = document.querySelector("#geojson-dialog-status");
  let dialogSources = [];
  let geoJsonInspectionVersion = 0;
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
    document.querySelector("#map-layer-panel").open = true;
  });
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
    const id = event.target.dataset.geojsonToggle;
    if (!id) return;
    const entry = geoJsonLayers.get(id);
    if (!entry) return;
    if (event.target.checked) entry.layer.addTo(ensureMap());
    else if (map.hasLayer(entry.layer)) map.removeLayer(entry.layer);
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
