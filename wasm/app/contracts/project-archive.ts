import type { OfflineMapAsset, ProjectMapAsset } from "./core.ts";
import { validateProjectPackage, type ProjectPackageV2 } from "./project-package.ts";
import { parsePmtilesHeader } from "../maps/pmtiles-import.ts";
import { validateProjectMapAssetFile } from "../maps/project-map-assets.ts";

export const PROJECT_ARCHIVE_FORMAT = "epi-info-ai-archive" as const;
export const PROJECT_ARCHIVE_VERSION = 1 as const;
export const MAX_PROJECT_ARCHIVE_BYTES = 150 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 25 * 1024 * 1024;
const MAGIC = new Uint8Array([0x45, 0x50, 0x49, 0x41, 0x01, 0x0d, 0x0a, 0x1a]);
const HEADER_BYTES = 12;

interface ProjectArchiveManifest {
  format: typeof PROJECT_ARCHIVE_FORMAT;
  version: typeof PROJECT_ARCHIVE_VERSION;
  projectPackage: ProjectPackageV2;
  assets: PortableProjectAsset[];
}

export type PortableProjectAsset = OfflineMapAsset | ProjectMapAsset;

export interface ProjectArchiveAsset {
  asset: PortableProjectAsset;
  file: File;
}

export interface ParsedProjectArchive {
  projectPackage: ProjectPackageV2;
  assets: ProjectArchiveAsset[];
}

function linkedAssets(projectPackage: ProjectPackageV2): PortableProjectAsset[] {
  const assets: PortableProjectAsset[] = [
    ...(projectPackage.project.studyAreas ?? []).flatMap((studyArea) => studyArea.offlineMap.asset ? [studyArea.offlineMap.asset] : []),
    ...(projectPackage.project.mapAssets ?? []),
  ];
  for (const asset of assets) {
    const sameDigest = assets.find((candidate) => candidate !== asset && candidate.sha256 === asset.sha256);
    if (sameDigest && !sameAsset(asset, sameDigest)) {
      throw new Error(`Project asset references for SHA-256 ${asset.sha256} contain conflicting provenance.`);
    }
  }
  return assets.filter((asset, index) => assets.findIndex((candidate) => candidate.sha256 === asset.sha256) === index);
}

function sameAsset(left: PortableProjectAsset, right: PortableProjectAsset): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function sha256(blob: Blob): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validatePmtilesPayload(asset: OfflineMapAsset, file: File): void {
  if (file.size !== asset.byteLength) throw new Error(`Embedded PMTiles ${asset.fileName} has the wrong byte length.`);
}

function isOfflineMapAsset(asset: PortableProjectAsset): asset is OfflineMapAsset {
  return asset.format === "pmtiles-v3";
}

async function validatePayload(asset: PortableProjectAsset, file: File): Promise<void> {
  if (file.size !== asset.byteLength) throw new Error(`Embedded project asset ${asset.fileName} has the wrong byte length.`);
  if (await sha256(file) !== asset.sha256) throw new Error(`Embedded project asset ${asset.fileName} failed its SHA-256 check.`);
  if (!isOfflineMapAsset(asset)) {
    await validateProjectMapAssetFile(file, asset.format);
    return;
  }
  validatePmtilesPayload(asset, file);
  const header = parsePmtilesHeader(await file.slice(0, 127).arrayBuffer(), file.size);
  if (header.tileType !== asset.tileType || header.tileCompression !== asset.tileCompression
    || header.minZoom !== asset.minZoom || header.maxZoom !== asset.maxZoom
    || header.bounds.some((coordinate, index) => coordinate !== asset.bounds[index])) {
    throw new Error(`Embedded PMTiles ${asset.fileName} does not match its project metadata.`);
  }
}

function validateAssetSet(projectPackage: ProjectPackageV2, assets: ProjectArchiveAsset[]): void {
  const expected = linkedAssets(projectPackage);
  if (expected.length !== assets.length) throw new Error("The project archive does not contain exactly its referenced map assets.");
  if (new Set(assets.map(({ asset }) => asset.sha256)).size !== assets.length) throw new Error("The project archive contains duplicate map assets.");
  for (const expectedAsset of expected) {
    if (!assets.some(({ asset }) => sameAsset(asset, expectedAsset))) {
      throw new Error(`The project archive is missing the referenced asset ${expectedAsset.fileName}.`);
    }
  }
}

export async function createProjectArchive(
  projectPackageInput: ProjectPackageV2,
  assets: ProjectArchiveAsset[],
): Promise<Blob> {
  const projectPackage = validateProjectPackage(projectPackageInput);
  validateAssetSet(projectPackage, assets);
  const orderedAssets = linkedAssets(projectPackage).map((asset) => assets.find((item) => sameAsset(item.asset, asset))!);
  for (const item of orderedAssets) await validatePayload(item.asset, item.file);
  const manifest: ProjectArchiveManifest = {
    format: PROJECT_ARCHIVE_FORMAT,
    version: PROJECT_ARCHIVE_VERSION,
    projectPackage,
    assets: orderedAssets.map(({ asset }) => asset),
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  if (manifestBytes.byteLength > MAX_MANIFEST_BYTES) throw new Error("The project archive manifest exceeds the prototype limit.");
  const header = new Uint8Array(HEADER_BYTES);
  header.set(MAGIC);
  new DataView(header.buffer).setUint32(8, manifestBytes.byteLength, true);
  const result = new Blob([header, manifestBytes, ...orderedAssets.map(({ file }) => file)], { type: "application/vnd.epi-info-ai.project" });
  if (result.size > MAX_PROJECT_ARCHIVE_BYTES) throw new Error("The portable project archive exceeds the 150 MiB prototype limit.");
  return result;
}

export async function parseProjectArchive(file: File): Promise<ParsedProjectArchive> {
  if (file.size > MAX_PROJECT_ARCHIVE_BYTES) throw new Error("The portable project archive exceeds the 150 MiB prototype limit.");
  if (file.size < HEADER_BYTES) throw new Error("The selected file is not an Epi Info AI project archive.");
  const header = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  if (!MAGIC.every((byte, index) => header[index] === byte)) throw new Error("The selected file is not an Epi Info AI binary project archive.");
  const manifestLength = new DataView(header.buffer).getUint32(8, true);
  if (manifestLength < 1 || manifestLength > MAX_MANIFEST_BYTES || HEADER_BYTES + manifestLength > file.size) {
    throw new Error("The project archive manifest length is invalid.");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(
      await file.slice(HEADER_BYTES, HEADER_BYTES + manifestLength).arrayBuffer(),
    ));
  } catch {
    throw new Error("The project archive manifest is not valid UTF-8 JSON.");
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("The project archive manifest must be an object.");
  const manifest = raw as Partial<ProjectArchiveManifest>;
  if (manifest.format !== PROJECT_ARCHIVE_FORMAT || manifest.version !== PROJECT_ARCHIVE_VERSION || !Array.isArray(manifest.assets)) {
    throw new Error("The project archive manifest format or version is unsupported.");
  }
  const projectPackage = validateProjectPackage(manifest.projectPackage);
  const expected = linkedAssets(projectPackage);
  if (manifest.assets.length !== expected.length) throw new Error("The project archive asset inventory does not match the project.");
  let offset = HEADER_BYTES + manifestLength;
  const assets: ProjectArchiveAsset[] = [];
  for (const expectedAsset of expected) {
    const recorded = manifest.assets.find((asset) => asset && typeof asset === "object"
      && (asset as PortableProjectAsset).sha256 === expectedAsset.sha256) as PortableProjectAsset | undefined;
    if (!recorded || !sameAsset(recorded, expectedAsset)) throw new Error(`The archive manifest does not match ${expectedAsset.fileName}.`);
    const end = offset + expectedAsset.byteLength;
    if (!Number.isSafeInteger(end) || end > file.size) throw new Error(`Embedded project asset ${expectedAsset.fileName} is truncated.`);
    const payload = new File([file.slice(offset, end)], expectedAsset.fileName, {
      type: isOfflineMapAsset(expectedAsset) ? "application/vnd.pmtiles" : expectedAsset.mediaType,
    });
    assets.push({ asset: expectedAsset, file: payload });
    offset = end;
  }
  if (offset !== file.size) throw new Error("The project archive contains unreferenced trailing bytes.");
  validateAssetSet(projectPackage, assets);
  for (const item of assets) await validatePayload(item.asset, item.file);
  return { projectPackage, assets };
}

export async function isBinaryProjectArchive(file: Blob): Promise<boolean> {
  if (file.size < MAGIC.length) return false;
  const prefix = new Uint8Array(await file.slice(0, MAGIC.length).arrayBuffer());
  return MAGIC.every((byte, index) => prefix[index] === byte);
}
