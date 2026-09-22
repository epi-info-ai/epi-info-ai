import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({
  entryPoints: ["wasm/app/gis/index.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  write: false,
});
const module = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

const plan = {
  schema: "epi-gis-plan/0.1",
  id: "plan-1",
  operation: "gis.dataset.inspect",
  projectRevision: "revision-1",
  inputs: [{
    assetId: "asset-1",
    sha256: "a".repeat(64),
    role: "reference-geography",
    mediaType: "application/geo+json",
    byteLength: 10,
    declaredCrs: "unknown",
  }],
  parameters: {},
  limits: { maxInputBytes: 100, maxOutputBytes: 100, maxFeatures: 10, maxCoordinates: 100, maxNestingDepth: 20, maxProperties: 100, timeoutMilliseconds: 1000 },
  requestedOutputs: [{ id: "inventory", mediaType: "application/json", disclosure: "aggregate" }],
};

module.validateGisPlanV01(plan);
assert.equal(module.listGisOperationsV01().length, 4);
assert.equal(module.canonicalizeGisPlanV01(plan), module.canonicalizeGisPlanV01({ ...plan, requestedOutputs: [...plan.requestedOutputs] }));

assert.throws(
  () => module.validateGisPlanV01({ ...plan, unsafe: true }),
  (error) => error instanceof module.GisContractError && error.issues.some(({ code }) => code === "unknown-property"),
);

assert.throws(
  () => module.validateGisPlanV01({ ...plan, operation: "gdal.execute" }),
  (error) => error instanceof module.GisContractError && error.issues.some(({ path }) => path === "operation"),
);

const fixture = new TextEncoder().encode(JSON.stringify({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [-83.55, 41.64] } })).buffer;
const inspectPlan = { ...plan, inputs: [{ ...plan.inputs[0], mediaType: "application/geo+json", byteLength: fixture.byteLength, declaredCrs: "EPSG:4326" }], limits: { ...plan.limits, maxInputBytes: fixture.byteLength, maxNestingDepth: 20, maxProperties: 20 } };
assert.deepEqual(module.inspectGeoJsonInputV01(fixture, inspectPlan).extent, [-83.55, 41.64, -83.55, 41.64]);
assert.throws(() => module.inspectGeoJsonInputV01(fixture, { ...inspectPlan, inputs: [{ ...inspectPlan.inputs[0], mediaType: "application/zip" }] }), /only GeoJSON is supported/);
const hostile = new TextEncoder().encode(JSON.stringify({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [181, 41] } })).buffer;
assert.throws(() => module.inspectGeoJsonInputV01(hostile, { ...inspectPlan, inputs: [{ ...inspectPlan.inputs[0], byteLength: hostile.byteLength, sha256: "b".repeat(64) }] }), /valid longitude\/latitude range/);

assert.deepEqual(module.findWgs84UtmZone(41.64, -83.55), {
  zone: 17, hemisphere: "north", epsg: 32617, code: "EPSG:32617", centralMeridian: -81,
});
assert.deepEqual(module.findWgs84UtmZone(-33.86, 151.21).code, "EPSG:32756");
assert.equal(module.findWgs84UtmZone(60, 6).zone, 32); // Norway exception.
assert.equal(module.findWgs84UtmZone(78, 15).zone, 33); // Svalbard exception.
assert.equal(module.findWgs84UtmZones([[-83.55, 41.64]]).singleZone.code, "EPSG:32617");
assert.equal(module.findWgs84UtmZones([[-83.55, 41.64], [-77, 38]]).singleZone, null);
assert.throws(() => module.findWgs84UtmZone(85, 0), /80°S through 84°N/);

console.log("GIS contract smoke passed: four registered operations and defensive input validation.");
