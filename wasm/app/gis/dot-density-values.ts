import { validateDotDensityLayerRecipeV01, type DotDensityLayerRecipeV01 } from "./dot-density.ts";

export interface DotDensityValueObservationV01 {
  featureIndex: number;
  value: unknown;
}

export type DotDensityValueDiagnosticCodeV01 = "missing-value" | "invalid-value" | "negative-value" | "per-feature-limit" | "total-limit";

export interface DotDensityValueDiagnosticV01 {
  featureIndex: number;
  code: DotDensityValueDiagnosticCodeV01;
  message: string;
}

export interface DotDensityNormalizedValueV01 {
  featureIndex: number;
  value: number;
  dotCount: number;
}

export interface DotDensityValuePreviewV01 {
  values: DotDensityNormalizedValueV01[];
  diagnostics: DotDensityValueDiagnosticV01[];
  totalValue: number;
  totalDots: number;
  inputCount: number;
  validCount: number;
  skippedCount: number;
}

function numberValue(value: unknown): number | null {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function roundedDotCount(value: number, recipe: DotDensityLayerRecipeV01): number {
  const ratio = value / recipe.valuePerDot;
  if (recipe.rounding === "floor") return Math.floor(ratio);
  if (recipe.rounding === "ceil") return Math.ceil(ratio);
  return Math.round(ratio);
}

export function buildDotDensityValuePreviewV01(
  observations: readonly DotDensityValueObservationV01[],
  recipe: DotDensityLayerRecipeV01,
): DotDensityValuePreviewV01 {
  validateDotDensityLayerRecipeV01(recipe);
  const values: DotDensityNormalizedValueV01[] = [];
  const diagnostics: DotDensityValueDiagnosticV01[] = [];
  let totalValue = 0;
  let totalDots = 0;
  for (const observation of observations) {
    const numeric = numberValue(observation.value);
    if (numeric === null) {
      diagnostics.push({ featureIndex: observation.featureIndex, code: "missing-value", message: "The feature has no value for Dot Density." });
      continue;
    }
    if (!Number.isFinite(numeric)) {
      diagnostics.push({ featureIndex: observation.featureIndex, code: "invalid-value", message: "The Dot Density value must be finite numeric data." });
      continue;
    }
    if (numeric < 0) {
      diagnostics.push({ featureIndex: observation.featureIndex, code: "negative-value", message: "Negative Dot Density values are not permitted." });
      continue;
    }
    const dotCount = roundedDotCount(numeric, recipe);
    if (dotCount > recipe.maxDotsPerFeature) {
      diagnostics.push({ featureIndex: observation.featureIndex, code: "per-feature-limit", message: `The requested ${dotCount.toLocaleString()} dots exceed the per-feature limit of ${recipe.maxDotsPerFeature.toLocaleString()}.` });
      continue;
    }
    if (totalDots + dotCount > recipe.maxTotalDots) {
      diagnostics.push({ featureIndex: observation.featureIndex, code: "total-limit", message: `The requested dots exceed the total limit of ${recipe.maxTotalDots.toLocaleString()}.` });
      continue;
    }
    values.push({ featureIndex: observation.featureIndex, value: numeric, dotCount });
    totalValue += numeric;
    totalDots += dotCount;
  }
  return { values, diagnostics, totalValue, totalDots, inputCount: observations.length, validCount: values.length, skippedCount: observations.length - values.length };
}
