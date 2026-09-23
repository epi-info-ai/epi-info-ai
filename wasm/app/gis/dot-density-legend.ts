import { validateDotDensityLayerRecipeV01, type DotDensityLayerRecipeV01 } from "./dot-density.ts";
import type { DotDensityValuePreviewV01 } from "./dot-density-values.ts";
import type { DotDensityClipResultV01 } from "./dot-density-clipping.ts";

export interface DotDensityLegendEntryV01 {
  label: string;
  valuePerDot: number;
  dotColor: string;
  dotRadiusPixels: number;
  opacity: number;
}

export interface DotDensityLegendModelV01 {
  schema: "epi-gis-dot-density-legend/0.1";
  title: string;
  entry: DotDensityLegendEntryV01;
  totalInputValue: number;
  totalInputDots: number;
  renderedDots: number;
  clippedDots: number;
  noDataCount: number;
  diagnosticCount: number;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value);
}

export function buildDotDensityLegendV01(
  recipe: DotDensityLayerRecipeV01,
  preview: DotDensityValuePreviewV01,
  clipping: Pick<DotDensityClipResultV01, "keptCount" | "clippedCount">,
): DotDensityLegendModelV01 {
  validateDotDensityLayerRecipeV01(recipe);
  if (!Number.isFinite(preview.totalValue) || preview.totalValue < 0 || !Number.isSafeInteger(preview.totalDots) || preview.totalDots < 0) throw new RangeError("Dot Density preview totals are invalid.");
  if (!Number.isSafeInteger(clipping.keptCount) || clipping.keptCount < 0 || !Number.isSafeInteger(clipping.clippedCount) || clipping.clippedCount < 0) throw new RangeError("Dot Density clipping totals are invalid.");
  return {
    schema: "epi-gis-dot-density-legend/0.1",
    title: recipe.legendTitle,
    entry: {
      label: `${formatNumber(recipe.valuePerDot)} value per dot`,
      valuePerDot: recipe.valuePerDot,
      dotColor: recipe.dotColor.toLowerCase(),
      dotRadiusPixels: recipe.dotRadiusPixels,
      opacity: recipe.opacity,
    },
    totalInputValue: preview.totalValue,
    totalInputDots: preview.totalDots,
    renderedDots: clipping.keptCount,
    clippedDots: clipping.clippedCount,
    noDataCount: preview.skippedCount,
    diagnosticCount: preview.diagnostics.length,
  };
}
