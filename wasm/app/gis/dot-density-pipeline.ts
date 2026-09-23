import { validateDotDensityLayerRecipeV01, type DotDensityLayerRecipeV01 } from "./dot-density.ts";
import { buildDotDensityValuePreviewV01, type DotDensityValueObservationV01, type DotDensityValuePreviewV01 } from "./dot-density-values.ts";
import { generateDotDensityCandidatesV01, type DotDensityCandidateResultV01, type DotDensityFeatureBoundsV01 } from "./dot-density-placement.ts";
import { clipDotDensityCandidatesV01, type DotDensityClipGeometryV01, type DotDensityClipResultV01 } from "./dot-density-clipping.ts";
import { buildDotDensityLegendV01, type DotDensityLegendModelV01 } from "./dot-density-legend.ts";
import { joinDotDensityDataToBoundariesV01, type DotDensityBoundaryFeatureV01, type DotDensityDataRowV01, type DotDensityJoinNormalizationV01, type DotDensityJoinResultV01 } from "./dot-density-join.ts";

export interface DotDensityPipelineInputV01 {
  boundaries: readonly DotDensityBoundaryFeatureV01[];
  rows: readonly DotDensityDataRowV01[];
  boundaryKeyField: string;
  dataKeyField: string;
  valueField: string;
  normalization?: DotDensityJoinNormalizationV01;
  bounds: readonly DotDensityFeatureBoundsV01[];
  geometries: ReadonlyMap<number, DotDensityClipGeometryV01>;
}

export interface DotDensityPipelineResultV01 {
  join: DotDensityJoinResultV01;
  preview: DotDensityValuePreviewV01;
  placement: DotDensityCandidateResultV01;
  clipping: DotDensityClipResultV01;
  legend: DotDensityLegendModelV01;
}

export function buildDotDensityPipelineV01(recipe: DotDensityLayerRecipeV01, input: DotDensityPipelineInputV01): DotDensityPipelineResultV01 {
  validateDotDensityLayerRecipeV01(recipe);
  if (input.valueField.trim() === "") throw new Error("Dot Density pipelines require a value field.");
  const join = joinDotDensityDataToBoundariesV01(input.boundaries, input.rows, input.boundaryKeyField, input.dataKeyField, input.normalization);
  const observations: DotDensityValueObservationV01[] = join.matches.map((match) => ({
    featureIndex: match.boundary.featureIndex,
    value: match.dataRows.length === 1 ? match.dataRows[0]!.values[input.valueField] : null,
  }));
  const preview = buildDotDensityValuePreviewV01(observations, recipe);
  const placement = generateDotDensityCandidatesV01(preview.values, input.bounds, recipe);
  const clipping = clipDotDensityCandidatesV01(placement.candidates, input.geometries);
  const legend = buildDotDensityLegendV01(recipe, preview, clipping);
  return { join, preview, placement, clipping, legend };
}
