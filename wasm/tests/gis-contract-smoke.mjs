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
    declaredCrs: "EPSG:4326",
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
assert.throws(() => module.inspectGeoJsonInputV01(fixture, { ...inspectPlan, inputs: [{ ...inspectPlan.inputs[0], declaredCrs: "unknown" }] }), /only explicitly declared WGS84/);
const conflictingCrs = new TextEncoder().encode(JSON.stringify({ type: "Feature", crs: { type: "name", properties: { name: "EPSG:3857" } }, properties: {}, geometry: { type: "Point", coordinates: [-83.55, 41.64] } })).buffer;
assert.throws(() => module.inspectGeoJsonInputV01(conflictingCrs, { ...inspectPlan, inputs: [{ ...inspectPlan.inputs[0], byteLength: conflictingCrs.byteLength, sha256: "c".repeat(64) }], limits: { ...inspectPlan.limits, maxInputBytes: conflictingCrs.byteLength } }), /conflicts with GIS-K03 WGS84-only/);
const hostile = new TextEncoder().encode(JSON.stringify({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [181, 41] } })).buffer;
assert.throws(() => module.inspectGeoJsonInputV01(hostile, { ...inspectPlan, inputs: [{ ...inspectPlan.inputs[0], byteLength: hostile.byteLength, sha256: "b".repeat(64) }] }), /valid longitude\/latitude range/);
const hostileCollection = new TextEncoder().encode(JSON.stringify({ type: "Feature", properties: {}, geometry: { type: "GeometryCollection", geometries: [{ type: "Point", coordinates: [-83.55, 41.64] }, { type: "Point", coordinates: [181, 41] }] } })).buffer;
assert.throws(() => module.inspectGeoJsonInputV01(hostileCollection, { ...inspectPlan, inputs: [{ ...inspectPlan.inputs[0], byteLength: hostileCollection.byteLength, sha256: "d".repeat(64) }], limits: { ...inspectPlan.limits, maxInputBytes: hostileCollection.byteLength } }), /valid longitude\/latitude range/);

assert.deepEqual(module.findWgs84UtmZone(41.64, -83.55), {
  zone: 17, hemisphere: "north", epsg: 32617, code: "EPSG:32617", centralMeridian: -81,
});
assert.deepEqual(module.findWgs84UtmZone(-33.86, 151.21).code, "EPSG:32756");
assert.equal(module.findWgs84UtmZone(60, 6).zone, 32); // Norway exception.
assert.equal(module.findWgs84UtmZone(78, 15).zone, 33); // Svalbard exception.
assert.equal(module.findWgs84UtmZones([[-83.55, 41.64]]).singleZone.code, "EPSG:32617");
assert.equal(module.findWgs84UtmZones([[-83.55, 41.64], [-77, 38]]).singleZone, null);
assert.throws(() => module.findWgs84UtmZone(85, 0), /80°S through 84°N/);

function zipStored(names, expandedSizes = []) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const put16 = (bytes, at, value) => { bytes[at] = value & 255; bytes[at + 1] = value >>> 8; };
  const put32 = (bytes, at, value) => { bytes[at] = value & 255; bytes[at + 1] = (value >>> 8) & 255; bytes[at + 2] = (value >>> 16) & 255; bytes[at + 3] = value >>> 24; };
  names.forEach((name, index) => {
    const nameBytes = new TextEncoder().encode(name);
    const size = expandedSizes[index] ?? 0;
    const local = new Uint8Array(30 + nameBytes.length);
    put32(local, 0, 0x04034b50); put16(local, 4, 20); put16(local, 8, 0); put16(local, 10, 0); put16(local, 26, nameBytes.length); local.set(nameBytes, 30);
    chunks.push(local);
    const entry = new Uint8Array(46 + nameBytes.length);
    put32(entry, 0, 0x02014b50); put16(entry, 4, 20); put16(entry, 6, 20); put16(entry, 8, 0); put16(entry, 10, 0); put32(entry, 20, size ? 1 : 0); put32(entry, 24, size); put16(entry, 28, nameBytes.length); put32(entry, 42, offset); entry.set(nameBytes, 46); central.push(entry);
    offset += local.length;
  });
  const centralBytes = central.reduce((total, value) => total + value.length, 0);
  const end = new Uint8Array(22); put32(end, 0, 0x06054b50); put16(end, 8, names.length); put16(end, 10, names.length); put32(end, 12, centralBytes); put32(end, 16, offset);
  const output = new Uint8Array(offset + centralBytes + end.length); let cursor = 0;
  for (const chunk of [...chunks, ...central, end]) { output.set(chunk, cursor); cursor += chunk.length; }
  return output.buffer;
}
const archiveLimits = { maxArchiveBytes: 10000, maxEntries: 10, maxExpandedBytes: 1000, maxEntryBytes: 500, maxCompressionRatio: 20 };
const shapefileZip = module.inspectZipArchiveV01(zipStored(["toledo.shp", "toledo.shx", "toledo.dbf"]), archiveLimits);
assert.deepEqual(shapefileZip.candidateFormats, ["Shapefile"]);
assert.throws(() => module.inspectZipArchiveV01(zipStored(["../escape.shp"]), archiveLimits), /Unsafe ZIP entry path/);
assert.throws(() => module.inspectZipArchiveV01(zipStored(["large.bin"], [500]), { ...archiveLimits, maxCompressionRatio: 20 }), /compression ratio/);

console.log("GIS contract smoke passed: four registered operations and defensive input validation.");
