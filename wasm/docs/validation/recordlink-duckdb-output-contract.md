# RECORDLINK governed DuckDB output contract

Status: executable new-branch V0.11 candidate. This is not a legacy Epi Info
parity claim or a production record-linkage validity claim.

## Syntax and execution boundary

```text
EPIAI RECORDLINK OUTPUT RESULT=PatientLinks TO="patientlinks.duckdb"
```

The typed `OUTPUT` statement prepares the reviewed person-record preview and
declares a local `.duckdb` target. It does not create or download the database
while the program runs. The DuckDB button becomes available only after the user
acknowledges the visible mappings, disagreements, and person records.

Paths, non-DuckDB extensions, unresolved reviews, missing clusters, and missing
or mismatched audit artifacts fail closed.

## Database contents

The downloaded database contains:

- the named person-record table (`PatientLinks_Persons` in the teaching case);
- `_recordlink_provenance`, one row per person and mapped field;
- `_recordlink_person` and `_recordlink_membership`;
- `_recordlink_link` and `_recordlink_rejected_link`;
- `_recordlink_decision`; and
- `_epi_recordlink_manifest`, containing versions, the canonical base command,
  candidate and audit fingerprints, row counts, and governance flags.

The teaching fixture produces 11 person rows, 77 provenance rows, 11 person
audit rows, 16 membership rows, 5 accepted-link rows, 0 rejected-link rows, and
1 clerical-decision row. Source patient identifiers and unmapped fields remain
excluded. Membership ordinals are retained as governed audit data.

## Governance and current limitation

The operation creates a new analytical file. It never mutates either source,
adds a form to the project, or executes `MERGE`. Common command history records
only aggregate table and row counts plus a shortened audit fingerprint.

Like the Access-to-DuckDB V0.1 adapter, this implementation starts from a
versioned seed shipped as a same-origin Epi Info AI asset. The application
verifies its reviewed byte length and SHA-256 digest, installs the immutable
seed at `epi-info-ai/system/duckdb/seed-v1.duckdb` in OPFS, and gives each
database build a fresh byte copy. The working copy's seed objects are removed
before governed tables are created and checkpointed. Integrity failures stop
the operation; browsers without OPFS can use the identically verified bundled
bytes. No third-party seed request or RECORDLINK-data transmission occurs.

## Acceptance evidence

- typed AST and canonical-source tests for the `TO` option;
- deterministic table-schema and row-count tests;
- rejection tests for unsafe file names and non-DuckDB extensions;
- production-build checks that pin the bundled seed's 274,432-byte length and
  SHA-256 digest;
- a browser test that runs the complete 24-statement command tour, performs the
  human decision, acknowledges output, downloads `patientlinks.duckdb`, checks
  the OPFS seed size and digest, observes no request to DuckDB's external seed
  host, checks the DuckDB `DUCK` storage header, verifies aggregate table/row
  feedback, and confirms the source record count is unchanged.
