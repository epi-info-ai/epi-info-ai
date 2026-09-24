import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({ entryPoints: ["wasm/app/gis/advanced-spatial-candidates.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const gis = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const features = [
  { id: "a", centroid: [0, 0], boundary: [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]] },
  { id: "b", centroid: [1, 0], boundary: [[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]] },
  { id: "c", centroid: [2, 0], boundary: [[2, 0], [3, 0], [3, 1], [2, 1], [2, 0]] },
];
const weights = gis.buildSpatialWeightsV01(gis.createSpatialWeightsPlanV01({ planId: "weights", method: "rook", maxFeatures: 10 }), features);
const observations = [{ id: "a", value: 1 }, { id: "b", value: 2 }, { id: "c", value: 8 }];
const plan = gis.createGetisOrdPlanV01({ planId: "hotspots", permutations: 20, seed: 7, missingPolicy: "fail", includeSelf: true, maxObservations: 10 });
const result = gis.calculateGetisOrdGiStarV01(plan, weights, observations);
assert.equal(result.schema, "epi-gis-getis-ord-result/0.1");
assert.equal(result.statistic, "getis-ord-gi-star");
assert.equal(result.entries.length, 3);
assert(result.entries.every((entry) => Number.isFinite(entry.statistic) && Number.isFinite(entry.zScore) && Number.isFinite(entry.permutationPValue)));
for (const [id, expected] of [["a", -1.4018260516446992], ["b", -0.5391638660171918], ["c", 0.8626621856275073]]) {
  assert.ok(Math.abs(result.entries.find((entry) => entry.id === id).statistic - expected) < 1e-12);
}
assert.deepEqual(result, gis.calculateGetisOrdGiStarV01(plan, weights, observations));
const excluded = gis.calculateGetisOrdGiStarV01({ ...plan, missingPolicy: "exclude" }, weights, [{ ...observations[0] }, { ...observations[1], value: null }, observations[2]]);
assert.equal(excluded.diagnostics[0].code, "missing-value");
assert.throws(() => gis.calculateGetisOrdGiStarV01(plan, weights, [{ ...observations[0] }, { ...observations[1], value: null }, observations[2]]), /Missing or non-finite/);
assert.throws(() => gis.createGetisOrdPlanV01({ ...plan, includeSelf: false }), /includeSelf/);
console.log("GIS-K09-S4 Getis-Ord smoke passed.");
