# RECORDLINK end-to-end demo and validation plan

## Purpose

Demonstrate a complete patient-record-linkage workflow without real patient
data, while retaining known truth links so every matching result can be scored.
`EPIAI RECORDLINK` is an Epi Info AI new branch; it is not the legacy matched-analysis
`MATCH` command.

## Upstream design input

The authorized `jkariuki7/pt_matching_app` checkout was reviewed through commit
`9be01cba65572a374f788242a635f3e57df44f25`. The preceding implementation
revision contains:

- two small differently shaped patient files and a corresponding true-link
  file under `tests/fixtures/`;
- a full mapping, harmonization, preprocessing, blocking, comparison,
  classification, evaluation, clerical-review, deduplication, and export
  workflow; and
- requirements for a larger synthetic generator. Those requirements preserve
  base, exact-duplicate, realistic-duplicate, full-truth, and evaluation-truth
  outputs and expose record count, duplicate rate, evaluation fraction, random
  seed, basename, scenario, and destination.

The generator implementation itself was not found in the reviewed revision;
its requirements and the small truth-labeled fixture are present. Confirm the
notebook location/revision with the upstream owner before porting it. Commit
`9be01cb` reconciles the prior metadata conflict: both the root `LICENSE` and
`pyproject.toml` now declare Apache-2.0, compatible with Epi Info AI. Retain
commit-level provenance and attribution for any imported artifacts.

The first checked-in Epi Info AI bundle is independently authored under
`wasm/demo/examples/recordlink`. It contains no copied upstream code or fixture
rows and records that fact in its generation manifest.

## Synthetic teaching package

The first Epi Info AI package should be deterministic and contain no real
patient information:

| Artifact | Purpose |
|---|---|
| `patient-registry-a.csv` | Source A with canonical or near-canonical values |
| `surveillance-b.csv` | Source B with different column names and controlled errors |
| `true-links.csv` | Complete normalized pairs, `rec_id_1,rec_id_2` |
| `generation-manifest.json` | Generator version, seed, configuration, schema, counts, hashes, and error recipe |
| `recordlink-command-tour.pgm7` | Visible Epi Info AI workflow using the two sources |
| `expected-recordlink-results.json` | Candidate, classification, review, cluster, and final metric anchors |

Generate both linked and unlinked people. Controlled perturbations should
include punctuation/case/spacing, nickname or transliteration variants, missing
middle names, address abbreviations, transposed characters, plausible date
errors, source-specific identifiers, and conflicting fields. Exact duplicates
must remain a distinct scenario from realistic near matches. Impossible or
internally inconsistent dates and deliberately ambiguous households should be
explicitly labeled.

## Demo path

1. Load the two synthetic sources into one browser project without combining
   them silently.
2. Preview and confirm source-to-standard field mappings.
3. Run `EPIAI QUALITY` on each source and disclose missingness and invalid
   fields before matching.
4. Run `EPIAI RECORDLINK` with a visible configuration: blocking fields, comparison
   methods, thresholds, candidate cap, and random/generator provenance.
5. Show candidate reduction and candidate recall against the full truth set.
6. Inspect an explainable pair: original values, normalized values, per-field
   comparisons, total score, rule/model version, and classification.
7. Make at least one clerical match/non-match/uncertain decision and write it
   to common command history without exposing hidden patient values there.
8. Build conflict-aware person clusters and show rejected/conflicting edges.
9. Produce deduplicated person and source-record audit outputs.
10. Feed only the reviewed output to `MERGE`, then run a familiar descriptive
    command to demonstrate that linkage serves the broader analysis workflow.
11. Export the run manifest and aggregate validation report.

Nothing executes merely because a program or package is opened. Source files
remain unchanged, and generation, linkage, review, deduplication, and merge are
separate auditable actions.

## Acceptance evidence

At minimum, automated tests must verify:

- identical seed and configuration produce byte-identical generated tables and
  manifest hashes;
- generated identifiers are unique within a source and every truth pair names
  two existing records from the intended sources;
- requested duplicate/error rates and scenario counts reconcile;
- blocking reports candidate count, reduction ratio, and candidate recall;
- classification reports precision, recall, F1, false links, and missed links
  against both complete truth and a declared evaluation sample;
- clerical decisions are replayable and override automation only through an
  explicit rule;
- clustering is deterministic, prevents prohibited same-source conflicts when
  configured, and records rejected edges;
- final person-level and record-audit outputs reconcile to all source rows;
- no patient values appear in aggregate history, telemetry, or validation
  reports; and
- a JupyterLite notebook independently reconstructs the core metrics from the
  synthetic files and exported results.

## Bounded implementation slices

V0.1 defined the typed `EPIAI RECORDLINK` AST and resolver plus two CSV sources,
exact and realistic-duplicate scenarios, a candidate cap, complete truth links,
canonical source, and pinned upstream/license provenance.

V0.2 implements deterministic cross-source blocking. It validates unique source
identifiers, normalizes nonmissing blocking values, enforces the candidate cap
after every progressive blocking rule, and reports candidate count, pair-space
reduction, per-rule counts, and optional recall against an explicitly named
truth form. Candidate identities stay in memory and are omitted from Output and
history. Comparison, classification, manual review, clustering, and merge still
do not execute.

V0.3 implements deterministic candidate comparison. Exact nonmissing equality
contributes one point. Text pairs use Unicode-normalized, case-folded,
punctuation/whitespace-normalized Jaro-Winkler similarity; a similarity meeting
`FUZZYTHRESHOLD` contributes one point. Output reports the score distribution
and every numerical field contribution under session-only candidate ordinals.
Identifiers, normalized strings, and patient values remain absent from Output
and history. This slice does not interpret `REVIEWTHRESHOLD` or
`MATCHTHRESHOLD` as classifications and cannot review, cluster, merge, or
mutate records.

V0.4 applies the declared thresholds after scoring: scores at or above
`MATCHTHRESHOLD` are proposed matches; scores from `REVIEWTHRESHOLD` up to the
match threshold are proposed reviews; lower scores are proposed non-matches.
When complete truth links are supplied, Output reports automatic-match
precision, recall, F1, false positives, false negatives, and truth links held
for review. These are evaluation results, not clerical decisions. Identifiers
remain hidden and no link, cluster, merged table, or source mutation is created.

The normative V0.4 details and acceptance fixture are in the
[RECORDLINK deterministic comparison contract](../validation/recordlink-comparison-method-contract.md).

V0.5 adds a bounded local clerical-review queue. Only candidates classified
`review` can be opened. The reviewer sees identifiers, original values,
normalized values, and numerical comparison evidence in a transient dialog,
then records Match, Non-match, or Uncertain plus a controlled reason. Output and
common history retain the session ordinal and decision but omit every patient
identifier and value. Decisions are session-only and do not create links,
clusters, tables, merges, or source changes. The normative boundary is in the
[RECORDLINK clerical-review contract](../validation/recordlink-clerical-review-contract.md).

V0.6 makes those decisions portable without making them authoritative links.
The browser exports aggregate-only JSON bound to the project, canonical plan,
contract versions, and a deterministic candidate-set SHA-256. Replay fails
closed when any binding differs and records an aggregate history event. The
artifact omits identifiers, original values, normalized values, and free text.
The normative boundary is in the
[RECORDLINK review-artifact contract](../validation/recordlink-review-artifact-contract.md).

V0.7 converts conclusive classifications into a deterministic, non-mutating
person-cluster proposal. All review candidates must first resolve to Match or
Non-match. A cluster may contain at most one record from either source;
competing edges are considered by score and candidate ordinal, and an edge that
would duplicate a source is rejected as an explicit conflict. Output and common
history retain only aggregate counts and candidate ordinals. The normative
boundary is in the
[RECORDLINK person-cluster contract](../validation/recordlink-person-cluster-contract.md).

V0.8 makes the reviewed proposal durable as person, membership, accepted-link,
rejected-link, and controlled-decision tables. Opaque person IDs appear in
Output; the downloadable artifact also contains one-based source record
ordinals so a future reviewed output step can map rows without embedding source
identifiers or values. Replay reconstructs decisions, clusters, tables, and two
fingerprints before acceptance. The normative boundary is in the
[RECORDLINK audit-table contract](../validation/recordlink-audit-table-contract.md).

V0.9 creates a separately reviewed person-record output without changing the
project. Only command-declared field pairs are included. The initial policy
prefers Source A and fills missing values from Source B; every selected value
retains source provenance and a disagreement flag. Source identifiers and
unmapped fields stay excluded. CSV and provenance JSON downloads remain
disabled until the user reviews the visible mapping and records. The normative
boundary is in the
[RECORDLINK person-output contract](../validation/recordlink-person-output-contract.md).

V0.10 exposes the governed handoff in the teaching program as typed `REVIEW`,
`CLUSTER`, `AUDIT`, and `OUTPUT` stages. `REVIEW` suspends sequential execution
while the specialized local comparison dialog is open, and every review-class
candidate must receive a conclusive Match or Non-match decision. Cancellation
stops later statements. `CLUSTER` rejects an unresolved queue, `AUDIT` prepares
the fingerprint-bound artifact in memory without automatically downloading it,
and `OUTPUT` renders the person records for explicit acknowledgement. None of
these stages creates a project form, mutates either source, or runs `MERGE`.

V0.11 extends the final statement with
`TO="patientlinks.duckdb"`. The statement still only prepares the reviewed
output; it does not download during program execution. After acknowledgement,
DuckDB-Wasm creates the person table, field-level provenance, all governed
audit/decision tables, and a fingerprinted manifest in a new analytical file.
The [DuckDB output contract](../validation/recordlink-duckdb-output-contract.md)
defines the schema, acceptance evidence, privacy boundary, and versioned,
checksummed OPFS seed lifecycle.

Defer learned models, project-table creation, multi-source clusters, very large populations, and
production privacy/security claims until the complete vertical slice is
browser-tested and independently validated.
