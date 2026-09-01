# Epi Info AI new-branch command registry

This registry separates deliberate Epi Info AI extensions from the legacy Classic Analysis parity floor. New branches use visible, parseable source, typed plans, fail-closed execution, and the same command-history contract as user and AI-authored programs. They do not count as legacy parity.

| Command | Status | Authority and output | Legacy relationship |
|---|---|---|---|
| `EPIAI QUALITY *` | Browser-verified V0.1 | Read-only profile of the active line list: present, missing, completeness, existing validation issues, and duplicate candidates. Problematic fields appear first with missingness mini-bars. | New branch. Reuses the Enter Data validation/data-quality engine; it does not replace a legacy command. |
| `FILE CONVERT "input.mdb" TO "output.sqlite"` | Browser-verified V0.1 | A reviewed file picker supplies the named Access file. Readable user tables and rows are copied into an in-memory official SQLite WASM database, `_epi_migration_manifest` records source SHA-256/counts/warnings, and a new `.sqlite` file downloads. The source is never modified. | New branch supporting migration from the legacy Access data store. Forms, reports, macros, VBA, relationships, indexes, deleted state, and saved Access query semantics are explicitly not migrated in V0.1. |
| `FILE CONVERT "input.mdb" TO "output.duckdb"` | Browser-verified V0.1 | The `.duckdb` output extension selects a self-hosted DuckDB-Wasm analytical target. The same reviewed Access file, immutable-source rule, SHA-256 provenance, table reconciliation, embedded `_epi_migration_manifest`, warning disclosure, and download boundary apply. The downloaded file is checked for DuckDB's `DUCK` storage-header magic. V0.1 obtains DuckDB's public test database as a cleanable writable seed; no Access values leave the browser, but self-hosting that reviewed seed remains required for offline/production claims. | New analytical branch of Access migration. It does not replace SQLite as the operational browser project store and does not claim migration of unsupported Access application objects. |

## Namespace rules

- Product-specific analysis extensions use the `EPIAI` namespace so users can distinguish the old tree from a new branch.
- File lifecycle operations may use the familiar `FILE` family when the verb is unambiguous. Browser execution still requires an explicit user file grant and download.
- A new branch is never added to `classic-command-parity.ts`. Its evidence lives here and in its own fixtures/tests.
- Every execution records the original source, canonical source, plan/AST versions, origin, result summary, and diagnostics.

## Deferred quality dimensions

`QUALITY` V0.1 deliberately excludes timeliness. Epidemiologic timeliness requires an agreed event/submission or deadline model; simple date-interval calculation would be misleading.
