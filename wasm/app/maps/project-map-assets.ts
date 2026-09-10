import type { ProjectMapAsset } from "../contracts/core.ts";

export const MAX_PROJECT_GEOJSON_BYTES = 10 * 1024 * 1024;
export const MAX_PROJECT_GEOTIFF_BYTES = 50 * 1024 * 1024;

function extension(format: ProjectMapAsset["format"]): string {
  return format === "geojson" ? ".geojson" : ".tif";
}

function mediaType(format: ProjectMapAsset["format"]): ProjectMapAsset["mediaType"] {
  return format === "geojson" ? "application/geo+json" : "image/tiff";
}

function validatePath(asset: ProjectMapAsset): string {
  const segments = asset.storagePath.split("/");
  if (segments.length !== 3 || segments[0] !== "epi-info-ai" || segments[1] !== "map-assets"
    || segments[2] !== `${asset.sha256}${extension(asset.format)}`) {
    throw new Error("The project map asset storage path is invalid.");
  }
  return segments[2];
}

async function sha256(blob: Blob): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function validateProjectMapAssetFile(file: Blob, format: ProjectMapAsset["format"]): Promise<void> {
  const limit = format === "geojson" ? MAX_PROJECT_GEOJSON_BYTES : MAX_PROJECT_GEOTIFF_BYTES;
  if (file.size < 1 || file.size > limit) throw new Error(`The ${format === "geojson" ? "GeoJSON" : "GeoTIFF"} is outside its ${limit / 1024 / 1024} MiB limit.`);
  if (format === "geojson") {
    let value: unknown;
    try { value = JSON.parse(await file.text()); }
    catch { throw new Error("The GeoJSON asset is not valid JSON."); }
    if (!value || typeof value !== "object" || Array.isArray(value)
      || typeof (value as { type?: unknown }).type !== "string") {
      throw new Error("The GeoJSON asset does not contain a GeoJSON object.");
    }
    return;
  }
  const prefix = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const littleEndian = prefix[0] === 0x49 && prefix[1] === 0x49 && prefix[2] === 0x2a && prefix[3] === 0x00;
  const bigEndian = prefix[0] === 0x4d && prefix[1] === 0x4d && prefix[2] === 0x00 && prefix[3] === 0x2a;
  if (!littleEndian && !bigEndian) throw new Error("The GeoTIFF asset has an invalid TIFF header.");
}

async function assetDirectory(create = false): Promise<FileSystemDirectoryHandle> {
  if (!navigator.storage?.getDirectory) throw new Error("This browser does not provide OPFS for project map assets.");
  const root = await navigator.storage.getDirectory();
  const app = await root.getDirectoryHandle("epi-info-ai", { create });
  return app.getDirectoryHandle("map-assets", { create });
}

async function writeAsset(fileName: string, file: Blob): Promise<"persistent" | "best-effort"> {
  const directory = await assetDirectory(true);
  const handle = await directory.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  try { await writable.write(file); await writable.close(); }
  catch (error) { await writable.abort().catch(() => undefined); throw error; }
  const persisted = await navigator.storage.persist?.().catch(() => false);
  return persisted ? "persistent" : "best-effort";
}

export async function storeProjectMapAsset(file: File, format: ProjectMapAsset["format"]): Promise<ProjectMapAsset> {
  await validateProjectMapAssetFile(file, format);
  const digest = await sha256(file);
  const storedName = `${digest}${extension(format)}`;
  const persistence = await writeAsset(storedName, file);
  return {
    id: digest,
    fileName: file.name,
    storage: "opfs",
    storagePath: `epi-info-ai/map-assets/${storedName}`,
    byteLength: file.size,
    sha256: digest,
    format,
    mediaType: mediaType(format),
    importedAt: new Date().toISOString(),
    persistence,
  };
}

export async function readProjectMapAsset(asset: ProjectMapAsset): Promise<File> {
  const storedName = validatePath(asset);
  const directory = await assetDirectory();
  const file = await (await directory.getFileHandle(storedName)).getFile();
  if (file.size !== asset.byteLength || await sha256(file) !== asset.sha256) throw new Error(`Stored map asset ${asset.fileName} failed its integrity check.`);
  await validateProjectMapAssetFile(file, asset.format);
  return new File([file], asset.fileName, { type: asset.mediaType });
}

export async function restoreProjectMapAsset(recorded: ProjectMapAsset, file: File): Promise<ProjectMapAsset> {
  if (file.size !== recorded.byteLength) throw new Error(`Embedded map asset ${recorded.fileName} has the wrong byte length.`);
  await validateProjectMapAssetFile(file, recorded.format);
  if (await sha256(file) !== recorded.sha256) throw new Error(`Embedded map asset ${recorded.fileName} failed its SHA-256 check.`);
  const storedName = `${recorded.sha256}${extension(recorded.format)}`;
  const persistence = await writeAsset(storedName, file);
  return { ...recorded, storagePath: `epi-info-ai/map-assets/${storedName}`, persistence };
}

export async function removeProjectMapAsset(asset: ProjectMapAsset): Promise<void> {
  const storedName = validatePath(asset);
  const directory = await assetDirectory();
  await directory.removeEntry(storedName);
}
