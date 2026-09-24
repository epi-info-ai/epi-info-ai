import type { ProjectArchiveAsset } from "../contracts/project-archive.ts";
import type { ProjectPackageV2 } from "../contracts/project-package.ts";

export const PROJECT_CONTENT_MANIFEST_VERSION = 1 as const;

export type ProjectContentArtifactRole = "dataset" | "program" | "runbook" | "code-table" | "settings" | "map";

export interface ProjectContentArtifact {
  id: string;
  role: ProjectContentArtifactRole;
  mediaType: string;
  bytes: number;
  sha256: string;
}

export interface ProjectContentManifestV1 {
  version: typeof PROJECT_CONTENT_MANIFEST_VERSION;
  inventory: {
    forms: number;
    records: number;
    fields: number;
    programs: number;
    runbooks: number;
    codeTables: number;
    mapAssets: number;
    mapLayers: number;
  };
  artifacts: ProjectContentArtifact[];
  mapLayers: Array<{
    id: string;
    kind: string;
    assetId?: string;
    sourceFormId?: string;
  }>;
}

const ROLES = new Set<ProjectContentArtifactRole>(["dataset", "program", "runbook", "code-table", "settings", "map"]);

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be an object.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${path} must be a non-empty string.`);
  return value;
}

function count(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error(`${path} must be a non-negative integer.`);
  return value as number;
}

export function validateProjectContentManifest(value: unknown, path = "contents"): ProjectContentManifestV1 {
  const source = object(value, path);
  if (source.version !== PROJECT_CONTENT_MANIFEST_VERSION) throw new Error(`${path}.version must be ${PROJECT_CONTENT_MANIFEST_VERSION}.`);
  const inventoryValue = object(source.inventory, `${path}.inventory`);
  const inventory: ProjectContentManifestV1["inventory"] = {
    forms: count(inventoryValue.forms, `${path}.inventory.forms`),
    records: count(inventoryValue.records, `${path}.inventory.records`),
    fields: count(inventoryValue.fields, `${path}.inventory.fields`),
    programs: count(inventoryValue.programs, `${path}.inventory.programs`),
    runbooks: count(inventoryValue.runbooks, `${path}.inventory.runbooks`),
    codeTables: count(inventoryValue.codeTables, `${path}.inventory.codeTables`),
    mapAssets: count(inventoryValue.mapAssets, `${path}.inventory.mapAssets`),
    mapLayers: count(inventoryValue.mapLayers, `${path}.inventory.mapLayers`),
  };
  if (!Array.isArray(source.artifacts) || source.artifacts.length < 2 || source.artifacts.length > 512) {
    throw new Error(`${path}.artifacts must contain 2 to 512 declared artifacts.`);
  }
  const ids = new Set<string>();
  const artifacts = source.artifacts.map((value, index): ProjectContentArtifact => {
    const artifact = object(value, `${path}.artifacts[${index}]`);
    const id = text(artifact.id, `${path}.artifacts[${index}].id`);
    if (ids.has(id)) throw new Error(`${path}.artifacts contains duplicate id ${JSON.stringify(id)}.`);
    ids.add(id);
    const role = text(artifact.role, `${path}.artifacts[${index}].role`) as ProjectContentArtifactRole;
    if (!ROLES.has(role)) throw new Error(`${path}.artifacts[${index}].role is unsupported.`);
    const sha256 = text(artifact.sha256, `${path}.artifacts[${index}].sha256`).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`${path}.artifacts[${index}].sha256 must be a SHA-256 digest.`);
    return {
      id,
      role,
      mediaType: text(artifact.mediaType, `${path}.artifacts[${index}].mediaType`),
      bytes: count(artifact.bytes, `${path}.artifacts[${index}].bytes`),
      sha256,
    };
  });
  if (!Array.isArray(source.mapLayers) || source.mapLayers.length > 128) throw new Error(`${path}.mapLayers must be an array of no more than 128 layers.`);
  const layerIds = new Set<string>();
  const mapLayers = source.mapLayers.map((value, index) => {
    const layer = object(value, `${path}.mapLayers[${index}]`);
    const id = text(layer.id, `${path}.mapLayers[${index}].id`);
    if (layerIds.has(id)) throw new Error(`${path}.mapLayers contains duplicate id ${JSON.stringify(id)}.`);
    layerIds.add(id);
    const result: ProjectContentManifestV1["mapLayers"][number] = { id, kind: text(layer.kind, `${path}.mapLayers[${index}].kind`) };
    if (layer.assetId !== undefined) result.assetId = text(layer.assetId, `${path}.mapLayers[${index}].assetId`);
    if (layer.sourceFormId !== undefined) result.sourceFormId = text(layer.sourceFormId, `${path}.mapLayers[${index}].sourceFormId`);
    return result;
  });
  if (artifacts.filter(({ role }) => role === "dataset").length !== inventory.forms
    || artifacts.filter(({ role }) => role === "program").length !== inventory.programs
    || artifacts.filter(({ role }) => role === "runbook").length !== inventory.runbooks
    || artifacts.filter(({ role }) => role === "code-table").length !== inventory.codeTables
    || artifacts.filter(({ role }) => role === "map").length !== inventory.mapAssets
    || mapLayers.length !== inventory.mapLayers) {
    throw new Error(`${path} artifact and layer counts do not match its inventory.`);
  }
  if (artifacts.filter(({ role }) => role === "settings").length !== 1) throw new Error(`${path} must declare exactly one settings artifact.`);
  return { version: PROJECT_CONTENT_MANIFEST_VERSION, inventory, artifacts, mapLayers };
}

async function digest(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes).buffer);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function artifact(id: string, role: ProjectContentArtifactRole, mediaType: string, value: string | Blob): Promise<ProjectContentArtifact> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(await value.arrayBuffer());
  return { id, role, mediaType, bytes: bytes.byteLength, sha256: await digest(bytes) };
}

export async function createProjectContentManifest(projectPackage: ProjectPackageV2, archiveAssets: readonly ProjectArchiveAsset[]): Promise<ProjectContentManifestV1> {
  const artifacts: ProjectContentArtifact[] = [];
  for (const form of projectPackage.project.forms) {
    artifacts.push(await artifact(`dataset:${form.id}`, "dataset", "application/vnd.epi-info-ai.form+json", JSON.stringify(form)));
  }
  for (const program of projectPackage.programs) {
    artifacts.push(await artifact(`program:${program.name}`, "program", program.language === "check-code" ? "text/x-epi-info-check-code" : "text/x-epi-info-classic-analysis", program.source));
  }
  for (const runbook of projectPackage.runbooks ?? []) {
    artifacts.push(await artifact(`runbook:${runbook.id}`, "runbook", "application/vnd.epi-info-ai.runbook+json", JSON.stringify(runbook)));
  }
  for (const table of projectPackage.codeTables) {
    artifacts.push(await artifact(`code-table:${table.name}`, "code-table", "application/vnd.epi-info-ai.code-table+json", JSON.stringify(table)));
  }
  artifacts.push(await artifact("project-settings", "settings", "application/vnd.epi-info-ai.project-settings+json", JSON.stringify({
    name: projectPackage.project.name,
    currentFormId: projectPackage.project.currentFormId,
    studyAreas: projectPackage.project.studyAreas ?? [],
    mapLayers: projectPackage.project.mapLayers ?? [],
    mapPresentation: projectPackage.project.mapPresentation ?? null,
  })));
  const assetFiles = new Map(archiveAssets.map(({ asset, file }) => [asset.sha256, file]));
  for (const assetValue of [
    ...(projectPackage.project.studyAreas ?? []).flatMap((area) => area.offlineMap.asset ? [area.offlineMap.asset] : []),
    ...(projectPackage.project.mapAssets ?? []),
    ...(projectPackage.project.referenceLayerSources ?? []),
  ].filter((assetValue, index, values) => values.findIndex((candidate) => candidate.sha256 === assetValue.sha256) === index)) {
    const file = assetFiles.get(assetValue.sha256);
    if (!file) throw new Error(`Teaching project content manifest is missing bytes for ${assetValue.fileName}.`);
    artifacts.push(await artifact(`map:${assetValue.id}`, "map", "mediaType" in assetValue ? assetValue.mediaType : "application/vnd.pmtiles", file));
  }
  const mapLayers = (projectPackage.project.mapLayers ?? []).map((layer) => ({
    id: layer.id,
    kind: layer.kind,
    ...("assetId" in layer ? { assetId: layer.assetId } : {}),
    ...("sourceFormId" in layer ? { sourceFormId: layer.sourceFormId } : {}),
  }));
  return validateProjectContentManifest({
    version: PROJECT_CONTENT_MANIFEST_VERSION,
    inventory: {
      forms: projectPackage.project.forms.length,
      records: projectPackage.project.forms.reduce((total, form) => total + form.records.length, 0),
      fields: projectPackage.project.forms.reduce((total, form) => total + form.schema.fields.length, 0),
      programs: projectPackage.programs.length,
      runbooks: projectPackage.runbooks?.length ?? 0,
      codeTables: projectPackage.codeTables.length,
      mapAssets: artifacts.filter(({ role }) => role === "map").length,
      mapLayers: mapLayers.length,
    },
    artifacts,
    mapLayers,
  });
}

export async function verifyProjectContentManifest(projectPackage: ProjectPackageV2, archiveAssets: readonly ProjectArchiveAsset[], expectedValue: unknown): Promise<void> {
  const expected = validateProjectContentManifest(expectedValue);
  const actual = await createProjectContentManifest(projectPackage, archiveAssets);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Teaching project package contents do not match the catalog manifest.");
}
