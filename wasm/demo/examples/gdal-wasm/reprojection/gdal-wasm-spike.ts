import { GdalWorkerClient, type GdalDatasetInfo, type GdalOpenedDataset } from "../gdal-wasm-worker.js";

interface ExpectedResult {
  featureCount: number;
  expectedBounds: [number, number, number, number];
  coordinateToleranceDegrees: number;
  inputSha256: string;
}

interface GeoJsonGeometry { type: string; coordinates: unknown }
interface GeoJsonFeature { type: "Feature"; geometry: GeoJsonGeometry | null }
interface GeoJsonFeatureCollection { type: "FeatureCollection"; features: GeoJsonFeature[] }

interface ProcessingReceipt {
  schemaVersion: number;
  operation: string;
  engine: Record<string, string>;
  execution: Record<string, boolean | string>;
  source: { name: string; crs: string; bytes: number; sha256: string; driver: string };
  output: { name: string; crs: string; bytes: number; sha256: string; driver: string; featureCount: number; bounds: [number, number, number, number] };
  parameters: { application: string; arguments: readonly string[] };
  warnings: string[];
  elapsedMilliseconds: number;
}

const options = ["-f", "GeoJSON", "-s_srs", "EPSG:3857", "-t_srs", "EPSG:4326", "-lco", "RFC7946=YES"] as const;
const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing GDAL/WASM example element: ${selector}`);
  return element;
};

const runButton = required<HTMLButtonElement>("#run-spike");
const cancelButton = required<HTMLButtonElement>("#cancel-spike");
const downloadButton = required<HTMLButtonElement>("#download-result");
const status = required<HTMLElement>("#spike-status");
const validation = required<HTMLElement>("#validation-status");
const receiptOutput = required<HTMLElement>("#processing-receipt");
const geoJsonOutput = required<HTMLElement>("#output-geojson");
const logOutput = required<HTMLElement>("#worker-log");
let activeClient: GdalWorkerClient | null = null;
let cancelled = false;
let resultUrl = "";

const hex = (bytes: ArrayBuffer): string => [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
const sha256 = async (bytes: ArrayBuffer): Promise<string> => hex(await crypto.subtle.digest("SHA-256", bytes));

function collectPositions(value: unknown, positions: Array<[number, number]>): void {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    positions.push([value[0], value[1]]);
    return;
  }
  for (const child of value) collectPositions(child, positions);
}

function bounds(collection: GeoJsonFeatureCollection): [number, number, number, number] {
  const positions: Array<[number, number]> = [];
  for (const feature of collection.features) if (feature.geometry) collectPositions(feature.geometry.coordinates, positions);
  if (!positions.length) throw new RangeError("GDAL output contains no positions.");
  return positions.reduce<[number, number, number, number]>(
    (extent, [x, y]) => [Math.min(extent[0], x), Math.min(extent[1], y), Math.max(extent[2], x), Math.max(extent[3], y)],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
}

function resetDownload(): void {
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = "";
  downloadButton.disabled = true;
}

function finish(): void {
  activeClient?.terminate("GDAL/WASM processing finished.");
  activeClient = null;
  runButton.disabled = false;
  cancelButton.hidden = true;
}

function validateReceipt(receipt: ProcessingReceipt, expected: ExpectedResult): string[] {
  const failures: string[] = [];
  if (receipt.source.sha256 !== expected.inputSha256) failures.push("input SHA-256 differs from the checked-in fixture");
  if (receipt.output.featureCount !== expected.featureCount) failures.push(`expected ${expected.featureCount} features; received ${receipt.output.featureCount}`);
  expected.expectedBounds.forEach((value, index) => {
    if (Math.abs(receipt.output.bounds[index]! - value) > expected.coordinateToleranceDegrees) failures.push(`bound ${index + 1} differs by more than ${expected.coordinateToleranceDegrees}°`);
  });
  if (receipt.output.crs !== "EPSG:4326") failures.push("output CRS is not EPSG:4326");
  return failures;
}

runButton.addEventListener("click", async () => {
  cancelled = false;
  resetDownload();
  receiptOutput.textContent = "";
  geoJsonOutput.textContent = "";
  logOutput.textContent = "";
  validation.textContent = "Validation pending.";
  validation.dataset.state = "pending";
  runButton.disabled = true;
  cancelButton.hidden = false;
  status.textContent = "Reading the checksummed local fixture…";
  const started = performance.now();
  try {
    const [inputResponse, expectedResponse] = await Promise.all([fetch("./source-sites-epsg3857.geojson"), fetch("./expected-result.json")]);
    if (!inputResponse.ok || !expectedResponse.ok) throw new Error("The checked-in GDAL/WASM example assets could not be read.");
    const inputBytes = await inputResponse.arrayBuffer();
    const expected = await expectedResponse.json() as ExpectedResult;
    const inputSha256 = await sha256(inputBytes);
    activeClient = new GdalWorkerClient(new URL("../runtime/", window.location.href));
    status.textContent = "Initializing vendored GDAL, PROJ, and GEOS WebAssembly assets…";
    await activeClient.initialize();
    status.textContent = "Opening the EPSG:3857 vector fixture…";
    const opened = await activeClient.call<GdalOpenedDataset>("open", new File([inputBytes], "source-sites-epsg3857.geojson", { type: "application/geo+json" }));
    if (opened.datasets.length !== 1) throw new RangeError(`Expected one GDAL dataset; received ${opened.datasets.length}. ${opened.errors.join(" ")}`);
    const dataset = opened.datasets[0]!;
    const inputInfo = await activeClient.call<GdalDatasetInfo>("getInfo", dataset);
    if (inputInfo.type !== "vector") throw new RangeError(`Expected a vector dataset; GDAL identified ${inputInfo.type}.`);
    status.textContent = "Running ogr2ogr reprojection to RFC 7946 WGS 84 GeoJSON…";
    const outputPath = await activeClient.call<{ local: string; real: string }>("ogr2ogr", dataset, [...options], "synthetic-outbreak-sites-wgs84");
    const outputBytes = await activeClient.call<Uint8Array>("getFileBytes", outputPath);
    await activeClient.call<void>("close", dataset);
    const outputBuffer = outputBytes.buffer.slice(outputBytes.byteOffset, outputBytes.byteOffset + outputBytes.byteLength) as ArrayBuffer;
    const collection = JSON.parse(new TextDecoder().decode(outputBytes)) as GeoJsonFeatureCollection;
    if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) throw new RangeError("GDAL output is not a GeoJSON FeatureCollection.");
    const receipt: ProcessingReceipt = {
      schemaVersion: 1,
      operation: "vector-reproject",
      engine: { package: "gdal3.js", packageVersion: "2.8.1", gdalVersion: "3.8.4", projVersion: "9.3.1", geosVersion: "3.12.1" },
      execution: { environment: "dedicated-browser-worker", networkInput: false, sourceMutation: false },
      source: { name: "source-sites-epsg3857.geojson", crs: "EPSG:3857", bytes: inputBytes.byteLength, sha256: inputSha256, driver: inputInfo.driverName },
      output: { name: "synthetic-outbreak-sites-wgs84.geojson", crs: "EPSG:4326", bytes: outputBytes.byteLength, sha256: await sha256(outputBuffer), driver: "GeoJSON", featureCount: collection.features.length, bounds: bounds(collection) },
      parameters: { application: "ogr2ogr", arguments: options },
      warnings: opened.errors,
      elapsedMilliseconds: Math.round((performance.now() - started) * 10) / 10,
    };
    const failures = validateReceipt(receipt, expected);
    receiptOutput.textContent = JSON.stringify(receipt, null, 2);
    geoJsonOutput.textContent = new TextDecoder().decode(outputBuffer);
    validation.textContent = failures.length ? `Validation failed: ${failures.join("; ")}.` : `PASS — ${receipt.output.featureCount} features reprojected within ${expected.coordinateToleranceDegrees}° tolerance; hashes and CRS verified.`;
    validation.dataset.state = failures.length ? "failed" : "passed";
    status.textContent = `GDAL/WASM completed in ${receipt.elapsedMilliseconds.toLocaleString("en-US")} ms inside the dedicated Worker.`;
    resultUrl = URL.createObjectURL(new Blob([outputBuffer], { type: "application/geo+json" }));
    downloadButton.disabled = failures.length > 0;
    downloadButton.onclick = () => {
      const link = document.createElement("a");
      link.href = resultUrl;
      link.download = receipt.output.name;
      link.click();
    };
  } catch (error) {
    if (!cancelled) {
      status.textContent = error instanceof Error ? error.message : "Unable to run the GDAL/WASM spike.";
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
  runButton.disabled = false;
  cancelButton.hidden = true;
  status.textContent = "Cancelled. The Worker was terminated and no output was accepted.";
  validation.textContent = "Cancelled.";
  validation.dataset.state = "failed";
});
