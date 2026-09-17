import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const initGdalJs = require("gdal3.js/node.js");
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repository = resolve(scriptDirectory, "../..");
const sourcePath = resolve(repository, "wasm/demo/examples/foodborne/maps/worldpop-toledo-population-density.tif");
const outputPath = resolve(repository, "wasm/demo/examples/gdal-wasm/cog-offline/toledo-population-cog.tif");
const expectedSourceSha256 = "cf7ec32de75d9b782a141e0e8e361216d9c74a71b467486aaa4f0c1782060df1";

const sourceBytes = await readFile(sourcePath);
const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
if (sourceSha256 !== expectedSourceSha256) throw new Error("The source raster differs from the reviewed COG-generation input.");

const gdal = await initGdalJs({ useWorker: false });
const opened = await gdal.open(sourcePath);
if (opened.datasets.length !== 1) throw new Error("The COG generator could not open its source raster.");
const dataset = opened.datasets[0];
const argumentsList = [
  "-of", "COG", "-outsize", "2048", "0", "-r", "bilinear",
  "-co", "COMPRESS=DEFLATE", "-co", "BLOCKSIZE=256", "-co", "OVERVIEWS=IGNORE_EXISTING",
];
const generated = await gdal.gdal_translate(dataset, argumentsList, "toledo-population-cog");
const outputBytes = await gdal.getFileBytes(generated);
await gdal.close(dataset);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, outputBytes);
const outputSha256 = createHash("sha256").update(outputBytes).digest("hex");
process.stdout.write(`${JSON.stringify({ sourcePath, outputPath, sourceSha256, outputSha256, bytes: outputBytes.byteLength, arguments: argumentsList }, null, 2)}\n`);
