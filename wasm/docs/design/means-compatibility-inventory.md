# Classic Analysis MEANS compatibility inventory

This inventory defines the legacy floor for the browser `MEANS` workflow. It is
based on `MeansDialog.cs`, `Means.cs`, and `cWorkingTable.cs` in the vendored Epi
Info Community Edition source. V0.10 is a candidate descriptive-statistics slice,
not feature parity or statistical approval.

## Legacy workflow and output floor

The Classic Analysis dialog selects a Means Of variable and may additionally
select Cross-tabulate By, one or more Stratify By variables, a Weight variable,
and an output table. It supports OK, Save Only, Clear, Settings, and Help. The
generated command is `MEANS variable [cross-tab]` with optional `STRATAVAR`,
`WEIGHTVAR`, and `OUTTABLE` clauses.

Without cross-tabulation, the familiar output contains Obs, Total, Mean,
Variance, Std Dev, Minimum, 25%, Median, 75%, Maximum, and Mode. Variance is the
sample variance with denominator `n - 1`. The audited quartile algorithm uses
rank `n × p`, averaging the values on either side when that rank is an integer.
Mode is the first ascending value with the largest frequency. Cross-tabulation
adds group rows and inferential output including pooled/Satterthwaite t tests,
ANOVA, Bartlett, and Kruskal-Wallis calculations.

## Compatibility matrix

| Legacy branch | V0.10 state | Required follow-up |
|---|---|---|
| One numeric Means Of variable from current form | Candidate | Consolidated G5 review |
| Familiar `MEANS field` preview | Prototype | Saved/runnable program integration |
| Obs, Total, Mean, Variance, Std Dev | Candidate | Reviewed legacy-output corpus |
| Minimum, quartiles, median, maximum, mode | Candidate | Broader edge/tie corpus |
| Missing/non-numeric exclusion and reporting | Candidate | Legacy settings parity |
| Cross-tabulate By and group summaries | Open gap | Typed grouping contract |
| T tests, ANOVA, Bartlett, Kruskal-Wallis | Open gap | Separate method contracts and validation |
| Multiple `STRATAVAR` variables | Open gap | Nested output and missing semantics |
| `WEIGHTVAR` | Open gap | Weight semantics and effective observations |
| `OUTTABLE` | Open gap | Portable project-table destination |
| Save Only, filters, and Settings | Open gap | Program/session integration |
| Complex Sample Means | Bounded V0.1 candidate plus browser-adapted result `OUTTABLE` | Desktop control is disabled and supplies no result schema; retain the adaptation label and add meaningful survey corpus, persistent adapters, desktop differential output, Rust migration, experienced-user and G5 review; see the [method contract](../validation/complex-sample-means-method-contract.md) |

No branch is deprecated. Every open row remains in the compatibility floor.
