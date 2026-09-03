import type { OfflineMapAsset, StudyAreaBounds } from "../contracts/core.ts";

const HEADER_BYTES = 127;
const MAGIC = "PMTiles";
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

const TILE_TYPES = new Map<number, OfflineMapAsset["tileType"]>([
  [1, "mvt"], [2, "png"], [3, "jpeg"], [4, "webp"], [5, "avif"],
]);
const COMPRESSIONS = new Map<number, string>([
  [1, "none"], [2, "gzip"], [3, "brotli"], [4, "zstd"],
]);

export interface PmtilesHeader {
  version: 3;
  rootOffset: number;
  rootLength: number;
  metadataOffset: number;
  metadataLength: number;
  leafDirectoryOffset: number;
  leafDirectoryLength: number;
  tileDataOffset: number;
  tileDataLength: number;
  internalCompression: string;
  tileCompression: string;
  tileType: OfflineMapAsset["tileType"];
  minZoom: number;
  maxZoom: number;
  bounds: StudyAreaBounds;
}

export interface ValidatedPmtilesImport {
  file: File;
  header: PmtilesHeader;
  metadata: Record<string, unknown>;
  sha256: string;
  attribution: string;
  license: string;
}

function safeUint64(view: DataView, offset: number, label: string): number {
  const value = view.getBigUint64(offset, true);
  if (value > MAX_SAFE_BIGINT) throw new Error(`${label} is too large for this browser importer.`);
  return Number(value);
}

function sectionWithinFile(offset: number, length: number, fileSize: number, label: string): void {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < HEADER_BYTES || length < 0 || offset + length > fileSize) {
    throw new Error(`${label} falls outside the selected PMTiles file.`);
  }
}

function rejectOverlappingSections(sections: Array<{ offset: number; length: number; label: string }>): void {
  const populated = sections.filter((section) => section.length > 0).sort((left, right) => left.offset - right.offset);
  for (let index = 1; index < populated.length; index += 1) {
    const previous = populated[index - 1]!;
    const current = populated[index]!;
    if (previous.offset + previous.length > current.offset) {
      throw new Error(`${previous.label} overlaps ${current.label} in the PMTiles header.`);
    }
  }
}

export function parsePmtilesHeader(bytes: ArrayBuffer, fileSize: number): PmtilesHeader {
  if (bytes.byteLength < HEADER_BYTES || fileSize < HEADER_BYTES) throw new Error("The file is too small to contain a PMTiles v3 header.");
  const raw = new Uint8Array(bytes, 0, HEADER_BYTES);
  if (new TextDecoder().decode(raw.subarray(0, 7)) !== MAGIC) throw new Error("The selected file does not have the PMTiles signature.");
  const view = new DataView(bytes, 0, HEADER_BYTES);
  if (view.getUint8(7) !== 3) throw new Error(`PMTiles version ${view.getUint8(7)} is not supported; version 3 is required.`);
  const rootOffset = safeUint64(view, 8, "Root directory offset");
  const rootLength = safeUint64(view, 16, "Root directory length");
  const metadataOffset = safeUint64(view, 24, "Metadata offset");
  const metadataLength = safeUint64(view, 32, "Metadata length");
  const leafDirectoryOffset = safeUint64(view, 40, "Leaf directory offset");
  const leafDirectoryLength = safeUint64(view, 48, "Leaf directory length");
  const tileDataOffset = safeUint64(view, 56, "Tile data offset");
  const tileDataLength = safeUint64(view, 64, "Tile data length");
  if (rootLength < 1 || tileDataLength < 1) throw new Error("PMTiles root directory and tile data must not be empty.");
  sectionWithinFile(rootOffset, rootLength, fileSize, "Root directory");
  if (metadataLength > 0) sectionWithinFile(metadataOffset, metadataLength, fileSize, "Metadata");
  if (leafDirectoryLength > 0) sectionWithinFile(leafDirectoryOffset, leafDirectoryLength, fileSize, "Leaf directories");
  sectionWithinFile(tileDataOffset, tileDataLength, fileSize, "Tile data");
  rejectOverlappingSections([
    { offset: rootOffset, length: rootLength, label: "Root directory" },
    { offset: metadataOffset, length: metadataLength, label: "Metadata" },
    { offset: leafDirectoryOffset, length: leafDirectoryLength, label: "Leaf directories" },
    { offset: tileDataOffset, length: tileDataLength, label: "Tile data" },
  ]);
  const internalCompression = COMPRESSIONS.get(view.getUint8(97));
  const tileCompression = COMPRESSIONS.get(view.getUint8(98));
  const tileType = TILE_TYPES.get(view.getUint8(99));
  if (!internalCompression) throw new Error("The PMTiles internal compression is unknown.");
  if (!tileCompression) throw new Error("The PMTiles tile compression is unknown.");
  if (!tileType) throw new Error("The PMTiles tile type is unknown or unsupported.");
  const minZoom = view.getUint8(100);
  const maxZoom = view.getUint8(101);
  if (minZoom > maxZoom || maxZoom > 22) throw new Error("The PMTiles zoom range is invalid.");
  const bounds: StudyAreaBounds = [
    view.getInt32(102, true) / 10_000_000,
    view.getInt32(106, true) / 10_000_000,
    view.getInt32(110, true) / 10_000_000,
    view.getInt32(114, true) / 10_000_000,
  ];
  if (bounds[0] < -180 || bounds[2] > 180 || bounds[1] < -90 || bounds[3] > 90 || bounds[0] >= bounds[2] || bounds[1] >= bounds[3]) {
    throw new Error("The PMTiles header contains invalid WGS 84 bounds.");
  }
  return {
    version: 3,
    rootOffset,
    rootLength,
    metadataOffset,
    metadataLength,
    leafDirectoryOffset,
    leafDirectoryLength,
    tileDataOffset,
    tileDataLength,
    internalCompression,
    tileCompression,
    tileType,
    minZoom,
    maxZoom,
    bounds,
  };
}

async function metadataBytes(file: File, header: PmtilesHeader): Promise<Uint8Array> {
  if (header.metadataLength === 0) return new Uint8Array();
  const compressed = new Uint8Array(await file.slice(header.metadataOffset, header.metadataOffset + header.metadataLength).arrayBuffer());
  if (header.internalCompression === "none") return compressed;
  if (header.internalCompression !== "gzip" || typeof DecompressionStream === "undefined") {
    throw new Error(`PMTiles ${header.internalCompression} metadata compression is not supported by this browser importer.`);
  }
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readMetadata(file: File, header: PmtilesHeader): Promise<Record<string, unknown>> {
  const bytes = await metadataBytes(file, header);
  if (bytes.byteLength === 0) return {};
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new Error("PMTiles metadata is not a valid JSON object.");
  }
}

function covers(container: StudyAreaBounds, requested: StudyAreaBounds): boolean {
  return container[0] <= requested[0] && container[1] <= requested[1]
    && container[2] >= requested[2] && container[3] >= requested[3];
}

export async function validatePmtilesImport(
  file: File,
  requestedBounds: StudyAreaBounds,
  requestedMinZoom: number,
  requestedMaxZoom: number,
  packageLimitBytes: number,
  attributionInput: string,
  licenseInput: string,
): Promise<ValidatedPmtilesImport> {
  if (!file.name.toLowerCase().endsWith(".pmtiles")) throw new Error("Choose a .pmtiles archive.");
  if (file.size > packageLimitBytes) throw new Error(`The archive exceeds the ${Math.round(packageLimitBytes / 1024 / 1024)} MiB project limit.`);
  const header = parsePmtilesHeader(await file.slice(0, HEADER_BYTES).arrayBuffer(), file.size);
  if (!covers(header.bounds, requestedBounds)) throw new Error("The PMTiles archive does not cover the complete project study area.");
  if (header.minZoom > requestedMinZoom || header.maxZoom < requestedMaxZoom) {
    throw new Error(`The archive covers zoom ${header.minZoom}-${header.maxZoom}, not the planned ${requestedMinZoom}-${requestedMaxZoom}.`);
  }
  const metadata = await readMetadata(file, header);
  const attribution = attributionInput.trim() || (typeof metadata.attribution === "string" ? metadata.attribution.trim() : "");
  const license = licenseInput.trim() || (typeof metadata.license === "string" ? metadata.license.trim() : "");
  if (!attribution) throw new Error("Attribution is required before this archive can be attached to the project.");
  if (!license) throw new Error("A data-license identifier or reference is required before this archive can be attached.");
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return { file, header, metadata, sha256, attribution, license };
}

export async function persistPmtilesImport(validated: ValidatedPmtilesImport): Promise<OfflineMapAsset> {
  if (!navigator.storage?.getDirectory) throw new Error("This browser does not provide OPFS; the archive was validated but not stored.");
  const quota = await navigator.storage.estimate?.().catch(() => undefined);
  if (Number.isFinite(quota?.quota) && Number.isFinite(quota?.usage)
    && quota!.quota! - quota!.usage! < validated.file.size) {
    throw new Error("The browser does not report enough available storage for this PMTiles archive.");
  }
  const root = await navigator.storage.getDirectory();
  const appDirectory = await root.getDirectoryHandle("epi-info-ai", { create: true });
  const mapDirectory = await appDirectory.getDirectoryHandle("offline-maps", { create: true });
  const storageInstanceId = crypto.randomUUID?.() ?? `asset-${Date.now()}`;
  const storedName = `${storageInstanceId}-${validated.sha256}.pmtiles`;
  const handle = await mapDirectory.getFileHandle(storedName, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(validated.file);
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => undefined);
    await mapDirectory.removeEntry(storedName).catch(() => undefined);
    throw error;
  }
  const persistent = await navigator.storage.persisted?.().catch(() => false) ?? false;
  return {
    id: validated.sha256,
    fileName: validated.file.name,
    storage: "opfs",
    storagePath: `epi-info-ai/offline-maps/${storedName}`,
    byteLength: validated.file.size,
    sha256: validated.sha256,
    format: "pmtiles-v3",
    tileType: validated.header.tileType,
    tileCompression: validated.header.tileCompression,
    bounds: validated.header.bounds,
    minZoom: validated.header.minZoom,
    maxZoom: validated.header.maxZoom,
    attribution: validated.attribution,
    license: validated.license,
    importedAt: new Date().toISOString(),
    persistence: persistent ? "persistent" : "best-effort",
  };
}

export async function restorePmtilesAsset(recorded: OfflineMapAsset, file: File): Promise<OfflineMapAsset> {
  const validated = await validatePmtilesImport(
    file,
    recorded.bounds,
    recorded.minZoom,
    recorded.maxZoom,
    file.size,
    recorded.attribution,
    recorded.license,
  );
  if (validated.sha256 !== recorded.sha256
    || validated.header.tileType !== recorded.tileType
    || validated.header.tileCompression !== recorded.tileCompression) {
    throw new Error(`Embedded PMTiles ${recorded.fileName} does not match its project record.`);
  }
  const persisted = await persistPmtilesImport(validated);
  return {
    ...recorded,
    storagePath: persisted.storagePath,
    persistence: persisted.persistence,
  };
}

export async function removePmtilesAsset(asset: OfflineMapAsset): Promise<void> {
  if (asset.storage !== "opfs" || !navigator.storage?.getDirectory) return;
  try {
    const root = await navigator.storage.getDirectory();
    const appDirectory = await root.getDirectoryHandle("epi-info-ai");
    const mapDirectory = await appDirectory.getDirectoryHandle("offline-maps");
    const storedName = asset.storagePath.split("/").at(-1) ?? "";
    if (!/^[a-zA-Z0-9-]+\.pmtiles$/.test(storedName) || !storedName.includes(asset.sha256)) return;
    await mapDirectory.removeEntry(storedName);
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "NotFoundError")) throw error;
  }
}
