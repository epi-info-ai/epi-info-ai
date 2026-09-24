# GIS-K09 release gates

K09-S1 through K09-S10 provide bounded, source-preserving candidate contracts
and smoke evidence. They do not establish scientific validity or legacy parity.
Every registered advanced operation remains `unvalidated` and execution is
disabled by the K09-S10 gate audit until the evidence below is reviewed.

## Required evidence

| Gate | Required artifact | Current status |
| --- | --- | --- |
| Scientific method | Independently derived expected results, edge cases, tolerances, and method identity for each operation | Open |
| Privacy and disclosure | Review of record-level exposure, aggregate disclosure, and small-cell policy | Open |
| Resource validation | Measured input, output, coordinate/cell, timeout, cancellation, and memory limits | Open |
| Browser matrix | Chromium, Firefox, WebKit, and mobile-WebKit evidence for the production integration path | Open |
| Rust/WASM parity | Independent comparison against the promoted Epi-owned kernel implementation | Open |
| CI and release | GitLab and GitHub pipelines pass; maintainer reviews and promotes the operation | Open |

The existing K09 smoke tests verify contract shape, deterministic candidate
behavior, hostile-input boundaries, and source immutability. They are not a
substitute for the gates above. In particular, a passing candidate smoke test
must not be relabeled as desktop Epi Info, GDAL, rasterio, H3, SaTScan, or
Rust/WASM equivalence.

The independent `validate-spatial-k09.ipynb` JupyterLite notebook is the
self-correction oracle for the corrective follow-up. It re-derives standard
Getis-Ord Gi*, Moran's I, conditional LISA permutation behavior, coordinate
validity, and the bounded-work policy without importing TypeScript. It is
evidence for correction, not a promotion artifact.

## Corrective K09 constraints

- The public GIS barrel exports contracts, registry, gates, and a rejecting
  execution boundary only. Candidate algorithms live behind an internal
  candidate barrel and cannot be invoked through the application API while
  `executionAllowed` is false.
- `exploratory-circle` is an explicitly labeled overlapping-neighborhood
  summary. It does not claim scan-statistic, likelihood, denominator, or
  significance parity.
- Resource validation rejects excessive permutation, cell-observation, input,
  coordinate, feature, and timeout budgets before execution planning.

## Objective blockers cleared in this review

- Targeted `.gitattributes` rules declare LF for integrity-pinned text assets,
  preventing Windows `core.autocrlf` from changing fixture bytes on fresh
  checkouts. The affected local teaching and validation fixtures were
  normalized and their pinned checks now pass.
- The installed-Chrome production-path checks now pass for GDAL reprojection,
  GDAL zonal statistics, and the EPIAI CLUSTER Worker workflow.
- Local evidence recorded for this review: TypeScript typecheck, production
  build, artifact smoke, all K09-S1 through K09-S10 smokes, and the 34-check
  Phase 0 baseline all pass. The installed-Chrome focused browser checks pass
  3/3.

These results clear objective local blockers; they do not replace the full
GitLab/GitHub browser matrix or the promotion gates below.

## Promotion rule

Do not change `validationStatus` to `validated`, set `executionAllowed` to
`true`, or claim parity until every required artifact is linked from the
operation's gate audit and a maintainer has reviewed the evidence.
