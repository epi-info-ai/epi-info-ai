import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({ entryPoints: ["wasm/app/gis/dot-density.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const gis = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const valuesBundled = await build({ entryPoints: ["wasm/app/gis/dot-density-values.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const values = await import(`data:text/javascript;base64,${Buffer.from(valuesBundled.outputFiles[0].text).toString("base64")}`);
const placementBundled = await build({ entryPoints: ["wasm/app/gis/dot-density-placement.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const placement = await import(`data:text/javascript;base64,${Buffer.from(placementBundled.outputFiles[0].text).toString("base64")}`);
const clippingBundled = await build({ entryPoints: ["wasm/app/gis/dot-density-clipping.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const clipping = await import(`data:text/javascript;base64,${Buffer.from(clippingBundled.outputFiles[0].text).toString("base64")}`);
const legendBundled = await build({ entryPoints: ["wasm/app/gis/dot-density-legend.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const legend = await import(`data:text/javascript;base64,${Buffer.from(legendBundled.outputFiles[0].text).toString("base64")}`);
const joinBundled = await build({ entryPoints: ["wasm/app/gis/dot-density-join.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const join = await import(`data:text/javascript;base64,${Buffer.from(joinBundled.outputFiles[0].text).toString("base64")}`);
const pipelineBundled = await build({ entryPoints: ["wasm/app/gis/dot-density-pipeline.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const pipeline = await import(`data:text/javascript;base64,${Buffer.from(pipelineBundled.outputFiles[0].text).toString("base64")}`);
const presentationBundled = await build({ entryPoints: ["wasm/app/gis/dot-density-presentation.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const presentation = await import(`data:text/javascript;base64,${Buffer.from(presentationBundled.outputFiles[0].text).toString("base64")}`);

const recipe = gis.createDotDensityLayerRecipeV01({
  boundaryAssetId: "county-boundaries",
  boundaryLayerName: "Counties",
  boundaryKeyField: "GEOID",
  dataSourceFormId: "county-values",
  dataKeyField: "county_fips",
  valueField: "case_count",
  valuePerDot: 10,
  rounding: "nearest",
  seed: 12345,
  placementMethod: "seeded-jitter",
  clipping: "polygon-interior",
  dotColor: "#2255aa",
  dotRadiusPixels: 3,
  opacity: 0.8,
  legendTitle: "10 cases per dot",
  maxDotsPerFeature: 1000,
  maxTotalDots: 10000,
});
assert.equal(recipe.schema, "epi-gis-dot-density/0.1");
assert.equal(recipe.seed, 12345);
assert.throws(() => gis.validateDotDensityLayerRecipeV01({ ...recipe, valuePerDot: 0 }), /positive finite/);
assert.throws(() => gis.validateDotDensityLayerRecipeV01({ ...recipe, seed: 0x1_0000_0000 }), /seed/);
assert.throws(() => gis.validateDotDensityLayerRecipeV01({ ...recipe, maxDotsPerFeature: 20_000, maxTotalDots: 10_000 }), /cannot exceed/);
assert.throws(() => gis.validateDotDensityLayerRecipeV01({ ...recipe, clipping: "centroid" }), /polygon-interior/);
const preview = values.buildDotDensityValuePreviewV01([
  { featureIndex: 0, value: 24 },
  { featureIndex: 1, value: "15" },
  { featureIndex: 2, value: "" },
  { featureIndex: 3, value: "not numeric" },
  { featureIndex: 4, value: -2 },
], recipe);
assert.deepEqual(preview.values, [{ featureIndex: 0, value: 24, dotCount: 2 }, { featureIndex: 1, value: 15, dotCount: 2 }]);
assert.deepEqual(preview.diagnostics.map(({ code }) => code), ["missing-value", "invalid-value", "negative-value"]);
assert.equal(preview.totalValue, 39);
assert.equal(preview.totalDots, 4);
const limited = values.buildDotDensityValuePreviewV01([{ featureIndex: 0, value: 10_010 }], recipe);
assert.deepEqual(limited.diagnostics.map(({ code }) => code), ["per-feature-limit"]);
const normalizedValues = [{ featureIndex: 0, value: 24, dotCount: 2 }, { featureIndex: 1, value: 15, dotCount: 2 }];
const featureBounds = [{ featureIndex: 0, minX: 0, minY: 0, maxX: 10, maxY: 10 }, { featureIndex: 1, minX: 20, minY: 20, maxX: 30, maxY: 30 }];
const candidatesA = placement.generateDotDensityCandidatesV01(normalizedValues, featureBounds, recipe);
const candidatesB = placement.generateDotDensityCandidatesV01(normalizedValues, featureBounds, recipe);
assert.deepEqual(candidatesA, candidatesB);
assert.equal(candidatesA.totalCandidates, 4);
assert.deepEqual(candidatesA.featureCounts, { "0": 2, "1": 2 });
assert.equal(candidatesA.candidates.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)), true);
const gridRecipe = { ...recipe, placementMethod: "deterministic-grid" };
const gridCandidates = placement.generateDotDensityCandidatesV01([{ featureIndex: 0, value: 30, dotCount: 3 }], [featureBounds[0]], gridRecipe);
assert.deepEqual(gridCandidates.candidates.map(({ x, y }) => [x, y]), [[2.5, 2.5], [7.5, 2.5], [2.5, 7.5]]);
const square = { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]] };
const clipped = clipping.clipDotDensityCandidatesV01([{ featureIndex: 0, dotIndex: 0, x: 2, y: 2 }, { featureIndex: 0, dotIndex: 1, x: 5, y: 5 }, { featureIndex: 0, dotIndex: 2, x: 11, y: 5 }], new Map([[0, square]]));
assert.deepEqual(clipped.candidates.map(({ dotIndex }) => dotIndex), [0]);
assert.equal(clipped.clippedCount, 2);
const multipolygon = { type: "MultiPolygon", coordinates: [[[[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]]]] };
assert.equal(clipping.clipDotDensityCandidatesV01([{ featureIndex: 1, dotIndex: 0, x: 25, y: 25 }], new Map([[1, multipolygon]])).keptCount, 1);
assert.equal(clipping.clipDotDensityCandidatesV01([{ featureIndex: 2, dotIndex: 0, x: 0, y: 0 }], new Map()).diagnostics[0].code, "missing-geometry");
assert.equal(clipping.clipDotDensityCandidatesV01([{ featureIndex: 3, dotIndex: 0, x: 0, y: 0 }], new Map([[3, { type: "Point", coordinates: [0, 0] }]])).diagnostics[0].code, "unsupported-geometry");
const legendModel = legend.buildDotDensityLegendV01(recipe, preview, { keptCount: 3, clippedCount: 1 });
assert.equal(legendModel.schema, "epi-gis-dot-density-legend/0.1");
assert.equal(legendModel.title, "10 cases per dot");
assert.equal(legendModel.entry.label, "10 value per dot");
assert.equal(legendModel.totalInputDots, 4);
assert.equal(legendModel.renderedDots, 3);
assert.equal(legendModel.clippedDots, 1);
assert.equal(legendModel.noDataCount, 3);
assert.equal(legendModel.diagnosticCount, 3);
const joined = join.joinDotDensityDataToBoundariesV01(
  [{ featureIndex: 0, properties: { GEOID: " a " } }, { featureIndex: 1, properties: { GEOID: "missing" } }],
  [{ rowIndex: 0, values: { FIPS: "A", cases: 20 } }, { rowIndex: 1, values: { FIPS: "A", cases: 30 } }, { rowIndex: 2, values: { FIPS: "orphan", cases: 4 } }, { rowIndex: 3, values: { cases: 1 } }],
  "GEOID", "FIPS", "trim-casefold",
);
assert.equal(joined.matches.length, 1);
assert.equal(joined.matches[0].dataRows.length, 2);
assert.deepEqual(joined.diagnostics.map(({ code }) => code), ["missing-data-key", "duplicate-data-key", "unmatched-boundary", "unmatched-data"]);
const pipelineResult = pipeline.buildDotDensityPipelineV01(recipe, {
  boundaries: [{ featureIndex: 0, properties: { GEOID: "A" } }],
  rows: [{ rowIndex: 0, values: { FIPS: "a", cases: 20 } }],
  boundaryKeyField: "GEOID",
  dataKeyField: "FIPS",
  valueField: "cases",
  bounds: [{ featureIndex: 0, minX: 0, minY: 0, maxX: 10, maxY: 10 }],
  geometries: new Map([[0, { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] }]]),
});
assert.equal(pipelineResult.join.matches.length, 1);
assert.equal(pipelineResult.preview.totalDots, 2);
assert.equal(pipelineResult.placement.totalCandidates, 2);
assert.equal(pipelineResult.clipping.keptCount, 2);
assert.equal(pipelineResult.legend.renderedDots, 2);
const rendered = presentation.buildDotDensityPresentationV01(pipelineResult.clipping.candidates, recipe, pipelineResult.legend);
assert.equal(rendered.type, "FeatureCollection");
assert.equal(rendered.features.length, 2);
assert.deepEqual(rendered.features[0].geometry.coordinates, [pipelineResult.clipping.candidates[0].x, pipelineResult.clipping.candidates[0].y]);
assert.deepEqual(rendered.features[0].properties, { featureIndex: 0, dotIndex: 0, color: "#2255aa", radiusPixels: 3, opacity: 0.8 });
assert.throws(() => presentation.buildDotDensityPresentationV01([{ featureIndex: 0, dotIndex: 0, x: Number.NaN, y: 1 }], recipe, pipelineResult.legend), /finite candidate/);
console.log("GIS-K07 dot-density contract smoke passed.");
