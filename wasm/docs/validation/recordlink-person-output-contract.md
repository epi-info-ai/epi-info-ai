# RECORDLINK governed person-output contract V0.9

## Scope

V0.9 creates a new person-record dataset from a verified V0.8 audit artifact.
It never overwrites either source and does not execute `MERGE`.

Only field pairs explicitly declared by `BLOCK`, `EXACT`, and `FUZZY` are
eligible. The initial reviewed policy prefers a nonmissing Source A value and
uses Source B only when Source A is missing. Source identifiers and unmapped
fields are excluded. This preference is deterministic provenance—not a claim
that Source A is more accurate.

## Review and provenance

The local preview displays all resulting record values, the complete mapping,
and aggregate disagreement and fallback counts. Downloads remain disabled until
the user acknowledges reviewing them. Each output field has a provenance row
recording the selected source role and field, whether fallback occurred, and
whether both nonmissing source values disagreed. Common history records counts
only; it never records field values.

The CSV contains the new records. A companion JSON document contains the
records, provenance rows, policy, governance flags, and the verified V0.8 audit
fingerprint. Both files contain person-level data and require appropriate local
handling.

## Acceptance anchor

The reviewed synthetic fixture produces 11 person records with seven mapped
fields, six linked-field disagreements, 21 Source B fallback values for the
three Source B-only people, and 77 provenance rows. `P000004` uses the visibly
declared Source A date `1988-12-01`; neither source identifier is exported.
