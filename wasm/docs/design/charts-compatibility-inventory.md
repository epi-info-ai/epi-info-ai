# Visual Dashboard Charts compatibility inventory

This inventory defines the legacy floor for **Visual Dashboard > Add Analysis
Gadget > Charts**. The starting evidence is the vendored
`EpiDashboard/DashboardControl.xaml`, `EpiDashboard/ChartControl.xaml(.cs)`, and
`EpiDashboard/Controls/GadgetProperties/HistogramChartProperties.xaml(.cs)`.

## Learned workflow and legacy floor

The legacy Dashboard chart menu exposes Column, Line, Area, Pie, Aberration
Detection, Pareto, Scatter, and Epi Curve. The inspected chart-property panels
provide a main variable, optional weight and grouping variables, interval/step,
axis bounds, missing-value behavior, display controls, titles, dimensions, and
grid lines. The Epi Curve is therefore one old branch of a larger chart gadget;
the first browser slice does not redefine the full branch.

## Gap register

| Gap ID | Legacy branch | Browser state | Required follow-up |
|---|---|---|---|
| LEGACY-DASHBOARD-011 | Charts gadget menu and movable Dashboard canvas | Epi Curve is shown directly above Rates | Add/remove/move/resize gadgets and preserve the complete learned menu |
| LEGACY-DASHBOARD-012 | Epi Curve main date variable | Implemented for date and date-like fields | Review all legacy date parsing, locale, and invalid-value behavior |
| LEGACY-DASHBOARD-013 | Hour/Day/Month/Year interval and Step | Implemented with continuous empty bins and a 400-bin safety limit | Verify exact legacy bin anchoring and restore any reviewed Epi Week behavior |
| LEGACY-DASHBOARD-014 | Start/end x-axis bounds | Implemented with inclusive date-only end bounds | Verify date-time boundary semantics against reviewed desktop output |
| LEGACY-DASHBOARD-015 | Weight variable | Not implemented | Add only after typed weighting and statistical validation rules are approved |
| LEGACY-DASHBOARD-016 | One graph for each value / faceting | Current slice uses a stacked case-status series | Restore separate familiar facets; retain stacking only as a documented display extension if approved |
| LEGACY-DASHBOARD-017 | Include missing values | Missing grouping values are optional; records without a plottable date are disclosed but cannot be binned | Review legacy category/missing behavior for every chart type |
| LEGACY-DASHBOARD-018 | Titles, axes, colors, dimensions, grid lines | Accessible default chart only | Restore property controls and saved settings |
| LEGACY-DASHBOARD-019 | Other chart types | Not implemented | Restore Column, Line, Area, Pie, Aberration Detection, Pareto, and Scatter from audited code |
| LEGACY-DASHBOARD-020 | Chart export, print, refresh, filters, and persistence | Data table is available; other behaviors absent | Restore general gadget lifecycle, filtering, image/export, and saved Dashboard state |

## V0.16 bounded slice

The foodborne demo selects Onset Date and Case Status by familiar field hints,
plots 44 valid dates across three daily intervals, discloses the 52 missing onset
dates, and exposes the exact plotted counts in an accessible table. Chart data
preparation is deterministic TypeScript UI/application logic; it is not presented
as a Rust epidemiology-kernel algorithm or as validated statistical inference.

No Charts branch is deprecated or retired. Every unimplemented legacy behavior
above remains on the compatibility floor.
