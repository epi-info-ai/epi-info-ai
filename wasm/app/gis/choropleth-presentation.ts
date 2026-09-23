import { validateChoroplethLayerRecipeV01, type ChoroplethLayerRecipeV01 } from "./choropleth.ts";
import type { ChoroplethClassificationResultV01 } from "./choropleth-classification.ts";

export interface ChoroplethLegendEntryV01 {
  classIndex: number;
  color: string;
  label: string;
  count: number;
  opacity: number;
}

export interface ChoroplethNoDataLegendEntryV01 {
  color: string;
  label: string;
  opacity: number;
}

export interface ChoroplethLegendModelV01 {
  title: string;
  entries: ChoroplethLegendEntryV01[];
  noData?: ChoroplethNoDataLegendEntryV01;
}

function formatBreak(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function classLabel(classIndex: number, breaks: readonly number[], classCount: number): string {
  if (breaks.length === 0) return "All values";
  if (classCount === 1) return `≤ ${formatBreak(breaks[0]!)}`;
  if (classIndex === 0) return `≤ ${formatBreak(breaks[0]!)}`;
  if (classIndex === classCount - 1) return `> ${formatBreak(breaks[classIndex - 1]!)}`;
  return `> ${formatBreak(breaks[classIndex - 1]!)} – ≤ ${formatBreak(breaks[classIndex]!)}`;
}

export function colorForChoroplethClassV01(recipe: ChoroplethLayerRecipeV01, classIndex: number | null): string {
  validateChoroplethLayerRecipeV01(recipe);
  if (classIndex === null) return recipe.noDataColor;
  if (!Number.isSafeInteger(classIndex) || classIndex < 0 || classIndex >= recipe.classification.classCount) throw new RangeError("Choropleth class index is outside the recipe class range.");
  return recipe.palette[classIndex]!;
}

export function buildChoroplethLegendModelV01(recipe: ChoroplethLayerRecipeV01, classification: ChoroplethClassificationResultV01): ChoroplethLegendModelV01 {
  validateChoroplethLayerRecipeV01(recipe);
  if (classification.classCount !== recipe.classification.classCount || classification.breaks.length !== recipe.classification.classCount - 1) throw new RangeError("Choropleth classification result does not match the recipe.");
  const model: ChoroplethLegendModelV01 = {
    title: recipe.legend.title,
    entries: Array.from({ length: recipe.classification.classCount }, (_, classIndex) => ({
      classIndex,
      color: colorForChoroplethClassV01(recipe, classIndex),
      label: recipe.legend.showLabels ? classLabel(classIndex, classification.breaks, classification.classCount) : "",
      count: classification.classCounts[classIndex] ?? 0,
      opacity: recipe.opacity,
    })),
  };
  if (recipe.legend.showNoData) model.noData = { color: recipe.noDataColor, label: "No data", opacity: recipe.opacity };
  return model;
}
