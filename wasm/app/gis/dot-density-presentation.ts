import type { DotDensityCandidateV01 } from "./dot-density-placement.ts";
import type { DotDensityLayerRecipeV01 } from "./dot-density.ts";
import type { DotDensityLegendModelV01 } from "./dot-density-legend.ts";

export interface DotDensityPointFeatureV01 {
  type: "Feature";
  geometry: { type: "Point"; coordinates: readonly [number, number] };
  properties: { featureIndex: number; dotIndex: number; color: string; radiusPixels: number; opacity: number };
}
export interface DotDensityPresentationV01 { type: "FeatureCollection"; features: DotDensityPointFeatureV01[]; legend: DotDensityLegendModelV01; }

export function buildDotDensityPresentationV01(candidates: readonly DotDensityCandidateV01[], recipe: DotDensityLayerRecipeV01, legend: DotDensityLegendModelV01): DotDensityPresentationV01 {
  if (legend.schema !== "epi-gis-dot-density-legend/0.1") throw new Error("Dot Density presentation requires a K07 legend model.");
  const features = candidates.map((candidate) => {
    if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) throw new RangeError("Dot Density presentation requires finite candidate coordinates.");
    return { type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [candidate.x, candidate.y] as const }, properties: { featureIndex: candidate.featureIndex, dotIndex: candidate.dotIndex, color: recipe.dotColor, radiusPixels: recipe.dotRadiusPixels, opacity: recipe.opacity } };
  });
  return { type: "FeatureCollection", features, legend };
}
