import type { ProjectReferenceLayerSourceV1 } from "../contracts/core.ts";

const MAX_REFERENCE_SOURCE_BYTES = 100 * 1024 * 1024;

function extension(format: ProjectReferenceLayerSourceV1["packageFormat"]): string {
  return format === "ZIP" ? ".zip" : ".gpkg";
}

function mediaType(format: ProjectReferenceLayerSourceV1["packageFormat"]): ProjectReferenceLayerSourceV1["mediaType"] {
  return format === "ZIP" ? "application/zip" : "application/geopackage+sqlite3";
}

async function sha256(blob: Blob): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sourceDirectory(create = false): Promise<FileSystemDirectoryHandle> {
  if (!navigator.storage?.getDirectory) throw new Error("This browser does not provide OPFS for reference-layer sources.");
  const root = await navigator.storage.getDirectory();
  const app = await root.getDirectoryHandle("epi-info-ai", { create });
  return app.getDirectoryHandle("reference-layer-sources", { create });
}

async function writeSource(fileName: string, file: Blob): Promise<"persistent" | "best-effort"> {
  const directory = await sourceDirectory(true);
  const handle = await directory.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  try { await writable.write(file); await writable.close(); }
  catch (error) { await writable.abort().catch(() => undefined); throw error; }
  return (await navigator.storage.persist?.().catch(() => false)) ? "persistent" : "best-effort";
}

export async function storeReferenceLayerSource(file: File, packageFormat: ProjectReferenceLayerSourceV1["packageFormat"]): Promise<ProjectReferenceLayerSourceV1> {
  if (file.size < 1 || file.size > MAX_REFERENCE_SOURCE_BYTES) throw new RangeError("The reference-layer source exceeds the 100 MiB limit.");
  const digest = await sha256(file);
  const storedName = `${digest}${extension(packageFormat)}`;
  const persistence = await writeSource(storedName, file);
  return {
    id: digest,
    fileName: file.name,
    storage: "opfs",
    storagePath: `epi-info-ai/reference-layer-sources/${storedName}`,
    byteLength: file.size,
    sha256: digest,
    format: "reference-package",
    mediaType: mediaType(packageFormat),
    packageFormat,
    importedAt: new Date().toISOString(),
    persistence,
  };
}

function storedName(source: ProjectReferenceLayerSourceV1): string {
  const expected = `${source.sha256}${extension(source.packageFormat)}`;
  if (source.storagePath !== `epi-info-ai/reference-layer-sources/${expected}`) throw new Error("The reference-layer source storage path is invalid.");
  return expected;
}

export async function readReferenceLayerSource(source: ProjectReferenceLayerSourceV1): Promise<File> {
  const file = await (await sourceDirectory()).getFileHandle(storedName(source)).then((handle) => handle.getFile());
  if (file.size !== source.byteLength || await sha256(file) !== source.sha256) throw new Error(`Stored reference-layer source ${source.fileName} failed its integrity check.`);
  return new File([file], source.fileName, { type: source.mediaType });
}

export async function restoreReferenceLayerSource(recorded: ProjectReferenceLayerSourceV1, file: File): Promise<ProjectReferenceLayerSourceV1> {
  if (file.size !== recorded.byteLength || await sha256(file) !== recorded.sha256) throw new Error(`Embedded reference-layer source ${recorded.fileName} failed its integrity check.`);
  const persistence = await writeSource(`${recorded.sha256}${extension(recorded.packageFormat)}`, file);
  return { ...recorded, storagePath: `epi-info-ai/reference-layer-sources/${recorded.sha256}${extension(recorded.packageFormat)}`, persistence };
}

export async function removeReferenceLayerSource(source: ProjectReferenceLayerSourceV1): Promise<void> {
  await (await sourceDirectory()).removeEntry(storedName(source));
}
