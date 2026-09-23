import { inspectGisDatasetInWorker, type GisPlanV01 } from "../app/gis/index.ts";

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing GIS-K02 spike element: ${selector}`);
  return element;
};

const runButton = required<HTMLButtonElement>("#run-inspect");
const cancelButton = required<HTMLButtonElement>("#cancel-inspect");
const status = required<HTMLElement>("#inspect-status");
const resultOutput = required<HTMLElement>("#inspect-result");
let controller: AbortController | null = null;

const fixture = new TextEncoder().encode(JSON.stringify({
  type: "FeatureCollection",
  crs: { type: "name", properties: { name: "EPSG:4326" } },
  features: [
    { type: "Feature", properties: { case_id: "A", status: "case" }, geometry: { type: "Point", coordinates: [-83.55, 41.64] } },
    { type: "Feature", properties: { case_id: "B", status: "control" }, geometry: { type: "Point", coordinates: [-83.52, 41.66] } },
  ],
})).buffer as ArrayBuffer;

async function digest(bytes: ArrayBuffer): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function planFor(sha256: string): GisPlanV01 {
  return {
    schema: "epi-gis-plan/0.1",
    id: `inspect-${Date.now()}`,
    operation: "gis.dataset.inspect",
    projectRevision: "gis-k02-spike",
    inputs: [{ assetId: "fixture.geojson", sha256, role: "reference-geography", mediaType: "application/geo+json", byteLength: fixture.byteLength, declaredCrs: "EPSG:4326" }],
    parameters: {},
    limits: { maxInputBytes: 100_000, maxOutputBytes: 100_000, maxFeatures: 10, maxCoordinates: 100, maxNestingDepth: 40, maxProperties: 100, timeoutMilliseconds: 10_000 },
    requestedOutputs: [{ id: "dataset-inventory", mediaType: "application/json", disclosure: "aggregate" }],
  };
}

runButton.addEventListener("click", async () => {
  controller?.abort();
  controller = new AbortController();
  runButton.disabled = true;
  cancelButton.disabled = false;
  resultOutput.textContent = "";
  status.dataset.state = "pending";
  status.textContent = "Inspecting fixture in the GIS Worker…";
  try {
    const result = await inspectGisDatasetInWorker(planFor(await digest(fixture)), fixture.slice(0), { signal: controller.signal });
    resultOutput.textContent = JSON.stringify(result, null, 2);
    status.dataset.state = "passed";
    status.textContent = `PASS — ${result.data.featureCount} features, ${result.data.estimatedWork.coordinates} coordinates inspected.`;
  } catch (error) {
    status.dataset.state = "failed";
    status.textContent = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  } finally {
    controller = null;
    runButton.disabled = false;
    cancelButton.disabled = true;
  }
});

cancelButton.addEventListener("click", () => controller?.abort());
