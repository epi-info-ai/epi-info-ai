import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({ entryPoints: ["wasm/app/gis/point-layer.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const gis = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const records = [
  { id: "A", latitude: "41.64000", longitude: "-83.55000", status: "case" },
  { id: "B", latitude: "41.64010", longitude: "-83.55010", status: "control" },
  { id: "C", latitude: "", longitude: "-83.52", status: "case" },
  { id: "D", latitude: "91", longitude: "-83.52", status: "case" },
];
const preview = gis.buildPointLayerPreviewV01(records, { latitudeField: "latitude", longitudeField: "longitude", filter: { field: "status", operator: "equals", value: "case" } });
assert.equal(preview.inputCount, 4);
assert.equal(preview.validCount, 1);
assert.equal(preview.diagnostics.filter(({ code }) => code === "filtered").length, 1);
assert.equal(preview.diagnostics.filter(({ code }) => code === "missing-coordinate").length, 1);
assert.equal(preview.diagnostics.filter(({ code }) => code === "invalid-coordinate").length, 1);
assert.deepEqual(gis.summarizePointLayerDiagnosticsV01(preview.diagnostics), { filtered: 1, missingCoordinate: 1, invalidCoordinate: 1, limitExceeded: 0, totalSkipped: 3 });
assert.equal(gis.matchesPointLayerFilterV01(records[0], { field: "status", operator: "contains", value: "CAS" }), true);
assert.throws(() => gis.validatePointLayerFilterV01({ field: "status", operator: "equals" }), /comparison value/);
assert.deepEqual(gis.createPointLayerRecordRefV01("foodborne", 3), { sourceFormId: "foodborne", recordIndex: 3 });
assert.throws(() => gis.createPointLayerRecordRefV01("", 3), /source form/);
assert.throws(() => gis.createPointLayerRecordRefV01("foodborne", -1), /row index/);
const clustered = gis.clusterPointLayerV01(preview.points.concat([{ ...preview.points[0], recordIndex: 4 }]), 12);
assert.equal(clustered.length, 1);
assert.equal(clustered[0].isCluster, true);
assert.equal(clustered[0].points.length, 2);
assert.equal(gis.clusterPointLayerV01(preview.points.concat([{ ...preview.points[0], recordIndex: 4, latitude: 41.6401, longitude: -83.5501 }]), 18).length, 2);
console.log("GIS-K05 point-layer smoke passed.");
