import type { FieldDefinition } from "../contracts/core.ts";
import { parseClassicProgram, type EpiAiRecordLinkFieldPair } from "./classic-ast.ts";

export const RECORDLINK_PLAN_VERSION = "0.2.0" as const;

export interface RecordLinkFieldPair {
  sourceA: string;
  sourceB: string;
}

export interface RecordLinkSourceDefinition {
  id: string;
  fields: readonly FieldDefinition[];
}

export interface RecordLinkCommandInput {
  sourceA: string;
  sourceB: string;
  idA: string;
  idB: string;
  truthSource?: string;
  truthIdA?: string;
  truthIdB?: string;
  blockPairs: readonly RecordLinkFieldPair[];
  exactPairs: readonly RecordLinkFieldPair[];
  fuzzyPairs: readonly RecordLinkFieldPair[];
  fuzzyThreshold: number;
  reviewThreshold: number;
  matchThreshold: number;
  maxCandidates: number;
  resultName: string;
}

export interface RecordLinkPlan extends RecordLinkCommandInput {
  version: typeof RECORDLINK_PLAN_VERSION;
  mode: "two-source-cross-file";
  comparison: "deterministic-exact-and-jaro-winkler";
  execution: "candidate-diagnostics-only";
  canonicalSource: string;
  provenance: {
    upstream: "jkariuki7/pt_matching_app";
    reviewedCommit: "9be01cba65572a374f788242a635f3e57df44f25";
    license: "Apache-2.0";
  };
}

const identifierToken = (value: string): string => {
  const trimmed = value.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) throw new RangeError("RECORDLINK identifiers must begin with a letter or underscore and contain only letters, numbers, and underscores.");
  return trimmed;
};
const pairToken = (pair: RecordLinkFieldPair): string => `${identifierToken(pair.sourceA)}:${identifierToken(pair.sourceB)}`;
const numberToken = (value: number): string => String(Number(value));

export function buildRecordLinkCommand(input: RecordLinkCommandInput): string {
  if (!input.blockPairs.length || !input.exactPairs.length || !input.fuzzyPairs.length) throw new RangeError("RECORDLINK requires at least one BLOCK, EXACT, and FUZZY field pair in V0.1.");
  return [
    "EPIAI RECORDLINK",
    `SOURCEA=${identifierToken(input.sourceA)}`, `SOURCEB=${identifierToken(input.sourceB)}`,
    `IDA=${identifierToken(input.idA)}`, `IDB=${identifierToken(input.idB)}`,
    ...(input.truthSource && input.truthIdA && input.truthIdB
      ? [`TRUTH=${identifierToken(input.truthSource)}`, `TRUTHA=${identifierToken(input.truthIdA)}`, `TRUTHB=${identifierToken(input.truthIdB)}`]
      : []),
    `BLOCK=${input.blockPairs.map(pairToken).join(",")}`,
    `EXACT=${input.exactPairs.map(pairToken).join(",")}`,
    `FUZZY=${input.fuzzyPairs.map(pairToken).join(",")}`,
    `FUZZYTHRESHOLD=${numberToken(input.fuzzyThreshold)}`,
    `REVIEWTHRESHOLD=${numberToken(input.reviewThreshold)}`,
    `MATCHTHRESHOLD=${numberToken(input.matchThreshold)}`,
    `MAXCANDIDATES=${numberToken(input.maxCandidates)}`,
    `RESULT=${identifierToken(input.resultName)}`,
  ].join(" ");
}

function resolveSource(sources: readonly RecordLinkSourceDefinition[], requested: string, role: string): RecordLinkSourceDefinition {
  const matches = sources.filter(({ id }) => id.toLocaleLowerCase("en-US") === requested.toLocaleLowerCase("en-US"));
  if (matches.length !== 1) throw new RangeError(`${requested} is not an unambiguous ${role} source in the current project.`);
  return matches[0]!;
}

function resolveField(source: RecordLinkSourceDefinition, requested: string, role: string): FieldDefinition {
  const matches = source.fields.filter(({ name }) => name.toLocaleLowerCase("en-US") === requested.toLocaleLowerCase("en-US"));
  if (matches.length !== 1) throw new RangeError(`${requested} is not an unambiguous ${role} field in ${source.id}.`);
  if (matches[0]!.type === "command-button") throw new RangeError(`${requested} cannot be used as a ${role} field.`);
  return matches[0]!;
}

const typeFamily = (field: FieldDefinition): "text" | "number" | "date" | "time" | "boolean" => {
  if (["text", "text-uppercase", "multiline", "unique-id", "phone", "option"].includes(field.type)) return "text";
  if (field.type === "number") return "number";
  if (field.type === "date") return "date";
  if (field.type === "time") return "time";
  return "boolean";
};

function resolvePairs(
  pairs: readonly EpiAiRecordLinkFieldPair[],
  sourceA: RecordLinkSourceDefinition,
  sourceB: RecordLinkSourceDefinition,
  role: "blocking" | "exact comparison" | "fuzzy comparison",
): RecordLinkFieldPair[] {
  const resolved = pairs.map((pair) => {
    const fieldA = resolveField(sourceA, pair.sourceA.name, role);
    const fieldB = resolveField(sourceB, pair.sourceB.name, role);
    if (role === "fuzzy comparison") {
      if (typeFamily(fieldA) !== "text" || typeFamily(fieldB) !== "text") throw new RangeError(`${fieldA.name}:${fieldB.name} must pair text-compatible fields for FUZZY comparison.`);
    } else if (typeFamily(fieldA) !== typeFamily(fieldB)) {
      throw new RangeError(`${fieldA.name}:${fieldB.name} must use compatible field types for ${role}.`);
    }
    return { sourceA: fieldA.name, sourceB: fieldB.name };
  });
  const keys = resolved.map((pair) => `${pair.sourceA.toLocaleLowerCase("en-US")}:${pair.sourceB.toLocaleLowerCase("en-US")}`);
  if (new Set(keys).size !== keys.length) throw new RangeError(`RECORDLINK repeats a ${role} field pair.`);
  return resolved;
}

export function resolveRecordLinkCommand(source: string, sources: readonly RecordLinkSourceDefinition[]): RecordLinkPlan {
  const ast = parseClassicProgram(source);
  const statement = ast.body[0];
  if (ast.body.length !== 1 || statement?.type !== "EpiAiRecordLinkStatement") throw new RangeError("Select exactly one EPIAI RECORDLINK command.");
  const sourceA = resolveSource(sources, statement.sourceA.name, "SOURCEA");
  const sourceB = resolveSource(sources, statement.sourceB.name, "SOURCEB");
  if (sourceA === sourceB) throw new RangeError("SOURCEA and SOURCEB must be different project sources.");
  const idA = resolveField(sourceA, statement.idA.name, "IDA");
  const idB = resolveField(sourceB, statement.idB.name, "IDB");
  let truth: { source: RecordLinkSourceDefinition; idA: FieldDefinition; idB: FieldDefinition } | undefined;
  if (statement.truthSource && statement.truthIdA && statement.truthIdB) {
    const truthSource = resolveSource(sources, statement.truthSource.name, "TRUTH");
    if (truthSource === sourceA || truthSource === sourceB) throw new RangeError("TRUTH must be a separate project source.");
    truth = {
      source: truthSource,
      idA: resolveField(truthSource, statement.truthIdA.name, "TRUTHA"),
      idB: resolveField(truthSource, statement.truthIdB.name, "TRUTHB"),
    };
  }
  const blockPairs = resolvePairs(statement.blockPairs, sourceA, sourceB, "blocking");
  const exactPairs = resolvePairs(statement.exactPairs, sourceA, sourceB, "exact comparison");
  const fuzzyPairs = resolvePairs(statement.fuzzyPairs, sourceA, sourceB, "fuzzy comparison");
  const comparisonKeys = [...exactPairs, ...fuzzyPairs].map((pair) => `${pair.sourceA.toLocaleLowerCase("en-US")}:${pair.sourceB.toLocaleLowerCase("en-US")}`);
  if (new Set(comparisonKeys).size !== comparisonKeys.length) throw new RangeError("A field pair cannot appear in both EXACT and FUZZY comparisons.");
  if (!(statement.fuzzyThreshold > 0 && statement.fuzzyThreshold <= 1)) throw new RangeError("FUZZYTHRESHOLD must be greater than 0 and no more than 1.");
  const maximumScore = exactPairs.length + fuzzyPairs.length;
  if (!(statement.reviewThreshold >= 0 && statement.reviewThreshold < statement.matchThreshold)) throw new RangeError("REVIEWTHRESHOLD must be nonnegative and lower than MATCHTHRESHOLD.");
  if (!(statement.matchThreshold > 0 && statement.matchThreshold <= maximumScore)) throw new RangeError(`MATCHTHRESHOLD must be greater than 0 and no more than the ${maximumScore}-point comparison maximum.`);
  if (statement.maxCandidates < 1 || statement.maxCandidates > 1_000_000) throw new RangeError("MAXCANDIDATES must be an integer from 1 through 1000000.");
  const input: RecordLinkCommandInput = {
    sourceA: sourceA.id, sourceB: sourceB.id, idA: idA.name, idB: idB.name,
    ...(truth ? { truthSource: truth.source.id, truthIdA: truth.idA.name, truthIdB: truth.idB.name } : {}),
    blockPairs, exactPairs, fuzzyPairs, fuzzyThreshold: statement.fuzzyThreshold,
    reviewThreshold: statement.reviewThreshold, matchThreshold: statement.matchThreshold,
    maxCandidates: statement.maxCandidates, resultName: statement.resultName.name,
  };
  return {
    version: RECORDLINK_PLAN_VERSION, mode: "two-source-cross-file",
    comparison: "deterministic-exact-and-jaro-winkler", execution: "candidate-diagnostics-only",
    ...input, canonicalSource: buildRecordLinkCommand(input),
    provenance: {
      upstream: "jkariuki7/pt_matching_app",
      reviewedCommit: "9be01cba65572a374f788242a635f3e57df44f25",
      license: "Apache-2.0",
    },
  };
}
