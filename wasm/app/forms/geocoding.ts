export const DEFAULT_GEOCODER_ENDPOINT = "https://nominatim.openstreetmap.org/search";

export interface GeocodeCandidate {
  formattedAddress: string;
  confidence: "High" | "Medium" | "Low";
  quality: string;
  latitude: number;
  longitude: number;
  provider: "OpenStreetMap Nominatim";
}

export interface GeocodeOptions {
  endpoint?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

function candidateAt(value: unknown, index: number): GeocodeCandidate {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Geocoding result ${index + 1} is malformed.`);
  }
  const source = value as Record<string, unknown>;
  const latitude = Number(source.lat);
  const longitude = Number(source.lon);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error(`Geocoding result ${index + 1} contains invalid coordinates.`);
  }
  if (typeof source.display_name !== "string" || source.display_name.trim() === "") {
    throw new Error(`Geocoding result ${index + 1} has no formatted address.`);
  }
  const importance = Number(source.importance);
  const confidence = importance >= 0.7 ? "High" : importance >= 0.4 ? "Medium" : "Low";
  const category = typeof source.category === "string" ? source.category : "location";
  const type = typeof source.type === "string" ? source.type : "match";
  return {
    formattedAddress: source.display_name.trim(),
    confidence,
    quality: `${category}: ${type}`,
    latitude,
    longitude,
    provider: "OpenStreetMap Nominatim",
  };
}

export async function geocodeAddress(address: string, options: GeocodeOptions = {}): Promise<GeocodeCandidate[]> {
  const query = address.trim();
  if (query.length < 3) throw new Error("Enter an address before selecting Get Coordinates.");
  if (query.length > 256) throw new Error("The address must be 256 characters or fewer.");
  const endpoint = new URL(options.endpoint ?? DEFAULT_GEOCODER_ENDPOINT);
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("addressdetails", "1");
  endpoint.searchParams.set("limit", "7");
  endpoint.searchParams.set("q", query);
  const response = await (options.fetchImpl ?? fetch)(endpoint, {
    headers: { Accept: "application/json" },
    referrerPolicy: "strict-origin-when-cross-origin",
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (!response.ok) throw new Error(`The geocoding service returned HTTP ${response.status}.`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("The geocoding service returned an unexpected response.");
  return payload.map(candidateAt);
}
