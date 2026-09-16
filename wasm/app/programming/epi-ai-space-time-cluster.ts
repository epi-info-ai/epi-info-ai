import type { FieldDefinition } from "../contracts/core.ts";
import { parseClassicProgram } from "./classic-ast.ts";

export const SPACE_TIME_CLUSTER_PLAN_VERSION = "0.1.0" as const;

export interface SpaceTimeClusterCommandInput {
  idField: string;
  dateField: string;
  latitudeField: string;
  longitudeField: string;
  resultName: string;
  studyStart: string;
  studyEnd: string;
  timeUnit: "DAY" | "WEEK" | "MONTH";
  timeLength: number;
  maxDistanceKm: number;
  maxCaseFraction: number;
  maxTimeUnits: number;
  maxTimeFraction: number;
  replications: number;
  seed: number;
}

export interface SpaceTimeClusterPlan extends SpaceTimeClusterCommandInput {
  version: typeof SPACE_TIME_CLUSTER_PLAN_VERSION;
  analysis: "retrospective-space-time";
  model: "space-time-permutation";
  scan: "high";
  coordinateSystem: "WGS84";
  spatialShape: "circle";
  canonicalSource: string;
  execution: "candidate-preview";
}

export interface SpaceTimeClusterRenderPlan {
  version: "0.1.0";
  resultName: string;
  canonicalSource: string;
  execution: "local-named-result";
}

const fieldToken = (name: string): string => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `[${name}]`;
const numberToken = (value: number): string => Number.isInteger(value) ? String(value) : String(Number(value));

export function buildSpaceTimeClusterCommand(input: SpaceTimeClusterCommandInput): string {
  return [
    "EPIAI CLUSTER SPACE_TIME",
    `ID=${fieldToken(input.idField)}`, `DATE=${fieldToken(input.dateField)}`,
    `LATITUDE=${fieldToken(input.latitudeField)}`, `LONGITUDE=${fieldToken(input.longitudeField)}`,
    `RESULT=${fieldToken(input.resultName)}`,
    `START=${input.studyStart}`, `END=${input.studyEnd}`, `UNIT=${input.timeUnit}`, `LENGTH=${numberToken(input.timeLength)}`,
    `MAXDISTANCEKM=${numberToken(input.maxDistanceKm)}`, `MAXCASEFRACTION=${numberToken(input.maxCaseFraction)}`,
    `MAXTIMEUNITS=${numberToken(input.maxTimeUnits)}`, `MAXTIMEFRACTION=${numberToken(input.maxTimeFraction)}`,
    `REPLICATIONS=${numberToken(input.replications)}`, `SEED=${numberToken(input.seed)}`,
  ].join(" ");
}

export function buildSpaceTimeClusterRenderCommand(resultName: string): string {
  return `EPIAI CLUSTER RENDER RESULT=${fieldToken(resultName)}`;
}

export function resolveSpaceTimeClusterRenderCommand(source: string): SpaceTimeClusterRenderPlan {
  const ast = parseClassicProgram(source);
  const statement = ast.body[0];
  if (ast.body.length !== 1 || statement?.type !== "EpiAiClusterRenderStatement") throw new RangeError("Select exactly one EPIAI CLUSTER RENDER command.");
  return {
    version: "0.1.0",
    resultName: statement.resultName.name,
    canonicalSource: buildSpaceTimeClusterRenderCommand(statement.resultName.name),
    execution: "local-named-result",
  };
}

function resolvedField(fields: readonly FieldDefinition[], requested: string, role: string): FieldDefinition {
  const matches = fields.filter((field) => field.name.toLocaleLowerCase("en-US") === requested.toLocaleLowerCase("en-US"));
  if (matches.length !== 1) throw new RangeError(`${requested} is not an unambiguous ${role} field in the current form.`);
  return matches[0]!;
}

export function resolveSpaceTimeClusterCommand(source: string, fields: readonly FieldDefinition[]): SpaceTimeClusterPlan {
  const ast = parseClassicProgram(source);
  const statement = ast.body[0];
  if (ast.body.length !== 1 || statement?.type !== "EpiAiSpaceTimeClusterStatement") throw new RangeError("Select exactly one EPIAI CLUSTER SPACE_TIME command.");
  const id = resolvedField(fields, statement.idField.name, "identifier");
  const date = resolvedField(fields, statement.dateField.name, "event-date");
  const latitude = resolvedField(fields, statement.latitudeField.name, "latitude");
  const longitude = resolvedField(fields, statement.longitudeField.name, "longitude");
  if (new Set([id.name, date.name, latitude.name, longitude.name].map((name) => name.toLocaleLowerCase("en-US"))).size !== 4) throw new RangeError("ID, DATE, LATITUDE, and LONGITUDE must use different fields.");
  if (date.type !== "date") throw new RangeError(`${date.name} must be a Date field.`);
  if (latitude.type !== "number") throw new RangeError(`${latitude.name} must be a Number field.`);
  if (longitude.type !== "number") throw new RangeError(`${longitude.name} must be a Number field.`);
  if (["command-button", "multiline"].includes(id.type)) throw new RangeError(`${id.name} is not a supported record identifier field.`);
  const start = Date.parse(`${statement.studyStart}T00:00:00Z`);
  const end = Date.parse(`${statement.studyEnd}T00:00:00Z`);
  if (start > end) throw new RangeError("START must be on or before END.");
  if (statement.timeLength < 1 || statement.timeLength > 366) throw new RangeError("LENGTH must be an integer from 1 through 366.");
  if (!(statement.maxDistanceKm > 0 && statement.maxDistanceKm <= 20000)) throw new RangeError("MAXDISTANCEKM must be greater than 0 and no more than 20000.");
  if (!(statement.maxCaseFraction > 0 && statement.maxCaseFraction <= 0.5)) throw new RangeError("MAXCASEFRACTION must be greater than 0 and no more than 0.5.");
  if (statement.maxTimeUnits < 1 || statement.maxTimeUnits > 10000) throw new RangeError("MAXTIMEUNITS must be an integer from 1 through 10000.");
  if (!(statement.maxTimeFraction > 0 && statement.maxTimeFraction <= 0.5)) throw new RangeError("MAXTIMEFRACTION must be greater than 0 and no more than 0.5.");
  if (statement.replications < 99 || statement.replications > 99999) throw new RangeError("REPLICATIONS must be an integer from 99 through 99999.");
  if (statement.seed < 0 || statement.seed > 0xffffffff) throw new RangeError("SEED must be an unsigned 32-bit integer.");
  const input: SpaceTimeClusterCommandInput = {
    idField: id.name, dateField: date.name, latitudeField: latitude.name, longitudeField: longitude.name,
    resultName: statement.resultName.name,
    studyStart: statement.studyStart, studyEnd: statement.studyEnd, timeUnit: statement.timeUnit,
    timeLength: statement.timeLength, maxDistanceKm: statement.maxDistanceKm, maxCaseFraction: statement.maxCaseFraction,
    maxTimeUnits: statement.maxTimeUnits, maxTimeFraction: statement.maxTimeFraction,
    replications: statement.replications, seed: statement.seed,
  };
  return {
    version: SPACE_TIME_CLUSTER_PLAN_VERSION, analysis: "retrospective-space-time", model: "space-time-permutation",
    scan: "high", coordinateSystem: "WGS84", spatialShape: "circle", ...input,
    canonicalSource: buildSpaceTimeClusterCommand(input), execution: "candidate-preview",
  };
}
