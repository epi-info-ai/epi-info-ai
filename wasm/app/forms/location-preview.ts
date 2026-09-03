import type { SafeGeocodeStatement } from "../contracts/check-code.js";

// Leaflet is a reviewed, pinned global script. Keep its untyped runtime surface
// confined to this browser adapter, as the main Maps module does.
type LeafletHandle = any;
const L: LeafletHandle = (globalThis as typeof globalThis & { L?: LeafletHandle }).L;

const DEFAULT_CENTER: [number, number] = [39.8283, -98.5795];
const DEFAULT_ZOOM = 4;
const POINT_ZOOM = 16;

let previewMap: LeafletHandle | null = null;
let previewMarker: LeafletHandle | null = null;
let activeStatement: SafeGeocodeStatement | null = null;

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required location preview element is missing: ${selector}`);
  return element;
}

function namedEntryControl(name: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null {
  const control = requiredElement<HTMLFormElement>("#record-form").elements.namedItem(name);
  return control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement
    ? control
    : null;
}

function validCoordinate(value: string, axis: "latitude" | "longitude"): number | null {
  if (value.trim() === "") return null;
  const coordinate = Number(value);
  const limit = axis === "latitude" ? 90 : 180;
  return Number.isFinite(coordinate) && Math.abs(coordinate) <= limit ? coordinate : null;
}

function currentCoordinates(statement: SafeGeocodeStatement): [number, number] | null {
  const latitude = validCoordinate(namedEntryControl(statement.latitudeField)?.value ?? "", "latitude");
  const longitude = validCoordinate(namedEntryControl(statement.longitudeField)?.value ?? "", "longitude");
  return latitude === null || longitude === null ? null : [latitude, longitude];
}

function renderCoordinateReadout(latitude: number | null, longitude: number | null): void {
  requiredElement<HTMLOutputElement>("#location-preview-latitude").value = latitude === null ? "Not set" : latitude.toFixed(7);
  requiredElement<HTMLOutputElement>("#location-preview-longitude").value = longitude === null ? "Not set" : longitude.toFixed(7);
}

function writeCoordinates(latitude: number, longitude: number): void {
  if (!activeStatement) return;
  const latitudeControl = namedEntryControl(activeStatement.latitudeField);
  const longitudeControl = namedEntryControl(activeStatement.longitudeField);
  if (!latitudeControl || !longitudeControl) throw new Error("The GEOCODE coordinate fields are unavailable.");
  latitudeControl.value = latitude.toFixed(7);
  longitudeControl.value = longitude.toFixed(7);
  latitudeControl.dispatchEvent(new Event("input", { bubbles: true }));
  longitudeControl.dispatchEvent(new Event("input", { bubbles: true }));
  renderCoordinateReadout(latitude, longitude);
  requiredElement<HTMLElement>("#location-preview-status").textContent =
    `Form coordinates updated: ${latitudeControl.value}, ${longitudeControl.value}. Save the record to retain them.`;
  requiredElement<HTMLElement>("#record-status").textContent =
    `Coordinates adjusted on the map: ${latitudeControl.value}, ${longitudeControl.value}. Save the record to retain them.`;
}

function positionMarker(latitude: number, longitude: number, writeToForm: boolean): void {
  if (!previewMap) return;
  if (!previewMarker) {
    previewMarker = L.marker([latitude, longitude], {
      draggable: true,
      keyboard: true,
      title: "Current record location. Drag to adjust.",
      alt: "Current record location",
      icon: L.divIcon({
        className: "location-preview-marker",
        html: '<span class="location-preview-pin" aria-hidden="true"><span></span></span>',
        iconSize: [34, 44],
        iconAnchor: [17, 42],
      }),
    }).addTo(previewMap);
    previewMarker.on("drag", (event: { target: LeafletHandle }) => {
      const position = event.target.getLatLng();
      writeCoordinates(position.lat, position.lng);
    });
  } else {
    previewMarker.setLatLng([latitude, longitude]);
  }
  if (writeToForm) writeCoordinates(latitude, longitude);
}

function ensurePreviewMap(): LeafletHandle {
  if (previewMap) return previewMap;
  if (!L) throw new Error("The map library could not be loaded.");
  previewMap = L.map("location-preview-map", { zoomControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(previewMap);
  previewMap.on("click", (event: { latlng: { lat: number; lng: number } }) => {
    positionMarker(event.latlng.lat, event.latlng.lng, true);
  });
  return previewMap;
}

export function openLocationPreview(statement: SafeGeocodeStatement): void {
  activeStatement = statement;
  const dialog = requiredElement<HTMLDialogElement>("#location-preview-dialog");
  const address = namedEntryControl(statement.addressField)?.value.trim() ?? "";
  requiredElement<HTMLElement>("#location-preview-address").textContent = address || "No address entered";
  const coordinates = currentCoordinates(statement);
  renderCoordinateReadout(coordinates?.[0] ?? null, coordinates?.[1] ?? null);
  requiredElement<HTMLElement>("#location-preview-status").textContent = coordinates
    ? "Showing the current form coordinates. Drag the point or click the map to refine the location."
    : "No valid coordinate pair is set. Use Get Coordinates, enter signed coordinates, or click the map to place the point.";
  dialog.showModal();
  globalThis.requestAnimationFrame(() => {
    const map = ensurePreviewMap();
    map.invalidateSize();
    if (coordinates) {
      positionMarker(coordinates[0], coordinates[1], false);
      map.setView(coordinates, POINT_ZOOM);
    } else {
      if (previewMarker) {
        previewMarker.remove();
        previewMarker = null;
      }
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
  });
}

export function initializeLocationPreview(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-close-location-preview]")) {
    button.addEventListener("click", () => requiredElement<HTMLDialogElement>("#location-preview-dialog").close());
  }
}
