export interface MapPngExportPlanV01 {
  schema: "epi-gis-map-png-export/0.1";
  fileName: string;
  widthPixels: number;
  heightPixels: number;
  scale: number;
  includeBackground: boolean;
  includeLegend: boolean;
  includeAnnotations: boolean;
}

export class MapPngExportPlanErrorV01 extends Error {
  constructor(message: string) { super(message); this.name = "MapPngExportPlanErrorV01"; }
}

function integer(value: number, label: string, minimum: number, maximum: number): void { if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new MapPngExportPlanErrorV01(`${label} must be an integer from ${minimum} through ${maximum}.`); }

export function validateMapPngExportPlanV01(plan: MapPngExportPlanV01): void {
  if (plan.schema !== "epi-gis-map-png-export/0.1") throw new MapPngExportPlanErrorV01("PNG export schema is not supported.");
  if (typeof plan.fileName !== "string" || !/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,119}\.png$/i.test(plan.fileName)) throw new MapPngExportPlanErrorV01("PNG export filename must be a safe .png filename.");
  integer(plan.widthPixels, "PNG width", 64, 4096);
  integer(plan.heightPixels, "PNG height", 64, 4096);
  integer(plan.scale, "PNG scale", 1, 4);
  if (plan.widthPixels * plan.heightPixels * plan.scale * plan.scale > 16_777_216) throw new MapPngExportPlanErrorV01("PNG export exceeds the 16,777,216 pixel budget.");
  for (const [label, value] of [["background", plan.includeBackground], ["legend", plan.includeLegend], ["annotations", plan.includeAnnotations]] as const) if (typeof value !== "boolean") throw new MapPngExportPlanErrorV01(`PNG export ${label} inclusion must be boolean.`);
}

export function createMapPngExportPlanV01(input: Omit<MapPngExportPlanV01, "schema">): MapPngExportPlanV01 { const plan: MapPngExportPlanV01 = { schema: "epi-gis-map-png-export/0.1", ...input }; validateMapPngExportPlanV01(plan); return plan; }
