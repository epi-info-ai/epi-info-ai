import type { EpiRecord, FieldDefinition } from "../contracts/core.ts";
import { CLASSIC_AST_VERSION, parseClassicProgram, type ClassicExpression } from "./classic-ast.ts";

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
  astVersion: typeof CLASSIC_AST_VERSION;
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

function numericBoundary(expression: ClassicExpression, side: "lower" | "upper", line: number): number | null {
  if (expression.type === "IdentifierExpression") {
    const normalized = expression.name.toUpperCase();
    if (side === "lower" && normalized === "LOVALUE") return null;
    if (side === "upper" && normalized === "HIVALUE") return null;
  }
  if (expression.type === "Literal" && expression.valueType === "number") return expression.value as number;
  if (expression.type === "UnaryExpression" && (expression.operator === "+" || expression.operator === "-")
      && expression.argument.type === "Literal" && expression.argument.valueType === "number") {
    const value = expression.argument.value as number;
    return expression.operator === "-" ? -value : value;
  }
  throw new ClassicProgramDiagnostic(line, "RECODE range boundaries must be finite numbers, LOVALUE, or HIVALUE.");
}

function stringResult(expression: ClassicExpression, line: number): string {
  if (expression.type === "Literal" && expression.valueType === "string") return expression.value as string;
  throw new ClassicProgramDiagnostic(line, "This V0.1 RECODE executor requires quoted text results.");
}

export function parseBoundedClassicProgram(source: string, fields: readonly FieldDefinition[]): BoundedClassicProgramPlan {
  const ast = parseClassicProgram(source);
  const define = ast.body[0];
  if (define?.type !== "DefineStatement" || define.variableType !== "TEXTINPUT" || define.scope !== "STANDARD" || define.initializer) {
    throw new ClassicProgramDiagnostic(define?.span.start.line ?? 1, "This slice must begin with DEFINE <variable> TEXTINPUT.");
  }
  const targetField = define.variable.name;
  if (fields.some((field) => field.name.toLocaleLowerCase("en-US") === targetField.toLocaleLowerCase("en-US"))) {
    throw new ClassicProgramDiagnostic(define.span.start.line, `${targetField} already exists in the current form; V0.1 only creates a new derived variable.`);
  }

  const recode = ast.body[1];
  if (recode?.type !== "RecodeStatement") {
    throw new ClassicProgramDiagnostic(recode?.span.start.line ?? define.span.end.line + 1, "DEFINE must be followed by RECODE <numeric field> TO <defined variable>.");
  }
  const sourceField = resolveField(fields, recode.source.name, recode.span.start.line);
  const sourceDefinition = fields.find((field) => field.name === sourceField)!;
  if (sourceDefinition.type !== "number") throw new ClassicProgramDiagnostic(recode.span.start.line, `${sourceDefinition.prompt} must be a Number field for numeric RECODE.`);
  if (recode.target.name.toLocaleLowerCase("en-US") !== targetField.toLocaleLowerCase("en-US")) {
    throw new ClassicProgramDiagnostic(recode.span.start.line, `RECODE target must be the defined variable ${targetField}.`);
  }

  const ranges: NumericRecodeRange[] = [];
  let elseLabel: string | undefined;
  for (const clause of recode.clauses) {
    const line = clause.span.start.line;
    if (clause.type === "RecodeElseClause") {
      if (elseLabel !== undefined) throw new ClassicProgramDiagnostic(line, "RECODE may contain only one ELSE clause.");
      elseLabel = stringResult(clause.result, line);
      continue;
    }
    if (!clause.to) throw new ClassicProgramDiagnostic(line, "This V0.1 executor requires numeric RECODE ranges.");
    if (ranges.length >= 12) throw new ClassicProgramDiagnostic(line, "V0.1 preserves the legacy limit of at most 12 RECODE ranges.");
    const lower = numericBoundary(clause.from, "lower", line);
    const upper = numericBoundary(clause.to, "upper", line);
    if (lower !== null && upper !== null && lower >= upper) throw new ClassicProgramDiagnostic(line, "A RECODE lower boundary must be less than its upper boundary.");
    const previous = ranges.at(-1);
    if (previous && previous.upper === null) throw new ClassicProgramDiagnostic(line, "No range may follow a HIVALUE range.");
    if (previous && lower === null) throw new ClassicProgramDiagnostic(line, "LOVALUE is allowed only in the first range.");
    if (previous && previous.upper !== null && lower !== null && lower < previous.upper) {
      throw new ClassicProgramDiagnostic(line, "Overlapping RECODE ranges are not supported in V0.1.");
    }
    ranges.push({ lower, upper, label: stringResult(clause.result, line), line });
  }
  if (!ranges.length && elseLabel === undefined) throw new ClassicProgramDiagnostic(recode.span.start.line, "RECODE needs at least one range or ELSE clause.");

  const frequency = ast.body[2];
  if (frequency?.type !== "FrequencyStatement" || frequency.selection.kind !== "fields" || frequency.selection.fields.length !== 1
      || frequency.options.stratifyBy.length > 1 || frequency.options.weightBy || frequency.options.outputTable
      || frequency.options.psuVariable || frequency.options.statistics || frequency.options.columnSize
      || frequency.options.noWrap || frequency.options.oneIsYes) {
    throw new ClassicProgramDiagnostic(frequency?.span.start.line ?? recode.span.end.line + 1, "RECODE must be followed by FREQ <variable> with an optional STRATAVAR.");
  }
  if (frequency.selection.fields[0]!.name.toLocaleLowerCase("en-US") !== targetField.toLocaleLowerCase("en-US")) {
    throw new ClassicProgramDiagnostic(frequency.span.start.line, `V0.1 FREQ must analyze the derived variable ${targetField}.`);
  }
  const stratifyBy = frequency.options.stratifyBy[0]
    ? resolveField(fields, frequency.options.stratifyBy[0].name, frequency.span.start.line) : undefined;
  if (ast.body.length > 3) {
    const unsupported = ast.body[3]!;
    throw new ClassicProgramDiagnostic(unsupported.span.start.line, `Unsupported command in the V0.1 executor: ${unsupported.type}`);
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
    astVersion: CLASSIC_AST_VERSION,
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
