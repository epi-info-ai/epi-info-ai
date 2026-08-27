# `epi.means` V0.10 method contract

## Scope and status

`epi.means` is a candidate single-variable, unweighted, ungrouped descriptive
operation over the current form. G5 is deliberately deferred to the consolidated
review across all candidate outputs. The operation is not statistically approved.

## Input and exclusions

The TypeScript adapter accepts a field name and records. Finite numbers and
finite numeric strings are included; blank, null, boolean, non-numeric, and
non-finite values are excluded and counted. At least two observations are
required in V0.10. The bounded WASM scratch buffer accepts at most 65,536 values,
requires sequential writes, and rejects non-finite input.

## Candidate output and formulas

- Observations: included value count.
- Total and mean: arithmetic sum and `sum / n`.
- Variance: sample sum of squared deviations divided by `n - 1`.
- Standard deviation: square root of sample variance.
- Minimum and maximum: endpoints after ascending numeric sort.
- Quartiles and median: for `p` in 0.25, 0.5, and 0.75, use rank `n × p`;
  when the rank is integral, average sorted values at one-based ranks `r` and
  `r + 1`; otherwise use the value at `ceil(n × p)`.
- Mode: the lowest numeric value among categories tied for greatest frequency,
  matching the audited ascending legacy working table.

The result records operation/schema/engine versions, method identities, source
and included counts, exclusions, warnings, and the generated `MEANS` command.

## Frozen evidence and remaining gates

`foodborne-means-v0.10.json` fixes the canonical CSV hash and all Age anchors.
The JupyterLite notebook independently derives them with Python `statistics`, an
explicit legacy-rank implementation, and a frequency counter, then compares the
deployed Rust/WASM artifact. Native Rust, release-WASM, adapter, and browser tests
consume the same fixture.

Reviewed legacy output, broader pathological/property evidence, cross-tabulated
methods, performance review on lower-powered devices, implementation approval,
and the consolidated G5 review remain open.
