export const CHECK_CODE_LAST_POSITION_KEY = "epi-info-ai.last-device-position.v1";

export interface CheckCodePositionReading {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number;
  altitudeAccuracy: number | null;
  acquiredAt: string;
  source: "browser-geolocation";
}

function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }

export function validateCheckCodePosition(value: unknown): CheckCodePositionReading | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<CheckCodePositionReading>;
  if (!finite(item.latitude) || item.latitude < -90 || item.latitude > 90
    || !finite(item.longitude) || item.longitude < -180 || item.longitude > 180
    || !finite(item.accuracy) || item.accuracy < 0
    || item.altitude !== null && !finite(item.altitude)
    || item.altitudeAccuracy !== null && (!finite(item.altitudeAccuracy) || item.altitudeAccuracy < 0)
    || typeof item.acquiredAt !== "string" || Number.isNaN(Date.parse(item.acquiredAt))
    || item.source !== "browser-geolocation") return null;
  return {
    latitude: item.latitude,
    longitude: item.longitude,
    altitude: item.altitude,
    accuracy: item.accuracy,
    altitudeAccuracy: item.altitudeAccuracy,
    acquiredAt: new Date(item.acquiredAt).toISOString(),
    source: item.source,
  };
}

export function readLastCheckCodePosition(storage: Storage = sessionStorage): CheckCodePositionReading | null {
  try { return validateCheckCodePosition(JSON.parse(storage.getItem(CHECK_CODE_LAST_POSITION_KEY) ?? "null")); }
  catch { return null; }
}

export function writeLastCheckCodePosition(position: GeolocationPosition, storage: Storage = sessionStorage): CheckCodePositionReading {
  const reading = validateCheckCodePosition({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    altitude: position.coords.altitude,
    accuracy: position.coords.accuracy,
    altitudeAccuracy: position.coords.altitudeAccuracy,
    acquiredAt: new Date(position.timestamp).toISOString(),
    source: "browser-geolocation",
  });
  if (!reading) throw new RangeError("The browser returned an invalid geolocation reading.");
  storage.setItem(CHECK_CODE_LAST_POSITION_KEY, JSON.stringify(reading));
  return reading;
}
