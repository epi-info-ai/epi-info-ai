import type { OfflineMapAsset, ProjectStudyArea, StudyAreaBounds } from "../contracts/core.ts";
import { estimateOfflineMapPackage, offlineMapProvider } from "../maps/offline-map-estimator.ts";
import { persistPmtilesImport, validatePmtilesImport, type ValidatedPmtilesImport } from "../maps/pmtiles-import.ts";

type LeafletHandle = any;
const L: LeafletHandle = (globalThis as typeof globalThis & { L?: LeafletHandle }).L;

const DEFAULT_CENTER: [number, number] = [39.8283, -98.5795];
const DEFAULT_ZOOM = 4;
const PACKAGE_LIMIT_MIB = 100;
const MEBIBYTE = 1024 * 1024;

let map: LeafletHandle | null = null;
let rectangle: LeafletHandle | null = null;
let firstCorner: LeafletHandle | null = null;
let pendingApply: ((studyArea: ProjectStudyArea | null) => void) | null = null;
let currentSource: ProjectStudyArea["source"] = "manual-bounds";
let storageEstimateSequence = 0;
let selectedPmtilesFile: File | null = null;
let validatedPmtiles: ValidatedPmtilesImport | null = null;

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required study-area element is missing: ${selector}`);
  return element;
}

function coordinateInput(id: string): HTMLInputElement {
  return requiredElement<HTMLInputElement>(id);
}

function inputBounds(): StudyAreaBounds | null {
  const values = ["#study-area-west", "#study-area-south", "#study-area-east", "#study-area-north"]
    .map((id) => Number(coordinateInput(id).value));
  if (!values.every(Number.isFinite)) return null;
  const [west, south, east, north] = values as StudyAreaBounds;
  return west >= -180 && east <= 180 && south >= -90 && north <= 90 && west < east && south < north
    ? [west, south, east, north]
    : null;
}

function writeBounds(bounds: StudyAreaBounds): void {
  ["#study-area-west", "#study-area-south", "#study-area-east", "#study-area-north"]
    .forEach((id, index) => { coordinateInput(id).value = bounds[index]!.toFixed(5); });
}

function dimensions(bounds: StudyAreaBounds): { widthKm: number; heightKm: number; areaKm2: number; longestKm: number } {
  const [west, south, east, north] = bounds;
  const centerLatitude = (south + north) / 2;
  const widthKm = (east - west) * 111.32 * Math.cos(centerLatitude * Math.PI / 180);
  const heightKm = (north - south) * 111.32;
  return { widthKm, heightKm, areaKm2: widthKm * heightKm, longestKm: Math.max(widthKm, heightKm) };
}

export function recommendedMaximumZoom(longestKm: number): number {
  if (longestKm > 500) return 12;
  if (longestKm > 100) return 13;
  if (longestKm > 25) return 14;
  if (longestKm > 5) return 15;
  return 16;
}

function formatBytes(bytes: number): string {
  if (bytes >= MEBIBYTE) return `${(bytes / MEBIBYTE).toFixed(1)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} bytes`;
}

function pmtilesSelected(): boolean {
  return requiredElement<HTMLSelectElement>("#study-area-provider").value === "browser-pmtiles";
}

function renderPmtilesControls(): void {
  requiredElement<HTMLElement>("#study-area-pmtiles-fields").hidden = !pmtilesSelected();
}

function invalidatePmtiles(message = "Select a PMTiles archive, enter its attribution and license, then validate it."): void {
  validatedPmtiles = null;
  const status = requiredElement<HTMLElement>("#study-area-pmtiles-status");
  status.textContent = message;
  status.dataset.state = "empty";
}

async function renderPackageEstimate(bounds: StudyAreaBounds | null): Promise<void> {
  const output = requiredElement<HTMLElement>("#study-area-package-estimate");
  const provider = offlineMapProvider(requiredElement<HTMLSelectElement>("#study-area-provider").value);
  requiredElement<HTMLElement>("#study-area-provider-policy").textContent = provider.policySummary;
  const sequence = ++storageEstimateSequence;
  if (!bounds) {
    output.textContent = "Select a valid bounding box to estimate its offline package.";
    output.dataset.state = "empty";
    return;
  }
  const maxZoom = Number(requiredElement<HTMLSelectElement>("#study-area-max-zoom").value);
  const estimate = estimateOfflineMapPackage(bounds, 0, maxZoom, provider);
  const packageLimitBytes = PACKAGE_LIMIT_MIB * MEBIBYTE;
  output.textContent = "Checking browser storage...";
  output.dataset.state = "pending";
  let availableBytes: number | null = null;
  try {
    const storage = await navigator.storage?.estimate?.();
    if (Number.isFinite(storage?.quota) && Number.isFinite(storage?.usage)) {
      availableBytes = Math.max(0, storage!.quota! - storage!.usage!);
    }
  } catch {
    // Storage estimates are optional and may be withheld by browser policy.
  }
  if (sequence !== storageEstimateSequence) return;
  const fitsPackageLimit = estimate.estimatedBytes <= packageLimitBytes;
  const fitsBrowserEstimate = availableBytes === null || estimate.estimatedBytes <= availableBytes;
  const quotaText = availableBytes === null
    ? "Browser quota is unavailable; preflight is incomplete."
    : `Browser reports approximately ${formatBytes(availableBytes)} available.`;
  const sizeText = `${estimate.tileCount.toLocaleString()} tiles; estimated ${formatBytes(estimate.estimatedBytes)} using ${formatBytes(estimate.averageTileBytes)} per tile.`;
  const limitText = fitsPackageLimit
    ? `Within the ${PACKAGE_LIMIT_MIB} MiB project limit.`
    : `Exceeds the ${PACKAGE_LIMIT_MIB} MiB project limit; reduce the area or maximum zoom.`;
  output.textContent = `${sizeText} ${limitText} ${quotaText}`;
  output.dataset.state = fitsPackageLimit && fitsBrowserEstimate ? "estimated" : "blocked";
}

function renderSummary(bounds: StudyAreaBounds | null, updateZoom: boolean): void {
  const apply = requiredElement<HTMLButtonElement>("#study-area-apply");
  if (!bounds) {
    requiredElement<HTMLElement>("#study-area-summary").textContent = "No valid study-area bounding box selected.";
    apply.disabled = true;
    if (rectangle) { rectangle.remove(); rectangle = null; }
    void renderPackageEstimate(null);
    return;
  }
  const measurement = dimensions(bounds);
  const recommended = recommendedMaximumZoom(measurement.longestKm);
  const zoom = requiredElement<HTMLSelectElement>("#study-area-max-zoom");
  if (updateZoom) zoom.value = String(recommended);
  requiredElement<HTMLElement>("#study-area-summary").textContent =
    `${measurement.widthKm.toFixed(1)} km wide × ${measurement.heightKm.toFixed(1)} km high · ${measurement.areaKm2.toFixed(0)} km² · recommended offline range 0–${recommended}.`;
  apply.disabled = false;
  void renderPackageEstimate(bounds);
  if (map) {
    const leafletBounds = [[bounds[1], bounds[0]], [bounds[3], bounds[2]]];
    if (rectangle) rectangle.setBounds(leafletBounds);
    else rectangle = L.rectangle(leafletBounds, { color: "#d92d20", weight: 3, fillColor: "#f97316", fillOpacity: 0.14 }).addTo(map);
  }
}

function boundsFromCorners(first: LeafletHandle, second: LeafletHandle): StudyAreaBounds {
  return [
    Math.min(first.lng, second.lng),
    Math.min(first.lat, second.lat),
    Math.max(first.lng, second.lng),
    Math.max(first.lat, second.lat),
  ];
}

function ensureMap(): LeafletHandle {
  if (map) return map;
  if (!L) throw new Error("The map library could not be loaded.");
  map = L.map("project-study-area-map", { zoomControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  map.on("click", (event: { latlng: LeafletHandle }) => {
    if (requiredElement<HTMLButtonElement>("#study-area-draw").dataset.drawing !== "true") return;
    if (!firstCorner) {
      firstCorner = event.latlng;
      requiredElement<HTMLElement>("#study-area-draw-status").textContent = "First corner selected. Select the opposite corner.";
      return;
    }
    const bounds = boundsFromCorners(firstCorner, event.latlng);
    firstCorner = null;
    currentSource = "drawn-bounds";
    if (validatedPmtiles) invalidatePmtiles("Study-area bounds changed. Validate the selected archive again.");
    writeBounds(bounds);
    const displayedBounds = inputBounds();
    renderSummary(displayedBounds, true);
    requiredElement<HTMLButtonElement>("#study-area-draw").dataset.drawing = "false";
    requiredElement<HTMLButtonElement>("#study-area-draw").textContent = "Draw Bounding Box";
    requiredElement<HTMLElement>("#study-area-draw-status").textContent = displayedBounds
      ? "Bounding box drawn. Adjust its coordinates or draw again."
      : "The two corners were too close after five-decimal rounding. Draw a larger bounding box.";
  });
  return map;
}

function studyAreaFromForm(asset?: OfflineMapAsset): ProjectStudyArea | null {
  const bounds = inputBounds();
  if (!bounds) return null;
  const [west, south, east, north] = bounds;
  const provider = offlineMapProvider(requiredElement<HTMLSelectElement>("#study-area-provider").value);
  const maxZoom = Number(requiredElement<HTMLSelectElement>("#study-area-max-zoom").value);
  const estimate = estimateOfflineMapPackage(bounds, 0, maxZoom, provider);
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `study-area-${Date.now()}`,
    name: requiredElement<HTMLInputElement>("#study-area-name").value.trim() || "Primary study area",
    source: currentSource,
    geometry: {
      type: "Polygon",
      coordinates: [[
        [west, south], [east, south], [east, north], [west, north], [west, south],
      ]],
    },
    bounds,
    bufferKm: 0,
    offlineMap: {
      minZoom: 0,
      maxZoom,
      packageLimitMiB: PACKAGE_LIMIT_MIB,
      status: asset ? "stored-unverified" : "not-downloaded",
      providerId: provider.id,
      estimate,
      ...(asset ? { asset } : {}),
    },
  };
}

export function openStudyAreaPicker(projectName: string, onApply: (studyArea: ProjectStudyArea | null) => void): void {
  pendingApply = onApply;
  firstCorner = null;
  currentSource = "manual-bounds";
  requiredElement<HTMLInputElement>("#study-area-name").value = `${projectName || "Project"} study area`;
  for (const id of ["#study-area-west", "#study-area-south", "#study-area-east", "#study-area-north"]) coordinateInput(id).value = "";
  requiredElement<HTMLSelectElement>("#study-area-max-zoom").value = "15";
  requiredElement<HTMLSelectElement>("#study-area-provider").value = "osm-standard";
  selectedPmtilesFile = null;
  validatedPmtiles = null;
  requiredElement<HTMLInputElement>("#study-area-pmtiles-file").value = "";
  requiredElement<HTMLInputElement>("#study-area-pmtiles-attribution").value = "";
  requiredElement<HTMLInputElement>("#study-area-pmtiles-license").value = "";
  invalidatePmtiles();
  renderPmtilesControls();
  requiredElement<HTMLButtonElement>("#study-area-draw").dataset.drawing = "false";
  requiredElement<HTMLButtonElement>("#study-area-draw").textContent = "Draw Bounding Box";
  requiredElement<HTMLElement>("#study-area-draw-status").textContent = "Draw a box or enter its signed decimal-degree bounds.";
  renderSummary(null, false);
  requiredElement<HTMLDialogElement>("#study-area-dialog").showModal();
  globalThis.requestAnimationFrame(() => {
    const currentMap = ensureMap();
    currentMap.invalidateSize();
    currentMap.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  });
}

export function initializeStudyAreaPicker(): void {
  const dialog = requiredElement<HTMLDialogElement>("#study-area-dialog");
  const cancelPicker = (): void => {
    if (dialog.open) dialog.close("cancel");
    pendingApply?.(null);
    pendingApply = null;
  };
  requiredElement<HTMLButtonElement>("#study-area-draw").addEventListener("click", (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const drawing = button.dataset.drawing !== "true";
    button.dataset.drawing = String(drawing);
    button.textContent = drawing ? "Cancel Drawing" : "Draw Bounding Box";
    firstCorner = null;
    requiredElement<HTMLElement>("#study-area-draw-status").textContent = drawing
      ? "Select the first corner of the study area."
      : "Drawing cancelled. Existing bounds were not changed.";
  });
  for (const id of ["#study-area-west", "#study-area-south", "#study-area-east", "#study-area-north"]) {
    coordinateInput(id).addEventListener("input", () => {
      currentSource = "manual-bounds";
      if (validatedPmtiles) invalidatePmtiles("Study-area bounds changed. Validate the selected archive again.");
      renderSummary(inputBounds(), true);
    });
  }
  requiredElement<HTMLSelectElement>("#study-area-max-zoom").addEventListener("change", () => {
    if (validatedPmtiles) invalidatePmtiles("The planned zoom range changed. Validate the selected archive again.");
    void renderPackageEstimate(inputBounds());
  });
  requiredElement<HTMLSelectElement>("#study-area-provider").addEventListener("change", () => {
    if (!pmtilesSelected()) validatedPmtiles = null;
    renderPmtilesControls();
    void renderPackageEstimate(inputBounds());
  });
  requiredElement<HTMLInputElement>("#study-area-pmtiles-file").addEventListener("change", (event) => {
    selectedPmtilesFile = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
    invalidatePmtiles(selectedPmtilesFile
      ? `${selectedPmtilesFile.name} selected (${formatBytes(selectedPmtilesFile.size)}). Validate before applying.`
      : "No PMTiles archive selected.");
  });
  for (const id of ["#study-area-pmtiles-attribution", "#study-area-pmtiles-license"]) {
    requiredElement<HTMLInputElement>(id).addEventListener("input", () => {
      if (validatedPmtiles) invalidatePmtiles("Archive metadata changed. Validate the selected archive again.");
    });
  }
  const validatePmtilesButton = requiredElement<HTMLButtonElement>("#study-area-pmtiles-validate");
  validatePmtilesButton.addEventListener("click", async () => {
    const bounds = inputBounds();
    if (!bounds) {
      invalidatePmtiles("Select a valid study-area bounding box first.");
      return;
    }
    if (!selectedPmtilesFile) {
      invalidatePmtiles("Choose a .pmtiles archive first.");
      return;
    }
    validatePmtilesButton.disabled = true;
    const status = requiredElement<HTMLElement>("#study-area-pmtiles-status");
    status.textContent = "Validating header, coverage, metadata, and SHA-256...";
    status.dataset.state = "pending";
    try {
      validatedPmtiles = await validatePmtilesImport(
        selectedPmtilesFile,
        bounds,
        0,
        Number(requiredElement<HTMLSelectElement>("#study-area-max-zoom").value),
        PACKAGE_LIMIT_MIB * MEBIBYTE,
        requiredElement<HTMLInputElement>("#study-area-pmtiles-attribution").value,
        requiredElement<HTMLInputElement>("#study-area-pmtiles-license").value,
      );
      requiredElement<HTMLInputElement>("#study-area-pmtiles-attribution").value = validatedPmtiles.attribution;
      requiredElement<HTMLInputElement>("#study-area-pmtiles-license").value = validatedPmtiles.license;
      status.textContent = `Validated PMTiles v3 ${validatedPmtiles.header.tileType} archive; zoom ${validatedPmtiles.header.minZoom}-${validatedPmtiles.header.maxZoom}; SHA-256 ${validatedPmtiles.sha256.slice(0, 16)}... Storage waits for Apply Study Area.`;
      status.dataset.state = "valid";
    } catch (error) {
      validatedPmtiles = null;
      status.textContent = error instanceof Error ? error.message : "Unable to validate the PMTiles archive.";
      status.dataset.state = "error";
    } finally {
      validatePmtilesButton.disabled = false;
    }
  });
  requiredElement<HTMLButtonElement>("#study-area-clear").addEventListener("click", () => {
    for (const id of ["#study-area-west", "#study-area-south", "#study-area-east", "#study-area-north"]) coordinateInput(id).value = "";
    renderSummary(null, false);
    if (validatedPmtiles) invalidatePmtiles("Study area cleared. Validate the selected archive again after defining new bounds.");
    requiredElement<HTMLElement>("#study-area-draw-status").textContent = "Study area cleared.";
  });
  const applyButton = requiredElement<HTMLButtonElement>("#study-area-apply");
  applyButton.addEventListener("click", async () => {
    applyButton.disabled = true;
    let asset: OfflineMapAsset | undefined;
    try {
      if (pmtilesSelected() && validatedPmtiles) {
        const status = requiredElement<HTMLElement>("#study-area-pmtiles-status");
        status.textContent = "Writing the validated archive to browser OPFS...";
        status.dataset.state = "pending";
        asset = await persistPmtilesImport(validatedPmtiles);
        status.textContent = asset.persistence === "persistent"
          ? "Archive stored in persistent browser storage."
          : "Archive stored in best-effort browser storage; explicit project backup remains required.";
        status.dataset.state = "valid";
      }
      const studyArea = studyAreaFromForm(asset);
      if (!studyArea) return;
      dialog.close("apply");
      pendingApply?.(studyArea);
      pendingApply = null;
    } catch (error) {
      const status = requiredElement<HTMLElement>("#study-area-pmtiles-status");
      status.textContent = error instanceof Error ? error.message : "Unable to store the PMTiles archive.";
      status.dataset.state = "error";
    } finally {
      if (dialog.open) applyButton.disabled = inputBounds() === null;
    }
  });
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-close-study-area]")) {
    button.addEventListener("click", cancelPicker);
  }
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    cancelPicker();
  });
}
