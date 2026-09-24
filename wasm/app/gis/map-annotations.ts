export interface MapAnnotationsV01 {
  title: string;
  subtitle: string;
  note: string;
  showLegend: boolean;
  showNorthArrow: boolean;
  showScaleBar: boolean;
}

export class MapAnnotationsErrorV01 extends Error {
  constructor(message: string) { super(message); this.name = "MapAnnotationsErrorV01"; }
}

function boundedText(value: string, label: string, maximum: number): string {
  if (typeof value !== "string" || value.length > maximum) throw new MapAnnotationsErrorV01(`${label} must be text of at most ${maximum} characters.`);
  return value.trim();
}

export function validateMapAnnotationsV01(annotations: MapAnnotationsV01): void {
  boundedText(annotations.title, "Map title", 200);
  boundedText(annotations.subtitle, "Map subtitle", 300);
  boundedText(annotations.note, "Map note", 2000);
  for (const [label, value] of [["legend", annotations.showLegend], ["north arrow", annotations.showNorthArrow], ["scale bar", annotations.showScaleBar]] as const) if (typeof value !== "boolean") throw new MapAnnotationsErrorV01(`Map ${label} visibility must be boolean.`);
  if (!annotations.title && !annotations.subtitle && !annotations.note && !annotations.showLegend && !annotations.showNorthArrow && !annotations.showScaleBar) throw new MapAnnotationsErrorV01("Map annotations must retain at least one visible annotation or map aid.");
}

export function createMapAnnotationsV01(input: Partial<MapAnnotationsV01> = {}): MapAnnotationsV01 {
  const annotations: MapAnnotationsV01 = { title: input.title ?? "", subtitle: input.subtitle ?? "", note: input.note ?? "", showLegend: input.showLegend ?? true, showNorthArrow: input.showNorthArrow ?? true, showScaleBar: input.showScaleBar ?? true };
  validateMapAnnotationsV01(annotations);
  return annotations;
}
