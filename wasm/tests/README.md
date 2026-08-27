# Epi Info AI tests

## Phase 0 automated baseline

Run from the repository root with a supported Node.js LTS release:

```text
node wasm/tests/phase0-smoke.mjs
```

The script uses only Node.js built-in modules. It does not install packages,
contact Supabase, open a browser, or use sensitive data. It checks:

- required deployable assets and familiar UI landmarks;
- the maintained TypeScript source-language boundary;
- the recorded WASM checksum, header, and required exports;
- the versioned `epi.table2x2` result contract, method metadata, confidence
  intervals, chi-square p-values, and representative edge cases;
- the immutable foodborne CSV hash, explicit potato-salad derivation, candidate
  golden outputs, and Rust/WASM adapter parity;
- all 100 legacy-derived Fisher p-value and exact odds-ratio interval cases,
  conditional-MLE interval containment, and explicit zero/infinity boundaries;
- CSV/TSV parsing, JSON-record conversion, Unicode, type inference, and CSV round-trip behavior;
- typed validation contracts for required, range, legal-value, pattern, unique,
  and calculated-age rules plus allowlisted Check Code field actions;
- duplicate-candidate reporting and persisted, audited deleted-record contracts;
- valid and malformed project snapshot contracts, unreadable-local-state recovery,
  form snapshot structure, and snap-to-grid arithmetic;
- portable Project Package V2 validation, official Sample structural/record
  counts, preserved program source, and unsupported-version rejection;
- map coordinate filtering; and
- the required Supabase table/RLS statements;
- algorithm-registry evidence and promotion invariants; and
- the JupyterLite notebook's required evidence landmarks.

The fixtures under `fixtures/phase0` are synthetic. If the WASM artifact changes,
do not update its checksum automatically. First review the Rust source, run numerical
parity tests, and record why the artifact changed.

The larger browser workflow examples under `../demo/examples` are also included in
the production artifact. They combine the migrated official Sample project,
CSV/Excel-created forms and records, a public
GeoJSON neighborhood layer, and a WorldPop-derived GeoTIFF raster fixture. Their
README records provenance, checksums, intended use, and the end-to-end manual
workflow. Automated smoke tests enforce their basic schema, record/feature counts,
coordinate ranges, geometry type, label field, raster signature, size, and hash.

## Phase 0 manual baseline

Complete [`phase0-manual-checklist.md`](phase0-manual-checklist.md) before a migration
changes visible workflows, browser storage, authentication, mapping, or deployment.
The manual checklist complements the automated suite; it is not replaced by static
asset checks.

## Browser end-to-end smoke tests

The Playwright suite exercises the production build in Chromium:

```text
pnpm run build
pnpm run test:browser
```

It verifies the manual-aligned application menus, responsive shell and Enter Data
views, Form Designer project commands, calculated age and safe field-state rules,
Data Quality duplicate comparison/delete/restore, File-menu project open/save,
mobile Project Storage states/feedback, CSV/TSV/JSON/Excel inputs, integrated
example downloads, Leaflet map initialization, familiar Fisher/mid-p and
conditional-odds-ratio output, and the generated JupyterLite validation lab. GitLab CI
runs it after `production-build` and before Pages deployment. On failure, the job
retains its HTML report, trace, screenshot, and video artifacts for 14 days.

The validation-lab build also runs `wasm/validation-lab/verify.py` to validate the
notebook schema, unique cell IDs, Python syntax, frozen source hash, and record-level
foodborne derivation before JupyterLite is published.
