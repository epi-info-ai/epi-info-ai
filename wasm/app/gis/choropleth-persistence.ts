import { validateChoroplethLayerRecipeV01, type ChoroplethLayerRecipeV01 } from "./choropleth.ts";

export interface ChoroplethLayerProvenanceV01 {
  sourceAssetId: string;
  sourceSha256: string;
  dataSourceFormId: string;
  dataSourceRevision: string;
  lineage: readonly string[];
}

export interface ChoroplethLayerSnapshotV01 {
  schema: "epi-gis-choropleth-layer/0.1";
  id: string;
  name: string;
  visible: boolean;
  recipe: ChoroplethLayerRecipeV01;
  provenance: ChoroplethLayerProvenanceV01;
}

export class ChoroplethPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChoroplethPersistenceError";
  }
}

function text(value: string, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new ChoroplethPersistenceError(`${label} must be a non-empty string.`);
  return value.trim();
}

export function validateChoroplethLayerSnapshotV01(snapshot: ChoroplethLayerSnapshotV01): void {
  if (snapshot.schema !== "epi-gis-choropleth-layer/0.1") throw new ChoroplethPersistenceError("Unsupported Choropleth layer snapshot schema.");
  text(snapshot.id, "Choropleth layer id");
  text(snapshot.name, "Choropleth layer name");
  if (typeof snapshot.visible !== "boolean") throw new ChoroplethPersistenceError("Choropleth layer visibility must be boolean.");
  validateChoroplethLayerRecipeV01(snapshot.recipe);
  text(snapshot.provenance.sourceAssetId, "Choropleth source asset id");
  if (!/^[a-f0-9]{64}$/i.test(snapshot.provenance.sourceSha256)) throw new ChoroplethPersistenceError("Choropleth source digest must be a SHA-256 hex digest.");
  text(snapshot.provenance.dataSourceFormId, "Choropleth data source form");
  text(snapshot.provenance.dataSourceRevision, "Choropleth data source revision");
  if (!Array.isArray(snapshot.provenance.lineage) || snapshot.provenance.lineage.length === 0 || snapshot.provenance.lineage.some((entry) => typeof entry !== "string" || entry.trim() === "")) {
    throw new ChoroplethPersistenceError("Choropleth provenance lineage must contain at least one non-empty identifier.");
  }
  if (snapshot.recipe.boundaryAssetId !== snapshot.provenance.sourceAssetId) throw new ChoroplethPersistenceError("Choropleth recipe and provenance source assets must agree.");
  if (snapshot.recipe.dataSourceFormId !== snapshot.provenance.dataSourceFormId) throw new ChoroplethPersistenceError("Choropleth recipe and provenance data forms must agree.");
}

export function createChoroplethLayerSnapshotV01(input: Omit<ChoroplethLayerSnapshotV01, "schema">): ChoroplethLayerSnapshotV01 {
  const snapshot: ChoroplethLayerSnapshotV01 = { schema: "epi-gis-choropleth-layer/0.1", ...input };
  validateChoroplethLayerSnapshotV01(snapshot);
  return snapshot;
}

export function serializeChoroplethLayerSnapshotV01(snapshot: ChoroplethLayerSnapshotV01): string {
  validateChoroplethLayerSnapshotV01(snapshot);
  return JSON.stringify(snapshot);
}

export function parseChoroplethLayerSnapshotV01(serialized: string): ChoroplethLayerSnapshotV01 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new ChoroplethPersistenceError("Choropleth layer snapshot is not valid JSON.");
  }
  validateChoroplethLayerSnapshotV01(parsed as ChoroplethLayerSnapshotV01);
  return parsed as ChoroplethLayerSnapshotV01;
}
