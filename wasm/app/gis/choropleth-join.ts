import type { ChoroplethJoinNormalizationV01 } from "./choropleth.ts";

export type ChoroplethJoinKeyValueV01 = string | number | boolean;

export interface ChoroplethBoundaryFeatureV01 {
  featureIndex: number;
  properties: Readonly<Record<string, unknown>>;
}

export interface ChoroplethDataRowV01 {
  rowIndex: number;
  values: Readonly<Record<string, unknown>>;
}

export interface ChoroplethJoinMatchV01 {
  boundary: ChoroplethBoundaryFeatureV01;
  normalizedKey: string;
  dataRows: ChoroplethDataRowV01[];
}

export interface ChoroplethKeyJoinResultV01 {
  matches: ChoroplethJoinMatchV01[];
  unmatchedDataRows: ChoroplethDataRowV01[];
  missingDataKeyRows: ChoroplethDataRowV01[];
  invalidDataKeyRows: ChoroplethDataRowV01[];
  unmatchedBoundaryFeatures: ChoroplethBoundaryFeatureV01[];
  invalidBoundaryFeatures: ChoroplethBoundaryFeatureV01[];
  ambiguousDataRows: ChoroplethDataRowV01[];
  duplicateBoundaryKeys: string[];
}

export type ChoroplethJoinDiagnosticCodeV01 = "missing-data-key" | "invalid-data-key" | "unmatched-data-key" | "invalid-boundary-key" | "unmatched-boundary" | "duplicate-boundary-key" | "ambiguous-data-key" | "multiple-data-rows";

export interface ChoroplethJoinDiagnosticV01 {
  code: ChoroplethJoinDiagnosticCodeV01;
  message: string;
  rowIndex?: number;
  featureIndex?: number;
  normalizedKey?: string;
}

export interface ChoroplethJoinDiagnosticSummaryV01 {
  inputDataRows: number;
  matchedDataRows: number;
  missingDataKeyRows: number;
  invalidDataKeyRows: number;
  unmatchedDataRows: number;
  invalidBoundaryFeatures: number;
  unmatchedBoundaryFeatures: number;
  duplicateBoundaryKeys: number;
  ambiguousDataRows: number;
  multiplyMatchedBoundaries: number;
}

function keyText(value: unknown, label: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") throw new TypeError(`${label} must be a string, number, boolean, or empty.`);
  if (typeof value === "number" && !Number.isFinite(value)) throw new TypeError(`${label} must be finite when numeric.`);
  return String(value);
}

export function normalizeChoroplethJoinKeyV01(value: unknown, normalization: ChoroplethJoinNormalizationV01, label = "Choropleth join key"): string | null {
  const text = keyText(value, label);
  if (text === null) return null;
  if (normalization === "exact") return text === "" ? null : text;
  if (normalization === "trim-casefold") {
    const normalized = text.trim().toLocaleLowerCase("en-US");
    return normalized === "" ? null : normalized;
  }
  throw new TypeError(`Unsupported choropleth join normalization: ${normalization}.`);
}

export function joinChoroplethDataToBoundariesV01(
  boundaries: readonly ChoroplethBoundaryFeatureV01[],
  dataRows: readonly ChoroplethDataRowV01[],
  boundaryKeyField: string,
  dataKeyField: string,
  normalization: ChoroplethJoinNormalizationV01,
): ChoroplethKeyJoinResultV01 {
  if (!boundaryKeyField.trim() || !dataKeyField.trim()) throw new TypeError("Choropleth joins require boundary and data key fields.");
  const boundaryByKey = new Map<string, ChoroplethBoundaryFeatureV01[]>();
  const invalidBoundaryFeatures: ChoroplethBoundaryFeatureV01[] = [];
  for (const boundary of boundaries) {
    let key: string | null;
    try {
      key = normalizeChoroplethJoinKeyV01(boundary.properties[boundaryKeyField], normalization, `Boundary feature ${boundary.featureIndex} key`);
    } catch {
      invalidBoundaryFeatures.push(boundary);
      continue;
    }
    if (key === null) continue;
    const existing = boundaryByKey.get(key) ?? [];
    existing.push(boundary);
    boundaryByKey.set(key, existing);
  }
  const duplicateBoundaryKeys = [...boundaryByKey.entries()].filter(([, features]) => features.length > 1).map(([key]) => key).sort();
  const duplicateKeys = new Set(duplicateBoundaryKeys);
  const rowsByBoundaryKey = new Map<string, ChoroplethDataRowV01[]>();
  const unmatchedDataRows: ChoroplethDataRowV01[] = [];
  const missingDataKeyRows: ChoroplethDataRowV01[] = [];
  const invalidDataKeyRows: ChoroplethDataRowV01[] = [];
  const ambiguousDataRows: ChoroplethDataRowV01[] = [];
  for (const row of dataRows) {
    let key: string | null;
    try {
      key = normalizeChoroplethJoinKeyV01(row.values[dataKeyField], normalization, `Data row ${row.rowIndex} key`);
    } catch {
      invalidDataKeyRows.push(row);
      continue;
    }
    if (key === null) {
      missingDataKeyRows.push(row);
    } else if (duplicateKeys.has(key)) {
      ambiguousDataRows.push(row);
    } else if (boundaryByKey.has(key)) {
      const existing = rowsByBoundaryKey.get(key) ?? [];
      existing.push(row);
      rowsByBoundaryKey.set(key, existing);
    } else {
      unmatchedDataRows.push(row);
    }
  }
  const matches: ChoroplethJoinMatchV01[] = [];
  const unmatchedBoundaryFeatures: ChoroplethBoundaryFeatureV01[] = [];
  for (const [key, features] of boundaryByKey) {
    const rows = rowsByBoundaryKey.get(key) ?? [];
    if (rows.length === 0) {
      unmatchedBoundaryFeatures.push(...features);
    } else if (features.length === 1) {
      matches.push({ boundary: features[0]!, normalizedKey: key, dataRows: rows });
    }
  }
  matches.sort((left, right) => left.boundary.featureIndex - right.boundary.featureIndex);
  unmatchedBoundaryFeatures.sort((left, right) => left.featureIndex - right.featureIndex);
  return { matches, unmatchedDataRows, missingDataKeyRows, invalidDataKeyRows, unmatchedBoundaryFeatures, invalidBoundaryFeatures, ambiguousDataRows, duplicateBoundaryKeys };
}

export function buildChoroplethJoinDiagnosticsV01(result: ChoroplethKeyJoinResultV01): ChoroplethJoinDiagnosticV01[] {
  const diagnostics: ChoroplethJoinDiagnosticV01[] = [];
  for (const row of result.missingDataKeyRows) diagnostics.push({ code: "missing-data-key", rowIndex: row.rowIndex, message: "The data row has no usable join key." });
  for (const row of result.invalidDataKeyRows) diagnostics.push({ code: "invalid-data-key", rowIndex: row.rowIndex, message: "The data row join key is not a supported finite scalar value." });
  for (const row of result.unmatchedDataRows) diagnostics.push({ code: "unmatched-data-key", rowIndex: row.rowIndex, message: "The data row join key was not found in the boundary layer." });
  for (const feature of result.invalidBoundaryFeatures) diagnostics.push({ code: "invalid-boundary-key", featureIndex: feature.featureIndex, message: "The boundary feature join key is not a supported finite scalar value." });
  for (const feature of result.unmatchedBoundaryFeatures) diagnostics.push({ code: "unmatched-boundary", featureIndex: feature.featureIndex, message: "No data row matched this boundary feature." });
  for (const key of result.duplicateBoundaryKeys) diagnostics.push({ code: "duplicate-boundary-key", normalizedKey: key, message: `The normalized boundary key ${JSON.stringify(key)} identifies multiple features.` });
  for (const row of result.ambiguousDataRows) diagnostics.push({ code: "ambiguous-data-key", rowIndex: row.rowIndex, message: "The data row key identifies duplicate boundary features and was not joined." });
  for (const match of result.matches) {
    if (match.dataRows.length > 1) diagnostics.push({ code: "multiple-data-rows", featureIndex: match.boundary.featureIndex, normalizedKey: match.normalizedKey, message: `The boundary feature matched ${match.dataRows.length} data rows; aggregation is required before display.` });
  }
  return diagnostics;
}

export function summarizeChoroplethJoinDiagnosticsV01(result: ChoroplethKeyJoinResultV01): ChoroplethJoinDiagnosticSummaryV01 {
  return {
    inputDataRows: result.matches.reduce((count, match) => count + match.dataRows.length, 0) + result.missingDataKeyRows.length + result.invalidDataKeyRows.length + result.unmatchedDataRows.length + result.ambiguousDataRows.length,
    matchedDataRows: result.matches.reduce((count, match) => count + match.dataRows.length, 0),
    missingDataKeyRows: result.missingDataKeyRows.length,
    invalidDataKeyRows: result.invalidDataKeyRows.length,
    unmatchedDataRows: result.unmatchedDataRows.length,
    invalidBoundaryFeatures: result.invalidBoundaryFeatures.length,
    unmatchedBoundaryFeatures: result.unmatchedBoundaryFeatures.length,
    duplicateBoundaryKeys: result.duplicateBoundaryKeys.length,
    ambiguousDataRows: result.ambiguousDataRows.length,
    multiplyMatchedBoundaries: result.matches.filter((match) => match.dataRows.length > 1).length,
  };
}
