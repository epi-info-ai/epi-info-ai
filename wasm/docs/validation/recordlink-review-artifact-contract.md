# RECORDLINK durable review-artifact contract V0.6

Status: browser candidate. This contract governs replayable clerical decisions;
it does not authorize person clustering, automatic merging, or source mutation.

## Artifact boundary

A review artifact is created only after a user saves at least one bounded V0.5
clerical decision. It contains the project name, canonical RECORDLINK command,
plan and review versions, result name, candidate count, candidate-set SHA-256,
candidate ordinals, decisions, effective classes, controlled reasons, and ISO
decision times.

It must not contain source record identifiers, original values, normalized
values, free-text notes, or direct candidate row indexes. The fingerprint may
bind those deterministic indexes and numerical comparison evidence inside a
one-way SHA-256 input but exposes only the digest.

## Replay boundary

Import fails closed unless all of the following match the active result:

- artifact kind and schema version;
- review-contract version;
- project name, result name, plan version, and canonical command;
- candidate count and candidate-set fingerprint;
- candidate ordinal and automatic review classification;
- supported decision, controlled reason, effective class, and decision time;
- explicit aggregate-only privacy flags.

Duplicate ordinals, decisions for automatic match/non-match candidates, and
inconsistent effective classes are rejected. Successful replay replaces the
current in-memory decision set and records an aggregate history event. It does
not change either source or create a link.

## Acceptance evidence

The synthetic project exports Candidate 5 as a clerical match, reruns the
command to clear session state, and imports the artifact. Browser automation
must recover the decision and prove that known synthetic identifiers and dates
are absent. Unit tests must reject a wrong project, wrong fingerprint, and a
decision aimed at a candidate outside the review queue.
