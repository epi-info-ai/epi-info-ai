# RECORDLINK conflict-aware person-cluster contract V0.7

## Scope

V0.7 converts accepted RECORDLINK candidate edges into a deterministic,
non-mutating person-cluster proposal. Automatic `match` candidates are accepted;
`review` candidates require an explicit effective `match` or `non-match`
decision. Clustering fails closed while any review candidate is missing a
decision or remains `uncertain`.

## Conflict rule

A proposed person cluster may contain at most one record from each source.
Accepted edges are considered by descending score and then candidate ordinal.
An edge that would add a second record from a source is rejected and reported by
candidate ordinal as a `source-membership-conflict`; it never silently replaces
an earlier edge.

## Privacy and mutation boundary

The visible summary and common history contain only counts and candidate
ordinals. They contain no patient identifiers, original values, or normalized
values. The result is an in-memory proposal: it does not write a linkage table,
change either source, or invoke `MERGE`.

## Acceptance anchor

After Candidate 5 in the synthetic fixture is reviewed as `match`, five accepted
edges produce five linked two-record clusters plus six singletons: 11 proposed
people from 16 source records. Reviewing Candidate 5 as `non-match` produces
four linked clusters plus eight singletons: 12 proposed people. A synthetic
competing edge verifies fail-closed source-membership conflict reporting.
