import { validateDotDensityLayerRecipeV01, type DotDensityLayerRecipeV01 } from "./dot-density.ts";
import type { DotDensityNormalizedValueV01 } from "./dot-density-values.ts";

export interface DotDensityFeatureBoundsV01 {
  featureIndex: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface DotDensityCandidateV01 {
  featureIndex: number;
  dotIndex: number;
  x: number;
  y: number;
}

export interface DotDensityCandidateResultV01 {
  candidates: DotDensityCandidateV01[];
  featureCounts: Record<string, number>;
  totalCandidates: number;
}

function validateBounds(bounds: DotDensityFeatureBoundsV01): void {
  if (![bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite) || bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) throw new RangeError(`Invalid Dot Density bounds for feature ${bounds.featureIndex}.`);
}

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function featureRandom(seed: number, featureIndex: number): () => number {
  return random((seed ^ Math.imul(featureIndex + 1, 0x9e3779b9)) >>> 0);
}

export function generateDotDensityCandidatesV01(
  values: readonly DotDensityNormalizedValueV01[],
  bounds: readonly DotDensityFeatureBoundsV01[],
  recipe: DotDensityLayerRecipeV01,
): DotDensityCandidateResultV01 {
  validateDotDensityLayerRecipeV01(recipe);
  const boundsByFeature = new Map<number, DotDensityFeatureBoundsV01>();
  for (const entry of bounds) {
    validateBounds(entry);
    if (boundsByFeature.has(entry.featureIndex)) throw new RangeError(`Duplicate Dot Density bounds for feature ${entry.featureIndex}.`);
    boundsByFeature.set(entry.featureIndex, entry);
  }
  const candidates: DotDensityCandidateV01[] = [];
  const featureCounts: Record<string, number> = {};
  for (const value of values) {
    const featureBounds = boundsByFeature.get(value.featureIndex);
    if (!featureBounds) throw new RangeError(`Missing Dot Density bounds for feature ${value.featureIndex}.`);
    const nextRandom = featureRandom(recipe.seed, value.featureIndex);
    const columns = Math.max(1, Math.ceil(Math.sqrt(value.dotCount)));
    const rows = Math.max(1, Math.ceil(value.dotCount / columns));
    for (let dotIndex = 0; dotIndex < value.dotCount; dotIndex += 1) {
      let unitX: number;
      let unitY: number;
      if (recipe.placementMethod === "deterministic-grid") {
        unitX = ((dotIndex % columns) + 0.5) / columns;
        unitY = (Math.floor(dotIndex / columns) + 0.5) / rows;
      } else {
        unitX = nextRandom();
        unitY = nextRandom();
      }
      candidates.push({
        featureIndex: value.featureIndex,
        dotIndex,
        x: featureBounds.minX + unitX * (featureBounds.maxX - featureBounds.minX),
        y: featureBounds.minY + unitY * (featureBounds.maxY - featureBounds.minY),
      });
    }
    featureCounts[String(value.featureIndex)] = value.dotCount;
  }
  return { candidates, featureCounts, totalCandidates: candidates.length };
}
