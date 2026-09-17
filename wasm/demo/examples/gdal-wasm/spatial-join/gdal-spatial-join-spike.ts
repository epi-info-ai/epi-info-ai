import { GdalWorkerClient, type GdalDatasetInfo, type GdalOpenedDataset } from "../gdal-wasm-worker.js";

interface Geometry { type: string; coordinates: unknown }
interface Feature { type: "Feature"; properties: Record<string, unknown>; geometry: Geometry }
interface FeatureCollection { type: "FeatureCollection"; features: Feature[] }
interface PartitionResult { partition: number; points: number; inputBytes: number; outputBytes: number; elapsedMilliseconds: number; features: Feature[] }
interface CalibrationDecision {
  mode: "auto" | "fixed";
  probePoints: number;
  probeMilliseconds: number;
  projectedSingleWorkerMilliseconds: number;
  targetMilliseconds: number;
  hardwareConcurrency: number;
  deviceMemoryGiB: number | "unavailable";
  performanceWorkers: number;
  hardwareCap: number;
  memoryCap: number;
  selectedWorkers: number;
  fallback?: { attemptedWorkers: number; actualWorkers: number; reason: string };
}

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing spatial-join element: ${selector}`);
  return element;
};
const profile = required<HTMLSelectElement>("#spatial-join-profile");
const workerCount = required<HTMLSelectElement>("#spatial-join-workers");
const runButton = required<HTMLButtonElement>("#run-spatial-join");
const cancelButton = required<HTMLButtonElement>("#cancel-spatial-join");
const downloadButton = required<HTMLButtonElement>("#download-spatial-join");
const status = required<HTMLElement>("#spatial-join-status");
const elapsed = required<HTMLElement>("#spatial-join-elapsed");
const validation = required<HTMLElement>("#spatial-join-validation");
const summaryOutput = required<HTMLElement>("#spatial-join-summary");
const receiptOutput = required<HTMLElement>("#spatial-join-receipt");
const activeClients = new Set<GdalWorkerClient>();
let cancelled = false;
let timer = 0;
let resultUrl = "";
const sql = "SELECT p.point_id, z.zone_id, p.geometry FROM spatial_join p JOIN spatial_join z ON ST_Intersects(p.geometry, z.geometry) WHERE p.kind = 'point' AND z.kind = 'zone'";
const argumentsList = ["-f", "GeoJSON", "-dialect", "SQLite", "-sql", sql, "-lco", "RFC7946=YES"];

const sha256 = async (bytes: ArrayBuffer): Promise<string> => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
  .map((value) => value.toString(16).padStart(2, "0")).join("");

function powerOfTwoCap(value: number): number {
  if (value >= 4) return 4;
  if (value >= 2) return 2;
  return 1;
}

async function calibrate(pointCount: number, strategy: string): Promise<CalibrationDecision> {
  const hardwareConcurrency = navigator.hardwareConcurrency || 2;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  const hardwareCap = powerOfTwoCap(Math.max(1, Math.floor((hardwareConcurrency - 1) / 2)));
  const memoryCap = deviceMemory === undefined ? 2 : deviceMemory <= 4 ? 1 : deviceMemory <= 8 ? 2 : 4;
  if (strategy !== "auto") {
    const selectedWorkers = Number(strategy);
    return { mode: "fixed", probePoints: 0, probeMilliseconds: 0, projectedSingleWorkerMilliseconds: 0, targetMilliseconds: 10_000, hardwareConcurrency, deviceMemoryGiB: deviceMemory ?? "unavailable", performanceWorkers: selectedWorkers, hardwareCap, memoryCap, selectedWorkers };
  }
  if (pointCount <= 100) {
    return { mode: "auto", probePoints: 0, probeMilliseconds: 0, projectedSingleWorkerMilliseconds: 0, targetMilliseconds: 10_000, hardwareConcurrency, deviceMemoryGiB: deviceMemory ?? "unavailable", performanceWorkers: 1, hardwareCap, memoryCap, selectedWorkers: 1 };
  }
  const probePoints = 100;
  status.textContent = `Calibrating one GDAL Worker with ${probePoints} points…`;
  let probe: PartitionResult;
  try {
    probe = await runPartition(-1, probePoints, 0);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Calibration Worker failed.";
    return {
      mode: "auto", probePoints, probeMilliseconds: 0, projectedSingleWorkerMilliseconds: 0,
      targetMilliseconds: 10_000, hardwareConcurrency, deviceMemoryGiB: deviceMemory ?? "unavailable",
      performanceWorkers: 1, hardwareCap, memoryCap, selectedWorkers: 1,
      fallback: { attemptedWorkers: 1, actualWorkers: 1, reason: `Calibration probe failed: ${reason}. Retrying the main workload with one fresh Worker.` },
    };
  }
  const projectedSingleWorkerMilliseconds = Math.round(probe.elapsedMilliseconds * pointCount / probePoints);
  const performanceWorkers = powerOfTwoCap(Math.ceil(projectedSingleWorkerMilliseconds / 10_000));
  const selectedWorkers = Math.max(1, Math.min(performanceWorkers, hardwareCap, memoryCap));
  return { mode: "auto", probePoints, probeMilliseconds: probe.elapsedMilliseconds, projectedSingleWorkerMilliseconds, targetMilliseconds: 10_000, hardwareConcurrency, deviceMemoryGiB: deviceMemory ?? "unavailable", performanceWorkers, hardwareCap, memoryCap, selectedWorkers };
}

function buildFixture(pointCount: number, pointOffset: number): FeatureCollection {
  const west = -83.70;
  const south = 41.58;
  const width = 0.031;
  const height = 0.017;
  const features: Feature[] = [];
  for (let zone = 0; zone < 100; zone += 1) {
    const column = zone % 10;
    const row = Math.floor(zone / 10);
    const x0 = west + column * width;
    const y0 = south + row * height;
    const x1 = x0 + width;
    const y1 = y0 + height;
    features.push({ type: "Feature", properties: { kind: "zone", zone_id: `Z${String(zone + 1).padStart(3, "0")}` }, geometry: { type: "Polygon", coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] } });
  }
  for (let localIndex = 0; localIndex < pointCount; localIndex += 1) {
    const index = pointOffset + localIndex;
    const zone = index % 100;
    const column = zone % 10;
    const row = Math.floor(zone / 10);
    const fractionX = 0.15 + ((index * 37) % 700) / 1000;
    const fractionY = 0.15 + ((index * 53) % 700) / 1000;
    features.push({ type: "Feature", properties: { kind: "point", point_id: index + 1 }, geometry: { type: "Point", coordinates: [west + (column + fractionX) * width, south + (row + fractionY) * height] } });
  }
  return { type: "FeatureCollection", features };
}

async function runPartition(partition: number, points: number, offset: number): Promise<PartitionResult> {
  const started = performance.now();
  const fixture = buildFixture(points, offset);
  const inputBytes = new TextEncoder().encode(JSON.stringify(fixture));
  const inputBuffer = inputBytes.buffer.slice(inputBytes.byteOffset, inputBytes.byteOffset + inputBytes.byteLength) as ArrayBuffer;
  const client = new GdalWorkerClient(new URL("../runtime/", window.location.href));
  activeClients.add(client);
  try {
    await client.initialize();
    const opened = await client.call<GdalOpenedDataset>("open", new File([inputBuffer], "spatial_join.geojson", { type: "application/geo+json" }));
    if (opened.datasets.length !== 1) throw new Error(`Worker ${partition + 1} could not open its fixture.`);
    const dataset = opened.datasets[0]!;
    const sourceInfo = await client.call<GdalDatasetInfo>("getInfo", dataset);
    if (sourceInfo.featureCount !== points + 100) throw new Error(`Worker ${partition + 1} source count differs from its partition.`);
    const outputPath = await client.call<{ local: string; real: string }>("ogr2ogr", dataset, argumentsList, `spatial-join-result-${partition + 1}`);
    const outputBytes = await client.call<Uint8Array>("getFileBytes", outputPath);
    await client.call<void>("close", dataset);
    const output = JSON.parse(new TextDecoder().decode(outputBytes)) as FeatureCollection;
    return { partition: partition + 1, points, inputBytes: inputBytes.byteLength, outputBytes: outputBytes.byteLength, elapsedMilliseconds: Math.round((performance.now() - started) * 10) / 10, features: output.features };
  } finally {
    client.terminate("Spatial-join partition complete.");
    activeClients.delete(client);
  }
}

function finish(): void {
  if (timer) window.clearInterval(timer);
  timer = 0;
  for (const client of activeClients) client.terminate("Spatial join finished.");
  activeClients.clear();
  runButton.disabled = false;
  profile.disabled = false;
  workerCount.disabled = false;
  cancelButton.hidden = true;
}

runButton.addEventListener("click", async () => {
  cancelled = false;
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = "";
  downloadButton.disabled = true;
  summaryOutput.textContent = "";
  receiptOutput.textContent = "";
  validation.textContent = "Validation pending.";
  validation.dataset.state = "pending";
  runButton.disabled = true;
  profile.disabled = true;
  workerCount.disabled = true;
  cancelButton.hidden = false;
  const started = performance.now();
  timer = window.setInterval(() => { elapsed.textContent = `${((performance.now() - started) / 1000).toFixed(1)} s`; }, 100);
  try {
    const pointCount = Number(profile.value);
    const calibration = await calibrate(pointCount, workerCount.value);
    const requestedWorkers = calibration.selectedWorkers;
    const partitions: Array<{ points: number; offset: number }> = [];
    let offset = 0;
    for (let index = 0; index < requestedWorkers; index += 1) {
      const points = Math.floor(pointCount / requestedWorkers) + (index < pointCount % requestedWorkers ? 1 : 0);
      partitions.push({ points, offset });
      offset += points;
    }
    status.textContent = `Running ${pointCount.toLocaleString()} points across ${requestedWorkers} independent GDAL Workers selected by ${calibration.mode} policy…`;
    let actualWorkers = requestedWorkers;
    let partitionResults: PartitionResult[];
    try {
      partitionResults = await Promise.all(partitions.map((partition, index) => runPartition(index, partition.points, partition.offset)));
    } catch (error) {
      if (calibration.mode !== "auto" || requestedWorkers === 1) throw error;
      for (const client of activeClients) client.terminate("Concurrent pool failed; retrying with one Worker.");
      activeClients.clear();
      const reason = error instanceof Error ? error.message : "Concurrent Worker pool failed.";
      calibration.fallback = { attemptedWorkers: requestedWorkers, actualWorkers: 1, reason };
      calibration.selectedWorkers = 1;
      actualWorkers = 1;
      status.textContent = `The ${requestedWorkers}-Worker pool failed (${reason}). Retrying the complete join with one fresh Worker…`;
      partitionResults = [await runPartition(0, pointCount, 0)];
    }
    const output: FeatureCollection = { type: "FeatureCollection", features: partitionResults.flatMap(({ features }) => features) };
    const outputBytes = new TextEncoder().encode(JSON.stringify(output));
    const outputBuffer = outputBytes.buffer.slice(outputBytes.byteOffset, outputBytes.byteOffset + outputBytes.byteLength) as ArrayBuffer;
    const counts = new Map<string, number>();
    const pointIds = new Set<number>();
    const failures: string[] = [];
    for (const feature of output.features) {
      const pointId = Number(feature.properties.point_id);
      const zoneId = String(feature.properties.zone_id ?? "");
      if (!Number.isInteger(pointId) || !zoneId.match(/^Z\d{3}$/)) failures.push("output contains a malformed assignment");
      pointIds.add(pointId);
      counts.set(zoneId, (counts.get(zoneId) ?? 0) + 1);
    }
    if (output.features.length !== pointCount) failures.push(`expected ${pointCount} join rows; received ${output.features.length}`);
    if (pointIds.size !== pointCount) failures.push(`expected ${pointCount} unique point IDs; received ${pointIds.size}`);
    if (counts.size !== 100) failures.push(`expected 100 represented zones; received ${counts.size}`);
    const expectedPerZone = pointCount / 100;
    if ([...counts.values()].some((count) => count !== expectedPerZone)) failures.push("per-zone counts are not the deterministic expected distribution");
    const countSummary = [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([zoneId, count]) => ({ zoneId, count }));
    summaryOutput.textContent = JSON.stringify(countSummary, null, 2);
    const duration = Math.round((performance.now() - started) * 10) / 10;
    const receipt = {
      schemaVersion: 1,
      operation: "partitioned-point-in-polygon-spatial-join",
      engine: { package: "gdal3.js", packageVersion: "2.8.1", gdalVersion: "3.8.4", geosVersion: "3.12.1", sqlDialect: "SQLite", wasmThreads: false },
      execution: { environment: "browser-worker-pool", strategy: calibration.mode, workers: actualWorkers, attemptedWorkers: requestedWorkers, automaticFallback: Boolean(calibration.fallback), separateWasmMemoryPerWorker: true, networkInput: false, sourceMutation: false },
      calibration,
      input: { crs: "EPSG:4326", points: pointCount, polygonsPerWorker: 100, candidatePredicates: pointCount * 100 },
      partitions: partitionResults.map(({ features, ...metrics }) => ({ ...metrics, joinRows: features.length })),
      output: { joinRows: output.features.length, uniquePointIds: pointIds.size, representedZones: counts.size, bytes: outputBytes.byteLength, sha256: await sha256(outputBuffer) },
      parameters: { application: "ogr2ogr", predicate: "ST_Intersects", sql, arguments: argumentsList },
      elapsedMilliseconds: duration,
      memoryDisclosure: "Each Worker initializes an independent GDAL WASM instance; standard browser APIs do not expose its peak memory.",
    };
    receiptOutput.textContent = JSON.stringify(receipt, null, 2);
    validation.textContent = failures.length ? `Validation failed: ${[...new Set(failures)].join("; ")}.` : `PASS — ${pointCount.toLocaleString()} points joined exactly once across 100 zones using ${actualWorkers} Worker${actualWorkers === 1 ? "" : "s"}${calibration.fallback && requestedWorkers !== actualWorkers ? ` after automatic fallback from ${requestedWorkers}` : ""}.`;
    validation.dataset.state = failures.length ? "failed" : "passed";
    status.textContent = `Spatial join completed in ${(duration / 1000).toFixed(2)} seconds with ${actualWorkers} Worker${actualWorkers === 1 ? "" : "s"}; UI remained responsive.`;
    resultUrl = URL.createObjectURL(new Blob([outputBuffer], { type: "application/geo+json" }));
    downloadButton.disabled = failures.length > 0;
    downloadButton.onclick = () => {
      const link = document.createElement("a");
      link.href = resultUrl;
      link.download = "spatial-join-result.geojson";
      link.click();
    };
  } catch (error) {
    if (!cancelled) {
      status.textContent = error instanceof Error ? error.message : "The spatial join failed.";
      validation.textContent = "Spike failed safely; no output was accepted.";
      validation.dataset.state = "failed";
    }
  } finally {
    finish();
  }
});

cancelButton.addEventListener("click", () => {
  cancelled = true;
  for (const client of activeClients) client.terminate();
  activeClients.clear();
  if (timer) window.clearInterval(timer);
  timer = 0;
  runButton.disabled = false;
  profile.disabled = false;
  workerCount.disabled = false;
  cancelButton.hidden = true;
  status.textContent = "Cancelled. All active Workers were terminated and no partial join was accepted.";
  validation.textContent = "Cancelled.";
  validation.dataset.state = "failed";
});
