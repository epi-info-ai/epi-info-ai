# Matched case-control examples

This bundle supports the `MATCH` revival work. Execution currently remains
disabled because the checked-in Epi Info 7 interpreter retains the command
syntax but reports MATCH as not implemented. The included program therefore
tests authoring and syntax only until the method contract is approved.

## Legacy teaching workbook

[`case-control-database-example.xlsx`](case-control-database-example.xlsx) is a
copy of the Community Edition sample workbook. Its main worksheet contains 130
observations and 121 fields. `CaCo` contains 65 cases and 65 controls, and
`Matched pairs` identifies 65 complete one-case/one-control sets.

- Initial normal exposure candidate: `PB`
- Initial zero-discordance boundary candidate: `School`
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
`662a9ed558f869af0b1ae0222931d288a8c615dc77afb286864e7147729b8a02`.

## Program

[`match-pb-by-pair.pgm7`](match-pb-by-pair.pgm7) targets the normalized field
names created when the teaching workbook is imported:

```text
MATCH pb caco MATCHVAR=matched_pairs
```

It should parse and be recorded as a rejected execution attempt today. Enabling
analysis requires the documented method/output contract, independent numerical
validation, and reviewed desktop differential evidence. See the complete
[source and corpus inventory](../../../docs/research/match-command-sources-and-data.md).

## Hand-auditable contract fixture

[`matched-pairs-hand-audit.csv`](matched-pairs-hand-audit.csv) contains 21
synthetic records across ten sets: seven valid 1:1 pairs and three deliberately
excluded edge sets. The included pairs yield three case-exposed discordances,
two control-exposed discordances, and a matched odds ratio of `1.5`.

[`match-hand-audit.pgm7`](match-hand-audit.pgm7) is its syntax-only Program
Editor exercise. The exact expected counts, tests, limits, and exclusion reasons
are frozen in the
[proposed V0.1 method contract](../../../docs/validation/matched-pairs-method-contract.md).
The independent
[`validate-match.ipynb`](../../../validation-lab/content/validate-match.ipynb)
JupyterLite lab reconstructs these sets and tests the proposed calculations,
boundaries, and invariants without calling a MATCH execution engine.

CSV SHA-256:
`a8c0364bcc1ffb37a5ef29b4bf2bb36cef5652a219c51e11cfa0cef98492e518`.
