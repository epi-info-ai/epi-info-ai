import type { EpiRecord, FieldDefinition } from "../contracts/core.ts";

export const CLASSIC_PROGRAM_PLAN_VERSION = "0.1.0" as const;

export interface NumericRecodeRange {
  lower: number | null;
  upper: number | null;
  label: string;
  line: number;
}

export interface NumericRecodeStep {
  kind: "numeric-recode";
  sourceField: string;
  targetField: string;
  ranges: NumericRecodeRange[];
  elseLabel?: string;
}

export interface ProgramFrequencyStep {
  kind: "frequency";
  field: string;
  stratifyBy?: string;
}

export interface BoundedClassicProgramPlan {
  version: typeof CLASSIC_PROGRAM_PLAN_VERSION;
  source: string;
  canonicalSource: string;
  recode: NumericRecodeStep;
  frequency: ProgramFrequencyStep;
}

export interface AppliedProgramData {
  records: EpiRecord[];
  derivedField: FieldDefinition;
}

export class ClassicProgramDiagnostic extends Error {
  readonly line: number;

  constructor(line: number, message: string) {
    super(`Line ${line}: ${message}`);
    this.name = "ClassicProgramDiagnostic";
    this.line = line;
  }
}

function resolveField(fields: readonly FieldDefinition[], requested: string, line: number): string {
  const resolved = fields.find((field) => field.name.toLocaleLowerCase("en-US") === requested.toLocaleLowerCase("en-US"));
  if (!resolved) throw new ClassicProgramDiagnostic(line, `${requested} is not a field in the current form.`);
  return resolved.name;
}

function commandField(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `[${name}]`;
}

function parseBound(token: string, side: "lower" | "upper", line: number): number | null {
  const normalized = token.toUpperCase();
  if (side === "lower" && normalized === "LOVALUE") return null;
  if (side === "upper" && normalized === "HIVALUE") return null;
  const value = Number(token);
  if (!Number.isFinite(value)) throw new ClassicProgramDiagnostic(line, `${token} is not a finite numeric range boundary.`);
  return value;
}

export function parseBoundedClassicProgram(source: string, fields: readonly FieldDefinition[]): BoundedClassicProgramPlan {
  const lines = source.replace(/\r\n?/g, "\n").split("\n")
    .map((text, index) => ({ text: text.trim(), line: index + 1 }))
    .filter(({ text }) => text.length > 0 && !text.startsWith("//"));
  if (!lines.length) throw new ClassicProgramDiagnostic(1, "Enter an Epi Info program.");
  let cursor = 0;
  const define = lines[cursor++];
  const defineMatch = define?.text.match(/^DEFINE\s+([A-Za-z_][A-Za-z0-9_]*)\s+TEXTINPUT$/i);
  if (!define || !defineMatch) throw new ClassicProgramDiagnostic(define?.line ?? 1, "This slice must begin with DEFINE <variable> TEXTINPUT.");
  const targetField = defineMatch[1]!;
  if (fields.some((field) => field.name.toLocaleLowerCase("en-US") === targetField.toLocaleLowerCase("en-US"))) {
    throw new ClassicProgramDiagnostic(define.line, `${targetField} already exists in the current form; V0.1 only creates a new derived variable.`);
  }

  const recode = lines[cursor++];
  const recodeMatch = recode?.text.match(/^RECODE\s+([A-Za-z_][A-Za-z0-9_]*)\s+TO\s+([A-Za-z_][A-Za-z0-9_]*)$/i);
  if (!recode || !recodeMatch) throw new ClassicProgramDiagnostic(recode?.line ?? define.line + 1, "DEFINE must be followed by RECODE <numeric field> TO <defined variable>.");
  const sourceField = resolveField(fields, recodeMatch[1]!, recode.line);
  const sourceDefinition = fields.find((field) => field.name === sourceField)!;
  if (sourceDefinition.type !== "number") throw new ClassicProgramDiagnostic(recode.line, `${sourceDefinition.prompt} must be a Number field for numeric RECODE.`);
  if (recodeMatch[2]!.toLocaleLowerCase("en-US") !== targetField.toLocaleLowerCase("en-US")) {
    throw new ClassicProgramDiagnostic(recode.line, `RECODE target must be the defined variable ${targetField}.`);
  }

  const ranges: NumericRecodeRange[] = [];
  let elseLabel: string | undefined;
  let foundEnd = false;
  while (cursor < lines.length) {
    const candidate = lines[cursor++]!;
    if (/^END$/i.test(candidate.text)) {
      foundEnd = true;
      break;
    }
    const elseMatch = candidate.text.match(/^ELSE\s*=\s*"([^"]*)"$/i);
    if (elseMatch) {
      if (elseLabel !== undefined) throw new ClassicProgramDiagnostic(candidate.line, "RECODE may contain only one ELSE clause.");
      elseLabel = elseMatch[1]!;
      continue;
    }
    const rangeMatch = candidate.text.match(/^(LOVALUE|[-+]?\d+(?:\.\d+)?)\s+-\s+(HIVALUE|[-+]?\d+(?:\.\d+)?)\s*=\s*"([^"]*)"$/i);
    if (!rangeMatch) throw new ClassicProgramDiagnostic(candidate.line, "Expected a numeric RECODE range, ELSE clause, or END.");
    if (ranges.length >= 12) throw new ClassicProgramDiagnostic(candidate.line, "V0.1 preserves the legacy limit of at most 12 RECODE ranges.");
    const lower = parseBound(rangeMatch[1]!, "lower", candidate.line);
    const upper = parseBound(rangeMatch[2]!, "upper", candidate.line);
    if (lower !== null && upper !== null && lower >= upper) throw new ClassicProgramDiagnostic(candidate.line, "A RECODE lower boundary must be less than its upper boundary.");
    const previous = ranges.at(-1);
    if (previous && previous.upper === null) throw new ClassicProgramDiagnostic(candidate.line, "No range may follow a HIVALUE range.");
    if (previous && lower === null) throw new ClassicProgramDiagnostic(candidate.line, "LOVALUE is allowed only in the first range.");
    if (previous && previous.upper !== null && lower !== null && lower < previous.upper) {
      throw new ClassicProgramDiagnostic(candidate.line, "Overlapping RECODE ranges are not supported in V0.1.");
    }
    ranges.push({ lower, upper, label: rangeMatch[3]!, line: candidate.line });
  }
  if (!foundEnd) throw new ClassicProgramDiagnostic(lines.at(-1)?.line ?? recode.line, "RECODE is missing END.");
  if (!ranges.length && elseLabel === undefined) throw new ClassicProgramDiagnostic(recode.line, "RECODE needs at least one range or ELSE clause.");

  const frequencyLine = lines[cursor++];
  const frequencyMatch = frequencyLine?.text.match(/^FREQ\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s+STRATAVAR\s*=\s*([A-Za-z_][A-Za-z0-9_]*))?$/i);
  if (!frequencyLine || !frequencyMatch) throw new ClassicProgramDiagnostic(frequencyLine?.line ?? (lines.at(-1)?.line ?? 0) + 1, "RECODE must be followed by FREQ <variable> with an optional STRATAVAR.");
  if (frequencyMatch[1]!.toLocaleLowerCase("en-US") !== targetField.toLocaleLowerCase("en-US")) {
    throw new ClassicProgramDiagnostic(frequencyLine.line, `V0.1 FREQ must analyze the derived variable ${targetField}.`);
  }
  const stratifyBy = frequencyMatch[2] ? resolveField(fields, frequencyMatch[2], frequencyLine.line) : undefined;
  if (cursor < lines.length) {
    const unsupported = lines[cursor]!;
    throw new ClassicProgramDiagnostic(unsupported.line, `Unsupported command: ${unsupported.text}`);
  }

  const canonicalLines = [
    `DEFINE ${commandField(targetField)} TEXTINPUT`,
    `RECODE ${commandField(sourceField)} TO ${commandField(targetField)}`,
    ...ranges.map((range) => `  ${range.lower === null ? "LOVALUE" : range.lower} - ${range.upper === null ? "HIVALUE" : range.upper} = ${JSON.stringify(range.label)}`),
    ...(elseLabel === undefined ? [] : [`  ELSE = ${JSON.stringify(elseLabel)}`]),
    "END",
    `FREQ ${commandField(targetField)}${stratifyBy ? ` STRATAVAR=${commandField(stratifyBy)}` : ""}`,
  ];
  return {
    version: CLASSIC_PROGRAM_PLAN_VERSION,
    source,
    canonicalSource: canonicalLines.join("\n"),
    recode: { kind: "numeric-recode", sourceField, targetField, ranges, ...(elseLabel === undefined ? {} : { elseLabel }) },
    frequency: { kind: "frequency", field: targetField, ...(stratifyBy ? { stratifyBy } : {}) },
  };
}

export function applyBoundedClassicProgram(records: readonly EpiRecord[], plan: BoundedClassicProgramPlan): AppliedProgramData {
  const derivedField: FieldDefinition = { name: plan.recode.targetField, prompt: plan.recode.targetField, type: "text", required: false };
  const output = records.map((record) => {
    const raw = record[plan.recode.sourceField];
    const numeric = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : Number.NaN;
    let derived: string | null = null;
    if (Number.isFinite(numeric)) {
      const matched = plan.recode.ranges.find((range) =>
        (range.lower === null || numeric > range.lower) && (range.upper === null || numeric <= range.upper));
      derived = matched?.label ?? plan.recode.elseLabel ?? null;
    } else if (plan.recode.elseLabel !== undefined) derived = plan.recode.elseLabel;
    return { ...record, [plan.recode.targetField]: derived };
  });
  return { records: output, derivedField };
}
