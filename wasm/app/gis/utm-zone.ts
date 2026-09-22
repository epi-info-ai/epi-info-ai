/** WGS84 UTM zone identification only; this does not reproject coordinates. */

export interface Wgs84UtmZoneV01 {
  zone: number;
  hemisphere: "north" | "south";
  epsg: number;
  code: `EPSG:${number}`;
  centralMeridian: number;
}

export interface Wgs84UtmZoneSetV01 {
  zones: readonly Wgs84UtmZoneV01[];
  singleZone: Wgs84UtmZoneV01 | null;
}

function assertWgs84DecimalDegrees(latitude: number, longitude: number): void {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new RangeError("WGS84 latitude and longitude must be finite decimal-degree numbers.");
  if (latitude < -80 || latitude > 84) throw new RangeError("UTM is defined from 80°S through 84°N; polar coordinates require a polar CRS.");
  if (longitude < -180 || longitude > 180) throw new RangeError("WGS84 longitude must be between -180 and 180 degrees.");
}

function zoneNumber(latitude: number, longitude: number): number {
  let zone = Math.min(60, Math.floor((longitude + 180) / 6) + 1);
  // UTM's standard exceptions for Norway and Svalbard.
  if (latitude >= 56 && latitude < 64 && longitude >= 3 && longitude < 12) zone = 32;
  if (latitude >= 72 && latitude < 84) {
    if (longitude >= 0 && longitude < 9) zone = 31;
    else if (longitude >= 9 && longitude < 21) zone = 33;
    else if (longitude >= 21 && longitude < 33) zone = 35;
    else if (longitude >= 33 && longitude <= 42) zone = 37;
  }
  return zone;
}

export function findWgs84UtmZone(latitude: number, longitude: number): Wgs84UtmZoneV01 {
  assertWgs84DecimalDegrees(latitude, longitude);
  const zone = zoneNumber(latitude, longitude);
  const hemisphere = latitude >= 0 ? "north" : "south";
  const epsg = (hemisphere === "north" ? 32600 : 32700) + zone;
  return { zone, hemisphere, epsg, code: `EPSG:${epsg}`, centralMeridian: zone * 6 - 183 };
}

export function findWgs84UtmZones(points: readonly (readonly [number, number])[]): Wgs84UtmZoneSetV01 {
  if (!points.length) throw new RangeError("At least one [longitude, latitude] WGS84 point is required.");
  const zones = new Map<string, Wgs84UtmZoneV01>();
  for (const [longitude, latitude] of points) {
    const zone = findWgs84UtmZone(latitude, longitude);
    zones.set(zone.code, zone);
  }
  const values = [...zones.values()].sort((a, b) => a.epsg - b.epsg);
  return { zones: values, singleZone: values.length === 1 ? values[0]! : null };
}
