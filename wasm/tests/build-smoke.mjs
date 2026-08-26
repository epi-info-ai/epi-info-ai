import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(testsDirectory, "../dist");

async function requireFile(relativePath) {
  const file = join(outputDirectory, relativePath);
  const metadata = await stat(file);
  assert.ok(metadata.isFile(), `${relativePath} must be a production file`);
  assert.ok(metadata.size > 0, `${relativePath} must not be empty`);
  return readFile(file, "utf8");
}

const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "app.js.map",
  "engine.js",
  "engine.js.map",
  "form-data.js",
  "form-data.js.map",
  "maps.js",
  "maps.js.map",
  "supabase-sync.js",
  "supabase-sync.js.map",
  "shell.js",
  "epi2x2.wasm",
  "sample-case-data.csv",
  "sample-map-layer.geojson",
  "vendor/leaflet/leaflet.js",
  "vendor/h3-js/h3-js.es.js",
  "setup/supabase-schema.sql",
  "build-manifest.json",
];
await Promise.all(requiredFiles.map(requireFile));

const html = await requireFile("index.html");
assert.match(html, /src=["']app\.js\?v=26["']/);
assert.match(html, /id=["']main-menu["']/);
assert.match(html, /id=["']epi-map["']/);

const app = await requireFile("app.js");
assert.match(app, /\.\/maps\.js\?v=11/);
assert.match(app, /\.\/form-data\.js\?v=18/);
assert.match(app, /\.\/supabase-sync\.js\?v=3/);
const maps = await requireFile("maps.js");
assert.match(maps, /MAP_PANE_Z_INDEX/);
assert.match(maps, /aggregateH3Cells/);

const manifest = JSON.parse(await requireFile("build-manifest.json"));
assert.equal(manifest.schemaVersion, 1);
assert.ok(manifest.sourceModules.includes("wasm/demo/app.js"));
assert.ok(manifest.sourceModules.includes("wasm/demo/supabase-sync.ts"));
assert.ok(manifest.outputs.includes("wasm/dist/app.js"));

const outputListing = JSON.stringify(manifest);
assert.doesNotMatch(outputListing, /\.secrets|gitlab_access_token/i);
console.log(`Production artifact baseline passed (${requiredFiles.length} required files).`);
