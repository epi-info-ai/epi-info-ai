export const DATA_PRIVACY_CLASSIFICATIONS = [
  "restricted-identifiable",
  "restricted-deidentified",
  "aggregate",
  "public-synthetic",
  "public",
] as const;

export const GEOGRAPHY_PRIVACY_CLASSIFICATIONS = [
  "precise-sensitive",
  "generalized",
  "administrative-area",
  "public-synthetic",
  "none",
] as const;

export type DataPrivacyClassificationV01 = typeof DATA_PRIVACY_CLASSIFICATIONS[number];
export type GeographyPrivacyClassificationV01 = typeof GEOGRAPHY_PRIVACY_CLASSIFICATIONS[number];
export type GovernedDisclosureBoundaryV01 = "network-request" | "external-sync" | "download" | "map-display";
export type PrivacyArtifactKindV01 = "project" | "package" | "map-layer" | "output" | "receipt";

export interface PrivacyClassificationV01 {
  schema: "epi-info-ai-privacy/0.1";
  data: DataPrivacyClassificationV01;
  geography: GeographyPrivacyClassificationV01;
  containsRecordValues: boolean;
  purpose: string;
  approvedUses: GovernedDisclosureBoundaryV01[];
}

export interface PrivacyDisclosureReceiptV01 {
  schema: "epi-info-ai-privacy-receipt/0.1";
  artifactKind: PrivacyArtifactKindV01;
  boundary: GovernedDisclosureBoundaryV01;
  data: DataPrivacyClassificationV01;
  geography: GeographyPrivacyClassificationV01;
  containsRecordValues: boolean;
  decision: "allowed";
}

export class PrivacyClassificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivacyClassificationError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validatePrivacyClassificationV01(value: unknown): PrivacyClassificationV01 {
  if (!isObject(value)) throw new PrivacyClassificationError("Privacy classification must be an object.");
  const keys = Object.keys(value).sort();
  const expected = ["approvedUses", "containsRecordValues", "data", "geography", "purpose", "schema"].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new PrivacyClassificationError("Privacy classification contains missing or unsupported fields.");
  }
  if (value.schema !== "epi-info-ai-privacy/0.1") throw new PrivacyClassificationError("Privacy classification schema is not supported.");
  if (!DATA_PRIVACY_CLASSIFICATIONS.includes(value.data as DataPrivacyClassificationV01)) throw new PrivacyClassificationError("Data privacy classification is not supported.");
  if (!GEOGRAPHY_PRIVACY_CLASSIFICATIONS.includes(value.geography as GeographyPrivacyClassificationV01)) throw new PrivacyClassificationError("Geography privacy classification is not supported.");
  if (typeof value.containsRecordValues !== "boolean") throw new PrivacyClassificationError("containsRecordValues must be boolean.");
  if (typeof value.purpose !== "string" || !value.purpose.trim() || value.purpose.length > 240) throw new PrivacyClassificationError("Privacy purpose must be 1 to 240 characters.");
  if (!Array.isArray(value.approvedUses) || value.approvedUses.length === 0) throw new PrivacyClassificationError("At least one approved disclosure use is required.");
  const allowed = new Set<GovernedDisclosureBoundaryV01>(["network-request", "external-sync", "download", "map-display"]);
  if (value.approvedUses.some((item) => typeof item !== "string" || !allowed.has(item as GovernedDisclosureBoundaryV01))) {
    throw new PrivacyClassificationError("Privacy classification contains an unsupported disclosure use.");
  }
  if (new Set(value.approvedUses).size !== value.approvedUses.length) throw new PrivacyClassificationError("Approved disclosure uses must be unique.");
  if (value.geography === "precise-sensitive" && value.data === "public") throw new PrivacyClassificationError("Precise-sensitive geography cannot be classified as public.");
  return value as unknown as PrivacyClassificationV01;
}

export function requirePrivacyForDisclosureV01(value: unknown, boundary: GovernedDisclosureBoundaryV01): PrivacyClassificationV01 {
  const privacy = validatePrivacyClassificationV01(value);
  if (!privacy.approvedUses.includes(boundary)) throw new PrivacyClassificationError(`Privacy classification does not approve ${boundary}.`);
  return privacy;
}

export function createPrivacyDisclosureReceiptV01(value: unknown, artifactKind: PrivacyArtifactKindV01, boundary: GovernedDisclosureBoundaryV01): PrivacyDisclosureReceiptV01 {
  const privacy = requirePrivacyForDisclosureV01(value, boundary);
  return {
    schema: "epi-info-ai-privacy-receipt/0.1",
    artifactKind,
    boundary,
    data: privacy.data,
    geography: privacy.geography,
    containsRecordValues: privacy.containsRecordValues,
    decision: "allowed",
  };
}
