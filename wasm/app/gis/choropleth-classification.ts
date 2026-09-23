import { validateChoroplethClassificationV01, type ChoroplethClassificationV01, type ChoroplethClassificationMethodV01 } from "./choropleth.ts";

export interface ChoroplethValueObservationV01 {
  featureIndex: number;
  value: unknown;
}

export interface ChoroplethClassAssignmentV01 {
  featureIndex: number;
  value: number | null;
  classIndex: number | null;
}

export interface ChoroplethClassificationResultV01 {
  method: ChoroplethClassificationMethodV01;
  classCount: number;
  breaks: number[];
  assignments: ChoroplethClassAssignmentV01[];
  classCounts: number[];
  validCount: number;
  invalidCount: number;
  minimum: number | null;
  maximum: number | null;
}

function numericValue(value: unknown): number | null {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
  const candidate = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(candidate) ? candidate : null;
}

function classForValue(value: number, breaks: readonly number[], classCount: number): number {
  for (let index = 0; index < breaks.length; index += 1) {
    if (value <= breaks[index]!) return index;
  }
  return classCount - 1;
}

function automaticBreaks(values: readonly number[], method: "equal-interval" | "quantile", classCount: number): number[] {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (method === "equal-interval") {
    const width = (maximum - minimum) / classCount;
    return Array.from({ length: classCount - 1 }, (_, index) => minimum + width * (index + 1));
  }
  const sorted = [...values].sort((left, right) => left - right);
  return Array.from({ length: classCount - 1 }, (_, index) => sorted[Math.ceil((index + 1) * sorted.length / classCount) - 1]!);
}

export function classifyChoroplethValuesV01(
  observations: readonly ChoroplethValueObservationV01[],
  classification: ChoroplethClassificationV01,
): ChoroplethClassificationResultV01 {
  validateChoroplethClassificationV01(classification);
  const numeric = observations.map(({ value }) => numericValue(value));
  const validValues = numeric.filter((value): value is number => value !== null);
  const breaks = classification.method === "manual"
    ? [...classification.breaks!]
    : validValues.length > 0 ? automaticBreaks(validValues, classification.method, classification.classCount) : Array.from({ length: classification.classCount - 1 }, () => 0);
  const classCounts = Array.from({ length: classification.classCount }, () => 0);
  const assignments = observations.map(({ featureIndex }, index) => {
    const value = numeric[index]!;
    if (value === null) return { featureIndex, value: null, classIndex: null };
    const classIndex = classForValue(value, breaks, classification.classCount);
    classCounts[classIndex]! += 1;
    return { featureIndex, value, classIndex };
  });
  return {
    method: classification.method,
    classCount: classification.classCount,
    breaks,
    assignments,
    classCounts,
    validCount: validValues.length,
    invalidCount: observations.length - validValues.length,
    minimum: validValues.length > 0 ? Math.min(...validValues) : null,
    maximum: validValues.length > 0 ? Math.max(...validValues) : null,
  };
}
