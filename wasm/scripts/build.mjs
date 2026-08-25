import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const wasmDirectory = resolve(scriptsDirectory, "..");
const sourceDirectory = join(wasmDirectory, "demo");
const outputDirectory = join(wasmDirectory, "dist");
const maintainedModules = ["app", "engine", "form-data", "maps", "supabase-sync"];

async function existingSource(baseName) {
  for (const extension of [".ts", ".js"]) {
    const candidate = join(sourceDirectory, `${baseName}${extension}`);
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Continue to the transitional JavaScript source when a TypeScript module is absent.
    }
  }
  throw new Error(`Missing maintained browser module: ${baseName}`);
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await cp(sourceDirectory, outputDirectory, {
  recursive: true,
  filter: (source) => !relative(sourceDirectory, source).split(/[\\/]/).includes(".secrets"),
});

const entryPoints = await Promise.all(maintainedModules.map(existingSource));
const result = await build({
  entryPoints,
  outbase: sourceDirectory,
  outdir: outputDirectory,
  bundle: false,
  format: "esm",
  platform: "browser",
  target: "es2022",
  sourcemap: "external",
  legalComments: "inline",
  logLevel: "info",
  metafile: true,
  outExtension: { ".js": ".js" },
});

for (const source of entryPoints) {
  if (source.endsWith(".ts")) {
    await rm(join(outputDirectory, `${relative(sourceDirectory, source).slice(0, -3)}.ts`), { force: true });
  }
}

const packageManifest = JSON.parse(await readFile(resolve(wasmDirectory, "../package.json"), "utf8"));
const manifest = {
  schemaVersion: 1,
  applicationVersion: packageManifest.version,
  sourceModules: entryPoints.map((source) => relative(resolve(wasmDirectory, ".."), source).replaceAll("\\", "/")),
  outputs: Object.keys(result.metafile.outputs)
    .map((output) => relative(resolve(wasmDirectory, ".."), resolve(output)).replaceAll("\\", "/"))
    .sort(),
};
await writeFile(join(outputDirectory, "build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
