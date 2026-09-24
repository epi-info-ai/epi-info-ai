import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({ entryPoints: ["wasm/app/gis/choropleth.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const gis = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);

const joinBundled = await build({ entryPoints: ["wasm/app/gis/choropleth-join.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const join = await import(`data:text/javascript;base64,${Buffer.from(joinBundled.outputFiles[0].text).toString("base64")}`);

const classificationBundled = await build({ entryPoints: ["wasm/app/gis/choropleth-classification.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const classification = await import(`data:text/javascript;base64,${Buffer.from(classificationBundled.outputFiles[0].text).toString("base64")}`);

const presentationBundled = await build({ entryPoints: ["wasm/app/gis/choropleth-presentation.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const presentation = await import(`data:text/javascript;base64,${Buffer.from(presentationBundled.outputFiles[0].text).toString("base64")}`);

const interactionBundled = await build({ entryPoints: ["wasm/app/gis/choropleth-interaction.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const interaction = await import(`data:text/javascript;base64,${Buffer.from(interactionBundled.outputFiles[0].text).toString("base64")}`);

const persistenceBundled = await build({ entryPoints: ["wasm/app/gis/choropleth-persistence.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const persistence = await import(`data:text/javascript;base64,${Buffer.from(persistenceBundled.outputFiles[0].text).toString("base64")}`);

const recipe = gis.createChoroplethLayerRecipeV01({
  boundaryAssetId: "county-boundaries",
  boundaryLayerName: "Counties",
  boundaryKeyField: "GEOID",
  dataSourceFormId: "foodborne",
  dataKeyField: "county_fips",
  valueField: "case_rate",
  joinNormalization: "trim-casefold",
  classification: { method: "manual", classCount: 3, breaks: [10, 25] },
  palette: ["#fee5d9", "#fcae91", "#cb181d"],
  opacity: 0.75,
  noDataColor: "#d9d9d9",
  legend: { title: "Cases per 10,000", showLabels: true, showNoData: true },
  filter: { field: "status", operator: "equals", value: "confirmed" },
});
assert.equal(recipe.schema, "epi-gis-choropleth/0.1");
assert.equal(recipe.classification.breaks?.length, 2);
assert.deepEqual(recipe.palette, ["#fee5d9", "#fcae91", "#cb181d"]);
assert.throws(() => gis.validateChoroplethClassificationV01({ method: "manual", classCount: 3, breaks: [25, 10] }), /strictly increasing/);
assert.throws(() => gis.validateChoroplethLayerRecipeV01({ ...recipe, palette: ["#ffffff"] }), /palette length/);
assert.throws(() => gis.validateChoroplethLayerRecipeV01({ ...recipe, opacity: 1.1 }), /opacity/);
assert.throws(() => gis.validateChoroplethFilterV01({ field: "status", operator: "equals" }), /comparison value/);
assert.equal(join.normalizeChoroplethJoinKeyV01("  OH-001  ", "trim-casefold"), "oh-001");
assert.equal(join.normalizeChoroplethJoinKeyV01("OH-001", "exact"), "OH-001");
const keyJoin = join.joinChoroplethDataToBoundariesV01(
  [
    { featureIndex: 0, properties: { GEOID: "OH-001" } },
    { featureIndex: 1, properties: { GEOID: "oh-002" } },
    { featureIndex: 2, properties: { GEOID: "OH-002" } },
    { featureIndex: 3, properties: { GEOID: "OH-004" } },
    { featureIndex: 4, properties: { GEOID: Number.NaN } },
  ],
  [
    { rowIndex: 0, values: { county: " oh-001 ", value: 12 } },
    { rowIndex: 1, values: { county: "OH-003", value: 7 } },
    { rowIndex: 2, values: { county: "OH-002", value: 8 } },
    { rowIndex: 3, values: { county: "", value: 1 } },
    { rowIndex: 4, values: { county: "OH-004", value: 4 } },
    { rowIndex: 5, values: { county: { invalid: true }, value: 2 } },
  ],
  "GEOID",
  "county",
  "trim-casefold",
);
assert.deepEqual(keyJoin.matches.map(({ boundary, dataRows }) => [boundary.featureIndex, dataRows.map(({ rowIndex }) => rowIndex)]), [[0, [0]], [3, [4]]]);
assert.deepEqual(keyJoin.unmatchedDataRows.map(({ rowIndex }) => rowIndex), [1]);
assert.deepEqual(keyJoin.missingDataKeyRows.map(({ rowIndex }) => rowIndex), [3]);
assert.deepEqual(keyJoin.invalidDataKeyRows.map(({ rowIndex }) => rowIndex), [5]);
assert.deepEqual(keyJoin.ambiguousDataRows.map(({ rowIndex }) => rowIndex), [2]);
assert.deepEqual(keyJoin.unmatchedBoundaryFeatures.map(({ featureIndex }) => featureIndex), [1, 2]);
assert.deepEqual(keyJoin.invalidBoundaryFeatures.map(({ featureIndex }) => featureIndex), [4]);
assert.deepEqual(keyJoin.duplicateBoundaryKeys, ["oh-002"]);
assert.deepEqual(join.summarizeChoroplethJoinDiagnosticsV01(keyJoin), {
  inputDataRows: 6,
  matchedDataRows: 2,
  missingDataKeyRows: 1,
  invalidDataKeyRows: 1,
  unmatchedDataRows: 1,
  invalidBoundaryFeatures: 1,
  unmatchedBoundaryFeatures: 2,
  duplicateBoundaryKeys: 1,
  ambiguousDataRows: 1,
  multiplyMatchedBoundaries: 0,
});
assert.equal(join.buildChoroplethJoinDiagnosticsV01(keyJoin).filter(({ code }) => code === "duplicate-boundary-key").length, 1);
const observations = [1, 2, 3, 4, 5, "not-a-number"].map((value, featureIndex) => ({ featureIndex, value }));
const manualClassification = classification.classifyChoroplethValuesV01(observations, { method: "manual", classCount: 3, breaks: [2, 4] });
assert.deepEqual(manualClassification.assignments.map(({ classIndex }) => classIndex), [0, 0, 1, 1, 2, null]);
assert.deepEqual(manualClassification.classCounts, [2, 2, 1]);
assert.equal(manualClassification.invalidCount, 1);
const equalInterval = classification.classifyChoroplethValuesV01(observations.slice(0, 5), { method: "equal-interval", classCount: 2 });
assert.deepEqual(equalInterval.breaks, [3]);
assert.deepEqual(equalInterval.classCounts, [3, 2]);
const quantile = classification.classifyChoroplethValuesV01(observations.slice(0, 5), { method: "quantile", classCount: 2 });
assert.deepEqual(quantile.breaks, [3]);
assert.deepEqual(quantile.classCounts, [3, 2]);
const recipeForLegend = { ...recipe, classification: { method: "manual", classCount: 3, breaks: [2, 4] } };
const legend = presentation.buildChoroplethLegendModelV01(recipeForLegend, manualClassification);
assert.equal(legend.title, "Cases per 10,000");
assert.deepEqual(legend.entries.map(({ label, count, color }) => ({ label, count, color })), [
  { label: "≤ 2", count: 2, color: "#fee5d9" },
  { label: "> 2 – ≤ 4", count: 2, color: "#fcae91" },
  { label: "> 4", count: 1, color: "#cb181d" },
]);
assert.deepEqual(legend.noData, { color: "#d9d9d9", label: "No data", opacity: 0.75 });
assert.equal(presentation.colorForChoroplethClassV01(recipeForLegend, null), "#d9d9d9");
assert.throws(() => presentation.colorForChoroplethClassV01(recipeForLegend, 3), /outside/);
const filterResult = interaction.filterChoroplethDataRowsV01([
  { rowIndex: 0, values: { status: "confirmed", cases: 10 } },
  { rowIndex: 1, values: { status: "control", cases: 4 } },
  { rowIndex: 2, values: { status: "confirmed", cases: 20 } },
], { field: "status", operator: "equals", value: "confirmed" });
assert.deepEqual(filterResult.includedRows.map(({ rowIndex }) => rowIndex), [0, 2]);
assert.deepEqual(filterResult.filteredRows.map(({ rowIndex }) => rowIndex), [1]);
assert.equal(interaction.matchesChoroplethFilterV01({ rowIndex: 0, values: { cases: 10 } }, { field: "cases", operator: "greater-than", value: "9" }), true);
const selected = interaction.selectChoroplethFeatureV01(keyJoin.matches, 0);
assert.equal(selected?.normalizedKey, "oh-001");
assert.equal(interaction.selectChoroplethFeatureV01(keyJoin.matches, 99), null);
const snapshot = persistence.createChoroplethLayerSnapshotV01({
  id: "choropleth-county-rates",
  name: "County case rate",
  visible: true,
  recipe: recipeForLegend,
  provenance: {
    sourceAssetId: "county-boundaries",
    sourceSha256: "a".repeat(64),
    dataSourceFormId: "foodborne",
    dataSourceRevision: "project-revision-1",
    lineage: ["county-boundaries", "foodborne", "manual-classification"],
  },
});
const serializedSnapshot = persistence.serializeChoroplethLayerSnapshotV01(snapshot);
assert.deepEqual(persistence.parseChoroplethLayerSnapshotV01(serializedSnapshot), snapshot);
const mismatchedSnapshot = JSON.parse(serializedSnapshot);
mismatchedSnapshot.provenance.sourceAssetId = "other-boundaries";
assert.throws(() => persistence.parseChoroplethLayerSnapshotV01(JSON.stringify(mismatchedSnapshot)), /source assets must agree/);
assert.throws(() => persistence.createChoroplethLayerSnapshotV01({ ...snapshot, provenance: { ...snapshot.provenance, sourceSha256: "bad" } }), /SHA-256/);
console.log("GIS-K06 choropleth contract smoke passed.");
