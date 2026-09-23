import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({ entryPoints: ["wasm/app/gis/index.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const gis = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const indexer = (latitude, longitude, resolution) => `r${resolution}-${Math.floor(latitude)}-${Math.floor(longitude)}`;
const observations = [
  { id: "a", latitude: 40.1, longitude: -74.1, value: 10 },
  { id: "b", latitude: 40.2, longitude: -74.2, value: 20 },
  { id: "c", latitude: 41, longitude: -75, value: 5 },
  { id: "missing", latitude: null, longitude: -74, value: 1 },
];
const plan = gis.createH3AggregatePlanV01({ planId: "h3", resolution: 8, aggregation: "sum", maxObservations: 10, maxCells: 10 });
const result = gis.aggregateH3V01(plan, observations, indexer);
assert.equal(result.schema, "epi-gis-h3-aggregate-result/0.1");
assert.equal(result.cells.length, 2);
assert.deepEqual(result.cells.map(({ cell }) => cell), ["r8-40--75", "r8-41--75"]);
assert.equal(result.cells[0].sum, 30);
assert.equal(result.cells[0].mean, null);
assert.equal(result.diagnostics[0].code, "missing-coordinate");
const mean = gis.aggregateH3V01(gis.createH3AggregatePlanV01({ ...plan, planId: "mean", aggregation: "mean" }), observations, indexer);
assert.equal(mean.cells[0].mean, 15);
const count = gis.aggregateH3V01(gis.createH3AggregatePlanV01({ ...plan, planId: "count", aggregation: "count" }), [{ ...observations[0], value: null }], indexer);
assert.equal(count.cells[0].count, 1);
assert.equal(count.cells[0].sum, null);
assert.equal(gis.aggregateH3V01(plan, [{ ...observations[0], latitude: 91 }], indexer).diagnostics[0].code, "invalid-coordinate");
assert(gis.aggregateH3V01({ ...plan, maxCells: 1 }, observations, indexer).diagnostics.some(({ code }) => code === "cell-limit"));
assert.throws(() => gis.createH3AggregatePlanV01({ ...plan, resolution: 16 }), /resolution/);
console.log("GIS-K09-S5 H3 aggregation smoke passed.");
