import type { OfflineMapAsset } from "../contracts/core.ts";
import { parsePmtilesHeader, type PmtilesHeader } from "./pmtiles-import.ts";

interface DirectoryEntry {
  tileId: number;
  runLength: number;
  length: number;
  offset: number;
}

export interface BrowserPmtilesSource {
  asset: OfflineMapAsset;
  header: PmtilesHeader;
  metadata: Readonly<Record<string, unknown>>;
  getTile(zoom: number, x: number, y: number): Promise<Uint8Array | null>;
}

const RASTER_MIME_TYPES: Readonly<Record<string, string>> = Object.freeze({
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
});

export function pmtilesRasterMimeType(tileType: string): string | null {
  return RASTER_MIME_TYPES[tileType] ?? null;
}

function readVarint(bytes: Uint8Array, state: { offset: number }): number {
  let value = 0;
  let multiplier = 1;
  for (let count = 0; count < 10; count += 1) {
    if (state.offset >= bytes.length) throw new Error("PMTiles directory contains a truncated varint.");
    const byte = bytes[state.offset++]!;
    value += (byte & 0x7f) * multiplier;
    if ((byte & 0x80) === 0) {
      if (!Number.isSafeInteger(value)) throw new Error("PMTiles directory value exceeds the safe integer range.");
      return value;
    }
    multiplier *= 128;
  }
  throw new Error("PMTiles directory contains an invalid varint.");
}

export function deserializePmtilesDirectory(bytes: Uint8Array): DirectoryEntry[] {
  const state = { offset: 0 };
  const count = readVarint(bytes, state);
  if (count > 1_000_000) throw new Error("PMTiles directory contains too many entries.");
  const entries: DirectoryEntry[] = Array.from({ length: count }, () => ({ tileId: 0, runLength: 0, length: 0, offset: 0 }));
  let tileId = 0;
  for (const entry of entries) {
    tileId += readVarint(bytes, state);
    entry.tileId = tileId;
  }
  for (const entry of entries) entry.runLength = readVarint(bytes, state);
  for (const entry of entries) entry.length = readVarint(bytes, state);
  for (let index = 0; index < entries.length; index += 1) {
    const encoded = readVarint(bytes, state);
    entries[index]!.offset = encoded === 0 && index > 0
      ? entries[index - 1]!.offset + entries[index - 1]!.length
      : encoded - 1;
    if (entries[index]!.offset < 0 || entries[index]!.length < 1) throw new Error("PMTiles directory contains an invalid tile offset or length.");
  }
  return entries;
}

function rotateHilbert(size: number, x: number, y: number, rx: number, ry: number): [number, number] {
  if (ry !== 0) return [x, y];
  let rotatedX = x;
  let rotatedY = y;
  if (rx !== 0) {
    rotatedX = size - 1 - x;
    rotatedY = size - 1 - y;
  }
  return [rotatedY, rotatedX];
}

export function zxyToPmtilesId(zoom: number, x: number, y: number): number {
  if (!Number.isSafeInteger(zoom) || zoom < 0 || zoom > 22) throw new Error("PMTiles zoom must be an integer from 0 through 22.");
  const dimension = 2 ** zoom;
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x >= dimension || y >= dimension) {
    throw new Error("PMTiles x/y coordinate falls outside the zoom grid.");
  }
  let tileId = ((4 ** zoom) - 1) / 3;
  let currentX = x;
  let currentY = y;
  for (let scale = dimension / 2; scale >= 1; scale /= 2) {
    const rx = (currentX & scale) > 0 ? 1 : 0;
    const ry = (currentY & scale) > 0 ? 1 : 0;
    tileId += scale * scale * ((3 * rx) ^ ry);
    [currentX, currentY] = rotateHilbert(scale, currentX, currentY, rx, ry);
  }
  if (!Number.isSafeInteger(tileId)) throw new Error("PMTiles tile ID exceeds the safe integer range.");
  return tileId;
}

async function decompress(bytes: Uint8Array, compression: string): Promise<Uint8Array> {
  if (compression === "none") return bytes;
  if (compression !== "gzip" || typeof DecompressionStream === "undefined") {
    throw new Error(`PMTiles ${compression} compression is not supported by this browser renderer.`);
  }
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function sha256(file: File): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseMetadata(bytes: Uint8Array): Readonly<Record<string, unknown>> {
  if (bytes.length === 0) return Object.freeze({});
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  } catch {
    throw new Error("PMTiles metadata is not valid UTF-8 JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("PMTiles metadata must be a JSON object.");
  }
  return Object.freeze(value as Record<string, unknown>);
}

async function openAssetFile(asset: OfflineMapAsset): Promise<File> {
  if (!navigator.storage?.getDirectory) throw new Error("This browser does not provide OPFS.");
  const root = await navigator.storage.getDirectory();
  const segments = asset.storagePath.split("/");
  if (segments.length !== 3 || segments[0] !== "epi-info-ai" || segments[1] !== "offline-maps") {
    throw new Error("The offline-map storage path is invalid.");
  }
  const appDirectory = await root.getDirectoryHandle("epi-info-ai");
  const mapDirectory = await appDirectory.getDirectoryHandle("offline-maps");
  return (await mapDirectory.getFileHandle(segments[2]!)).getFile();
}

export async function readStoredPmtilesFile(asset: OfflineMapAsset): Promise<File> {
  const file = await openAssetFile(asset);
  if (file.size !== asset.byteLength) throw new Error("The stored PMTiles size no longer matches the project record.");
  if (await sha256(file) !== asset.sha256) throw new Error("The stored PMTiles SHA-256 no longer matches the project record.");
  const header = parsePmtilesHeader(await file.slice(0, 127).arrayBuffer(), file.size);
  if (header.tileType !== asset.tileType || header.tileCompression !== asset.tileCompression
    || header.minZoom !== asset.minZoom || header.maxZoom !== asset.maxZoom
    || header.bounds.some((coordinate, index) => coordinate !== asset.bounds[index])) {
    throw new Error("The stored PMTiles header no longer matches the project record.");
  }
  return file;
}

function directoryEntry(entries: DirectoryEntry[], tileId: number): DirectoryEntry | null {
  let low = 0;
  let high = entries.length - 1;
  let match: DirectoryEntry | null = null;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = entries[middle]!;
    if (candidate.tileId <= tileId) {
      match = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return match;
}

export async function openBrowserPmtiles(asset: OfflineMapAsset): Promise<BrowserPmtilesSource> {
  const file = await readStoredPmtilesFile(asset);
  const header = parsePmtilesHeader(await file.slice(0, 127).arrayBuffer(), file.size);
  const directoryCache = new Map<string, Promise<DirectoryEntry[]>>();
  const readDirectory = (offset: number, length: number): Promise<DirectoryEntry[]> => {
    const key = `${offset}:${length}`;
    let request = directoryCache.get(key);
    if (!request) {
      request = file.slice(offset, offset + length).arrayBuffer()
        .then((buffer) => decompress(new Uint8Array(buffer), header.internalCompression))
        .then(deserializePmtilesDirectory);
      directoryCache.set(key, request);
    }
    return request;
  };
  const root = await readDirectory(header.rootOffset, header.rootLength);
  const metadata = parseMetadata(await decompress(
    new Uint8Array(await file.slice(header.metadataOffset, header.metadataOffset + header.metadataLength).arrayBuffer()),
    header.internalCompression,
  ));
  return {
    asset,
    header,
    metadata,
    async getTile(zoom, x, y) {
      if (zoom < header.minZoom || zoom > header.maxZoom) return null;
      const wanted = zxyToPmtilesId(zoom, x, y);
      let entries = root;
      for (let depth = 0; depth < 4; depth += 1) {
        const entry = directoryEntry(entries, wanted);
        if (!entry) return null;
        if (entry.runLength > 0) {
          if (wanted >= entry.tileId + entry.runLength) return null;
          const stored = new Uint8Array(await file.slice(
            header.tileDataOffset + entry.offset,
            header.tileDataOffset + entry.offset + entry.length,
          ).arrayBuffer());
          return decompress(stored, header.tileCompression);
        }
        entries = await readDirectory(header.leafDirectoryOffset + entry.offset, entry.length);
      }
      throw new Error("PMTiles directory depth exceeds the supported limit.");
    },
  };
}
