# Complex Sample Tables `PSUVAR` method contract — V0.2

## Scope

This candidate restores the inspected Classic Analysis path
`Advanced Statistics > Complex Sample Tables` and executes the familiar form:

```text
TABLES exposure outcome [STRATAVAR=stratum] [WEIGHTVAR=weight] PSUVAR=psu
```

It is a direct, bounded TypeScript port of the relevant legacy
`StatisticsRepository/EICSTables.vb` calculation. `PSUVAR` is not treated as an
ordinary categorical TABLES option: it selects the complex-sample engine.

V0.2 supports one exposure, one outcome, one optional design stratum, one
optional numeric weight, and one required primary sampling unit. It reports
unweighted and weighted cell counts, row and column percentages, Taylor-series
standard errors, t confidence limits, design effects, design degrees of freedom,
and survey-adjusted OR/RR/RD for complete 2 × 2 tables.

## Design and exclusions

- Records missing exposure, outcome, PSU, design stratum, or weight are excluded.
- Non-finite and negative weights are excluded; zero is retained.
- Degrees of freedom are `distinct (stratum, PSU) pairs - design strata`.
- At least two complete PSUs are required. A design stratum with one PSU adds no
  variance contribution, as in the inspected legacy loop.
- `STATISTICS` and `ONEISYES` fail closed. `NOWRAP` and
  `COLUMNSIZE` remain parsed compatibility no-ops.
- More than one `STRATAVAR` fails closed because the legacy complex-table dialog
  exposes one design-stratum variable.

For each estimate, records are linearized and summed by PSU within design
stratum. If a stratum has `m` PSUs with cluster totals `q_i`, its variance term is:

```text
(m * sum(q_i²) - sum(q_i)²) / (m - 1)
```

Terms are summed across design strata. Two-sided 95% limits use the legacy
`TfromP(0.95, df)` implementation rather than silently substituting a normal
critical value. The design-effect display preserves the inspected legacy
calculation, including its use of the first outcome category within each
exposure row.

## Mechanical foodborne fixture

The checksummed fixture runs:

```text
TABLES potato_salad hamburger STRATAVAR=Sex WEIGHTVAR=Age PSUVAR=household_neighborhood
```

`household_neighborhood` is only a deterministic PSU proxy and `Age` is only a
deterministic weight. They do **not** represent a defensible epidemiologic survey
design. The fixture fixes 96 included records, weighted N 3,917, two design
strata, 57 PSU-within-stratum units, df 55, the four weighted cells, their
standard errors and limits, and adjusted OR/RR/RD.

## Validation and remaining gates

Phase 0 recomputes the immutable expected artifact, exercises resolver failures,
and checks the legacy t anchor. Browser tests open the `.pgm`, run it in the
Program Editor, inspect the result table and risk measures, and exercise the
legacy Advanced Statistics dialog. The JupyterLite TABLES notebook independently
recomputes the PSU aggregation and Taylor variance in Python.

`OUTTABLE` follows the inspected `PrintValuesforCST` shape: one row per
exposure/outcome cell with the original variables plus `COUNT`, `RowPct`,
`ColPct`, `StdErr`, `LCL`, `UCL`, and `DesignEff`. It is session-local,
drop/recreate by name, and readable by a subsequent `READ` and `LIST`. The
browser preserves the source categorical field types instead of coercing every
exposure/outcome column to the legacy DataTable's `Double` declaration.

This evidence establishes a browser-verified candidate, not formal legacy
parity. Persistent/external `OUTTABLE`, meaningful survey-design corpora, edge-case and
domain-estimation review, desktop differential output, experienced-user review,
Rust-kernel migration, and consolidated G5 approval remain open.
