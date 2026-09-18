# Bundled DuckDB writable seed

`seed-v1.duckdb` is a versioned, immutable bootstrap file used by DuckDB-Wasm
to create downloadable databases in the browser. It was retrieved from
DuckDB's public test database at `https://blobs.duckdb.org/data/test.db` on
2026-09-17.

- Size: 274,432 bytes
- SHA-256: `eaffa154f61f16789211ac80161b0dea2cd4f79cf0e0a3413443303def9a1ffc`
- Upstream project: <https://github.com/duckdb/duckdb>
- Upstream license: MIT

The application verifies the bundled bytes, installs one immutable copy at
`epi-info-ai/system/duckdb/seed-v1.duckdb` in origin-private file-system (OPFS)
storage, and clones the verified bytes into a new DuckDB-Wasm working database.
It never opens the OPFS seed itself for mutation. Existing seed objects are
deleted from the working database before Epi Info AI creates its own tables.

Changing the file requires a new versioned file name, checksum, tests, and
review. Do not replace the bytes in place.
