export const CLASSIC_OUTPUT_SETTINGS_VERSION = "0.1.0" as const;

export interface ClassicOutputSettings {
  version: typeof CLASSIC_OUTPUT_SETTINGS_VERSION;
  outputPrefix: string;
  outputSequence: number;
  flagAgeDays: number;
  flagResultCount: number;
  flagSizeKb: number;
}

export const DEFAULT_CLASSIC_OUTPUT_SETTINGS: ClassicOutputSettings = {
  version: CLASSIC_OUTPUT_SETTINGS_VERSION,
  outputPrefix: "OUTPUT",
  outputSequence: 1,
  flagAgeDays: 20,
  flagResultCount: 100,
  flagSizeKb: 500,
};

const boundedInteger = (value: unknown, label: string, maximum: number): number => {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > maximum) {
    throw new RangeError(`${label} must be a whole number from 0 through ${maximum}.`);
  }
  return number;
};

export function validateClassicOutputSettings(input: Omit<ClassicOutputSettings, "version">): ClassicOutputSettings {
  const outputPrefix = input.outputPrefix.trim();
  if (!outputPrefix || outputPrefix.length > 64 || !/^[A-Za-z0-9_-]+$/.test(outputPrefix)) {
    throw new RangeError("Output File Prefix must contain 1-64 letters, numbers, underscores, or hyphens.");
  }
  return {
    version: CLASSIC_OUTPUT_SETTINGS_VERSION,
    outputPrefix,
    outputSequence: boundedInteger(input.outputSequence, "Output File Sequence", 999999),
    flagAgeDays: boundedInteger(input.flagAgeDays, "Age In Days", 36500),
    flagResultCount: boundedInteger(input.flagResultCount, "Number of Results", 100000),
    flagSizeKb: boundedInteger(input.flagSizeKb, "File Size", 1048576),
  };
}

export function parseClassicOutputSettings(value: string | null): ClassicOutputSettings {
  if (!value) return { ...DEFAULT_CLASSIC_OUTPUT_SETTINGS };
  try {
    const parsed = JSON.parse(value) as Partial<ClassicOutputSettings>;
    return validateClassicOutputSettings({
      outputPrefix: parsed.outputPrefix ?? DEFAULT_CLASSIC_OUTPUT_SETTINGS.outputPrefix,
      outputSequence: parsed.outputSequence ?? DEFAULT_CLASSIC_OUTPUT_SETTINGS.outputSequence,
      flagAgeDays: parsed.flagAgeDays ?? DEFAULT_CLASSIC_OUTPUT_SETTINGS.flagAgeDays,
      flagResultCount: parsed.flagResultCount ?? DEFAULT_CLASSIC_OUTPUT_SETTINGS.flagResultCount,
      flagSizeKb: parsed.flagSizeKb ?? DEFAULT_CLASSIC_OUTPUT_SETTINGS.flagSizeKb,
    });
  } catch {
    return { ...DEFAULT_CLASSIC_OUTPUT_SETTINGS };
  }
}
