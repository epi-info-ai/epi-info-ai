import { GdalWorkerClient, type GdalDataset, type GdalDatasetInfo, type GdalOpenedDataset } from "../gdal-wasm-worker.js";

interface FilePath { local: string; real: string }
interface Feature { type: "Feature"; id: number; properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } | null }
interface Collection { type: "FeatureCollection"; name: string; features: Feature[] }
interface LayerResult { name: string; kind: "spatial" | "nonspatial"; expected: Collection; exported: Collection; bytes: Uint8Array; sha256: string; fields: Array<{ name: string; type: string }>; geometryType: string; crs: string }
interface CoordinateSystem { wkt?: string; projjson?: { name?: string; id?: { authority?: string; code?: string | number } } }

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing GeoPackage-spike element: ${selector}`);
  return element;
};
const runButton = required<HTMLButtonElement>("#run-geopackage");
const cancelButton = required<HTMLButtonElement>("#cancel-geopackage");
const downloadButton = required<HTMLButtonElement>("#download-geopackage");
const layerSelect = required<HTMLSelectElement>("#geopackage-layer");
const layerDownloadButton = required<HTMLButtonElement>("#download-geopackage-layer");
const status = required<HTMLElement>("#geopackage-status");
const elapsed = required<HTMLElement>("#geopackage-elapsed");
const validation = required<HTMLElement>("#geopackage-validation");
const inventoryBody = required<HTMLTableSectionElement>("#geopackage-inventory tbody");
const previewSummary = required<HTMLElement>("#geopackage-preview-summary");
const previewLayer = required<HTMLElement>("#geopackage-preview-layer");
const previewKind = required<HTMLElement>("#geopackage-preview-kind");
const previewCrs = required<HTMLElement>("#geopackage-preview-crs");
const previewCount = required<HTMLElement>("#geopackage-preview-count");
const mapPreview = required<SVGSVGElement>("#geopackage-map-preview");
const jsonPreview = required<HTMLElement>("#geopackage-json-preview");
const receiptOutput = required<HTMLElement>("#geopackage-receipt");
let activeClient: GdalWorkerClient | null = null;
let cancelled = false;
let timer = 0;
let packageUrl = "";
let layerUrls = new Map<string, string>();
let layerPreviews = new Map<string, LayerResult>();

const points: Collection = { type: "FeatureCollection", name: "case_sites", features: [
  { type: "Feature", id: 101, properties: { record_id: "CASE-001", age: 34, attack_rate: 12.5, onset_date: "2026-09-01", confirmed: true, note: "Niño - café" }, geometry: { type: "Point", coordinates: [-83.53741, 41.65281] } },
  { type: "Feature", id: 102, properties: { record_id: "CASE-002", age: 8, attack_rate: 7.25, onset_date: "2026-09-02", confirmed: false, note: null }, geometry: { type: "Point", coordinates: [-83.53127, 41.64892] } },
  { type: "Feature", id: 103, properties: { record_id: "CASE-003", age: 67, attack_rate: 4.75, onset_date: "2026-09-03", confirmed: true, note: "reviewed" }, geometry: { type: "Point", coordinates: [-83.54863, 41.65734] } },
] };
const boundaries: Collection = { type: "FeatureCollection", name: "study_areas", features: [
  { type: "Feature", id: 201, properties: { area_id: "AREA-A", label: "North study area", population: 12500 }, geometry: { type: "Polygon", coordinates: [[[-83.56, 41.65], [-83.53, 41.65], [-83.53, 41.67], [-83.56, 41.67], [-83.56, 41.65]]] } },
  { type: "Feature", id: 202, properties: { area_id: "AREA-B", label: "South study area", population: 9800 }, geometry: { type: "Polygon", coordinates: [[[-83.55, 41.63], [-83.52, 41.63], [-83.52, 41.65], [-83.55, 41.65], [-83.55, 41.63]]] } },
] };
const metadata: Collection = { type: "FeatureCollection", name: "project_metadata", features: [
  { type: "Feature", id: 301, properties: { metadata_key: "project_title", metadata_value: "Toledo synthetic surveillance", reviewed_on: "2026-09-17" }, geometry: null },
  { type: "Feature", id: 302, properties: { metadata_key: "data_steward", metadata_value: "Field Epidemiology Team", reviewed_on: null }, geometry: null },
] };
const sources = [
  { name: "case_sites", kind: "spatial" as const, collection: points, options: ["-a_srs", "EPSG:4326"] },
  { name: "study_areas", kind: "spatial" as const, collection: boundaries, options: ["-a_srs", "EPSG:4326"] },
  { name: "project_metadata", kind: "nonspatial" as const, collection: metadata, options: ["-nlt", "NONE"] },
];

const sha256 = async (bytes: ArrayBuffer): Promise<string> => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((value) => value.toString(16).padStart(2, "0")).join("");
const asBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

function canonicalFeatures(collection: Collection, source: boolean): unknown[] {
  return collection.features.map((feature) => ({
    properties: Object.fromEntries(Object.entries(source ? { _gpkg_fid: feature.id, ...feature.properties } : feature.properties).sort(([a], [b]) => a.localeCompare(b))),
    geometry: feature.geometry,
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function clearDownloads(): void {
  if (packageUrl) URL.revokeObjectURL(packageUrl);
  for (const url of layerUrls.values()) URL.revokeObjectURL(url);
  packageUrl = "";
  layerUrls = new Map();
  layerPreviews = new Map();
  downloadButton.disabled = true;
  layerDownloadButton.disabled = true;
  layerSelect.disabled = true;
  layerSelect.replaceChildren(new Option("Run the test to discover layers", ""));
  previewSummary.textContent = "Choose an explicitly discovered layer to preview its exported GeoJSON.";
  previewLayer.textContent = "Not selected";
  previewKind.textContent = "Not available";
  previewCrs.textContent = "Not available";
  previewCount.textContent = "Not available";
  jsonPreview.textContent = "No layer selected.";
  mapPreview.replaceChildren();
  const empty = document.createElementNS("http://www.w3.org/2000/svg", "text");
  empty.setAttribute("x", "320"); empty.setAttribute("y", "180"); empty.setAttribute("text-anchor", "middle"); empty.textContent = "No spatial layer selected";
  mapPreview.append(empty);
}

function coordinatePairs(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) return [];
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") return [[value[0], value[1]]];
  return value.flatMap(coordinatePairs);
}

function renderLayerPreview(name: string): void {
  const layer = layerPreviews.get(name);
  if (!layer) return;
  const collection = layer.exported;
  jsonPreview.textContent = JSON.stringify(collection, null, 2);
  mapPreview.replaceChildren();
  const spatial = collection.features.filter(({ geometry }) => geometry !== null);
  previewSummary.textContent = spatial.length
    ? `${name}: ${collection.features.length.toLocaleString()} GeoJSON features; ${spatial.length.toLocaleString()} spatial geometries; CRS ${layer.crs}.`
    : `${name}: ${collection.features.length.toLocaleString()} nonspatial GeoJSON features. No geometry is invented for tabular records.`;
  previewLayer.textContent = name;
  previewKind.textContent = layer.kind;
  previewCrs.textContent = layer.crs;
  previewCount.textContent = collection.features.length.toLocaleString();
  const pairs = spatial.flatMap(({ geometry }) => coordinatePairs(geometry?.coordinates));
  if (!pairs.length) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "320"); text.setAttribute("y", "180"); text.setAttribute("text-anchor", "middle"); text.textContent = "Nonspatial table - inspect the GeoJSON at right";
    mapPreview.append(text);
    return;
  }
  const xs = pairs.map(([x]) => x); const ys = pairs.map(([, y]) => y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 0.001); const spanY = Math.max(maxY - minY, 0.001);
  const project = ([x, y]: [number, number]): [number, number] => [30 + ((x - minX) / spanX) * 580, 330 - ((y - minY) / spanY) * 300];
  for (const feature of spatial) {
    if (feature.geometry?.type === "Point") {
      const [x, y] = project(feature.geometry.coordinates as [number, number]);
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(x)); circle.setAttribute("cy", String(y)); circle.setAttribute("r", "8");
      circle.setAttribute("tabindex", "0");
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title"); title.textContent = JSON.stringify(feature.properties); circle.append(title); mapPreview.append(circle);
    } else if (feature.geometry?.type === "Polygon") {
      const rings = feature.geometry.coordinates as Array<Array<[number, number]>>;
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", rings.map((ring) => `${ring.map((pair, index) => `${index ? "L" : "M"}${project(pair).join(" ")}`).join(" ")} Z`).join(" "));
      path.setAttribute("tabindex", "0");
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title"); title.textContent = JSON.stringify(feature.properties); path.append(title); mapPreview.append(path);
    }
  }
}

function coordinateSystemLabel(system: CoordinateSystem | undefined): string {
  if (!system) return "Not reported";
  const identifier = system.projjson?.id;
  if (identifier?.authority && identifier.code !== undefined) return `${identifier.authority}:${identifier.code}`;
  const matches = [...(system.wkt ?? "").matchAll(/ID\["([A-Z0-9_]+)",\s*(\d+)\]/g)];
  const match = matches.at(-1);
  if (match) return `${match[1]}:${match[2]}`;
  return system.projjson?.name ?? "Custom or unknown CRS";
}

function finish(): void {
  if (timer) window.clearInterval(timer);
  timer = 0;
  activeClient?.terminate("GeoPackage round-trip finished.");
  activeClient = null;
  runButton.disabled = false;
  cancelButton.hidden = true;
}

runButton.addEventListener("click", async () => {
  cancelled = false;
  clearDownloads();
  validation.dataset.state = "pending";
  validation.textContent = "Validation pending.";
  receiptOutput.textContent = "";
  inventoryBody.innerHTML = '<tr><td colspan="6">Building package...</td></tr>';
  runButton.disabled = true;
  cancelButton.hidden = false;
  const started = performance.now();
  timer = window.setInterval(() => { elapsed.textContent = `${((performance.now() - started) / 1000).toFixed(1)} s`; }, 100);
  try {
    activeClient = new GdalWorkerClient(new URL("../runtime/", window.location.href));
    status.textContent = "Initializing the GeoPackage writer Worker...";
    await activeClient.initialize();
    const sourceFiles = sources.map(({ name, collection }) => new File([JSON.stringify(collection)], `${name}.geojson`, { type: "application/geo+json" }));
    const opened = await activeClient.call<GdalOpenedDataset>("open", sourceFiles);
    if (opened.datasets.length !== sources.length) throw new Error(`GDAL opened ${opened.datasets.length} of ${sources.length} reviewed source layers.`);
    let packagePath: FilePath | null = null;
    const writeArguments: string[][] = [];
    for (let index = 0; index < sources.length; index += 1) {
      const source = sources[index]!;
      const dataset = opened.datasets.find((candidate) => candidate.path.startsWith(source.name)) ?? opened.datasets[index]!;
      const args = ["-f", "GPKG", ...(index ? ["-update", "-append"] : []), "-nln", source.name, "-preserve_fid", ...source.options];
      writeArguments.push(args);
      status.textContent = `${index ? "Appending" : "Writing"} ${source.name}...`;
      packagePath = await activeClient.call<FilePath>("ogr2ogr", dataset, args, "epi-info-field-study");
      await activeClient.call<void>("close", dataset);
    }
    if (!packagePath) throw new Error("GDAL did not produce a GeoPackage path.");
    const packageBytes = await activeClient.call<Uint8Array>("getFileBytes", packagePath);
    const packageBuffer = asBuffer(packageBytes);
    const packageDigest = await sha256(packageBuffer);
    activeClient.terminate("Writer phase complete; reopening in a fresh Worker.");

    activeClient = new GdalWorkerClient(new URL("../runtime/", window.location.href));
    status.textContent = "Reopening the GeoPackage in a fresh Worker...";
    await activeClient.initialize();
    const reopened = await activeClient.call<GdalOpenedDataset>("open", new File([packageBuffer], "epi-info-field-study.gpkg", { type: "application/geopackage+sqlite3" }));
    if (reopened.datasets.length !== 1) throw new Error(`Expected one GeoPackage dataset; GDAL opened ${reopened.datasets.length}.`);
    const dataset = reopened.datasets[0]!;
    const info = await activeClient.call<GdalDatasetInfo>("getInfo", dataset);
    const detailed = await activeClient.call<{ layers?: Array<{ name?: string; geometryFields?: Array<{ type?: string; coordinateSystem?: CoordinateSystem }>; fields?: Array<{ name?: string; type?: string }> }> }>("ogrinfo", dataset);
    const discovered = info.layers?.map(({ name }) => name).sort() ?? [];
    const expectedNames = sources.map(({ name }) => name).sort();
    const failures: string[] = [];
    if (info.driverName !== "GeoPackage") failures.push(`reopened driver is ${info.driverName}, not GeoPackage`);
    if (JSON.stringify(discovered) !== JSON.stringify(expectedNames)) failures.push(`layer inventory is ${discovered.join(", ")} instead of ${expectedNames.join(", ")}`);
    if (discovered.length > 1 && layerSelect.value) failures.push("an ambiguous default layer was selected automatically");

    const layerResults: LayerResult[] = [];
    for (const source of sources) {
      if (!discovered.includes(source.name)) continue;
      status.textContent = `Exporting the explicitly named ${source.name} layer...`;
      const sql = `SELECT fid AS _gpkg_fid, * FROM "${source.name}"`;
      const exportPath = await activeClient.call<FilePath>("ogr2ogr", dataset, ["-f", "GeoJSON", "-dialect", "SQLite", "-sql", sql, "-lco", "RFC7946=YES"], `${source.name}-roundtrip`);
      const bytes = await activeClient.call<Uint8Array>("getFileBytes", exportPath);
      const exported = JSON.parse(new TextDecoder().decode(bytes)) as Collection;
      const layerDetails = detailed.layers?.find(({ name }) => name === source.name);
      const fields = (layerDetails?.fields ?? []).map(({ name, type }) => ({ name: String(name ?? ""), type: String(type ?? "unknown") }));
      const geometryType = layerDetails?.geometryFields?.[0]?.type ?? "None";
      const crs = source.kind === "nonspatial" ? "Not applicable" : coordinateSystemLabel(layerDetails?.geometryFields?.[0]?.coordinateSystem);
      if (exported.features.length !== source.collection.features.length) failures.push(`${source.name} feature count changed`);
      if (JSON.stringify(canonicalFeatures(exported, false)) !== JSON.stringify(canonicalFeatures(source.collection, true))) failures.push(`${source.name} feature IDs, values, or geometries changed`);
      layerResults.push({ name: source.name, kind: source.kind, expected: source.collection, exported, bytes, sha256: await sha256(asBuffer(bytes)), fields, geometryType, crs });
    }
    await activeClient.call<void>("close", dataset);
    if (layerResults.length !== sources.length) failures.push("not every reviewed layer was explicitly exported");

    const duration = Math.round((performance.now() - started) * 10) / 10;
    inventoryBody.replaceChildren(...layerResults.map((layer) => {
      const row = document.createElement("tr");
      for (const value of [layer.name, layer.kind, layer.exported.features.length.toLocaleString(), layer.geometryType, layer.crs, layer.fields.map(({ name, type }) => `${name}: ${type}`).join(", ")]) {
        const cell = document.createElement("td"); cell.textContent = String(value); row.append(cell);
      }
      return row;
    }));
    layerSelect.replaceChildren(new Option("Choose a discovered layer", ""), ...layerResults.map(({ name }) => new Option(name, name)));
    layerSelect.disabled = failures.length > 0;
    for (const layer of layerResults) {
      layerUrls.set(layer.name, URL.createObjectURL(new Blob([asBuffer(layer.bytes)], { type: "application/geo+json" })));
      layerPreviews.set(layer.name, layer);
    }
    layerSelect.onchange = () => {
      layerDownloadButton.disabled = !layerSelect.value || !layerUrls.has(layerSelect.value);
      if (layerSelect.value) renderLayerPreview(layerSelect.value);
    };
    layerDownloadButton.onclick = () => {
      const url = layerUrls.get(layerSelect.value); if (!url) return;
      const link = document.createElement("a"); link.href = url; link.download = `${layerSelect.value}.geojson`; link.click();
    };
    packageUrl = URL.createObjectURL(new Blob([packageBuffer], { type: "application/geopackage+sqlite3" }));
    downloadButton.onclick = () => { const link = document.createElement("a"); link.href = packageUrl; link.download = "epi-info-field-study.gpkg"; link.click(); };
    downloadButton.disabled = failures.length > 0;
    const receipt = {
      schemaVersion: 1,
      operation: "multi-layer-geopackage-round-trip",
      engine: { package: "gdal3.js", packageVersion: "2.8.1", gdalVersion: "3.8.4" },
      execution: { environment: "two-sequential-dedicated-workers", writerDestroyedBeforeReopen: true, networkInput: false, sourceMutation: false },
      package: { name: "epi-info-field-study.gpkg", bytes: packageBytes.byteLength, sha256: packageDigest, driver: info.driverName },
      selectionPolicy: { automaticLayerSelection: "rejected-when-layer-count-exceeds-one", required: "explicit-discovered-layer-name" },
      inventory: layerResults.map((layer) => ({ name: layer.name, kind: layer.kind, features: layer.exported.features.length, geometryType: layer.geometryType, crs: layer.crs, fields: layer.fields, sourceFeatureIds: layer.expected.features.map(({ id }) => id), exportedFeatureIds: layer.exported.features.map(({ properties }) => properties._gpkg_fid), geoJsonSha256: layer.sha256 })),
      parameters: { writes: writeArguments, exports: layerResults.map(({ name }) => ({ layer: name, sql: `SELECT fid AS _gpkg_fid, * FROM "${name}"`, format: "RFC 7946 GeoJSON" })) },
      validation: { expectedLayerNames: expectedNames, discoveredLayerNames: discovered, failures },
      elapsedMilliseconds: duration,
    };
    receiptOutput.textContent = JSON.stringify(receipt, null, 2);
    validation.textContent = failures.length ? `Validation failed: ${failures.join("; ")}.` : "PASS - three explicitly named layers, their fields, Unicode/null/date values, feature IDs, and geometries survived the fresh-Worker GeoPackage round-trip.";
    validation.dataset.state = failures.length ? "failed" : "passed";
    status.textContent = `GeoPackage round-trip completed in ${(duration / 1000).toFixed(2)} seconds.`;
  } catch (error) {
    if (!cancelled) {
      status.textContent = error instanceof Error ? error.message : "The GeoPackage round-trip failed.";
      validation.textContent = "Spike failed safely; no package was accepted.";
      validation.dataset.state = "failed";
    }
  } finally {
    finish();
  }
});

cancelButton.addEventListener("click", () => {
  cancelled = true;
  activeClient?.terminate();
  activeClient = null;
  finish();
  status.textContent = "Cancelled. The active Worker was terminated and no partial package was accepted.";
  validation.textContent = "Cancelled.";
  validation.dataset.state = "failed";
});
