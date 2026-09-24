import { anthropometricReferenceTables, ZSCORE_REFERENCE_VERSION } from "./check-code-zscore-reference.ts";

export interface CheckCodeZScoreResult {
  value: number | null;
  reference: "CDC 2000" | "WHO 2006" | "WHO 2007" | "NCHS 1977" | null;
  metric: string | null;
  referenceVersion: typeof ZSCORE_REFERENCE_VERSION;
}

type Row = readonly number[];

const normalized = (value: string): string => value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
const table = (name: string): readonly Row[] => {
  const result = anthropometricReferenceTables[name];
  if (!result) throw new Error(`ZSCORE reference table ${name} is unavailable.`);
  return result;
};
const exactRow = (rows: readonly Row[], sex: number, axis: number): Row | undefined => rows.find((row) => row[0] === sex && row[1] === axis);
const finiteResult = (value: number): number | null => Number.isFinite(value) ? value : null;
const lms = (observation: number, L: number, M: number, S: number): number | null => {
  if (!(observation > 0) || !(M > 0) || S === 0 || L === 0) return null;
  return finiteResult(((observation / M) ** L - 1) / (L * S));
};
const interpolateLms = (rows: readonly Row[], observation: number, axis: number, sex: number, halfStep: boolean): [number, number, number, number] | null => {
  const whole = Math.trunc(axis);
  const difference = axis - whole;
  let lower = halfStep ? (difference > 0.5 ? whole + 0.5 : whole) : whole;
  let upper = lower + (halfStep ? 0.5 : 1);
  const low = exactRow(rows, sex, lower);
  const high = exactRow(rows, sex, upper);
  if (!low || !high) return null;
  let highWeight = axis - lower;
  let lowWeight = upper - axis;
  if (halfStep) { highWeight *= 2; lowWeight *= 2; }
  const L = high[2]! * highWeight + low[2]! * lowWeight;
  const M = high[3]! * highWeight + low[3]! * lowWeight;
  const S = high[4]! * highWeight + low[4]! * lowWeight;
  const value = lms(observation, L, M, S);
  return value === null ? null : [value, L, M, S];
};
const whoAdjusted = (observation: number, base: [number, number, number, number]): number | null => {
  let [value, L, M, S] = base;
  if (value > 3) {
    const sd3 = M * (1 + L * S * 3) ** (1 / L);
    const sd2 = M * (1 + L * S * 2) ** (1 / L);
    value = 3 + (observation - sd3) / (sd3 - sd2);
  } else if (value < -3) {
    const sd3 = M * (1 + L * S * -3) ** (1 / L);
    const sd2 = M * (1 + L * S * -2) ** (1 / L);
    value = -3 + (observation - sd3) / (sd2 - sd3);
  }
  return finiteResult(value);
};
const whoLms = (tableName: string, observation: number, axis: number, sex: number, halfStep = false): number | null => {
  const rows = table(tableName);
  const row = exactRow(rows, sex, axis);
  const base = row ? (() => {
    const value = lms(observation, row[2]!, row[3]!, row[4]!);
    return value === null ? null : [value, row[2]!, row[3]!, row[4]!] as [number, number, number, number];
  })() : interpolateLms(rows, observation, axis, sex, halfStep);
  return base ? whoAdjusted(observation, base) : null;
};
const cdcLms = (tableName: string, observation: number, axis: number, sex: number, zeroHalfStep = false): number | null => {
  const rows = table(tableName);
  const row = exactRow(rows, sex, axis);
  if (row) return lms(observation, row[2]!, row[3]!, row[4]!);
  const whole = Math.trunc(axis);
  const difference = axis - whole;
  let lower = difference < 0.5 ? whole - 0.5 : whole + 0.5;
  const upper = lower + 1;
  if (lower <= 0) lower = 0;
  const low = exactRow(rows, sex, lower);
  const high = exactRow(rows, sex, upper);
  if (!low || !high) return null;
  let highWeight = axis - lower;
  let lowWeight = upper - axis;
  if (zeroHalfStep && lower <= 0) { highWeight *= 2; lowWeight *= 2; }
  return lms(
    observation,
    high[2]! * highWeight + low[2]! * lowWeight,
    high[3]! * highWeight + low[3]! * lowWeight,
    high[4]! * highWeight + low[4]! * lowWeight,
  );
};
const nchsSpread = (row: Row): [number, number, number] => {
  const lower = ((row[5]! - row[2]!) / 1.65 + (row[5]! - row[3]!) / 1.28 + (row[5]! - row[4]!) / 0.67) / 3;
  const upper = ((row[8]! - row[5]!) / 1.65 + (row[7]! - row[5]!) / 1.28 + (row[6]! - row[5]!) / 0.67) / 3;
  return [row[5]!, lower, upper];
};
const nchs = (tableName: string, observation: number, axis: number, sex: number): number | null => {
  const rows = table(tableName);
  const exact = exactRow(rows, sex, axis);
  let mean: number;
  let lowerSd: number;
  let upperSd: number;
  if (exact) [mean, lowerSd, upperSd] = nchsSpread(exact);
  else {
    const lowAxis = Math.trunc(axis);
    const highAxis = lowAxis + 1;
    const low = exactRow(rows, sex, lowAxis);
    const high = exactRow(rows, sex, highAxis);
    if (!low || !high) return null;
    const lowValues = nchsSpread(low);
    const highValues = nchsSpread(high);
    const highWeight = axis - lowAxis;
    const lowWeight = highAxis - axis;
    mean = highValues[0] * highWeight + lowValues[0] * lowWeight;
    lowerSd = highValues[1] * highWeight + lowValues[1] * lowWeight;
    upperSd = highValues[2] * highWeight + lowValues[2] * lowWeight;
  }
  return finiteResult(observation === mean ? 0 : (observation - mean) / (observation > mean ? upperSd : lowerSd));
};

function metricName(value: string): string {
  return normalized(value).replace(/[\s_-]+/g, "");
}

export function anthropometricZScore(referenceValue: string, metricValue: string, measurement: number, axis: number, sex: number): CheckCodeZScoreResult {
  const reference = normalized(referenceValue);
  const metric = metricName(metricValue);
  const result = (value: number | null, standard: CheckCodeZScoreResult["reference"], canonicalMetric: string | null): CheckCodeZScoreResult => ({
    value, reference: standard, metric: canonicalMetric, referenceVersion: ZSCORE_REFERENCE_VERSION,
  });
  const missing = (): CheckCodeZScoreResult => result(null, null, null);
  if (![measurement, axis].every(Number.isFinite) || ![1, 2].includes(sex)) return missing();

  if (reference === "cdc 2000") {
    if (["bodymassindex", "bmi"].includes(metric)) return result(axis < 24 || axis > 240 ? null : cdcLms("CDCBMI", measurement, axis, sex), "CDC 2000", "BMI");
    if (["heightage", "htage"].includes(metric)) return result(axis < 24 || axis > 240 ? null : cdcLms("CDCHtAge", measurement, axis, sex), "CDC 2000", "height-for-age");
    if (["weightage", "wtage"].includes(metric)) return result(axis < 0 || axis > 240 ? null : cdcLms("CDCWtAge", measurement, axis, sex, true), "CDC 2000", "weight-for-age");
    if (["weightheight", "wtht"].includes(metric)) return result(measurement < 77 || measurement >= 121.5 ? null : cdcLms("CDCWtHt", axis, measurement, sex), "CDC 2000", "weight-for-height");
    if (["weightlength", "wtlgth"].includes(metric)) return result(measurement < 45 || measurement >= 103.5 ? null : cdcLms("CDCWtLgth", measurement, axis, sex), "CDC 2000", "weight-for-length");
    if (["headcircumference", "headcircum", "head"].includes(metric)) return result(axis < 0 || axis > 36 ? null : cdcLms("CDCHead", measurement, axis, sex, true), "CDC 2000", "head-circumference-for-age");
    if (["lengthage", "lgthage"].includes(metric)) return result(axis < 0 || axis > 37 ? null : cdcLms("CDCLgthAge", measurement, axis, sex, true), "CDC 2000", "length-for-age");
    return result(null, "CDC 2000", metricValue);
  }
  if (["who cgs", "who child growth standards", "who growth standards", "who 2006"].includes(reference)) {
    if (["bodymassindex", "bmi"].includes(metric)) return result(axis < 0 || axis > 60 ? null : whoLms("WHO2006BMI", measurement, axis, sex), "WHO 2006", "BMI");
    if (["heightage", "htage"].includes(metric)) return result(axis < 0 || axis > 60 ? null : whoLms("WHO2006HtAge", measurement, axis, sex), "WHO 2006", "height-for-age");
    if (["weightage", "wtage"].includes(metric)) return result(axis < 0 || axis > 60 ? null : whoLms("WHO2006WtAge", measurement, axis, sex), "WHO 2006", "weight-for-age");
    if (["weightheight", "wtht"].includes(metric)) return result(axis < 0 || axis > 60 ? null : whoLms("WHO2006WtHt", measurement, axis, sex, true), "WHO 2006", "weight-for-height");
    if (["weightlength", "wtlgth"].includes(metric)) return result(axis < 45 || axis > 110 ? null : whoLms("WHO2006WtLgth", measurement, axis, sex, true), "WHO 2006", "weight-for-length");
    if (["headcircumference", "headcircum", "head"].includes(metric)) return result(axis < 0 || axis > 60 ? null : whoLms("WHO2006Head", measurement, axis, sex), "WHO 2006", "head-circumference-for-age");
    if (metric === "ssf") return result(axis < 3 || axis > 60 ? null : whoLms("WHO2006SSF", measurement, axis, sex), "WHO 2006", "subscapular-skinfold-for-age");
    if (metric === "tsf") return result(axis < 3 || axis > 60 ? null : whoLms("WHO2006TSF", measurement, axis, sex), "WHO 2006", "triceps-skinfold-for-age");
    if (["lengthage", "lgthage"].includes(metric)) return result(axis < 0 || axis >= 24 ? null : whoLms("WHO2006HtAge", measurement, axis, sex), "WHO 2006", "length-for-age");
    return result(null, "WHO 2006", metricValue);
  }
  if (["who growth reference", "who 2007"].includes(reference)) {
    if (["bodymassindex", "bmi"].includes(metric)) return result(axis < 60 || axis > 228 ? null : whoLms("WHO2007BMI", measurement, axis, sex), "WHO 2007", "BMI");
    if (["heightage", "htage"].includes(metric)) return result(axis < 60 || axis > 228 ? null : whoLms("WHO2007HtAge", measurement, axis, sex), "WHO 2007", "height-for-age");
    if (["weightage", "wtage"].includes(metric)) return result(axis < 61 || axis > 120 ? null : whoLms("WHO2007WtAge", measurement, axis, sex), "WHO 2007", "weight-for-age");
    return result(null, "WHO 2007", metricValue);
  }
  if (["nchs 1977", "who 1977", "who 1978", "cdc/who 1978"].includes(reference)) {
    if (["heightage", "htage"].includes(metric)) return result(axis < 24 || axis > 119 ? null : nchs("WHO1978HtAge", measurement, axis, sex), "NCHS 1977", "height-for-age");
    if (["lengthage", "lgthage"].includes(metric)) return result(axis < 0 || axis > 23 ? null : nchs("WHO1978LgthAge", measurement, axis, sex), "NCHS 1977", "length-for-age");
    if (["weightage", "wtage"].includes(metric)) return result(axis < 0 || axis > 119 ? null : nchs("WHO1978WtAge", measurement, axis, sex), "NCHS 1977", "weight-for-age");
    if (["weightheight", "wtht"].includes(metric)) return result(axis < 65 || axis > 137 ? null : nchs("WHO1978WtHt", measurement, axis, sex), "NCHS 1977", "weight-for-height");
    if (["weightlength", "wtlgth"].includes(metric)) return result(axis < 49 || axis > 100 ? null : nchs("WHO1978WtLgth", measurement, axis, sex), "NCHS 1977", "weight-for-length");
    return result(null, "NCHS 1977", metricValue);
  }
  return missing();
}
