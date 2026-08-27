import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const wasmDirectory = resolve(scriptsDirectory, "..");
const sourceDirectory = join(wasmDirectory, "demo");
const outputDirectory = join(wasmDirectory, "dist");
const validationFixtureDirectory = join(outputDirectory, "validation-fixtures");
const maintainedModules = [
  "app",
  "engine",
  "form-data",
  "maps",
  "shell",
  "stratified-worker",
  "stratified-worker-client",
  "supabase-sync",
];
const bundledModules = new Set(["form-data", "supabase-sync"]);

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
  filter: (source) => (
    !relative(sourceDirectory, source).split(/[\\/]/).includes(".secrets")
    && !source.endsWith(".ts")
  ),
});
await mkdir(validationFixtureDirectory, { recursive: true });
await cp(
  join(wasmDirectory, "tests/fixtures/phase0/table2x2-baseline.json"),
  join(validationFixtureDirectory, "table2x2-baseline.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/algorithm-validation/foodborne-outbreak-v1-table2x2.json"),
  join(validationFixtureDirectory, "foodborne-outbreak-v1-table2x2.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/algorithm-validation/stratified-two-by-two-v0.5.json"),
  join(validationFixtureDirectory, "stratified-two-by-two-v0.5.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/algorithm-validation/stratified-homogeneity-v0.7.json"),
  join(validationFixtureDirectory, "stratified-homogeneity-v0.7.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/algorithm-validation/stratified-exact-v0.8.json"),
  join(validationFixtureDirectory, "stratified-exact-v0.8.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/algorithm-validation/stratified-operational-v0.8.json"),
  join(validationFixtureDirectory, "stratified-operational-v0.8.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/algorithm-validation/foodborne-frequency-v0.9.json"),
  join(validationFixtureDirectory, "foodborne-frequency-v0.9.json"),
);

const entryPoints = await Promise.all(maintainedModules.map(existingSource));
const commonOptions = {
  outbase: sourceDirectory,
  outdir: outputDirectory,
  format: "esm",
  platform: "browser",
  target: "es2022",
  sourcemap: "external",
  legalComments: "inline",
  logLevel: "info",
  metafile: true,
  outExtension: { ".js": ".js" },
};
const unbundledEntries = entryPoints.filter((source) => !bundledModules.has(basename(source, extname(source))));
const bundledEntries = entryPoints.filter((source) => !unbundledEntries.includes(source));
const results = await Promise.all([
  build({ ...commonOptions, entryPoints: unbundledEntries, bundle: false }),
  build({ ...commonOptions, entryPoints: bundledEntries, bundle: true }),
]);

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
  outputs: results.flatMap((result) => Object.keys(result.metafile.outputs))
    .map((output) => relative(resolve(wasmDirectory, ".."), resolve(output)).replaceAll("\\", "/"))
    .sort(),
};
await writeFile(join(outputDirectory, "build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
