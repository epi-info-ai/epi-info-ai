# Rust epidemiology implementation landscape

## Decision

Research reviewed on 2026-08-26 did not identify a mature Rust application or
crate suite that should become the foundation of Epi Info AI. Reuse opportunities
exist at the algorithm and numerical-library level. Epi Info AI should retain an
owned `epi-core` facade, versioned request/result contracts, and independent
validation fixtures so an underlying implementation can be adopted, replaced, or
forked without changing product workflows.

No candidate below is approved as a production dependency by this assessment.
Each must pass the intake and algorithm gates in the
[algorithm validation standard](../validation/algorithm-validation-standard.md).

## Candidate assessment

| Candidate | Relevant capability | Current posture | Required next evidence |
|---|---|---|---|
| [rsomics-relative-risk](https://docs.rs/crate/rsomics-relative-risk/0.1.0) | Risk ratio and Katz confidence interval for a 2 x 2 cohort table | High-priority evaluation input | Reproduce Epi Info edge semantics; audit implementation and licenses; compile and benchmark browser WASM |
| [rsomics-odds-ratio](https://docs.rs/crate/rsomics-odds-ratio/0.1.0) | Sample and conditional odds ratios with Wald or exact confidence intervals | High-priority evaluation input | Compare method identity with Epi Info; test zero cells and extreme margins; remove or isolate CLI/parallel dependencies for browser use |
| [rsomics-cmh](https://docs.rs/crate/rsomics-cmh/0.1.1) | CMH test, pooled Mantel-Haenszel odds/risk ratios, and Breslow-Day homogeneity | High-priority future stratified-analysis input | Validate independently against legacy Epi Info and published examples; compile/size/performance spike in WASM |
| [Linfa](https://github.com/rust-ml/linfa) / `linfa-logistic` | Pure-Rust binary logistic regression and broader ML components | First regression benchmark candidate | Confirm required inferential outputs, convergence semantics, WASM size/memory, and parity with Epi Info |
| [SmartCore](https://github.com/smartcorelib/smartcore) | Logistic regression and general numerical/ML components with WASM-oriented defaults | Parallel regression benchmark candidate | Compare coefficients and convergence with Linfa; determine standard errors/CI work required; audit API stability |
| [ndarray-glm](https://docs.rs/ndarray-glm) | IRLS GLMs including logistic and Poisson, weights, links, and regularization | Study; do not adopt for browser yet | Resolve its `ndarray-linalg`/BLAS browser story and measure payload before deeper evaluation |
| [EpiRust](https://github.com/thoughtworks/epirust) | Large-scale agent-based epidemic simulation | Study only for an optional future modeling module | Separate modeling product case, model validation, and resource budget |
| [Jivanu epidemiology](https://docs.rs/jivanu/latest/jivanu/epidemiology/) | SIR/SEIR/SIRS stepping and reproduction/vaccination measures | Study only for optional modeling | Independent model validation and a clear user workflow outside Classic Analysis |

The rsomics crates are particularly young: the relevant releases appeared in
June and July 2026. Their reported differential testing against SciPy or
statsmodels is valuable evidence, but it is not independent evidence of Epi Info
compatibility. At least `rsomics-odds-ratio` 0.1.0 declares Rust 1.91 and Rayon,
while this repository currently tests Rust 1.85. A small source or dependency can
still carry method, toolchain, threading, licensing, and maintenance risk.

Linfa explicitly documents `wasm32-unknown-unknown` support through its
`wasm-bindgen` feature and pure-Rust linear algebra by default. SmartCore describes
WASM/WASI-oriented defaults. Those properties make both plausible regression
spike candidates, not interchangeable validated epidemiology engines.

`ndarray-glm` offers a more epidemiologically attractive GLM surface, including
logistic and Poisson models and R comparison tests, but currently routes linear
algebra through `ndarray-linalg` and a selected BLAS backend. That is a material
browser deployment caveat until demonstrated otherwise.

EpiRust and Jivanu address transmission modeling rather than Epi Info's core line
list, contingency-table, regression, sample-size, and surveillance workflows.
They must not influence the core application boundary.

## Owned facade

The stable public surface should use Epi Info method names and result semantics:

```text
epi.frequency
epi.means
epi.table2x2
epi.stratified2x2
epi.logistic
epi.poisson
epi.sampleSize
epi.sensitivitySpecificity
```

Each operation owns a versioned schema, method identifier, warnings, undefined
states, engine version, and provenance. Third-party crates remain implementation
details behind that boundary. The first kernel expansion should stay narrow:

1. complete and validate the 2 x 2 family;
2. add frequencies and means;
3. add stratified 2 x 2 and Mantel-Haenszel methods;
4. evaluate Linfa and SmartCore for regression through disposable spikes;
5. adopt a dependency only if it beats an owned implementation on correctness,
   portability, maintenance, size, and auditability.

## Third-party algorithm intake

Before code from a candidate enters `epi-core`, record:

- exact crate version, source revision, license, MSRV, owners, release history,
  advisories, and transitive dependencies;
- statistical estimand, formula/algorithm, defaults, corrections, confidence-
  interval method, missing/zero handling, and convergence behavior;
- native and `wasm32-unknown-unknown` compilation with the repository's pinned
  toolchain, without hidden network, filesystem, thread, or BLAS assumptions;
- release WASM size, cold start, execution time, peak memory, cancellation needs,
  and low-powered-device behavior;
- results against legacy Epi Info, independent scientific implementations,
  published examples, pathological cases, and randomized differential tests;
- source-review findings for panics, unchecked conversions, nondeterminism,
  overflow/underflow, unbounded allocation, and unsafe code; and
- an explicit adopt, wrap, fork, reimplement, study-only, or reject decision.

Reported upstream parity can seed cases but cannot substitute for our own evidence
pack or independent review.
