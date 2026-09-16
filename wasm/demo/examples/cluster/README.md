# Space-Time Cluster Detection example

This bundle exercises the new-branch `EPIAI CLUSTER SPACE_TIME` command with an
entirely synthetic case-only line list. It is separate from legacy Epi Info
parity and does not claim compatibility with any external scan-statistics
product.

## Contents

- `space-time-cluster-synthetic-v0.1.csv` — 30 synthetic fever/rash events at
  six fictionalized coordinate points from January 1–28, 2026.
- `space-time-cluster-command-tour.pgm7` — one explicit, reproducible analysis
  using 999 Monte Carlo replications and seed `20260916`, followed by a typed
  `EPIAI CLUSTER RENDER` of its named result.
- `space-time-cluster-synthetic-v0.1.programs.json` — dataset-bound Program
  Editor discovery catalog.

Cases `P013`–`P024` form the planted acceptance cluster at locations N1 and N2
from January 10–14. The candidate implementation ranks that window first and,
for the frozen seed, obtains 12 maximum-statistic exceedances and `p=0.013`.
That is a software regression target, not a real epidemiologic finding.

## Reproducible workflow

1. Import `space-time-cluster-synthetic-v0.1.csv` in **Enter Data**.
2. Open **Classic Analysis > Program Editor**.
3. Open the dataset-bound **Space-Time Cluster Detection command tour**.
4. Review every parameter, then run it.
5. Observe replication progress and elapsed time. **Cancel** must terminate the
   Worker without retaining a partial result.
6. Review aggregate Output and command history. They deliberately omit case IDs
   and precise coordinates.
7. Review the static OpenStreetMap image with baked-in ranked windows. If tiles
   are unavailable, the overlays remain visible on a labeled blank background.
   Hover or keyboard-focus a ranked circle to inspect its characteristics.
8. Select **Open in Maps**, then use the Cluster Story Tour controls to step or
   play through ranks 1–10 with each period, observed/expected count, and p-value.

The CSV SHA-256 is
`8eed0a8681415e9f055a219eb811a1c5252b405ca809904ed76c6e0cd74b818c`.
The independent acceptance manifest and JupyterLite oracle remain under
`wasm/tests/fixtures/algorithm-validation` and `wasm/validation-lab/content`.

## Attributed external candidate

The SaTScan data catalog describes its additional datasets as usable for
educational and research purposes and links a **Communicable Disease Space-Time
Cluster Detection** tutorial dataset:

- https://www.satscan.org/datasets.html
- https://www.satscan.org/datasets/nyccommunicable/index.html

That material is a promising later teaching and differential-validation source.
It is not copied into this repository yet. Before redistribution, record the
downloaded files, hashes, authors/publication citation, dataset-specific terms,
and any required trademark notice. It must remain labeled as external evidence,
not as the synthetic acceptance truth or as Epi Info AI-owned data.
