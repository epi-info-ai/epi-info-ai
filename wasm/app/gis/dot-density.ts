/**
 * Renderer-independent K07 Dot Density recipe contract.
 *
 * Slice 1 records the visualization policy. It does not generate dots or
 * inspect polygon geometry; those operations are deliberately later slices.
 */

export type DotDensityRoundingV01 = "floor" | "nearest" | "ceil";
export type DotDensityPlacementMethodV01 = "seeded-jitter" | "deterministic-grid";
export type DotDensityClippingPolicyV01 = "polygon-interior";

export interface DotDensityLayerRecipeV01 {
  schema: "epi-gis-dot-density/0.1";
  boundaryAssetId: string;
  boundaryLayerName?: string;
  boundaryKeyField: string;
  dataSourceFormId: string;
  dataKeyField: string;
  valueField: string;
  valuePerDot: number;
  rounding: DotDensityRoundingV01;
  seed: number;
  placementMethod: DotDensityPlacementMethodV01;
  clipping: DotDensityClippingPolicyV01;
  dotColor: string;
  dotRadiusPixels: number;
  opacity: number;
  legendTitle: string;
  maxDotsPerFeature: number;
  maxTotalDots: number;
}

export class DotDensityContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DotDensityContractError";
  }
}

function text(value: string, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new DotDensityContractError(`${label} must be a non-empty string.`);
  return value.trim();
}

function hexColor(value: string, label: string): string {
  const color = text(value, label);
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new DotDensityContractError(`${label} must be a six-digit hexadecimal color.`);
  return color.toLowerCase();
}

function boundedInteger(value: number, label: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new DotDensityContractError(`${label} must be an integer from ${minimum.toLocaleString()} through ${maximum.toLocaleString()}.`);
  return value;
}

export function validateDotDensityLayerRecipeV01(recipe: DotDensityLayerRecipeV01): void {
  if (recipe.schema !== "epi-gis-dot-density/0.1") throw new DotDensityContractError("Dot Density recipe schema must be epi-gis-dot-density/0.1.");
  text(recipe.boundaryAssetId, "Dot Density boundary asset");
  if (recipe.boundaryLayerName !== undefined) text(recipe.boundaryLayerName, "Dot Density boundary layer name");
  text(recipe.boundaryKeyField, "Dot Density boundary key field");
  text(recipe.dataSourceFormId, "Dot Density data source form");
  text(recipe.dataKeyField, "Dot Density data key field");
  text(recipe.valueField, "Dot Density value field");
  if (!Number.isFinite(recipe.valuePerDot) || recipe.valuePerDot <= 0) throw new DotDensityContractError("Dot Density value-per-dot must be a positive finite number.");
  if (recipe.rounding !== "floor" && recipe.rounding !== "nearest" && recipe.rounding !== "ceil") throw new DotDensityContractError("Dot Density rounding policy is not supported.");
  boundedInteger(recipe.seed, "Dot Density seed", 0, 0xffffffff);
  if (recipe.placementMethod !== "seeded-jitter" && recipe.placementMethod !== "deterministic-grid") throw new DotDensityContractError("Dot Density placement method is not supported.");
  if (recipe.clipping !== "polygon-interior") throw new DotDensityContractError("Dot Density clipping must use polygon-interior in v0.1.");
  hexColor(recipe.dotColor, "Dot Density dot color");
  if (!Number.isFinite(recipe.dotRadiusPixels) || recipe.dotRadiusPixels <= 0 || recipe.dotRadiusPixels > 20) throw new DotDensityContractError("Dot Density dot radius must be greater than 0 and at most 20 pixels.");
  if (!Number.isFinite(recipe.opacity) || recipe.opacity < 0 || recipe.opacity > 1) throw new DotDensityContractError("Dot Density opacity must be between 0 and 1.");
  text(recipe.legendTitle, "Dot Density legend title");
  boundedInteger(recipe.maxDotsPerFeature, "Dot Density per-feature limit", 1, 100_000);
  boundedInteger(recipe.maxTotalDots, "Dot Density total limit", 1, 1_000_000);
  if (recipe.maxDotsPerFeature > recipe.maxTotalDots) throw new DotDensityContractError("Dot Density per-feature limit cannot exceed the total limit.");
}

export function createDotDensityLayerRecipeV01(input: Omit<DotDensityLayerRecipeV01, "schema">): DotDensityLayerRecipeV01 {
  const recipe: DotDensityLayerRecipeV01 = { schema: "epi-gis-dot-density/0.1", ...input };
  validateDotDensityLayerRecipeV01(recipe);
  return recipe;
}
