import assert from "node:assert/strict";
import { defaultGeoprivacyPolicyV01, transformGeographyV01, validateGeoprivacyPolicyV01 } from "../app/security/geoprivacy.ts";

const sensitive = { schema: "epi-info-ai-privacy/0.1", data: "restricted-deidentified", geography: "precise-sensitive", containsRecordValues: true, purpose: "Case investigation", approvedUses: ["map-display", "download"] };
const publicSynthetic = { ...sensitive, data: "public-synthetic", geography: "public-synthetic", purpose: "Synthetic teaching fixture" };
const source = [
  { latitude: 8.48001, longitude: -13.23001, administrativeArea: "Western Area" },
  { latitude: 8.48002, longitude: -13.23002, administrativeArea: "Western Area" },
  { latitude: 8.59999, longitude: -13.10001, administrativeArea: "Western Area" },
  { latitude: 7.96472, longitude: -11.73833, administrativeArea: "Bo" },
];
const original = structuredClone(source);

assert.equal(defaultGeoprivacyPolicyV01(sensitive).displayMode, "rounded");
assert.equal(defaultGeoprivacyPolicyV01(publicSynthetic).displayMode, "exact");
assert.throws(() => transformGeographyV01(source, sensitive, { schema: "epi-info-ai-geoprivacy/0.1", displayMode: "exact", roundingDecimals: 4, minimumCellCount: 1, administrativeAreaField: "" }), /Precise-sensitive geography cannot/);

const rounded = transformGeographyV01(source, sensitive, { schema: "epi-info-ai-geoprivacy/0.1", displayMode: "rounded", roundingDecimals: 2, minimumCellCount: 2, administrativeAreaField: "" });
assert.deepEqual(source, original, "derived geoprivacy must not mutate authoritative coordinates");
assert.equal(rounded.features.length, 1);
assert.deepEqual(rounded.features[0], { latitude: 8.48, longitude: -13.23, administrativeArea: null, count: 2 });
assert.equal(rounded.receipt.inputPoints, 4);
assert.equal(rounded.receipt.releasedRecords, 2);
assert.equal(rounded.receipt.suppressedRecords, 2);
assert.equal(rounded.receipt.authoritativeCoordinatesChanged, false);
assert.equal(JSON.stringify(rounded.receipt).includes("8.48"), false, "receipt must not contain coordinates");
assert.equal(JSON.stringify(rounded.receipt).includes("Case investigation"), false, "receipt must not contain free-text purpose");

const administrative = transformGeographyV01(source, sensitive, { schema: "epi-info-ai-geoprivacy/0.1", displayMode: "administrative-area", roundingDecimals: 2, minimumCellCount: 2, administrativeAreaField: "district" }, "download", "output");
assert.deepEqual(administrative.features, [{ latitude: null, longitude: null, administrativeArea: "Western Area", count: 3 }]);
assert.equal(administrative.receipt.suppressedRecords, 1);

const suppressed = transformGeographyV01(source, sensitive, { schema: "epi-info-ai-geoprivacy/0.1", displayMode: "suppressed", roundingDecimals: 2, minimumCellCount: 1, administrativeAreaField: "" });
assert.equal(suppressed.features.length, 0);
assert.equal(suppressed.receipt.suppressedRecords, 4);
assert.throws(() => validateGeoprivacyPolicyV01({ schema: "epi-info-ai-geoprivacy/0.1", displayMode: "administrative-area", roundingDecimals: 2, minimumCellCount: 5, administrativeAreaField: "" }), /requires an administrative-area field/);
assert.throws(() => validateGeoprivacyPolicyV01({ schema: "epi-info-ai-geoprivacy/0.1", displayMode: "rounded", roundingDecimals: 5, minimumCellCount: 5, administrativeAreaField: "" }), /0 through 4/);

console.log("Security/privacy slice 2 geoprivacy smoke passed.");
