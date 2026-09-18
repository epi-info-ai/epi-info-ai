# RECORDLINK durable audit-table contract V0.8

## Scope

V0.8 turns a fully reviewed V0.7 cluster proposal into four durable tables:

- an opaque person table;
- a membership table mapping one-based source record ordinals to people;
- an accepted-link table with candidate score and automatic or clerical authority;
- a rejected-link table retaining explicit source-membership conflicts.

The artifact also retains the complete controlled decision table. Person IDs are
deterministic labels such as `P000001`; they are not patient identifiers.

## Binding and replay

The JSON artifact is bound to the project, canonical command plan, contract
versions, candidate count, and candidate-set SHA-256. A second SHA-256 binds the
candidate fingerprint, decisions, clusters, and all audit tables. Import
reconstructs the review decisions and cluster proposal from the active sources,
then compares every table and fingerprint before accepting the artifact.

## Privacy and mutation boundary

Patient identifiers, original values, normalized values, and free text are
excluded. The membership table intentionally contains one-based source record
ordinals so a later, separately reviewed output step can map source rows to
opaque people. The artifact declares this disclosure explicitly. Export and
replay do not create a deduplicated dataset, execute `MERGE`, or modify a source.

## Acceptance anchor

Candidate 5 reviewed as Match produces 11 person rows, 16 membership rows, and
5 accepted-link rows. Candidate 5 retains clerical authority and the controlled
`acceptable-variation` reason. Browser and baseline tests reject table
tampering and prove representative synthetic identifiers and dates are absent.
