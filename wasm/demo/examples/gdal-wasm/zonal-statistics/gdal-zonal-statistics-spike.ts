import { GdalWorkerClient, type GdalDataset, type GdalDatasetInfo, type GdalOpenedDataset } from "../gdal-wasm-worker.js";

interface Geometry { type: string; coordinates: unknown }
interface Feature { type: "Feature"; properties: Record<string, unknown>; geometry: Geometry }
interface FeatureCollection { type: "FeatureCollection"; features: Feature[] }
interface BandInfo { metadata?: unknown; noDataValue?: number }
interface RasterInfo { size?: number[]; bands?: BandInfo[] }
interface ZonalResult {
  zoneId: string; name: string; cases: number; population: number; validPixels: number;
  totalPixels: number; coveragePercent: number; ratePer100000: number | null; outsideRaster: boolean;
  denominatorStatus: "adequate" | "small" | "unavailable";
}
interface ReferenceContract {
  method: string;
  source: { rasterSha256: string; zonesSha256: string };
  tolerance: { populationRelative: number; populationAbsolute: number; validPixelDifference: number };
  results: Array<{ zoneId: string; population: number; validPixels: number; selectedPixels: number }>;
}

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing zonal-statistics element: ${selector}`);
  return element;
};
const profileSelect = required<HTMLSelectElement>("#zonal-profile");
const runButton = required<HTMLButtonElement>("#run-zonal");
const cancelButton = required<HTMLButtonElement>("#cancel-zonal");
const downloadButton = required<HTMLButtonElement>("#download-zonal");
const status = required<HTMLElement>("#zonal-status");
const elapsed = required<HTMLElement>("#zonal-elapsed");
const validation = required<HTMLElement>("#zonal-validation");
const map = required<SVGSVGElement>("#zonal-map");
const tableBody = required<HTMLTableSectionElement>("#zonal-table tbody");
const receiptOutput = required<HTMLElement>("#zonal-receipt");
const denominatorWarning = required<HTMLElement>("#zonal-denominator-warning");
const svgNamespace = "http://www.w3.org/2000/svg";
let activeClient: GdalWorkerClient | null = null;
let timer = 0;
let cancelled = false;
let resultUrl = "";
const smallDenominatorThreshold = 5_000;

const profileContract: Record<string, { zoneIds: string[]; passes: number }> = {
  diagnostic: { zoneIds: ["Z01", "Z02", "Z06"], passes: 1 },
  standard: { zoneIds: ["Z01", "Z02", "Z03", "Z04", "Z05", "Z06"], passes: 1 },
  stress: { zoneIds: ["Z01", "Z02", "Z03", "Z04", "Z05", "Z06"], passes: 4 },
};

const sha256 = async (bytes: ArrayBuffer): Promise<string> => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
  .map((value) => value.toString(16).padStart(2, "0")).join("");

function coordinatePairs(value: unknown): number[][] {
  if (!Array.isArray(value)) return [];
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") return [[value[0], value[1]]];
  return value.flatMap(coordinatePairs);
}

function geometryBounds(geometry: Geometry): [number, number, number, number] {
  const coordinates = coordinatePairs(geometry.coordinates);
  return [
    Math.min(...coordinates.map(([x]) => x!)), Math.min(...coordinates.map(([, y]) => y!)),
    Math.max(...coordinates.map(([x]) => x!)), Math.max(...coordinates.map(([, y]) => y!)),
  ];
}

function rasterBounds(info: GdalDatasetInfo): [number, number, number, number] {
  const transform = info.coordinateTransform;
  if (!transform || !info.width || !info.height) throw new Error("GDAL did not report a usable population-raster geotransform.");
  const x1 = transform[0]! + transform[1]! * info.width + transform[2]! * info.height;
  const y1 = transform[3]! + transform[4]! * info.width + transform[5]! * info.height;
  return [Math.min(transform[0]!, x1), Math.min(transform[3]!, y1), Math.max(transform[0]!, x1), Math.max(transform[3]!, y1)];
}

function intersects(a: number[], b: number[]): boolean {
  return a[0]! < b[2]! && a[2]! > b[0]! && a[1]! < b[3]! && a[3]! > b[1]!;
}

function metadataNumber(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object") return null;
  for (const [name, child] of Object.entries(value)) {
    if (name === key) {
      const parsed = Number(child);
      return Number.isFinite(parsed) ? parsed : null;
    }
    const nested = metadataNumber(child, key);
    if (nested !== null) return nested;
  }
  return null;
}

async function analyzeZone(client: GdalWorkerClient, raster: GdalDataset, cutlinePath: string, feature: Feature, rasterExtent: number[], pass: number): Promise<ZonalResult> {
  const zoneId = String(feature.properties.zone_id);
  const name = String(feature.properties.name);
  const cases = Number(feature.properties.case_count);
  if (!intersects(geometryBounds(feature.geometry), rasterExtent)) {
    return { zoneId, name, cases, population: 0, validPixels: 0, totalPixels: 0, coveragePercent: 0, ratePer100000: null, outsideRaster: true, denominatorStatus: "unavailable" };
  }
  const argumentsList = [
    "-of", "GTiff", "-cutline", cutlinePath, "-cwhere", `zone_id = '${zoneId}'`, "-crop_to_cutline",
    "-r", "near", "-dstnodata", "-99999", "-co", "COMPRESS=DEFLATE",
  ];
  const outputPath = await client.call<{ local: string; real: string }>("gdalwarp", raster, argumentsList, `zonal-${zoneId.toLowerCase()}-pass-${pass + 1}`);
  const opened = await client.call<GdalOpenedDataset>("open", outputPath.local);
  if (opened.datasets.length !== 1) throw new Error(`GDAL could not reopen the ${zoneId} masked raster.`);
  const dataset = opened.datasets[0]!;
  const info = await client.call<RasterInfo>("gdalinfo", dataset, ["-stats"]);
  await client.call<void>("close", dataset);
  const width = Number(info.size?.[0] ?? 0);
  const height = Number(info.size?.[1] ?? 0);
  const totalPixels = width * height;
  const band = info.bands?.[0];
  const mean = metadataNumber(band?.metadata, "STATISTICS_MEAN");
  const validPercent = metadataNumber(band?.metadata, "STATISTICS_VALID_PERCENT");
  if (mean === null || validPercent === null || totalPixels <= 0) throw new Error(`GDAL did not return complete statistics for ${zoneId}.`);
  const validPixels = Math.round(totalPixels * validPercent / 100);
  const population = mean * validPixels;
  return {
    zoneId, name, cases, population, validPixels, totalPixels,
    coveragePercent: validPercent,
    ratePer100000: population > 0 ? cases / population * 100_000 : null,
    outsideRaster: false,
    denominatorStatus: population <= 0 ? "unavailable" : population < smallDenominatorThreshold ? "small" : "adequate",
  };
}

function renderTable(results: ZonalResult[]): void {
  tableBody.replaceChildren();
  for (const result of results) {
    const row = document.createElement("tr");
    if (result.denominatorStatus === "small") row.classList.add("denominator-small");
    const review = result.denominatorStatus === "small" ? `Review: below ${smallDenominatorThreshold.toLocaleString()}` : result.denominatorStatus === "unavailable" ? "Unavailable" : "—";
    const values = [result.zoneId, result.cases.toLocaleString(), result.population.toFixed(1), result.validPixels.toLocaleString(), `${result.coveragePercent.toFixed(1)}%`, result.ratePer100000 === null ? "Not calculated" : result.ratePer100000.toFixed(1), review];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (value === review && result.denominatorStatus !== "adequate") cell.classList.add("review-flag");
      row.append(cell);
    }
    tableBody.append(row);
  }
}

function renderMap(features: Feature[], results: ZonalResult[]): void {
  map.replaceChildren();
  const resultByZone = new Map(results.map((result) => [result.zoneId, result]));
  const rates = results.map(({ ratePer100000 }) => ratePer100000).filter((value): value is number => value !== null);
  const maximum = Math.max(...rates, 1);
  const bounds: [number, number, number, number] = [-83.71, 41.575, -83.235, 41.765];
  const project = ([longitude, latitude]: number[]): [number, number] => [25 + (longitude! - bounds[0]) / (bounds[2] - bounds[0]) * 650, 305 - (latitude! - bounds[1]) / (bounds[3] - bounds[1]) * 280];
  for (const feature of features) {
    const zoneId = String(feature.properties.zone_id);
    const result = resultByZone.get(zoneId);
    if (!result) continue;
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates as unknown[][]] : feature.geometry.coordinates as unknown[][][];
    const commands = polygons.flatMap((polygon) => polygon.map((ring) => coordinatePairs(ring).map((coordinate, index) => {
      const [x, y] = project(coordinate);
      return `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ") + " Z")).join(" ");
    const path = document.createElementNS(svgNamespace, "path");
    const intensity = result.ratePer100000 === null ? null : result.ratePer100000 / maximum;
    path.setAttribute("d", commands);
    path.setAttribute("fill-rule", "evenodd");
    path.setAttribute("fill", intensity === null ? "#c5cdd1" : `hsl(${210 - intensity * 195} 70% ${78 - intensity * 35}%)`);
    path.setAttribute("stroke", "#173f52");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("tabindex", "0");
    const title = document.createElementNS(svgNamespace, "title");
    title.textContent = `${zoneId} ${result.name}: ${result.cases} cases; ${result.population.toFixed(1)} population units; ${result.coveragePercent.toFixed(1)}% coverage; rate ${result.ratePer100000?.toFixed(1) ?? "not calculated"}; denominator ${result.denominatorStatus}`;
    path.append(title);
    map.append(path);
  }
}

function csvFor(results: ZonalResult[]): string {
  const rows = [["zone_id", "name", "cases", "population_units", "valid_pixels", "total_pixels", "coverage_percent", "rate_per_100000", "denominator_status", "outside_raster"], ...results.map((result) => [result.zoneId, result.name, result.cases, result.population, result.validPixels, result.totalPixels, result.coveragePercent, result.ratePer100000 ?? "", result.denominatorStatus, result.outsideRaster])];
  return rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\r\n") + "\r\n";
}

function finish(): void {
  if (timer) window.clearInterval(timer);
  timer = 0;
  activeClient?.terminate("Zonal-statistics pipeline finished.");
  activeClient = null;
  runButton.disabled = false;
  profileSelect.disabled = false;
  cancelButton.hidden = true;
}

runButton.addEventListener("click", async () => {
  cancelled = false;
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = "";
  downloadButton.disabled = true;
  receiptOutput.textContent = "";
  validation.textContent = "Validation pending.";
  validation.dataset.state = "pending";
  runButton.disabled = true;
  profileSelect.disabled = true;
  cancelButton.hidden = false;
  const started = performance.now();
  timer = window.setInterval(() => { elapsed.textContent = `${((performance.now() - started) / 1000).toFixed(1)} s`; }, 100);
  try {
    const profile = profileContract[profileSelect.value];
    if (!profile) throw new Error("Unknown zonal-statistics profile.");
    status.textContent = "Loading the local population surface and study zones…";
    const [rasterResponse, zonesResponse, referenceResponse] = await Promise.all([
      fetch("../../foodborne/maps/worldpop-toledo-population-density.tif", { cache: "no-store" }),
      fetch("./study-zones.geojson", { cache: "no-store" }),
      fetch("./expected-result.json", { cache: "no-store" }),
    ]);
    if (!rasterResponse.ok || !zonesResponse.ok || !referenceResponse.ok) throw new Error("The local zonal-statistics fixtures could not be loaded.");
    const rasterBytes = await rasterResponse.arrayBuffer();
    const zoneBytes = await zonesResponse.arrayBuffer();
    const reference = await referenceResponse.json() as ReferenceContract;
    const rasterDigest = await sha256(rasterBytes);
    const zonesDigest = await sha256(zoneBytes);
    if (rasterDigest !== reference.source.rasterSha256 || zonesDigest !== reference.source.zonesSha256) throw new Error("A zonal-statistics source digest differs from the independent validation contract.");
    const allZones = JSON.parse(new TextDecoder().decode(zoneBytes)) as FeatureCollection;
    const zones = allZones.features.filter((feature) => profile.zoneIds.includes(String(feature.properties.zone_id)));
    activeClient = new GdalWorkerClient(new URL("../runtime/", window.location.href));
    status.textContent = "Initializing GDAL, PROJ, GEOS, and GeoTIFF support…";
    await activeClient.initialize();
    const rasterOpened = await activeClient.call<GdalOpenedDataset>("open", new File([rasterBytes], "population-surface.tif", { type: "image/tiff" }));
    const zonesOpened = await activeClient.call<GdalOpenedDataset>("open", new File([zoneBytes], "study-zones.geojson", { type: "application/geo+json" }));
    if (rasterOpened.datasets.length !== 1 || zonesOpened.datasets.length !== 1) throw new Error("GDAL could not open both zonal-statistics inputs.");
    const raster = rasterOpened.datasets[0]!;
    const zoneDataset = zonesOpened.datasets[0]!;
    const rasterInfo = await activeClient.call<GdalDatasetInfo>("getInfo", raster);
    const rasterExtent = rasterBounds(rasterInfo);
    const cutlinePath = `/input/${zoneDataset.path}`;
    const passes: ZonalResult[][] = [];
    for (let pass = 0; pass < profile.passes; pass += 1) {
      const passResults: ZonalResult[] = [];
      for (let index = 0; index < zones.length; index += 1) {
        status.textContent = `Pass ${pass + 1} of ${profile.passes}: masking zone ${index + 1} of ${zones.length}…`;
        passResults.push(await analyzeZone(activeClient, raster, cutlinePath, zones[index]!, rasterExtent, pass));
      }
      passes.push(passResults);
    }
    await activeClient.call<void>("close", zoneDataset);
    await activeClient.call<void>("close", raster);
    const results = passes[0]!;
    const failures: string[] = [];
    if (results.length !== zones.length) failures.push("one or more zones are missing");
    if (results.some((result) => !Number.isFinite(result.population) || result.population < 0)) failures.push("a population result is negative or non-finite");
    const outside = results.find(({ zoneId }) => zoneId === "Z06");
    if (outside && (outside.population !== 0 || outside.ratePer100000 !== null || !outside.outsideRaster)) failures.push("outside-raster handling differs from the contract");
    const referenceComparisons = results.map((result) => {
      const expected = reference.results.find(({ zoneId }) => zoneId === result.zoneId);
      if (!expected) return { zoneId: result.zoneId, missing: true };
      const populationDifference = Math.abs(result.population - expected.population);
      const populationTolerance = Math.max(reference.tolerance.populationAbsolute, Math.abs(expected.population) * reference.tolerance.populationRelative);
      const validPixelDifference = Math.abs(result.validPixels - expected.validPixels);
      if (populationDifference > populationTolerance || validPixelDifference > reference.tolerance.validPixelDifference) failures.push(`${result.zoneId} differs from the independent cell-center reference`);
      return { zoneId: result.zoneId, expectedPopulation: expected.population, actualPopulation: result.population, populationDifference, populationTolerance, expectedValidPixels: expected.validPixels, actualValidPixels: result.validPixels, validPixelDifference };
    });
    let maximumRepeatDelta = 0;
    for (const pass of passes.slice(1)) for (let index = 0; index < results.length; index += 1) maximumRepeatDelta = Math.max(maximumRepeatDelta, Math.abs(pass[index]!.population - results[index]!.population));
    if (maximumRepeatDelta > 1e-6) failures.push(`repeat passes differ by ${maximumRepeatDelta}`);
    renderTable(results);
    renderMap(zones, results);
    const smallDenominators = results.filter(({ denominatorStatus }) => denominatorStatus === "small");
    const unavailableDenominators = results.filter(({ denominatorStatus }) => denominatorStatus === "unavailable");
    const warningParts: string[] = [];
    if (smallDenominators.length) warningParts.push(`${smallDenominators.map(({ zoneId, population }) => `${zoneId} (${population.toFixed(1)})`).join(", ")} below ${smallDenominatorThreshold.toLocaleString()} population units; interpret rates cautiously`);
    if (unavailableDenominators.length) warningParts.push(`${unavailableDenominators.map(({ zoneId }) => zoneId).join(", ")} has no usable denominator; no rate was calculated`);
    denominatorWarning.innerHTML = "";
    const warningLabel = document.createElement("strong");
    warningLabel.textContent = "Small-denominator review: ";
    denominatorWarning.append(warningLabel, document.createTextNode(warningParts.length ? `${warningParts.join(". ")}. The 5,000-unit demonstration threshold is a review cue, not a universal suppression rule.` : "No selected zone is below the demonstration threshold."));
    const csv = csvFor(results);
    const csvBytes = new TextEncoder().encode(csv);
    const csvBuffer = csvBytes.buffer.slice(csvBytes.byteOffset, csvBytes.byteOffset + csvBytes.byteLength) as ArrayBuffer;
    const duration = Math.round((performance.now() - started) * 10) / 10;
    const receipt = {
      schemaVersion: 1,
      operation: "population-at-risk-zonal-statistics",
      engine: { package: "gdal3.js", packageVersion: "2.8.1", gdalVersion: "3.8.4", projVersion: "9.3.1", geosVersion: "3.12.1" },
      execution: { environment: "dedicated-browser-worker", profile: profileSelect.value, passes: profile.passes, zoneJobs: zones.length * profile.passes, networkInput: false, sourceMutation: false },
      source: { raster: { bytes: rasterBytes.byteLength, sha256: rasterDigest, crs: "EPSG:4326", bounds: rasterExtent, width: rasterInfo.width, height: rasterInfo.height, nodata: -99999 }, zones: { bytes: zoneBytes.byteLength, sha256: zonesDigest, selected: profile.zoneIds } },
      parameters: { mask: { application: "gdalwarp", resampling: "near", cropToCutline: true, destinationNoData: -99999 }, statistics: { application: "gdalinfo", arguments: ["-stats"] }, rateMultiplier: 100_000, smallDenominatorThreshold },
      results,
      denominatorReview: { threshold: smallDenominatorThreshold, policy: "demonstration-review-cue-not-universal-suppression", small: smallDenominators.map(({ zoneId, population }) => ({ zoneId, population })), unavailable: unavailableDenominators.map(({ zoneId }) => zoneId) },
      validation: { referenceMethod: reference.method, tolerance: reference.tolerance, referenceComparisons, outsideRasterZone: "Z06", repeatedPasses: profile.passes, maximumPopulationDelta: maximumRepeatDelta, failures },
      output: { format: "CSV", bytes: csvBytes.byteLength, sha256: await sha256(csvBuffer) },
      elapsedMilliseconds: duration,
      governance: "The fixture lacks authoritative population-unit metadata. Rates are architecture-test outputs and must not be interpreted as surveillance estimates.",
    };
    receiptOutput.textContent = JSON.stringify(receipt, null, 2);
    validation.textContent = failures.length ? `Validation failed: ${failures.join("; ")}.` : `PASS — ${zones.length} zones across ${profile.passes} pass${profile.passes === 1 ? "" : "es"}; masking, NoData, outside coverage, and repeatability checks succeeded.`;
    validation.dataset.state = failures.length ? "failed" : "passed";
    status.textContent = `Zonal statistics completed in ${(duration / 1000).toFixed(2)} seconds; UI remained responsive.`;
    resultUrl = URL.createObjectURL(new Blob([csvBuffer], { type: "text/csv" }));
    downloadButton.disabled = failures.length > 0;
    downloadButton.onclick = () => {
      const link = document.createElement("a");
      link.href = resultUrl;
      link.download = "population-at-risk-zonal-statistics.csv";
      link.click();
    };
  } catch (error) {
    if (!cancelled) {
      status.textContent = error instanceof Error ? error.message : "Zonal-statistics processing failed.";
      validation.textContent = "Spike failed safely; no analytical output was accepted.";
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
  status.textContent = "Cancelled. The Worker was terminated and no partial zonal result was accepted.";
  validation.textContent = "Cancelled.";
  validation.dataset.state = "failed";
});
