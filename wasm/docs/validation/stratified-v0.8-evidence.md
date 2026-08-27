# Stratified 2 x 2 V0.8 evidence packet

This packet records the automated evidence for the `epi.stratified2x2` V0.8
candidate. It does not confer statistical approval. Gate G5 is intentionally
deferred to one consolidated statistical and implementation review covering all
candidate outputs.

## Evidence in this slice

- The canonical foodborne corpus is re-derived from all 96 source records and
  checked against immutable Mantel-Haenszel and exact adjusted-OR anchors.
- A heterogeneous three-strata fixture checks non-zero fixed-margin,
  Tarone-corrected, and legacy-labelled Woolf OR/RR homogeneity results.
- `stratified-operational-v0.8.json` adds zero, infinity, empty-stratum,
  support-width, 1,024-strata, and stratum-order/label metamorphic cases.
- Native Rust tests and the release WASM adapter exercise the same reviewed
  support and work limits. Unsupported exact inference fails closed as
  `unavailable`; no asymptotic substitute is introduced.
- CI enforces a generous five-second maximum for the 1,024-strata repeated-cell
  case and prints the observed runner time for audit. This is a regression guard,
  not a claim about every client device.
- Browser E2E proves that calculation occurs in a module Worker, an in-flight
  request can be cancelled by terminating that Worker, and a fresh Worker can
  successfully calculate afterward.
- JupyterLite independently checks the product-hypergeometric anchors and exposes
  the pathological and operational cases for reviewer reproduction.

## Reviewed operational limits

| Limit | Candidate behavior |
| --- | --- |
| Ordered strata | 1 to 1,024 |
| Cell value | non-negative whole number; exact inference supports at most 999,999 |
| Combined exact support width | 4,096 |
| Exact convolution work | 2,000,000 multiply-adds |
| Cancellation | terminate the dedicated Worker; the next request creates a clean WASM instance |
| CI performance regression guard | 1,024 repeated `1/1/1/1` strata complete or fail closed within 5,000 ms |

The fixed-size Rust scratch workspace is owned by one Worker instance. The UI
never interleaves another calculation on that instance. Cancellation discards
the entire instance, so partially written scratch data cannot be reused.

## Gate status

| Gate | Status | Rationale |
| --- | --- | --- |
| G0 — specification | Passed | Versioned schema, methods, states, limits, warnings, and provenance are documented. |
| G1 — reference corpus | Partial | Canonical, independent, boundary, and pathological evidence exists; broader reviewed legacy output remains open. |
| G2 — native correctness | Partial | Native, parity, metamorphic, and regression tests pass; formal implementation review and additional fuzz/differential evidence remain open. |
| G3 — WASM equivalence | Passed | Release WASM, TypeScript adapter, Worker route, and supported-browser E2E share the fixtures. |
| G4 — operational limits | Passed | Maximum input, fail-closed bounds, performance budget, cancellation, and recovery are enforced. |
| G5 — independent review | Not started | Deferred by project decision to one consolidated review of all outputs. |
| G6 — release control | Partial | Registry, CI, documentation, rollback path, and Pages artifact are controlled; validation state cannot close before G5. |

## Consolidated G5 review inputs

The later review should receive the immutable fixtures, source citations,
JupyterLite notebooks, native and browser logs, known differences, operation
contracts, and registry together. Reviewers must be named in the registry; until
then, UI and serialized results continue to say `candidate`.
