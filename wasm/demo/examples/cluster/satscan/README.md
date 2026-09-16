# SaTScan differential-validation files

These headerless, space-delimited files are derived from
`../space-time-cluster-synthetic-v0.1.csv` for an external SaTScan validation
run. They contain synthetic demonstration data, not surveillance findings.

## Files

- `space-time-cluster.cas` — 30 one-case rows containing all 30 source cases.
  Same-location, same-date events remain separate rows so the SaTScan summary
  visibly reconciles to the source line-list row count.
- `space-time-cluster.geo` — one latitude/longitude row for each of the six
  location IDs. Coordinates retain the source file's five decimal places.
- `space-time-cluster.pop` — one explicitly synthetic population-at-risk row
  of 10,000 for each location, for a total population of 60,000.

The file layouts follow the SaTScan user-guide conventions:

```text
case:       <location ID> <number of cases> <YYYY/MM/DD>
population: <location ID> <YYYY/MM/DD> <population>
geography:  <location ID> <latitude> <longitude>
```

## Direct comparison: Space-Time Permutation

The current Epi Info AI `EPIAI CLUSTER SPACE_TIME` prototype is a case-only
space-time permutation analysis. The closest SaTScan differential test is
therefore:

1. Select `space-time-cluster.cas` as the case file.
2. Select `space-time-cluster.geo` as the coordinates file and choose
   latitude/longitude coordinates.
3. Set case-time precision and time aggregation to **Day**.
4. Set the study period to **2026/01/01–2026/01/28**.
5. Choose a **retrospective space-time** analysis, the **Space-Time
   Permutation** probability model, and scan for high rates.
6. Use 999 Monte Carlo replications. Record every remaining spatial-window,
   temporal-window, and reporting setting with the resulting output.

Do **not** select the population file for this run. SaTScan's space-time
permutation model uses case data only. Compare the ranked locations, time
windows, observed and expected cases, likelihood/test statistic, and Monte
Carlo p-values. Exact results are not presumed interchangeable until the two
implementations' candidate-window and inference contracts are aligned.

## Supplemental comparison: Discrete Poisson

To exercise the requested three-file workflow, select all three files and use
a retrospective space-time **Discrete Poisson** model. The population values
are deliberately equal synthetic denominators because the source line list
does not contain a real population at risk. This controls the example's
spatial denominator without pretending that population data were observed.

The Poisson result is useful as a separate sensitivity demonstration, but it
is **not** a direct validation of Epi Info AI's current case-only statistic.
Replace `space-time-cluster.pop` with authoritative population denominators
before any real epidemiologic interpretation.

## Structural acceptance checks

- The case file has 30 rows, case counts sum to 30, and dates cover
  2026/01/01–2026/01/28.
- Every case and population location has exactly one coordinate row.
- Every latitude and longitude has at least five decimal places.
- Population values are positive and total 60,000.
- Location IDs and coordinates exactly match the source CSV.

Format and model references:

- https://www.satscan.org/cgi-bin/satscan/register.pl/SaTScan_Users_Guide.pdf?todo=process_userguide_download
- https://www.satscan.org/rsatscan/rsatscan.html
- https://www.satscan.org/
