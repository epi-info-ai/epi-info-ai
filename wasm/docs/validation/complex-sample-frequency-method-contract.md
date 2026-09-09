# Complex Sample Frequencies method contract

Status: browser-verified V0.1 candidate; not yet legacy-parity-verified or statistically approved.

## Legacy floor

`FREQ field PSUVAR=psu` selects Complex Sample Frequencies. The bounded port also accepts one optional design `STRATAVAR`, an optional numeric `WEIGHTVAR`, and an optional session-local `OUTTABLE`. It is based on `Rule_Freq.cs`, the shipped Complex Sample Frequency dialog, and `StatisticsRepository/EICSTables.vb`.

Complete records contribute a category, design stratum (or one implicit stratum), PSU, and finite non-negative weight (or unit weight). The estimate is the weighted category proportion. Variance is the inspected first-order Taylor PSU-within-stratum sum. Design degrees of freedom are PSU/stratum pairs minus design strata, and two-sided 95% limits use the legacy `TfromP(0.95, df)` path. Both linear and logit limits are retained.

The legacy `DesignEffect(Pd)` uses the first category's variance and proportion, then repeats that value on every frequency row. V0.1 preserves and documents this surprising behavior rather than silently changing the parity target.

## OUTTABLE

For one FREQ variable, the inspected `IdentifierList` branch creates the source variable as a numeric category ordinal, followed by `VARNAME`, `COUNT`, `RowPct`, `ColPct`, `StdErr`, `LCL`, `UCL`, and `DesignEff`. The browser table is session-local and can be consumed by `READ` and `LIST`. `RowPct` is 100; `ColPct` is the estimated category percent. Logit limits and weighted count remain visible output but are not legacy OUTTABLE columns.

## Validation and limits

The checksummed foodborne fixture mechanically uses `Sex` as strata, `Household Neighborhood` as PSU, and `Age` as weight. These are deterministic test proxies, not a defensible survey design. Phase 0 checks exact typed results and OUTTABLE shape; the JupyterLite TABLES lab independently recomputes category proportions, Taylor variance, df/t limits, and the repeated design effect in Python.

Still open: desktop differential output, missing/zero/negative weight edge behavior, multi-field FREQ expansion, meaningful survey-design corpora, Rust kernel migration, experienced-user review, and consolidated G5 statistical review.
