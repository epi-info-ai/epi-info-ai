import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "../..");
const wasmPath = resolve(repositoryRoot, "wasm/demo/epi2x2.wasm");
const manifestPath = resolve(repositoryRoot, "wasm/tests/fixtures/phase0/wasm-manifest.json");
const matchedExports = [
  "matched_odds_ratio",
  "matched_odds_ratio_exact_lower",
  "matched_odds_ratio_exact_upper",
  "matched_mcnemar_uncorrected",
  "matched_mcnemar_corrected",
  "matched_exact_two_sided",
  "matched_exact_mid_p_two_sided",
];

const bytes = await readFile(wasmPath);
const current = JSON.parse(await readFile(manifestPath, "utf8"));
const module = await WebAssembly.compile(bytes);
const actualExports = new Set(WebAssembly.Module.exports(module).map(({ name }) => name));
const requiredExports = [...new Set([...current.requiredExports, ...matchedExports])];
for (const name of requiredExports) {
  if (!actualExports.has(name)) throw new Error(`The compiled WASM artifact is missing required export ${name}.`);
}
const manifest = {
  ...current,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  size: bytes.length,
  engine: { ...current.engine, version: "0.16.0" },
  requiredExports,
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Reviewed WASM manifest refreshed for ${manifest.engine.version}: ${manifest.sha256}`);
