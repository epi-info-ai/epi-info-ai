import { GdalWorkerClient, type GdalDatasetInfo, type GdalOpenedDataset } from "../gdal-wasm-worker.js";

interface Geometry { type: string; coordinates: unknown }
interface Feature { type: "Feature"; properties: Record<string, unknown>; geometry: Geometry }
interface FeatureCollection { type: "FeatureCollection"; features: Feature[] }

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing dirty-boundary element: ${selector}`);
  return element;
};
const profile = required<HTMLSelectElement>("#dirty-profile");
const runButton = required<HTMLButtonElement>("#run-dirty-boundaries");
const cancelButton = required<HTMLButtonElement>("#cancel-dirty-boundaries");
const repairedButton = required<HTMLButtonElement>("#download-repaired");
const classifiedButton = required<HTMLButtonElement>("#download-classified");
const status = required<HTMLElement>("#dirty-status");
const elapsed = required<HTMLElement>("#dirty-elapsed");
const validation = required<HTMLElement>("#dirty-validation");
const findingsOutput = required<HTMLElement>("#dirty-findings");
const receiptOutput = required<HTMLElement>("#dirty-receipt");
const beforeMap = required<SVGSVGElement>("#dirty-before-map");
const afterMap = required<SVGSVGElement>("#dirty-after-map");
let activeClient: GdalWorkerClient | null = null;
let timer = 0;
let cancelled = false;
let resultUrls: string[] = [];

const repairSql = "SELECT boundary_id, defect, ST_IsValid(geometry) AS source_valid, GeometryType(geometry) AS source_geometry_type, GeometryType(ST_MakeValid(geometry)) AS repaired_geometry_type, ST_MakeValid(geometry) AS geometry FROM dirty_overlay WHERE kind = 'boundary'";
const overlaySql = "SELECT p.point_id, p.case_name, p.expected_boundary, b.boundary_id AS actual_boundary, p.geometry FROM dirty_overlay p LEFT JOIN dirty_overlay b ON b.kind = 'boundary' AND ST_Intersects(p.geometry, ST_MakeValid(b.geometry)) WHERE p.kind = 'point'";
const repairArguments = ["-f", "GeoJSON", "-dialect", "SQLite", "-sql", repairSql, "-lco", "RFC7946=YES"];
const overlayArguments = ["-f", "GeoJSON", "-dialect", "SQLite", "-sql", overlaySql, "-lco", "RFC7946=YES"];
const svgNamespace = "http://www.w3.org/2000/svg";
const previewBounds = { west: -83.69, south: 41.595, east: -83.44, north: 41.655 };

const sha256 = async (bytes: ArrayBuffer): Promise<string> => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
  .map((value) => value.toString(16).padStart(2, "0")).join("");

async function fetchFixture(path: string): Promise<FeatureCollection> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status}).`);
  return response.json() as Promise<FeatureCollection>;
}

function translatedGeometry(geometry: Geometry, longitudeOffset: number, latitudeOffset: number): Geometry {
  const translate = (value: unknown): unknown => {
    if (!Array.isArray(value)) return value;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      return [value[0] + longitudeOffset, value[1] + latitudeOffset, ...value.slice(2)];
    }
    return value.map(translate);
  };
  return { type: geometry.type, coordinates: translate(geometry.coordinates) };
}

function buildFixture(boundaries: FeatureCollection, points: FeatureCollection, copies: number): FeatureCollection {
  const features: Feature[] = [];
  for (let copy = 0; copy < copies; copy += 1) {
    const suffix = String(copy + 1).padStart(3, "0");
    const longitudeOffset = (copy % 10) * 0.25;
    const latitudeOffset = Math.floor(copy / 10) * 0.12;
    for (const boundary of boundaries.features) {
      features.push({
        type: "Feature",
        properties: {
          kind: "boundary",
          boundary_id: `${String(boundary.properties.boundary_id)}_${suffix}`,
          defect: boundary.properties.defect,
        },
        geometry: translatedGeometry(boundary.geometry, longitudeOffset, latitudeOffset),
      });
    }
    for (const point of points.features) {
      const expected = point.properties.expected_boundary;
      features.push({
        type: "Feature",
        properties: {
          kind: "point",
          point_id: `${String(point.properties.point_id)}_${suffix}`,
          case_name: point.properties.case,
          expected_boundary: expected === null ? null : `${String(expected)}_${suffix}`,
        },
        geometry: translatedGeometry(point.geometry, longitudeOffset, latitudeOffset),
      });
    }
  }
  return { type: "FeatureCollection", features };
}

function coordinatePairs(value: unknown): number[][] {
  if (!Array.isArray(value)) return [];
  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") return [[value[0], value[1]]];
  return value.flatMap(coordinatePairs);
}

function polygonRings(geometry: Geometry): unknown[][] {
  if (geometry.type === "Polygon") return geometry.coordinates as unknown[][];
  if (geometry.type === "MultiPolygon") return (geometry.coordinates as unknown[][][]).flatMap((polygon) => polygon);
  return [];
}

function project(coordinate: number[]): [number, number] {
  const width = 600;
  const height = 260;
  const padding = 18;
  const x = padding + ((coordinate[0]! - previewBounds.west) / (previewBounds.east - previewBounds.west)) * (width - padding * 2);
  const y = height - padding - ((coordinate[1]! - previewBounds.south) / (previewBounds.north - previewBounds.south)) * (height - padding * 2);
  return [x, y];
}

function renderTopologyMap(svg: SVGSVGElement, boundaries: Feature[], points: Feature[], phase: "before" | "after"): void {
  svg.replaceChildren();
  const title = document.createElementNS(svgNamespace, "title");
  title.textContent = phase === "before" ? "Source boundary geometry" : "Derived repaired boundary geometry";
  svg.append(title);
  for (const feature of boundaries) {
    const commands = polygonRings(feature.geometry).map((ring) => {
      const pairs = coordinatePairs(ring);
      return pairs.map((coordinate, index) => {
        const [x, y] = project(coordinate);
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(" ") + " Z";
    }).join(" ");
    const path = document.createElementNS(svgNamespace, "path");
    const validControl = feature.properties.defect === "valid-control-with-hole" || Number(feature.properties.source_valid) === 1;
    path.setAttribute("d", commands);
    path.setAttribute("class", `boundary-shape ${phase === "after" ? "repaired" : validControl ? "source-control" : "source-invalid"}`);
    path.setAttribute("tabindex", "0");
    const tooltip = document.createElementNS(svgNamespace, "title");
    tooltip.textContent = `${String(feature.properties.boundary_id)} · ${String(feature.properties.defect)}${phase === "after" ? ` · ${String(feature.properties.repaired_geometry_type)}` : ""}`;
    path.append(tooltip);
    svg.append(path);
  }
  for (const feature of points) {
    const coordinate = coordinatePairs(feature.geometry.coordinates)[0];
    if (!coordinate) continue;
    const [x, y] = project(coordinate);
    const expected = feature.properties.expected_boundary ?? null;
    const actual = feature.properties.actual_boundary ?? expected;
    const circle = document.createElementNS(svgNamespace, "circle");
    circle.setAttribute("cx", x.toFixed(2));
    circle.setAttribute("cy", y.toFixed(2));
    circle.setAttribute("r", "4.5");
    circle.setAttribute("tabindex", "0");
    circle.setAttribute("class", `control-point ${actual === null ? "unassigned" : ""} ${phase === "after" && actual !== expected ? "mismatch" : ""}`);
    const tooltip = document.createElementNS(svgNamespace, "title");
    tooltip.textContent = `${String(feature.properties.point_id)} · ${String(feature.properties.case_name ?? feature.properties.case)} · ${phase === "after" ? `expected ${String(expected)}, actual ${String(actual)}` : `reviewed expectation ${String(expected)}`}`;
    circle.append(tooltip);
    svg.append(circle);
  }
}

function download(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

function finish(): void {
  if (timer) window.clearInterval(timer);
  timer = 0;
  activeClient?.terminate("Dirty-boundary operation complete.");
  activeClient = null;
  runButton.disabled = false;
  profile.disabled = false;
  cancelButton.hidden = true;
}

runButton.addEventListener("click", async () => {
  cancelled = false;
  for (const url of resultUrls) URL.revokeObjectURL(url);
  resultUrls = [];
  repairedButton.disabled = true;
  classifiedButton.disabled = true;
  findingsOutput.textContent = "";
  receiptOutput.textContent = "";
  validation.textContent = "Validation pending.";
  validation.dataset.state = "pending";
  runButton.disabled = true;
  profile.disabled = true;
  cancelButton.hidden = false;
  const started = performance.now();
  timer = window.setInterval(() => { elapsed.textContent = `${((performance.now() - started) / 1000).toFixed(1)} s`; }, 100);
  try {
    const copies = Number(profile.value);
    status.textContent = "Loading deterministic dirty geometry and control points…";
    const [boundaries, points] = await Promise.all([
      fetchFixture("./dirty-boundaries.geojson"),
      fetchFixture("./control-points.geojson"),
    ]);
    const fixture = buildFixture(boundaries, points, copies);
    const sourceBytes = new TextEncoder().encode(JSON.stringify(fixture));
    const sourceBuffer = sourceBytes.buffer.slice(sourceBytes.byteOffset, sourceBytes.byteOffset + sourceBytes.byteLength) as ArrayBuffer;
    activeClient = new GdalWorkerClient(new URL("../runtime/", window.location.href));
    status.textContent = `Initializing GDAL/WASM and inspecting ${copies * 3} boundaries…`;
    await activeClient.initialize();
    const opened = await activeClient.call<GdalOpenedDataset>("open", new File([sourceBuffer], "dirty_overlay.geojson", { type: "application/geo+json" }));
    if (opened.datasets.length !== 1) throw new Error("GDAL could not open the combined topology fixture.");
    const dataset = opened.datasets[0]!;
    const sourceInfo = await activeClient.call<GdalDatasetInfo>("getInfo", dataset);
    if (sourceInfo.featureCount !== copies * 13) throw new Error(`Expected ${copies * 13} source features; GDAL reported ${sourceInfo.featureCount ?? "an unknown count"}.`);

    status.textContent = "Repairing invalid boundaries with GEOS ST_MakeValid…";
    const repairedPath = await activeClient.call<{ local: string; real: string }>("ogr2ogr", dataset, repairArguments, "repaired-boundaries");
    const repairedBytes = await activeClient.call<Uint8Array>("getFileBytes", repairedPath);
    const repaired = JSON.parse(new TextDecoder().decode(repairedBytes)) as FeatureCollection;

    status.textContent = "Classifying control points against repaired boundaries…";
    const classifiedPath = await activeClient.call<{ local: string; real: string }>("ogr2ogr", dataset, overlayArguments, "classified-points");
    const classifiedBytes = await activeClient.call<Uint8Array>("getFileBytes", classifiedPath);
    const classified = JSON.parse(new TextDecoder().decode(classifiedBytes)) as FeatureCollection;
    await activeClient.call<void>("close", dataset);

    const topology = repaired.features.map((feature) => ({
      boundaryId: feature.properties.boundary_id,
      defect: feature.properties.defect,
      sourceValid: Number(feature.properties.source_valid),
      sourceGeometryType: feature.properties.source_geometry_type,
      repairedGeometryType: feature.properties.repaired_geometry_type,
    }));
    const assignments = classified.features.map((feature) => ({
      pointId: String(feature.properties.point_id),
      case: feature.properties.case_name,
      expected: feature.properties.expected_boundary ?? null,
      actual: feature.properties.actual_boundary ?? null,
    }));
    const failures: string[] = [];
    renderTopologyMap(afterMap, repaired.features.filter((feature) => String(feature.properties.boundary_id).endsWith("_001")), classified.features.filter((feature) => String(feature.properties.point_id).endsWith("_001")), "after");
    if (repaired.features.length !== copies * 3) failures.push(`expected ${copies * 3} repaired boundaries; received ${repaired.features.length}`);
    if (classified.features.length !== copies * 10) failures.push(`expected ${copies * 10} classified points; received ${classified.features.length}`);
    const invalidSources = topology.filter((item) => item.sourceValid === 0).length;
    if (invalidSources !== copies * 2) failures.push(`expected ${copies * 2} invalid source boundaries; received ${invalidSources}`);
    const mismatches = assignments.filter((item) => item.expected !== item.actual);
    if (mismatches.length) failures.push(`${mismatches.length} control-point assignments differ from the reviewed expectation`);
    const repairedBuffer = repairedBytes.buffer.slice(repairedBytes.byteOffset, repairedBytes.byteOffset + repairedBytes.byteLength) as ArrayBuffer;
    const classifiedBuffer = classifiedBytes.buffer.slice(classifiedBytes.byteOffset, classifiedBytes.byteOffset + classifiedBytes.byteLength) as ArrayBuffer;
    const duration = Math.round((performance.now() - started) * 10) / 10;
    const findings = {
      summary: {
        boundaries: topology.length,
        invalidSources,
        validControls: topology.length - invalidSources,
        controlPoints: assignments.length,
        matchedExpectations: assignments.length - mismatches.length,
        mismatches: mismatches.length,
      },
      geometryTypeChanges: topology.reduce<Record<string, number>>((counts, item) => {
        const key = `${String(item.sourceGeometryType)} → ${String(item.repairedGeometryType)}`;
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {}),
      topologySample: topology.slice(0, 6),
      assignmentSample: assignments.slice(0, 12),
      mismatchSample: mismatches.slice(0, 12),
    };
    findingsOutput.textContent = JSON.stringify(findings, null, 2);
    const receipt = {
      schemaVersion: 1,
      operation: "dirty-boundary-repair-and-point-overlay",
      engine: { package: "gdal3.js", packageVersion: "2.8.1", gdalVersion: "3.8.4", geosVersion: "3.12.1", sqlDialect: "SQLite", wasmThreads: false },
      execution: { environment: "dedicated-browser-worker", networkInput: false, sourceMutation: false },
      capability: { geometryValidation: "ST_IsValid", geometryRepair: "ST_MakeValid", spatialPredicate: "ST_Intersects", geosRequired: true },
      input: { fixtureCopies: copies, boundaries: copies * 3, points: copies * 10, bytes: sourceBytes.byteLength, sha256: await sha256(sourceBuffer) },
      topology: { invalidSources, validControls: topology.length - invalidSources, repairedFeatures: repaired.features.length, geometryTypeChanges: findings.geometryTypeChanges },
      assignments: { expected: copies * 10, actual: classified.features.length, mismatches: mismatches.length },
      outputs: {
        repaired: { bytes: repairedBytes.byteLength, sha256: await sha256(repairedBuffer) },
        classified: { bytes: classifiedBytes.byteLength, sha256: await sha256(classifiedBuffer) },
      },
      parameters: {
        repair: { application: "ogr2ogr", sql: repairSql, arguments: repairArguments },
        overlay: { application: "ogr2ogr", sql: overlaySql, arguments: overlayArguments },
      },
      elapsedMilliseconds: duration,
      governance: "Source geometry is retained unchanged; outputs are derived review artifacts. Automatic repair may alter topology and does not establish epidemiologic correctness.",
    };
    receiptOutput.textContent = JSON.stringify(receipt, null, 2);
    validation.textContent = failures.length ? `Validation failed: ${failures.join("; ")}.` : `PASS — ${invalidSources} invalid boundaries repaired and ${assignments.length} control points matched reviewed expectations.`;
    validation.dataset.state = failures.length ? "failed" : "passed";
    status.textContent = `Repair and overlay completed in ${(duration / 1000).toFixed(2)} seconds; source geometry was not modified.`;
    resultUrls = [
      URL.createObjectURL(new Blob([repairedBuffer], { type: "application/geo+json" })),
      URL.createObjectURL(new Blob([classifiedBuffer], { type: "application/geo+json" })),
    ];
    repairedButton.disabled = failures.length > 0;
    classifiedButton.disabled = failures.length > 0;
    repairedButton.onclick = () => download(resultUrls[0]!, "repaired-boundaries.geojson");
    classifiedButton.onclick = () => download(resultUrls[1]!, "classified-control-points.geojson");
  } catch (error) {
    if (!cancelled) {
      status.textContent = error instanceof Error ? error.message : "Dirty-boundary processing failed.";
      validation.textContent = "Spike failed safely; no derived output was accepted.";
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
  status.textContent = "Cancelled. The active Worker was terminated and no partial output was accepted.";
  validation.textContent = "Cancelled.";
  validation.dataset.state = "failed";
});

void Promise.all([fetchFixture("./dirty-boundaries.geojson"), fetchFixture("./control-points.geojson")])
  .then(([boundaries, points]) => renderTopologyMap(beforeMap, boundaries.features, points.features, "before"))
  .catch(() => { beforeMap.setAttribute("aria-label", "Source preview could not be loaded."); });
