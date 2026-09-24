import { canonicalizeGisValue } from "./contracts.ts";

export type MapDocumentBackgroundV01 = "street" | "blank" | "offline";
export type MapDocumentOutputV01 = "interactive" | "png";

export interface MapDocumentLayerRefV01 {
  id: string;
  visible: boolean;
  zIndex: number;
}

export interface MapDocumentPlanV01 {
  schema: "epi-gis-map-document/0.1";
  id: string;
  projectRevision: string;
  layers: readonly MapDocumentLayerRefV01[];
  background: MapDocumentBackgroundV01;
  output: MapDocumentOutputV01;
}

export class MapDocumentPlanErrorV01 extends Error {
  constructor(message: string) { super(message); this.name = "MapDocumentPlanErrorV01"; }
}

function text(value: string, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new MapDocumentPlanErrorV01(`${label} must be a non-empty string.`);
  return value.trim();
}

export function validateMapDocumentPlanV01(plan: MapDocumentPlanV01): void {
  if (plan.schema !== "epi-gis-map-document/0.1") throw new MapDocumentPlanErrorV01("Map document schema is not supported.");
  text(plan.id, "Map document id");
  text(plan.projectRevision, "Map document project revision");
  if (plan.background !== "street" && plan.background !== "blank" && plan.background !== "offline") throw new MapDocumentPlanErrorV01("Map document background is not supported.");
  if (plan.output !== "interactive" && plan.output !== "png") throw new MapDocumentPlanErrorV01("Map document output is not supported.");
  if (!Array.isArray(plan.layers)) throw new MapDocumentPlanErrorV01("Map document layers must be an array.");
  const ids = new Set<string>();
  const zIndexes = new Set<number>();
  for (const layer of plan.layers) {
    text(layer.id, "Map document layer id");
    if (ids.has(layer.id)) throw new MapDocumentPlanErrorV01(`Map document layer id is duplicated: ${layer.id}.`);
    if (typeof layer.visible !== "boolean") throw new MapDocumentPlanErrorV01(`Map document layer visibility must be boolean: ${layer.id}.`);
    if (!Number.isSafeInteger(layer.zIndex) || layer.zIndex < 0) throw new MapDocumentPlanErrorV01(`Map document layer z-index must be a non-negative integer: ${layer.id}.`);
    if (zIndexes.has(layer.zIndex)) throw new MapDocumentPlanErrorV01(`Map document z-index is duplicated: ${layer.zIndex}.`);
    ids.add(layer.id);
    zIndexes.add(layer.zIndex);
  }
}

export function createMapDocumentPlanV01(input: Omit<MapDocumentPlanV01, "schema">): MapDocumentPlanV01 {
  const plan: MapDocumentPlanV01 = { schema: "epi-gis-map-document/0.1", ...input, layers: input.layers.map((layer) => ({ ...layer })) };
  validateMapDocumentPlanV01(plan);
  return plan;
}

export function canonicalizeMapDocumentPlanV01(plan: MapDocumentPlanV01): string {
  validateMapDocumentPlanV01(plan);
  return canonicalizeGisValue(plan);
}
