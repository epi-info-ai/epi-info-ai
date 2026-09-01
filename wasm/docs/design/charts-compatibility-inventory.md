# Chart and graph compatibility inventory

## Purpose and counting rule

This inventory defines the chart parity floor across two learned Epi Info trees:

1. **Classic Analysis > Statistics > Graph**, which authors and executes a
   `GRAPH` programming-language command; and
2. **Visual Dashboard > Add Analysis Gadget > Charts**, which creates a saved,
   configurable Dashboard gadget.

The same visible name on both surfaces does not make the behaviors
interchangeable. Implementing Dashboard Epi Curve does not close Classic GRAPH
Epi Curve, and implementing Classic GRAPH Bar does not close a Dashboard chart.
Every row below closes independently across discovery, properties, data
semantics, rendering, Output/export, persistence, command round-trip, and legacy
differential validation.

The principal legacy evidence is:

- `Epi.Windows.Analysis/Dialogs/GraphDialog.resx/.cs/.Designer.cs`;
- `Epi.Core.Interpreter/grammar/EpiInfo.Analysis.Grammar.grm` and `Rule_Graph`;
- `Epi.Analysis.Statistics/Graph.cs`;
- `Epi.Windows.Analysis/TestCases/Graph.txt`, `Histogram.txt`, and
  `AggregateStatistics.txt`;
- `EpiDashboard/DashboardControl.xaml`, chart gadgets, and gadget-property
  panels; and
- `EpiDashboard/ChartControl.xaml`, retained as a separate source-era selector
  requiring reconciliation with the shipped gadget menu.

## User-facing chart-type floor

### Classic Analysis GRAPH dialog: 8 types

The shipped English `GraphDialog.resx` contains exactly eight selectable types.
These are the canonical familiar-dialog floor.

| Gap ID | Dialog label / command value | Current browser state | Required parity work |
|---|---|---|---|
| LEGACY-CLASSIC-GRAPH-001 | Area | Not implemented | Variables/cross-tab rules, aggregation, axes, series, Output, and desktop differential fixture |
| LEGACY-CLASSIC-GRAPH-002 | Bar | Browser-verified bounded candidate | One categorical variable, horizontal count bars (matching legacy `BarSeries`), title/axis titles, accessible SVG/data table, and foodborne fixture exist; multiple variables, cross-tabs, strata, weights, formatting, and exact desktop Output remain open |
| LEGACY-CLASSIC-GRAPH-003 | Bubble | Not implemented | Required numeric-variable roles, bubble-size semantics, missing values, axes, legend, and differential fixture |
| LEGACY-CLASSIC-GRAPH-004 | Column | Browser-verified bounded candidate | One categorical variable, vertical count columns (matching legacy `ColumnSeries`), title/axis titles, accessible SVG/data table, and foodborne fixture exist; multiple variables, cross-tabs, strata, weights, formatting, and exact desktop Output remain open |
| LEGACY-CLASSIC-GRAPH-005 | Epi Curve | Not implemented on Classic GRAPH | Date/numeric interval rules, DATEFORMAT, INTERVAL, STARTFROM, weighting, cross-tab behavior, and desktop differential fixture; Dashboard Epi Curve does not satisfy this row |
| LEGACY-CLASSIC-GRAPH-006 | Line | Not implemented | Ordering, category/date/numeric axes, multiple series, aggregation, and differential fixture |
| LEGACY-CLASSIC-GRAPH-007 | Pie | Browser-verified bounded candidate | One categorical variable, frequency-proportional slices, keyboard-focusable labels, legend, accessible data table, and foodborne fixture exist; aggregation/weights, strata, ordering/label properties, exact desktop Output, and differential review remain open |
| LEGACY-CLASSIC-GRAPH-008 | Scatter | Not implemented | Exact one/two-variable requirements, numeric coercion, axes, strata/series, and differential fixture |

Current Classic dialog coverage is **3 of 8 browser-verified candidates** and
**0 of 8 legacy-parity-verified**. No type is approved for retirement.

### Visual Dashboard Charts gadget menu: 8 branches

`DashboardControl.xaml` exposes eight enabled chart gadgets in this order.

| Gap ID | Gadget label | Current browser state | Required parity work |
|---|---|---|---|
| LEGACY-DASHBOARD-021 | Column chart | Not implemented | Restore gadget properties, rendering, canvas lifecycle, persistence, and differential fixture |
| LEGACY-DASHBOARD-022 | Line chart | Not implemented | Restore gadget properties, rendering, canvas lifecycle, persistence, and differential fixture |
| LEGACY-DASHBOARD-023 | Area chart | Not implemented | Restore gadget properties, rendering, canvas lifecycle, persistence, and differential fixture |
| LEGACY-DASHBOARD-024 | Pie chart | Not implemented | Restore gadget properties, rendering, canvas lifecycle, persistence, and differential fixture |
| LEGACY-DASHBOARD-025 | Aberration Detection chart | Not implemented | Audit detection model/settings and validate statistical semantics before rendering parity |
| LEGACY-DASHBOARD-026 | Pareto chart | Not implemented | Restore category ordering, cumulative series, properties, and differential fixture |
| LEGACY-DASHBOARD-027 | Scatter chart | Not implemented | Restore variable roles, axes, grouping, properties, and differential fixture |
| LEGACY-DASHBOARD-028 | Epi Curve chart | Bounded V0.16 candidate | Main date, optional grouping, interval/step, bounds, missing disclosure, accessible chart/data table; legacy faceting, weights, properties, export, persistence, and differential review remain open |

Current Dashboard menu coverage is **1 of 8 bounded candidates** and **0 of 8
legacy-parity-verified**.

Across the two primary learned surfaces there are **16 independently tracked
chart branches** and **10 unique user-facing names**: Area, Bar, Bubble, Column,
Epi Curve, Line, Pie, Scatter, Aberration Detection, and Pareto.

## Programmatic and source-era variants requiring reconciliation

These values are real legacy evidence but are not silently added to the eight-item
Classic dialog or eight-item Dashboard menu. They remain compatibility-floor
investigations until their reachable workflow and semantics are classified.

| Evidence class | Values found | Disposition |
|---|---|---|
| Classic GRAPH regression programs | Histogram, Rotated Bar, Weight Bar, and `Scatter XY` in addition to dialog values | Preserve test source; determine accepted aliases, output behavior, and whether each belongs in direct-source compatibility even when absent from the dialog |
| `SilverlightStatics` graph constants | EAR, Histogram, Rotated Bar, Stacked, TreeMap, WeightedBar, and WeightedColumn in addition to core types | Trace callers and shipped reachability; do not claim a user-facing type merely because a constant exists |
| `EpiDashboard/ChartControl.xaml` selector | Epi Curve, Scatter, Stacked Column, Bar, Column, Line, Pie, Pareto | Reconcile this older/shared control with the gadget menu and document whether it remains reachable in the shipped application |
| Survival analysis programs | `Survival Probability` graph mode under KMSURVIVAL and COXPH | Track under Advanced Statistics output parity, not as a Classic `GRAPH` dialog type |

## Classic GRAPH syntax and property floor

The grammar and dialog expose more than a chart-type selector. Parity work must
also retain or explicitly adapt:

- one or more graph variables and the `*` cross-tab variable;
- `STRATAVAR`;
- raw weights and `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, `PERCENT`, and `SUMPCT`
  aggregate weights;
- `TITLETEXT`, `XTITLE`, and `YTITLE`;
- `DATEFORMAT`, `INTERVAL`, and `STARTFROM` for time-based graphs;
- dialog-dependent variable eligibility and series restrictions;
- missing-value, ordering, category, date, and numeric coercion behavior;
- graph-window and Output integration, refresh/cancel/error behavior;
- template/formatting options evidenced by legacy programs and code; and
- program source round-trip plus desktop differential rendering/data fixtures.

The V0.3 browser GRAPH executor intentionally supports only one real field,
`GRAPHTYPE="Bar"`, `GRAPHTYPE="Column"`, or `GRAPHTYPE="Pie"`, and optional title/axis titles. It
uses the existing typed FREQ operation for category counts and preserves the
legacy source distinction: Bar is horizontal and Column is vertical.
Unsupported source fails closed.

## Existing Dashboard cross-cutting gap register

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
| LEGACY-DASHBOARD-019 | Non-Epi-Curve Dashboard chart types | Not implemented | Close LEGACY-DASHBOARD-021 through LEGACY-DASHBOARD-027 independently |
| LEGACY-DASHBOARD-020 | Chart export, print, refresh, filters, and persistence | Data table is available; other behaviors absent | Restore general gadget lifecycle, filtering, image/export, and saved Dashboard state |

## Closure rule

A chart row becomes `legacy-parity-verified` only when its learned UI path,
eligible field roles, generated command or saved gadget state, data preparation,
rendered values, missing/ordering behavior, failure behavior, and export/Output
have automated fixtures and reviewed desktop Epi Info evidence. Visual similarity
alone is insufficient. No chart branch is deprecated or retired.
