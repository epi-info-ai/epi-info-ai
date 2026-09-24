import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({ entryPoints: ["wasm/app/gis/advanced-spatial-candidates.ts"], bundle: true, format: "esm", platform: "browser", write: false });
const gis = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const raster = { width: 4, height: 2, origin: [0, 0], cellSize: [1, 1], values: [1, 2, null, 4, 5, 6, 7, 8], noDataValue: -9999 };
const zones = [
  { id: "west", geometry: { type: "Polygon", coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] } },
  { id: "east", geometry: { type: "Polygon", coordinates: [[[2, 0], [4, 0], [4, 2], [2, 2], [2, 0]]] } },
];
const plan = gis.createZonalStatisticsPlanV01({ planId: "zones", statistic: "mean", noDataPolicy: "exclude", maxZones: 10, maxCells: 100 });
const result = gis.calculateZonalStatisticsV01(plan, raster, zones);
assert.equal(result.schema, "epi-gis-zonal-statistics-result/0.1");
assert.deepEqual(result.rows.map(({ zoneId, count, value, noDataCount, cellCount }) => ({ zoneId, count, value, noDataCount, cellCount })), [
  { zoneId: "east", count: 3, value: 6.333333333333333, noDataCount: 1, cellCount: 4 },
  { zoneId: "west", count: 4, value: 3.5, noDataCount: 0, cellCount: 4 },
]);
assert(result.diagnostics.some(({ code, zoneId }) => code === "no-data" && zoneId === "east"));
assert.throws(() => gis.calculateZonalStatisticsV01(gis.createZonalStatisticsPlanV01({ ...plan, noDataPolicy: "fail" }), raster, zones), /NoData/);
assert.throws(() => gis.calculateZonalStatisticsV01(plan, { ...raster, width: 20, height: 20, values: Array(400).fill(1) }, zones), /maxCells/);
console.log("GIS-K09-S9 zonal statistics smoke passed.");
