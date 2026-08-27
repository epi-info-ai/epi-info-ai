# `epi.rate` V0.11 method contract

## Scope and status

`epi.rate` is a candidate Visual Dashboard Rates operation. V0.11 supports
COUNT of records whose selected numerator field equals one selected non-missing
value, per COUNT of records with a non-missing denominator field, multiplied by
a positive number. G5 remains deferred to the consolidated review; this output
is not statistically approved.

## Boundary and numeric behavior

TypeScript owns record access, trimming, case-insensitive equality, and the two
counts. A record contributes to either count only when its denominator field is
non-missing. Rust/WASM owns `numerator / denominator × multiplier` and rejects
non-finite or negative input, a zero denominator, a numerator greater than the
denominator, and a non-positive multiplier by returning unavailable (`NaN`).

The typed result includes method identities, source/exclusion totals, numerator,
denominator, false count (`denominator - numerator`), multiplier, rate, warnings,
and version/provenance fields.

## Frozen evidence and remaining gates

`foodborne-rate-v0.11.json` freezes 22 Confirmed records per 96 non-missing IDs,
or 22.916666666666668 per 100. The Validation Lab independently derives both
counts from the canonical CSV and checks the deployed WASM export.

Reviewed legacy output, additional aggregates and conditions, distinct counts,
grouping, filters, pathological/property evidence, lower-powered-device review,
implementation approval, and consolidated G5 review remain open.
