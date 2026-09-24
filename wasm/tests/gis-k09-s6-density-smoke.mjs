import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({ entryPoints: ["wasm/app/gis/advanced-spatial-candidates.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const gis = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const plan = gis.createDensityPlanV01({ planId: "density", bandwidthMeters: 10_000, cellSizeMeters: 10_000, maxObservations: 10, maxCells: 100 });
const observations = [
  { id: "a", latitude: 40, longitude: -74, weight: 2 },
  { id: "b", latitude: 40.1, longitude: -74.1, weight: 1 },
  { id: "missing", latitude: null, longitude: -74 },
];
const result = gis.calculateDensityV01(plan, observations);
assert.equal(result.schema, "epi-gis-density-result/0.1");
assert.equal(result.method, "gaussian-kernel-equirectangular");
assert(result.cells.length > 0 && result.cells.length <= 100);
assert(result.cells.every(({ density }) => Number.isFinite(density) && density >= 0));
assert.equal(result.diagnostics[0].code, "missing-coordinate");
assert.deepEqual(result, gis.calculateDensityV01(plan, observations));
assert.equal(gis.calculateDensityV01(plan, [observations[0], { ...observations[1], latitude: 91 }]).diagnostics[0].code, "invalid-coordinate");
assert.throws(() => gis.calculateDensityV01({ ...plan, maxCells: 1 }, observations), /exceeding maxCells/);
assert.throws(() => gis.createDensityPlanV01({ ...plan, bandwidthMeters: 0 }), /bandwidthMeters/);
assert.throws(() => gis.createDensityPlanV01({ ...plan, maxObservations: 50_001 }), /50000/);
assert.throws(() => gis.createDensityPlanV01({ ...plan, maxObservations: 5_000, maxCells: 1_001 }), /5000000/);
console.log("GIS-K09-S6 density smoke passed.");
