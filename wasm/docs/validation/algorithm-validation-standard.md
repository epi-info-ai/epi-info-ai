# Algorithm validation standard

## Purpose and scope

This standard applies to every deterministic Epi Info AI algorithm implemented in
Rust/WASM or supplied through a reviewed kernel dependency. An operation is not a
"validated Epi Info" result until its evidence pack passes every applicable gate
below. UI demonstrations and exploratory Python results must be labeled separately.

Validation establishes three distinct properties:

1. **Method correctness:** the implementation performs the documented statistical
   method.
2. **Epi Info compatibility:** differences from the legacy Epi Info method,
   defaults, corrections, and edge semantics are known and approved.
3. **Runtime equivalence:** native Rust and release browser WASM produce equivalent
   results from the same versioned request.

Agreement with one library is evidence, not proof. Reference implementations may
share formulas, source, numerical routines, or defects; disagreements require
method-level adjudication rather than majority voting.

## Validation states

| State | Meaning | Product use |
|---|---|---|
| `experimental` | Method or dependency is under investigation | Developer/research output only |
| `candidate` | Contract and fixtures exist; some gates remain | Demo with an explicit validation warning |
| `validated` | All applicable gates passed and approval is recorded | May be labeled as an Epi Info result |
| `restricted` | Validated only for a documented input/method subset | Production only inside that subset |
| `retired` | Replaced or withdrawn; evidence remains archived | Existing provenance remains readable |

The current 2 x 2 spike remains a candidate until the legacy corpus, exact methods,
confidence intervals, edge semantics, native/WASM parity, and review gates are
complete.

## Required algorithm evidence pack

Every operation version has a reviewable directory containing:

- a method specification and citations;
- the versioned request and result schemas;
- a fixture manifest and data-only fixtures;
- generators for synthetic/randomized cases, with fixed seeds;
- reference-run metadata and captured outputs;
- native Rust, WASM parity, property, fuzz, and performance results;
- known differences, limitations, numerical tolerances, and supported domain;
- dependency and source-review records; and
- dated statistical and engineering approvals.

The repository-wide state and gate summary is machine-readable at
[`tests/fixtures/algorithm-validation/registry.json`](../../tests/fixtures/algorithm-validation/registry.json).
CI rejects unknown states, missing gates or evidence files, duplicate operation
IDs, and any `validated` or `restricted` entry without completed gates and both
required approvals.

The manifest records at minimum:

```text
operation ID and schema version
method ID, options, defaults, and confidence level
fixture ID, purpose, source, and sensitivity classification
inputs and expected outputs, including undefined/warning states
reference implementation, package/version, platform, and command/options
comparison rule per output: exact, absolute, relative, ULP, categorical, or interval
tolerance rationale and reviewer
random seed or source-document citation
engine source revision, Rust version, WASM target, and build profile
approval state, approvers, date, and known differences
```

Fixtures must contain synthetic or approved public data. Real case data is not
required to validate mathematical behavior.

## Reference hierarchy

Use multiple, deliberately different forms of evidence where practical:

1. Published method definitions and worked examples.
2. Hand-derived small cases that a reviewer can audit.
3. Legacy Epi Info outputs, including its existing `TwoBy2Stats.csv`, binomial,
   regression, and matched-regression corpora.
4. Independent scientific implementations such as R packages, SciPy, or
   statsmodels, with exact versions and options recorded.
5. High-precision or enumerated calculations for exact tests and numerical tails.

Legacy behavior is the compatibility reference, not automatically the scientific
truth. If the legacy output conflicts with the selected documented method, preserve
the case, explain the difference, and obtain an explicit compatibility decision.

Python may generate reference candidates and differential datasets, but promoted
expectations are immutable data reviewed into the repository. Python is never
required to run the production browser engine.

## Mandatory test families

Each algorithm receives applicable cases from every family:

### Canonical and worked cases

- ordinary small inputs with hand-checkable intermediate values;
- published textbook or method-paper examples;
- representative legacy Epi Info fixtures; and
- every documented option, alternative hypothesis, correction, and interval type.

### Boundary and pathological cases

- zero cells, zero denominators, empty groups, all-equal values, and one-record
  groups;
- invalid, missing, non-finite, negative, fractional, and out-of-domain inputs;
- very small p-values, probabilities near zero or one, and confidence levels near
  supported boundaries;
- large counts, imbalanced margins, sparse strata, separation, collinearity,
  singular matrices, non-convergence, and iteration limits; and
- integer/floating overflow, underflow, cancellation, and allocation limits.

Invalid and undefined states must produce a typed error or documented warning—not
a plausible-looking number, panic, hang, or silent coercion.

### Property and metamorphic tests

Test mathematical relationships rather than only saved outputs. Examples include:

- frequencies sum to the included observation count;
- means remain inside the finite observed range;
- swapping exposed/unexposed inverts a risk ratio where defined;
- swapping rows or columns transforms an odds ratio predictably;
- confidence intervals are ordered and contain their estimate when the selected
  method guarantees it;
- p-values remain in `[0, 1]`;
- duplicating every unweighted observation preserves ratios and point estimates
  that should be scale invariant;
- reordering records or strata does not change order-independent results; and
- stratified results reduce to the corresponding single-stratum method when the
  specification says they should.

### Differential and randomized tests

- Generate reproducible, stratified random cases across ordinary and extreme
  domains.
- Compare with at least one independent implementation and legacy Epi Info where
  the operation exists.
- Preserve every discovered discrepancy as a minimized regression fixture.
- Partition results by exact agreement, tolerance agreement, approved method
  difference, and unexplained failure; a summary pass rate cannot hide failures.

### Native/WASM and browser parity

The same fixture pack must run against:

- debug and release native Rust;
- release `wasm32-unknown-unknown`;
- the TypeScript/WASM adapter and serialized result contract; and
- supported browser engines when floating-point or platform behavior could differ.

Check values, warnings, errors, method/version metadata, and JSON special-value
encoding. Browser CI must exercise at least one complete UI-to-WASM result path;
algorithm CI runs the larger fixture pack without relying on the UI.

### Robustness and performance

- Property-based tests cover the declared input domain.
- Fuzz targets cover parsers, deserialization, dimensions, and algorithm entry
  points; all crashes and hangs become regression cases.
- Benchmarks record cold start, runtime, WASM size, and peak memory on small,
  representative, and allowed-maximum inputs.
- Long operations define cancellation and Worker behavior before production use.
- Results must be deterministic for the same versioned request, or the contract
  must explicitly record the algorithm and seed.

## Numerical comparison rules

Tolerance is selected per output and justified in the manifest:

- exact comparison for counts, categories, flags, warnings, and values defined by
  exact enumeration;
- absolute tolerance for quantities near zero;
- relative tolerance for scale-dependent finite quantities;
- ULP limits when verifying the same primitive implementation across native/WASM;
- explicit `NaN`, positive/negative infinity, signed-zero, and null semantics; and
- convergence-aware checks for iterative estimates, including status, iterations,
  objective/residual, and reason for termination.

Do not use one blanket decimal-place tolerance for an entire result. Rounded UI
text is never the reference value; compare unrounded structured engine output.

## Validation gates

| Gate | Required evidence |
|---|---|
| G0 — specification | Method identity, domain, options, schemas, error/warning semantics, and provenance fields approved |
| G1 — reference corpus | Canonical, legacy, independent, boundary, and pathological fixtures reviewed |
| G2 — native correctness | Unit, property, differential, fuzz-regression, and dependency/source review pass |
| G3 — WASM equivalence | Release WASM and adapter pass the same fixtures; supported browser smoke path passes |
| G4 — operational limits | Performance, memory, payload, cancellation, and maximum-input behavior accepted |
| G5 — independent review | Statistical-method reviewer and implementation reviewer approve evidence and known differences |
| G6 — release control | Algorithm/version registry updated; CI, documentation, provenance, rollback, and last-known-good artifact confirmed |

The statistical-method reviewer and primary implementer should not be the same
person for G5. High-impact methods may require a second domain reviewer.

## Change control

Any change to formulas, dependencies, compiler/toolchain, floating-point options,
WASM bindings, schemas, defaults, tolerances, or warnings triggers an impact review.
CI reruns the complete affected evidence pack. Expected outputs or tolerances may
change only in a dedicated review that explains the method change; they must never
be automatically updated merely to make CI pass.

Every result records the operation version and engine build. A replacement remains
available beside the last validated version for comparison during one release when
practical. A failed validation blocks promotion but does not erase prior evidence.

## JupyterLite validation laboratory

JupyterLite notebooks may demonstrate the evidence transparently in the browser.
Each notebook uses one Pyodide Python kernel and loads the deployed Rust/WASM engine
as a JavaScript-accessible library. This allows Rust results, Python scientific
references, fixtures, tolerances, discrepancies, and provenance to appear together
without treating Python as a second production engine.

Notebook demonstrations are informative, not approval gates. They must:

- load the same versioned fixtures and release WASM artifact used by CI;
- show unrounded values, per-output comparison rules, warnings, method identity,
  engine/package versions, and the WASM checksum;
- use synthetic or approved public data;
- label candidate, restricted, experimental, and exploratory results accurately;
- preserve discovered discrepancies rather than hiding or rounding them away; and
- keep authoritative pass/fail decisions in immutable fixtures and automated CI.

The V0.1 lab is built from
[`validation-lab/content/validate-table2x2.ipynb`](../../validation-lab/content/validate-table2x2.ipynb)
and deployed under `/validation-lab/` on the same GitLab Pages origin as the app.
It compares the Rust/WASM risk ratio with the current fixture and SciPy. V0.2 will
add the classified legacy 100-case corpus.

## Initial execution order

1. Apply this standard to `epi.table2x2`; import and classify the existing legacy
   100-case corpus before adding algorithms.
2. Complete confidence intervals, exact tests, warning/undefined semantics, and
   native/browser WASM parity.
3. Add frequencies and means with missing-value and weighting rules.
4. Add stratified 2 x 2/Mantel-Haenszel with sparse-stratum and homogeneity cases.
5. Run disposable Linfa and SmartCore regression spikes against the legacy
   regression corpora; select an implementation only after the evidence review.
