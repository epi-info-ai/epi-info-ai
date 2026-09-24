import type { RecordValue } from "../contracts/core.js";

export const CHECK_CODE_FORMAT_NAMES = [
  "General Date", "Long Date", "Short Date", "Long Time", "Short Time",
  "General Number", "Currency", "Fixed", "Standard", "Percent", "Scientific",
  "Yes/No", "True/False", "On/Off",
] as const;

export type CheckCodeFormatName = typeof CHECK_CODE_FORMAT_NAMES[number];

const formats = new Map(CHECK_CODE_FORMAT_NAMES.map((name) => [name.toLocaleLowerCase("en-US"), name]));
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function checkCodeFormatName(value: string): CheckCodeFormatName | undefined {
  return formats.get(value.trim().toLocaleLowerCase("en-US"));
}

function numeric(value: RecordValue, format: string): number {
  const result = typeof value === "boolean" ? Number(value) : typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(result)) throw new RangeError(`FORMAT ${format} requires a finite numeric or Yes/No value.`);
  return Object.is(result, -0) ? 0 : result;
}

function group(integer: string): string {
  return integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fixed(value: number, grouping: boolean): string {
  const negative = value < 0;
  const [integer, fraction] = Math.abs(value).toFixed(2).split(".");
  return `${negative ? "-" : ""}${grouping ? group(integer!) : integer}.${fraction}`;
}

function dateTime(value: RecordValue, format: string): { year: number; month: number; day: number; hour: number; minute: number; second: number; hasDate: boolean; hasTime: boolean } {
  const source = String(value ?? "");
  const match = source.match(/^(?:(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?|(\d{2}):(\d{2})(?::(\d{2}))?)$/);
  if (!match) throw new RangeError(`FORMAT ${format} requires an ISO date, time, or local date-time.`);
  const hasDate = match[1] !== undefined;
  const hasTime = match[4] !== undefined || match[7] !== undefined;
  const year = Number(match[1] ?? 2000);
  const month = Number(match[2] ?? 1);
  const day = Number(match[3] ?? 1);
  const hour = Number(match[4] ?? match[7] ?? 0);
  const minute = Number(match[5] ?? match[8] ?? 0);
  const second = Number(match[6] ?? match[9] ?? 0);
  const test = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if ((hasDate && (year < 100 || test.getUTCFullYear() !== year || test.getUTCMonth() + 1 !== month || test.getUTCDate() !== day))
    || hour > 23 || minute > 59 || second > 59) throw new RangeError(`FORMAT ${format} received an invalid ISO date-time.`);
  return { year, month, day, hour, minute, second, hasDate, hasTime };
}

function shortDate(parts: ReturnType<typeof dateTime>): string {
  return `${parts.month}/${parts.day}/${parts.year}`;
}

function longTime(parts: ReturnType<typeof dateTime>): string {
  const period = parts.hour < 12 ? "AM" : "PM";
  const hour = parts.hour % 12 || 12;
  return `${hour}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")} ${period}`;
}

export function formatCheckCodeValue(value: RecordValue, requestedFormat?: RecordValue): string {
  if (requestedFormat === undefined) {
    if (typeof value === "boolean") return value ? "True" : "False";
    return String(value);
  }
  if (typeof requestedFormat !== "string") throw new RangeError("FORMAT requires a literal named format as its second argument.");
  const format = checkCodeFormatName(requestedFormat);
  if (!format) throw new RangeError(`FORMAT does not support ${JSON.stringify(requestedFormat)} in the deterministic browser profile.`);
  if (["General Number", "Currency", "Fixed", "Standard", "Percent", "Scientific", "Yes/No", "True/False", "On/Off"].includes(format)) {
    const number = numeric(value, format);
    if (format === "General Number") return String(number);
    if (format === "Fixed") return fixed(number, false);
    if (format === "Standard") return fixed(number, true);
    if (format === "Currency") {
      const amount = `$${fixed(Math.abs(number), true)}`;
      return number < 0 ? `(${amount})` : amount;
    }
    if (format === "Percent") return `${fixed(number * 100, true)}%`;
    if (format === "Scientific") {
      const [coefficient, exponent] = number.toExponential(2).toUpperCase().split("E");
      const sign = exponent!.startsWith("-") ? "-" : "+";
      return `${coefficient}E${sign}${exponent!.replace(/^[+-]/, "").padStart(2, "0")}`;
    }
    const truthy = number !== 0;
    return format === "Yes/No" ? truthy ? "Yes" : "No"
      : format === "True/False" ? truthy ? "True" : "False" : truthy ? "On" : "Off";
  }
  const parts = dateTime(value, format);
  if (["Long Date", "Short Date"].includes(format) && !parts.hasDate) throw new RangeError(`FORMAT ${format} requires a date value.`);
  if (["Long Time", "Short Time"].includes(format) && !parts.hasTime) throw new RangeError(`FORMAT ${format} requires a time value.`);
  if (format === "Short Date") return shortDate(parts);
  if (format === "Long Date") return `${weekdays[new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay()]}, ${months[parts.month - 1]} ${parts.day}, ${parts.year}`;
  if (format === "Long Time") return longTime(parts);
  if (format === "Short Time") return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
  return parts.hasDate && parts.hasTime ? `${shortDate(parts)} ${longTime(parts)}` : parts.hasDate ? shortDate(parts) : longTime(parts);
}
