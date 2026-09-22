import { Unzip, UnzipInflate, zipSync } from "fflate";

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
  crc32: number;
  compressionMethod: 0 | 8;
  encrypted: boolean;
}

export interface VerifiedShapefileComponentV01 {
  name: string;
  file: File;
  byteLength: number;
  crc32: number;
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
function normalizedEntryName(name: string): string { return name.replaceAll("\\", "/").normalize("NFKC").toLocaleLowerCase("en-US"); }
function decodeName(bytes: Uint8Array, offset: number, length: number): string {
  try { return textDecoder.decode(bytes.subarray(offset, offset + length)); } catch { throw new TypeError("ZIP entry filename is not valid UTF-8."); }
}
function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  }
  return (value ^ 0xffffffff) >>> 0;
}

export interface GisZipInspectionOptionsV01 {
  allowedExtensions?: readonly string[];
}

export function inspectZipArchiveV01(bytes: ArrayBuffer, limits: GisArchiveLimitsV01, options: GisZipInspectionOptionsV01 = {}): GisArchiveInspectionResultV01 {
  const input = new Uint8Array(bytes);
  if (input.byteLength > limits.maxArchiveBytes) throw new RangeError("ZIP archive exceeds the maxArchiveBytes limit.");
  const end = findEnd(input);
  if (u16(input, end + 4) !== 0 || u16(input, end + 6) !== 0) throw new TypeError("Multi-disk ZIP archives are not supported.");
  const entryCount = u16(input, end + 10);
  const centralBytes = u32(input, end + 12);
  const centralOffset = u32(input, end + 16);
  const commentBytes = u16(input, end + 20);
  if (end + 22 + commentBytes !== input.byteLength) throw new TypeError("ZIP contains trailing data after the end record.");
  if (entryCount === 0xffff || centralBytes === 0xffffffff || centralOffset === 0xffffffff) throw new TypeError("ZIP64 archives are not supported.");
  if (entryCount > limits.maxEntries) throw new RangeError("ZIP entry count exceeds the maxEntries limit.");
  if (centralOffset + centralBytes > input.byteLength) throw new TypeError("ZIP central directory exceeds the archive bounds.");

  const entries: GisArchiveEntryV01[] = [];
  let cursor = centralOffset;
  let expandedBytes = 0;
  const ranges: Array<[number, number]> = [];
  const names = new Set<string>();
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
    const externalAttributes = u32(input, cursor + 38);
    const endEntry = cursor + 46 + nameBytes + extraBytes + commentBytes;
    const name = decodeName(input, cursor + 46, nameBytes);
    const normalizedName = normalizedEntryName(name);
    if (names.has(normalizedName)) throw new TypeError(`ZIP contains duplicate or colliding entry names: ${name}`);
    names.add(normalizedName);
    if (name.endsWith("/") || ((externalAttributes >>> 16) & 0xf000) === 0xa000) throw new TypeError(`ZIP special or directory entry is not allowed: ${name}`);
    for (let extra = cursor + 46; extra + 4 <= cursor + 46 + extraBytes;) {
      const fieldId = u16(input, extra); const fieldLength = u16(input, extra + 2);
      if (extra + 4 + fieldLength > cursor + 46 + extraBytes) throw new TypeError("ZIP extra field exceeds the central-directory entry bounds.");
      if (fieldId === 0x0001) throw new TypeError("ZIP64 extra fields are not supported.");
      extra += 4 + fieldLength;
    }
    const localNameBytes = localOffset + 30 <= input.byteLength ? u16(input, localOffset + 26) : 0;
    const localExtraBytes = localOffset + 30 <= input.byteLength ? u16(input, localOffset + 28) : 0;
    const localEnd = localOffset + 30 + localNameBytes + localExtraBytes + compressedBytes;
    if (endEntry > input.byteLength || localOffset + 30 > input.byteLength || u32(input, localOffset) !== ZIP_LOCAL || localEnd > input.byteLength) throw new TypeError("ZIP entry points outside the archive bounds.");
    if ((flags & 1) !== 0) throw new TypeError("Encrypted ZIP entries are not allowed.");
    if ((flags & 8) !== 0) throw new TypeError("ZIP data-descriptor entries are not allowed.");
    if (u16(input, localOffset + 6) !== flags || u16(input, localOffset + 8) !== method || decodeName(input, localOffset + 30, localNameBytes) !== name) throw new TypeError(`ZIP local and central headers disagree for ${name}.`);
    if (u32(input, localOffset + 14) !== u32(input, cursor + 16) || u32(input, localOffset + 18) !== compressedBytes || u32(input, localOffset + 22) !== expandedEntryBytes) throw new TypeError(`ZIP local and central sizes disagree for ${name}.`);
    if (localEnd > centralOffset) throw new TypeError(`ZIP entry overlaps the central directory: ${name}`);
    ranges.push([localOffset, localEnd]);
    if (method !== 0 && method !== 8) throw new TypeError(`ZIP compression method ${method} is not allowed.`);
    if (expandedEntryBytes > limits.maxEntryBytes) throw new RangeError("ZIP entry exceeds the maxEntryBytes limit.");
    if (compressedBytes === 0 ? expandedEntryBytes > 0 : expandedEntryBytes / compressedBytes > limits.maxCompressionRatio) throw new RangeError("ZIP entry exceeds the maximum compression ratio limit.");
    if (!safeEntryName(name)) throw new TypeError(`Unsafe ZIP entry path: ${name}`);
    if (options.allowedExtensions && !options.allowedExtensions.some((extension) => normalizedName.endsWith(extension.toLocaleLowerCase("en-US")))) throw new TypeError(`ZIP entry type is not allowed: ${name}`);
    expandedBytes += expandedEntryBytes;
    if (expandedBytes > limits.maxExpandedBytes) throw new RangeError("ZIP expanded size exceeds the maxExpandedBytes limit.");
    entries.push({ name, compressedBytes, expandedBytes: expandedEntryBytes, crc32: u32(input, cursor + 16), compressionMethod: method as 0 | 8, encrypted: false });
    cursor = endEntry;
  }

  ranges.sort((left, right) => left[0] - right[0]);
  for (let index = 1; index < ranges.length; index += 1) if (ranges[index - 1]![1] > ranges[index]![0]) throw new TypeError("ZIP entries overlap each other.");
  const lower = entries.map(({ name }) => normalizedEntryName(name));
  const stems = new Set(lower.filter((name) => /\.(shp|shx|dbf)$/.test(name)).map((name) => name.replace(/\.(shp|shx|dbf)$/, "")));
  const candidateFormats: Array<"Shapefile" | "GeoPackage" | "GeoJSON"> = [];
  if ([...stems].some((stem) => [".shp", ".shx", ".dbf"].every((extension) => lower.includes(`${stem}${extension}`)))) candidateFormats.push("Shapefile");
  if (lower.some((name) => name.endsWith(".gpkg"))) candidateFormats.push("GeoPackage");
  if (lower.some((name) => name.endsWith(".geojson") || name.endsWith(".json"))) candidateFormats.push("GeoJSON");
  return { format: "ZIP", entryCount, expandedBytes, entries, candidateFormats };
}

export async function extractVerifiedShapefileZipV01(bytes: ArrayBuffer, limits: GisArchiveLimitsV01): Promise<VerifiedShapefileComponentV01[]> {
  const inspection = inspectZipArchiveV01(bytes, limits, { allowedExtensions: [".shp", ".shx", ".dbf", ".prj", ".cpg"] });
  const required = new Set([".shp", ".shx", ".dbf"]);
  const shapefileEntries = inspection.entries.filter(({ name }) => /\.(shp|shx|dbf|prj|cpg)$/i.test(name));
  const stems = new Set(shapefileEntries.map(({ name }) => normalizedEntryName(name).replace(/\.(shp|shx|dbf|prj|cpg)$/, "")));
  if (stems.size !== 1 || [...required].some((extension) => !shapefileEntries.some(({ name }) => normalizedEntryName(name).endsWith(extension)))) throw new TypeError("Verified extraction requires exactly one complete Shapefile dataset.");
  const expected = new Map(inspection.entries.map((entry) => [normalizedEntryName(entry.name), entry]));
  const extracted = new Map<string, Uint8Array>();
  let failure: Error | null = null;
  await new Promise<void>((resolve, reject) => {
    const unzip = new Unzip();
    unzip.register(UnzipInflate);
    unzip.onfile = (file) => {
      const key = normalizedEntryName(file.name);
      const chunks: Uint8Array[] = [];
      let total = 0;
      file.ondata = (error, chunk, final) => {
        if (error) { failure = error; reject(error); return; }
        if (chunk) { total += chunk.byteLength; if (total > limits.maxEntryBytes || total > limits.maxExpandedBytes) { const issue = new RangeError("ZIP actual decompressed size exceeds the configured limit."); failure = issue; file.terminate(); reject(issue); return; } chunks.push(chunk); }
        if (final) extracted.set(key, concatChunks(chunks, total));
      };
      file.start();
    };
    try { unzip.push(new Uint8Array(bytes), true); if (!failure) resolve(); } catch (error) { reject(error); }
  });
  if (failure) throw failure;
  return shapefileEntries.map((entry) => {
    const data = extracted.get(normalizedEntryName(entry.name));
    if (!data || data.byteLength !== entry.expandedBytes || crc32(data) !== entry.crc32) throw new TypeError(`ZIP extracted data failed size or CRC verification: ${entry.name}`);
    const dataBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    return { name: entry.name, file: new File([dataBuffer], entry.name.split(/[\\/]/).at(-1)!, { type: "application/octet-stream" }), byteLength: data.byteLength, crc32: entry.crc32 };
  });
}

function concatChunks(chunks: readonly Uint8Array[], length: number): Uint8Array {
  const result = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

export async function createVerifiedShapefileZipV01(components: readonly VerifiedShapefileComponentV01[]): Promise<File> {
  if (components.length < 3) throw new TypeError("A verified Shapefile ZIP requires .shp, .shx, and .dbf components.");
  const files: Record<string, Uint8Array> = {};
  for (const component of components) files[component.name.split(/[\\/]/).at(-1)!] = new Uint8Array(await component.file.arrayBuffer());
  return new File([zipSync(files)], "verified-shapefile.zip", { type: "application/zip" });
}
