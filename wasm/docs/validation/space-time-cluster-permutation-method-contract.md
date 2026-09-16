# Space-time cluster detection candidate contract

## Status and boundary

This contract defines the first bounded `EPIAI CLUSTER SPACE_TIME` candidate.
It is a new branch, not legacy Epi Info parity and not a claim of parity with
any external scan-statistics product.

The first method is a **retrospective space-time permutation scan for high-rate
clusters**. It is appropriate for a case line list with event date and location
when no population-at-risk file is available. It tests space-time interaction;
it must not be described as estimating population disease risk.

An established open-source
[scan-statistics implementation](https://github.com/scanstatistics/satscan) is
the initial differential reference and interoperability target. Its official
source was reviewed at commit
`e9764dd004c881ee9eecc6995771383cc872b983`. Its source license requires
attribution, inclusion of its notice, and identical licensing for distributed
derivatives. No source from that implementation is copied into the Apache-2.0
Epi Info AI core. Any later compiled adapter must be isolated with its own
notices and licensing review. The initial calculation will be independently
specified and validated.

The broader
[scientific Python reference inventory](../design/spatial-clustering-reference-inventory.md)
adds SciPy, scikit-learn, PySAL `esda`, and PySAL `pointpats` as design,
synthetic-data, and differential-validation inputs. Their methods remain
separately labeled: density/partition clustering, spatial autocorrelation, and
space-time interaction do not become synonyms for this scan statistic.

## Required input

The active dataset supplies one row per case and explicitly maps:

- a nonblank record identifier;
- an event date or datetime;
- either a location identifier joined to a reviewed coordinate table, or
  numeric WGS 84 latitude and longitude;
- an optional categorical stratum used only by a future stratified method.

Latitude must be within `[-90, 90]`, longitude within `[-180, 180]`, and both
must retain at least five decimal places when entered or exported. Dates must
fall inside an explicit inclusive study period. Missing/invalid date or
location rows are excluded with reason counts; the command fails closed if no
eligible cases or fewer than two distinct locations or time units remain.

## Explicit parameters

The reviewed plan must freeze and display:

| Parameter | V0.1 boundary |
|---|---|
| analysis | retrospective space-time |
| model | space-time permutation |
| scan | high clusters only |
| coordinates | WGS 84 latitude/longitude |
| time aggregation | day, week, or month; explicit length |
| study period | explicit inclusive start and end |
| maximum spatial window | explicit distance and/or maximum case fraction |
| maximum temporal window | explicit duration and maximum study-period fraction |
| spatial shape | circular only |
| replications | explicit, at least 99 for preview and at least 999 for a reportable run |
| random seed | explicit and persisted |
| reported clusters | ranked, with a declared overlap rule |

Defaults may be proposed in the UI but never hidden in execution or history.
V0.1 rejects prospective scanning, low-rate scanning, elliptic/flexible shapes,
covariates, multiple datasets, and population-based risk models.

The aggregate Output document presents these values in an expanded analysis-
parameter table with a SaTScan parameter-name crosswalk. It also exposes the
plan and scoring contract versions, candidate-window count, Monte Carlo method,
replication count, p-value formula, random generator, and seed. The crosswalk
is an audit aid; matching labels do not establish numerical parity when window
enumeration, random streams, stopping rules, or product versions differ.

## Result contract

Each reported cluster includes:

- rank and stable cluster identifier;
- centroid/location membership and map geometry;
- temporal start/end and aggregation unit;
- observed and expected cases under the permutation null;
- observed/expected ratio (not population relative risk);
- log-likelihood ratio;
- Monte Carlo p-value and replication count;
- location and case counts;
- exclusions, overlap rule, seed, complete parameters, engine/method version,
  dataset fingerprint, and command source.

The UI must use **observed/expected ratio** for this model. It must not relabel
that value as population relative risk. Results appear in common Output,
history, an aggregate table, and a map layer; opening the map must not expose
row-level locations in exported logs.

Map rendering is a separate, explicit new-branch operation:

```text
EPIAI CLUSTER SPACE_TIME ... RESULT=FeverRashClusters
EPIAI CLUSTER RENDER RESULT=FeverRashClusters
```

`RESULT` names a typed, session/project result artifact containing aggregate
cluster rows plus map-ready center, radius, member geometry, and time interval.
`RENDER` consumes that artifact and does not rerun the analysis. The bare legacy
`MAP` command remains reserved for its own parity/revival work and is not
overloaded by Cluster Detection. Its Output document is a static raster: it
composites attributed OpenStreetMap tiles with ranked circles and aggregate
top-window locations, then freezes the result as an image so sequential Program
Output can retain it. Tile failure is explicit and leaves the analytical
overlays visible on a blank background. **Open in Maps** creates the interactive
layer and exposes a Previous/Next/Play story tour from rank 1 through n.

## Synthetic acceptance corpus

Create a deterministic, entirely synthetic line list containing:

1. a uniform null dataset;
2. one strong planted cluster with known locations and dates;
3. two non-overlapping planted clusters;
4. duplicated coordinates and boundary dates;
5. missing, malformed, and out-of-range rows with fixed exclusion counts; and
6. a metamorphic copy with permuted row order and renamed non-analysis fields.

The fixture manifest records generator version, seed, study extent, study
period, planted clusters, configuration, file hashes, and expected exclusions.

## Acceptance tests

- Same input, parameters, and seed produce identical ranked results.
- Row order and irrelevant-column changes do not change results.
- Observed and expected counts reconcile to independently constructed
  location-by-time margins.
- The planted-cluster fixture ranks the planted window first within declared
  spatial/time tolerances.
- Null simulations use a deterministic, documented random stream and the
  p-value is `(1 + exceedances) / (1 + replications)`.
- An independent JupyterLite notebook reconstructs margins, candidate-window
  scores, the leading cluster, and Monte Carlo p-value.
- A separately executed reference batch run is recorded as differential
  evidence with its product/version, parameter file, inputs, and outputs; discrepancies
  are explained before browser execution is labeled usable.
- Cancellation, candidate/window limits, and runtime budgets fail visibly and
  leave no partial result presented as final.

## Current implementation status

The V0.3 candidate permutes eligible cases' time-bin labels across their fixed
locations, preserving the observed spatial and temporal margins. It uses the
documented `mulberry32-v1` unsigned 32-bit random stream and Fisher-Yates
shuffle. Every replication scans every eligible candidate cylinder and retains
its maximum log-likelihood ratio. For each reported observed window,
`p = (1 + exceedances) / (1 + replications)`, where an exceedance is a null
maximum at least as large as the observed statistic.

The browser candidate rejects more than 25,000,000 replication-window
evaluations. The planted fixture freezes the 999-replication, seed `20260916`
result at 12 exceedances and `p=0.013`. These values are regression targets,
not yet validated epidemiologic output. The independent notebook reimplements the seeded stream, shuffle, complete null
scan, and frozen p-value; its published Run All output must still be archived.

The V0.4 execution boundary places the complete candidate calculation in a
dedicated module Worker. It reports the initial state, approximately one-percent
progress intervals, and completion. Cancellation terminates the Worker, rejects
all pending requests with `AbortError`, and creates a fresh instance for later
runs. Messages from a terminated or replaced instance are ignored, a 60-second
timeout fails visibly, and only the final result message can resolve a run; no
partial cluster result is returned as final. The Program Editor exposes this as
an explicitly labeled candidate preview with replication progress, elapsed
time, cancellation, aggregate-only Output, and aggregate-only history. This
does not promote the method to validated epidemiologic output.

## Initial SaTScan differential evidence

On September 16, 2026, an external SaTScan 10.1.3 retrospective space-time
permutation run independently selected the same leading spatial and temporal
window as the synthetic candidate: locations N1/N2, January 10–14, 2026. The
external run reported 10 observed, 4.29 expected, test statistic 3.510273, and
`p=0.027`; Epi Info AI reported 12 observed, 5.60 expected, LLR 3.669876, and
seeded `p=0.013`.

The external summary loaded 28 rather than 30 cases, accounting for the two-
case observed difference and the expected-count change. The distributable
SaTScan fixture now retains one count-1 row per source case—including duplicate
location/date rows—to make its 30-case reconciliation explicit. This evidence
supports methodological consistency of the selected window, not exact product
parity. A repeated external run with all 30 cases remains the exact numerical
comparison target.

## Implementation order

1. Typed plan, validation, canonical source, and history schema.
2. Synthetic generator and independent JupyterLite oracle.
3. Deterministic candidate-window enumeration and observed/expected scoring.
4. Worker-based Monte Carlo with progress and cancellation.
5. Output table and map layer.
6. External differential harness and epidemiologist review.
