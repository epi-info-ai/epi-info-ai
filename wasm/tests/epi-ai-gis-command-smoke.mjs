import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const bundle = join(here, ".tmp-epi-ai-gis-command.mjs");
function dirname(path) { return path.replace(/[\\/][^\\/]*$/, ""); }

await build({ entryPoints: [join(here, "../app/programming/epi-ai-gis.ts")], bundle: true, format: "esm", platform: "node", outfile: bundle, logLevel: "silent" });
const command = await import(pathToFileURL(bundle).href);
const variables = [{ name: "SelectedAsset", scope: "STANDARD", variableType: "TEXTINPUT", value: "valid-control.geojson" }];
const plan = command.resolveEpiAiGisInspectCommand("EPIAI GIS INSPECT FILE=SelectedAsset RESULT=GisInspection CRS=CRS84", variables);
assert.equal(plan.fileVariable, "SelectedAsset");
assert.equal(plan.resultName, "GisInspection");
assert.equal(plan.declaredCrs, "CRS84");
assert.equal(plan.canonicalSource, "EPIAI GIS INSPECT FILE=SelectedAsset RESULT=GisInspection CRS=CRS84");
assert.throws(() => command.resolveEpiAiGisInspectCommand("EPIAI GIS INSPECT FILE=Missing RESULT=GisInspection CRS=CRS84", variables), /defined file variable/);
assert.throws(() => command.resolveEpiAiGisInspectCommand("EPIAI GIS INSPECT FILE=SelectedAsset RESULT=GisInspection CRS=UTM17N", variables), /requires exactly/);
await rm(bundle, { force: true });
console.log("EPIAI GIS command smoke passed.");
