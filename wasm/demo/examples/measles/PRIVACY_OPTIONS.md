# Measles geographic privacy options

Date evaluated: 2026-09-18

Source: local restricted `Measles Dataset -Sierra Leone#.xlsx`

Source SHA-256:
`add99730db9e358ab487c1ef4f5cb927c9b71c25668b766754a9bf72b04a5b48`

## Purpose

The source contains 2,606 surveillance records and 333 organisation-unit
values. Of those units, 108 occur once. This evaluation tests geographic
generalization without deleting records or assigning a case to a different
named facility.

All three output datasets retain aggregate contributions from all 2,606
records. Direct addresses, dates of birth, exact event dates, organisation-unit
names, and patient rows are not published.

## Shared disclosure method

- Reporting-unit names are replaced by randomized `RU-*` labels. No crosswalk
  is written.
- A generalized record contributes to its residential-district aggregate. It
  is not reassigned to another facility.
- The outputs contain marginal counts for sex, age group, laboratory result,
  measles-dose group, case-definition status, and onset year.
- If any positive category count within one of those dimensions is below five,
  every category count for that dimension and geography is withheld. This
  prevents recovery of the small count by subtracting visible categories from
  the geography total.
- The output is aggregate-only. It cannot reproduce record-level joins,
  regression, survival analysis, or individual longitudinal review.

## Comparison

| Measure | K=2 singleton roll-up | K=5 small-unit roll-up | District only |
| --- | ---: | ---: | ---: |
| Output geographic groups | 241 | 135 | 17 |
| Minimum group size | 2 | 5 | 8 |
| Records retained in aggregates | 2,606 | 2,606 | 2,606 |
| Records at pseudonymous reporting-unit detail | 2,498 | 2,226 | 0 |
| Records generalized to district | 108 (4.14%) | 380 (14.58%) | 2,606 (100%) |
| Onset-year record coverage after small-cell control | 88.95% | 100% | 100% |
| Sex record coverage | 55.33% | 66.96% | 70.41% |
| Age-group record coverage | 14.43% | 14.24% | 41.10% |
| Laboratory-result record coverage | 17.50% | 18.04% | 4.41% |
| Dose-group record coverage | 43.71% | 49.50% | 71.95% |
| Case-definition record coverage | 45.36% | 52.88% | 74.48% |

Coverage is the percentage of source records represented in geographic groups
where the complete marginal dimension can be released after the small-cell
rule. A withheld dimension does not mean the source values are missing.

## Privacy and epidemiologic impact

### K=2 singleton roll-up

This option changes geographic detail for only 4.14% of records, so it retains
the most reporting-unit structure. Its minimum group contains two records,
however, and most stratified dimensions must be withheld. All geography labels
are randomized in this artifact. This option is useful for demonstrating why
singleton-only treatment is insufficient, but it is not the recommended public
teaching dataset.

### K=5 small-unit roll-up

This option generalizes 14.58% of records and leaves no released geographic
group below five records. It preserves reporting-unit-level totals for most
records and preserves onset-year counts for every record. It remains unsuitable
for a named facility map because the retained units are deliberately
pseudonymous. It is the best candidate for a controlled demonstration of
reporting-unit heterogeneity.

### District only

This option has the strongest geographic generalization and supports a named
district map. It preserves onset-year coverage and improves the releasability
of sex, age, dose, and case-definition marginals. Laboratory-result breakdowns
are available for only 4.41% of records because most district lab marginals
contain at least one small positive category. District-only aggregation also
removes the ability to compare individual reporting units.

## Recommended teaching use

Use the district-only dataset as the initial public teaching floor for maps,
annual surveillance patterns, and selected demographic summaries. Use the K=5
dataset only when the lesson specifically requires variation among
pseudonymous reporting units.

Do not use the K=2 dataset as a public-release model. Keep it as an audit and
comparison artifact.

None of these aggregate datasets supports patient-level inference, matching,
or multivariable analysis. A separate, explicitly synthetic line list is
needed for teaching those workflows. Reporting timeliness also cannot be
evaluated from the available fields because the source lacks an unambiguous
submission timestamp.

## Remaining governance work

1. Obtain data-owner confirmation of the source's provenance, allowed uses,
   and disclosure policy.
2. Have a privacy reviewer approve the geography and small-cell rules before
   public release.
3. Obtain an authoritative reporting-unit-to-administrative-area crosswalk.
   Residential district is a patient geography and must not be represented as
   the reporting facility's parent district.
4. Create a fully synthetic measles line list for Program Editor examples that
   require record-level analysis.
