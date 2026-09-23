import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({ entryPoints: ["wasm/app/gis/index.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const gis = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const features = [
  { id: "b", centroid: [1.5, 0.5], boundary: [[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]] },
  { id: "a", centroid: [0.5, 0.5], boundary: [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]] },
  { id: "c", centroid: [0.5, 1.5], boundary: [[0, 1], [1, 1], [1, 2], [0, 2], [0, 1]] },
];

const queen = gis.createSpatialWeightsPlanV01({ planId: "queen", method: "queen", maxFeatures: 10 });
const queenResult = gis.buildSpatialWeightsV01(queen, features);
assert.deepEqual(queenResult.rows.map(({ id }) => id), ["a", "b", "c"]);
assert.deepEqual(queenResult.rows[0].neighbors.map(({ id }) => id), ["b", "c"]);
assert.equal(queenResult.rows[0].neighbors[0].weight, 0.5);

const rook = gis.buildSpatialWeightsV01(gis.createSpatialWeightsPlanV01({ planId: "rook", method: "rook", maxFeatures: 10 }), features);
assert.deepEqual(rook.rows.find(({ id }) => id === "a").neighbors.map(({ id }) => id), ["b", "c"]);

const distance = gis.buildSpatialWeightsV01(gis.createSpatialWeightsPlanV01({ planId: "distance", method: "distance-band", thresholdMeters: 120_000, maxFeatures: 10 }), features);
assert(distance.rows.every((row) => row.neighbors.every((neighbor) => Number.isFinite(neighbor.distanceMeters))));

const nearest = gis.buildSpatialWeightsV01(gis.createSpatialWeightsPlanV01({ planId: "nearest", method: "k-nearest", neighborCount: 1, maxFeatures: 10 }), features);
assert.deepEqual(nearest.rows.find(({ id }) => id === "a").neighbors.map(({ id }) => id), ["b"]);
assert.equal(nearest.rows.find(({ id }) => id === "a").neighbors[0].weight, 1);

assert.throws(() => gis.createSpatialWeightsPlanV01({ planId: "bad", method: "distance-band", maxFeatures: 10 }), /thresholdMeters/);
assert.throws(() => gis.buildSpatialWeightsV01(queen, [{ ...features[0], id: "a" }, { ...features[1], id: "a" }]), /duplicated/);
assert.equal(gis.buildSpatialWeightsV01(gis.createSpatialWeightsPlanV01({ planId: "isolated", method: "distance-band", thresholdMeters: 1, maxFeatures: 10 }), features).diagnostics.length, 3);
console.log("GIS-K09-S2 spatial weights smoke passed.");
