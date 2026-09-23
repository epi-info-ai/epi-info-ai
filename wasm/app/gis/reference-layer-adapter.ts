import type { ReferenceLayerNormalizationPlanV01 } from "./reference-layer-normalization.ts";

export interface ReferenceLayerGdalRequestV01 {
  sourceKind: "zip-shapefile" | "geopackage";
  layerName?: string;
  openVirtualFileSystems: readonly ["vsizip"] | readonly [];
  ogr2ogrArguments: readonly string[];
  outputName: string;
  limits: ReferenceLayerNormalizationPlanV01["limits"];
}

export function buildReferenceLayerGdalRequestV01(plan: ReferenceLayerNormalizationPlanV01): ReferenceLayerGdalRequestV01 {
  if (plan.executionStatus !== "planned") throw new RangeError("Reference-layer GDAL requests require a planned normalization plan.");
  if (plan.outputFormat !== "GeoJSON" || plan.targetCrs !== "CRS84") throw new RangeError("The reference-layer adapter only emits CRS84 GeoJSON in v0.1.");
  const sourceKind = plan.source.format === "Shapefile" ? "zip-shapefile" : "geopackage";
  if (sourceKind === "geopackage" && !plan.source.layerName?.trim()) throw new RangeError("GeoPackage normalization requires an explicit layer name.");
  const sourceCrs = plan.source.declaredCrs === "CRS84" ? "EPSG:4326" : plan.source.declaredCrs;
  const ogr2ogrArguments = ["-f", "GeoJSON", "-s_srs", sourceCrs, "-t_srs", "EPSG:4326", "-lco", "RFC7946=YES"];
  if (sourceKind === "geopackage") {
    const layerName = plan.source.layerName!.replaceAll('"', '""');
    ogr2ogrArguments.push("-dialect", "SQLite", "-sql", `SELECT * FROM "${layerName}"`);
  }
  return {
    sourceKind,
    ...(plan.source.layerName ? { layerName: plan.source.layerName } : {}),
    openVirtualFileSystems: sourceKind === "zip-shapefile" ? ["vsizip"] : [],
    ogr2ogrArguments,
    outputName: `reference-${plan.planId}`,
    limits: plan.limits,
  };
}
