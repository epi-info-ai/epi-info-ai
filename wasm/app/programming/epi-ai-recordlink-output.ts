import type { EpiRecord, FieldDefinition, RecordValue } from "../contracts/core.ts";
import type { RecordLinkPlan, RecordLinkFieldPair } from "./epi-ai-recordlink.ts";
import type { RecordLinkDataSource } from "./epi-ai-recordlink-analysis.ts";
import type { RecordLinkPersonClusterResult } from "./epi-ai-recordlink-cluster.ts";

export const RECORDLINK_PERSON_OUTPUT_VERSION = "0.1.0" as const;
export type RecordLinkOutputPolicy = "prefer-source-a-fill-source-b";

export interface RecordLinkOutputFieldMapping extends RecordLinkFieldPair {
  outputField: string;
  role: "blocking" | "exact" | "fuzzy";
  type: FieldDefinition["type"];
}

export interface RecordLinkOutputProvenanceRow {
  personId: string;
  outputField: string;
  selectedSourceRole: "sourceA" | "sourceB" | null;
  selectedSourceField: string | null;
  fallbackUsed: boolean;
  disagreement: boolean;
}

export interface RecordLinkPersonOutput {
  version: typeof RECORDLINK_PERSON_OUTPUT_VERSION;
  resultName: string;
  policy: RecordLinkOutputPolicy;
  fields: RecordLinkOutputFieldMapping[];
  records: EpiRecord[];
  provenance: RecordLinkOutputProvenanceRow[];
  totals: { people: number; linkedPeople: number; singletonPeople: number; fieldDisagreements: number; fallbackValues: number };
  governance: {
    newDatasetOnly: true;
    sourceIdentifiersExcluded: true;
    unmappedFieldsExcluded: true;
    containsRecordValues: true;
    sourceMutationExecuted: false;
    mergeExecuted: false;
  };
}

const personId = (personNumber: number): string => `P${String(personNumber).padStart(6, "0")}`;
const missing = (value: RecordValue | undefined): boolean => value === null || value === undefined || String(value).trim() === "";
const comparable = (value: RecordValue | undefined): string | null => missing(value) ? null : String(value).normalize("NFKC").trim().toLocaleLowerCase("en-US");

function sourceByName(sources: readonly RecordLinkDataSource[], name: string): RecordLinkDataSource {
  const matches = sources.filter(({ id }) => id.toLocaleLowerCase("en-US") === name.toLocaleLowerCase("en-US"));
  if (matches.length !== 1) throw new RangeError(`${name} is not an unambiguous RECORDLINK output source.`);
  return matches[0]!;
}

function fieldByName(source: RecordLinkDataSource, name: string): FieldDefinition {
  const matches = source.fields.filter(({ name: fieldName }) => fieldName.toLocaleLowerCase("en-US") === name.toLocaleLowerCase("en-US"));
  if (matches.length !== 1) throw new RangeError(`${name} is not an unambiguous field in ${source.id}.`);
  return matches[0]!;
}

function outputMappings(plan: RecordLinkPlan, sourceA: RecordLinkDataSource): RecordLinkOutputFieldMapping[] {
  const ordered: { role: RecordLinkOutputFieldMapping["role"]; pair: RecordLinkFieldPair }[] = [
    ...plan.blockPairs.map((pair) => ({ role: "blocking" as const, pair })),
    ...plan.exactPairs.map((pair) => ({ role: "exact" as const, pair })),
    ...plan.fuzzyPairs.map((pair) => ({ role: "fuzzy" as const, pair })),
  ];
  const seen = new Set<string>();
  return ordered.flatMap(({ role, pair }) => {
    const key = pair.sourceA.toLocaleLowerCase("en-US");
    if (seen.has(key)) throw new RangeError(`${pair.sourceA} is mapped more than once in the RECORDLINK output plan.`);
    seen.add(key);
    return [{ ...pair, outputField: pair.sourceA, role, type: fieldByName(sourceA, pair.sourceA).type }];
  });
}

export function createRecordLinkPersonOutput(
  plan: RecordLinkPlan,
  sources: readonly RecordLinkDataSource[],
  clusters: RecordLinkPersonClusterResult,
  policy: RecordLinkOutputPolicy = "prefer-source-a-fill-source-b",
): RecordLinkPersonOutput {
  if (policy !== "prefer-source-a-fill-source-b") throw new RangeError("Choose a supported RECORDLINK person-output policy.");
  if (clusters.resultName !== plan.resultName) throw new RangeError("The RECORDLINK cluster proposal does not match the active output plan.");
  const sourceA = sourceByName(sources, plan.sourceA);
  const sourceB = sourceByName(sources, plan.sourceB);
  if (clusters.sourceRecords.sourceA !== sourceA.records.length || clusters.sourceRecords.sourceB !== sourceB.records.length) throw new RangeError("The RECORDLINK cluster proposal does not match the active source counts.");
  const fields = outputMappings(plan, sourceA);
  const provenance: RecordLinkOutputProvenanceRow[] = [];
  const records = clusters.clusters.map<EpiRecord>((cluster) => {
    const memberA = cluster.members.find(({ source }) => source === "sourceA");
    const memberB = cluster.members.find(({ source }) => source === "sourceB");
    const recordA = memberA ? sourceA.records[memberA.recordIndex] : undefined;
    const recordB = memberB ? sourceB.records[memberB.recordIndex] : undefined;
    if (memberA && !recordA || memberB && !recordB) throw new RangeError(`Person ${cluster.personNumber} references a source record that is no longer available.`);
    const output: EpiRecord = { person_id: personId(cluster.personNumber), source_count: cluster.members.length };
    for (const mapping of fields) {
      const valueA = recordA?.[mapping.sourceA];
      const valueB = recordB?.[mapping.sourceB];
      const chooseA = !missing(valueA);
      const chooseB = !chooseA && !missing(valueB);
      const selectedValue = chooseA ? valueA : chooseB ? valueB : null;
      output[mapping.outputField] = selectedValue ?? null;
      const normalizedA = comparable(valueA);
      const normalizedB = comparable(valueB);
      provenance.push({
        personId: personId(cluster.personNumber),
        outputField: mapping.outputField,
        selectedSourceRole: chooseA ? "sourceA" : chooseB ? "sourceB" : null,
        selectedSourceField: chooseA ? mapping.sourceA : chooseB ? mapping.sourceB : null,
        fallbackUsed: chooseB,
        disagreement: normalizedA !== null && normalizedB !== null && normalizedA !== normalizedB,
      });
    }
    return output;
  });
  return {
    version: RECORDLINK_PERSON_OUTPUT_VERSION,
    resultName: `${plan.resultName}_Persons`,
    policy,
    fields,
    records,
    provenance,
    totals: {
      people: records.length,
      linkedPeople: clusters.linkedClusters,
      singletonPeople: clusters.singletonClusters,
      fieldDisagreements: provenance.filter(({ disagreement }) => disagreement).length,
      fallbackValues: provenance.filter(({ fallbackUsed }) => fallbackUsed).length,
    },
    governance: {
      newDatasetOnly: true,
      sourceIdentifiersExcluded: true,
      unmappedFieldsExcluded: true,
      containsRecordValues: true,
      sourceMutationExecuted: false,
      mergeExecuted: false,
    },
  };
}

const csvCell = (value: RecordValue | undefined): string => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function serializeRecordLinkPersonOutputCsv(output: RecordLinkPersonOutput): string {
  const headers = ["person_id", "source_count", ...output.fields.map(({ outputField }) => outputField)];
  return `${[headers.join(","), ...output.records.map((record) => headers.map((header) => csvCell(record[header])).join(","))].join("\r\n")}\r\n`;
}
