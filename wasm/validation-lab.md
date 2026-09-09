# Epi Info AI Validation Lab

## Purpose

The Validation Lab is the executable, reviewable evidence workspace for the
Epi Info AI epidemiology kernel. It lets an epidemiologist or engineer inspect the
same input, method definition, intermediate values, Rust/WASM result, independent
Python result, legacy Epi Info result when available, tolerance, and provenance in
one browser-based notebook.

The lab supports the repository's
[algorithm validation standard](docs/validation/algorithm-validation-standard.md).
It does not replace that standard, CI, or independent statistical review, and it
is not a second production analysis engine. Python is used only for validation,
exploration, fixture development, and discrepancy investigation. The browser
application continues to call the versioned Rust/WASM kernel for deterministic
epidemiologic computation.

## Evidence model

Each promoted algorithm is examined through three deliberately independent views:

```text
                  Approved versioned fixture
                             |
           +-----------------+-----------------+
           |                 |                 |
           v                 v                 v
     Legacy Epi Info    Python reference    Rust/WASM
     behavior/output    implementation      candidate
           |                 |                 |
           +-----------------+-----------------+
                             |
                             v
                 Comparison and parity report
```

- **Legacy Epi Info** establishes compatibility with the behavior users already
  know. A legacy result is not assumed to be scientifically correct merely because
  it is old.
- **Python scientific packages** provide an independent implementation of the
  selected, explicitly named method. Package name, version, options, and runtime
  are part of the evidence.
- **Rust/WASM** is the candidate implementation and the actual release binary used
  by the browser application.

Agreement across all three is strong evidence. A disagreement is preserved as an
investigation record and resolved at the method level; it is never hidden by UI
rounding or by taking a majority vote.

The lab keeps three kinds of parity separate:

1. **Computational parity** — formulae, estimates, intervals, tests, and numerical
   behavior.
2. **Epi Info behavioral parity** — filters, recodes, weights, missing values,
   zero cells, case sensitivity, dates, warnings, and undefined results.
3. **Presentation parity** — labels, ordering, formatting, significant digits,
   accessibility, and familiar workflow.

## Canonical foodborne-outbreak corpus

The 96-record foodborne-outbreak example is the initial coherent validation
corpus. It is synthetic demonstration data and contains no real case records. The
immutable source currently resides at
[`demo/examples/foodborne-outbreak-investigation.csv`](demo/examples/foodborne-outbreak-investigation.csv).

| Property | Frozen value |
|---|---|
| Corpus ID | `foodborne-outbreak-v1` |
| Records | 96 |
| Variables | 27 |
| SHA-256 | `b6e855c8cc6990abb4c25c4a1d9ee5ddea3c0016567bfc30f372faaa07df9cf5` |
| Classification | Approved synthetic demo fixture |

The source file must not be edited in place after it is promoted into the
validation corpus. A changed byte creates a new corpus version, hash, manifest,
and reviewed expected-output set. Parsing expectations and statistical
expectations are recorded separately.

### Version 1 semantics

- A **case** is `Confirmed`, `Probable`, or `Suspected`.
- A **noncase** is `Not a case`.
- For binary variables, `Yes` and `y` normalize to yes; `No` and `n` normalize to
  no.
- Blank values remain missing. They are not silently converted to no.
- Unless a method specification says otherwise, records missing a required input
  are excluded and the included/excluded counts are reported.
- Text comparisons used by a derivation must name their trimming and case rules.

The case-status frequency anchor is:

| Case status | Count |
|---|---:|
| Confirmed | 22 |
| Probable | 16 |
| Suspected | 6 |
| Not a case | 52 |
| **Broad case / noncase** | **44 / 52** |

The age anchors are `N = 96`, mean `40.802083333333336`, median `40.5`, sample
standard deviation `17.68175973123101`, minimum `5`, and maximum `75`. These values
will become fixtures when frequency and descriptive operations enter the kernel;
they are not yet claims that those operations have passed validation.

### Canonical potato-salad 2 x 2 table

Using the Version 1 case definition and normalized `Potato Salad` exposure gives a
human-checkable acceptance case:

| | Case | Noncase | Total |
|---|---:|---:|---:|
| Potato salad yes | 36 | 12 | 48 |
| Potato salad no | 8 | 40 | 48 |
| **Total** | **44** | **52** | **96** |

The exposed and unexposed attack rates are `0.75` and `1/6`; therefore the crude
risk ratio is exactly `4.5` and the crude odds ratio is exactly `15`. The table is
the preferred Phase 5 acceptance example because both the derivation and core
point estimates can be checked without statistical software.

Stratifying by `Sex` produces the same table in each stratum:

```text
                    Case  Noncase
Potato salad yes      18        6
Potato salad no        4       20
```

The female and male stratum-specific odds ratios and the pooled Mantel-Haenszel
odds ratio are therefore `15`. This becomes the initial stratified-analysis anchor
when that operation enters Phase 5.

### Data-cleaning anchors

Mixed symptom encoding is intentionally retained to exercise raw frequency,
recode, and missing-value behavior:

| Variable | Normalized yes | Normalized no | Missing |
|---|---:|---:|---:|
| Diarrhea | 40 | 56 | 0 |
| Vomiting | 15 | 79 | 2 |
| Nausea | 15 | 77 | 4 |
| Abdominal Cramps | 24 | 70 | 2 |
| Fever | 21 | 70 | 5 |
| Bloody Stool | 4 | 90 | 2 |

Tests must retain both the raw categories and the result of the explicit recode.
For example, raw diarrhea contains `Yes = 34`, `y = 6`, `No = 48`, and `n = 8`;
normalization produces yes `40` and no `56`.

## Corpus tiers

The foodborne source is a seed for deterministic, reviewable derivatives rather
than a reason to maintain many unrelated hand-edited CSV files.

1. **Frozen source** — exact original bytes and manifest.
2. **Normalized views** — explicit recodes and derived case variable.
3. **Subsets** — cases, complete cases, females, males, age groups, and named
   filters.
4. **Metamorphic variants** — deterministic row shuffle, column reorder, safe
   rename, exposure reversal, and whole-dataset duplication.
5. **Pathological variants** — missing exposure, zero cells, empty groups, all or
   no exposure, sparse strata, and extreme imbalance.
6. **Generated cases** — reproducible property-based inputs around plausible
   epidemiologic distributions. Any discovered defect is minimized and retained
   permanently as a regression fixture.

Every derivative records the source corpus ID and hash, generator/version, seed,
ordered transformations, resulting hash, and intended assertion. Generated files
must be reproducible; promoted expected results remain committed review artifacts.

## Validation hierarchy

The lab grows in seven evidence layers:

| Level | Evidence | Initial foodborne example |
|---:|---|---|
| 1 | Hand-checkable anchors | 44 cases; potato-salad RR `4.5`, OR `15` |
| 2 | Legacy Epi Info parity | Captured Classic Analysis output and options |
| 3 | Independent Python parity | Version-recorded SciPy/statsmodels calculations |
| 4 | Metamorphic properties | shuffle, reverse exposure, duplicate, filter |
| 5 | Constructed edge cases | zero cells, missing exposure, empty strata |
| 6 | Property-based testing | seeded Rust/Python cases and saved regressions |
| 7 | Release WASM execution | exact GitLab Pages binary called from Pyodide |

Level numbers describe types of evidence, not an automatic promotion score. Each
algorithm must satisfy all applicable gates G0 through G6 in the validation
standard before its registry state can become `validated`.

## Machine-readable evidence

Notebooks are executable explanations; they are not the source of truth. Approved
inputs and expectations live in data-only fixtures and contain enough metadata to
reproduce the analysis. A 2 x 2 golden records, at minimum:

```json
{
  "id": "foodborne-v1-potato-salad-any-case",
  "dataset": {
    "id": "foodborne-outbreak-v1",
    "sha256": "b6e855c8cc6990abb4c25c4a1d9ee5ddea3c0016567bfc30f372faaa07df9cf5"
  },
  "derivation": {
    "caseValues": ["Confirmed", "Probable", "Suspected"],
    "noncaseValues": ["Not a case"],
    "exposureField": "Potato Salad",
    "yesValues": ["Yes", "y"],
    "noValues": ["No", "n"],
    "missingPolicy": "exclude"
  },
  "table": { "a": 36, "b": 12, "c": 8, "d": 40 },
  "methods": {
    "riskRatioInterval": "katz-log",
    "oddsRatioInterval": "wald-log",
    "confidenceLevel": 0.95
  }
}
```

The corresponding expected-output record names every selected method, correction,
alternative hypothesis, degrees of freedom, comparison rule, and tolerance.
`Fisher exact two-sided`, `Pearson chi-square`, `Yates corrected chi-square`,
`mid-P`, Wald intervals, profile-likelihood intervals, and exact intervals are not
interchangeable labels.

Golden files are never regenerated automatically during ordinary CI. A golden
change is a dedicated, reviewed change explaining whether the cause is a corrected
method, compatibility decision, dependency/toolchain change, or fixture revision.

## Notebook contract

Each notebook must be understandable without reading its source code and must:

- state its purpose, operation/version, validation state, source fixture and hash;
- show derivation rules and included/excluded observations;
- load the same committed fixture and release WASM artifact used by CI;
- show the WASM checksum and Rust engine/version metadata;
- identify Python packages, versions, functions, and options;
- display unrounded structured results before any presentation formatting;
- compare each output using its approved exact, absolute, relative, ULP,
  categorical, or interval rule;
- display warnings, undefined values, and discrepancies explicitly; and
- link back to the machine-readable evidence and registry entry.

The browser notebook uses one Pyodide Python kernel. JavaScript interop loads and
calls the compiled WebAssembly module:

```text
JupyterLite notebook -> Pyodide JS bridge -> versioned TS/WASM boundary -> epi-core WASM
```

Rust is compiled ahead of time; it is not a second notebook kernel. The first lab
load currently requires network access for the pinned Pyodide runtime and
scientific packages. Offline/self-hosted operation remains a separate release
decision.

## CI and release workflow

The authoritative path is:

1. Compile native Rust and run unit, property, and regression tests.
2. Compile the release `wasm32-unknown-unknown` artifact.
3. Verify its required exports, checksum, size, and versioned manifest.
4. Run the same fixtures through the TypeScript adapter and browser smoke path.
5. Build JupyterLite with the release artifact and approved fixtures.
6. Verify the notebook and fixture assets are present in the Pages artifact.
7. Publish only after upstream test and validation-build jobs pass.

The lab may present CI-generated comparison reports, but it must not silently
rewrite expected results. Eventually a parity dashboard should summarize each
module's legacy, Python, native Rust, WASM, and browser status and link every
discrepancy to its detailed evidence record.

## Delivery roadmap

### V0.1 — deployed proof of integration

- One Pyodide notebook loads the deployed Rust/WASM binary.
- The baseline synthetic 2 x 2 fixture demonstrates risk-ratio comparison with
  SciPy.
- The operation remains `candidate`; notebook success is not approval.

### V0.2 — foodborne 2 x 2 candidate lab

- Frozen and manifested `foodborne-outbreak-v1`.
- Derives the potato-salad table in the notebook from record-level data.
- Compares Rust/WASM point estimates, confidence intervals, and chi-square p-values
  with hand calculations, a recorded candidate SciPy reference, and the active
  notebook's version-captured SciPy runtime.
- Enforces fixture assertions, method-specific tolerances, WASM checksum display,
  and GitLab CI artifact-provenance checks.
- Keeps legacy parity explicitly open until the legacy 2 x 2 corpus, outputs, and
  exact options have been captured and classified.

### V0.3 — exact-tail candidate lab

- Rust/WASM owns fixed-margin Fisher lower, upper, one-tailed, and
  probability-ordered two-tailed p-values.
- The two-sided compatibility contract retains legacy Epi Info's `1.000001`
  probability comparison tolerance; it is named in the result schema rather than
  hidden as an implementation detail.
- Rust/WASM owns lower, upper, and one-tailed mid-p values by subtracting half the
  observed-table probability from each inclusive Fisher tail.
- The notebook independently enumerates the same distribution with SciPy for the
  foodborne potato-salad table.
- CI exercises Fisher results for all 100 cases in the legacy-derived fixture and
  enforces mid-p tail invariants.
- Engine and result schema are version `0.3.0`. The operation remains a candidate
  pending expanded edge evidence and independent approvals.

### V0.4 — current conditional odds-ratio candidate lab

- Rust/WASM owns the conditional maximum-likelihood odds ratio and central
  Fisher and mid-p exact confidence limits.
- The result schema records finite, zero, positive-infinity, and unavailable
  states without placing non-finite values into JSON.
- The foodborne notebook independently compares the conditional estimate and
  Fisher interval with `scipy.stats.contingency.odds_ratio`, and independently
  inverts `scipy.stats.nchypergeom_fisher` tails for the mid-p interval.
- CI compares Fisher confidence limits for all 100 legacy-derived tables and
  checks zero/infinity endpoints, interval containment, and exposure-reversal
  reciprocity.
- Engine and result schema are version `0.4.0`; the operation remains a candidate
  pending broader pathological evidence, performance/Worker routing, and review.

### V0.5 — current stratified candidate lab

- The companion `validate-stratified2x2.ipynb` loads the deployed WASM artifact
  and immutable V0.5 fixture from GitLab Pages.
- It verifies the foodborne CSV hash and independently re-derives Female/Male
  strata from Potato Salad, Case Status, and Sex before evaluating the fixture.
- It compares adjusted MH odds/risk ratios and corrected/uncorrected association
  tests with a direct independent Python calculation.
- Confidence-limit evidence currently comes from the legacy-formula Rust test and
  fixture; independent package comparison, foodborne-derived strata, homogeneity,
  and pathological/metamorphic cases remain open.
- Cleaning, descriptive, and missingness anchors move to the next operation slice.

### V0.6 — odds-ratio homogeneity lab

- The stratified notebook now loads a non-zero three-stratum fixture and calls
  the deployed standard Breslow-Day, Tarone-corrected, and legacy-labelled Woolf
  Rust/WASM exports.
- Direct Python fixed-margin expected-cell calculations independently reproduce
  both Breslow-Day statistics; a direct weighted log-odds calculation reproduces
  the legacy `bdOR` method.
- SciPy `chi2.sf` independently anchors all three `k - 1` degree-of-freedom
  p-values. The canonical foodborne sex strata additionally enforce the expected
  zero-statistic / p=1 invariant.
- At V0.6 this remained candidate evidence with RR homogeneity open; V0.7 below
  adds that method. Sparse/extreme corpora, performance evidence, and independent
  review remain open.

### V0.7 — risk-ratio homogeneity lab

- The deployed WASM and immutable heterogeneous fixture now include the legacy
  `bdRR` weighted log-risk dispersion statistic and its `k - 1` df p-value.
- The notebook independently derives stratum risk ratios and inverse log-risk
  variances, pools them on the log scale, and compares the result and SciPy
  survival probability with the Rust/WASM candidate.
- The familiar “Breslow-Day test for Risk Ratio” label remains visible while the
  result contract records its actual Woolf-style method identity.
- Expanded sparse/extreme corpora, native/WASM differential evidence,
  performance evidence, and formal review remain open.

### V0.8 — exact adjusted odds-ratio lab

- The stratified notebook loads foodborne and heterogeneous candidate anchors,
  then invokes the deployed conditional common-OR CMLE and central Fisher-limit
  Rust/WASM exports.
- Independent Python constructs each stratum's fixed-margin binomial
  coefficients in log space, convolves the product-hypergeometric distribution,
  and uses SciPy root finding for the estimate and tail inversions.
- Native and browser tests additionally cover zero and positive-infinity
  estimates and confidence-limit endpoints.
- The operational fixture adds empty strata, support-width rejection,
  maximum-strata work rejection, order/label metamorphism, and a five-second CI
  runner regression budget. Browser E2E proves Worker cancellation and clean
  recovery with a new private WASM instance.
- The candidate records hard support, work, and cell-count bounds. Broader
  reviewed legacy outputs and additional differential/fuzz evidence remain open.
  G5 is intentionally deferred to one consolidated statistical and implementation
  review across all candidate outputs.

### V0.9 — Classic Analysis frequency lab

- `validate-frequency.ipynb` verifies the canonical foodborne CSV hash and
  independently derives the four Case Status categories from all 96 records.
- It compares deployed Rust/WASM proportions, cumulative proportions, and 95%
  confidence limits with the frozen V0.9 fixture and SciPy beta quantiles.
- Boundary checks preserve the audited legacy switch from exact limits below 300
  records to Wilson limits at 300 or more, including the legacy 100%–100% case.
- Multiple variables, strata, weights, output tables, broader edge corpora, and
  formal approval remain open. G5 is deferred to the consolidated output review.

### V0.10 — Classic Analysis means lab

- `validate-means.ipynb` verifies the canonical foodborne CSV hash and derives
  all 96 Age observations.
- Python `statistics` independently anchors total, mean, sample variance, and
  standard deviation; an explicit legacy-rank implementation anchors quartiles,
  while a frequency counter with a deterministic tie rule anchors mode.
- The notebook then calls the deployed bounded Rust/WASM `means_*` exports and
  compares every descriptive output with the immutable V0.10 fixture.
- Cross-tab inferential output, broader boundary corpora, and formal approval
  remain open. G5 stays deferred to the consolidated output review.

### V0.11 — Visual Dashboard Rates lab

- `validate-rate.ipynb` verifies the canonical foodborne CSV hash and derives
  the 22 Confirmed records among 96 records with a non-missing ID.
- An independent Python expression anchors 22.916666666666668 per 100 before
  the notebook calls the deployed Rust/WASM `rate_calculate` export.
- A zero-denominator check demonstrates the candidate's fail-closed boundary.
- Full aggregate/condition/grouping behavior, broader boundary corpora, legacy
  output comparison, and formal approval remain open. G5 stays consolidated.

### V0.12 — StatCalc Population Survey lab

- `validate-population-survey.ipynb` independently translates the audited C#
  `Norm`, `ANorm`, finite-population correction, and rounding sequence.
- It checks all seven frozen legacy defaults, a clustered-design case, and an
  invalid-input boundary against the deployed Rust/WASM export.
- A SciPy normal-quantile table is shown as an independent modern comparator;
  the candidate contract deliberately preserves the legacy algorithm.
- Broader legacy corpora, boundary/property evidence, export/print behavior, and
  formal approval remain open. G5 stays consolidated.

### V0.13 — StatCalc Cohort or Cross-Sectional lab

- `validate-cohort-cross-sectional.ipynb` independently translates the audited
  C# normal-tail, effect-conversion, Kelsey, Fleiss, continuity-correction, and
  independent group-ceiling sequence.
- It checks CDC's source-embedded example and an unequal-group design against
  the deployed Rust/WASM exports, with a no-effect fail-closed check.
- SciPy provides an independent comparison of the confidence and power normal
  deviates; it does not replace the deliberately preserved legacy sequence.
- Broader legacy output, protective-effect, property/boundary, implementation,
  and statistical review remain open. G5 stays consolidated.

### V0.14 — StatCalc Unmatched Case-Control lab

- `validate-unmatched-case-control.ipynb` independently translates the audited
  C# normal-tail, exposure-conversion, Kelsey, Fleiss, continuity-correction,
  and independent case/control ceiling sequence.
- It checks CDC's source-embedded example and an unequal controls-to-cases
  design against distinct deployed Rust/WASM exports.
- A no-effect design fails closed, and SciPy independently compares the normal
  deviates without replacing the preserved legacy algorithm.
- Broader legacy output, protective-effect, property/boundary, implementation,
  and statistical review remain open. G5 stays consolidated.

### V0.15 — StatCalc Chi Square for Trend lab

- `validate-chi-square-trend.ipynb` loads the deployed Rust/WASM buffer exports
  and the immutable four-level trend fixture.
- Independent Python directly recomputes the Extended Mantel-Haenszel variance,
  statistic, reference-row odds ratios, and `erfc(sqrt(X²/2))` p value.
- The notebook compares every candidate value at an explicit tolerance and
  reports a transparent PASS object.
- Broader legacy output, zero/fractional-cell decisions, property/boundary,
  implementation, and statistical review remain open. G5 stays consolidated.

### Classic TABLES V0.11 validation

- `validate-tables.ipynb` derives both the unstratified foodborne potato-salad by
  case-status matrix and the two matrices within Sex directly from the checksummed CSV.
- Independent NumPy/SciPy calculations verify row and column percentages,
  expected cells, Pearson chi-square, degrees of freedom, probability, and
  sparse-cell diagnostics against the TypeScript candidate contract.
- The binary `TABLES potato_salad hamburger` fixture separately proves the
  category-to-cell mapping and passes those cells to the same deployed
  Rust/WebAssembly operation validated by `validate-2x2.ipynb`.
- The `STATISTICS=FISHER` fixtures cover the original 2 × 4 anchor, a foodborne
  4 × 2 matrix, and a synthetic 3 × 3 matrix through independent fixed-margin
  recursion. Phase 0 also checks the visible 200,000-table limit.
- The foodborne `vomiting × Sex` fixture verifies the legacy missing-value
  default (OFF), two excluded records, `SET MISSING=ON`, the visible two-record
  custom `Not recorded` row, and restoration to OFF plus the default `Missing`
  label in source order.
- The `TABLES potato_salad hamburger STRATAVAR=Sex` fixture fixes two explicit
  binary strata. The notebook independently derives their cells and recomputes
  Mantel–Haenszel OR/RR, corrected and uncorrected association statistics, and
  the df=1 probability; Phase 0 additionally anchors conditional OR and all
  Rust/WASM homogeneity results.
- The mechanical `TABLES potato_salad case_status WEIGHTVAR=Age` fixture fixes
  weighted N at 3,917 and the complete 2 × 4 weighted matrix. Python independently
  sums the frequency weights; Age is not claimed to be a meaningful survey weight.
- Program Editor fixtures additionally verify `STATISTICS=NONE`, numeric
  `ONEISYES`, the inspected `NOWRAP`/`COLUMNSIZE` no-ops, and ordinary plus
  GROUPVAR-expanded `OUTTABLE` materialization and READ-back.
- The notebook independently recomputes the V0.2 Complex Sample Tables
  `PSUVAR` fixture by aggregating linearized values within PSU and design
  stratum. It fixes weighted N 3,917, 57 PSU/stratum units, df 55, cell standard
  errors and t limits, and survey OR/RR/RD. Household Neighborhood and Age are
  explicitly mechanical test proxies, not a defensible survey design.
- The notebook does not treat candidate contract validation as desktop Epi Info parity.
- The session-local complex `OUTTABLE` fixture fixes the inspected nine-column
  result shape and proves `TABLES → READ → LIST`; external persistence remains open.
- The mechanical Complex Sample Frequencies fixture applies the same independent
  PSU-within-stratum Taylor construction to weighted Case Status proportions,
  checks linear limits and the inspected first-category design effect repeated
  across rows, and fixes the legacy nine-column CSF `OUTTABLE` shape. It uses
  Household Neighborhood and Age only as deterministic test proxies.
- The mechanical Complex Sample Means fixture independently derives Age means
  by Sex, with Case Status as design strata and Household Neighborhood as PSU.
  Python recomputes PSU-within-stratum Taylor standard errors, design df/t
  limits, observed ranges, and the covariance-aware Female-minus-Male contrast.
  The same cell verifies the nine-column browser-adapted CSM result-table fixture
  and its three rows. The notebook keeps this separate from desktop parity because
  desktop CSM disables Output to Table and defines no working result schema.
  These fields are deterministic test proxies, not a defensible survey design.
- Meaningful survey-design corpora, exact legacy
  weight/wildcard edges, persistent adapters, desktop differential evidence,
  and G5 approval remain open.

### Later releases

- Extend the corpus to additional rate and sample-size branches, regression, dates/times,
  epidemic curves, and programming-workflow fixtures as the corresponding kernel
  operations mature.
- Add seeded differential/property testing and a permanent discrepancy corpus.
- Generate a reviewable parity dashboard from immutable CI evidence.
- Evaluate self-hosted Pyodide and pinned scientific wheels for offline use.

## Current limitations

- `epi.table2x2` remains a candidate in the algorithm registry.
- The legacy-derived 100-case corpus covers Fisher one- and two-tailed results,
  but it does not contain mid-p tails or all exact-method edge cases.
- Conditional odds-ratio methods still require broader independently reviewed
  extreme-margin/convergence and legacy-output cases before promotion; automated
  performance limits and Worker cancellation are now covered.
- The foodborne corpus anchors described here are verified derivations, not proof
  that every corresponding operation is implemented or validated.
- Statistical and implementation approvals required by gate G5 are outstanding
  and will be completed once for the consolidated output set.
