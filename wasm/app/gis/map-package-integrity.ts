export interface MapPackageAssetRefV01 { id: string; sha256: string; byteLength: number; }
export interface MapPackageLayerRefV01 { id: string; assetId?: string; }
export interface MapPackageRecoveryAuditV01 {
  restorable: boolean;
  missingAssetIds: string[];
  orphanAssetIds: string[];
  invalidAssetIds: string[];
}

export class MapPackageIntegrityErrorV01 extends Error {
  constructor(message: string) { super(message); this.name = "MapPackageIntegrityErrorV01"; }
}

function validateAsset(asset: MapPackageAssetRefV01): void {
  if (typeof asset.id !== "string" || asset.id.trim() === "") throw new MapPackageIntegrityErrorV01("Map package asset ids must be non-empty strings.");
  if (!/^[a-f0-9]{64}$/i.test(asset.sha256)) throw new MapPackageIntegrityErrorV01(`Map package asset has an invalid SHA-256 digest: ${asset.id}.`);
  if (!Number.isSafeInteger(asset.byteLength) || asset.byteLength < 0) throw new MapPackageIntegrityErrorV01(`Map package asset has an invalid byte length: ${asset.id}.`);
}

export function auditMapPackageRecoveryV01(assets: readonly MapPackageAssetRefV01[], layers: readonly MapPackageLayerRefV01[]): MapPackageRecoveryAuditV01 {
  const assetIds = new Set<string>();
  for (const asset of assets) { validateAsset(asset); if (assetIds.has(asset.id)) throw new MapPackageIntegrityErrorV01(`Map package asset id is duplicated: ${asset.id}.`); assetIds.add(asset.id); }
  const referenced = new Set<string>();
  const missingAssetIds: string[] = [];
  const invalidAssetIds: string[] = [];
  const layerIds = new Set<string>();
  for (const layer of layers) {
    if (typeof layer.id !== "string" || layer.id.trim() === "") throw new MapPackageIntegrityErrorV01("Map package layer ids must be non-empty strings.");
    if (layerIds.has(layer.id)) throw new MapPackageIntegrityErrorV01(`Map package layer id is duplicated: ${layer.id}.`);
    layerIds.add(layer.id);
    if (layer.assetId === undefined) continue;
    if (typeof layer.assetId !== "string" || layer.assetId.trim() === "") { invalidAssetIds.push(layer.assetId ?? ""); continue; }
    referenced.add(layer.assetId);
    if (!assetIds.has(layer.assetId)) missingAssetIds.push(layer.assetId);
  }
  const orphanAssetIds = assets.map((asset) => asset.id).filter((id) => !referenced.has(id));
  return { restorable: missingAssetIds.length === 0 && invalidAssetIds.length === 0, missingAssetIds, orphanAssetIds, invalidAssetIds };
}
