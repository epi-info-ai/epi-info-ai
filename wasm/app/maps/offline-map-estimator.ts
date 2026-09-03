import type { OfflineMapEstimate, StudyAreaBounds } from "../contracts/core.ts";

export type OfflineMapProviderId = "osm-standard" | "browser-pmtiles" | "approved-xyz";

export interface OfflineMapProviderProfile {
  id: OfflineMapProviderId;
  label: string;
  averageTileBytes: number;
  downloadPolicy: "preview-only" | "configuration-required";
  policySummary: string;
}

export const OFFLINE_MAP_PROVIDERS: readonly OfflineMapProviderProfile[] = [
  {
    id: "osm-standard",
    label: "OpenStreetMap Standard (preview only)",
    averageTileBytes: 35 * 1024,
    downloadPolicy: "preview-only",
    policySummary: "Interactive preview is available, but the public Standard tile service does not permit offline prefetch or bulk download.",
  },
  {
    id: "browser-pmtiles",
    label: "Browser-local PMTiles package (preferred)",
    averageTileBytes: 25 * 1024,
    downloadPolicy: "configuration-required",
    policySummary: "Preferred browser-offline path. Import or retrieve one reviewed regional archive, validate its license, attribution, bounds, zooms, version, and integrity hash, then store it in browser OPFS.",
  },
  {
    id: "approved-xyz",
    label: "Organization-approved/self-hosted XYZ (configuration required)",
    averageTileBytes: 50 * 1024,
    downloadPolicy: "configuration-required",
    policySummary: "Estimate only. An approved endpoint, terms, attribution, authentication, and cache policy must be configured before download.",
  },
] as const;

const WEB_MERCATOR_LATITUDE_LIMIT = 85.05112878;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function longitudeTileCoordinate(longitude: number, zoom: number): number {
  return ((longitude + 180) / 360) * (2 ** zoom);
}

function latitudeTileCoordinate(latitude: number, zoom: number): number {
  const clamped = clamp(latitude, -WEB_MERCATOR_LATITUDE_LIMIT, WEB_MERCATOR_LATITUDE_LIMIT);
  const radians = clamped * Math.PI / 180;
  return (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * (2 ** zoom);
}

function coveredTileSpan(minimum: number, maximum: number, zoom: number): number {
  const lastTile = (2 ** zoom) - 1;
  const first = clamp(Math.floor(minimum), 0, lastTile);
  const last = clamp(Math.ceil(maximum) - 1, 0, lastTile);
  return Math.max(0, last - first + 1);
}

export function tileCountForBounds(bounds: StudyAreaBounds, zoom: number): number {
  if (!Number.isSafeInteger(zoom) || zoom < 0 || zoom > 22) throw new Error("Zoom must be an integer from 0 through 22.");
  const [west, south, east, north] = bounds;
  if (![west, south, east, north].every(Number.isFinite)
    || west < -180 || east > 180 || south < -90 || north > 90
    || west >= east || south >= north) {
    throw new Error("Bounds must contain ordered finite WGS 84 west, south, east, and north coordinates.");
  }
  const width = coveredTileSpan(longitudeTileCoordinate(west, zoom), longitudeTileCoordinate(east, zoom), zoom);
  const height = coveredTileSpan(latitudeTileCoordinate(north, zoom), latitudeTileCoordinate(south, zoom), zoom);
  return width * height;
}

export function estimateOfflineMapPackage(
  bounds: StudyAreaBounds,
  minZoom: number,
  maxZoom: number,
  provider: OfflineMapProviderProfile,
): OfflineMapEstimate {
  if (!Number.isSafeInteger(minZoom) || !Number.isSafeInteger(maxZoom) || minZoom < 0 || maxZoom > 22 || minZoom > maxZoom) {
    throw new Error("Offline zoom range must be ordered within 0 through 22.");
  }
  let tileCount = 0;
  for (let zoom = minZoom; zoom <= maxZoom; zoom += 1) tileCount += tileCountForBounds(bounds, zoom);
  const estimatedBytes = tileCount * provider.averageTileBytes;
  if (!Number.isSafeInteger(tileCount) || !Number.isSafeInteger(estimatedBytes)) throw new Error("The estimated package is too large to represent safely.");
  return {
    estimatorVersion: "web-mercator-v1",
    tileCount,
    averageTileBytes: provider.averageTileBytes,
    estimatedBytes,
  };
}

export function offlineMapProvider(providerId: string): OfflineMapProviderProfile {
  return OFFLINE_MAP_PROVIDERS.find((provider) => provider.id === providerId) ?? OFFLINE_MAP_PROVIDERS[0]!;
}
