# Epi Info AI tests

## Phase 0 automated baseline

Run from the repository root with a supported Node.js LTS release:

```text
node wasm/tests/phase0-smoke.mjs
```

The script uses only Node.js built-in modules. It does not install packages,
contact Supabase, open a browser, or use sensitive data. It checks:

- required deployable assets and familiar UI landmarks;
- syntax of maintained JavaScript modules;
- the recorded WASM checksum, header, and required exports;
- the versioned `epi.table2x2` result contract and representative edge cases;
- CSV quoting, Unicode, type inference, and round-trip behavior;
- valid and malformed project snapshot contracts, unreadable-local-state recovery,
  form snapshot structure, and snap-to-grid arithmetic;
- map coordinate filtering; and
- the required Supabase table/RLS statements.

The fixtures under `fixtures/phase0` are synthetic. If the WASM artifact changes,
do not update its checksum automatically. First review the Rust source, run numerical
parity tests, and record why the artifact changed.

The larger browser workflow examples under `../demo/examples` are also included in
the production artifact. They combine CSV-created forms and records with a public
GeoJSON neighborhood layer. Their README records provenance, checksums, intended
use, and the end-to-end manual workflow. Automated smoke tests enforce their basic
schema, record/feature counts, coordinate ranges, geometry type, and label field.

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

It verifies the manual-aligned application menus, Form Designer project commands,
the additive Project Storage workflow, Leaflet map initialization, and the generated
JupyterLite validation lab. GitLab CI
runs it after `production-build` and before Pages deployment. On failure, the job
retains its HTML report, trace, screenshot, and video artifacts for 14 days.
