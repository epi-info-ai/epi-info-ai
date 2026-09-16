# RECORDLINK synthetic example

This bundle begins the Epi Info AI `EPIAI RECORDLINK` new branch with two
small, entirely synthetic patient sources and complete truth links. It is not
the legacy `MATCH` command: `MATCH` analyzes already matched case-control sets,
whereas RECORDLINK proposes which records from different sources may describe
the same person.

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

The final `EPIAI RECORDLINK` statement executes bounded candidate diagnostics:
64 possible cross-source pairs are reduced to 7 candidates, while all 5 known
truth links remain represented. Comparison, classification, pair-level Output,
person clustering, source changes, and `MERGE` remain fail-closed.

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
5. End at the explicit V0.2 candidate-diagnostics command:

```text
EPIAI RECORDLINK SOURCEA=patient_registry_a SOURCEB=surveillance_b IDA=record_id IDB=client_id TRUTH=true_links TRUTHA=source_a_id TRUTHB=source_b_id BLOCK=facility_code:site_code EXACT=date_of_birth:DOB,sex:SEX,art_code:ART_CODE FUZZY=first_name:given_name,last_name:family_name,patient_address:Address FUZZYTHRESHOLD=0.85 REVIEWTHRESHOLD=4 MATCHTHRESHOLD=6 MAXCANDIDATES=10000 RESULT=PatientLinks
```

The resolver requires two distinct named project sources, validates every field
pair against its own schema, requires compatible types, restricts fuzzy
comparison to text-compatible fields, bounds thresholds and candidate count,
and emits canonical source plus version/license provenance.

The descriptive commands are existing Epi Info AI commands. The openable
project supplies both sources plus a separate truth form. RECORDLINK generates
only in-memory candidate indexes and aggregate diagnostics; it does not reveal
pair identities or record values in Output/history, score or classify a pair,
modify a source, or run `MERGE`. The next governed slice can add explainable
comparison scores without widening this authority boundary.

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

## Upstream design provenance

The workflow structure was informed by
[`jkariuki7/pt_matching_app`](https://github.com/jkariuki7/pt_matching_app) at
commit `9be01cba65572a374f788242a635f3e57df44f25`. Its root license and package
metadata both declare Apache-2.0. This first bundle independently implements the
documented concepts and does not copy upstream source code or fixture rows.
