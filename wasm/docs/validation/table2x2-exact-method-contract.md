# 2 x 2 exact-method compatibility contract

Status: candidate, engine/result schema `0.4.0`

This contract defines the fixed-margin exact p-values, conditional odds ratio,
and exact odds-ratio confidence limits returned by
`epi.table2x2`. It is the compatibility boundary between the legacy Epi Info
calculation and the Rust/WASM implementation; labels such as "Fisher exact" are
not sufficient method specifications on their own.

## Legacy evidence

- `Epi.Statistics/Single2x2.cs`, `ExactTests`, constructs the conditional
  distribution and returns lower Fisher, upper Fisher, probability-ordered
  two-sided Fisher, lower mid-p, and upper mid-p values.
- `StatisticsRepository/EIExact.vb`, `CalcExactPVals`, implements the same tails
  in log space and documents the maximum polynomial degree as 100,000.
- `StatisticsRepository/Table.vb`, `TableBchi`, displays the smaller lower/upper
  Fisher tail as the one-tailed p-value, the probability-ordered value as the
  two-tailed p-value, and the smaller mid-p tail as "Mid-p exact".
- `Epi.UnitTests/Data/TwoBy2Stats.csv` and `AnalysisTest.cs`, `TwoByTwoTest`, record
  100 legacy Fisher p-values and exact confidence-limit expectations. The browser fixture at
  `demo/tests/fixtures/two-by-two.json` joins those results to their source table
  counts.

## Defined calculation

For table cells `a`, `b`, `c`, and `d`, condition on both row and column margins.
Enumerate every feasible value of `a` under the resulting hypergeometric
distribution.

- `left`: inclusive probability of candidates less than or equal to observed
  `a`.
- `right`: inclusive probability of candidates greater than or equal to observed
  `a`.
- `oneTailed`: the smaller of `left` and `right`, matching the legacy UI.
- `twoTailed`: the sum of probabilities for tables whose probability is at most
  `1.000001` times the observed-table probability. The multiplier is a legacy
  compatibility tolerance and is part of the named method identity.
- `midP.left` and `midP.right`: the corresponding inclusive Fisher tail minus
  half the observed-table probability.
- `midP.oneTailed`: the smaller mid-p tail.

The public result names the methods as
`conditional-hypergeometric-probability-ordering-epi-info-1.000001` and
`conditional-hypergeometric-half-observed`.

For an odds parameter `theta`, weight every feasible table by its central
hypergeometric coefficient times `theta^a`. The conditional maximum-likelihood
estimate is the non-negative `theta` whose conditional mean equals observed `a`.
The confidence limits invert one-sided tails at `alpha/2`:

- Fisher lower: `P_theta(X >= a) = alpha/2`;
- Fisher upper: `P_theta(X <= a) = alpha/2`;
- mid-p lower: `P_theta(X > a) + 0.5 P_theta(X = a) = alpha/2`;
- mid-p upper: `P_theta(X < a) + 0.5 P_theta(X = a) = alpha/2`.

These are named `conditional-noncentral-hypergeometric-mean-root`,
`conditional-noncentral-hypergeometric-central-tail-inversion`, and
`conditional-noncentral-hypergeometric-mid-p-tail-inversion` in the result.

## Inputs and failure semantics

- Cell counts must be non-negative JavaScript-safe integers.
- An all-zero table is rejected before the kernel call.
- Enumeration supports at most 100,000 feasible tables, matching the current
  legacy `MAXDEGREE` ceiling. Larger or numerically unrepresentable exact
  calculations return `null` exact results and an explicit diagnostic warning;
  asymptotic results remain separately identified.
- Degenerate but non-empty fixed-margin distributions are enumerated rather than
  silently corrected for p-values. If the support contains only one feasible
  table, the conditional odds parameter and its limits are `unavailable`, matching
  the legacy "no informative strata" condition.
- A point estimate or limit at zero is returned with state `zero`; a positive
  infinite endpoint is returned with state `positive-infinity`. JSON therefore
  preserves boundary meaning without encoding non-finite numbers.
- Root or distribution failure is returned with state `unavailable` and an
  explicit diagnostic. Confidence level must be strictly between zero and one.
- No continuity correction or automatic alternative-hypothesis selection is
  applied to Fisher or mid-p values.

## Numerical implementation and evidence

Rust/WASM computes log hypergeometric and noncentral-hypergeometric weights with
pinned `libm`, scales by the largest log weight before summation, and solves
conditional equations in log-odds space. The
TypeScript adapter only validates inputs, converts non-finite kernel results to
the contract's unavailable state, and assembles the versioned response.

Current automated evidence includes:

- native Rust unit tests for the foodborne table, invalid inputs, degeneracy,
  tail ranges, and mid-p invariants;
- the foodborne `36/12/8/40` table independently reproduced with SciPy central
  and noncentral hypergeometric distributions in the JupyterLite Validation Lab;
- all 100 legacy-derived Fisher one- and two-tailed cases, compared at `1e-9` to
  accommodate the source fixture's ten-decimal serialization;
- all 100 legacy Fisher exact lower and upper odds-ratio limits;
- zero/infinity boundary and exposure-reversal reciprocity tests; and
- TypeScript/WASM contract, checksum, build, and browser tests.

This evidence does not promote the operation beyond `candidate`. Statistical and
implementation approval, independently reviewed pathological/extreme-margin
fixtures, performance/Worker routing, and formal review remain open gates.
