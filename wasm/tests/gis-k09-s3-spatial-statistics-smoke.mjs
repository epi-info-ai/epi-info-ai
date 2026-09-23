import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({ entryPoints: ["wasm/app/gis/index.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const gis = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const features = [
  { id: "a", centroid: [0, 0], boundary: [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]] },
  { id: "b", centroid: [1, 0], boundary: [[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]] },
  { id: "c", centroid: [2, 0], boundary: [[2, 0], [3, 0], [3, 1], [2, 1], [2, 0]] },
];
const weights = gis.buildSpatialWeightsV01(gis.createSpatialWeightsPlanV01({ planId: "weights", method: "rook", maxFeatures: 10 }), features);
const observations = [{ id: "a", value: 1 }, { id: "b", value: 2 }, { id: "c", value: 4 }];

const moranPlan = gis.createMoranLisaPlanV01({ planId: "moran", statistic: "moran", permutations: 20, seed: 42, missingPolicy: "fail", maxObservations: 10 });
const moran = gis.calculateMoranLisaV01(moranPlan, weights, observations);
assert.equal(moran.result.statistic, "moran");
assert.equal(moran.result.observationsUsed, 3);
assert.equal(moran.result.permutations, 20);
assert(Number.isFinite(moran.result.value));
assert(Number.isFinite(moran.result.permutationPValue));
assert.equal(moran.validationStatus, "candidate");
assert.deepEqual(moran, gis.calculateMoranLisaV01(moranPlan, weights, observations));

const lisaPlan = gis.createMoranLisaPlanV01({ planId: "lisa", statistic: "lisa", permutations: 10, seed: 42, missingPolicy: "exclude", maxObservations: 10 });
const lisa = gis.calculateMoranLisaV01(lisaPlan, weights, observations);
assert.equal(lisa.result.length, 3);
assert(lisa.result.every((entry) => Number.isFinite(entry.localI) && Number.isFinite(entry.permutationPValue)));
assert(lisa.result.every((entry) => entry.quadrant !== "no-data"));

const excluded = gis.calculateMoranLisaV01(lisaPlan, weights, [{ ...observations[0] }, { ...observations[1], value: null }, observations[2]]);
assert.equal(excluded.diagnostics[0].code, "missing-value");
assert.throws(() => gis.calculateMoranLisaV01(moranPlan, weights, [{ ...observations[0] }, { ...observations[1], value: null }, observations[2]]), /Missing or non-finite/);
assert.throws(() => gis.createMoranLisaPlanV01({ ...moranPlan, permutations: 100_001 }), /permutations/);
console.log("GIS-K09-S3 spatial statistics smoke passed.");
