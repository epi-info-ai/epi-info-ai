let map = null;
let tileLayer = null;
let recordLayer = null;
let locationLayer = null;
let lastBounds = null;
let caseClusterAdded = false;
let locationAdded = false;
let mapContext = "standalone";
let activeData = null;

function updateLayerCount() {
  const count = Number(caseClusterAdded) + Number(locationAdded);
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

function resetMapWorkspace() {
  ensureMap();
  recordLayer.clearLayers();
  locationLayer.clearLayers();
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
  document.querySelector("#map-empty-state").hidden = points.length > 0;
  caseClusterAdded = points.length > 0;
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
  let dialogSources = [];
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
  document.querySelector("#map-current-location").addEventListener("click", captureLocation);
  document.querySelector("#map-fit-points").addEventListener("click", () => {
    if (lastBounds?.isValid()) ensureMap().fitBounds(lastBounds.pad(0.18), { maxZoom: 15 });
    else document.querySelector("#map-status").textContent = "Add a case-cluster layer before fitting the map.";
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
