export interface GisArchiveLimitsV01 {
  maxArchiveBytes: number;
  maxEntries: number;
  maxExpandedBytes: number;
  maxEntryBytes: number;
  maxCompressionRatio: number;
}

export interface GisArchiveEntryV01 {
  name: string;
  compressedBytes: number;
  expandedBytes: number;
  compressionMethod: 0 | 8;
  encrypted: boolean;
}

export interface GisArchiveInspectionResultV01 {
  format: "ZIP";
  entryCount: number;
  expandedBytes: number;
  entries: readonly GisArchiveEntryV01[];
  candidateFormats: readonly ("Shapefile" | "GeoPackage" | "GeoJSON")[];
}

const ZIP_LOCAL = 0x04034b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_END = 0x06054b50;
const textDecoder = new TextDecoder("utf-8", { fatal: true });

function u16(bytes: Uint8Array, offset: number): number { return bytes[offset]! | (bytes[offset + 1]! << 8); }
function u32(bytes: Uint8Array, offset: number): number { return (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0; }
function findEnd(bytes: Uint8Array): number {
  const start = Math.max(0, bytes.length - 22 - 0xffff);
  for (let offset = bytes.length - 22; offset >= start; offset -= 1) if (u32(bytes, offset) === ZIP_END) return offset;
  throw new TypeError("ZIP end-of-central-directory record was not found.");
}
function safeEntryName(name: string): boolean {
  return Boolean(name) && !name.includes("\0") && !name.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(name) && !name.split(/[\\/]/).some((part) => part === ".." || part === "");
}

export function inspectZipArchiveV01(bytes: ArrayBuffer, limits: GisArchiveLimitsV01): GisArchiveInspectionResultV01 {
  const input = new Uint8Array(bytes);
  if (input.byteLength > limits.maxArchiveBytes) throw new RangeError("ZIP archive exceeds the maxArchiveBytes limit.");
  const end = findEnd(input);
  if (u16(input, end + 4) !== 0 || u16(input, end + 6) !== 0) throw new TypeError("Multi-disk ZIP archives are not supported.");
  const entryCount = u16(input, end + 10);
  const centralBytes = u32(input, end + 12);
  const centralOffset = u32(input, end + 16);
  if (entryCount > limits.maxEntries) throw new RangeError("ZIP entry count exceeds the maxEntries limit.");
  if (centralOffset + centralBytes > input.byteLength) throw new TypeError("ZIP central directory exceeds the archive bounds.");

  const entries: GisArchiveEntryV01[] = [];
  let cursor = centralOffset;
  let expandedBytes = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > input.byteLength || u32(input, cursor) !== ZIP_CENTRAL) throw new TypeError("ZIP central directory entry is malformed.");
    const flags = u16(input, cursor + 8);
    const method = u16(input, cursor + 10);
    const compressedBytes = u32(input, cursor + 20);
    const expandedEntryBytes = u32(input, cursor + 24);
    const nameBytes = u16(input, cursor + 28);
    const extraBytes = u16(input, cursor + 30);
    const commentBytes = u16(input, cursor + 32);
    const localOffset = u32(input, cursor + 42);
    const endEntry = cursor + 46 + nameBytes + extraBytes + commentBytes;
    const localNameBytes = localOffset + 30 <= input.byteLength ? u16(input, localOffset + 26) : 0;
    const localExtraBytes = localOffset + 30 <= input.byteLength ? u16(input, localOffset + 28) : 0;
    const localEnd = localOffset + 30 + localNameBytes + localExtraBytes + compressedBytes;
    if (endEntry > input.byteLength || localOffset + 30 > input.byteLength || u32(input, localOffset) !== ZIP_LOCAL || localEnd > input.byteLength) throw new TypeError("ZIP entry points outside the archive bounds.");
    if ((flags & 1) !== 0) throw new TypeError("Encrypted ZIP entries are not allowed.");
    if (method !== 0 && method !== 8) throw new TypeError(`ZIP compression method ${method} is not allowed.`);
    if (expandedEntryBytes > limits.maxEntryBytes) throw new RangeError("ZIP entry exceeds the maxEntryBytes limit.");
    if (compressedBytes === 0 ? expandedEntryBytes > 0 : expandedEntryBytes / compressedBytes > limits.maxCompressionRatio) throw new RangeError("ZIP entry exceeds the maximum compression ratio limit.");
    let name: string;
    try { name = textDecoder.decode(input.subarray(cursor + 46, cursor + 46 + nameBytes)); } catch { throw new TypeError("ZIP entry filename is not valid UTF-8."); }
    if (!safeEntryName(name)) throw new TypeError(`Unsafe ZIP entry path: ${name}`);
    expandedBytes += expandedEntryBytes;
    if (expandedBytes > limits.maxExpandedBytes) throw new RangeError("ZIP expanded size exceeds the maxExpandedBytes limit.");
    entries.push({ name, compressedBytes, expandedBytes: expandedEntryBytes, compressionMethod: method as 0 | 8, encrypted: false });
    cursor = endEntry;
  }

  const lower = entries.map(({ name }) => name.toLowerCase());
  const stems = new Set(lower.filter((name) => /\.(shp|shx|dbf)$/.test(name)).map((name) => name.replace(/\.(shp|shx|dbf)$/, "")));
  const candidateFormats: Array<"Shapefile" | "GeoPackage" | "GeoJSON"> = [];
  if ([...stems].some((stem) => [".shp", ".shx", ".dbf"].every((extension) => lower.includes(`${stem}${extension}`)))) candidateFormats.push("Shapefile");
  if (lower.some((name) => name.endsWith(".gpkg"))) candidateFormats.push("GeoPackage");
  if (lower.some((name) => name.endsWith(".geojson") || name.endsWith(".json"))) candidateFormats.push("GeoJSON");
  return { format: "ZIP", entryCount, expandedBytes, entries, candidateFormats };
}
