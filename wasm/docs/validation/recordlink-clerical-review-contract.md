# RECORDLINK bounded clerical-review contract V0.5

> Historical boundary: V0.6 adds fingerprint-bound artifact portability and
> V0.7 adds non-mutating conflict-aware cluster proposals; this document keeps
> the original V0.5 acceptance rules.

Status: browser candidate. This contract does not approve automatic patient
matching, person clustering, source mutation, or legacy Epi Info parity.

## Authority boundary

After a reviewed `EPIAI RECORDLINK` command produces deterministic threshold
classes, V0.5 permits a user to inspect and decide only candidates classified
`review`. Automatic `match` and `non-match` proposals cannot be overridden in
this bounded slice. Opening a review does nothing to either source.

The transient dialog may show the two identifiers, original compared values,
normalized compared values, comparison method, similarity, and numerical
contribution. Those sensitive values must be removed from the DOM when the
dialog closes and must never be copied into ordinary Output or command history.

## Decisions

The reviewer explicitly chooses one decision:

- `match`, which makes the session-effective class `match`;
- `non-match`, which makes the session-effective class `non-match`; or
- `uncertain`, which retains the session-effective class `review`.

The reviewer also chooses one controlled reason: `confirmed-agreement`,
`acceptable-variation`, `conflicting-identifiers`, `insufficient-evidence`, or
`other`. Free-text notes are intentionally excluded so patient information
cannot be accidentally copied into the common history.

Each saved decision records the result name, session candidate ordinal,
automatic class, clerical decision, effective class, controlled reason,
decision time, and review-contract version. History may contain those fields
but not source identifiers or values. Re-review creates a new audit event and
updates the current session decision.

## Persistence and execution limits

Decisions are session-only in V0.5. They are cleared when RECORDLINK is rerun
or the project context changes. Candidate ordinals are meaningful only for the
same deterministic plan and source state. Durable, replayable review sets will
require source/plan digests and a versioned project artifact in a later slice.

V0.5 does not create links or person clusters, write a result table, invoke
`MERGE`, or modify a source record. A clerical decision is evidence for a later
governed step, not authority to perform that step.

## Acceptance fixture

In the synthetic teaching project, Candidate 5 is the only review-queue item.
It has score 5/6 and corresponds locally to the known controlled variation in
date of birth. Automated tests must prove that its values appear in the modal,
that a decision changes the visible session status, and that neither source
identifier appears in command history.
