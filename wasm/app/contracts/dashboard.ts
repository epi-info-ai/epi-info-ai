import type { EpiRecord } from "./core.js";

export type EpiCurveInterval = "hour" | "day" | "month" | "year";

export interface EpiCurveRequest {
  dateField: string;
  datePrompt: string;
  caseStatusField?: string;
  caseStatusPrompt?: string;
  interval: EpiCurveInterval;
  step: number;
  start?: string;
  end?: string;
  includeMissing: boolean;
}

export interface EpiCurveBin {
  key: string;
  label: string;
  start: string;
  endExclusive: string;
  total: number;
  counts: Record<string, number>;
}

export interface EpiCurveResult {
  version: "dashboard.epicurve/0.1";
  request: EpiCurveRequest;
  categories: string[];
  bins: EpiCurveBin[];
  totals: {
    sourceRecords: number;
    includedRecords: number;
    excludedMissingDate: number;
    excludedInvalidDate: number;
    excludedOutsideRange: number;
    excludedMissingCaseStatus: number;
  };
  diagnostics: { warnings: string[] };
}

export interface EpiCurveSource {
  records: readonly EpiRecord[];
}
