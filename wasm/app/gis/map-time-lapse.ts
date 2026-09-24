export type MapTimeLapseValueKindV01 = "date" | "time" | "datetime";

export interface MapTimeLapsePlanV01 {
  schema: "epi-gis-map-time-lapse/0.1";
  sourceFormId: string;
  timeField: string;
  valueKind: MapTimeLapseValueKindV01;
  maxStops: number;
  intervalMilliseconds: number;
  autoplay: boolean;
}

export class MapTimeLapsePlanErrorV01 extends Error {
  constructor(message: string) { super(message); this.name = "MapTimeLapsePlanErrorV01"; }
}

function text(value: string, label: string): string { if (typeof value !== "string" || value.trim() === "") throw new MapTimeLapsePlanErrorV01(`${label} must be a non-empty string.`); return value.trim(); }
function integer(value: number, label: string, minimum: number, maximum: number): void { if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new MapTimeLapsePlanErrorV01(`${label} must be an integer from ${minimum} through ${maximum}.`); }

export function validateMapTimeLapsePlanV01(plan: MapTimeLapsePlanV01): void {
  if (plan.schema !== "epi-gis-map-time-lapse/0.1") throw new MapTimeLapsePlanErrorV01("Map time-lapse schema is not supported.");
  text(plan.sourceFormId, "Time-lapse source form");
  text(plan.timeField, "Time-lapse field");
  if (plan.valueKind !== "date" && plan.valueKind !== "time" && plan.valueKind !== "datetime") throw new MapTimeLapsePlanErrorV01("Time-lapse value kind is not supported.");
  integer(plan.maxStops, "Time-lapse maximum stops", 1, 1000);
  integer(plan.intervalMilliseconds, "Time-lapse interval", 100, 60000);
  if (typeof plan.autoplay !== "boolean") throw new MapTimeLapsePlanErrorV01("Time-lapse autoplay must be boolean.");
}

export function createMapTimeLapsePlanV01(input: Omit<MapTimeLapsePlanV01, "schema">): MapTimeLapsePlanV01 {
  const plan: MapTimeLapsePlanV01 = { schema: "epi-gis-map-time-lapse/0.1", ...input };
  validateMapTimeLapsePlanV01(plan);
  return plan;
}
