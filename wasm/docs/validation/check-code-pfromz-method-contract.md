# Check Code PFROMZ method contract

Status: browser parity candidate, 2026-09-23.

## Scope and meaning

`PFROMZ(z)` is retained **Enter Check Code** syntax. It returns the percentile
rank of a finite Z-score under the standard normal distribution:

`percentile = 100 * P(Z <= z)`.

It does not return a hypothesis-test p-value. The UI, examples, and documentation
must call the result a **normal percentile**. Classic Analysis is outside this
contract because its retained rule explicitly reports `PFROMZ` unsupported.

## Retained computation profile

The candidate reproduces the Enter rule and `AnthStat.NutriDataCalc` behavior:

1. Evaluate the AS66 lower-tail standard-normal approximation embedded in the
   retained anthropometry library.
2. Multiply the probability by 100.
3. Round to two decimal places using midpoint-to-even behavior corresponding to
   the retained C# `Math.Round(value, 2)` call.
4. Replace a rounded value of 100 with the retained upper ceiling of `99.99`.
5. Propagate a missing argument as missing; reject non-numeric and non-finite
   arguments through typed validation.

## Evidence and acceptance

- Production candidate: `wasm/app/check-code/check-code-normal.ts`.
- Legacy evidence: Enter `Rule_PFROMZ.cs` and
  `AnthStat/NutriDataCalc.cs::GetPercentile`.
- Fixed reference fixture:
  `wasm/tests/fixtures/algorithm-validation/check-code-pfromz-v0.1.json`.
- Independent oracle:
  `wasm/validation-lab/content/validate-check-code-pfromz.ipynb`, using Python
  `math.erf` rather than the AS66 production approximation.
- Automated tests cover the fixed corpus, monotonicity, central symmetry before
  extreme-tail ceiling behavior, missing propagation, and type rejection.

Passing these checks establishes a bounded implementation candidate. It does not
establish complete desktop parity or statistical approval.

## Known gaps

- Capture desktop Enter outputs across the fixed fixture on a field tester's
  retained installation.
- Confirm midpoint cases and locale-independent numeric parsing against desktop.
- Obtain experienced-user review of terminology and the intentional
  Check-Code-only scope.
- Decide whether the surprising `99.99` ceiling should remain only in the parity
  branch while a future namespaced function exposes an uncapped probability.
