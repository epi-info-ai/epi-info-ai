import type { ReferenceLayerCandidateV01, ReferenceLayerCrsReviewV01 } from "./reference-layer.ts";
import type { ProjectMapAssetLineageV1 } from "../contracts/core.ts";

export interface ReferenceLayerLineageV01 {
  schema: "epi-gis-reference-lineage/0.1";
  planId: string;
  source: {
    fileName: string;
    sha256: string;
    byteLength: number;
    packageFormat: "ZIP" | "GeoPackage";
  };
  selection: {
    candidateId: string;
    format: "Shapefile" | "GeoPackage";
    entries: readonly string[];
    layerName?: string;
  };
  crs: {
    declaredCrs: "CRS84" | "EPSG:4326" | "EPSG:3857" | "unknown";
    targetCrs: "CRS84";
    normalizationRequired: boolean;
  };
  status: "reviewed" | "requires-reprojection";
  persistence: "not-persisted";
}

export function persistReferenceLayerLineageV01(lineage: ReferenceLayerLineageV01, derivedAssetId: string): ProjectMapAssetLineageV1 {
  if (!derivedAssetId.trim()) throw new RangeError("Reference layer lineage requires a derived asset id.");
  return { ...lineage, derivedAssetId, persistence: "project-snapshot", selection: { ...lineage.selection, entries: [...lineage.selection.entries] } };
}

export function createReferenceLayerLineageV01(input: {
  planId: string;
  fileName: string;
  sha256: string;
  byteLength: number;
  packageFormat: "ZIP" | "GeoPackage";
  candidate: ReferenceLayerCandidateV01;
  crsReview: ReferenceLayerCrsReviewV01;
  layerName?: string;
}): ReferenceLayerLineageV01 {
  if (!/^[a-f0-9]{64}$/i.test(input.sha256)) throw new RangeError("Reference layer lineage requires a SHA-256 digest.");
  if (!Number.isSafeInteger(input.byteLength) || input.byteLength < 1) throw new RangeError("Reference layer lineage requires a positive byte length.");
  if (!input.planId.trim() || !input.fileName.trim()) throw new RangeError("Reference layer lineage requires a plan id and file name.");
  if (input.candidate.completeness !== "complete") throw new RangeError("Reference layer lineage cannot be created for an incomplete candidate.");
  if (input.crsReview.status === "rejected-unknown") throw new RangeError("Reference layer lineage cannot be created for an unknown CRS.");
  if (input.candidate.format === "GeoPackage" && !input.layerName?.trim()) throw new RangeError("GeoPackage lineage requires an explicit layer name.");
  return {
    schema: "epi-gis-reference-lineage/0.1",
    planId: input.planId,
    source: { fileName: input.fileName, sha256: input.sha256.toLowerCase(), byteLength: input.byteLength, packageFormat: input.packageFormat },
    selection: { candidateId: input.candidate.id, format: input.candidate.format, entries: [...input.candidate.entries], ...(input.layerName ? { layerName: input.layerName } : {}) },
    crs: { declaredCrs: input.crsReview.declaredCrs, targetCrs: "CRS84", normalizationRequired: input.crsReview.normalizationRequired },
    status: input.crsReview.status === "requires-reprojection" ? "requires-reprojection" : "reviewed",
    persistence: "not-persisted",
  };
}
