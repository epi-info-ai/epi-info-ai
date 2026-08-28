# Stratified frequency V0.9.1 method contract

## Scope

This candidate adapter implements one current-form frequency variable and one
different stratification variable. It preserves the familiar command shape
`FREQ field STRATAVAR=strata`. Multiple frequency variables, multiple strata,
weights, filters, `OUTTABLE`, and saved program execution remain outside V0.9.1.

## Deterministic method

1. Validate both fields against the current form and reject identical fields.
2. Group records by the typed stratification value using the same numeric, text,
   Boolean, date-like, and missing ordering rules as ordinary FREQ.
3. Exclude records with missing strata unless Include missing is selected.
4. Run the V0.9 `epi.frequency` operation independently over the selected field
   within each stratum.
5. Report frequency, within-stratum percent and cumulative percent, and the V0.9
   legacy exact-under-300/Wilson-at-least-300 95% confidence limits.

Stratum partitions are disjoint and their source-record counts must recombine to
the non-excluded source count. Category frequencies must recombine to the nested
operation's included total in each stratum. This operation makes no inference
between strata and performs no test for interaction or homogeneity.

## Safety and provenance

The TypeScript host derives the canonical command from a validated typed request.
The command is audit output, not evaluated model text. Epi Assist may populate the
two selectors only after its tool call names real, distinct form fields and the
user chooses the reviewed action. Statistical approval remains deferred to the
consolidated G5 review.
