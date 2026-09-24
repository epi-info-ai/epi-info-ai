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

export interface DotDensityPlacementOptionsV01 {
  contains?: (featureIndex: number, x: number, y: number) => boolean;
  maxAttempts?: number;
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
  options: DotDensityPlacementOptionsV01 = {},
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
    const maxAttempts = options.maxAttempts ?? Math.min(2_000_000, Math.max(4_096, value.dotCount * 512));
    let attempts = 0;
    let dotIndex = 0;
    while (dotIndex < value.dotCount && attempts < maxAttempts) {
      let unitX: number;
      let unitY: number;
      if (recipe.placementMethod === "deterministic-grid") {
        if (!options.contains) {
          unitX = ((dotIndex % columns) + 0.5) / columns;
          unitY = (Math.floor(dotIndex / columns) + 0.5) / rows;
        } else {
          const sequence = attempts + 1;
          unitX = (0.5 + sequence * 0.6180339887498949) % 1;
          unitY = (0.5 + sequence * 0.4142135623730951) % 1;
        }
      } else {
        unitX = nextRandom();
        unitY = nextRandom();
      }
      const candidate = {
        featureIndex: value.featureIndex,
        dotIndex,
        x: featureBounds.minX + unitX * (featureBounds.maxX - featureBounds.minX),
        y: featureBounds.minY + unitY * (featureBounds.maxY - featureBounds.minY),
      };
      attempts += 1;
      if (options.contains && !options.contains(candidate.featureIndex, candidate.x, candidate.y)) continue;
      candidates.push(candidate);
      dotIndex += 1;
    }
    if (dotIndex < value.dotCount) throw new RangeError(`Dot Density could not place the requested ${value.dotCount.toLocaleString()} dots inside feature ${value.featureIndex} within the bounded placement budget.`);
    featureCounts[String(value.featureIndex)] = value.dotCount;
  }
  return { candidates, featureCounts, totalCandidates: candidates.length };
}
