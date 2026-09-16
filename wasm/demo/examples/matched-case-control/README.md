# Matched case-control examples

This bundle supports the `MATCH` revival work. The explicit unweighted 1:1
boundary executes through the browser candidate; retained legacy syntax outside
that boundary remains fail-closed. Historical desktop comparison by experienced
field users is still required before claiming legacy parity.

## Legacy teaching workbook

[`case-control-database-example.xlsx`](case-control-database-example.xlsx) is a
copy of the Community Edition sample workbook. Its main worksheet contains 130
observations and 121 fields. `CaCo` contains 65 cases and 65 controls, and
`Matched pairs` identifies 65 complete one-case/one-control sets.

### Investigation context recovered from the Epi Info 7 guide

The official Epi Info 7 Visual Dashboard guide uses this workbook as a
pair-matched case-control study of chicken consumption and illness. It identifies
`AnyChkn` as the exposure, `CaCo` as the case/control variable, and `Matched
pairs` as the Pair Group ID. The worked output contains 57 analyzable pairs: 29
with both members exposed, 13 with only the case exposed, eight with only the
control exposed, and seven with neither exposed. See the archived
[full Epi Info 7 User Guide](https://archive.cdc.gov/www_cdc_gov/epiinfo/pdfs/userguide/EI7Full.pdf)
and the recovered
[matched-pair source inventory](../../../docs/research/match-command-sources-and-data.md).

The recovered material does not name a pathogen, outbreak, place, or study
date. This example therefore describes only the documented chicken-consumption
and illness question; it does not invent a more specific investigation story.

### Data dictionary

The workbook's 121 abbreviated legacy columns are described in the
[data dictionary](DATA_DICTIONARY.md). It distinguishes meanings documented by
the Epi Info guide from interpretations inferred from field names and observed
values. Review it before selecting matching, outcome, or exposure variables;
the original value labels and questionnaire skip rules have not yet been
recovered.

For the initial `PB` exposure exercise, 60 sets have complete binary exposure
values and five otherwise valid sets are excluded because one or both exposure
values are missing. Executable Output reports that distinction rather than
describing all 65 structural pairs as analyzed.

- Initial normal exposure candidate: `PB`
- Initial one-sided zero-discordant-cell boundary candidate: `School` (`b=16`,
  `c=0` across 29 complete pairs; this is not the same as no discordance)
- SHA-256:
  `c35fdc3a8d7f6549533a824f0e4a68eb338c8c258656c56fd257430e3f3d0e48`

The source workbook remains at
`wasm/source/Epi-Info-Community-Edition/Epi.Core/Projects/Sample/Case Control DatabaseExample.xlsx`.
Confirm its provenance, case/exposure coding, and missing-value conventions
before treating any calculated value as expected epidemiologic output.

## Synthetic 1:2 stress data

[`matched-logistic-test-data.csv`](matched-logistic-test-data.csv) is copied from
the Community Edition unit-test data. It has 30,000 rows across 100 simulation
iterations. Each iteration contains 100 three-person matched sets with one case
and two controls. It is useful for bounded set-processing and conditional
logistic-regression stress tests, not as the primary teaching example.

SHA-256:
`eb9887feacad1dc2a22150c1e9db0cd427687c8be59b3943d14591082e142103`
for the LF-normalized repository and deployed asset. A Windows checkout may
materialize CRLF line endings and therefore has a different byte digest.

## Program

[`case-control-database-example.programs.json`](case-control-database-example.programs.json)
binds the teaching workbook to the Program Editor example picker. Its
[`matched-case-control-command-tour.pgm7`](matched-case-control-command-tour.pgm7)
counterpart first profiles data quality and descriptive statistics, then runs
the original guide's `AnyChkn` matched-pair question. `QUALITY` reveals field
completeness; frequencies verify case/control balance, two records per pair ID,
and the missing or non-binary exposure codes; `MEANS` describes age; `TABLES`
shows the unmatched cross-tabulation; `MATCH` applies the pair structure; and
conditional `LOGISTIC` demonstrates a two-predictor model that preserves the
matched sets. `Age` is included only to exercise adjusted-model mechanics. The
unrecovered study protocol does not establish that age belongs in the
substantive causal model.
This tests multi-command parsing, source-order execution, retained Output, and
History on the same matched data used by the revival candidate. The example is
offered only when the matching workbook fingerprint is loaded.

[`match-school-zero-cell.pgm7`](match-school-zero-cell.pgm7) exercises the
workbook's `School` exposure. Among 29 complete pairs it produces `b=16`,
`c=0`, a positive-infinity matched odds ratio, and a finite lower/infinite upper
exact interval; 36 pairs with missing School values are reported as excluded.

[`match-pb-by-pair.pgm7`](match-pb-by-pair.pgm7) targets the normalized field
names created when the teaching workbook is imported:

```text
MATCH pb caco MATCHVAR=matched_pairs
```

The explicit unweighted 1:1 form now parses and executes through the V0.16
Rust/WASM Worker. Broader retained forms remain rejected. Independent numerical
validation is available now; experienced field users will supply historical
workflow comparison evidence before any legacy-parity claim. See the complete
[source and corpus inventory](../../../docs/research/match-command-sources-and-data.md).

## Hand-auditable contract fixture

[`matched-pairs-hand-audit.csv`](matched-pairs-hand-audit.csv) contains 21
synthetic records across ten sets: seven valid 1:1 pairs and three deliberately
excluded edge sets. The included pairs yield three case-exposed discordances,
two control-exposed discordances, and a matched odds ratio of `1.5`.

[`match-hand-audit.pgm7`](match-hand-audit.pgm7) is its bounded executable
Program Editor exercise. The exact expected counts, tests, limits, and exclusion reasons
are frozen in the
[proposed V0.1 method contract](../../../docs/validation/matched-pairs-method-contract.md).
The independent
[`validate-match.ipynb`](../../../validation-lab/content/validate-match.ipynb)
JupyterLite lab reconstructs these sets and independently tests the deployed
MATCH calculations, boundaries, and invariants.

The hand-audit CSV now has its own fingerprinted program catalog, so its
`TABLES` plus `MATCH` boundary tour appears only when that exact dataset is
loaded. [`matched-pairs-no-discordance.csv`](matched-pairs-no-discordance.csv)
adds the distinct concordant-only case: four valid pairs with `b=c=0`.
[`match-no-discordance.pgm7`](match-no-discordance.pgm7) verifies that the odds
ratio, interval, and McNemar tests remain explicitly unavailable rather than
being replaced with invented finite values.

The frozen boundary expectations are recorded in
[`matched-pairs-boundaries-v0.1.json`](../../../tests/fixtures/algorithm-validation/matched-pairs-boundaries-v0.1.json).

CSV SHA-256:
`a8c0364bcc1ffb37a5ef29b4bf2bb36cef5652a219c51e11cfa0cef98492e518`.
