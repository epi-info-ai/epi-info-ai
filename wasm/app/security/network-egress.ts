import {
  DATA_PRIVACY_CLASSIFICATIONS,
  type DataPrivacyClassificationV01,
} from "./privacy.ts";

export type NetworkConsentV01 = "none-local-resource" | "explicit-user-action" | "configured-connection";
export type NetworkOfflineBehaviorV01 = "unavailable-offline" | "cached-after-verification" | "local-only";

export interface NetworkEgressRouteV01 {
  id: string;
  transport: "fetch" | "browser-resource" | "webrtc";
  purpose: string;
  provider: string;
  dataClassifications: readonly DataPrivacyClassificationV01[];
  consent: NetworkConsentV01;
  offlineBehavior: NetworkOfflineBehaviorV01;
  destinations: readonly string[];
}

export interface NetworkEgressAuthorizationV01 {
  routeId: string;
  provider: string;
  destinationOrigin: string;
  dataClassification: DataPrivacyClassificationV01;
  consent: NetworkConsentV01;
  offlineBehavior: NetworkOfflineBehaviorV01;
}

export class NetworkEgressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkEgressError";
  }
}

export const NETWORK_EGRESS_ROUTES_V01 = [
  { id: "app.same-origin-resource", transport: "fetch", purpose: "Load versioned application, runtime, fixture, or help assets.", provider: "Epi Info AI deployment origin", dataClassifications: ["public"], consent: "none-local-resource", offlineBehavior: "cached-after-verification", destinations: ["self"] },
  { id: "maps.openstreetmap-tiles", transport: "browser-resource", purpose: "Render an explicitly selected online street basemap; the viewed extent is disclosed to the tile provider.", provider: "OpenStreetMap tile service", dataClassifications: ["restricted-identifiable", "public-synthetic"], consent: "explicit-user-action", offlineBehavior: "unavailable-offline", destinations: ["https://tile.openstreetmap.org"] },
  { id: "geocoder.nominatim", transport: "fetch", purpose: "Submit the entered address for user-requested coordinate candidates.", provider: "OpenStreetMap Nominatim", dataClassifications: ["restricted-identifiable", "public-synthetic"], consent: "explicit-user-action", offlineBehavior: "unavailable-offline", destinations: ["https://nominatim.openstreetmap.org"] },
  { id: "projects.teaching-repository", transport: "fetch", purpose: "Preview and install immutable checksummed teaching artifacts.", provider: "Approved GitLab/GitHub teaching repository", dataClassifications: ["public-synthetic", "public"], consent: "explicit-user-action", offlineBehavior: "cached-after-verification", destinations: ["self", "https://git.cdc.gov", "https://raw.githubusercontent.com"] },
  { id: "projects.example-repository", transport: "fetch", purpose: "Preview and import checksummed example project packages.", provider: "Approved GitLab/GitHub example repository", dataClassifications: ["public-synthetic", "public"], consent: "explicit-user-action", offlineBehavior: "cached-after-verification", destinations: ["self", "https://git.cdc.gov", "https://raw.githubusercontent.com"] },
  { id: "packages.capability-repository", transport: "fetch", purpose: "Preview and install inert allowlisted capability-package artifacts.", provider: "Approved GitLab/GitHub capability repository", dataClassifications: ["public-synthetic", "public"], consent: "explicit-user-action", offlineBehavior: "cached-after-verification", destinations: ["self", "https://git.cdc.gov", "https://raw.githubusercontent.com"] },
  { id: "sync.supabase", transport: "fetch", purpose: "Authenticate and explicitly synchronize the active project with its configured Supabase origin.", provider: "User-configured Supabase project", dataClassifications: ["restricted-identifiable", "restricted-deidentified", "aggregate", "public-synthetic"], consent: "configured-connection", offlineBehavior: "unavailable-offline", destinations: ["configured-origin"] },
  { id: "assistant.same-origin-gateway", transport: "fetch", purpose: "Send a reviewed prompt and minimized project context to the configured same-origin Epi Assist gateway.", provider: "Epi Info AI managed gateway", dataClassifications: ["aggregate", "public-synthetic"], consent: "explicit-user-action", offlineBehavior: "unavailable-offline", destinations: ["self"] },
  { id: "share.encrypted-webrtc", transport: "webrtc", purpose: "Transfer an already encrypted project package after manual peer verification.", provider: "Browser WebRTC peer connection", dataClassifications: ["restricted-identifiable", "restricted-deidentified", "aggregate", "public-synthetic", "public"], consent: "explicit-user-action", offlineBehavior: "local-only", destinations: ["manual-peer"] },
] as const satisfies readonly NetworkEgressRouteV01[];

export type NetworkEgressRouteIdV01 = typeof NETWORK_EGRESS_ROUTES_V01[number]["id"];

function routeById(routeId: string): NetworkEgressRouteV01 {
  const route = NETWORK_EGRESS_ROUTES_V01.find((candidate) => candidate.id === routeId);
  if (!route) throw new NetworkEgressError(`Network route ${JSON.stringify(routeId)} is not registered.`);
  return route;
}

function allowedDestination(route: NetworkEgressRouteV01, destination: URL, applicationOrigin: string, configuredOrigin?: string): boolean {
  const localDevelopment = destination.protocol === "http:" && (destination.hostname === "localhost" || destination.hostname === "127.0.0.1");
  if (destination.protocol !== "https:" && destination.origin !== applicationOrigin && !localDevelopment) return false;
  return route.destinations.some((allowed) => {
    if (allowed === "self") return destination.origin === applicationOrigin;
    if (allowed === "configured-origin") return configuredOrigin !== undefined && destination.origin === new URL(configuredOrigin).origin;
    if (allowed === "manual-peer") return false;
    return destination.origin === allowed;
  });
}

export function authorizeNetworkEgressV01(
  routeId: NetworkEgressRouteIdV01,
  destination: URL | string,
  options: {
    dataClassification: DataPrivacyClassificationV01;
    consentGranted: boolean;
    applicationOrigin?: string;
    configuredOrigin?: string;
  },
): NetworkEgressAuthorizationV01 {
  const route = routeById(routeId);
  if (route.transport === "webrtc") throw new NetworkEgressError("WebRTC routes require peer authorization, not a URL destination.");
  if (!DATA_PRIVACY_CLASSIFICATIONS.includes(options.dataClassification)) throw new NetworkEgressError("Network request data classification is not supported.");
  if (!route.dataClassifications.includes(options.dataClassification as never)) throw new NetworkEgressError(`Network route ${route.id} does not allow ${options.dataClassification} data.`);
  if (route.consent !== "none-local-resource" && options.consentGranted !== true) throw new NetworkEgressError(`Network route ${route.id} requires explicit consent or a configured connection.`);
  const rawDestination = String(destination);
  const runtimeOrigin = options.applicationOrigin ?? globalThis.location?.origin;
  let url: URL;
  try { url = new URL(rawDestination); }
  catch {
    if (!runtimeOrigin) throw new NetworkEgressError("The application origin is required to authorize a relative network destination.");
    url = new URL(rawDestination, runtimeOrigin);
  }
  const applicationOrigin = runtimeOrigin ?? url.origin;
  if (!allowedDestination(route, url, applicationOrigin, options.configuredOrigin)) throw new NetworkEgressError(`Destination origin ${url.origin} is not allowed for network route ${route.id}.`);
  return { routeId: route.id, provider: route.provider, destinationOrigin: url.origin, dataClassification: options.dataClassification, consent: route.consent, offlineBehavior: route.offlineBehavior };
}

export function authorizePeerEgressV01(routeId: "share.encrypted-webrtc", options: { dataClassification: DataPrivacyClassificationV01; consentGranted: boolean }): NetworkEgressAuthorizationV01 {
  const route = routeById(routeId);
  if (route.transport !== "webrtc" || !route.dataClassifications.includes(options.dataClassification as never)) throw new NetworkEgressError("The peer route does not allow this data classification.");
  if (!options.consentGranted) throw new NetworkEgressError("Encrypted peer transfer requires explicit consent.");
  return { routeId: route.id, provider: route.provider, destinationOrigin: "manual-peer", dataClassification: options.dataClassification, consent: route.consent, offlineBehavior: route.offlineBehavior };
}
