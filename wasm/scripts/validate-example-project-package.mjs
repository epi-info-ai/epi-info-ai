import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const directory = process.cwd();
const requested = process.argv[2];
const candidates = requested
  ? [requested]
  : (await readdir(directory)).filter((name) => name.endsWith(".epia.json"));
assert.equal(candidates.length, 1, "the repository must contain exactly one root .epia.json package");

const packagePath = path.resolve(directory, candidates[0]);
const packageValue = JSON.parse(await readFile(packagePath, "utf8"));
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

console.log(`Validated ${packageValue.project.name}: ${packageValue.project.forms.length} forms, ${recordCount} records, ${packageValue.programs.length} saved programs, ${packageValue.runbooks.length} runbooks.`);
