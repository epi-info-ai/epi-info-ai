import type { EpiRecord } from "../contracts/core.js";
import type { EpiCurveBin, EpiCurveInterval, EpiCurveRequest, EpiCurveResult } from "../contracts/dashboard.js";

const MAX_BINS = 400;
const MISSING_CATEGORY = "(Missing)";

function requireFieldName(value: string, label: string): string {
  const result = value.trim();
  if (!result) throw new RangeError(`${label} is required.`);
  return result;
}

function parseDateValue(value: unknown): Date | null | "invalid" {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : "invalid";
  const text = String(value).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) {
    const date = new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])));
    return date.getUTCFullYear() === Number(dateOnly[1])
      && date.getUTCMonth() === Number(dateOnly[2]) - 1
      && date.getUTCDate() === Number(dateOnly[3]) ? date : "invalid";
  }
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? new Date(timestamp) : "invalid";
}

function validateRequest(input: EpiCurveRequest): EpiCurveRequest {
  const interval: EpiCurveInterval = input.interval;
  if (!["hour", "day", "month", "year"].includes(interval)) throw new RangeError("Choose Hour, Day, Month, or Year as the interval.");
  if (!Number.isInteger(input.step) || input.step < 1 || input.step > 365) throw new RangeError("Step must be a whole number from 1 through 365.");
  const result: EpiCurveRequest = {
    dateField: requireFieldName(input.dateField, "Main date variable"),
    datePrompt: input.datePrompt.trim() || input.dateField.trim(),
    interval,
    step: input.step,
    includeMissing: Boolean(input.includeMissing),
  };
  if (input.caseStatusField?.trim()) result.caseStatusField = input.caseStatusField.trim();
  if (input.caseStatusPrompt?.trim()) result.caseStatusPrompt = input.caseStatusPrompt.trim();
  if (input.start?.trim()) result.start = input.start.trim();
  if (input.end?.trim()) result.end = input.end.trim();
  return result;
}

function floorDate(date: Date, interval: EpiCurveInterval, step: number): Date {
  if (interval === "hour") {
    const hours = Math.floor(date.getTime() / 3_600_000 / step) * step;
    return new Date(hours * 3_600_000);
  }
  if (interval === "day") {
    const days = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000 / step) * step;
    return new Date(days * 86_400_000);
  }
  if (interval === "month") {
    const month = date.getUTCFullYear() * 12 + date.getUTCMonth();
    const startMonth = Math.floor(month / step) * step;
    return new Date(Date.UTC(Math.floor(startMonth / 12), startMonth % 12, 1));
  }
  const year = Math.floor(date.getUTCFullYear() / step) * step;
  return new Date(Date.UTC(year, 0, 1));
}

function addInterval(date: Date, interval: EpiCurveInterval, step: number): Date {
  if (interval === "hour") return new Date(date.getTime() + step * 3_600_000);
  if (interval === "day") return new Date(date.getTime() + step * 86_400_000);
  if (interval === "month") return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + step, 1));
  return new Date(Date.UTC(date.getUTCFullYear() + step, 0, 1));
}

function labelDate(date: Date, interval: EpiCurveInterval): string {
  if (interval === "hour") return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "numeric" }).format(date);
  if (interval === "day") return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).format(date);
  if (interval === "month") return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", year: "numeric" }).format(date);
  return String(date.getUTCFullYear());
}

function bound(value: string | undefined, end: boolean): Date | undefined {
  if (!value) return undefined;
  const parsed = parseDateValue(value);
  if (parsed === null || parsed === "invalid") throw new RangeError(`${end ? "End" : "Start"} value is not a valid date or date/time.`);
  if (end && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(parsed.getTime() + 86_400_000 - 1);
  return parsed;
}

function categoryValue(record: EpiRecord, request: EpiCurveRequest): string | null {
  if (!request.caseStatusField) return "All records";
  const value = record[request.caseStatusField];
  const text = value === undefined || value === null ? "" : String(value).trim();
  if (text) return text;
  return request.includeMissing ? MISSING_CATEGORY : null;
}

export function deriveEpiCurve(records: readonly EpiRecord[], input: EpiCurveRequest): EpiCurveResult {
  const request = validateRequest(input);
  const startBound = bound(request.start, false);
  const endBound = bound(request.end, true);
  if (startBound && endBound && startBound > endBound) throw new RangeError("Start value must not be after end value.");
  const totals = {
    sourceRecords: records.length,
    includedRecords: 0,
    excludedMissingDate: 0,
    excludedInvalidDate: 0,
    excludedOutsideRange: 0,
    excludedMissingCaseStatus: 0,
  };
  const included: Array<{ date: Date; category: string }> = [];
  for (const record of records) {
    const date = parseDateValue(record[request.dateField]);
    if (date === null) { totals.excludedMissingDate += 1; continue; }
    if (date === "invalid") { totals.excludedInvalidDate += 1; continue; }
    if ((startBound && date < startBound) || (endBound && date > endBound)) { totals.excludedOutsideRange += 1; continue; }
    const category = categoryValue(record, request);
    if (category === null) { totals.excludedMissingCaseStatus += 1; continue; }
    included.push({ date, category });
  }
  totals.includedRecords = included.length;
  const categories = [...new Set(included.map((item) => item.category))].sort((left, right) => left.localeCompare(right, "en-US"));
  const earliest = startBound ?? included.reduce<Date | undefined>((current, item) => !current || item.date < current ? item.date : current, undefined);
  const latest = endBound ?? included.reduce<Date | undefined>((current, item) => !current || item.date > current ? item.date : current, undefined);
  const bins: EpiCurveBin[] = [];
  if (earliest && latest) {
    let cursor = floorDate(earliest, request.interval, request.step);
    const last = floorDate(latest, request.interval, request.step);
    while (cursor <= last) {
      if (bins.length >= MAX_BINS) throw new RangeError(`This selection creates more than ${MAX_BINS} intervals. Increase Step or narrow the start/end range.`);
      const next = addInterval(cursor, request.interval, request.step);
      bins.push({
        key: cursor.toISOString(),
        label: labelDate(cursor, request.interval),
        start: cursor.toISOString(),
        endExclusive: next.toISOString(),
        total: 0,
        counts: Object.fromEntries(categories.map((category) => [category, 0])),
      });
      cursor = next;
    }
  }
  const byStart = new Map(bins.map((bin) => [bin.start, bin]));
  for (const item of included) {
    const key = floorDate(item.date, request.interval, request.step).toISOString();
    const bin = byStart.get(key);
    if (!bin) continue;
    bin.counts[item.category] = (bin.counts[item.category] ?? 0) + 1;
    bin.total += 1;
  }
  const warnings: string[] = [];
  if (totals.excludedMissingDate > 0) warnings.push(`${totals.excludedMissingDate} record${totals.excludedMissingDate === 1 ? " has" : "s have"} no ${request.datePrompt} value and cannot be plotted.`);
  if (totals.excludedInvalidDate > 0) warnings.push(`${totals.excludedInvalidDate} invalid date value${totals.excludedInvalidDate === 1 ? " was" : "s were"} excluded.`);
  if (totals.excludedMissingCaseStatus > 0) warnings.push(`${totals.excludedMissingCaseStatus} record${totals.excludedMissingCaseStatus === 1 ? " was" : "s were"} excluded because ${request.caseStatusPrompt ?? request.caseStatusField} is missing.`);
  if (bins.length === 0) warnings.push("No records are available in the selected date range.");
  return { version: "dashboard.epicurve/0.1", request, categories, bins, totals, diagnostics: { warnings } };
}
