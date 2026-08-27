# Classic Analysis FREQ compatibility inventory

This inventory defines the legacy floor for the browser `FREQ` workflow. It is
based on `FrequencyDialog.cs`, `Frequency.cs`, and `StatisticsRepository/freq.vb`
in the vendored Epi Info Community Edition source. The V0.9 implementation is a
candidate slice, not a claim of feature parity or statistical approval.

## Legacy workflow and output floor

The Classic Analysis Frequency dialog can select one or more variables, select
all variables with exclusions, include a stratification variable and weight,
write an output table, save the generated command, and control missing-value and
display settings. Its generated program command is `FREQ` with optional
`STRATAVAR`, `WEIGHTVAR`, `OUTTABLE`, and `* EXCEPT` clauses.

For each category, the legacy statistics layer emits Frequency, Percent,
Cumulative Frequency, Cumulative Percent, and 95% confidence limits. Missing
values can be included or excluded. For category confidence limits, totals below
300 use the legacy exact interval; totals of 300 or more use Wilson with
`z = 1.96`. The legacy all-observation category reports 100%–100% in the Wilson
branch.

## Compatibility matrix

| Legacy branch | V0.9 state | Required follow-up |
|---|---|---|
| One unweighted variable from the current form | Candidate | Consolidated G5 review |
| Familiar `FREQ field` command preview | Prototype | Saved/runnable program integration |
| Frequency, percent, cumulative percent, 95% limits | Candidate | Legacy-output corpus and independent review |
| Include/exclude missing values | Candidate | Broader typed/missing corpus |
| Multiple variables | Open gap | Preserve per-variable output sequence |
| `FREQ * EXCEPT ...` | Open gap | Variable-list and exclusion UI |
| `STRATAVAR` | Open gap | Stratified frequency contract and output |
| `WEIGHTVAR` | Open gap | Weight semantics and validation |
| `OUTTABLE` | Open gap | Portable project-table destination |
| Save Only / program execution | Open gap | Integrate with the future traditional and visual IDEs |
| Selection/filter and display settings | Open gap | Inventory and implement observable behavior |

No row is deprecated. These open branches remain part of the compatibility
floor under the legacy capability register.
