# Measles privacy-study datasets

This folder evaluates privacy-preserving geographic representations of a
Sierra Leone measles surveillance export. It does not publish the source line
list or its data-dictionary workbooks.

The local `.xlsx` source files are intentionally ignored by Git. They may
contain potentially identifiable surveillance information and must remain in
an approved restricted location.

## Committable artifacts

- `measles-privacy-option-k2.csv` — comparison-only singleton roll-up. All
  geography labels are randomized because some groups contain only two
  records. Do not treat this as the public-release choice.
- `measles-privacy-option-k5.csv` — reporting units with at least five records
  are retained under randomized `RU-*` labels; smaller units are rolled into
  named residential-district aggregates.
- `measles-privacy-option-district.csv` — all records are represented only in
  residential-district aggregates.
- `measles-privacy-options-impact.csv` — privacy and analytical-availability
  metrics for the three options.
- `PRIVACY_OPTIONS.md` — method, comparison, interpretation, and recommended
  use.

These are aggregate datasets, not patient line lists. They exclude names,
addresses, dates of birth, exact event dates, contact details, and a crosswalk
back to reporting-unit names.

The artifacts are a design evaluation, not a formal determination that the
source or outputs satisfy a particular disclosure-control policy. Publication
still requires the applicable data owner and privacy review.
