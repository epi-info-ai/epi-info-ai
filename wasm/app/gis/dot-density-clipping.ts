import type { DotDensityCandidateV01 } from "./dot-density-placement.ts";

export type DotDensityPositionV01 = readonly [number, number];
export type DotDensityPolygonCoordinatesV01 = readonly (readonly DotDensityPositionV01[])[];

export interface DotDensityPolygonGeometryV01 { type: "Polygon"; coordinates: DotDensityPolygonCoordinatesV01; }
export interface DotDensityMultiPolygonGeometryV01 { type: "MultiPolygon"; coordinates: readonly DotDensityPolygonCoordinatesV01[]; }
export type DotDensityClipGeometryV01 = DotDensityPolygonGeometryV01 | DotDensityMultiPolygonGeometryV01;
export type DotDensityClipDiagnosticCodeV01 = "missing-geometry" | "unsupported-geometry" | "invalid-geometry";
export interface DotDensityClipDiagnosticV01 { featureIndex: number; code: DotDensityClipDiagnosticCodeV01; message: string; }
export interface DotDensityClipResultV01 { candidates: DotDensityCandidateV01[]; diagnostics: DotDensityClipDiagnosticV01[]; inputCount: number; keptCount: number; clippedCount: number; }

function finitePosition(position: readonly number[]): position is DotDensityPositionV01 { return position.length >= 2 && Number.isFinite(position[0]) && Number.isFinite(position[1]); }
function validRing(ring: readonly DotDensityPositionV01[]): boolean { const first = ring[0]; const last = ring[ring.length - 1]; return ring.length >= 4 && ring.every(finitePosition) && first !== undefined && last !== undefined && first[0] === last[0] && first[1] === last[1]; }
function validPolygon(polygon: DotDensityPolygonCoordinatesV01): boolean { return polygon.length > 0 && polygon.every(validRing); }
function validGeometry(geometry: DotDensityClipGeometryV01): boolean { return geometry.type === "Polygon" ? validPolygon(geometry.coordinates) : geometry.coordinates.length > 0 && geometry.coordinates.every(validPolygon); }

function pointOnSegment(x: number, y: number, a: DotDensityPositionV01, b: DotDensityPositionV01): boolean {
  const cross = (x - a[0]) * (b[1] - a[1]) - (y - a[1]) * (b[0] - a[0]);
  return Math.abs(cross) <= 1e-12 && x >= Math.min(a[0], b[0]) - 1e-12 && x <= Math.max(a[0], b[0]) + 1e-12 && y >= Math.min(a[1], b[1]) - 1e-12 && y <= Math.max(a[1], b[1]) + 1e-12;
}
function inRing(x: number, y: number, ring: readonly DotDensityPositionV01[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const current = ring[index];
    const prior = ring[previous];
    if (current === undefined || prior === undefined) continue;
    if (pointOnSegment(x, y, prior, current)) return true;
    if ((current[1] > y) !== (prior[1] > y) && x < ((prior[0] - current[0]) * (y - current[1])) / (prior[1] - current[1]) + current[0]) inside = !inside;
  }
  return inside;
}
function inPolygon(x: number, y: number, polygon: DotDensityPolygonCoordinatesV01): boolean { const outer = polygon[0]; return outer !== undefined && inRing(x, y, outer) && polygon.slice(1).every((hole) => !inRing(x, y, hole)); }
function inGeometry(x: number, y: number, geometry: DotDensityClipGeometryV01): boolean { return geometry.type === "Polygon" ? inPolygon(x, y, geometry.coordinates) : geometry.coordinates.some((polygon) => inPolygon(x, y, polygon)); }

export function clipDotDensityCandidatesV01(candidates: readonly DotDensityCandidateV01[], geometries: ReadonlyMap<number, DotDensityClipGeometryV01>): DotDensityClipResultV01 {
  const diagnostics: DotDensityClipDiagnosticV01[] = [];
  const validGeometries = new Map<number, DotDensityClipGeometryV01>();
  for (const [featureIndex, geometry] of geometries) {
    if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") { diagnostics.push({ featureIndex, code: "unsupported-geometry", message: "Dot Density clipping requires Polygon or MultiPolygon geometry." }); continue; }
    if (!validGeometry(geometry)) { diagnostics.push({ featureIndex, code: "invalid-geometry", message: "Dot Density polygon rings must be closed, finite, and contain at least four positions." }); continue; }
    validGeometries.set(featureIndex, geometry);
  }
  const kept: DotDensityCandidateV01[] = [];
  for (const candidate of candidates) {
    const geometry = validGeometries.get(candidate.featureIndex);
    if (!geometry) { if (!diagnostics.some((diagnostic) => diagnostic.featureIndex === candidate.featureIndex && diagnostic.code === "missing-geometry")) diagnostics.push({ featureIndex: candidate.featureIndex, code: "missing-geometry", message: "No valid boundary geometry was provided for the Dot Density feature." }); continue; }
    if (inGeometry(candidate.x, candidate.y, geometry)) kept.push(candidate);
  }
  return { candidates: kept, diagnostics, inputCount: candidates.length, keptCount: kept.length, clippedCount: candidates.length - kept.length };
}
