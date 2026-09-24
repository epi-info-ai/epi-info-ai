import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createProjectPackage } from "../app/contracts/project-package.ts";
import { createProjectArchive, isBinaryProjectArchive, parseProjectArchive } from "../app/contracts/project-archive.ts";
import { parseProjectPackage } from "../app/contracts/project-package.ts";
import { createProjectContentManifest } from "../app/projects/project-content-manifest.ts";
import { inferSchemaFromRows, parseCsv } from "../app/forms/csv.ts";

const wasmRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demoRoot = path.join(wasmRoot, "demo");
const examplesRoot = path.join(demoRoot, "examples");

const publicSyntheticPrivacy = {
  schema: "epi-info-ai-privacy/0.1",
  data: "public-synthetic",
  geography: "public-synthetic",
  containsRecordValues: true,
  purpose: "Public synthetic teaching and validation project",
  approvedUses: ["map-display", "download"],
};

async function sha256(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function datasetForm(relativeCsvPath, id, datasetId) {
  const absolutePath = path.join(examplesRoot, relativeCsvPath);
  const text = await readFile(absolutePath, "utf8");
  const inferred = inferSchemaFromRows(path.basename(relativeCsvPath), parseCsv(text));
  return {
    id,
    schema: inferred.schema,
    records: inferred.records,
    dataset: {
      id: datasetId,
      file: path.basename(relativeCsvPath),
      sha256: await sha256(absolutePath),
    },
  };
}

async function catalogPrograms(relativeCatalogPath) {
  const catalog = JSON.parse(await readFile(path.join(examplesRoot, relativeCatalogPath), "utf8"));
  return catalog.programs.map((program) => ({
    name: program.id,
    source: program.source,
    language: "classic-analysis",
    author: "Epi Info AI",
    comment: program.description,
    createdAt: "2026-09-16T12:00:00.000Z",
    modifiedAt: "2026-09-16T12:00:00.000Z",
  }));
}

async function pgmProgram(relativePgmPath, name, comment) {
  return {
    name,
    source: await readFile(path.join(examplesRoot, relativePgmPath), "utf8"),
    language: "classic-analysis",
    author: "Epi Info AI",
    comment,
    createdAt: "2026-09-16T12:00:00.000Z",
    modifiedAt: "2026-09-16T12:00:00.000Z",
  };
}

async function checkCodeProgram(relativePath, name, comment) {
  return {
    name,
    source: await readFile(path.join(examplesRoot, relativePath), "utf8"),
    language: "check-code",
    author: "Epi Info AI",
    comment,
    createdAt: "2026-09-22T12:00:00.000Z",
    modifiedAt: "2026-09-22T12:00:00.000Z",
  };
}

async function runbook(relativePath) {
  return JSON.parse(await readFile(path.join(examplesRoot, relativePath), "utf8"));
}

async function writePackage(fileName, project, programs, runbooks) {
  const outputPath = path.join(examplesRoot, "projects", fileName);
  const packageValue = createProjectPackage(project, { programs, codeTables: [], runbooks });
  try {
    const existing = JSON.parse(await readFile(outputPath, "utf8"));
    if (typeof existing.exportedAt === "string") packageValue.exportedAt = existing.exportedAt;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  await writeFile(outputPath, `${JSON.stringify(packageValue, null, 2)}\n`);
  return { outputPath, packageValue };
}

async function mapAsset(relativePath, format) {
  const absolutePath = path.join(examplesRoot, relativePath);
  const bytes = await readFile(absolutePath);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const fileName = path.basename(relativePath);
  return {
    asset: {
      id: digest,
      fileName,
      storage: "opfs",
      storagePath: `epi-info-ai/map-assets/${digest}${format === "geojson" ? ".geojson" : ".tif"}`,
      byteLength: bytes.byteLength,
      sha256: digest,
      format,
      mediaType: format === "geojson" ? "application/geo+json" : "image/tiff",
      importedAt: "2026-09-17T12:00:00.000Z",
      persistence: "best-effort",
    },
    file: new File([bytes], fileName, { type: format === "geojson" ? "application/geo+json" : "image/tiff" }),
  };
}

const foodborneForm = await datasetForm(
  "foodborne/foodborne-outbreak-investigation.csv",
  "foodborne-outbreak-investigation",
  "foodborne-outbreak-investigation",
);
foodborneForm.schema.fields.push({ name: "save_record", prompt: "Save record through Check Code", type: "command-button", required: false });
foodborneForm.schema.pages = [
  { name: "EntryPage", fields: ["id", "age", "sex", "case_status", "save_record"] },
  { name: "Clinical", fields: ["onset_date", "onset_time", "hospitalization_date", "specimen_date", "interview_date", "diarrhea", "vomiting", "nausea", "abdominal_cramps", "fever", "bloody_stool"] },
  { name: "ExposureLocation", fields: ["potato_salad", "grilled_chicken", "coleslaw", "hamburger", "hot_dog", "fruit_salad", "cake", "lemonade", "iced_tea", "latitude", "longitude", "household_neighborhood"] },
];
foodborneForm.schema.checkCodeProgram = {
  version: 1,
  language: "epi-info-check-code",
  source: await readFile(path.join(examplesRoot, "foodborne/foodborne-check-code-tour.chk"), "utf8"),
};
const foodbornePrograms = [
  await pgmProgram(
    "foodborne/foodborne-classic-command-tour.pgm7",
    "foodborne-classic-command-tour",
    "Foodborne Classic Analysis parity and new-branch command tour.",
  ),
  await checkCodeProgram(
    "foodborne/foodborne-check-code-tour.chk",
    "foodborne-check-code-tour",
    "Foodborne Form Designer Check Code tour with page, record, field, dialog, and bounded navigation events.",
  ),
  await checkCodeProgram(
    "foodborne/foodborne-check-code-expressions.chk",
    "foodborne-check-code-expressions",
    "Foodborne typed arithmetic, text, date, conversion, and conditional-expression tour.",
  ),
  ...(await catalogPrograms("foodborne/foodborne-outbreak-investigation.programs.json")),
];
const foodborneGeoJson = await mapAsset("foodborne/maps/city-of-toledo-neighborhoods.geojson", "geojson");
const foodborneGeoTiff = await mapAsset("foodborne/maps/worldpop-toledo-population-density.tif", "geotiff");
const foodborneProjectResult = await writePackage(
  "foodborne-outbreak-investigation.epia.json",
  {
    version: 1,
    name: "Foodborne Outbreak Investigation",
    currentFormId: foodborneForm.id,
    storage: { type: "browser" },
    privacy: publicSyntheticPrivacy,
    forms: [foodborneForm],
    mapAssets: [foodborneGeoJson.asset, foodborneGeoTiff.asset],
    mapLayers: [
      {
        id: "foodborne-case-cluster",
        kind: "case-cluster",
        sourceFormId: foodborneForm.id,
        name: "Foodborne illness reports",
        visible: true,
        latitudeField: "latitude",
        longitudeField: "longitude",
        labelField: "id",
      },
      { id: "toledo-neighborhoods", kind: "geojson", assetId: foodborneGeoJson.asset.id, name: "City of Toledo neighborhoods", visible: true, labelField: "name", labelsEnabled: true },
      { id: "toledo-population-density", kind: "raster", assetId: foodborneGeoTiff.asset.id, name: "WorldPop Toledo population density", visible: true, opacity: 0.7 },
    ],
  },
  foodbornePrograms,
  [
    await runbook("foodborne/foodborne-investigation.runbook.json"),
    await runbook("foodborne/foodborne-gis-investigation.runbook.json"),
    await runbook("foodborne/foodborne-check-code.runbook.json"),
    await runbook("foodborne/foodborne-form-designer.runbook.json"),
  ],
);
const foodborneArchive = await createProjectArchive(foodborneProjectResult.packageValue, [foodborneGeoJson, foodborneGeoTiff]);
await writeFile(
  path.join(examplesRoot, "projects", "foodborne-outbreak-investigation.epia"),
  new Uint8Array(await foodborneArchive.arrayBuffer()),
);

const clusterForm = await datasetForm(
  "cluster/space-time-cluster-synthetic-v0.1.csv",
  "space-time-cluster-cases",
  "space-time-cluster-synthetic-v0.1",
);
clusterForm.schema.pages = [
  { name: "Event", fields: ["case_id", "event_date", "location_id", "syndrome"] },
  { name: "Location", fields: ["latitude", "longitude"] },
];
clusterForm.schema.checkCodeProgram = {
  version: 1,
  language: "epi-info-check-code",
  source: await readFile(path.join(examplesRoot, "cluster/space-time-cluster-check-code-tour.chk"), "utf8"),
};
const clusterPrograms = [
  ...(await catalogPrograms("cluster/space-time-cluster-synthetic-v0.1.programs.json")),
  await checkCodeProgram(
    "cluster/space-time-cluster-check-code-tour.chk",
    "space-time-cluster-check-code-tour",
    "Entry-time location and coordinate review for the synthetic cluster lesson.",
  ),
];
await writePackage(
  "space-time-cluster-detection.epia.json",
  {
    version: 1,
    name: "Space-Time Cluster Detection",
    currentFormId: clusterForm.id,
    storage: { type: "browser" },
    privacy: publicSyntheticPrivacy,
    forms: [clusterForm],
  },
  clusterPrograms,
  [await runbook("cluster/space-time-cluster.runbook.json")],
);

const gisIngestionForm = await datasetForm(
  "gis-defensive-ingestion/gis-defensive-ingestion-test-cases.csv",
  "gis-defensive-ingestion-test-cases",
  "gis-defensive-ingestion-test-cases",
);
const gisIngestionPrograms = await catalogPrograms("gis-defensive-ingestion/gis-defensive-ingestion.programs.json");
await writePackage(
  "gis-defensive-ingestion-teaching.epia.json",
  {
    version: 1,
    name: "GIS Defensive Ingestion Teaching Example",
    currentFormId: gisIngestionForm.id,
    storage: { type: "browser" },
    privacy: publicSyntheticPrivacy,
    forms: [gisIngestionForm],
  },
  gisIngestionPrograms,
  [await runbook("gis-defensive-ingestion/gis-defensive-ingestion.runbook.json")],
);

const environmentalForm = await datasetForm(
  "environmental-epidemiology/data/synthetic-heat-health-observations.csv",
  "synthetic-heat-health-observations",
  "synthetic-heat-health-observations",
);
environmentalForm.schema.pages = [
  { name: "Observation", fields: ["observation_id", "observation_date", "study_area", "health_event"] },
  { name: "Exposure", fields: ["heat_index_c", "heat_category", "extreme_heat", "exposure_source"] },
  { name: "Location", fields: ["latitude", "longitude"] },
];
const environmentalPrograms = [await pgmProgram(
  "environmental-epidemiology/environmental-heat-health-tour.pgm7",
  "environmental-heat-health-tour",
  "Synthetic quality, descriptive analysis, 2 x 2, chart, GIS-kernel, and map teaching workflow.",
)];
const environmentalPoints = await mapAsset("environmental-epidemiology/maps/synthetic-heat-health-observations.geojson", "geojson");
const environmentalProjectResult = await writePackage(
  "environmental-heat-health-candidate.epia.json",
  {
    version: 1,
    name: "Environmental Heat and Health Candidate",
    currentFormId: environmentalForm.id,
    storage: { type: "browser" },
    privacy: publicSyntheticPrivacy,
    forms: [environmentalForm],
    mapAssets: [environmentalPoints.asset],
    mapLayers: [
      {
        id: "environmental-observation-points",
        kind: "case-cluster",
        sourceFormId: environmentalForm.id,
        name: "Synthetic heat-health observations",
        visible: true,
        latitudeField: "latitude",
        longitudeField: "longitude",
        labelField: "observation_id",
      },
      {
        id: "environmental-observation-reference",
        kind: "geojson",
        assetId: environmentalPoints.asset.id,
        name: "Packaged environmental observation fixture",
        visible: false,
        labelField: "observation_id",
        labelsEnabled: false,
      },
    ],
  },
  environmentalPrograms,
  [await runbook("environmental-epidemiology/environmental-heat-health.runbook.json")],
);
const environmentalArchive = await createProjectArchive(environmentalProjectResult.packageValue, [environmentalPoints]);
await writeFile(
  path.join(examplesRoot, "projects", "environmental-heat-health-candidate.epia"),
  new Uint8Array(await environmentalArchive.arrayBuffer()),
);

const recordLinkPackagePath = path.join(examplesRoot, "recordlink", "recordlink-synthetic-project.epia.json");
const recordLinkPackage = JSON.parse(await readFile(recordLinkPackagePath, "utf8"));
recordLinkPackage.programs[0].source = await readFile(path.join(examplesRoot, "recordlink", "recordlink-command-tour.pgm7"), "utf8");
recordLinkPackage.programs[0].comment = "Synthetic teaching workflow; V0.11 pauses for governed review, prepares clusters and audit tables, and offers an acknowledged DuckDB analytical output without changing project tables.";
recordLinkPackage.runbooks = [await runbook("recordlink/recordlink.runbook.json")];
const registryACheckCode = await checkCodeProgram(
  "recordlink/patient-registry-a-check-code.chk",
  "patient-registry-a-check-code",
  "Source-identifier and page-navigation checks for patient registry A.",
);
const surveillanceBCheckCode = await checkCodeProgram(
  "recordlink/surveillance-b-check-code.chk",
  "surveillance-b-check-code",
  "Client-identifier and page-navigation checks for surveillance source B.",
);
recordLinkPackage.programs = [
  ...recordLinkPackage.programs.filter(({ language }) => language !== "check-code"),
  registryACheckCode,
  surveillanceBCheckCode,
];
const registryAForm = recordLinkPackage.project.forms.find(({ id }) => id === "patient-registry-a");
if (!registryAForm) throw new Error("The record-linkage package is missing patient-registry-a.");
registryAForm.schema.pages = [
  { name: "Identity", fields: ["record_id", "first_name", "middle_name", "last_name"] },
  { name: "Demographics", fields: ["date_of_birth", "sex", "patient_address", "art_code", "facility_code"] },
];
registryAForm.schema.checkCodeProgram = { version: 1, language: "epi-info-check-code", source: registryACheckCode.source };
const surveillanceBForm = recordLinkPackage.project.forms.find(({ id }) => id === "surveillance-b");
if (!surveillanceBForm) throw new Error("The record-linkage package is missing surveillance-b.");
surveillanceBForm.schema.pages = [
  { name: "Identity", fields: ["client_id", "given_name", "middle", "family_name"] },
  { name: "Demographics", fields: ["DOB", "SEX", "Address", "ART_CODE", "site_code"] },
];
surveillanceBForm.schema.checkCodeProgram = { version: 1, language: "epi-info-check-code", source: surveillanceBCheckCode.source };
await writeFile(recordLinkPackagePath, `${JSON.stringify(recordLinkPackage, null, 2)}\n`);

const projects = [
  {
    id: "foodborne-outbreak-investigation",
    title: "Foodborne Outbreak Investigation",
    description: "96 synthetic investigation records with Classic Analysis, Check Code, and GIS runbooks, command tours, quality profiling, and embedded Toledo GeoJSON and GeoTIFF map layers.",
    file: "foodborne-outbreak-investigation.epia",
    repository: "https://git.cdc.gov/epi-info-ai/foodborne-outbreak-investigation",
  },
  {
    id: "space-time-cluster-detection",
    title: "Space-Time Cluster Detection",
    description: "30 synthetic fever/rash events with a planted cluster, reproducible analysis parameters, mapping, and story-tour output.",
    file: "space-time-cluster-detection.epia.json",
    repository: "https://git.cdc.gov/epi-info-ai/space-time-cluster-detection",
  },
  {
    id: "record-linkage",
    title: "Synthetic Patient Record Linkage",
    description: "Two synthetic patient sources, known truth links, source quality review, explainable RECORDLINK classification, and bounded local clerical review.",
    file: "../recordlink/recordlink-synthetic-project.epia.json",
    repository: "https://git.cdc.gov/epi-info-ai/recordlink",
  },
  {
    id: "gis-defensive-ingestion-teaching",
    title: "GIS Defensive Ingestion Teaching Example",
    description: "Ten synthetic uploadable GeoJSON and CSV cases with a saved program that filters expected outcomes and reviews GIS-K03 defensive-ingestion behavior.",
    file: "gis-defensive-ingestion-teaching.epia.json",
    repository: "https://git.cdc.gov/epi-info-ai/epi-gis-kernel",
  },
  {
    id: "environmental-heat-health-candidate",
    title: "Environmental Heat and Health Candidate",
    description: "Twelve synthetic heat-health observations with data quality, descriptive analysis, 2 x 2 and chart output, an epi-gis Worker lab, a packaged point layer, and a learner-operated runbook.",
    file: "environmental-heat-health-candidate.epia",
    repository: "https://git.cdc.gov/epi-info-ai/package-environmental-epidemiology",
  },
];

for (const project of projects) {
  const absolutePath = path.resolve(examplesRoot, "projects", project.file);
  const bytes = await readFile(absolutePath);
  project.bytes = bytes.byteLength;
  project.sha256 = await sha256(absolutePath);
  const file = new File([bytes], path.basename(project.file), { type: "application/vnd.epi-info-ai.project" });
  if (await isBinaryProjectArchive(file)) {
    const parsed = await parseProjectArchive(file);
    project.contents = await createProjectContentManifest(parsed.projectPackage, parsed.assets);
  } else {
    project.contents = await createProjectContentManifest(parseProjectPackage(await file.text()), []);
  }
}

await writeFile(
  path.join(examplesRoot, "projects", "epi-info-projects.json"),
  `${JSON.stringify({
    schemaVersion: 2,
    id: "gov.cdc.epi-info-ai.demo-projects",
    title: "Epi Info AI demonstration projects",
    description: "Checksummed, browser-ready projects maintained in the CDC Epi Info AI GitLab group.",
    projects,
  }, null, 2)}\n`,
);
