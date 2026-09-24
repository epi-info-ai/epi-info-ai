import { inspectGisDatasetInWorker, type GisPlanV01, type GisResultV01 } from "../app/gis/index.ts";

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing GIS Kernel Lab element: ${selector}`);
  return element;
};

type Scenario = { id: string; assetId: string; projectRevision: string; description: string; value: unknown };
type InspectData = { featureCount: number; geometryTypes: readonly string[]; extent: readonly number[]; fields: readonly string[]; estimatedWork: { coordinates: number } };
const scenarios: Record<string, Scenario> = {
  environmental: {
    id: "environmental", assetId: "synthetic-heat-health-observations.geojson", projectRevision: "environmental-heat-health-demo-v0.1",
    description: "Twelve synthetic heat-health point observations packaged for the NCEH collaboration demonstration. No real person, address, or provider response is included.",
    value: {
      type: "FeatureCollection", crs: { type: "name", properties: { name: "EPSG:4326" } },
      features: [
        ["HH001", "Elevated", "No", -77.03250, 38.93610], ["HH002", "Elevated", "No", -77.03690, 38.90720],
        ["HH003", "Elevated", "Yes", -77.01710, 38.87520], ["HH004", "Extreme", "Yes", -77.02840, 38.93480],
        ["HH005", "Extreme", "Yes", -77.03120, 38.90490], ["HH006", "Extreme", "Yes", -77.02180, 38.87270],
        ["HH007", "Extreme", "Yes", -77.02510, 38.93150], ["HH008", "Extreme", "Yes", -77.03960, 38.90240],
        ["HH009", "Extreme", "No", -77.01370, 38.87810], ["HH010", "Elevated", "No", -77.03580, 38.93820],
        ["HH011", "Elevated", "No", -77.04310, 38.90960], ["HH012", "Elevated", "No", -77.02630, 38.86990],
      ].map(([observation_id, heat_category, health_event, longitude, latitude]) => ({
        type: "Feature", properties: { observation_id, heat_category, health_event }, geometry: { type: "Point", coordinates: [longitude, latitude] },
      })),
    },
  },
  architecture: {
    id: "architecture", assetId: "fixture.geojson", projectRevision: "gis-k02-spike",
    description: "The original two-point fixture used to verify the typed GIS Worker architecture.",
    value: {
      type: "FeatureCollection", crs: { type: "name", properties: { name: "EPSG:4326" } },
      features: [
        { type: "Feature", properties: { case_id: "A", status: "case" }, geometry: { type: "Point", coordinates: [-83.55, 41.64] } },
        { type: "Feature", properties: { case_id: "B", status: "control" }, geometry: { type: "Point", coordinates: [-83.52, 41.66] } },
      ],
    },
  },
};

const fixtureSelect = required<HTMLSelectElement>("#fixture-select");
const runButton = required<HTMLButtonElement>("#run-inspect");
const cancelButton = required<HTMLButtonElement>("#cancel-inspect");
const status = required<HTMLElement>("#inspect-status");
const resultOutput = required<HTMLElement>("#inspect-result");
const humanResult = required<HTMLElement>("#human-result");
let controller: AbortController | null = null;

function selectedScenario(): Scenario { return scenarios[fixtureSelect.value] ?? scenarios.environmental!; }
function bytesFor(scenario: Scenario): ArrayBuffer { return new TextEncoder().encode(JSON.stringify(scenario.value)).buffer as ArrayBuffer; }
async function digest(bytes: ArrayBuffer): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function planFor(scenario: Scenario, bytes: ArrayBuffer, sha256: string): GisPlanV01 {
  return {
    schema: "epi-gis-plan/0.1", id: `inspect-${scenario.id}-${Date.now()}`, operation: "gis.dataset.inspect", projectRevision: scenario.projectRevision,
    inputs: [{ assetId: scenario.assetId, sha256, role: "reference-geography", mediaType: "application/geo+json", byteLength: bytes.byteLength, declaredCrs: "EPSG:4326" }],
    parameters: {}, limits: { maxInputBytes: 100_000, maxOutputBytes: 100_000, maxFeatures: 100, maxCoordinates: 1_000, maxNestingDepth: 40, maxProperties: 500, timeoutMilliseconds: 10_000 },
    requestedOutputs: [{ id: "dataset-inventory", mediaType: "application/json", disclosure: "aggregate" }],
  };
}
function renderPlan(): void {
  const scenario = selectedScenario(); const bytes = bytesFor(scenario);
  required("#fixture-description").textContent = scenario.description;
  required("#plan-operation").textContent = "gis.dataset.inspect · candidate";
  required("#plan-input").textContent = `${scenario.assetId} · ${bytes.byteLength.toLocaleString()} bytes`;
  required("#plan-limits").textContent = "100 features · 1,000 coordinates · 100 KiB input/output · 10 second timeout";
  humanResult.hidden = true; status.dataset.state = "idle"; status.textContent = "Ready. Review the effective plan before running it.";
}
function renderResult(result: GisResultV01): void {
  const data = result.data as InspectData;
  humanResult.hidden = false;
  required("#result-features").textContent = String(data.featureCount);
  required("#result-coordinates").textContent = String(data.estimatedWork.coordinates);
  required("#result-geometry").textContent = data.geometryTypes.join(", ");
  required("#result-validation").textContent = result.receipt.validationStatus;
  required("#result-extent").textContent = data.extent.join(", ");
  required("#result-fields").textContent = data.fields.join(", ");
  required("#result-operation").textContent = result.receipt.operation;
  required("#result-status").textContent = result.receipt.terminalStatus;
  resultOutput.textContent = JSON.stringify(result, null, 2);
}

fixtureSelect.addEventListener("change", renderPlan);
runButton.addEventListener("click", async () => {
  controller?.abort(); controller = new AbortController(); runButton.disabled = true; cancelButton.disabled = false;
  resultOutput.textContent = ""; humanResult.hidden = true; status.dataset.state = "pending"; status.textContent = "Inspecting local fixture in the bounded GIS Worker…";
  try {
    const scenario = selectedScenario(); const fixture = bytesFor(scenario);
    const result = await inspectGisDatasetInWorker(planFor(scenario, fixture, await digest(fixture)), fixture.slice(0), { signal: controller.signal });
    const data = result.data as InspectData;
    renderResult(result); status.dataset.state = "passed";
    status.textContent = `PASS — ${data.featureCount} features and ${data.estimatedWork.coordinates} coordinates inspected; project state was not changed.`;
  } catch (error) {
    status.dataset.state = "failed"; status.textContent = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  } finally { controller = null; runButton.disabled = false; cancelButton.disabled = true; }
});
cancelButton.addEventListener("click", () => controller?.abort());
renderPlan();
