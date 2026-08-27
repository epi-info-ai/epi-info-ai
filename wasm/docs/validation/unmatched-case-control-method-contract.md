# `epi.sampleSize.unmatchedCaseControl` V0.14 method contract

## Scope and status

This candidate ports **StatCalc > Unmatched Case-Control** for comparison of ill
and not-ill groups. It accepts two-sided confidence, power, the controls-to-cases
ratio, percent of controls exposed, and odds ratio. It derives percent of cases
with exposure and returns cases, controls, and total sample sizes using Kelsey,
Fleiss, and Fleiss with continuity correction. It is not statistically approved;
G5 remains deferred to the consolidated review.

## Audited legacy sequence

The legacy C# uses the same normal-tail and three-method mathematical core as
the Cohort calculator, with case/control terminology:

1. obtain confidence and power normal deviates with legacy `ANorm` and `Norm`;
2. derive case exposure from control exposure and odds ratio;
3. calculate the ratio-weighted average exposure;
4. calculate raw case counts using Kelsey and Fleiss;
5. apply the legacy Fleiss continuity-correction multiplier; and
6. independently ceiling cases and `raw cases * controls-to-cases ratio`, then sum.

The browser retains the linked odds-ratio and case-exposure fields and the
XAML-selected 99.9% confidence default. The frozen 95% case is the worked
example embedded in the legacy C# source. V0.14 rejects non-finite input,
confidence or power outside their open ranges, non-positive group ratio or odds
ratio, invalid exposure percentages, and odds ratio 1.

## Evidence and gaps

`unmatched-case-control-v0.14.json` freezes CDC's source example and an
unequal-group case. Rust and browser tests exercise both. The Validation Lab
independently translates the legacy formulas in Python, compares normal
deviates with SciPy, and calls the distinct deployed WASM exports.

Save as Image, Print, localization, broader legacy-output corpora, protective
effects, property and boundary testing, formal implementation review, and G5
remain open.
