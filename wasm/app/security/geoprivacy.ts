import {
  createPrivacyDisclosureReceiptV01,
  requirePrivacyForDisclosureV01,
  type GovernedDisclosureBoundaryV01,
  type PrivacyArtifactKindV01,
  type PrivacyClassificationV01,
  type PrivacyDisclosureReceiptV01,
} from "./privacy.ts";

export const GEOPRIVACY_DISPLAY_MODES_V01 = ["exact", "rounded", "administrative-area", "suppressed"] as const;
export type GeoprivacyDisplayModeV01 = typeof GEOPRIVACY_DISPLAY_MODES_V01[number];

export interface GeoprivacyPolicyV01 {
  schema: "epi-info-ai-geoprivacy/0.1";
  displayMode: GeoprivacyDisplayModeV01;
  roundingDecimals: number;
  minimumCellCount: number;
  administrativeAreaField: string;
}

export interface GeoprivacySourcePointV01 {
  latitude: number;
  longitude: number;
  administrativeArea?: string;
}

export interface GeoprivacyDerivedFeatureV01 {
  latitude: number | null;
  longitude: number | null;
  administrativeArea: string | null;
  count: number;
}

export interface GeoprivacyTransformationReceiptV01 {
  schema: "epi-info-ai-geoprivacy-receipt/0.1";
  disclosure: PrivacyDisclosureReceiptV01;
  method: GeoprivacyDisplayModeV01;
  roundingDecimals: number | null;
  minimumCellCount: number;
  inputPoints: number;
  releasedFeatures: number;
  releasedRecords: number;
  suppressedRecords: number;
  authoritativeCoordinatesChanged: false;
}

export interface GeoprivacyTransformationResultV01 {
  features: GeoprivacyDerivedFeatureV01[];
  receipt: GeoprivacyTransformationReceiptV01;
  warnings: string[];
}

export class GeoprivacyErrorV01 extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeoprivacyErrorV01";
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateGeoprivacyPolicyV01(value: unknown): GeoprivacyPolicyV01 {
  if (!object(value)) throw new GeoprivacyErrorV01("Geoprivacy policy must be an object.");
  const expected = ["administrativeAreaField", "displayMode", "minimumCellCount", "roundingDecimals", "schema"].sort();
  const keys = Object.keys(value).sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) throw new GeoprivacyErrorV01("Geoprivacy policy contains missing or unsupported fields.");
  if (value.schema !== "epi-info-ai-geoprivacy/0.1") throw new GeoprivacyErrorV01("Geoprivacy policy schema is not supported.");
  if (!GEOPRIVACY_DISPLAY_MODES_V01.includes(value.displayMode as GeoprivacyDisplayModeV01)) throw new GeoprivacyErrorV01("Geoprivacy display mode is not supported.");
  if (!Number.isInteger(value.roundingDecimals) || Number(value.roundingDecimals) < 0 || Number(value.roundingDecimals) > 4) throw new GeoprivacyErrorV01("Coordinate rounding must use 0 through 4 decimal places.");
  if (!Number.isSafeInteger(value.minimumCellCount) || Number(value.minimumCellCount) < 1 || Number(value.minimumCellCount) > 100) throw new GeoprivacyErrorV01("Minimum cell count must be between 1 and 100.");
  if (typeof value.administrativeAreaField !== "string" || value.administrativeAreaField.length > 128) throw new GeoprivacyErrorV01("Administrative-area field must be a string no longer than 128 characters.");
  if (value.displayMode === "administrative-area" && !value.administrativeAreaField.trim()) throw new GeoprivacyErrorV01("Administrative-area release requires an administrative-area field.");
  return value as unknown as GeoprivacyPolicyV01;
}

export function defaultGeoprivacyPolicyV01(privacy: PrivacyClassificationV01): GeoprivacyPolicyV01 {
  return privacy.geography === "precise-sensitive"
    ? { schema: "epi-info-ai-geoprivacy/0.1", displayMode: "rounded", roundingDecimals: 2, minimumCellCount: 5, administrativeAreaField: "" }
    : { schema: "epi-info-ai-geoprivacy/0.1", displayMode: "exact", roundingDecimals: 4, minimumCellCount: 1, administrativeAreaField: "" };
}

function coordinate(value: number, axis: "latitude" | "longitude"): number {
  if (!Number.isFinite(value)) throw new GeoprivacyErrorV01(`${axis} must be finite.`);
  const limit = axis === "latitude" ? 90 : 180;
  if (value < -limit || value > limit) throw new GeoprivacyErrorV01(`${axis} is outside the WGS 84 range.`);
  return Object.is(value, -0) ? 0 : value;
}

function rounded(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const result = Math.round((value + Number.EPSILON) * factor) / factor;
  return Object.is(result, -0) ? 0 : result;
}

export function transformGeographyV01(
  source: readonly GeoprivacySourcePointV01[],
  privacyValue: unknown,
  policyValue: unknown,
  boundary: GovernedDisclosureBoundaryV01 = "map-display",
  artifactKind: PrivacyArtifactKindV01 = "map-layer",
): GeoprivacyTransformationResultV01 {
  const privacy = requirePrivacyForDisclosureV01(privacyValue, boundary);
  const policy = validateGeoprivacyPolicyV01(policyValue);
  if (policy.displayMode === "exact" && privacy.geography === "precise-sensitive") {
    throw new GeoprivacyErrorV01("Precise-sensitive geography cannot be displayed or released as exact coordinates.");
  }
  const points = source.map((point) => ({
    latitude: coordinate(point.latitude, "latitude"),
    longitude: coordinate(point.longitude, "longitude"),
    administrativeArea: point.administrativeArea?.trim() ?? "",
  }));
  const grouped = new Map<string, GeoprivacyDerivedFeatureV01>();
  if (policy.displayMode === "exact" || policy.displayMode === "rounded") {
    for (const point of points) {
      const latitude = policy.displayMode === "rounded" ? rounded(point.latitude, policy.roundingDecimals) : point.latitude;
      const longitude = policy.displayMode === "rounded" ? rounded(point.longitude, policy.roundingDecimals) : point.longitude;
      const key = `${latitude.toFixed(policy.displayMode === "rounded" ? policy.roundingDecimals : 12)},${longitude.toFixed(policy.displayMode === "rounded" ? policy.roundingDecimals : 12)}`;
      const existing = grouped.get(key);
      if (existing) existing.count += 1;
      else grouped.set(key, { latitude, longitude, administrativeArea: null, count: 1 });
    }
  } else if (policy.displayMode === "administrative-area") {
    for (const point of points) {
      if (!point.administrativeArea) continue;
      const existing = grouped.get(point.administrativeArea);
      if (existing) existing.count += 1;
      else grouped.set(point.administrativeArea, { latitude: null, longitude: null, administrativeArea: point.administrativeArea, count: 1 });
    }
  }
  const candidateFeatures = [...grouped.values()];
  const features = candidateFeatures.filter((feature) => feature.count >= policy.minimumCellCount);
  const releasedRecords = features.reduce((sum, feature) => sum + feature.count, 0);
  const warnings: string[] = [];
  if (policy.displayMode === "exact") warnings.push("Exact coordinates are visible in this derived release.");
  if (policy.displayMode === "administrative-area") warnings.push("Administrative-area output requires an approved boundary join before map rendering.");
  if (releasedRecords < points.length) warnings.push(`${points.length - releasedRecords} record(s) were suppressed by the geography method or minimum-cell rule.`);
  return {
    features: features.map((feature) => ({ ...feature })),
    receipt: {
      schema: "epi-info-ai-geoprivacy-receipt/0.1",
      disclosure: createPrivacyDisclosureReceiptV01(privacy, artifactKind, boundary),
      method: policy.displayMode,
      roundingDecimals: policy.displayMode === "rounded" ? policy.roundingDecimals : null,
      minimumCellCount: policy.minimumCellCount,
      inputPoints: points.length,
      releasedFeatures: features.length,
      releasedRecords,
      suppressedRecords: points.length - releasedRecords,
      authoritativeCoordinatesChanged: false,
    },
    warnings,
  };
}
