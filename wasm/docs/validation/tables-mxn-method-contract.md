# Classic TABLES method contract — V0.9

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

The inspected legacy rule expands a GROUPVAR specifically in the exposure
position and executes one table per member. This browser adapter preserves that
behavior for `TABLES group outcome` and `TABLES * outcome`: each resolved field
runs through the unchanged V0.9 single-table contract, remains separately
labeled in Output, and retains the original command in history. The outcome is
still one identifier, as specified by the legacy grammar. For safety, wildcard
expansion excludes the outcome, strata, weight, and non-data command fields
instead of attempting invalid same-field tables.

`STATISTICS=FISHER` requests a Fisher–Freeman–Halton two-sided exact test for
an observed 2 × N table. It enumerates fixed-margin tables with log-factorials
and log-sum-exp, uses the `3.45254e-7` comparison tolerance found in legacy
`SingleMxN`, and stops at a visible 200,000-table limit. Unsupported shapes or
limit breaches retain the categorical output and report exact statistics as
unavailable.

`WEIGHTVAR=<number field>` treats each participating row as a frequency weight,
matching the accumulation role inspected in legacy `cWorkingTable.cs`. The
browser accepts finite non-negative values, audits missing/invalid exclusions
and zero-weight rows, and displays both participating records and weighted N.
Exact and 2 × 2 risk/odds inference are not applied to weighted observations in
this slice; those methods require a separately validated weighted contract.

When a stratified result contains at least two true 2 × 2 tables, the exact
displayed affirmative-first cells are sent to the `epi.stratified2x2` Rust/WASM
Worker. TABLES appends adjusted Mantel–Haenszel odds and risk ratios with 95%
confidence limits, the conditional maximum-likelihood odds ratio with Fisher
limits, corrected and uncorrected association tests, and Breslow–Day, Tarone,
and legacy Epi Info odds/risk-ratio homogeneity tests. M×N tables never enter
this adapter, so the host does not invent exposed or case classifications.

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
TABLES potato_salad hamburger STRATAVAR=Sex
TABLES potato_salad case_status WEIGHTVAR=Age
DEFINE FoodExposures GROUPVAR potato_salad hamburger grilled_chicken
TABLES FoodExposures case_status
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

The stratified binary fixture uses Female cells `[[6,18],[1,23]]` and Male
cells `[[19,5],[23,1]]`. Its adjusted Mantel–Haenszel OR is
`1.1804511278195489`, adjusted RR is `1.0416666666666667`, uncorrected
association χ² is `0.08719851576994433`, and Breslow–Day–Tarone homogeneity χ²
is `7.1716825020480925`. Complete confidence intervals, p-values, conditional
OR, and homogeneity anchors live in
`foodborne-tables-stratified-two-by-two.expected.json`.

The mechanical `WEIGHTVAR=Age` fixture has weighted N `3917`; its No row is
`[0, 1686, 33, 298]` and Yes row is `[1007, 444, 449, 0]`. Age is deliberately
not represented as an epidemiologically meaningful survey weight—the fixture
only makes the legacy accumulation behavior deterministic and immediately
testable on the canonical data.

The exposure GROUPVAR fixture runs three tables in declared order. Their
unstratified Pearson anchors are `52.07692307692308` for potato salad,
`3.3397362515903555` for hamburger, and `2.4111360234241594` for grilled
chicken; the last table includes 95 records and audits one missing exposure.
Exact matrices and provenance live in
`foodborne-tables-groupvar.expected.json`.

## Evidence and open gates

- Phase 0 derives the result from the checksummed foodborne CSV and asserts the
  complete V0.9 mapping contract, ordered GROUPVAR/wildcard expansion,
  multiple-strata labels, weighted cells, and exact cells,
  missing-value session behavior, bounded 2 × N exact anchor and limit
  behavior, plus Rust/WebAssembly single and stratified 2 × 2 anchors.
- Browser tests open the PGM through the visible Program Editor and inspect its
  tables, percentages, statistics, expected counts, warnings, and history.
- `validate-tables.ipynb` independently repeats the derivation with Python and
  SciPy in JupyterLite.

This evidence earns only `browser-verified`. Desktop Epi Info differential
output, exact formatting/order review, missing-value variants,
exact legacy wildcard and weight edge/error behavior, output tables, and general R × C Fisher
remain open before legacy parity can be claimed.
