# `epi.frequency` V0.9 method contract

## Scope and status

`epi.frequency` is a candidate single-variable, unweighted, unstratified
frequency operation over the current form. It is not statistically approved.
G5 review is intentionally deferred and will be performed once across all
candidate outputs.

## Input and grouping

The adapter accepts a field name, records, `includeMissing`, and a fixed 0.95
confidence level. Values retain their typed identity. Numeric categories sort
numerically, booleans sort false then true, strings sort by locale comparison,
and an included missing category sorts last. Empty strings, `null`, and
`undefined` are missing. When missing is excluded, it is removed from the
denominator and reported as `excludedMissing`.

## Output

Each category contains its value, frequency, proportion, cumulative proportion,
and lower and upper 95% confidence limits. The result also records the included
denominator, excluded-missing count, generated `FREQ` command, engine identity,
schema version, and confidence-method provenance.

## Candidate formulas

For frequency `x` and included total `n`, proportion is `x / n`.

- When `n < 300`, limits are the central 95% Clopper–Pearson interval, matching
  the audited legacy exact branch.
- When `n >= 300`, limits use the Wilson score interval with `z = 1.96`.
- The audited legacy special case is preserved: when `x = n` in the Wilson
  branch, both limits are 1.
- Zero, non-integral, non-finite, negative, `x > n`, and `n <= 0` kernel inputs
  return unavailable (`NaN`). A dataset with no included records is rejected by
  the TypeScript adapter.

## Frozen V0.9 evidence

The canonical foodborne CSV is fixed by SHA-256 in
`foodborne-frequency-v0.9.json`. Its `Case Status` counts are Confirmed 22, Not a
case 52, Probable 16, and Suspected 6 from 96 records. The confidence anchors are
independently calculated exact intervals. The JupyterLite notebook compares the
deployed Rust/WASM exports with SciPy's beta quantiles and those frozen anchors.

Remaining gates include a reviewed legacy-output corpus, broader pathological
and property evidence, implementation review, and the consolidated G5 review.
