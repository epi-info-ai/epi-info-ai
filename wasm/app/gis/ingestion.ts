import type { GisDatasetInspectResultV01, GisPlanV01 } from "./contracts.ts";

const supportedMediaTypes = new Set(["application/geo+json", "application/json"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGeographicCrs(value: string | "unknown"): boolean {
  const normalized = value.toUpperCase().replaceAll(" ", "");
  return normalized === "EPSG:4326" || normalized === "CRS84" || normalized === "OGC:CRS84";
}

function embeddedCrsName(root: Record<string, unknown>): string | undefined {
  if (!isObject(root.crs) || !isObject(root.crs.properties) || typeof root.crs.properties.name !== "string") return undefined;
  return root.crs.properties.name;
}

function isWgs84CrsName(value: string): boolean {
  const normalized = value.toUpperCase().replaceAll(" ", "");
  return normalized === "CRS84" || normalized === "OGC:CRS84" || normalized === "EPSG:4326" || normalized.endsWith(":4326");
}

/** Defensive, engine-free preflight for the first supported vector format. */
export function inspectGeoJsonInputV01(bytes: ArrayBuffer, plan: GisPlanV01): GisDatasetInspectResultV01 {
  const input = plan.inputs[0];
  if (!input) throw new RangeError("The inspect operation requires one input asset.");
  if (!supportedMediaTypes.has(input.mediaType.toLowerCase())) throw new TypeError(`Media type ${input.mediaType} is not allowed by GIS-K03; only GeoJSON is supported.`);
  if (!isGeographicCrs(input.declaredCrs)) throw new RangeError("GIS-K03 accepts only explicitly declared WGS84 geographic coordinates (CRS84 or EPSG:4326); unknown and projected CRS values are rejected.");
  if (bytes.byteLength > plan.limits.maxInputBytes) throw new RangeError("Input exceeds the plan's maxInputBytes limit.");
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!isObject(parsed)) throw new TypeError("GIS-K02 inspect supports a GeoJSON object only.");
  const embeddedCrs = embeddedCrsName(parsed);
  if (embeddedCrs && !isWgs84CrsName(embeddedCrs)) throw new RangeError(`Embedded GeoJSON CRS ${embeddedCrs} conflicts with GIS-K03 WGS84-only coordinate policy.`);

  let propertyCount = 0;
  const scan = (value: unknown, depth: number): void => {
    if (depth > plan.limits.maxNestingDepth) throw new RangeError("JSON nesting exceeds the plan's maxNestingDepth limit.");
    if (Array.isArray(value)) {
      for (const child of value) scan(child, depth + 1);
      return;
    }
    if (!isObject(value)) return;
    propertyCount += Object.keys(value).length;
    if (propertyCount > plan.limits.maxProperties) throw new RangeError("JSON property count exceeds the plan's maxProperties limit.");
    for (const child of Object.values(value)) scan(child, depth + 1);
  };
  scan(parsed, 0);

  const root = parsed;
  const features: unknown[] = root.type === "FeatureCollection" && Array.isArray(root.features) ? root.features : root.type === "Feature" ? [root] : [];
  if (!features.length && root.type !== "FeatureCollection" && root.type !== "Feature") throw new TypeError("Input is not a GeoJSON Feature or FeatureCollection.");
  if (features.length > plan.limits.maxFeatures) throw new RangeError("Feature count exceeds the plan's maxFeatures limit.");
  const geometryTypes = new Set<string>();
  const fields = new Set<string>();
  let coordinateCount = 0;
  let extent: [number, number, number, number] | null = null;
  const visitCoordinates = (value: unknown): void => {
    if (!Array.isArray(value)) throw new TypeError("GeoJSON geometry coordinates must be an array.");
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      if (!Number.isFinite(value[0]) || !Number.isFinite(value[1])) throw new TypeError("GeoJSON contains a non-finite coordinate.");
      if (isGeographicCrs(input.declaredCrs) && (value[0] < -180 || value[0] > 180 || value[1] < -90 || value[1] > 90)) throw new RangeError("Geographic coordinate is outside the valid longitude/latitude range.");
      coordinateCount += 1;
      if (coordinateCount > plan.limits.maxCoordinates) throw new RangeError("Coordinate count exceeds the plan's maxCoordinates limit.");
      extent = extent ? [Math.min(extent[0], value[0]), Math.min(extent[1], value[1]), Math.max(extent[2], value[0]), Math.max(extent[3], value[1])] : [value[0], value[1], value[0], value[1]];
      return;
    }
    for (const child of value) visitCoordinates(child);
  };
  const visitGeometry = (geometry: Record<string, unknown>): void => {
    if (typeof geometry.type !== "string") throw new TypeError("GeoJSON geometry type is required.");
    geometryTypes.add(geometry.type);
    if (geometry.type === "GeometryCollection") {
      if (!Array.isArray(geometry.geometries)) throw new TypeError("GeoJSON GeometryCollection geometries must be an array.");
      for (const child of geometry.geometries) {
        if (!isObject(child)) throw new TypeError("GeoJSON GeometryCollection contains a non-object geometry.");
        visitGeometry(child);
      }
      return;
    }
    visitCoordinates(geometry.coordinates);
  };
  for (const feature of features) {
    if (!isObject(feature)) throw new TypeError("FeatureCollection contains a non-object feature.");
    const geometry = feature.geometry;
    if (geometry !== null && !isObject(geometry)) throw new TypeError("GeoJSON feature geometry must be an object or null.");
    if (geometry) {
      visitGeometry(geometry);
    }
    if (isObject(feature.properties)) for (const key of Object.keys(feature.properties)) fields.add(key);
  }
  const declaredCrs = root.crs && isObject(root.crs) ? JSON.stringify(root.crs) : "unknown";
  return { format: "GeoJSON", layerCount: 1, featureCount: features.length, geometryTypes: [...geometryTypes].sort(), fields: [...fields].sort(), declaredCrs, extent, estimatedWork: { features: features.length, coordinates: coordinateCount } };
}
