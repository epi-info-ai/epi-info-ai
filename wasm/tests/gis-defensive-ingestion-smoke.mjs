import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../demo/examples/gis-defensive-ingestion");
const manifest = JSON.parse(await readFile(join(root, "ingestion-test-package.json"), "utf8"));
const bundled = await build({ entryPoints: ["wasm/app/gis/index.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const encodedModule = Buffer.from(bundled.outputFiles[0].text).toString("base64");
const module = await import("data:text/javascript;base64," + encodedModule);

const expectedMessage = {
  "rejected-unsupported-media": /only GeoJSON is supported/,
  "rejected-malformed": /JSON|GeoJSON/,
  "rejected-coordinate-range": /longitude\/latitude range/,
  "rejected-non-finite": /non-finite/,
  "rejected-feature-limit": /feature count/i,
  "rejected-nesting-limit": /nesting/i,
  "rejected-property-limit": /property count/i,
};

for (const testCase of manifest.cases) {
  const bytes = await readFile(join(root, testCase.file));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const sha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const plan = {
    schema: "epi-gis-plan/0.1",
    id: "fixture-" + testCase.file,
    operation: "gis.dataset.inspect",
    projectRevision: "gis-defensive-ingestion-v0.1",
    inputs: [{ assetId: testCase.file, sha256, role: "reference-geography", mediaType: testCase.mediaType, byteLength: bytes.byteLength, declaredCrs: "EPSG:4326" }],
    parameters: {},
    limits: manifest.defaultPlanLimits,
    requestedOutputs: [{ id: "inventory", mediaType: "application/json", disclosure: "aggregate" }],
  };
  try {
    const result = module.inspectGeoJsonInputV01(buffer, module.validateGisPlanV01(plan));
    assert.ok(testCase.expected.startsWith("accepted"), testCase.file + " should be rejected");
    assert.equal(result.format, "GeoJSON");
  } catch (error) {
    assert.ok(testCase.expected.startsWith("rejected"), testCase.file + " unexpectedly rejected: " + error.message);
    assert.match(String(error?.message), expectedMessage[testCase.expected], testCase.file + " rejection reason");
  }
}

console.log("GIS defensive-ingestion package smoke passed: " + manifest.cases.length + " uploadable cases.");
