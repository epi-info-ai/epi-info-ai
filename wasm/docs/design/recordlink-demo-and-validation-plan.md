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

## First bounded implementation slice

V0.1 now defines the typed `EPIAI RECORDLINK` AST and resolver plus two CSV
sources, exact and realistic-duplicate scenarios, a candidate cap, complete
truth links, canonical source, and pinned upstream/license provenance. It is a
fail-closed contract preview: candidate generation, comparison, classification,
manual review, clustering, and merge do not execute yet.

The next slice implements deterministic cross-source blocking and reports the
candidate count, reduction ratio, per-rule diagnostics, and candidate recall
against complete truth. Defer learned models, multi-source clusters, very large
populations, and production privacy/security claims until the complete vertical
slice is browser-tested and independently validated.
