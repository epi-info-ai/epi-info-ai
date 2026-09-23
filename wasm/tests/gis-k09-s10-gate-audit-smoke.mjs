import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({ entryPoints: ["wasm/app/gis/index.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const gis = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const audit = gis.auditAdvancedSpatialGatesV01("gis.raster.zonalStatistics");
assert.equal(audit.schema, "epi-gis-advanced-gate-audit/0.1");
assert.equal(audit.executionAllowed, false);
assert.equal(audit.validationStatus, "unvalidated");
assert.deepEqual(audit.openGateKeys, ["scientificEvidence", "privacyReview", "resourceValidation", "browserValidation", "rustWasmParity"]);
const evidenced = gis.auditAdvancedSpatialGatesV01("gis.geometry.repair", {
  scientificEvidence: "validation/geometry-repair-v01",
  privacyReview: "review/privacy-2026-09",
  resourceValidation: "validation/browser-limits-v01",
  browserValidation: "validation/browser-matrix-v01",
  rustWasmParity: "validation/rust-parity-v01",
});
assert.deepEqual(evidenced.openGateKeys, []);
assert.equal(evidenced.gates.every(({ status }) => status === "passed"), true);
assert.equal(evidenced.executionAllowed, false);
assert.throws(() => gis.auditAdvancedSpatialGatesV01("not-an-operation"), /Unregistered/);
console.log("GIS-K09-S10 gate audit smoke passed.");
