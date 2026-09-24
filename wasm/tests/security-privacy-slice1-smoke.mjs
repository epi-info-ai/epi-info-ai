import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { authorizeNetworkEgressV01, authorizePeerEgressV01, NETWORK_EGRESS_ROUTES_V01 } from "../app/security/network-egress.ts";
import { createPrivacyDisclosureReceiptV01, requirePrivacyForDisclosureV01, validatePrivacyClassificationV01 } from "../app/security/privacy.ts";
import { createProjectPackage } from "../app/contracts/project-package.ts";

assert.equal(new Set(NETWORK_EGRESS_ROUTES_V01.map(({ id }) => id)).size, NETWORK_EGRESS_ROUTES_V01.length, "route IDs must be unique");
for (const route of NETWORK_EGRESS_ROUTES_V01) {
  assert.ok(route.purpose.length >= 20, `${route.id} needs a meaningful purpose`);
  assert.ok(route.provider.length >= 3, `${route.id} needs a provider`);
  assert.ok(route.dataClassifications.length > 0, `${route.id} needs data classifications`);
  assert.ok(route.destinations.length > 0, `${route.id} needs destinations`);
}

const geocode = authorizeNetworkEgressV01("geocoder.nominatim", "https://nominatim.openstreetmap.org/search?q=secret", {
  dataClassification: "restricted-identifiable", consentGranted: true, applicationOrigin: "https://epi.example",
});
assert.equal(geocode.destinationOrigin, "https://nominatim.openstreetmap.org");
assert.equal(JSON.stringify(geocode).includes("secret"), false, "authorization receipts must omit paths and queries");
assert.throws(() => authorizeNetworkEgressV01("geocoder.nominatim", "https://evil.example/search", { dataClassification: "restricted-identifiable", consentGranted: true, applicationOrigin: "https://epi.example" }), /not allowed/);
assert.throws(() => authorizeNetworkEgressV01("geocoder.nominatim", "https://nominatim.openstreetmap.org/search", { dataClassification: "restricted-identifiable", consentGranted: false, applicationOrigin: "https://epi.example" }), /requires explicit consent/);
assert.throws(() => authorizeNetworkEgressV01("assistant.same-origin-gateway", "https://epi.example/api", { dataClassification: "restricted-identifiable", consentGranted: true, applicationOrigin: "https://epi.example" }), /does not allow/);
assert.throws(() => authorizeNetworkEgressV01("sync.supabase", "https://other.supabase.co/rest/v1", { dataClassification: "restricted-identifiable", consentGranted: true, configuredOrigin: "https://approved.supabase.co", applicationOrigin: "https://epi.example" }), /not allowed/);
assert.equal(authorizePeerEgressV01("share.encrypted-webrtc", { dataClassification: "restricted-identifiable", consentGranted: true }).destinationOrigin, "manual-peer");

const privacy = validatePrivacyClassificationV01({ schema: "epi-info-ai-privacy/0.1", data: "public-synthetic", geography: "public-synthetic", containsRecordValues: true, purpose: "Synthetic teaching exercise", approvedUses: ["map-display", "download"] });
assert.equal(requirePrivacyForDisclosureV01(privacy, "download").data, "public-synthetic");
const disclosureReceipt = createPrivacyDisclosureReceiptV01(privacy, "package", "download");
assert.deepEqual(Object.keys(disclosureReceipt).sort(), ["artifactKind", "boundary", "containsRecordValues", "data", "decision", "geography", "schema"]);
assert.equal(JSON.stringify(disclosureReceipt).includes("Synthetic teaching exercise"), false, "privacy receipts must omit free-text purpose and record values");
assert.throws(() => requirePrivacyForDisclosureV01(privacy, "external-sync"), /does not approve/);
assert.throws(() => requirePrivacyForDisclosureV01({ ...privacy, geography: "precise-sensitive", data: "public", approvedUses: ["download"] }, "download"), /Precise-sensitive geography cannot be classified as public/);

const minimalProject = { version: 1, name: "Privacy fixture", currentFormId: "form-1", storage: { type: "browser" }, forms: [{ id: "form-1", schema: { name: "Form", fields: [] }, records: [] }] };
assert.throws(() => createProjectPackage(minimalProject), /Privacy classification must be an object/);
const classifiedPackage = createProjectPackage({ ...minimalProject, privacy });
assert.equal(classifiedPackage.privacy.data, "public-synthetic");
assert.equal(classifiedPackage.privacyReceipt.decision, "allowed");
assert.equal("purpose" in classifiedPackage.privacyReceipt, false);

const sourceFiles = [
  "wasm/app/forms/geocoding.ts",
  "wasm/app/teaching/repository.ts",
  "wasm/app/projects/example-repository.ts",
  "wasm/app/packages/capability-package.ts",
  "wasm/app/assistant/gateway.ts",
  "wasm/demo/supabase-sync.ts",
  "wasm/demo/form-data.ts",
  "wasm/demo/app.ts",
  "wasm/app/forms/location-preview.ts",
  "wasm/app/forms/study-area-picker.ts",
  "wasm/demo/maps.ts",
  "wasm/demo/index.html",
];
const sources = await Promise.all(sourceFiles.map((path) => readFile(path, "utf8")));
for (const id of ["geocoder.nominatim", "projects.teaching-repository", "projects.example-repository", "packages.capability-repository", "assistant.same-origin-gateway", "sync.supabase", "maps.openstreetmap-tiles"]) {
  assert.ok(sources.some((source) => source.includes(id)), `maintained source must authorize ${id}`);
}
assert.ok(sources.some((source) => source.includes("privacy-readiness-dialog")), "browser-visible privacy and offline-readiness review is required");
assert.ok(sources.some((source) => source.includes('requirePrivacyForDisclosureV01(local.privacy, "external-sync")')), "external synchronization must fail closed on missing privacy approval");

console.log(`Security/privacy slice 1 smoke passed: ${NETWORK_EGRESS_ROUTES_V01.length} governed routes.`);
