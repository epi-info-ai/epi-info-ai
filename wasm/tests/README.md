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
- form snapshot structure and snap-to-grid arithmetic;
- map coordinate filtering; and
- the required Supabase table/RLS statements.

The fixtures under `fixtures/phase0` are synthetic. If the WASM artifact changes,
do not update its checksum automatically. First review the Rust source, run numerical
parity tests, and record why the artifact changed.

## Phase 0 manual baseline

Complete [`phase0-manual-checklist.md`](phase0-manual-checklist.md) before a migration
changes visible workflows, browser storage, authentication, mapping, or deployment.
The manual checklist complements the automated suite; it is not replaced by static
asset checks.
