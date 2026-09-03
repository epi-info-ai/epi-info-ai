# Classic TABLES method contract — V0.7

## Scope

This candidate executes `TABLES exposure outcome` or
`TABLES exposure outcome STRATAVAR=stratum [additional-stratum …]` against the active Classic Analysis
session. One or more stratum fields form labeled Cartesian strata. It reports
counts, row and column percentages, marginal totals, expected counts, and a
Pearson chi-square test for all records or independently for each observed
stratum combination. It does not combine categories. When exposure and outcome
each have exactly two observed values, TABLES additionally creates the legacy
Single Table Analysis from the displayed first-row/first-column orientation.
Yes/No and Checkbox fields use affirmative-first ordering, and the UI states
the exact exposed, unexposed, case, and non-case values.

`STATISTICS=FISHER` requests a Fisher–Freeman–Halton two-sided exact test for
an observed 2 × N table. It enumerates fixed-margin tables with log-factorials
and log-sum-exp, uses the `3.45254e-7` comparison tolerance found in legacy
`SingleMxN`, and stops at a visible 200,000-table limit. Unsupported shapes or
limit breaches retain the categorical output and report exact statistics as
unavailable.

Records with a null, undefined, or blank selected value are excluded and counted
in the audit by the legacy default `SET MISSING=OFF`. `SET MISSING=ON` persists
in the active Classic session and includes those records under the legacy
default display label `Missing`; a later `SET MISSING=OFF` restores exclusion.
The same rule applies to exposure, outcome, and stratum fields. Category and stratum labels use deterministic case-insensitive,
numeric-aware ordering. A stratum with fewer than two non-empty rows or columns
has no Pearson result.

## Calculations

For observed cell count `O[i,j]`, row total `R[i]`, column total `C[j]`, and
stratum total `N`:

- row percent = `100 × O[i,j] / R[i]`;
- column percent = `100 × O[i,j] / C[j]`;
- expected count = `R[i] × C[j] / N`;
- Pearson χ² = `Σ (O[i,j] - E[i,j])² / E[i,j]` over non-empty margins;
- degrees of freedom = `(non-empty rows - 1) × (non-empty columns - 1)`; and
- probability = the chi-square survival function `Q(df/2, χ²/2)`.

The TypeScript candidate evaluates the survival function with a Lanczos
log-gamma approximation and regularized incomplete-gamma series/continued
fraction. JupyterLite independently checks it against `scipy.stats.chi2_contingency`.

The warning text follows the inspected legacy implementation: expected counts
below one take precedence; otherwise any expected count below five produces the
`< 5` warning. Counts below each threshold are retained in the typed result.

## Canonical foodborne anchors

The commands are:

```text
TABLES potato_salad case_status STRATAVAR=Sex
TABLES potato_salad case_status
TABLES potato_salad case_status STATISTICS=FISHER
TABLES potato_salad hamburger
SET (.)="Not recorded"
SET MISSING=ON
TABLES vomiting Sex
SET MISSING=OFF
SET (.)="Missing"
```

It produces Female and Male 2×4 matrices, each with 48 records. The Pearson
anchors are:

| Stratum | χ² | df | p | Minimum expected |
|---|---:|---:|---:|---:|
| Female | 29.53846153846154 | 3 | 0.0000017256722894236624 | 2 |
| Male | 23.53846153846154 | 3 | 0.00003118271175611744 | 1 |

Both strata have four expected cells below five and therefore display the
legacy sparse-cell warning. Exact expected matrices and percentages live in
`foodborne-tables-potato-salad-by-status.expected.json`.

The unstratified 2×4 table contains 96 records, has Pearson χ²
`52.07692307692308`, `df=3`, and probability `2.8841252349220762e-11`. Its exact
result lives in
`foodborne-tables-potato-salad-by-status-unstratified.expected.json`.
For that matrix, `STATISTICS=FISHER` enumerates 2,737 tables and returns
`5.552362909835065e-14`; its anchor is `foodborne-tables-fisher.expected.json`.

The missing-value fixture uses the two blank `vomiting` values. With the legacy
default OFF, 94 records are included and 2 excluded. With ON, all 96 are
included and the custom `Not recorded` exposure row contains 2 Male records.
The fixture ends with OFF and restores the `Missing` label, verifying ordered
session effects without leaking settings into later commands.

The binary fixture has cells `a=25`, `b=23`, `c=24`, and `d=24`. Its
cross-product OR is `1.0869565217391304`, RR is `1.0416666666666667`, RD is
`0.02083333333333337`, and Pearson χ² is `0.04168475900998697`. TABLES passes
those cells to the validated Rust/WebAssembly `epi.table2x2` operation rather
than duplicating its formulas in the transitional TypeScript interpreter.

## Evidence and open gates

- Phase 0 derives the result from the checksummed foodborne CSV and asserts the
  complete V0.7 mapping contract, multiple-strata labels and exact cells, missing-value session behavior, bounded 2 × N exact anchor and limit
  behavior, plus Rust/WebAssembly 2 × 2 anchors.
- Browser tests open the PGM through the visible Program Editor and inspect its
  tables, percentages, statistics, expected counts, warnings, and history.
- `validate-tables.ipynb` independently repeats the derivation with Python and
  SciPy in JupyterLite.

This evidence earns only `browser-verified`. Desktop Epi Info differential
output, exact formatting/order review, missing-value variants,
multiple exposure/outcome forms, weights, output tables, general R × C Fisher, and stratified 2 × 2 output
remain open before legacy parity can be claimed.
