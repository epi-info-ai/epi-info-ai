import { zipSync } from "fflate";
import { GdalWorkerClient, type GdalDatasetInfo, type GdalOpenedDataset } from "../gdal-wasm-worker.js";

interface FilePath { local: string; real: string }
interface MultiFilePath extends FilePath { all?: FilePath[] }
interface SourceFeature { type: "Feature"; properties: Record<string, unknown>; geometry: { type: "Point"; coordinates: [number, number] } }
interface SourceCollection { type: "FeatureCollection"; features: SourceFeature[] }

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing Shapefile-spike element: ${selector}`);
  return element;
};
const profile = required<HTMLSelectElement>("#shapefile-profile");
const runButton = required<HTMLButtonElement>("#run-shapefile-spike");
const cancelButton = required<HTMLButtonElement>("#cancel-shapefile-spike");
const zipButton = required<HTMLButtonElement>("#download-shapefile-zip");
const geoJsonButton = required<HTMLButtonElement>("#download-shapefile-geojson");
const status = required<HTMLElement>("#shapefile-status");
const elapsed = required<HTMLElement>("#shapefile-elapsed");
const validation = required<HTMLElement>("#shapefile-validation");
const manifestOutput = required<HTMLElement>("#shapefile-manifest");
const receiptOutput = required<HTMLElement>("#shapefile-receipt");
let activeClient: GdalWorkerClient | null = null;
let cancelled = false;
let timer = 0;
let zipUrl = "";
let geoJsonUrl = "";

const sha256 = async (bytes: ArrayBuffer): Promise<string> => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
  .map((value) => value.toString(16).padStart(2, "0")).join("");

function syntheticCollection(seed: SourceCollection, count: number): SourceCollection {
  if (!seed.features.length) throw new Error("The seed collection contains no points.");
  return {
    type: "FeatureCollection",
    features: Array.from({ length: count }, (_, index) => {
      const base = seed.features[index % seed.features.length]!;
      const column = index % 100;
      const row = Math.floor(index / 100);
      return {
        type: "Feature",
        properties: { sequence: index + 1, source_id: String(base.properties.site_id ?? "site"), cases: Number(base.properties.cases ?? 0) },
        geometry: { type: "Point", coordinates: [base.geometry.coordinates[0] + column * 2, base.geometry.coordinates[1] + row * 2] },
      };
    }),
  };
}

function clearOutputs(): void {
  if (zipUrl) URL.revokeObjectURL(zipUrl);
  if (geoJsonUrl) URL.revokeObjectURL(geoJsonUrl);
  zipUrl = "";
  geoJsonUrl = "";
  zipButton.disabled = true;
  geoJsonButton.disabled = true;
}

function finish(): void {
  if (timer) window.clearInterval(timer);
  timer = 0;
  activeClient?.terminate("Shapefile round-trip finished.");
  activeClient = null;
  runButton.disabled = false;
  profile.disabled = false;
  cancelButton.hidden = true;
}

function download(url: string, name: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
}

runButton.addEventListener("click", async () => {
  cancelled = false;
  clearOutputs();
  manifestOutput.textContent = "";
  receiptOutput.textContent = "";
  validation.textContent = "Validation pending.";
  validation.dataset.state = "pending";
  runButton.disabled = true;
  profile.disabled = true;
  cancelButton.hidden = false;
  const started = performance.now();
  timer = window.setInterval(() => { elapsed.textContent = `${((performance.now() - started) / 1000).toFixed(1)} s`; }, 100);
  try {
    const featureCount = Number(profile.value);
    status.textContent = `Generating ${featureCount.toLocaleString()} synthetic EPSG:3857 points…`;
    const seedResponse = await fetch("../reprojection/source-sites-epsg3857.geojson");
    if (!seedResponse.ok) throw new Error("The synthetic point seed could not be read.");
    const seed = await seedResponse.json() as SourceCollection;
    const collection = syntheticCollection(seed, featureCount);
    const sourceBytes = new TextEncoder().encode(JSON.stringify(collection));
    const sourceBuffer = sourceBytes.buffer.slice(sourceBytes.byteOffset, sourceBytes.byteOffset + sourceBytes.byteLength) as ArrayBuffer;

    activeClient = new GdalWorkerClient(new URL("../runtime/", window.location.href));
    status.textContent = "Initializing the first GDAL Worker…";
    await activeClient.initialize();
    const sourceOpened = await activeClient.call<GdalOpenedDataset>("open", new File([sourceBuffer], "synthetic-sites.geojson", { type: "application/geo+json" }));
    if (sourceOpened.datasets.length !== 1) throw new Error("GDAL could not open the generated GeoJSON.");
    const sourceDataset = sourceOpened.datasets[0]!;
    status.textContent = "Creating the Shapefile component set…";
    const exportArguments = ["-f", "ESRI Shapefile", "-s_srs", "EPSG:3857", "-t_srs", "EPSG:4326", "-lco", "ENCODING=UTF-8"];
    const shapefilePath = await activeClient.call<MultiFilePath>("ogr2ogr", sourceDataset, exportArguments, "synthetic-sites");
    const entries: Record<string, Uint8Array> = {};
    for (const file of shapefilePath.all ?? [shapefilePath]) {
      const name = file.local.split("/").pop() ?? file.local;
      entries[name] = await activeClient.call<Uint8Array>("getFileBytes", file);
    }
    await activeClient.call<void>("close", sourceDataset);
    const requiredExtensions = [".shp", ".shx", ".dbf", ".prj"];
    const entryNames = Object.keys(entries).sort();
    for (const extension of requiredExtensions) if (!entryNames.some((name) => name.toLowerCase().endsWith(extension))) throw new Error(`GDAL did not produce the required ${extension} component.`);
    status.textContent = "Compressing the multi-file dataset and restarting with a fresh Worker…";
    const zipBytes = zipSync(entries, { level: 6 });
    activeClient.terminate("First phase complete.");
    activeClient = new GdalWorkerClient(new URL("../runtime/", window.location.href));
    await activeClient.initialize();

    status.textContent = "Opening the ZIP through GDAL /vsizip/…";
    const archiveOpened = await activeClient.call<GdalOpenedDataset>("open", new File([zipBytes], "synthetic-sites.zip", { type: "application/zip" }), [], ["vsizip"]);
    if (archiveOpened.datasets.length !== 1) throw new Error(`Expected one Shapefile dataset in the ZIP; GDAL opened ${archiveOpened.datasets.length}.`);
    const archiveDataset = archiveOpened.datasets[0]!;
    const archiveInfo = await activeClient.call<GdalDatasetInfo>("getInfo", archiveDataset);
    if (archiveInfo.type !== "vector") throw new Error("The ZIP did not reopen as a vector dataset.");
    status.textContent = "Normalizing the reopened Shapefile to RFC 7946 GeoJSON…";
    const importArguments = ["-f", "GeoJSON", "-t_srs", "EPSG:4326", "-lco", "RFC7946=YES"];
    const normalizedPath = await activeClient.call<FilePath>("ogr2ogr", archiveDataset, importArguments, "synthetic-sites-normalized");
    const normalizedBytes = await activeClient.call<Uint8Array>("getFileBytes", normalizedPath);
    await activeClient.call<void>("close", archiveDataset);
    const normalized = JSON.parse(new TextDecoder().decode(normalizedBytes)) as SourceCollection;
    const failures: string[] = [];
    if (archiveInfo.featureCount !== featureCount) failures.push(`GDAL reported ${archiveInfo.featureCount} instead of ${featureCount} archived features`);
    if (normalized.features.length !== featureCount) failures.push(`normalized GeoJSON contains ${normalized.features.length} instead of ${featureCount} features`);
    if (normalized.features.some((feature) => feature.geometry.type !== "Point")) failures.push("one or more geometries changed type");

    const zipBuffer = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength) as ArrayBuffer;
    const normalizedBuffer = normalizedBytes.buffer.slice(normalizedBytes.byteOffset, normalizedBytes.byteOffset + normalizedBytes.byteLength) as ArrayBuffer;
    const duration = Math.round((performance.now() - started) * 10) / 10;
    const manifest = await Promise.all(entryNames.map(async (name) => ({ name, bytes: entries[name]!.byteLength, sha256: await sha256(entries[name]!.buffer as ArrayBuffer) })));
    manifestOutput.textContent = JSON.stringify(manifest, null, 2);
    const receipt = {
      schemaVersion: 1,
      operation: "zipped-shapefile-round-trip",
      engine: { package: "gdal3.js", packageVersion: "2.8.1", gdalVersion: "3.8.4", projVersion: "9.3.1" },
      execution: { environment: "two-sequential-dedicated-workers", networkInput: false, sourceMutation: false },
      source: { format: "GeoJSON", crs: "EPSG:3857", features: featureCount, bytes: sourceBytes.byteLength, sha256: await sha256(sourceBuffer) },
      archive: { name: "synthetic-sites.zip", format: "ESRI Shapefile", crs: "EPSG:4326", entries: entryNames, bytes: zipBytes.byteLength, sha256: await sha256(zipBuffer) },
      reopened: { driver: archiveInfo.driverName, layers: archiveInfo.layerCount, features: archiveInfo.featureCount },
      normalized: { name: "synthetic-sites-normalized.geojson", features: normalized.features.length, bytes: normalizedBytes.byteLength, sha256: await sha256(normalizedBuffer) },
      parameters: { export: exportArguments, virtualFileSystem: "/vsizip/", import: importArguments },
      elapsedMilliseconds: duration,
    };
    receiptOutput.textContent = JSON.stringify(receipt, null, 2);
    validation.textContent = failures.length ? `Validation failed: ${failures.join("; ")}.` : `PASS — ${featureCount.toLocaleString()} points survived the zipped Shapefile round-trip.`;
    validation.dataset.state = failures.length ? "failed" : "passed";
    status.textContent = `Round-trip completed in ${(duration / 1000).toFixed(2)} seconds across two fresh Workers.`;
    zipUrl = URL.createObjectURL(new Blob([zipBuffer], { type: "application/zip" }));
    geoJsonUrl = URL.createObjectURL(new Blob([normalizedBuffer], { type: "application/geo+json" }));
    zipButton.disabled = failures.length > 0;
    geoJsonButton.disabled = failures.length > 0;
    zipButton.onclick = () => download(zipUrl, receipt.archive.name);
    geoJsonButton.onclick = () => download(geoJsonUrl, receipt.normalized.name);
  } catch (error) {
    if (!cancelled) {
      status.textContent = error instanceof Error ? error.message : "The zipped Shapefile round-trip failed.";
      validation.textContent = "Spike failed safely; no output was accepted.";
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
  if (timer) window.clearInterval(timer);
  timer = 0;
  runButton.disabled = false;
  profile.disabled = false;
  cancelButton.hidden = true;
  status.textContent = "Cancelled. The active Worker was terminated and no partial archive was accepted.";
  validation.textContent = "Cancelled.";
  validation.dataset.state = "failed";
});
