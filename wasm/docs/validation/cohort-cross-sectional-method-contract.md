# `epi.sampleSize.cohortCrossSectional` V0.13 method contract

## Scope and status

This candidate ports **StatCalc > Cohort or Cross-Sectional** for unmatched
exposed and unexposed groups. It accepts two-sided confidence, power, the
unexposed-to-exposed ratio, outcome percentage in the unexposed group, and an
odds ratio. It derives the exposed outcome percentage and risk ratio and returns
exposed, unexposed, and total sample sizes using Kelsey, Fleiss, and Fleiss with
continuity correction. It is not statistically approved; G5 remains deferred
to the consolidated review.

## Audited legacy sequence

The port preserves the calculations in `EpiDashboard/StatCalc/Cohort.xaml.cs`:

1. obtain confidence and power normal deviates with the legacy iterative
   `ANorm` and polynomial `Norm` approximation;
2. convert odds ratio and unexposed outcome proportion to exposed outcome;
3. calculate the weighted average outcome for the requested group ratio;
4. calculate raw exposed-group sizes using the Kelsey and Fleiss formulas;
5. apply the legacy Fleiss continuity-correction multiplier; and
6. independently ceiling exposed size and `raw exposed size * ratio`, then sum.

The UI also retains the linked odds ratio, risk ratio, and exposed-outcome
fields and the XAML-selected 99.9% confidence default. The frozen 95% case comes
from the worked example embedded in the legacy C# source. V0.13 rejects
non-finite input, confidence and power outside their open
ranges, non-positive group ratio or odds ratio, invalid outcome percentages,
and odds ratio 1 because it yields no detectable difference.

## Evidence and gaps

`cohort-cross-sectional-v0.13.json` freezes the example embedded in CDC's source
and an unequal-group case. Rust unit tests and browser contract tests exercise
both. The Validation Lab independently translates the legacy formulas in Python,
compares the legacy normal approximation with SciPy, and calls the deployed WASM
exports.

Save as Image, Print, localization, broader legacy-output corpora, property and
boundary testing, formal implementation review, and G5 remain open.
