import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({ entryPoints: ["wasm/app/gis/index.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const gis = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const observations = [
  { id: "a", latitude: 40, longitude: -74 },
  { id: "b", latitude: 40.01, longitude: -74.01 },
  { id: "c", latitude: 40.02, longitude: -74.02 },
  { id: "far", latitude: 41, longitude: -75 },
  { id: "missing", latitude: null, longitude: -74 },
];
const dbscan = gis.detectSpatialClustersV01(gis.createSpatialClusterPlanV01({ planId: "dbscan", method: "dbscan", radiusMeters: 5_000, minPoints: 2, maxObservations: 10 }), observations);
assert.equal(dbscan.schema, "epi-gis-spatial-cluster-result/0.1");
assert.equal(dbscan.clusters.length, 1);
assert.deepEqual(dbscan.clusters[0].memberIds, ["a", "b", "c"]);
assert.deepEqual(dbscan.noiseIds, ["far"]);
assert.equal(dbscan.diagnostics[0].code, "missing-coordinate");
assert.deepEqual(dbscan, gis.detectSpatialClustersV01(gis.createSpatialClusterPlanV01({ planId: "dbscan", method: "dbscan", radiusMeters: 5_000, minPoints: 2, maxObservations: 10 }), observations));
const scan = gis.detectSpatialClustersV01(gis.createSpatialClusterPlanV01({ planId: "scan", method: "scan-circle", radiusMeters: 5_000, minPoints: 2, maxObservations: 10 }), observations);
assert(scan.clusters.length >= 1);
assert(scan.clusters.every(({ overlapping }) => overlapping));
assert.throws(() => gis.detectSpatialClustersV01(gis.createSpatialClusterPlanV01({ planId: "bad", method: "dbscan", radiusMeters: 5_000, minPoints: 2, maxObservations: 10 }), [{ id: "only", latitude: 40, longitude: -74 }]), /At least minPoints/);
assert.throws(() => gis.createSpatialClusterPlanV01({ planId: "bad", method: "dbscan", radiusMeters: 0, minPoints: 2, maxObservations: 10 }), /radiusMeters/);
console.log("GIS-K09-S7 spatial cluster smoke passed.");
