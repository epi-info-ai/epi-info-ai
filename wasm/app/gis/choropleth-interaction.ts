import type { ChoroplethDataRowV01, ChoroplethJoinMatchV01 } from "./choropleth-join.ts";
import type { ChoroplethFilterV01 } from "./choropleth.ts";

export interface ChoroplethFilterResultV01 {
  includedRows: ChoroplethDataRowV01[];
  filteredRows: ChoroplethDataRowV01[];
}

export interface ChoroplethFeatureSelectionV01 {
  featureIndex: number;
  normalizedKey: string;
  boundary: ChoroplethJoinMatchV01["boundary"];
  dataRows: ChoroplethDataRowV01[];
}

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function compare(left: unknown, right: string): number {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (text(left) !== "" && Number.isFinite(leftNumber) && right.trim() !== "" && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  return text(left).localeCompare(right, "en-US", { sensitivity: "base" });
}

export function matchesChoroplethFilterV01(row: ChoroplethDataRowV01, filter: ChoroplethFilterV01): boolean {
  const value = row.values[filter.field];
  const candidate = filter.value ?? "";
  switch (filter.operator) {
    case "equals": return compare(value, candidate) === 0;
    case "not-equals": return compare(value, candidate) !== 0;
    case "contains": return text(value).toLocaleLowerCase("en-US").includes(candidate.toLocaleLowerCase("en-US"));
    case "greater-than": return compare(value, candidate) > 0;
    case "greater-or-equal": return compare(value, candidate) >= 0;
    case "less-than": return compare(value, candidate) < 0;
    case "less-or-equal": return compare(value, candidate) <= 0;
    case "is-empty": return text(value) === "";
    case "is-not-empty": return text(value) !== "";
  }
}

export function filterChoroplethDataRowsV01(rows: readonly ChoroplethDataRowV01[], filter?: ChoroplethFilterV01): ChoroplethFilterResultV01 {
  if (!filter) return { includedRows: [...rows], filteredRows: [] };
  const includedRows: ChoroplethDataRowV01[] = [];
  const filteredRows: ChoroplethDataRowV01[] = [];
  for (const row of rows) {
    if (matchesChoroplethFilterV01(row, filter)) includedRows.push(row);
    else filteredRows.push(row);
  }
  return { includedRows, filteredRows };
}

export function selectChoroplethFeatureV01(matches: readonly ChoroplethJoinMatchV01[], featureIndex: number): ChoroplethFeatureSelectionV01 | null {
  if (!Number.isSafeInteger(featureIndex) || featureIndex < 0) return null;
  const match = matches.find(({ boundary }) => boundary.featureIndex === featureIndex);
  if (!match) return null;
  return { featureIndex, normalizedKey: match.normalizedKey, boundary: match.boundary, dataRows: [...match.dataRows] };
}
