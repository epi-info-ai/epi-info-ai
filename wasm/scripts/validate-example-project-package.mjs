import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const directory = process.cwd();
const requested = process.argv[2];
const directoryEntries = await readdir(directory);
const binaryCandidates = directoryEntries.filter((name) => name.endsWith(".epia"));
const jsonCandidates = directoryEntries.filter((name) => name.endsWith(".epia.json"));
const candidates = requested ? [requested] : binaryCandidates.length ? binaryCandidates : jsonCandidates;
assert.equal(candidates.length, 1, "the repository must identify exactly one root .epia archive or .epia.json package");

const packagePath = path.resolve(directory, candidates[0]);
const packageBytes = await readFile(packagePath);
let packageValue;
let embeddedAssetCount = 0;
if (candidates[0].endsWith(".epia")) {
  const magic = Buffer.from([0x45, 0x50, 0x49, 0x41, 0x01, 0x0d, 0x0a, 0x1a]);
  assert.ok(packageBytes.length >= 12 && packageBytes.subarray(0, 8).equals(magic), "binary project archive magic");
  const manifestLength = packageBytes.readUInt32LE(8);
  assert.ok(manifestLength > 0 && 12 + manifestLength <= packageBytes.length, "binary project archive manifest length");
  const manifest = JSON.parse(packageBytes.subarray(12, 12 + manifestLength).toString("utf8"));
  assert.equal(manifest.format, "epi-info-ai-archive", "archive format");
  assert.equal(manifest.version, 1, "archive version");
  assert.ok(Array.isArray(manifest.assets), "archive asset inventory");
  packageValue = manifest.projectPackage;
  const referencedAssets = [
    ...(packageValue.project?.studyAreas ?? []).flatMap((area) => area.offlineMap?.asset ? [area.offlineMap.asset] : []),
    ...(packageValue.project?.mapAssets ?? []),
  ];
  assert.equal(manifest.assets.length, referencedAssets.length, "archive contains every referenced map asset");
  let offset = 12 + manifestLength;
  for (const asset of manifest.assets) {
    assert.ok(referencedAssets.some((reference) => JSON.stringify(reference) === JSON.stringify(asset)), `${asset.fileName} metadata is referenced by the project`);
    assert.ok(Number.isSafeInteger(asset.byteLength) && asset.byteLength > 0, `${asset.fileName} byte length`);
    const end = offset + asset.byteLength;
    assert.ok(end <= packageBytes.length, `${asset.fileName} payload is complete`);
    const payload = packageBytes.subarray(offset, end);
    assert.equal(createHash("sha256").update(payload).digest("hex"), asset.sha256, `${asset.fileName} embedded SHA-256`);
    if (asset.format === "geojson") {
      const geojson = JSON.parse(payload.toString("utf8"));
      assert.equal(typeof geojson?.type, "string", `${asset.fileName} GeoJSON type`);
    } else if (asset.format === "geotiff") {
      const littleEndian = payload[0] === 0x49 && payload[1] === 0x49 && payload[2] === 0x2a && payload[3] === 0x00;
      const bigEndian = payload[0] === 0x4d && payload[1] === 0x4d && payload[2] === 0x00 && payload[3] === 0x2a;
      assert.ok(littleEndian || bigEndian, `${asset.fileName} TIFF signature`);
    }
    offset = end;
  }
  assert.equal(offset, packageBytes.length, "archive has no unreferenced trailing bytes");
  embeddedAssetCount = manifest.assets.length;
} else {
  packageValue = JSON.parse(packageBytes.toString("utf8"));
}
assert.equal(packageValue.format, "epi-info-ai-project", "package format");
assert.equal(packageValue.version, 2, "Project Package V2");
assert.ok(!Number.isNaN(Date.parse(packageValue.exportedAt)), "valid export timestamp");
assert.equal(packageValue.project?.version, 1, "Project Snapshot V1");
assert.equal(typeof packageValue.project?.name, "string", "project name");
assert.ok(Array.isArray(packageValue.project?.forms) && packageValue.project.forms.length > 0, "at least one project form");
assert.ok(packageValue.project.forms.some(({ id }) => id === packageValue.project.currentFormId), "currentFormId must identify a form");

const formIds = new Set();
let recordCount = 0;
for (const [formIndex, form] of packageValue.project.forms.entries()) {
  assert.equal(typeof form.id, "string", `form ${formIndex} id`);
  assert.ok(!formIds.has(form.id.toLowerCase()), `unique form id ${form.id}`);
  formIds.add(form.id.toLowerCase());
  assert.equal(typeof form.schema?.name, "string", `${form.id} schema name`);
  assert.ok(Array.isArray(form.schema?.fields) && form.schema.fields.length > 0, `${form.id} fields`);
  const fieldNames = new Set();
  for (const field of form.schema.fields) {
    assert.equal(typeof field.name, "string", `${form.id} field name`);
    assert.ok(!fieldNames.has(field.name.toLowerCase()), `${form.id} unique field ${field.name}`);
    fieldNames.add(field.name.toLowerCase());
    assert.equal(typeof field.prompt, "string", `${form.id}.${field.name} prompt`);
    assert.equal(typeof field.type, "string", `${form.id}.${field.name} type`);
    assert.equal(typeof field.required, "boolean", `${form.id}.${field.name} required flag`);
  }
  assert.ok(Array.isArray(form.records), `${form.id} records`);
  for (const record of form.records) {
    assert.ok(record && typeof record === "object" && !Array.isArray(record), `${form.id} record object`);
    assert.ok(Object.values(record).every((value) => value === null || ["string", "number", "boolean"].includes(typeof value)), `${form.id} record values`);
  }
  recordCount += form.records.length;
  if (form.dataset) {
    assert.match(form.dataset.sha256, /^[a-f0-9]{64}$/, `${form.id} dataset SHA-256`);
    const datasetBytes = await readFile(path.resolve(directory, form.dataset.file));
    assert.equal(createHash("sha256").update(datasetBytes).digest("hex"), form.dataset.sha256, `${form.id} source dataset digest`);
  }
}

assert.ok(Array.isArray(packageValue.programs) && packageValue.programs.length > 0, "at least one saved program");
assert.ok(Array.isArray(packageValue.codeTables), "codeTables array");
const programNames = new Set();
for (const program of packageValue.programs) {
  assert.equal(program.language, "classic-analysis", `${program.name} language`);
  assert.equal(typeof program.source, "string", `${program.name} source`);
  assert.ok(program.source.trim(), `${program.name} source must not be empty`);
  assert.ok(!programNames.has(program.name.toLowerCase()), `unique program ${program.name}`);
  programNames.add(program.name.toLowerCase());
}

assert.ok(Array.isArray(packageValue.runbooks) && packageValue.runbooks.length > 0, "at least one project runbook");
const runbookNames = new Set();
for (const runbook of packageValue.runbooks) {
  assert.match(runbook.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${runbook.id} identifier`);
  assert.ok(!runbookNames.has(runbook.id), `unique runbook ${runbook.id}`);
  runbookNames.add(runbook.id);
  assert.ok(["classic", "forms", "data", "dashboard", "maps", "statcalc"].includes(runbook.module), `${runbook.id} module`);
  assert.ok(Array.isArray(runbook.steps) && runbook.steps.length > 0, `${runbook.id} steps`);
  for (const step of runbook.steps) {
    assert.equal(typeof step.title, "string", `${runbook.id}.${step.id} title`);
    assert.equal(typeof step.instruction, "string", `${runbook.id}.${step.id} instruction`);
    assert.equal(typeof step.target, "string", `${runbook.id}.${step.id} target`);
  }
}

console.log(`Validated ${packageValue.project.name}: ${packageValue.project.forms.length} forms, ${recordCount} records, ${packageValue.programs.length} saved programs, ${packageValue.runbooks.length} runbooks, ${embeddedAssetCount} embedded map assets.`);
