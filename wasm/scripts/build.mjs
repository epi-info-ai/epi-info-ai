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
  "epi-assist",
  "epi-assist-worker",
  "form-data",
  "maps",
  "shell",
  "stratified-worker",
  "stratified-worker-client",
  "supabase-sync",
];
const bundledModules = new Set(["app", "epi-assist", "epi-assist-worker", "form-data", "maps", "stratified-worker", "supabase-sync"]);

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
await cp(resolve(wasmDirectory, "../node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm"), join(outputDirectory, "sqlite3.wasm"));
await cp(resolve(wasmDirectory, "../node_modules/@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm"), join(outputDirectory, "duckdb-mvp.wasm"));
await cp(resolve(wasmDirectory, "../node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js"), join(outputDirectory, "duckdb-browser-mvp.worker.js"));
await cp(resolve(wasmDirectory, "../node_modules/@duckdb/duckdb-wasm/dist/duckdb-eh.wasm"), join(outputDirectory, "duckdb-eh.wasm"));
await cp(resolve(wasmDirectory, "../node_modules/@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js"), join(outputDirectory, "duckdb-browser-eh.worker.js"));
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
await cp(
  join(wasmDirectory, "tests/fixtures/algorithm-validation/foodborne-means-v0.10.json"),
  join(validationFixtureDirectory, "foodborne-means-v0.10.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/algorithm-validation/foodborne-rate-v0.11.json"),
  join(validationFixtureDirectory, "foodborne-rate-v0.11.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/algorithm-validation/population-survey-v0.12.json"),
  join(validationFixtureDirectory, "population-survey-v0.12.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/algorithm-validation/cohort-cross-sectional-v0.13.json"),
  join(validationFixtureDirectory, "cohort-cross-sectional-v0.13.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/algorithm-validation/unmatched-case-control-v0.14.json"),
  join(validationFixtureDirectory, "unmatched-case-control-v0.14.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/algorithm-validation/chi-square-trend-v0.15.json"),
  join(validationFixtureDirectory, "chi-square-trend-v0.15.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/classic-command-parity/foodborne-tables-potato-salad-by-status.expected.json"),
  join(validationFixtureDirectory, "foodborne-tables-stratified-v0.3.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/classic-command-parity/foodborne-tables-potato-salad-by-status-unstratified.expected.json"),
  join(validationFixtureDirectory, "foodborne-tables-unstratified-v0.3.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/classic-command-parity/foodborne-tables-fisher.expected.json"),
  join(validationFixtureDirectory, "foodborne-tables-fisher-v0.5.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/classic-command-parity/foodborne-tables-missing.expected.json"),
  join(validationFixtureDirectory, "foodborne-tables-missing-v0.6.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/classic-command-parity/foodborne-tables-stratified-two-by-two.expected.json"),
  join(validationFixtureDirectory, "foodborne-tables-adjusted-v0.8.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/classic-command-parity/foodborne-tables-weighted.expected.json"),
  join(validationFixtureDirectory, "foodborne-tables-weighted-v0.9.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/classic-command-parity/foodborne-tables-psuvar.expected.json"),
  join(validationFixtureDirectory, "foodborne-tables-psuvar-v0.2.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/classic-command-parity/foodborne-tables-psuvar-outtable.expected.json"),
  join(validationFixtureDirectory, "foodborne-tables-psuvar-outtable-v0.2.json"),
);
await cp(
  join(wasmDirectory, "tests/fixtures/classic-command-parity/foodborne-frequency-psuvar.expected.json"),
  join(validationFixtureDirectory, "foodborne-frequency-psuvar-v0.1.json"),
);
await cp(join(wasmDirectory, "tests/fixtures/classic-command-parity/foodborne-means-psuvar.expected.json"), join(validationFixtureDirectory, "foodborne-means-psuvar-v0.1.json"));
await cp(join(wasmDirectory, "tests/fixtures/classic-command-parity/foodborne-means-psuvar-outtable.expected.json"), join(validationFixtureDirectory, "foodborne-means-psuvar-outtable-v0.1.json"));

const entryPoints = await Promise.all(maintainedModules.map(existingSource));
const commonOptions = {
  absWorkingDir: resolve(wasmDirectory, ".."),
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
  build({
    ...commonOptions,
    entryPoints: bundledEntries,
    bundle: true,
    splitting: true,
    chunkNames: "chunks/[name]-[hash]",
    alias: { stream: "stream-browserify", events: "events" },
  }),
]);

for (const source of entryPoints) {
  if (source.endsWith(".ts")) {
    await rm(join(outputDirectory, `${relative(sourceDirectory, source).slice(0, -3)}.ts`), { force: true });
  }
}

const packageManifest = JSON.parse(await readFile(resolve(wasmDirectory, "../package.json"), "utf8"));
const repositoryRoot = resolve(wasmDirectory, "..");
const manifest = {
  schemaVersion: 1,
  applicationVersion: packageManifest.version,
  sourceModules: entryPoints.map((source) => relative(resolve(wasmDirectory, ".."), source).replaceAll("\\", "/")),
  outputs: results.flatMap((result) => Object.keys(result.metafile.outputs))
    .map((output) => relative(repositoryRoot, resolve(repositoryRoot, output)).replaceAll("\\", "/"))
    .sort(),
};
await writeFile(join(outputDirectory, "build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
