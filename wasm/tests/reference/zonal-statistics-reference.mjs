import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fromArrayBuffer } from "geotiff";

const root = resolve(import.meta.dirname, "../../..");
const rasterPath = resolve(root, "wasm/demo/examples/foodborne/maps/worldpop-toledo-population-density.tif");
const zonesPath = resolve(root, "wasm/demo/examples/gdal-wasm/zonal-statistics/study-zones.geojson");
const expectedPath = resolve(root, "wasm/demo/examples/gdal-wasm/zonal-statistics/expected-result.json");

function pointInRing(x, y, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInPolygon(x, y, rings) {
  return pointInRing(x, y, rings[0]) && !rings.slice(1).some((ring) => pointInRing(x, y, ring));
}

const rasterFile = await readFile(rasterPath);
const rasterBuffer = rasterFile.buffer.slice(rasterFile.byteOffset, rasterFile.byteOffset + rasterFile.byteLength);
const image = await (await fromArrayBuffer(rasterBuffer)).getImage();
const values = await image.readRasters({ interleave: true });
const [originX, originY] = image.getOrigin();
const [resolutionX, resolutionY] = image.getResolution();
const width = image.getWidth();
const height = image.getHeight();
const nodata = Number(image.getGDALNoData());
const zones = JSON.parse(await readFile(zonesPath, "utf8"));
const results = zones.features.map((feature) => {
  let population = 0;
  let validPixels = 0;
  let selectedPixels = 0;
  for (let row = 0; row < height; row += 1) {
    const latitude = originY + (row + 0.5) * resolutionY;
    for (let column = 0; column < width; column += 1) {
      const longitude = originX + (column + 0.5) * resolutionX;
      if (!pointInPolygon(longitude, latitude, feature.geometry.coordinates)) continue;
      selectedPixels += 1;
      const value = Number(values[row * width + column]);
      if (!Number.isFinite(value) || value === nodata) continue;
      validPixels += 1;
      population += value;
    }
  }
  return { zoneId: feature.properties.zone_id, population, validPixels, selectedPixels };
});
const expected = JSON.parse(await readFile(expectedPath, "utf8"));
assert.equal(expected.method, "independent-geotiff-cell-center-point-in-polygon");
for (const result of results) {
  const reference = expected.results.find(({ zoneId }) => zoneId === result.zoneId);
  assert.ok(reference, `missing ${result.zoneId} reference`);
  assert.ok(Math.abs(reference.population - result.population) < 1e-8, `${result.zoneId} population reference drift`);
  assert.equal(reference.validPixels, result.validPixels, `${result.zoneId} valid-pixel reference drift`);
  assert.equal(reference.selectedPixels, result.selectedPixels, `${result.zoneId} selected-pixel reference drift`);
}

process.stdout.write(`${JSON.stringify({ method: "independent-geotiff-cell-center-point-in-polygon", raster: { width, height, origin: [originX, originY], resolution: [resolutionX, resolutionY], nodata }, results }, null, 2)}\n`);
