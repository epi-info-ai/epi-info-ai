export type DotDensityJoinNormalizationV01 = "exact" | "trim-casefold";
export interface DotDensityBoundaryFeatureV01 { featureIndex: number; properties: Readonly<Record<string, unknown>>; }
export interface DotDensityDataRowV01 { rowIndex: number; values: Readonly<Record<string, unknown>>; }
export interface DotDensityJoinMatchV01 { boundary: DotDensityBoundaryFeatureV01; dataRows: DotDensityDataRowV01[]; }
export type DotDensityJoinDiagnosticCodeV01 = "missing-boundary-key" | "missing-data-key" | "unmatched-boundary" | "unmatched-data" | "duplicate-data-key";
export interface DotDensityJoinDiagnosticV01 { code: DotDensityJoinDiagnosticCodeV01; featureIndex?: number; rowIndex?: number; key?: string; message: string; }
export interface DotDensityJoinResultV01 { matches: DotDensityJoinMatchV01[]; diagnostics: DotDensityJoinDiagnosticV01[]; }

function normalize(value: unknown, mode: DotDensityJoinNormalizationV01): string { const text = value === null || value === undefined ? "" : String(value); return mode === "trim-casefold" ? text.trim().toLocaleLowerCase() : text; }

export function joinDotDensityDataToBoundariesV01(boundaries: readonly DotDensityBoundaryFeatureV01[], rows: readonly DotDensityDataRowV01[], boundaryKeyField: string, dataKeyField: string, normalization: DotDensityJoinNormalizationV01 = "trim-casefold"): DotDensityJoinResultV01 {
  if (!boundaryKeyField.trim() || !dataKeyField.trim()) throw new Error("Dot Density joins require boundary and data key fields.");
  if (normalization !== "exact" && normalization !== "trim-casefold") throw new Error("Unsupported Dot Density join normalization.");
  const diagnostics: DotDensityJoinDiagnosticV01[] = [];
  const rowsByKey = new Map<string, DotDensityDataRowV01[]>();
  for (const row of rows) {
    const key = normalize(row.values[dataKeyField], normalization);
    if (!key) { diagnostics.push({ code: "missing-data-key", rowIndex: row.rowIndex, message: "The Dot Density data row has no join key." }); continue; }
    const keyed = rowsByKey.get(key) ?? [];
    keyed.push(row);
    rowsByKey.set(key, keyed);
  }
  const matches: DotDensityJoinMatchV01[] = [];
  const matchedRows = new Set<number>();
  for (const boundary of boundaries) {
    const key = normalize(boundary.properties[boundaryKeyField], normalization);
    if (!key) { diagnostics.push({ code: "missing-boundary-key", featureIndex: boundary.featureIndex, message: "The Dot Density boundary feature has no join key." }); continue; }
    const dataRows = rowsByKey.get(key) ?? [];
    if (dataRows.length === 0) { diagnostics.push({ code: "unmatched-boundary", featureIndex: boundary.featureIndex, key, message: `No Dot Density data row matched boundary key “${key}”.` }); continue; }
    if (dataRows.length > 1) diagnostics.push({ code: "duplicate-data-key", featureIndex: boundary.featureIndex, key, message: `Dot Density key “${key}” matched ${dataRows.length} data rows; values will be treated as ambiguous.` });
    dataRows.forEach((row) => matchedRows.add(row.rowIndex));
    matches.push({ boundary, dataRows: [...dataRows] });
  }
  for (const row of rows) {
    if (matchedRows.has(row.rowIndex)) continue;
    const key = normalize(row.values[dataKeyField], normalization);
    if (key) diagnostics.push({ code: "unmatched-data", rowIndex: row.rowIndex, key, message: `Dot Density data key “${key}” did not match a boundary feature.` });
  }
  return { matches, diagnostics };
}
