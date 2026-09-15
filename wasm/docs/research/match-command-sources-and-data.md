# MATCH command sources and validation data

Verified: **2026-09-15**

## Purpose

This note preserves the recoverable specification for the Classic Analysis
`MATCH` command and inventories data that can exercise a future implementation.
It is an evidence index and concise technical summary, not a transcription of
the historical manuals. `MATCH` remains a revival candidate: the checked-in
desktop interpreter retains its syntax but explicitly reports that execution is
not implemented.

## Historical documentation archive

CDC discontinued Epi Info development and technical assistance in September
2025, but its current [Epi Info page](https://www.cdc.gov/epiinfo/) points to an
official historical User Guide. Stable CDC Stacks records and Internet Archive
captures fill important gaps left by removed web pages.

| Source | Preserved location | MATCH relevance |
|---|---|---|
| Epi Info 7 User Guide | [Local verified PDF](../reference/Epi-Info-7-User-Guide.pdf), [CDC archive PDF](https://archive.cdc.gov/www_cdc_gov/epiinfo/pdfs/userguide/EI7Full.pdf), and [CDC Stacks record](https://stacks.cdc.gov/view/cdc/23495) | Epi Info 7 workflow, command reference, and advanced-analysis terminology |
| Epi Info 2000 manual | [CDC Stacks record](https://stacks.cdc.gov/view/cdc/23207) and [PDF](https://stacks.cdc.gov/view/cdc/23207/cdc_23207_DS1.pdf) | Clearest recovered standalone `MATCH` syntax and matched-set description |
| Epi Info 6 manual | [CDC Stacks record](https://stacks.cdc.gov/view/cdc/23189) and [PDF](https://stacks.cdc.gov/view/cdc/23189/cdc_23189_DS1.pdf) | Historical output vocabulary and paired-analysis statistics |
| Advanced Statistics Guide page | [Latest successful Wayback capture (2026-05-11)](https://web.archive.org/web/20260511091300/https://www.cdc.gov/epiinfo/user-guide/classic-analysis/advancedstats.html) | Removed CDC web page; 34 successful captures were indexed from 2016-12-19 through 2026-05-11 |
| Visual Dashboard Analysis Gadgets page | [Latest successful Wayback capture (2026-06-15)](https://web.archive.org/web/20260615171915/https://www.cdc.gov/epiinfo/user-guide/visual-dashboard/analysisgadgets.html) | Removed companion page; 35 successful captures were indexed from 2016-11-05 through 2026-06-15 |
| Applied matched-study guidance | [CDC Field Epidemiology Manual](https://www.cdc.gov/field-epi-manual/php/chapters/analyze-interpret-data.html) | Explains matched pairs, discordant-pair odds ratios, McNemar testing, and analysis of larger or variable matched sets |

The original individual CDC User Guide URLs currently return 404. Record both
the dead canonical URL and a dated archive capture when citing them; do not use
an undated Wayback redirect as evidence. The local Epi Info 7 PDF has retrieval
and checksum metadata in the [reference README](../reference/README.md).

## Recovered MATCH intent

The Epi Info 2000 manual documents the command family as:

```text
MATCH <Exposure> <Outcome> MATCHVAR=<Variable1>
  {WEIGHTVAR=<Variable>} {OUTTABLE=<Table>} {COLUMNSIZE=<Number>} {NOWRAP}
```

The recovered behavior is matched case-control analysis, not record joining:

- exposure and outcome identify the analysis variables;
- `MATCHVAR` identifies members of the same matched set;
- a set may contain one case and one control, several controls per case, or
  other case/control compositions supported by the historical method;
- `WEIGHTVAR` represents summarized counts rather than a sampling weight; and
- `MERGE ... MATCHING` is a separate data-join operation.

The Epi Info 6 manual describes output including crude and matched odds ratios,
a Robins-Greenland-Breslow confidence interval, Mantel-Haenszel association
output, and the McNemar equivalent for matched pairs. These names are a
discovery floor, not yet an accepted numerical contract for the browser
implementation. Epi Info 7's `LOGISTIC ... MATCHVAR=...` conditional logistic
regression is related but is also a distinct analysis path.

## Local legacy-code evidence

| Evidence | Finding |
|---|---|
| [`Rule_Match.cs`](../../source/Epi-Info-Community-Edition/Epi.Core.Interpreter/Rules/Rule_Match.cs) | Retains five source forms but its executor reports that MATCH is not yet implemented |
| [`EpiInfo.Analysis.Grammar.grm`](../../source/Epi-Info-Community-Edition/Epi.Core.Interpreter/grammar/EpiInfo.Analysis.Grammar.grm) | Preserves exposure/outcome forms and `MATCHVAR`, `WEIGHTVAR`, `OUTTABLE`, `COLUMNSIZE`, and `NOWRAP` options |
| [`MatchDialog.cs`](../../source/Epi-Info-Community-Edition/Epi.Windows.Analysis/Dialogs/MatchDialog.cs) | Collects exposure, outcome, and one or more match variables and authors familiar source |
| [`EIMatch.vb`](../../source/Epi-Info-Community-Edition/StatisticsRepository/EIMatch.vb) | Contains an older, mostly commented algorithm shell that constructs matched-set tables and labels Mantel-Haenszel output |
| [`Match.cs`](../../source/Epi-Info-Community-Edition/Epi.Analysis.Statistics/Match.cs) | Appears to be an unfinished copy of `Summarize`; it must not be treated as an authoritative MATCH implementation |

## Candidate case-control validation data

### Primary teaching candidate: legacy Case Control DatabaseExample

The checked-in [legacy Excel workbook](../../source/Epi-Info-Community-Edition/Epi.Core/Projects/Sample/Case%20Control%20DatabaseExample.xlsx),
also published in the organized
[matched case-control demo bundle](../../demo/examples/matched-case-control/case-control-database-example.xlsx),
contains 130 observations and 121 fields on its main worksheet. `CaCo` is evenly
split between 65 cases (`1`) and 65 controls (`0`), while `Matched pairs`
identifies 65 complete one-case/one-control sets. Its SHA-256 is
`c35fdc3a8d7f6549533a824f0e4a68eb338c8c258656c56fd257430e3f3d0e48`.
The adjacent `.xls` is retained for legacy-import testing; the `.xlsx` should be
the first browser fixture because it avoids requiring an Access or old-Excel
driver.

Candidate binary exposures were profiled without altering or silently imputing
their values:

| Exposure | Complete binary pairs | Discordant case exposed/control unexposed | Reverse discordant | Invalid-coded pairs | Missing/incomplete pairs | Provisional paired ratio |
|---|---:|---:|---:|---:|---:|---:|
| `PB` | 60 | 19 | 8 | 3 | 2 | 2.375 |
| `EatOut` | 48 | 16 | 11 | 6 | 11 | 1.455 |
| `Chips` | 50 | 9 | 18 | 11 | 4 | 0.500 |
| `Pnut` | 58 | 7 | 18 | 6 | 1 | 0.389 |
| `AnyChkn` | 57 | 13 | 8 | 3 | 5 | 1.625 |
| `Travel` | 59 | 9 | 10 | 2 | 4 | 0.900 |
| `School` | 29 | 16 | 0 | 0 | 36 | Infinite-boundary case |

“Invalid-coded” means at least one non-missing member was neither numeric 0 nor
1; it does not assert that the source value is erroneous. “Provisional paired ratio” is
the first discordant count divided by the reverse count and is only a fixture
cross-check after case/exposure orientation and missing-code meanings are
confirmed. `PB` is the best initial normal fixture; `School` is useful as a
separate zero-cell boundary fixture.

Proposed program source after the workbook is loaded into the current project:

```text
MATCH PB CaCo MATCHVAR=[Matched pairs]
```

### Synthetic 1:n stress candidate

[`MatchedLogisticTestData.csv`](../../source/Epi-Info-Community-Edition/Epi.UnitTests/Data/MatchedLogisticTestData.csv),
also published under the
[matched case-control demo bundle](../../demo/examples/matched-case-control/matched-logistic-test-data.csv),
contains 30,000 rows: 100 simulation iterations, each with 100 matched sets of
three observations. Every iteration/set combination has one case and two
controls. Its SHA-256 is
`eb9887feacad1dc2a22150c1e9db0cd427687c8be59b3943d14591082e142103`
for the LF-normalized repository and deployed asset. A Windows checkout may
materialize CRLF line endings and therefore has a different byte digest.
This is appropriate for conditional-logistic stress and repeatability tests,
but not as the primary standalone MATCH teaching example.

### Rely/Toxic Shock Syndrome recovery candidate

The checked-in `Rely` form schema includes `ID`, `RELY`, and `CASE`, and its
legacy program contains `LOGISTIC CASE = RELY MATCHVAR = ID`. The current
[`sample-project.epia.json`](../../demo/examples/projects/sample-project.epia.json) lost
those record values during import, so it cannot yet support numerical
validation. Recovering the original Sample database would provide a historically
recognizable second corpus.

## Validation tiers and acceptance gate

1. Maintain the completed small hand-auditable 1:1 contract fixture covering
   concordant, discordant, missing, invalid-composition, and variable-ratio
   boundary sets; add a separate zero-discordance fixture with the independent
   validation slice.
2. Promote `Case Control DatabaseExample.xlsx` as the canonical human-readable
   corpus after documenting provenance, labels, case coding, exposure coding,
   and missing-value conventions.
3. Use `MatchedLogisticTestData.csv` for 1:2 set handling and bounded stress
   tests, scoped explicitly to conditional logistic regression where applicable.
4. Recover the Rely records and capture reviewed output from a working desktop
   Epi Info version for differential evidence.
5. Independently reproduce set counts, discordant pairs, matched odds ratio,
   confidence limits, association test, and all warnings in the validation lab.
6. Promote the checked-in syntax-only `.pgm7` to executable status through the
   real Program Editor after the implementation gate. Preserve command source,
   engine version, input digest, exclusions, warnings, and output in common
   history.

No MATCH implementation should be labeled legacy parity merely because it
agrees with one reconstructed formula. The final gate requires an explicit
method contract, independent numerical checks, browser tests, and reviewed
desktop differential output—or a documented reason why that output cannot be
recovered.
