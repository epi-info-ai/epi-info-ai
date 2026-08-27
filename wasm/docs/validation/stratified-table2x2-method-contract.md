# Stratified 2 x 2 method contract (candidate V0.8)

`epi.stratified2x2` receives 1 to 1,024 ordered strata. Each cell must be a
non-negative JavaScript safe integer; stratum IDs must be non-empty and unique.
Empty strata are retained in the request and reported as ignored.

Rust/WASM owns the Mantel-Haenszel sums, adjusted odds ratio, adjusted risk ratio,
legacy Epi Info confidence-limit formulas, corrected/uncorrected association
statistics, odds-ratio homogeneity statistics, and chi-square survival
probabilities. TypeScript validates and copies the request, maps non-finite
results to `null`, and supplies presentation warnings.

The formulas are direct translations of `StatisticsRepository/Strat2X2.vb`:

- adjusted OR: `sum(a*d/n) / sum(b*c/n)`;
- adjusted RR: `sum(a*(c+d)/n) / sum(c*(a+b)/n)`;
- OR limits: the legacy Robins-Breslow-Greenland variance expression;
- RR limits: the legacy log-scale variance expression; and
- MH tests: squared sum of `(a*d-b*c)/n`, optionally reduced by 0.5 in absolute
  value, divided by the sum of the fixed-margin variance.

The WASM adapter loads strata into a fixed 1,024-table scratch area and calls the
kernel synchronously without yielding between load and calculation. The browser
owns that WASM instance inside a dedicated module Worker. Requests are serialized;
cancellation terminates the Worker and its partially written scratch state, and
the next request creates a clean instance.

## OR/RR homogeneity semantics

V0.6 exposes three separately identified candidate results with `k - 1` degrees
of freedom:

- `breslowDayOddsRatio` is the standard uncorrected fixed-margin statistic,
  solving the expected exposed-case cell under the common MH odds ratio;
- `breslowDayTaroneOddsRatio` subtracts Tarone's aggregate expected-cell
  correction; and
- `legacyBreslowDayOddsRatio` directly ports `Single2x2.bdOR`, a Woolf weighted
  log-odds dispersion that the legacy output labels “Breslow-Day test for Odds
  Ratio.”

V0.7 adds `legacyBreslowDayRiskRatio`, a direct port of `Single2x2.bdRR`.
It is a Woolf weighted log-risk-ratio dispersion and retains the familiar legacy
label “Breslow-Day test for Risk Ratio.” It requires at least two strata,
positive exposed and unexposed case counts, and non-zero finite log-risk
variance. It is separately identified in the result contract rather than being
presented as a fixed-margin expected-cell method.

The browser retains that familiar legacy label and marks its method identity,
then adds the standard uncorrected statistic as a clarified new branch. Fixed-
margin results require at least two strata and a finite positive common odds
ratio. The legacy-labelled Woolf result additionally requires four positive
cells in every stratum. Unavailable results are `null` with a warning; no
continuity correction is silently introduced.

## Exact adjusted odds-ratio semantics

V0.8 adds the conditional maximum-likelihood common odds ratio and central
Fisher confidence limits shown by legacy Classic Analysis as “Adjusted OR
(MLE).” The candidate conditions on each stratum's row and column margins,
convolves the per-stratum hypergeometric coefficient polynomials, solves the
conditional expected sufficient statistic for the CMLE, and inverts inclusive
upper/lower tails at `(1 - confidenceLevel) / 2` for the limits.

The result uses explicit finite, zero, positive-infinity, and unavailable states.
The reviewed candidate is deliberately bounded to a combined support width of
4,096, two million convolution multiply-adds, and legacy-compatible cell counts
no greater than 999,999. An exceeded bound or numerical failure returns
`unavailable` with a warning; it never substitutes an asymptotic estimate.
Because the kernel uses a shared scratch workspace, the Worker finishes all calls
synchronously on one WASM instance. The main thread never owns or shares that
instance. Parallel execution would require separate Workers and separate WASM
instances.

The operation is not approved for production inference until validation gates
G0 through G6 are complete.

The V0.5 fixture is derived from all 96 canonical foodborne records using Potato
Salad as exposure, Case Status as outcome, and Sex as the stratifier. Both Female
and Male strata independently produce `18/6/4/20`; the fixture records the source
CSV hash and the smoke suite re-derives those cells before testing the WASM result.
Identical stratum odds ratios provide a zero-statistic foodborne invariant.
The V0.7 non-zero fixture adds three heterogeneous positive-cell tables, direct
legacy formula provenance, independent Python expected-cell and weighted
log-effect calculations, and SciPy chi-square p-value anchors for all OR/RR
homogeneity results.
The V0.8 exact fixture adds foodborne and heterogeneous conditional CMLE/Fisher
anchors generated independently with log-binomial convolution and SciPy root
finding, plus explicit zero/infinity boundary tests.
The operational fixture adds empty strata, exact support rejection, maximum-strata
work rejection, metamorphic order/label invariants, a CI performance budget, and
browser cancellation/recovery evidence. The full gate matrix is recorded in
[`stratified-v0.8-evidence.md`](stratified-v0.8-evidence.md). G5 remains deferred
to the consolidated review of all candidate outputs.

## Current-form adapter semantics

`deriveStratifiedTable2x2` receives records plus three distinct field names and
explicit sets of exposed and case values. Nonblank values outside those sets form
the corresponding reference groups. A record missing exposure, outcome, or
stratum is excluded and counted. Strata are sorted by their displayed value and
the derivation returns source/included/excluded counts, observed reference values,
and the equivalent `TABLES ... STRATAVAR=...` command alongside the kernel input.

This explicit mapping is necessary for browser-imported text fields such as the
four-level Case Status example. It is not silently written back as a legacy
Epi Info field type or PGM `RECODE`; saved-program parity remains open.
