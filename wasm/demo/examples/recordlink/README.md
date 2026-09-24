# RECORDLINK synthetic example

This bundle begins the Epi Info AI `EPIAI RECORDLINK` new branch with two
small, entirely synthetic patient sources and complete truth links. It is not
the legacy `MATCH` command: `MATCH` analyzes already matched case-control sets,
whereas RECORDLINK proposes which records from different sources may describe
the same person.

The package includes separate field-compatible Check Code programs for the two
source forms:

- [`patient-registry-a-check-code.chk`](patient-registry-a-check-code.chk)
- [`surveillance-b-check-code.chk`](surveillance-b-check-code.chk)

Each source uses Identity and Demographics pages, reviews a missing source
identifier, and demonstrates deterministic cross-page navigation. Registry A
also demonstrates adapted `GOTOFORM surveillance-b`: after a registry ID and
facility are entered, the learner can move to the second project form while the
validated draft remains available in the browser session until explicitly
saved. The
`true-links` form intentionally has no Check Code because it is evaluation
truth, not a data-entry surface. Check Code improves entry quality; it never
decides or applies record links.

## Contents

- `patient-registry-a.csv` — eight synthetic registry records.
- `surveillance-b.csv` — eight synthetic surveillance records with deliberately
  different column names and controlled spelling, address, middle-name, and
  date variations.
- `true-links.csv` — five known cross-source links used only for evaluation.
- `recordlink-command-tour.pgm7` — a 20-statement visible workflow that
  describes the exercise, profiles both sources, and ends at the typed linkage
  plan.
- `recordlink-synthetic-project.epia.json` — an openable three-form browser
  project containing both sources, the truth links, and the saved command tour,
  so the workflow can be exercised without assembling the project by hand.
- `generation-manifest.json` — counts, hashes, provenance, and the explicit
  statement that no upstream code or fixture rows were copied.
- `expected-recordlink-results.json` — the current acceptance boundary and
  future result anchors.

All people, identifiers, facilities, addresses, and linkage relationships in
these files are fictional. They must not be combined with operational data or
described as a production matching evaluation.

## Try the tour in Epi Info AI

1. Choose **File > Open Project** and select
   `recordlink-synthetic-project.epia.json`.
2. Open **Classic Analysis** and expand **Project programs and examples**.
3. Choose `recordlink-command-tour`, select **Open**, then run or step through
   the commands.
4. Compare the two `LIST` outputs: the deliberately varied names, dates, and
   addresses explain why exact identifiers alone are insufficient.

The final `EPIAI RECORDLINK` statement reduces 64 possible cross-source pairs
to 7 candidates while retaining all 5 known truth links, then calculates
deterministic exact and Jaro-Winkler comparison contributions on a six-point
scale and applies the declared thresholds to produce match, review, and
non-match proposals. The review candidate can then be inspected in a transient
local dialog and assigned Match, Non-match, or Uncertain with a controlled
reason. Decisions can be exported and replayed as a fingerprint-bound V0.6 JSON
artifact that excludes identifiers and values. Once the review queue is fully
resolved, V0.7 builds a deterministic person-cluster proposal with at most one
record from each source. V0.8 exports and replays fingerprint-bound person,
membership, accepted-link, rejected-link, and decision audit tables. Source
changes, project-table creation, and `MERGE` remain fail-closed. V0.9 can create
a separately reviewed new person-record CSV and provenance JSON without adding
that output to the project. V0.10 exposes the governed review, cluster, audit,
and output transitions as typed program statements.

## Current slice

The command tour follows the same source-first discipline expected of the final
workflow:

1. Explain that both sources and all identities are synthetic.
2. `READ patient_registry_a`, run `EPIAI QUALITY *`, inspect the eight-row
   synthetic line list, review facility and sex frequencies, and cross-tabulate
   facility by sex.
3. `READ surveillance_b`, repeat the same quality and aggregate review using
   that source's differently named fields.
4. Display the reviewed blocking and comparison rationale.
5. Run the explicit candidate-classification command followed by the four V0.10
   governed stages. The program pauses at `REVIEW` for the one queued candidate,
   then resumes through the non-mutating cluster, in-memory audit, and reviewed
   person-output preview:

```text
EPIAI RECORDLINK SOURCEA=patient_registry_a SOURCEB=surveillance_b IDA=record_id IDB=client_id TRUTH=true_links TRUTHA=source_a_id TRUTHB=source_b_id BLOCK=facility_code:site_code EXACT=date_of_birth:DOB,sex:SEX,art_code:ART_CODE FUZZY=first_name:given_name,last_name:family_name,patient_address:Address FUZZYTHRESHOLD=0.85 REVIEWTHRESHOLD=4 MATCHTHRESHOLD=6 MAXCANDIDATES=10000 RESULT=PatientLinks
EPIAI RECORDLINK REVIEW RESULT=PatientLinks
EPIAI RECORDLINK CLUSTER RESULT=PatientLinks
EPIAI RECORDLINK AUDIT RESULT=PatientLinks
EPIAI RECORDLINK OUTPUT RESULT=PatientLinks
```

`REVIEW` cannot complete while a queued candidate remains Uncertain. `AUDIT`
does not force a download, and `OUTPUT` does not enable downloads until the user
acknowledges the visible mappings, disagreements, and person records.

The tour's V0.11 `OUTPUT` statement declares `patientlinks.duckdb`. After the
same acknowledgement, **Download governed DuckDB** creates eight tables: the
11-row person dataset, 77-row field provenance, five audit/decision tables, and
the fingerprinted manifest. The file is a new analytical output; it does not
become a project form and does not modify either source. It clones the same
versioned, checksummed seed that Epi Info AI installs immutably in OPFS; no
third-party seed request is made.

The resolver requires two distinct named project sources, validates every field
pair against its own schema, requires compatible types, restricts fuzzy
comparison to text-compatible fields, bounds thresholds and candidate count,
and emits canonical source plus version/license provenance.

The descriptive commands are existing Epi Info AI commands. The openable
project supplies both sources plus a separate truth form. RECORDLINK generates
in-memory candidate indexes and explainable comparison scores. Exact equality
and each Jaro-Winkler similarity meeting `FUZZYTHRESHOLD` contribute one point.
The visible review and match thresholds produce reproducible proposals. Output
uses session-only candidate ordinals and field-level numerical contributions;
it does not reveal identifiers, normalized values, or patient values in
Output/history. Those values appear only in the transient review dialog. A
saved decision records its ordinal, decision, and controlled reason without
modifying a source or running `MERGE`. Its portable artifact is accepted only
when the project, canonical plan, versions, and candidate-set fingerprint match.
With Candidate 5 reviewed as Match, the cluster proposal reports five linked
pairs and six singleton records: 11 proposed people from 16 source records.
Competing edges that would put two records from one source into a person are
reported as conflicts rather than silently replacing a link.
The durable artifact contains 11 opaque person rows, 16 membership rows, and 5
accepted-link rows for this reviewed fixture. Membership uses one-based source
record ordinals so later governed output can map records without embedding
patient identifiers or field values. Import recomputes every table and both
fingerprints before accepting the artifact.
The V0.9 output uses only the seven field pairs visible in the command. Its
initial policy prefers nonmissing Source A values and fills from Source B only
when Source A is absent. For this fixture it produces 11 rows, six linked-field
disagreements, 21 Source B fallback values, and 77 value-provenance rows. The
policy is visible provenance, not a claim that Source A is more accurate.

The two `LIST` commands intentionally show matching fields so users can inspect
the controlled differences before seeing proposed links. This is appropriate
only because every record is synthetic and each source has eight rows. An
operational RECORDLINK workflow should default to aggregate `QUALITY`, `FREQ`,
and `TABLES` output, then reveal the minimum necessary patient fields only in an
explicit, audited clerical-review interface.

## Expected teaching cases

- `A001` / `B001`: address abbreviation.
- `A002` / `B002`: exact core fields.
- `A004` / `B004`: date of birth differs by one day and should require later
  clerical review under the initial exact-date contract.
- `A005` / `B005`: address abbreviation and expanded middle name.
- `A006` / `B006`: first-name spelling and address variation.
- Three records in each source intentionally have no link.

The checked-in acceptance distribution is four candidates at 6/6, one at 5/6,
and two at 0/6: four match, one review, and two non-match proposals. At the
declared match threshold the complete truth set yields 100% precision, 80%
recall, and 88.9% F1; the remaining known link is held for review. The 5/6 case
is the known one-day date variation. Threshold classes remain validation
evidence; only an explicit action in the review dialog is a clerical decision.

## Upstream design provenance

The workflow structure was informed by
[`jkariuki7/pt_matching_app`](https://github.com/jkariuki7/pt_matching_app) at
commit `9be01cba65572a374f788242a635f3e57df44f25`. Its root license and package
metadata both declare Apache-2.0. This first bundle independently implements the
documented concepts and does not copy upstream source code or fixture rows.
