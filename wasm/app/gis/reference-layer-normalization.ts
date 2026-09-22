import type { ReferenceLayerLineageV01 } from "./reference-layer-lineage.ts";

export interface ReferenceLayerNormalizationPlanV01 {
  schema: "epi-gis-reference-normalize/0.1";
  planId: string;
  source: {
    candidateId: string;
    format: "Shapefile" | "GeoPackage";
    declaredCrs: "CRS84" | "EPSG:4326" | "EPSG:3857";
    sha256: string;
    byteLength: number;
    layerName?: string;
  };
  targetCrs: "CRS84";
  outputFormat: "GeoJSON";
  limits: {
    maxInputBytes: number;
    maxOutputBytes: number;
    maxFeatures: number;
    maxCoordinates: number;
  };
  executionStatus: "planned";
}

export function createReferenceLayerNormalizationPlanV01(lineage: ReferenceLayerLineageV01, limits: ReferenceLayerNormalizationPlanV01["limits"]): ReferenceLayerNormalizationPlanV01 {
  if (lineage.persistence !== "not-persisted") throw new RangeError("Reference normalization requires the reviewed lineage receipt.");
  if (lineage.crs.declaredCrs === "unknown") throw new RangeError("Reference normalization cannot plan an unknown CRS.");
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`Reference normalization limit ${name} must be a positive safe integer.`);
  }
  return {
    schema: "epi-gis-reference-normalize/0.1",
    planId: lineage.planId,
    source: {
      candidateId: lineage.selection.candidateId,
      format: lineage.selection.format,
      declaredCrs: lineage.crs.declaredCrs,
      sha256: lineage.source.sha256,
      byteLength: lineage.source.byteLength,
      ...(lineage.selection.layerName ? { layerName: lineage.selection.layerName } : {}),
    },
    targetCrs: "CRS84",
    outputFormat: "GeoJSON",
    limits,
    executionStatus: "planned",
  };
}
