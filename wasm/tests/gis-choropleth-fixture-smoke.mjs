import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { build } from "esbuild";

const fixtureRoot = "wasm/demo/examples/gis-k06-choropleth";
const boundaries = JSON.parse(await fs.readFile(`${fixtureRoot}/county-boundaries.geojson`, "utf8"));
const lines = (await fs.readFile(`${fixtureRoot}/county-values.csv`, "utf8")).trim().split(/\r?\n/);
const headers = lines[0].split(",");
const dataRows = lines.slice(1).map((line, rowIndex) => ({ rowIndex, values: Object.fromEntries(line.split(",").map((value, index) => [headers[index], value])) }));

const bundle = async (entryPoint) => {
  const result = await build({ entryPoints: [entryPoint], bundle: true, format: "esm", platform: "browser", write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
};
const join = await bundle("wasm/app/gis/choropleth-join.ts");
const classification = await bundle("wasm/app/gis/choropleth-classification.ts");
const presentation = await bundle("wasm/app/gis/choropleth-presentation.ts");

const boundaryFeatures = boundaries.features.map((feature, featureIndex) => ({ featureIndex, properties: feature.properties }));
const filtered = dataRows.filter(({ values }) => values.status === "confirmed");
const keyJoin = join.joinChoroplethDataToBoundariesV01(boundaryFeatures, filtered, "GEOID", "county_fips", "trim-casefold");
assert.equal(keyJoin.matches.length, 2);
assert.deepEqual(keyJoin.unmatchedDataRows.map(({ rowIndex }) => rowIndex), [3]);
assert.deepEqual(keyJoin.missingDataKeyRows.map(({ rowIndex }) => rowIndex), [4]);
assert.deepEqual(keyJoin.unmatchedBoundaryFeatures.map(({ featureIndex }) => featureIndex), [2, 3]);

const observations = keyJoin.matches.map(({ boundary, dataRows: rows }) => ({ featureIndex: boundary.featureIndex, value: rows[0].values.case_rate }));
const classified = classification.classifyChoroplethValuesV01(observations, { method: "manual", classCount: 3, breaks: [10, 25] });
assert.deepEqual(classified.classCounts, [1, 1, 0]);
const recipe = {
  schema: "epi-gis-choropleth/0.1",
  boundaryAssetId: "county-boundaries",
  boundaryKeyField: "GEOID",
  dataSourceFormId: "county-values",
  dataKeyField: "county_fips",
  valueField: "case_rate",
  joinNormalization: "trim-casefold",
  classification: { method: "manual", classCount: 3, breaks: [10, 25] },
  palette: ["#fee5d9", "#fcae91", "#cb181d"],
  opacity: 0.8,
  noDataColor: "#d9d9d9",
  legend: { title: "Case rate", showLabels: true, showNoData: true },
};
const legend = presentation.buildChoroplethLegendModelV01(recipe, classified);
assert.deepEqual(legend.entries.map(({ count }) => count), [1, 1, 0]);
assert.equal(legend.noData.label, "No data");
console.log("GIS-K06 Choropleth fixture smoke passed.");
