import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createProjectPackage } from "../app/contracts/project-package.ts";
import { createProjectArchive } from "../app/contracts/project-archive.ts";
import { inferSchemaFromRows, parseCsv } from "../app/forms/csv.ts";

const wasmRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const demoRoot = path.join(wasmRoot, "demo");
const examplesRoot = path.join(demoRoot, "examples");

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
const foodbornePrograms = [
  await pgmProgram(
    "foodborne/foodborne-classic-command-tour.pgm7",
    "foodborne-classic-command-tour",
    "Foodborne Classic Analysis parity and new-branch command tour.",
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
const clusterPrograms = await catalogPrograms("cluster/space-time-cluster-synthetic-v0.1.programs.json");
await writePackage(
  "space-time-cluster-detection.epia.json",
  {
    version: 1,
    name: "Space-Time Cluster Detection",
    currentFormId: clusterForm.id,
    storage: { type: "browser" },
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
    forms: [gisIngestionForm],
  },
  gisIngestionPrograms,
  [await runbook("gis-defensive-ingestion/gis-defensive-ingestion.runbook.json")],
);

const recordLinkPackagePath = path.join(examplesRoot, "recordlink", "recordlink-synthetic-project.epia.json");
const recordLinkPackage = JSON.parse(await readFile(recordLinkPackagePath, "utf8"));
recordLinkPackage.programs[0].source = await readFile(path.join(examplesRoot, "recordlink", "recordlink-command-tour.pgm7"), "utf8");
recordLinkPackage.programs[0].comment = "Synthetic teaching workflow; V0.11 pauses for governed review, prepares clusters and audit tables, and offers an acknowledged DuckDB analytical output without changing project tables.";
recordLinkPackage.runbooks = [await runbook("recordlink/recordlink.runbook.json")];
await writeFile(recordLinkPackagePath, `${JSON.stringify(recordLinkPackage, null, 2)}\n`);

const projects = [
  {
    id: "foodborne-outbreak-investigation",
    title: "Foodborne Outbreak Investigation",
    description: "96 synthetic investigation records with Classic Analysis and GIS runbooks, command tours, quality profiling, and embedded Toledo GeoJSON and GeoTIFF map layers.",
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
];

for (const project of projects) {
  const absolutePath = path.resolve(examplesRoot, "projects", project.file);
  project.bytes = (await readFile(absolutePath)).byteLength;
  project.sha256 = await sha256(absolutePath);
}

await writeFile(
  path.join(examplesRoot, "projects", "epi-info-projects.json"),
  `${JSON.stringify({
    schemaVersion: 1,
    id: "gov.cdc.epi-info-ai.demo-projects",
    title: "Epi Info AI demonstration projects",
    description: "Checksummed, browser-ready projects maintained in the CDC Epi Info AI GitLab group.",
    projects,
  }, null, 2)}\n`,
);
