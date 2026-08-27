# `epi.sampleSize.populationSurvey` V0.12 method contract

## Scope and status

This candidate ports the legacy **StatCalc > Population Survey** calculator for
a population survey or descriptive study. It accepts population size, expected
frequency, acceptable margin of error, design effect, and number of clusters,
and returns cluster size and total sample at 80%, 90%, 95%, 97%, 99%, 99.9%,
and 99.99% confidence. It is not statistically approved; G5 remains deferred to
the consolidated review.

## Audited legacy sequence

For each confidence level `c`, the legacy implementation:

1. obtains `z` using its iterative `ANorm(1 - c)` and polynomial `Norm` tail;
2. computes `factor = frequency × (100 - frequency) / margin²`;
3. computes the uncorrected size `n = z² × factor`;
4. applies finite-population correction `n / (1 + n / population)`;
5. rounds that base using .NET midpoint-to-even behavior; and
6. returns `ceil(designEffect × roundedBase / clusters)` as cluster size.

Total sample is cluster size multiplied by the number of clusters. V0.12 rejects
non-finite input, non-positive population/margin/design effect, expected
frequencies outside `(0, 100)`, non-integer population or clusters, clusters
below one, and confidence levels outside `(0, 1)`.

## Evidence and gaps

`population-survey-v0.12.json` freezes the seven legacy default outputs and a
clustered-design case. The Validation Lab independently translates the audited
legacy sequence in Python, compares an ordinary SciPy normal-quantile reference,
and calls the deployed WASM export.

Localization, input/accessibility parity, Save as Image, Print, broader legacy
output corpora, boundary/property testing, formal implementation review, and G5
remain open.
