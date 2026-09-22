import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { zipSync } from "fflate";

const packageBundle = await build({ entryPoints: ["wasm/app/contracts/project-package.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const archiveBundle = await build({ entryPoints: ["wasm/app/contracts/project-archive.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const packages = await import(`data:text/javascript;base64,${Buffer.from(packageBundle.outputFiles[0].text).toString("base64")}`);
const archives = await import(`data:text/javascript;base64,${Buffer.from(archiveBundle.outputFiles[0].text).toString("base64")}`);

const snapshot = JSON.parse(await readFile("wasm/tests/fixtures/phase0/project-snapshot-v1.json", "utf8"));
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
