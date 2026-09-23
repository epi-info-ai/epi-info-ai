/**
 * Renderer-independent K06 choropleth recipe contract.
 *
 * Slice 1 describes the user's intent and its bounded visual controls. It
 * does not join records to polygons or classify values; those operations are
 * deliberately reserved for later K06 slices.
 */

export type ChoroplethClassificationMethodV01 = "manual" | "equal-interval" | "quantile";
export type ChoroplethJoinNormalizationV01 = "exact" | "trim-casefold";
export type ChoroplethFilterOperatorV01 = "equals" | "not-equals" | "contains" | "greater-than" | "greater-or-equal" | "less-than" | "less-or-equal" | "is-empty" | "is-not-empty";

export interface ChoroplethFilterV01 {
  field: string;
  operator: ChoroplethFilterOperatorV01;
  value?: string;
}

export interface ChoroplethClassificationV01 {
  method: ChoroplethClassificationMethodV01;
  classCount: number;
  breaks?: readonly number[];
}

export interface ChoroplethLegendV01 {
  title: string;
  showLabels: boolean;
  showNoData: boolean;
}

export interface ChoroplethLayerRecipeV01 {
  schema: "epi-gis-choropleth/0.1";
  boundaryAssetId: string;
  boundaryLayerName?: string;
  boundaryKeyField: string;
  dataSourceFormId: string;
  dataKeyField: string;
  valueField: string;
  joinNormalization: ChoroplethJoinNormalizationV01;
  classification: ChoroplethClassificationV01;
  palette: readonly string[];
  opacity: number;
  noDataColor: string;
  legend: ChoroplethLegendV01;
  filter?: ChoroplethFilterV01;
}

export class ChoroplethContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChoroplethContractError";
  }
}

const filterOperators: readonly ChoroplethFilterOperatorV01[] = [
  "equals", "not-equals", "contains", "greater-than", "greater-or-equal", "less-than", "less-or-equal", "is-empty", "is-not-empty",
];

function requireText(value: string, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new ChoroplethContractError(`${label} must be a non-empty string.`);
  return value.trim();
}

function requireHexColor(value: string, label: string): string {
  const color = requireText(value, label);
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new ChoroplethContractError(`${label} must be a six-digit hexadecimal color.`);
  return color.toLowerCase();
}

function requireInteger(value: number, label: string, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new ChoroplethContractError(`${label} must be an integer from ${minimum} through ${maximum}.`);
  return value;
}

export function validateChoroplethFilterV01(filter: ChoroplethFilterV01): void {
  requireText(filter.field, "Choropleth filter field");
  if (!filterOperators.includes(filter.operator)) throw new ChoroplethContractError(`Unsupported choropleth filter operator: ${filter.operator}.`);
  if (!(["is-empty", "is-not-empty"] as readonly string[]).includes(filter.operator) && typeof filter.value !== "string") {
    throw new ChoroplethContractError("This choropleth filter requires a comparison value.");
  }
}

export function validateChoroplethClassificationV01(classification: ChoroplethClassificationV01): void {
  if (!["manual", "equal-interval", "quantile"].includes(classification.method)) throw new ChoroplethContractError(`Unsupported choropleth classification method: ${classification.method}.`);
  requireInteger(classification.classCount, "Choropleth class count", 2, 12);
  if (classification.method === "manual") {
    if (!classification.breaks || classification.breaks.length !== classification.classCount - 1) throw new ChoroplethContractError("Manual choropleth classification requires one fewer break than classes.");
  } else if (classification.breaks !== undefined) {
    throw new ChoroplethContractError("Automatic choropleth classification must not provide manual breaks.");
  }
  if (classification.breaks) {
    if (classification.breaks.some((value) => !Number.isFinite(value))) throw new ChoroplethContractError("Choropleth breaks must be finite numbers.");
    for (let index = 1; index < classification.breaks.length; index += 1) {
      if (classification.breaks[index]! <= classification.breaks[index - 1]!) throw new ChoroplethContractError("Choropleth breaks must be strictly increasing.");
    }
  }
}

export function validateChoroplethLayerRecipeV01(recipe: ChoroplethLayerRecipeV01): void {
  if (recipe.schema !== "epi-gis-choropleth/0.1") throw new ChoroplethContractError("Choropleth recipe schema must be epi-gis-choropleth/0.1.");
  requireText(recipe.boundaryAssetId, "Choropleth boundary asset");
  if (recipe.boundaryLayerName !== undefined) requireText(recipe.boundaryLayerName, "Choropleth boundary layer name");
  requireText(recipe.boundaryKeyField, "Choropleth boundary key field");
  requireText(recipe.dataSourceFormId, "Choropleth data source form");
  requireText(recipe.dataKeyField, "Choropleth data key field");
  requireText(recipe.valueField, "Choropleth value field");
  if (recipe.joinNormalization !== "exact" && recipe.joinNormalization !== "trim-casefold") throw new ChoroplethContractError("Choropleth join normalization is not supported.");
  validateChoroplethClassificationV01(recipe.classification);
  if (!Array.isArray(recipe.palette) || recipe.palette.length !== recipe.classification.classCount) throw new ChoroplethContractError("Choropleth palette length must equal the class count.");
  recipe.palette.forEach((color, index) => requireHexColor(color, `Choropleth palette[${index}]`));
  if (!Number.isFinite(recipe.opacity) || recipe.opacity < 0 || recipe.opacity > 1) throw new ChoroplethContractError("Choropleth opacity must be between 0 and 1.");
  requireHexColor(recipe.noDataColor, "Choropleth NoData color");
  requireText(recipe.legend.title, "Choropleth legend title");
  if (typeof recipe.legend.showLabels !== "boolean" || typeof recipe.legend.showNoData !== "boolean") throw new ChoroplethContractError("Choropleth legend flags must be boolean.");
  if (recipe.filter) validateChoroplethFilterV01(recipe.filter);
}

export function createChoroplethLayerRecipeV01(input: Omit<ChoroplethLayerRecipeV01, "schema">): ChoroplethLayerRecipeV01 {
  const recipe: ChoroplethLayerRecipeV01 = { schema: "epi-gis-choropleth/0.1", ...input };
  validateChoroplethLayerRecipeV01(recipe);
  return recipe;
}
