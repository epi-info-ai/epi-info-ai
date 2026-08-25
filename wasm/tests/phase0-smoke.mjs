import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testsDirectory, "../..");
const demoDirectory = join(repositoryRoot, "wasm/demo");
const fixturesDirectory = join(testsDirectory, "fixtures/phase0");

function repositoryPath(relativePath) {
  return join(repositoryRoot, ...relativePath.split("/"));
}

async function jsonFixture(name) {
  return JSON.parse(await readFile(join(fixturesDirectory, name), "utf8"));
}

function near(actual, expected, tolerance, label) {
  assert.equal(typeof actual, "number", `${label} must be numeric`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, received ${actual}`);
}

async function assertFile(relativePath) {
  const file = repositoryPath(relativePath);
  const metadata = await stat(file);
  assert.ok(metadata.isFile(), `${relativePath} must be a file`);
  assert.ok(metadata.size > 0, `${relativePath} must not be empty`);
}

async function checkRequiredAssetsAndUi() {
  const requiredFiles = [
    "wasm/demo/index.html",
    "wasm/demo/styles.css",
    "wasm/demo/app.js",
    "wasm/demo/engine.js",
    "wasm/demo/form-data.js",
    "wasm/demo/maps.js",
    "wasm/demo/shell.js",
    "wasm/demo/supabase-sync.js",
    "wasm/demo/epi2x2.wasm",
    "wasm/demo/sample-case-data.csv",
    "wasm/demo/sample-map-layer.geojson",
    "wasm/demo/vendor/leaflet/leaflet.css",
    "wasm/demo/vendor/leaflet/leaflet.js",
    "wasm/demo/vendor/leaflet/LICENSE",
    "wasm/demo/setup/supabase-schema.sql",
  ];
  await Promise.all(requiredFiles.map(assertFile));

  const html = await readFile(join(demoDirectory, "index.html"), "utf8");
  const requiredIds = [
    "main-menu",
    "main-menu-button",
    "new-project",
    "project-storage",
    "form-csv-import",
    "save-form",
    "snap-to-grid",
    "record-form",
    "csv-import",
    "csv-export",
    "enter-open-maps",
    "epi-map",
    "map-add-case-cluster",
    "map-add-geojson",
    "map-fullscreen-toggle",
    "geojson-dialog",
    "geojson-file",
    "geojson-label-field",
    "map-geojson-layers",
    "table-form",
    "project-storage-dialog",
    "project-storage-status",
  ];
  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `index.html must retain #${id}`);
  }

  for (const label of ["Create Forms", "Enter Data", "Classic", "Visual Dashboard", "Create Maps", "StatCalc"]) {
    assert.ok(html.includes(label), `main application must retain the familiar ${label} label`);
  }

  const localAssetReferences = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((reference) => !reference.startsWith("#") && !/^(?:https?:|data:|mailto:)/.test(reference));
  for (const reference of localAssetReferences) {
    const withoutQuery = reference.split(/[?#]/, 1)[0];
    await assertFile(`wasm/demo/${withoutQuery}`);
  }
}

async function checkJavaScriptSyntax() {
  const maintainedScripts = ["app.js", "engine.js", "form-data.js", "maps.js", "shell.js", "supabase-sync.js"];
  for (const script of maintainedScripts) {
    execFileSync(process.execPath, ["--check", join(demoDirectory, script)], { stdio: "pipe" });
  }
}

async function checkWasmArtifact() {
  const manifest = await jsonFixture("wasm-manifest.json");
  const bytes = await readFile(repositoryPath(manifest.file));
  assert.equal(bytes.length, manifest.size, "WASM artifact size changed; review and update its manifest deliberately");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest.sha256, "WASM checksum changed; review numerical provenance before accepting it");
  assert.deepEqual([...bytes.subarray(0, 8)], [0, 97, 115, 109, 1, 0, 0, 0], "WASM header/version is invalid");
  const module = await WebAssembly.compile(bytes);
  const exportNames = new Set(WebAssembly.Module.exports(module).map((item) => item.name));
  for (const requiredExport of manifest.requiredExports) {
    assert.ok(exportNames.has(requiredExport), `WASM export ${requiredExport} is missing`);
  }
}

async function importEngineWithFileFetch() {
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const target = input instanceof Request ? new URL(input.url) : input instanceof URL ? input : new URL(String(input));
    if (target.protocol === "file:") {
      const body = await readFile(fileURLToPath(target));
      return new Response(body, { status: 200, headers: { "content-type": "application/wasm" } });
    }
    return nativeFetch(input, init);
  };
  try {
    return await import(`${pathToFileURL(join(demoDirectory, "engine.js")).href}?phase0=${Date.now()}`);
  } finally {
    globalThis.fetch = nativeFetch;
  }
}

async function checkTable2x2Contract() {
  const fixture = await jsonFixture("table2x2-baseline.json");
  const { calculateTable2x2 } = await importEngineWithFileFetch();
  const result = calculateTable2x2(fixture.input);
  const tolerance = fixture.absoluteTolerance;

  assert.equal(result.schemaVersion, fixture.contract.schemaVersion);
  assert.equal(result.operation, fixture.contract.operation);
  assert.equal(result.engine.id, fixture.contract.engineId);
  assert.equal(result.engine.version, fixture.contract.engineVersion);
  assert.deepEqual(result.input, fixture.input);
  assert.deepEqual(result.totals, fixture.expected.totals);
  near(result.estimates.riskExposed, fixture.expected.riskExposed, tolerance, "risk among exposed");
  near(result.estimates.riskUnexposed, fixture.expected.riskUnexposed, tolerance, "risk among unexposed");
  near(result.estimates.riskRatio.estimate, fixture.expected.riskRatio, tolerance, "risk ratio");
  near(result.estimates.oddsRatio.estimate, fixture.expected.oddsRatio, tolerance, "odds ratio");
  near(result.estimates.riskDifference.estimate, fixture.expected.riskDifference, tolerance, "risk difference");
  near(result.tests.pearson.value, fixture.expected.pearsonChiSquare, tolerance, "Pearson chi-square");
  near(result.tests.mantelHaenszel.value, fixture.expected.mantelHaenszelChiSquare, tolerance, "Mantel-Haenszel chi-square");
  near(result.tests.yates.value, fixture.expected.yatesChiSquare, tolerance, "Yates chi-square");
  assert.deepEqual(result.diagnostics.expectedCellCounts, fixture.expected.expectedCellCounts);
  assert.deepEqual(result.diagnostics.warnings, []);
  assert.ok(result.tests.fisherExact.twoTailed >= 0 && result.tests.fisherExact.twoTailed <= 1);

  assert.throws(() => calculateTable2x2({ ...fixture.input, exposedCases: -1 }), /non-negative whole numbers/);
  assert.throws(() => calculateTable2x2({ ...fixture.input, confidenceLevel: 0.8 }), /Confidence level/);
  assert.throws(() => calculateTable2x2({ exposedCases: 0, exposedNonCases: 0, unexposedCases: 0, unexposedNonCases: 0, confidenceLevel: 0.95 }), /at least one observation/i);
  const sparse = calculateTable2x2({ exposedCases: 0, exposedNonCases: 10, unexposedCases: 2, unexposedNonCases: 8, confidenceLevel: 0.95 });
  assert.ok(sparse.diagnostics.warnings.some((warning) => warning.includes("zero")));
}

async function checkCsvAndProjectFixtures() {
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
    clear: () => memory.clear(),
  };
  const module = await import(`${pathToFileURL(join(demoDirectory, "form-data.js")).href}?phase0=${Date.now()}`);
  const csv = await readFile(join(fixturesDirectory, "csv-roundtrip.csv"), "utf8");
  const rows = module.parseCsv(csv);
  assert.equal(rows.length, 4);
  assert.equal(rows[2][4], 'Said "better" today');
  assert.equal(rows[3][4], "Unicode name: José");

  const inferred = module.inferSchemaFromCsv("phase0_cases.csv", rows);
  assert.equal(inferred.schema.name, "Phase0 Cases Form");
  assert.deepEqual(inferred.schema.fields.map((field) => field.name), rows[0]);
  assert.deepEqual(inferred.schema.fields.map((field) => field.type), ["text", "date", "yes-no", "number", "text", "number", "number"]);
  assert.equal(inferred.records.length, 3);

  const serializedRows = module.parseCsv(module.serializeCsv(inferred.schema, inferred.records));
  assert.deepEqual(serializedRows, rows);
  assert.equal(module.alignToGrid(19, 12), 24);
  assert.equal(module.alignToGrid(5, 12), 0);

  const snapshot = await jsonFixture("project-snapshot-v1.json");
  assert.ok(snapshot.name);
  assert.ok(snapshot.forms.length > 0);
  assert.ok(snapshot.forms.some((form) => form.id === snapshot.currentFormId));
  for (const form of snapshot.forms) {
    const names = form.schema.fields.map((field) => field.name);
    assert.equal(new Set(names).size, names.length, `${form.id} field names must be unique`);
    assert.ok(form.schema.fields.every((field) => field.name && field.prompt && field.type));
    assert.ok(Array.isArray(form.records));
  }
}

async function checkMapFixture() {
  const fixture = await jsonFixture("map-points.json");
  const { extractMapPoints, inferMapFields, listGeoJsonPolygonProperties, parseGeoJson } = await import(`${pathToFileURL(join(demoDirectory, "maps.js")).href}?phase0=${Date.now()}`);
  const points = extractMapPoints(fixture.records, fixture.latitudeField, fixture.longitudeField);
  assert.deepEqual(points.map(({ recordIndex, latitude, longitude }) => ({ recordIndex, latitude, longitude })), fixture.expected);
  assert.deepEqual(inferMapFields([
    { name: "case_number", prompt: "Case ID" },
    { name: "x_coordinate", prompt: "Longitude" },
    { name: "y_coordinate", prompt: "Latitude" },
  ]), { latitude: "y_coordinate", longitude: "x_coordinate", label: "case_number" });
  const geoJsonFixture = await readFile(join(fixturesDirectory, "geojson-layer.json"), "utf8");
  const parsed = parseGeoJson(geoJsonFixture);
  assert.equal(parsed.geojson.type, "FeatureCollection");
  assert.equal(parsed.featureCount, 3);
  assert.deepEqual(listGeoJsonPolygonProperties(parsed.geojson), ["name", "status"]);
  assert.throws(() => parseGeoJson("not json"), /not valid JSON/);
  assert.throws(() => parseGeoJson('{"type":"FeatureCollection","features":[{},{}]}'), /must be a Feature/);
  assert.throws(() => parseGeoJson(geoJsonFixture, 2), /demo limit/);
}

async function checkSupabaseSetupContract() {
  const sql = (await readFile(join(demoDirectory, "setup/supabase-schema.sql"), "utf8")).toLowerCase();
  for (const requirement of [
    "create table if not exists public.epi_projects",
    "enable row level security",
    "auth.uid()",
    "revoke all on table public.epi_projects from anon",
    "grant select, insert, update, delete on table public.epi_projects to authenticated",
  ]) {
    assert.ok(sql.includes(requirement), `Supabase setup must retain: ${requirement}`);
  }
}

async function run() {
  const checks = [
    ["required assets and familiar UI landmarks", checkRequiredAssetsAndUi],
    ["maintained JavaScript syntax", checkJavaScriptSyntax],
    ["WASM checksum and exports", checkWasmArtifact],
    ["2 x 2 result contract", checkTable2x2Contract],
    ["CSV, grid, and project fixtures", checkCsvAndProjectFixtures],
    ["map coordinate filtering", checkMapFixture],
    ["Supabase RLS setup contract", checkSupabaseSetupContract],
  ];

  for (const [name, check] of checks) {
    await check();
    console.log(`PASS ${name}`);
  }
  console.log(`Phase 0 automated baseline passed (${checks.length} checks).`);
}

await run();
