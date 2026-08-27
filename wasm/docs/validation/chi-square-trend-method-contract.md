# Chi Square for Trend method contract — V0.15

Status: candidate; consolidated G5 statistical and implementation review pending.

## Compatibility floor

The legacy `ChiSquareControl` accepts ordered rows containing Exposure Score,
Cases, and Controls; displays the crude odds ratio for each row relative to the
first row; and reports “Chi Square for linear trend (Extended Mantel-Haenszel)”
with a one-degree-of-freedom p value. The browser screen retains those names,
column order, Add Row action, and reference-row behavior.

For row `i`, let `x_i` be its score, `a_i` its cases, `b_i` its controls, and
`m_i = a_i + b_i`. With `n1 = sum(a_i)`, `n2 = sum(b_i)`, and `n = n1 + n2`,
the audited legacy statistic is:

`T1 = sum(a_i*x_i)`, `T2 = sum(m_i*x_i)`, `T3 = sum(m_i*x_i*x_i)`

`V = n1*n2*(n*T3 - T2*T2) / (n*n*(n-1))`

`X2 = (T1 - (n1/n)*T2)^2 / V`

The row odds ratio is `(a_i*b_0)/(b_i*a_0)`. The p value is the chi-square
survival probability for one degree of freedom.

## Browser/WASM boundary

TypeScript validates and copies at least two and at most 1,024 complete rows into
the Rust buffer. Rust owns the statistic, odds ratios, and p value. The contract
rejects non-finite scores, negative counts, no score variation, absent case or
control totals, and zero cells that make the legacy odds-ratio display undefined.
No continuity correction is silently introduced.

## Evidence and limitations

The fixture `chi-square-trend-v0.15.json` contains a monotone four-level example
whose statistic and odds ratios are independently derived. Native Rust tests,
release-WASM export/parity checks, browser workflow tests, and the JupyterLite
notebook form candidate evidence. This is not statistical approval; G5 remains
deferred to the consolidated review of all outputs.
