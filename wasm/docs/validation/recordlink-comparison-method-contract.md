# RECORDLINK deterministic comparison and classification contract V0.4

Status: browser-verified new-branch candidate. This contract does not approve
automatic patient matching or establish legacy Epi Info parity.

## Authority boundary

`EPIAI RECORDLINK` compares only the cross-source candidate pairs retained by
the reviewed `BLOCK` rules, then applies the declared thresholds as reproducible
classification proposals. Source records are immutable. V0.4 does not make a
clerical decision, expose source identifiers or values in Output/history,
create person clusters, or invoke `MERGE`.

## Normalization and missing values

- Exact comparison applies Unicode NFKC normalization, trims surrounding
  whitespace, and uses locale-stable lowercase comparison.
- Fuzzy comparison additionally replaces punctuation and other non-letter/
  non-number runs with one space and collapses whitespace.
- A null, undefined, empty, or normalization-empty value is missing. A missing
  value never agrees with another missing value and contributes zero.
- No transliteration, nickname dictionary, phonetic key, address dictionary,
  date tolerance, or learned model is applied in this slice.

## Similarity and score

Every `EXACT` pair contributes one point when both normalized values are
nonmissing and equal. Every `FUZZY` pair uses the standard Jaro similarity plus
the Jaro-Winkler prefix adjustment (maximum four-character prefix, scaling
factor 0.1, applied when Jaro exceeds 0.7). It contributes one point when the
similarity is at least `FUZZYTHRESHOLD`.

The candidate score is the sum of these binary contributions. Its maximum is
the number of exact plus fuzzy field pairs. Candidate order follows the stable
source-row order produced by blocking; Output labels candidates only by a
one-based session ordinal.

Scores at or above `MATCHTHRESHOLD` are classified `match`. Scores at or above
`REVIEWTHRESHOLD` but below the match threshold are classified `review`; lower
scores are classified `non-match`. The resolver requires a nonnegative review
threshold lower than the match threshold, and a positive match threshold no
greater than the maximum score.

## Required output and audit behavior

Output shows blocking stages, pair-space reduction, optional truth-link recall,
the score distribution, exact/fuzzy pass counts, total score, threshold class,
and each field pair's numerical similarity/contribution. With truth supplied it
also shows match precision, recall, F1, false-positive/false-negative counts,
and truth links held for review. It must not show record identifiers, normalized
strings, or record values. Common history stores only aggregate counts, metrics,
the score scale, canonical command, versions, and the explicit no-clerical-review
boundary.

## Acceptance fixture

The synthetic two-source project has 8 records per source, 64 possible pairs,
7 facility-blocked candidates, and 5 retained truth links. With three exact and
three fuzzy pairs at `FUZZYTHRESHOLD=0.85`, the stable candidate scores are:

```text
6, 0, 0, 6, 5, 6, 6
```

The score distribution is four at 6/6, one at 5/6, and two at 0/6. The
threshold counts are four match, one review, and two non-match. At the automatic
match threshold the truth metrics are TP=4, FP=0, FN=1, precision=1, recall=0.8,
and F1=0.888888888888889; the remaining known link is held for review. The
independent `validate-recordlink.ipynb` notebook must reconstruct every value
without importing the TypeScript implementation.

## Deferred work

Threshold calibration, clerical decisions, conflict resolution, clustering,
deduplication, merge handoff, privacy/security review,
large-source performance, alternate comparison functions, and epidemiologist
review remain separate governed slices.
