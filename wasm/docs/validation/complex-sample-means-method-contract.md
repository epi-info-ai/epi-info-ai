# Complex Sample Means method contract

Status: browser-verified V0.1 candidate with independent JupyterLite evidence;
not yet legacy-parity-verified or statistically approved.

## Legacy floor

`MEANS outcome PSUVAR=psu` selects Complex Sample Means. The bounded port also
accepts one optional cross-tabulation field, one optional design `STRATAVAR`,
and one optional numeric `WEIGHTVAR`. It is based on `Rule_Means.cs`, the shipped
Complex Sample Means dialog, and `StatisticsRepository/EICSMeans.vb`.

Complete records contribute a numeric outcome, domain (or one total domain),
design stratum (or one implicit stratum), PSU, and finite non-negative weight
(or unit weight). Each domain estimate is its weighted mean. Variance is the
inspected first-order Taylor sum of linearized values aggregated by PSU within
design stratum. Design degrees of freedom are PSU/stratum pairs minus design
strata, and two-sided 95% limits use the legacy `TfromP(0.95, df)` path. Output
also includes unweighted complete-record counts and observed minima/maxima.

When exactly two domains are present, V0.1 reports the first ordered domain mean
minus the second and computes its covariance-aware Taylor standard error from a
single combined influence function. It does not infer causality or survey-design
fitness from that contrast.

## Browser-adapted OUTTABLE

The desktop Complex Sample Means dialog contains an `Output to Table` textbox,
but `CSMeansDialog.resx` disables it. Although `Rule_Means.cs` parses and passes
`OUTTABLE`, `StatisticsRepository/EICSMeans.vb` never calls the output-table
host. Consequently, there is no functional legacy CSM result-table schema to
restore.

Epi Info AI accepts `OUTTABLE` only with the bounded `PSUVAR` branch and marks
the behavior as a browser adaptation. It materializes the visible result rows
as the domain field (or `Domain`), `VARNAME`, `COUNT`, `MEAN`, `StdErr`, `LCL`,
`UCL`, `MIN`, and `MAX`. The table is session-local, replaces the same session
name on a later run, and is available to `READ` and `LIST`. The Difference row
uses null count/minimum/maximum values. It does not silently modify a project
form or claim desktop parity.

## Validation and limits

The checksummed foodborne fixture mechanically uses `Age` as the outcome, `Sex`
as the domain, `Case Status` as design strata, and `Household Neighborhood` as
PSU. These are deterministic test proxies, not a defensible survey design.
Phase 0 checks the typed result. The JupyterLite TABLES and Complex Samples lab
independently reloads the CSV and expected fixture, then recomputes domain means,
PSU-within-stratum Taylor variance, design df/t limits, minima/maxima, and the
two-domain contrast in Python without calling the TypeScript candidate.

Still open: persistent/external output-table adapters, multiple outcome/domain
expansion, meaningful survey-design corpora, missing/zero/negative-weight edge
review, desktop differential output, Rust-kernel migration, experienced-user
review, and consolidated G5 statistical review.
