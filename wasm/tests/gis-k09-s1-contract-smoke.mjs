import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({ entryPoints: ["wasm/app/gis/index.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const gis = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

const plan = gis.createAdvancedSpatialPlanV01({
  id: "k09-s1-weights",
  operation: "gis.spatial.weights",
  projectRevision: "revision-1",
  inputs: [{ assetId: "boundary", sha256: "a".repeat(64), role: "geometry", mediaType: "application/geo+json", byteLength: 1200, declaredCrs: "WGS84" }],
  parameters: { operation: "weights", method: "queen" },
  limits: { maxInputBytes: 100_000, maxOutputBytes: 100_000, maxFeatures: 10_000, maxCoordinates: 100_000, maxCells: 10_000, maxPermutations: 0, timeoutMilliseconds: 5_000 },
  privacy: { recordValuesStayLocal: true, outputDisclosure: "aggregate", allowRecordLevelExport: false },
  requestedOutputs: [{ id: "weights", mediaType: "application/json", disclosure: "aggregate" }],
});
assert.equal(plan.schema, "epi-gis-advanced-plan/0.1");
assert.equal(gis.listAdvancedSpatialOperationsV01().length, 9);
assert.equal(gis.getAdvancedSpatialOperationV01("gis.spatial.moran").executionStatus, "planned");
assert.throws(() => gis.createAdvancedSpatialPlanV01({ ...plan, operation: "gis.unknown" }), /not registered/);
assert.throws(() => gis.createAdvancedSpatialPlanV01({ ...plan, privacy: { ...plan.privacy, recordValuesStayLocal: false } }), /recordValuesStayLocal/);
assert.throws(() => gis.createAdvancedSpatialPlanV01({ ...plan, parameters: { operation: "weights", method: "distance-band" } }), /thresholdMeters/);
assert.throws(() => gis.createAdvancedSpatialPlanV01({ ...plan, limits: { ...plan.limits, maxCells: 0 } }), /maxCells/);
console.log("GIS-K09-S1 contract smoke passed.");
