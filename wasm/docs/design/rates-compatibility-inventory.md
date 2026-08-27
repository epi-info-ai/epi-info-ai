# Visual Dashboard Rates compatibility inventory

This inventory defines the legacy floor for the Visual Dashboard `Rates`
gadget. It is based on `RatesProperties.xaml(.cs)`, `RatesControl.xaml.cs`, and
`RatesParameters.cs` in the vendored Epi Info Community Edition source. V0.11
is a bounded COUNT-based candidate, not dashboard parity or statistical approval.

## Legacy workflow and output floor

The learned path is **Visual Dashboard > Add Analysis Gadget > Rates**. The
legacy Define Rate panel selects an aggregate and field for the numerator, an
optional numerator condition and distinct setting, then a second aggregate,
field, condition, and distinct setting for the denominator. A rate multiplier
defaults to 100 and accepts ordinary numbers or powers of ten. Grouping/sorting,
display, filters, titles, descriptions, colors, row limits, clipboard, HTML,
Excel, and placement controls are separate retained branches.

The audited numeric core is `(numerator aggregate / denominator aggregate) ×
rate multiplier`. Output includes Rate, True Count, False Count, a description,
and optional group/color fields. The legacy implementation applies the
denominator condition to both aggregates before applying the numerator condition.

## Compatibility matrix

| Gap ID | Legacy branch | V0.11 state | Required follow-up |
|---|---|---|---|
| LEGACY-DASHBOARD-001 | Visual Dashboard launcher and gadget canvas | Separate launcher restored; single Rates workspace | General canvas, add/remove/move/resize, saved dashboard |
| LEGACY-DASHBOARD-002 | Rates numerator aggregate, field, condition | COUNT + one equality value | Full condition builder and aggregate list |
| LEGACY-DASHBOARD-003 | Rates denominator aggregate, field, condition | COUNT of non-missing field | Full condition builder and aggregate list |
| LEGACY-DASHBOARD-004 | Distinct numerator/denominator | Open gap | Typed distinct semantics and fixtures |
| LEGACY-DASHBOARD-005 | Numeric multiplier including `10^n` | Preset positive multipliers | Free-form reviewed parser and legacy formatting |
| LEGACY-DASHBOARD-006 | Primary/secondary grouping and sorting | Open gap | Grouped result contract and ordering tests |
| LEGACY-DASHBOARD-007 | Filters, display, titles, descriptions, row limits | Open gap | Shared dashboard property panels |
| LEGACY-DASHBOARD-008 | Threshold colors and visualization | Open gap | Accessible palette and boundary semantics |
| LEGACY-DASHBOARD-009 | Clipboard, HTML, Excel, placement, close | Open gap | Browser export and canvas controls |
| LEGACY-DASHBOARD-010 | Rate, True Count, False Count, description | Candidate output | Reviewed legacy-output corpus and G5 |

No legacy Rates or Visual Dashboard branch is deprecated. Every open row remains
part of the compatibility floor.
