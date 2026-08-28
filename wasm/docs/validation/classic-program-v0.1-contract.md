# Classic Analysis Program V0.1 contract

## Scope

The first runnable Program Editor slice accepts exactly one ordered program shape:

1. `DEFINE <new variable> TEXTINPUT`
2. `RECODE <existing Number field> TO <new variable>`
3. one through twelve numeric range clauses and optional `ELSE`, terminated by `END`
4. `FREQ <new variable>` with an optional single `STRATAVAR=<existing field>`

Blank lines and `//` comments are ignored. Field lookup is case-insensitive and is
resolved to the current form's canonical field name. The derived field exists only
in the immutable run projection; V0.1 does not modify saved form records.

## Range semantics

- `LOVALUE - upper` includes values less than or equal to `upper`.
- `lower - upper` includes values greater than `lower` and less than or equal to
  `upper`, matching the labels and examples in the legacy RECODE documentation.
- `lower - HIVALUE` includes values greater than `lower`.
- Clauses are applied in source order. V0.1 rejects overlapping ranges and a range
  after `HIVALUE` instead of relying on a potentially surprising first-match rule.
- Missing and nonnumeric source values remain missing unless `ELSE` is present.

## Execution and safety

The parser returns a versioned typed plan with a trusted canonical-source rendering.
The source string itself is never evaluated. RECODE projection is deterministic
TypeScript orchestration; FREQ uses the same validated Rust/WASM-backed operation
as the manual Classic Analysis dialog. Unsupported, additional, malformed, or
wrongly typed commands produce a line-numbered diagnostic before any step runs.
`EXECUTE`, arbitrary filesystem paths, JavaScript, DLLs, network access, and plugin
authority are unavailable.

Every Verify, Run, and rejected attempt appends a local V0.1 history entry with
origin, status, plan version, source and canonical source when available, project
and form labels, record count, timestamp, summary, and diagnostics. This prototype
history is browser-local and is not training telemetry.

## Canonical acceptance case

The bundled foodborne dataset runs the CDC-taught age-range pattern as
`DEFINE AgeGroup`, `RECODE Age TO AgeGroup`, and
`FREQ AgeGroup STRATAVAR=Sex`. It yields 96 included records, two Sex strata, and
eight nonempty stratum/category rows. Tests also append an `EXECUTE` statement and
require rejection without output.

This is a migration candidate, not general PGM compatibility or statistical G5
approval.
