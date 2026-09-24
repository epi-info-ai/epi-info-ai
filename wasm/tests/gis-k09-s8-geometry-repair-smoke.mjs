import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({ entryPoints: ["wasm/app/gis/advanced-spatial-candidates.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const gis = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const features = [{ id: "poly", geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]] } }, { id: "line", geometry: { type: "LineString", coordinates: [[0, 0], [0, 0], [1, 1]] } }];
const reportPlan = gis.createGeometryRepairPlanV01({ planId: "report", policy: "report-only", preserveSource: true, maxFeatures: 10, maxCoordinates: 100 });
const report = gis.repairGeometryV01(reportPlan, features);
assert.equal(report.schema, "epi-gis-geometry-repair-result/0.1");
assert.equal(report.features.find(({ id }) => id === "poly").changed, false);
assert(report.diagnostics.some(({ code }) => code === "ring-not-closed"));
assert.equal(report.features.find(({ id }) => id === "poly").valid, false);
const repair = gis.repairGeometryV01(gis.createGeometryRepairPlanV01({ ...reportPlan, planId: "repair", policy: "bounded-repair" }), features);
const repairedPolygon = repair.features.find(({ id }) => id === "poly");
const repairedLine = repair.features.find(({ id }) => id === "line");
assert.equal(repairedPolygon.changed, true);
assert.deepEqual(repairedPolygon.repaired.coordinates[0][0], [0, 0]);
assert.deepEqual(repairedPolygon.repaired.coordinates[0].at(-1), [0, 0]);
assert.equal(repairedLine.changed, true);
assert.throws(() => gis.createGeometryRepairPlanV01({ ...reportPlan, preserveSource: false }), /preserveSource/);
const invalid = gis.repairGeometryV01(reportPlan, [{ id: "bad", geometry: { type: "Polygon", coordinates: [[[181, 0], [1, 0], [1, 1], [181, 0]]] } }]);
assert(invalid.diagnostics.some(({ code }) => code === "invalid-coordinate"));
const invalidPoints = gis.repairGeometryV01(reportPlan, [
  { id: "point", geometry: { type: "Point", coordinates: [181, 0] } },
  { id: "multipoint", geometry: { type: "MultiPoint", coordinates: [[0, 0], [0, 91]] } },
]);
assert.equal(invalidPoints.features.every(({ valid }) => valid === false), true);
assert.equal(invalidPoints.diagnostics.filter(({ code }) => code === "invalid-coordinate").length, 2);
assert.throws(() => gis.createGeometryRepairPlanV01({ ...reportPlan, maxFeatures: 10_001 }), /10000/);
assert.throws(() => gis.createGeometryRepairPlanV01({ ...reportPlan, maxCoordinates: 1_000_001 }), /1000000/);
console.log("GIS-K09-S8 geometry repair smoke passed.");
