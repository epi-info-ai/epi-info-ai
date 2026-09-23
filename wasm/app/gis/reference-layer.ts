import { inspectZipArchiveV01, type GisArchiveInspectionResultV01, type GisArchiveLimitsV01 } from "./archive-ingestion.ts";

export type ReferenceLayerFormatV01 = "Shapefile" | "GeoPackage";
export type ReferenceLayerCrsV01 = "CRS84" | "EPSG:4326" | "EPSG:3857" | "unknown";

export interface ReferenceLayerCandidateV01 {
  id: string;
  format: ReferenceLayerFormatV01;
  displayName: string;
  entries: readonly string[];
  missingEntries: readonly string[];
  completeness: "complete" | "incomplete";
  crsState: "unknown" | "sidecar-present";
  normalizationStatus: "planned";
}

export interface ReferenceLayerInspectionV01 {
  packageFormat: "ZIP" | "GeoPackage";
  archive?: GisArchiveInspectionResultV01;
  candidates: readonly ReferenceLayerCandidateV01[];
  diagnostics: readonly string[];
}

export interface ReferenceLayerCrsReviewV01 {
  declaredCrs: ReferenceLayerCrsV01;
  status: "accepted-wgs84" | "requires-reprojection" | "rejected-unknown";
  normalizationRequired: boolean;
}

function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function isGeoPackage(bytes: Uint8Array): boolean {
  return new TextDecoder().decode(bytes.subarray(0, 16)) === "SQLite format 3\0";
}

function baseName(path: string): string {
  return path.split(/[\\/]/).at(-1) ?? path;
}

function inspectShapefileCandidates(names: readonly string[]): ReferenceLayerCandidateV01[] {
  const byStem = new Map<string, Map<string, string>>();
  for (const name of names) {
    const lower = name.toLowerCase();
    const extension = lower.match(/\.(shp|shx|dbf|prj)$/)?.[1];
    if (!extension) continue;
    const stem = lower.slice(0, -(extension.length + 1));
    const group = byStem.get(stem) ?? new Map<string, string>();
    group.set(extension, name);
    byStem.set(stem, group);
  }
  return [...byStem.entries()].map(([stem, group]) => {
    const required = ["shp", "shx", "dbf"];
    const missingEntries = required.filter((extension) => !group.has(extension)).map((extension) => `${stem}.${extension}`);
    const entries = [...group.values()].sort((left, right) => left.localeCompare(right));
    return {
      id: `shapefile:${stem}`,
      format: "Shapefile",
      displayName: baseName(stem),
      entries,
      missingEntries,
      completeness: missingEntries.length === 0 ? "complete" : "incomplete",
      crsState: group.has("prj") ? "sidecar-present" : "unknown",
      normalizationStatus: "planned",
    };
  });
}

function inspectGeoPackageCandidates(names: readonly string[]): ReferenceLayerCandidateV01[] {
  return names.filter((name) => name.toLowerCase().endsWith(".gpkg")).map((name) => ({
    id: `geopackage:${name.toLowerCase()}`,
    format: "GeoPackage",
    displayName: baseName(name),
    entries: [name],
    missingEntries: [],
    completeness: "complete",
    crsState: "unknown",
    normalizationStatus: "planned",
  }));
}

export function inspectReferenceLayerPackageV01(bytes: ArrayBuffer, limits: GisArchiveLimitsV01): ReferenceLayerInspectionV01 {
  const input = new Uint8Array(bytes);
  if (input.byteLength > limits.maxArchiveBytes) throw new RangeError("Reference layer input exceeds the maxArchiveBytes limit.");
  if (isGeoPackage(input)) {
    return {
      packageFormat: "GeoPackage",
      candidates: [{ id: "geopackage:root", format: "GeoPackage", displayName: "GeoPackage database", entries: [], missingEntries: [], completeness: "complete", crsState: "unknown", normalizationStatus: "planned" }],
      diagnostics: ["GeoPackage header recognized; layer enumeration and CRS review require the reviewed database adapter."],
    };
  }
  if (!isZip(input)) throw new TypeError("Reference layer input must be a ZIP Shapefile bundle or a GeoPackage database.");
  const archive = inspectZipArchiveV01(bytes, limits, {
    allowedExtensions: [".shp", ".shx", ".dbf", ".prj", ".cpg"],
  });
  const names = archive.entries.map((entry) => entry.name);
  const candidates = [...inspectShapefileCandidates(names), ...inspectGeoPackageCandidates(names)];
  if (!candidates.length) throw new TypeError("ZIP does not contain a Shapefile bundle or GeoPackage candidate.");
  return {
    packageFormat: "ZIP",
    archive,
    candidates,
    diagnostics: ["Archive preflight completed without extraction; normalization and reprojection remain planned."],
  };
}

export function chooseReferenceLayerCandidateV01(inspection: ReferenceLayerInspectionV01, id: string): ReferenceLayerCandidateV01 {
  const candidate = inspection.candidates.find((entry) => entry.id === id);
  if (!candidate) throw new RangeError(`Reference layer candidate ${id} was not found.`);
  if (candidate.completeness !== "complete") throw new RangeError(`Reference layer ${candidate.displayName} is incomplete; missing ${candidate.missingEntries.join(", ")}.`);
  return candidate;
}

export function reviewReferenceLayerCrsV01(candidate: ReferenceLayerCandidateV01, declaredCrs: ReferenceLayerCrsV01): ReferenceLayerCrsReviewV01 {
  if (candidate.completeness !== "complete") throw new RangeError(`Reference layer ${candidate.displayName} is incomplete and cannot undergo CRS review.`);
  if (declaredCrs === "CRS84" || declaredCrs === "EPSG:4326") return { declaredCrs, status: "accepted-wgs84", normalizationRequired: false };
  if (declaredCrs === "EPSG:3857") return { declaredCrs, status: "requires-reprojection", normalizationRequired: true };
  return { declaredCrs: "unknown", status: "rejected-unknown", normalizationRequired: true };
}
