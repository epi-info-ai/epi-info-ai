# Classic Analysis `MATCH` paired-analysis contract (proposed V0.1)

## Status and boundary

This document defines the first independently testable execution boundary for
the revived `MATCH exposure outcome MATCHVAR=...` command. The bounded typed
record-to-pair derivation is implemented, but this remains a **candidate
contract**: no statistical execution is enabled, no result is approved, and no
legacy-parity claim is made.

The inspected Epi Info 7 grammar and dialog retain MATCH, but
`Rule_Match.Execute()` explicitly reports that it is not implemented. An older,
mostly commented `EIMatch.vb` shell groups observations into matched sets,
constructs case/control exposure tables, and delegates to Mantel-Haenszel table
statistics. Historical manuals describe 1:1 and variable-ratio sets. V0.1
deliberately supports only complete 1:1 pairs; variable-ratio matching is a
separate future increment, not something silently approximated.

## Command and field interpretation

```text
MATCH <exposure> <outcome> MATCHVAR=<set identifier>
```

- `exposure`, `outcome`, and the match identifier must be distinct current-data
  fields.
- V0.1 accepts numeric/Yes-No binary analysis fields only. Numeric `1` means
  exposed or case and `0` means unexposed or control. Boolean Yes/No maps to
  `1`/`0`. Other values do not acquire an inferred meaning.
- A nonblank match identifier defines membership in one matched set. Its
  display value is preserved in diagnostics; comparison follows the current
  field's typed equality rather than locale-aware display sorting.
- Active `SELECT` filtering occurs before set formation and its effect is
  recorded. A partially selected set is then incomplete and excluded with that
  reason.
- `WEIGHTVAR`, multiple `MATCHVAR` fields, wildcard/EXCEPT forms, `OUTTABLE`,
  and SET options remain syntax-preserved but outside V0.1 execution.

## Set validation

V0.1 partitions records by nonmissing match identifier and evaluates the whole
set. An included set must contain exactly two records, exactly one case and one
control, and nonmissing binary exposure for both members.

The whole set is excluded if:

1. its identifier, outcome, or exposure is missing;
2. an analysis value is outside the explicit binary domain;
3. it contains other than two records (reported as an unsupported
   variable-ratio set in V0.1); or
4. a two-record set does not contain exactly one case and one control.

Exclusions are never silently repaired by choosing one member. Counts are
reported by reason at both set and record level. A set is assigned one primary
reason in the order above so totals cannot double count. Zero included or zero
discordant pairs returns an unavailable effect with a visible warning rather
than a fabricated neutral estimate.

## Pair table and orientation

For included pairs, the result reports:

| Case exposure | Control exposure | Symbol | Interpretation |
|---:|---:|---|---|
| 1 | 0 | `b` | Case exposed, control unexposed |
| 0 | 1 | `c` | Case unexposed, control exposed |
| 1 | 1 | — | Concordant exposed |
| 0 | 0 | — | Concordant unexposed |

The matched odds ratio is `b / c`. Both the labels and the formula must be
stored with the output so reversing orientation cannot silently return the
reciprocal.

## Proposed V0.1 statistics

Let `n = b + c` and use two-sided confidence level `1 - alpha`.

- matched odds ratio: `b / c`;
- uncorrected McNemar statistic: `(b - c)^2 / n`, with one chi-square degree of
  freedom;
- continuity-corrected McNemar statistic:
  `max(abs(b - c) - 1, 0)^2 / n`;
- exact two-sided McNemar probability:
  `min(1, 2 * P[X <= min(b,c)])`, where `X ~ Binomial(n, 0.5)`;
- exact two-sided mid-p:
  `min(1, 2 * (P[X < min(b,c)] + 0.5 P[X = min(b,c)]))`; and
- central conditional exact odds-ratio limits: calculate the Clopper-Pearson
  limits for `p = b/n`, then transform each finite probability as `p/(1-p)`.

Zero-cell results use explicit states: `b=0,c>0` gives estimate zero;
`b>0,c=0` gives positive infinity; `b=c=0` is unavailable. Presentation must
not replace those states with arbitrary large values or add an unrequested
continuity correction. The exact interval and mid-p labels must remain distinct.

These are proposed independent paired-analysis semantics. Before implementation,
they must be reconciled with any recoverable working Epi Info MATCH output and
the precise legacy confidence-limit labels; historical wording alone is not a
numerical oracle.

## Required output

One immutable Output document must contain:

1. canonical command source and active form/dataset identity;
2. input digest, engine and result-contract versions, and confidence level;
3. source/included/excluded record and set counts;
4. exclusion counts and visible warnings;
5. the four-cell paired-exposure table with explicit case/control orientation;
6. matched odds ratio and named confidence interval with finite/zero/infinity/
   unavailable state;
7. uncorrected, corrected, exact, and mid-p McNemar results with method labels;
8. current selection/filter provenance; and
9. common command-history origin, status, duration, and output identifier.

Nothing is written back to source records. `OUTTABLE` behavior remains blocked
until its legacy schema and replacement rules are independently recovered.

## Hand-auditable acceptance fixture

[`matched-pairs-hand-audit.csv`](../../demo/examples/matched-case-control/matched-pairs-hand-audit.csv)
contains 21 records across ten source sets. Seven complete 1:1 sets are included:
three discordant with the case exposed, two discordant with the control exposed,
one concordant exposed, and one concordant unexposed. The remaining sets cover a
missing exposure, two cases/no control, and a deferred 1:2 set.

The frozen [contract fixture](../../tests/fixtures/algorithm-validation/matched-pairs-contract-v0.1.json)
therefore expects `b=3`, `c=2`, matched OR `1.5`, five discordant pairs, two
concordant pairs, and three explicitly classified excluded sets. The central
95% conditional exact interval is `0.17182849255502144` to
`17.959160830022086`; exact two-sided p is `1`, and exact mid-p is `0.6875`.

The fixture calculations are simple enough to reproduce by inspection and are
checked for internal drift in Phase 0. The independent
[`validate-match.ipynb`](../../validation-lab/content/validate-match.ipynb)
JupyterLite lab recomputes the binomial tails, beta quantiles, and chi-square
probabilities rather than copying these expected values. It also exercises
boundary states and metamorphic properties and compares the deployed V0.16
Rust/WebAssembly candidate with those independent results.

## Validation gates before execution

- Confirm formula and label identity against official archived manuals.
- Capture reviewed output from a working historical implementation, or record
  that no working implementation can be recovered.
- Keep the independent JupyterLite calculation and boundary/metamorphic checks
  green as the future engine candidate is introduced.
- Promote the 65-pair workbook only after provenance and value-code review.
- Specify variable-ratio matched sets and multiple match fields separately.
- Keep the typed V0.16 Rust/WASM result and cancellable Worker green in CI and
  preserve explicit zero/infinity/unavailable states.
- Test selected command, full-program sequencing, output, history, and failure
  recovery in the browser.
- Complete statistical and implementation review before changing candidate
  status or making a parity claim.
