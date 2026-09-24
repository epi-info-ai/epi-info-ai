import type { CheckCodeFunctionName } from "./check-code-program.js";

export type LegacyCheckCodeFunctionStatus =
  | "executable-candidate"
  | "next-deterministic"
  | "context-adaptation"
  | "governed-nondeterministic"
  | "governed-scientific"
  | "governed-device"
  | "excluded-desktop-authority"
  | "retained-source-stub";

export interface LegacyCheckCodeFunctionInventoryEntry {
  name: string;
  status: LegacyCheckCodeFunctionStatus;
  disposition: string;
}

const executable = (name: CheckCodeFunctionName): LegacyCheckCodeFunctionInventoryEntry => ({
  name,
  status: "executable-candidate",
  disposition: "Typed parser, whole-program validation, bounded runtime, and automated fixtures are present; differential parity remains open.",
});

export const LEGACY_CHECK_CODE_FUNCTION_INVENTORY: readonly LegacyCheckCodeFunctionInventoryEntry[] = [
  ...([
    "ABS", "COS", "DAY", "DAYS", "EPIWEEK", "EXP", "FINDTEXT", "HOUR", "HOURS", "LN", "LOG", "MINUTE", "MINUTES", "MONTH",
    "MONTHS", "NUMTODATE", "NUMTOTIME", "ROUND", "SECOND", "SECONDS", "SIN", "SQRT", "STEP", "STRLEN", "SUBSTRING", "TAN",
    "TRUNC", "TXTTODATE", "TXTTONUM", "UPPERCASE", "YEAR", "YEARS", "FORMAT", "LINEBREAK", "RECORDCOUNT", "ISUNIQUE", "CURRENTUSER", "SYSALTITUDE", "SYSLATITUDE", "SYSLONGITUDE", "SYSTEMDATE", "SYSTEMTIME", "RND", "PFROMZ", "ZSCORE",
  ] satisfies readonly CheckCodeFunctionName[]).map(executable),
  { name: "SYSBARCODE", status: "governed-device", disposition: "Shelved new branch: the retained rule always returns null; a useful scanner requires explicit camera/scanner permission, supported-format policy, manual fallback, provenance, and validation." },
  { name: "ENVIRON", status: "excluded-desktop-authority", disposition: "Direct process-environment inspection is outside the browser security boundary." },
  { name: "EXISTS", status: "excluded-desktop-authority", disposition: "Ambient filesystem existence tests are excluded; project assets and explicit file grants use typed contracts." },
  { name: "FILEDATE", status: "excluded-desktop-authority", disposition: "Ambient filesystem metadata access is excluded; imported asset metadata uses typed provenance." },
  { name: "GETCOORDINATES", status: "retained-source-stub", disposition: "The inspected desktop rule returns the absolute value of its first numeric argument and does not acquire coordinates; do not claim parity from this placeholder." },
  { name: "SENDSMS", status: "retained-source-stub", disposition: "The inspected desktop rule returns the absolute value of its first numeric argument and does not send a message; any messaging feature needs a new governed branch." },
] as const;
