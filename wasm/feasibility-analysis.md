# Epi Info browser/WASM feasibility analysis

**Assessment date:** 2026-08-24  
**Source reviewed:** [`Epi-Info/Epi-Info-Community-Edition`](https://github.com/Epi-Info/Epi-Info-Community-Edition), shallow clone at commit `4cd353c62c40b78d9d1f013b0f5a2bb685a5fca6` (2025-04-09)  
**Local source snapshot:** [`source/Epi-Info-Community-Edition`](source/Epi-Info-Community-Edition)

The official historical [`Epi Info 7 User Guide`](docs/reference/Epi-Info-7-User-Guide.pdf) is stored in this repository as the primary functional and terminology reference. Its provenance and checksum are recorded in [`docs/reference/README.md`](docs/reference/README.md).

## Executive conclusion

> **Decision update:** The subsequent architecture decision standardized the
> product application on TypeScript, selected Rust/WASM for the deterministic Epi
> kernel, and restricted JavaScript to thin runtime glue. The earlier recommendation
> below to compare .NET and Rust is retained as historical spike context. Execution
> now follows [`migration-plan.md`](migration-plan.md).

Porting Epi Info's essential workflows to an offline browser application is **technically feasible**. Reusing a meaningful portion of its validated epidemiologic algorithms is also feasible. Compiling the existing desktop solution directly to WebAssembly is not.

The recommended strategy is selective extraction:

1. Preserve the existing application as the behavioral reference.
2. Extract statistical behavior behind a small, typed, language-neutral contract.
3. Evaluate .NET and Rust implementations of the first statistical slice in browser WebAssembly, preferably in a Web Worker.
4. Replace the desktop database implementation with the official SQLite WASM build and OPFS persistence.
5. Build new browser-native UI, project, form, and audit layers around stable tool contracts.
6. Port Check Code as a deliberately sandboxed language subset, not as an unrestricted clone of the desktop interpreter.

The first proof of concept should be a complete 2×2 table calculation exposed as a JSON tool call and validated against the repository's 100-case `TwoBy2Stats.csv` corpus. This slice exercises the most important architectural boundary: structured browser input → deterministic WASM computation → structured epidemiologic result.

## Feasibility by subsystem

| Subsystem | Browser feasibility | Direct code reuse | Assessment |
|---|---:|---:|---|
| 2×2, exact tests, probability functions | High | High after extraction | Best first milestone |
| Frequencies, means, simple tables | High | Medium | Algorithms are portable; orchestration is coupled to `DataTable` and Epi interfaces |
| Regression and survival | Medium–high | Medium | Mostly managed algorithms, but needs typed inputs, validation, and parity testing |
| Complex-sample statistics | Medium | Medium | Substantial code exists; validate numerical behavior and performance carefully |
| SQLite project data | High | Low | Browser storage is viable, but the desktop SQLite provider must be replaced |
| Form/project model | High | Low–medium | Concepts and import rules are reusable; current object model is too coupled |
| Check Code | Medium | Low–medium | Grammar and rule behavior are useful; unsafe/OS-dependent commands need redesign |
| Maps and charts | High | Low | Use browser-native visualization libraries behind deterministic data contracts |
| Whole desktop solution | Low | Very low | Windows UI, native libraries, WCF, COM/ADO, filesystem, and process dependencies block it |

### Rust ecosystem assessment

No mature Rust equivalent of the complete Epi Info/OpenEpi/`epiR` analytic surface
was identified. The reusable opportunity is at the crate and algorithm level, not
an application that should be forked. Small recent rsomics crates cover relative
risk, odds ratio, and stratified CMH calculations and report differential testing
against SciPy or statsmodels. Linfa and SmartCore are plausible browser-WASM
regression candidates. `ndarray-glm` has a useful GLM surface but a material
`ndarray-linalg`/BLAS browser caveat. EpiRust and Jivanu concern epidemic modeling,
not the core field-analysis workflow.

The recommendation is therefore an owned, versioned `epi-core` facade that may
wrap, fork, or replace selected implementations only after the project's robust
validation gates. Details and current candidate status are recorded in the
[Rust epidemiology landscape assessment](docs/research/rust-epidemiology-landscape.md)
and [algorithm validation standard](docs/validation/algorithm-validation-standard.md).

## What was found in the source

### Solution shape

The repository contains 44 C# projects and one VB project, all using legacy non-SDK project files. The relevant computational path is split across three assemblies:

| Project | Language | Size observed | Target | Role |
|---|---|---:|---|---|
| `Epi.Statistics` | C# | 13 files / about 7,000 lines | .NET Framework 4.8 | Probability utilities, 2×2/M×N algorithms, interaction helpers |
| `StatisticsRepository` | VB | 38 files / about 21,500 lines | .NET Framework 4.8 | Exact tests, 2×2 tables, regression, survival, complex samples |
| `Epi.Analysis.Statistics` | C# | 19 files / about 8,400 lines | .NET Framework 4.8 | Analysis command orchestration, data shaping, HTML output |

This separation is promising, but the project references exaggerate the true coupling. For example, [`Epi.Statistics.csproj`](source/Epi-Info-Community-Edition/Epi.Statistics/Epi.Statistics.csproj) references the very large `Epi.Core` assembly even though much of the useful numerical code uses only `System`, collections, LINQ, and `System.Data`.

`Epi.Core` itself is not a suitable WASM kernel. It contains approximately 800,000 lines in this checkout, much of it generated datasets and service proxies, and references Windows Forms, `System.Drawing`, `System.Design`, WCF/service APIs, Entity Framework, and other desktop-era infrastructure.

### The reusable statistical seam is real

Several valuable files are already close to platform-neutral:

- [`Single2x2.cs`](source/Epi-Info-Community-Edition/Epi.Statistics/Single2x2.cs) is about 400 lines of managed numerical code for exact limits, conditional maximum likelihood estimation, Mantel-Haenszel statistics, and Breslow-Day calculations.
- [`SharedResources.cs`](source/Epi-Info-Community-Edition/Epi.Statistics/SharedResources.cs) contains managed probability-distribution functions.
- [`Table.vb`](source/Epi-Info-Community-Edition/StatisticsRepository/Table.vb) exposes `SigTable(a, b, c, d, confidence)` and returns a structured `SingleTableResults` value with odds ratio, risk ratio, risk difference, confidence limits, chi-square tests, mid-p, and Fisher exact results.
- [`EIExact.vb`](source/Epi-Info-Community-Edition/StatisticsRepository/EIExact.vb) implements the exact 2×2 calculations in managed code. `Table.vb` still declares an old `martinbb.dll` entry point, but the active `SigTable` path constructs `EIExact` instead of invoking that native function.
- [`StatLib.vb`](source/Epi-Info-Community-Edition/StatisticsRepository/StatLib.vb) provides managed distribution calculations used by the table code.

The direct obstacles in this seam are mostly removable packaging and legacy-language artifacts:

- `StatisticsRepository` references ADODB and `Microsoft.VisualBasic.Compatibility`/VB6 helpers.
- `Table.vb` mixes calculation, legacy error handling, debug output, formatting, and generated HTML.
- The VB project has `Option Strict Off` and extensive `Object`-typed intermediate values, which is undesirable for AOT, trimming, and long-term verification.
- `Epi.Statistics/SingleMxN.cs` imports R.NET and calls `REngine` for one Fisher-test path. R.NET/native R cannot be assumed to work in browser WASM. That path must be replaced, isolated, or deferred.

These are extraction problems, not evidence that the formulas need to be reinvented.

### Existing validation assets are unusually valuable

The repository already contains deterministic comparison data:

- `TwoBy2Stats.csv`: 100 cases covering 16 reported 2×2 statistics.
- `BinomialTests.csv`: 5,000 cases.
- Regression fixtures include 10,001-row logistic and linear datasets plus expected coefficient/result files.
- A matched-logistic fixture contains 30,001 rows.
- Existing test source contains seven test methods and over 200 assertions, including a `TwoByTwoTest` that checks odds ratios, risk ratios, confidence intervals, three chi-square variants, Fisher exact results, and exact limits.

The legacy test project cannot simply be retained: it targets .NET Framework 4.5, uses the old Visual Studio test framework, reads CSV through Jet/OLE DB, and depends on Windows/dashboard assemblies. The expected-value CSV files should be preserved and loaded by a new cross-platform test suite.

### Analysis orchestration is more coupled than the algorithms

[`Epi.Analysis.Statistics`](source/Epi-Info-Community-Edition/Epi.Analysis.Statistics) implements frequencies, means, tables, regression, survival, complex samples, and summarization. It is not an appropriate first extraction unit:

- It implements `EpiInfo.Plugin.IAnalysisStatistic` and depends on Epi analysis contexts.
- It uses `DataTable`, `DataRow`, and `DataSet` extensively.
- It combines data preparation, calculation, translation tokens, HTML generation, and output-table behavior.
- `Tables.cs` calls both `StatisticsRepository.cTable` and `Epi.Statistics.Single2x2`, demonstrating that the real kernel lies below this layer.

`System.Data` types are available in modern .NET, but retaining them as the public WASM API would preserve unnecessary allocation, string-expression filtering, and schema ambiguity. The new public API should use small typed request/result records and primitive arrays. A compatibility adapter can translate legacy `DataTable` inputs during validation.

### The desktop SQLite provider cannot be ported

[`Epi.Data.SQLite`](source/Epi-Info-Community-Edition/Epi.Data.SQLite) uses `System.Data.SQLite`, EF6-era packages, file paths, and Windows Forms connection dialogs. Its project also references `Epi.Windows`. It is a Windows database adapter despite its database engine being SQLite.

The browser implementation should instead use SQLite's official WASM distribution in a dedicated Worker. SQLite documents OPFS-backed VFS options and notes that OPFS is Worker-only; it also documents concurrency and Safari-specific tradeoffs. The likely default is `opfs-sahpool` for single-project/single-tab use unless multi-tab concurrency is a requirement. See SQLite's [official persistence documentation](https://sqlite.org/wasm/doc/tip/persistence.md).

The existing `IDbDriver` is too broad to reuse unchanged. It exposes provider-specific connection strings, OLE connection strings, typed Epi datasets, schema mutation, and other desktop concerns. Define a narrower browser data interface around transactions, parameterized queries, project metadata, import/export, and tabular streaming.

### Forms and project metadata are conceptually reusable

`Epi.Core` contains explicit `Project`, `View`, `Page`, field collections, many concrete field types, and database metadata providers. These are useful for deriving a compatibility schema and import rules. They should not be referenced from the WASM statistics library or copied wholesale into the new application.

A new versioned project schema should represent:

- forms, pages, fields, prompts, and legal values;
- validation and skip-logic events;
- table/schema mappings;
- saved analyses and visualizations;
- attachments and audit history;
- source-version/import metadata.

Legacy Epi Info import should be a boundary adapter that converts old projects into this schema. It should not force the browser runtime to reproduce the old internal object graph.

### Check Code is feasible only as a sandboxed subset

The checkout includes GOLD Parser grammar artifacts for Analysis and Enter/Check Code, plus generated grammar classes and rule implementations. This gives the project a valuable behavioral map. However, the interpreter projects depend on `Epi.Core`, parser DLLs, data adapters, and platform operations.

Rules found in the existing interpreter include filesystem checks, file dates, environment access, deletion, execution of programs, Python/R code, reading/writing files, reports, and external process behavior. Those capabilities are either impossible in a browser or inappropriate for untrusted project code.

Recommended approach:

1. Define a browser Check Code capability matrix.
2. Start with field assignment, validation, enable/disable, hide/show, conditional logic, navigation, and safe date/string/number functions.
3. Parse legacy syntax into a new intermediate representation.
4. Execute that representation against explicit form/data capabilities.
5. Reject unsupported commands with actionable import diagnostics.

This is safer and more maintainable than attempting to make the desktop interpreter compile unchanged.

## Recommended target architecture

```text
Browser PWA
├── Web UI
│   ├── forms and data entry
│   ├── analysis builder
│   ├── charts and maps
│   └── optional AI interaction
├── application/tool layer
│   ├── typed requests and results
│   ├── validation and provenance
│   └── authorization/capability checks
├── workers
│   ├── WASM epidemiology worker (.NET or Rust; selected by spike)
│   └── SQLite WASM/OPFS data worker
└── import/export
    ├── legacy Epi Info adapters
    └── explicit portable project package
```

The statistical worker should not know about HTML, UI controls, SQLite, AI, or legacy project objects. Its public contract should look like this conceptually:

```json
{
  "operation": "epi.table2x2",
  "input": {
    "exposedCases": 40,
    "exposedNonCases": 60,
    "unexposedCases": 10,
    "unexposedNonCases": 90,
    "confidenceLevel": 0.95
  }
}
```

The output should contain numeric values, explicit undefined/non-convergent states, warnings, method identifiers, engine version, and reproducibility metadata. Formatting belongs in the UI.

.NET 10 is a strong migration candidate because it is the current active LTS release through November 2028 under the [.NET support policy](https://dotnet.microsoft.com/en-us/platform/support/policy), can reuse translated/extracted managed code, and supports browser AOT and Web Workers. It is not a product requirement. Rust is the primary comparison candidate because it produces focused WASM modules without carrying the .NET runtime and offers strong control over memory and numerical types. The spike must select between them using measured compatibility, payload, speed, memory, maintainability, and integration results.

This architecture does not require the UI to share the kernel's language. A TypeScript UI can call either a .NET or Rust WASM worker through the same versioned contract. The UI framework should be selected separately based on accessibility, team skills, payload, and long-term maintenance.

The UI should preserve Epi Info's recognizable module launcher, terminology, workspace arrangements, and primary task sequences so returning users can orient themselves immediately. Modern components should improve accessibility, responsiveness, validation, recovery, and progressive disclosure without unnecessarily relocating familiar actions. The detailed product decision is recorded in [`docs/design/ui-compatibility-strategy.md`](docs/design/ui-compatibility-strategy.md).

## First proof of concept

### Scope

Implement only `epi.table2x2`:

- four non-negative cell counts;
- configurable confidence level, initially 0.90, 0.95, and 0.99;
- odds ratio and Taylor confidence interval;
- risk ratio and confidence interval;
- risk difference and confidence interval;
- uncorrected, Mantel-Haenszel, and Yates chi-square values/p-values;
- Fisher exact one- and two-tailed p-values;
- exact/MLE odds-ratio limits where supported by the reference implementation;
- warnings for sparse/zero cells and undefined estimates.

### Extraction approach

Create two small, independent implementations behind identical fixtures and serialized contracts:

```text
spikes/
  dotnet/
    EpiInfo.Statistics/          net10.0 pure library
    EpiInfo.Statistics.Worker/   browser-wasm worker/API
  rust/
    epiinfo-statistics/          Rust library and wasm target
contracts/
  table2x2.schema.json
fixtures/
  two-by-two/
tests/
  browser-parity/
```

For .NET, port the minimum call graph behind `cTable.SigTable`: the necessary parts of `Table.vb`, `EIExact.vb`, `StatLib.vb`, and the already-clean C# helpers. For Rust, translate that same minimum call graph directly from the reference source. In both versions, replace legacy `Object` values, `DBNull`, `On Error`, VB6 formatting, and mutable result arrays with typed values and explicit result states. Preserve formula order and constants until parity is established; cleanup comes after the golden tests pass.

### Acceptance gates

1. Native .NET tests match all 100 rows of `TwoBy2Stats.csv` within the tolerances already encoded by the legacy tests.
2. Browser tests produce the same serialized result as native .NET for every row.
3. Tests cover zero cells, all-zero input, large counts, fractional/weighted counts if supported, invalid confidence levels, NaN/infinity avoidance, and non-convergence.
4. Computation runs off the UI thread.
5. The browser build works in current Chromium, Firefox, and Safari.
6. The API returns structured values only—no HTML or localized strings.
7. The build records engine version and algorithm/method identifiers in every result.
8. A comparison report records compressed payload, cold start, calculation latency, peak memory, browser support, implementation effort, dependency risk, and developer-maintenance findings for both candidates.

### Runtime and AOT decision

The .NET candidate should begin with the normal IL-interpreted browser runtime for faster iteration, then add an AOT release measurement. Benchmark both .NET modes and Rust on representative low-end hardware. Microsoft explicitly describes the .NET AOT performance-versus-size tradeoff in its [WASM AOT documentation](https://learn.microsoft.com/en-us/aspnet/core/blazor/webassembly-build-tools-and-aot?view=aspnetcore-10.0).

## Delivery sequence after the spike

### Phase 0 — reproducible reference baseline

- Build the legacy assemblies in a controlled Windows environment.
- Capture repository commit, compiler/runtime, culture, and architecture.
- Run and archive all existing statistical fixtures.
- Add edge cases and compare with independently trusted packages or published examples.

**Exit criterion:** a versioned golden-master corpus independent of the desktop UI and Jet/OLE DB.

### Phase 1 — pure epidemiology kernel

- Complete the 2×2 proof of concept.
- Add distributions, binomial, frequency, means, and stratified tables.
- Establish typed contracts, deterministic serialization, numerical policies, and provenance.

**Exit criterion:** the priority outbreak-analysis tool set passes native and browser parity tests.

### Phase 2 — local data and project package

- Integrate official SQLite WASM in a Worker.
- Choose and test an OPFS VFS based on concurrency requirements.
- Implement explicit save/export/import and recovery workflows.
- Add schema migrations and storage-quota/error handling.

**Exit criterion:** a project survives offline reload, exports to a portable package, and can be restored after site storage is cleared.

### Phase 3 — forms and safe Check Code

- Define the new form schema.
- Implement core field types and accessible data entry.
- Add the sandboxed Check Code subset and compatibility diagnostics.
- Build legacy project import fixtures.

**Exit criterion:** representative legacy forms can be imported, used offline, and exported without silent behavioral changes.

### Phase 4 — advanced analysis and visualization

- Port regression, survival, and complex-sample modules incrementally.
- Add charts/maps as consumers of structured engine results.
- Benchmark memory and execution time with field-sized datasets.

**Exit criterion:** each advanced module has independent reference fixtures, browser parity, convergence/error tests, and documented limits.

### Phase 5 — optional agent layer

- Expose only versioned deterministic tool contracts.
- Log user intent, tool input, engine version, exact output, and interpretation.
- Keep all non-AI workflows fully available.

**Exit criterion:** disabling AI changes convenience, not application capability or statistical results.

## Principal risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Silent numerical drift during cleanup | High | Golden-master tests first; preserve operation order/constants; independent reference comparisons |
| Legacy tests encode bugs as expected behavior | High | Clinical/epidemiologic review and comparison with trusted independent implementations |
| Large datasets exhaust browser memory | High | Worker isolation, columnar/streamed inputs, chunking, explicit limits, representative-device benchmarks |
| AOT/trimming changes reflection or late-bound behavior | Medium–high | Remove late binding; typed contracts; trimming/AOT CI builds and browser tests |
| R.NET/native dependencies block WASM | Medium | Isolate and replace only affected algorithms; do not bring R runtime into the first kernel |
| OPFS locking or browser storage loss | High | Worker design, selected VFS, explicit export, recovery UX, quota/error tests |
| Check Code can access unsafe capabilities | High | Allowlisted intermediate representation and capability-based runtime |
| Full legacy parity expands without bound | High | Publish a compatibility matrix and prioritize outbreak workflows over obscure desktop behavior |
| Licensing/trademark assumptions | Medium | Preserve Apache 2.0 notices and obtain review for CDC/Epi Info names and marks; the repository license itself disclaims trademark rights |

## Decisions recommended now

1. Approve **selective extraction**, not wholesale retargeting.
2. Keep the statistical-kernel language **open until the .NET-versus-Rust 2×2 spike is measured**.
3. Approve **official SQLite WASM + OPFS** as a replacement, not a port of `Epi.Data.SQLite`.
4. Select **2×2 analysis** as the first vertical slice and use `TwoBy2Stats.csv` as its initial golden corpus.
5. Require **typed, versioned, auditable tool contracts** from the first commit.
6. Treat **legacy import compatibility** and **statistical parity** as separate workstreams.
7. Defer the final kernel language, UI framework, and AOT choice until the spike provides payload, performance, parity, and maintainability measurements.
8. Require **interaction continuity** with Epi Info 7 as a UI acceptance criterion, using experienced-user task testing rather than pixel similarity alone.

## Assessment limits

This is a static source and architecture assessment. The workstation currently has .NET runtimes but no .NET SDK or MSBuild installation, and the repository does not contain prebuilt statistical assemblies. Therefore the legacy solution, a retargeted library, and a browser WASM artifact were not compiled during this pass. The first proof-of-concept phase should close that gap and replace source-level feasibility with measured build, parity, payload, memory, and browser-performance results.

The source snapshot is shallow and represents the upstream default branch at the commit stated above. Additional release branches, historical revisions, or internal CDC source may contain different implementations and should be compared if they are in scope.

## Bottom line

The project has a credible bootstrap path. The existing source contains useful managed epidemiologic algorithms and unusually strong expected-result datasets, but its assembly boundaries are not the boundaries the browser product needs. Extract the math, redesign the contracts, replace platform services, and validate every step. That approach can produce a trustworthy browser epidemiology engine without either dragging the Windows application into WASM or discarding decades of tested behavior.
