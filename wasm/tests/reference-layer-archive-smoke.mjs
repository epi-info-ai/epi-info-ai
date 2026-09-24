import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { zipSync } from "fflate";

const packageBundle = await build({ entryPoints: ["wasm/app/contracts/project-package.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const archiveBundle = await build({ entryPoints: ["wasm/app/contracts/project-archive.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const sourceStoreBundle = await build({ entryPoints: ["wasm/app/gis/reference-layer-sources.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const packages = await import(`data:text/javascript;base64,${Buffer.from(packageBundle.outputFiles[0].text).toString("base64")}`);
const archives = await import(`data:text/javascript;base64,${Buffer.from(archiveBundle.outputFiles[0].text).toString("base64")}`);
const sourceStore = await import(`data:text/javascript;base64,${Buffer.from(sourceStoreBundle.outputFiles[0].text).toString("base64")}`);

const snapshot = JSON.parse(await readFile("wasm/tests/fixtures/phase0/project-snapshot-v1.json", "utf8"));
snapshot.privacy = { schema: "epi-info-ai-privacy/0.1", data: "public-synthetic", geography: "public-synthetic", containsRecordValues: true, purpose: "Reference layer archive test fixture", approvedUses: ["download", "map-display"] };
const sourceBytes = zipSync({ "toledo.shp": new Uint8Array([1]), "toledo.shx": new Uint8Array([2]), "toledo.dbf": new Uint8Array([3]) });
const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", sourceBytes))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const source = {
  id: digest,
  fileName: "toledo-reference.zip",
  storage: "opfs",
  storagePath: `epi-info-ai/reference-layer-sources/${digest}.zip`,
  byteLength: sourceBytes.byteLength,
  sha256: digest,
  format: "reference-package",
  mediaType: "application/zip",
  packageFormat: "ZIP",
  importedAt: "2026-09-10T12:02:00.000Z",
  persistence: "best-effort",
};
snapshot.referenceLayerSources = [source];
const derivedDigest = "b".repeat(64);
snapshot.mapAssets = [{
  id: derivedDigest,
  fileName: "toledo-reference.geojson",
  storage: "opfs",
  storagePath: `epi-info-ai/map-assets/${derivedDigest}.geojson`,
  byteLength: 128,
  sha256: derivedDigest,
  format: "geojson",
  mediaType: "application/geo+json",
  importedAt: "2026-09-10T12:03:00.000Z",
  persistence: "best-effort",
  sourceLineage: {
    schema: "epi-gis-reference-lineage/0.1",
    planId: "plan-toledo-reference",
    derivedAssetId: derivedDigest,
    source: { fileName: source.fileName, sha256: source.sha256, byteLength: source.byteLength, packageFormat: source.packageFormat },
    selection: { candidateId: "toledo", format: "Shapefile", entries: ["toledo.shp", "toledo.shx", "toledo.dbf"] },
    crs: { declaredCrs: "CRS84", targetCrs: "CRS84", normalizationRequired: false },
    status: "reviewed",
    persistence: "project-snapshot",
  },
}];
assert.equal(sourceStore.projectReferencesReferenceLayerSource(source, snapshot.referenceLayerSources), true);
assert.equal(sourceStore.projectReferencesReferenceLayerSource({ ...source, byteLength: source.byteLength + 1 }, snapshot.referenceLayerSources), false);
packages.createProjectPackage(snapshot);
assert.throws(
  () => packages.createProjectPackage({ ...snapshot, referenceLayerSources: [] }),
  /must exactly match a bundled project\.referenceLayerSources entry/,
);
assert.throws(
  () => packages.createProjectPackage({ ...snapshot, referenceLayerSources: [{ ...source, byteLength: source.byteLength + 1 }] }),
  /must exactly match a bundled project\.referenceLayerSources entry/,
);
delete snapshot.mapAssets;
const projectPackage = packages.createProjectPackage(snapshot);
const archive = await archives.createProjectArchive(projectPackage, [{ asset: source, file: new File([sourceBytes], source.fileName, { type: source.mediaType }) }]);
const restored = await archives.parseProjectArchive(new File([archive], "reference.epia"));
assert.equal(restored.assets.length, 1);
assert.equal(restored.assets[0].asset.format, "reference-package");
assert.deepEqual(new Uint8Array(await restored.assets[0].file.arrayBuffer()), sourceBytes);

const tampered = new Uint8Array(await archive.arrayBuffer());
tampered[tampered.length - 1] ^= 0xff;
await assert.rejects(() => archives.parseProjectArchive(new File([tampered], "tampered.epia")), /SHA-256 check/i);
console.log("Reference-layer archive smoke passed: source round trip and tamper rejection.");
