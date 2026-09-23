import assert from "node:assert/strict";
import { build } from "esbuild";
import { zipSync } from "fflate";

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
    put32(local, 0, 0x04034b50); put16(local, 4, 20); put16(local, 8, 0); put16(local, 10, 0); put32(local, 18, size ? 1 : 0); put32(local, 22, size); put16(local, 26, nameBytes.length); local.set(nameBytes, 30);
    chunks.push(local, new Uint8Array(size ? 1 : 0));
    const entry = new Uint8Array(46 + nameBytes.length);
    put32(entry, 0, 0x02014b50); put16(entry, 4, 20); put16(entry, 6, 20); put16(entry, 8, 0); put16(entry, 10, 0); put32(entry, 20, size ? 1 : 0); put32(entry, 24, size); put16(entry, 28, nameBytes.length); put32(entry, 42, offset); entry.set(nameBytes, 46); central.push(entry);
    offset += local.length + (size ? 1 : 0);
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
assert.throws(() => module.inspectZipArchiveV01(zipStored(["cases.shp", "CASES.SHP"]), archiveLimits), /duplicate or colliding/);
assert.throws(() => module.inspectReferenceLayerPackageV01(zipStored(["cases.shp", "cases.shx", "cases.dbf", "cases.exe"]), archiveLimits), /entry type is not allowed/);
const trailingZip = new Uint8Array(zipStored(["cases.shp", "cases.shx", "cases.dbf"]));
assert.throws(() => module.inspectZipArchiveV01(new Uint8Array([...trailingZip, 0x01]).buffer, archiveLimits), /trailing data/);
const verifiedZip = zipSync({ "layers/toledo.shp": new Uint8Array([1, 2, 3]), "layers/toledo.shx": new Uint8Array([4]), "layers/toledo.dbf": new Uint8Array([5, 6]), "layers/toledo.prj": new Uint8Array([7]) });
const verifiedComponents = await module.extractVerifiedShapefileZipV01(verifiedZip.buffer, { ...archiveLimits, maxExpandedBytes: 100 });
assert.deepEqual(verifiedComponents.map(({ name, byteLength }) => [name, byteLength]), [["layers/toledo.shp", 3], ["layers/toledo.shx", 1], ["layers/toledo.dbf", 2], ["layers/toledo.prj", 1]]);
assert.rejects(() => module.extractVerifiedShapefileZipV01(zipSync({ "layers/toledo.shp": new Uint8Array([1]), "layers/toledo.shx": new Uint8Array([2]), "layers/toledo.dbf": new Uint8Array([3]), "layers/other.shp": new Uint8Array([4]), "layers/other.shx": new Uint8Array([5]), "layers/other.dbf": new Uint8Array([6]) }).buffer, archiveLimits), /exactly one complete Shapefile/);
const referenceInspection = module.inspectReferenceLayerPackageV01(zipStored(["layers/toledo.shp", "layers/toledo.shx", "layers/toledo.dbf", "layers/toledo.prj"]), archiveLimits);
assert.equal(referenceInspection.candidates[0].format, "Shapefile");
assert.equal(referenceInspection.candidates[0].completeness, "complete");
assert.equal(referenceInspection.candidates[0].crsState, "sidecar-present");
assert.equal(module.chooseReferenceLayerCandidateV01(referenceInspection, referenceInspection.candidates[0].id).normalizationStatus, "planned");
const incompleteReference = module.inspectReferenceLayerPackageV01(zipStored(["layers/toledo.shp", "layers/toledo.shx"]), archiveLimits);
assert.throws(() => module.chooseReferenceLayerCandidateV01(incompleteReference, incompleteReference.candidates[0].id), /incomplete/);
assert.throws(() => module.inspectReferenceLayerPackageV01(new TextEncoder().encode("not-a-package").buffer, archiveLimits), /must be a ZIP Shapefile bundle or a GeoPackage/);
const noPrjReference = module.inspectReferenceLayerPackageV01(zipStored(["layers/toledo.shp", "layers/toledo.shx", "layers/toledo.dbf"]), archiveLimits);
assert.equal(noPrjReference.candidates[0].crsState, "unknown");
assert.equal(module.reviewReferenceLayerCrsV01(noPrjReference.candidates[0], "unknown").status, "rejected-unknown");
assert.throws(() => module.inspectReferenceLayerPackageV01(zipStored(["../escape.shp"]), archiveLimits), /Unsafe ZIP entry path/);
const gpkgHeader = new Uint8Array(16); gpkgHeader.set(new TextEncoder().encode("SQLite format 3\0"));
assert.equal(module.inspectReferenceLayerPackageV01(gpkgHeader.buffer, archiveLimits).packageFormat, "GeoPackage");
assert.throws(() => module.inspectReferenceLayerPackageV01(gpkgHeader.buffer, { ...archiveLimits, maxArchiveBytes: 8 }), /exceeds the maxArchiveBytes/);
const reviewedCandidate = module.chooseReferenceLayerCandidateV01(referenceInspection, referenceInspection.candidates[0].id);
assert.deepEqual(module.reviewReferenceLayerCrsV01(reviewedCandidate, "CRS84"), { declaredCrs: "CRS84", status: "accepted-wgs84", normalizationRequired: false });
assert.deepEqual(module.reviewReferenceLayerCrsV01(reviewedCandidate, "EPSG:3857"), { declaredCrs: "EPSG:3857", status: "requires-reprojection", normalizationRequired: true });
assert.deepEqual(module.reviewReferenceLayerCrsV01(reviewedCandidate, "unknown"), { declaredCrs: "unknown", status: "rejected-unknown", normalizationRequired: true });
const lineage = module.createReferenceLayerLineageV01({ planId: "plan-reference-1", fileName: "toledo.zip", sha256: "A".repeat(64), byteLength: 512, packageFormat: "ZIP", candidate: reviewedCandidate, crsReview: module.reviewReferenceLayerCrsV01(reviewedCandidate, "CRS84") });
assert.deepEqual(lineage, { schema: "epi-gis-reference-lineage/0.1", planId: "plan-reference-1", source: { fileName: "toledo.zip", sha256: "a".repeat(64), byteLength: 512, packageFormat: "ZIP" }, selection: { candidateId: reviewedCandidate.id, format: "Shapefile", entries: ["layers/toledo.dbf", "layers/toledo.prj", "layers/toledo.shp", "layers/toledo.shx"] }, crs: { declaredCrs: "CRS84", targetCrs: "CRS84", normalizationRequired: false }, status: "reviewed", persistence: "not-persisted" });
assert.deepEqual(module.persistReferenceLayerLineageV01(lineage, "b".repeat(64)), { ...lineage, derivedAssetId: "b".repeat(64), persistence: "project-snapshot" });
assert.throws(() => module.createReferenceLayerLineageV01({ planId: "plan-reference-2", fileName: "toledo.zip", sha256: "b".repeat(64), byteLength: 512, packageFormat: "ZIP", candidate: reviewedCandidate, crsReview: module.reviewReferenceLayerCrsV01(reviewedCandidate, "unknown") }), /unknown CRS/);
const normalizationPlan = module.createReferenceLayerNormalizationPlanV01(lineage, { maxInputBytes: 1000, maxOutputBytes: 2000, maxFeatures: 100, maxCoordinates: 1000 });
assert.deepEqual(normalizationPlan, { schema: "epi-gis-reference-normalize/0.1", planId: "plan-reference-1", source: { candidateId: reviewedCandidate.id, format: "Shapefile", declaredCrs: "CRS84", sha256: "a".repeat(64), byteLength: 512 }, targetCrs: "CRS84", outputFormat: "GeoJSON", limits: { maxInputBytes: 1000, maxOutputBytes: 2000, maxFeatures: 100, maxCoordinates: 1000 }, executionStatus: "planned" });
assert.deepEqual(module.buildReferenceLayerGdalRequestV01(normalizationPlan), { sourceKind: "zip-shapefile", openVirtualFileSystems: ["vsizip"], ogr2ogrArguments: ["-f", "GeoJSON", "-s_srs", "EPSG:4326", "-t_srs", "EPSG:4326", "-lco", "RFC7946=YES"], outputName: "reference-plan-reference-1", limits: normalizationPlan.limits });
const projectedNormalizationPlan = module.createReferenceLayerNormalizationPlanV01({ ...lineage, crs: { declaredCrs: "EPSG:3857", targetCrs: "CRS84", normalizationRequired: true }, status: "requires-reprojection" }, { maxInputBytes: 1000, maxOutputBytes: 2000, maxFeatures: 100, maxCoordinates: 1000 });
assert.deepEqual(module.buildReferenceLayerGdalRequestV01(projectedNormalizationPlan).ogr2ogrArguments.slice(0, 8), ["-f", "GeoJSON", "-s_srs", "EPSG:3857", "-t_srs", "EPSG:4326", "-lco", "RFC7946=YES"]);
const geopackageCandidate = { ...reviewedCandidate, id: "geopackage:root", format: "GeoPackage", displayName: "GeoPackage database", entries: [] };
const geopackageLineage = module.createReferenceLayerLineageV01({ planId: "plan-reference-gpkg", fileName: "boundaries.gpkg", sha256: "e".repeat(64), byteLength: 1024, packageFormat: "GeoPackage", candidate: geopackageCandidate, crsReview: module.reviewReferenceLayerCrsV01(geopackageCandidate, "CRS84"), layerName: "case_sites" });
const geopackagePlan = module.createReferenceLayerNormalizationPlanV01(geopackageLineage, { maxInputBytes: 1000, maxOutputBytes: 2000, maxFeatures: 100, maxCoordinates: 1000 });
assert.deepEqual(module.buildReferenceLayerGdalRequestV01(geopackagePlan).ogr2ogrArguments, ["-f", "GeoJSON", "-s_srs", "EPSG:4326", "-t_srs", "EPSG:4326", "-lco", "RFC7946=YES", "-dialect", "SQLite", "-sql", 'SELECT * FROM "case_sites"']);
assert.throws(() => module.createReferenceLayerLineageV01({ planId: "plan-reference-gpkg-missing", fileName: "boundaries.gpkg", sha256: "f".repeat(64), byteLength: 1024, packageFormat: "GeoPackage", candidate: geopackageCandidate, crsReview: module.reviewReferenceLayerCrsV01(geopackageCandidate, "CRS84") }), /explicit layer name/);

console.log("GIS contract smoke passed: four registered operations and defensive input validation.");
