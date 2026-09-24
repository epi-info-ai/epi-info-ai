# Check Code ZSCORE method contract

Status: governed browser candidate, 2026-09-23.

## Scope

`ZSCORE(reference, metric, measurement, axis, sex)` is retained **Enter Check
Code** syntax for anthropometric Z-scores. The browser candidate supports the
reference and metric aliases routed by the retained Enter rule for CDC 2000,
WHO 2006, WHO 2007, and NCHS/WHO 1977-1978. Sex retains the legacy coding of
`1 = male` and `2 = female`; the axis is normally age in months, height, or
length according to the selected metric.

The retained Classic Analysis rule explicitly reports ZSCORE unsupported, so
this contract does not add ZSCORE to Classic Analysis.

## Reference provenance and calculation

`scripts/generate-check-code-zscore-reference.mjs` extracts the 24 tables used
by the retained Enter implementation from the pinned
`AnthStat/NutriDataCalc.cs`. The generated module records SHA-256
`2e3bdcdcb99d33c488abb85c88e65d9300c0b157101da74b77887e243a582eca`
and version `epi-info-7-anthstat-2e3bdcdcb99d`. A changed source hash requires
regeneration and review; generated values must not be hand-edited.

CDC and WHO calculations use the retained LMS expression. WHO values outside
plus or minus three standard deviations use the retained WHO adjustment.
NCHS values derive separate lower and upper standard-deviation estimates from
the 5th, 10th, 25th, 50th, 75th, 90th, and 95th percentiles. Supported
intermediate axes use the interpolation rules inspected in the retained code.
Missing input, an unsupported reference/metric, invalid sex coding, or an axis
outside the retained domain returns missing.

Each evaluation records only the canonical reference, metric, reference-table
version, and whether a value was available. Measurements, age/axis, sex, and
the resulting Z-score are excluded from the general Check Code audit receipt.

## Evidence and remaining gates

- Production candidate: `app/check-code/check-code-zscore.ts`.
- Generated reference asset: `app/check-code/check-code-zscore-reference.ts`.
- Fixed oracle fixture:
  `tests/fixtures/algorithm-validation/check-code-zscore-v0.1.json`.
- Independent-formula notebook:
  `validation-lab/content/validate-check-code-zscore.ipynb`.
- Typed parser/runtime tests cover execution, missing results, audit provenance,
  all four reference families, and interpolation.

The notebook recomputes exact-row values from explicit LMS or percentile-spread
parameters without importing production code. Remaining parity gates are
desktop Enter differentials, external confirmation of the reference assets and
supported domains, boundary/interpolation review, and epidemiology/nutrition
specialist approval. Until those gates close, the UI and documentation must call
this a candidate rather than full scientific parity.
