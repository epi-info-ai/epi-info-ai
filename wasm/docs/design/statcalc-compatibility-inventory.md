# StatCalc and stratified tables compatibility inventory

## Familiar workflow and legacy floor

The main-menu **StatCalc** branch retains the direct 2 x 2 calculator. Stratified
2 x 2 analysis belongs to the learned **Classic Analysis > TABLES** workflow:
users select exposure, outcome, and one or more stratification variables, inspect
each stratum, and then read summary estimates and overall-association tests.

The implementation floor is evidenced by
`StatisticsRepository/Strat2X2.vb` and
`Epi.Analysis.Statistics/Tables.cs`. The legacy summary includes:

- crude and adjusted Mantel-Haenszel odds ratios;
- adjusted Mantel-Haenszel risk ratio;
- 95% Robins-Breslow-Greenland/log confidence limits;
- adjusted conditional-MLE odds ratio and exact limits;
- corrected and uncorrected Mantel-Haenszel association tests; and
- Breslow-Day-Tarone OR, Breslow-Day OR, and Breslow-Day RR homogeneity tests.

## Current browser slice

The candidate `epi.stratified2x2` Rust/WASM operation accepts ordered, named 2 x
2 strata and returns adjusted OR/RR estimates, legacy-formula confidence limits,
corrected/uncorrected MH tests, fixed-margin Breslow-Day/Tarone tests, and the
legacy-labelled Woolf OR/RR homogeneity results. A compact Classic Analysis table demonstrates
manual entry with the canonical foodborne potato-salad table stratified by sex.
The current-form TABLES panel now selects exposure, outcome, and one stratifier,
makes positive/reference value classification explicit, reports excluded missing
records, displays the generated command, and populates those auditable tables.

## Stable gaps

| Gap ID | Legacy capability | Current state | Closure evidence |
|---|---|---|---|
| LEGACY-STATCALC-001 | Direct 2 x 2 StatCalc | Candidate Rust/WASM workflow | Complete G0-G6 review and edge semantics |
| LEGACY-ANALYSIS-001 | TABLES exposure/outcome/strata selection from current data | Single-stratifier current-form prototype | Add multiple stratifiers, weight variable, filters, saved commands, and full dialog options |
| LEGACY-ANALYSIS-002 | Per-stratum tables and crude summary | Input rows only | Render tables, marginal totals, crude measures, and missing-value decisions |
| LEGACY-ANALYSIS-003 | Adjusted MH OR/RR and confidence limits | Candidate Rust/WASM implementation | Legacy and independent fixture review, WASM parity, statistical approval |
| LEGACY-ANALYSIS-004 | Corrected/uncorrected MH association tests | Candidate Rust/WASM implementation | Sparse, empty, large, and metamorphic validation plus review |
| LEGACY-ANALYSIS-005 | Adjusted conditional MLE and exact limits | Bounded candidate Rust/WASM implementation | Expand legacy/independent pathological and performance evidence; complete review |
| LEGACY-ANALYSIS-006 | OR/RR homogeneity tests | Candidate OR/RR tests | Complete expanded legacy/independent corpora and formal review |

No old branch is deprecated or retired. Explicit value classification is an
adaptation for imported browser text fields: legacy typed Yes/No fields imply
their orientation, while imported multi-value fields require users to state it.
The generated TABLES command remains visible; a later RECODE/DEFINE workflow must
preserve that classification when saved as a traditional program.
