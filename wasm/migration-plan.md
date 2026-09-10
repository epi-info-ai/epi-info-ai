# Epi Info AI migration plan

## Purpose

This plan moves the working browser demo toward the target Epi Info AI product
without stopping delivery or replacing the familiar Epi Info workflow all at
once. It covers three coordinated migrations:

1. JavaScript feature code to TypeScript.
2. Deterministic epidemiologic calculations to a Rust/WASM kernel.
3. Desktop-first layouts to mobile-first, familiarity-preserving components.
4. A versioned, capability-based plugin platform for approved extensions.

The plan also includes the validation, storage, synchronization, testing, and
delivery work needed to make those migrations safe.

## Decisions already made

| Area | Decision |
|---|---|
| Product language | TypeScript for UI and application feature code |
| Epidemiologic kernel | Rust compiled to WebAssembly |
| JavaScript | Thin boot/WASM glue and reviewed pinned vendor code only |
| UI direction | Mobile-first reflow while preserving Epi Info names, task order, visual identity, and wide-screen density |
| Current online demo store | Supabase with authentication and Row Level Security |
| Current synchronization unit | Single-user whole-project snapshot; not a collaborative merge model |
| Deployment | Static GitLab Pages artifact built and tested in GitLab CI |
| AI | Optional orchestration only; never the source of statistical results |
| Local AI prototype | IBM Granite 4.0 350M Instruct in a WebGPU Worker; explicit loading, aggregate-only context, typed allowlisted proposals, and user-reviewed actions |
| Plugins | Versioned, capability-based, sandboxed packages; core workflows never depend on plugins |

## Migration principles

1. **Keep main deployable.** Every merge must leave the GitLab Pages demo usable.
2. **Separate migration from redesign.** A language-only change must not also
   relocate controls or alter calculations.
3. **Protect numerical behavior.** An algorithm moves to Rust only after fixtures
   describe its expected results and edge cases.
4. **Preserve familiar workflows.** Mobile layouts may use drawers, tabs, and
   focused views, but must retain Epi Info terminology and task sequence.
5. **Make state recoverable.** Storage or sync changes require export, conflict,
   and failure handling before becoming the default.
6. **Use explicit contracts.** Projects, forms, records, map layers, validation
   findings, and engine results have versioned TypeScript types and serialized
   schemas.
7. **Do not expose secrets.** Browser code receives only public/publishable
   configuration. Provider secrets and privileged database credentials stay in
   the service configuration.
8. **Use synthetic data until reviewed.** The demo is not approved for sensitive
   or production public-health data.
9. **Keep plugins outside the trust boundary.** Extensions receive only declared,
   approved capabilities and can be disabled without breaking core workflows.
10. **Drive gaps from the legacy capability register.** Inventory the old manual
    branches and their C# assets before declaring parity or designing extensions;
    label deliberate browser additions as new branches.
11. **Do not regress below the compatibility floor.** An inventoried legacy
    capability remains required until implemented or explicitly retired through
    review with a documented replacement; an unimplemented prototype control
    never narrows that floor.
12. **Treat menus as behavioral contracts.** Preserve learned menu paths,
    ordering, context-sensitive state, command semantics, state transitions, and
    feedback. A same-named button is not parity by itself; additions are labeled
    new branches and all changes are recorded in the menu compatibility registry.

## Current baseline

The current slice is a static HTML/CSS application with transitional ES-module JavaScript,
a small dependency-free Rust WASM artifact, vendored Leaflet, browser-local form
and record state, CSV import/export, maps, and single-user Supabase snapshot sync.
The pinned TypeScript/esbuild foundation checks maintained source and creates
`wasm/dist`; GitLab CI publishes only that generated artifact. The temporary
source-copy Pages fallback was removed after two successful generated-artifact
deployments.

Before changing the build or module boundaries, capture a baseline checklist:

- Main menu launches Create Forms, Enter Data, Maps, Visual Dashboard, Classic,
  and StatCalc as currently supported.
- Form creation from CSV preserves headers, inferred types, and record counts.
- Form Designer drag/drop and snap-to-grid work.
- Required fields prevent an incomplete record from being saved.
- CSV import/export round-trips representative quoted and Unicode values.
- Standalone and Enter-linked map workflows remain separate.
- The 2 x 2 example returns its current versioned result object.
- Supabase connection testing, GitHub sign-in, schema detection, upload, download,
  and revision-conflict messages remain functional.
- The published desktop layout remains recognizable to experienced Epi Info users.
- Form Designer project commands share a guarded New/Open/Close/Recent lifecycle,
  including a true no-project state, autosave/synchronization feedback, failure
  recovery, and non-destructive Close behavior.

## Target source layout

The migration may proceed incrementally toward this layout:

```text
wasm/
|-- app/
|   |-- main.ts                    application composition
|   |-- contracts/                 shared TypeScript types and schemas
|   |-- shell/                     navigation and familiar application chrome
|   |-- forms/                     designer, validation, and data entry
|   |-- analysis/                  analysis UI and engine client
|   |-- maps/                      mapping UI and layer adapters
|   |-- storage/                   local and hosted storage adapters
|   |-- sync/                      authentication and synchronization
|   |-- plugins/                   manifest validation, capability host, and UI contributions
|   `-- styles/                    tokens and mobile-first component styles
|-- public/
|   |-- vendor/                    reviewed browser dependencies
|   `-- epi2x2.wasm                release WASM artifact
|-- engine-rust/                   deterministic epidemiology crates
|-- contracts/                     serialized operation/result schemas
|-- plugins/
|   |-- sdk/                       versioned manifest and host API types
|   |-- built-in/                  reviewed first-party reference plugins
|   `-- fixtures/                  compatibility, denial, and failure test packages
|-- tests/
|   |-- fixtures/                  legacy and edge-case reference data
|   |-- unit/                      TypeScript module tests
|   |-- browser/                   workflow and accessibility tests
|   `-- parity/                    Rust/browser numerical parity tests
`-- demo/                          transitional source until migration completes
```

The exact folder move is not a prerequisite. Modules should be migrated first;
large mechanical relocations should happen only after imports and tests are stable.

## Phase 0 - Baseline and guardrails

### Implementation status

- [x] Synthetic CSV, project snapshot, map, and 2 x 2 fixtures are versioned.
- [x] The current WASM artifact checksum and export contract are recorded.
- [x] A dependency-free automated baseline checks assets, syntax, WASM, the result
  contract, CSV behavior, map filtering, and Supabase RLS setup.
- [x] GitLab CI runs the automated baseline before Pages deployment.
- [x] A repeatable manual browser checklist covers visible workflows, responsive
  behavior, accessibility observations, authentication, and RLS isolation.
- [x] The Phase 0 release record was completed against the generated artifact.
  Browser-authenticated checks that could not be repeated are identified as
  limitations rather than silently treated as passes.

### Deliverables

- Document the baseline checklist above as repeatable smoke tests.
- Capture representative CSV, form schema, project snapshot, map, and 2 x 2
  fixtures that contain no sensitive data.
- Record the current result contract and WASM artifact checksum.
- Add a CI check that fails when required demo files are missing.
- Add `architecture.md`, this plan, and security/data-use notices to review scope.

### Exit gate

The current demo can be verified from a clean checkout, and failures in its core
workflows can be detected before deployment.

## Phase 1 - TypeScript build foundation

### Implementation status

- [x] Pinned pnpm, TypeScript, and esbuild versions are recorded in a lockfile.
- [x] Strict TypeScript checking is enabled for new `.ts` modules while the current
  `.js` modules remain valid transitional inputs.
- [x] A production build compiles maintained browser modules, emits source maps,
  copies reviewed static/WASM assets, and records a build manifest.
- [x] Shared project, form, field, record, storage, and map-point contracts have
  an initial strict TypeScript definition.
- [x] Local scripts cover type checking, baseline tests, production build, built-
  artifact verification, and preview.
- [x] GitLab CI separates browser checks, Rust native/WASM builds, production
  artifact generation, and Pages deployment.
- [x] Two successful default-branch deployments from `wasm/dist` were confirmed
  (pipelines 293728 and 293878), and the temporary source-copy fallback was
  removed. Pipeline 293879 then confirmed the fallback-free Pages job.

This phase changes how the app is built, not how it behaves.

### Deliverables

- Add a pinned package manifest and lockfile.
- Add TypeScript with strict checking for new `.ts` files and transitional support
  for existing `.js` modules.
- Use a lightweight static-site build that supports TypeScript, relative GitLab
  Pages asset URLs, WASM, and copied vendor assets.
- Add scripts for type checking, unit tests, production build, and local preview.
- Change GitLab CI from copying source files to publishing a tested build artifact.
- Keep source maps available to approved debugging environments without embedding
  secrets or private data.
- Document the supported local toolchain and reproducible build commands.

### CI order

1. Install from the lockfile.
2. Type-check TypeScript.
3. Run TypeScript unit tests.
4. Run Rust tests and build the WASM artifact in the kernel job.
5. Verify the expected WASM export surface and checksum/provenance metadata.
6. Build the static application.
7. Run browser smoke tests against the built artifact.
8. Publish Pages only when all required jobs pass on the default branch.

### Exit gate

The generated Pages artifact behaves like the pre-build demo, and a clean CI run
can reproduce it without committed generated JavaScript.

### Rollback

The transition fallback has been retired. Roll back by redeploying the last
known-good generated artifact; do not publish untested source files directly.

## Phase 2 - TypeScript feature migration

Migrate one module per reviewable change. Do not combine a module conversion with
new user-visible functionality.

### Implementation status

- [x] Shared project contracts now include runtime validation for local and hosted
  snapshots, including version, form/field uniqueness, record values, storage, and
  synchronization metadata.
- [x] Unreadable local project JSON is preserved under a recovery key before the
  application falls back to compatible legacy form and record storage.
- [x] Supabase synchronization is TypeScript, with typed configuration, sessions,
  hosted rows, API errors, and validated upload/download boundaries.
- [x] Maps and its external data/browser boundaries are strict TypeScript; the
  pinned Leaflet global is confined to the map adapter.
- [x] The application controller, familiar menu shell, forms/data entry, and
  engine adapter are strict TypeScript without changing serialized keys or DOM IDs.
- [x] CSV parsing/schema inference, project load/recovery, and generic browser
  persistence have been extracted from the transitional form controller.
- [x] Explicit map/layer and versioned 2 x 2 request/result contracts are present.
- [x] No handwritten application-feature JavaScript remains; generated JavaScript
  and reviewed pinned vendor libraries are the only JavaScript artifacts.

### Module order

1. **Contracts and utilities:** project, form, field, record, map, storage, sync,
   validation, and engine result types.
2. **Supabase synchronization:** type public configuration, sessions, snapshots,
   revisions, and API responses; keep Row Level Security as the authorization
   boundary.
3. **Maps:** type data sources, coordinate selection, layers, popups, and browser
   geolocation results. Use the stable gap IDs in the legacy capability register;
   this language-only conversion does not itself close deferred feature gaps.
4. **Application controller:** type 2 x 2 inputs/results and module navigation.
5. **Forms and data entry:** split the current large module into schema, designer,
   entry, CSV, local persistence, and project-state modules before adding features.
6. **Engine adapter:** retain only the minimal JavaScript needed for startup/WASM
   loading; move validation and result formatting to typed code or Rust according
   to ownership.

### Rules for each conversion

- Preserve DOM IDs, storage keys, serialized data, and public behavior.
- Add types at external boundaries rather than casting unknown data broadly.
- Validate data loaded from CSV, local storage, Supabase, and WASM before use.
- Add unit tests for extracted pure functions.
- Keep a compatibility reader for existing browser-local project snapshots.
- Do not add a UI framework during these behavior-preserving conversions. Evaluate
  that separately after module boundaries are stable.

### Exit gate

All maintained feature logic is TypeScript, type checking is strict, and remaining
handwritten JavaScript is listed and justified as runtime glue.

### Exit record

The exit gate is met. `app.ts`, `engine.ts`, `form-data.ts`, `maps.ts`, `shell.ts`,
and `supabase-sync.ts` pass strict checking. The production build emits JavaScript
from these sources. The only source JavaScript retained is reviewed pinned vendor
code under `demo/vendor/`; Leaflet's global runtime surface is isolated in
`maps.ts`. Further extraction of designer and entry rendering from
`form-data.ts` remains a reviewability refactor before Phase 4 functionality, not
untyped migration debt.

## Phase 3 - Mobile-first application shell and data entry

Convert one visible workflow at a time, starting with the tasks most likely to be
used in the field.

### 3A. Design tokens and shell

- Extract colors, spacing, borders, typography, focus styles, and status states
  from the familiar desktop UI into reusable CSS tokens.
- Make the base CSS target a narrow touch screen; add tablet and desktop layouts
  with `min-width` queries.
- Preserve the title bar, Epi Info AI identity, module names, and online/local
  status indicators.
- Provide at least 44 by 44 CSS pixel touch targets and visible keyboard focus.

#### Implementation status

- [x] The familiar palette, surfaces, status colors, spacing, radii, focus ring,
  shell heights, and minimum control size are reusable CSS tokens.
- [x] Narrow-screen shell and launcher rules are the base; tablet and desktop
  composition is restored with `min-width: 641px` and `min-width: 961px` queries.
- [x] The Epi Info AI identity, learned menu tree, module names, Help control,
  local status, launcher ordering, and desktop visual landmarks remain present.
- [x] Launch controls meet the 44 by 44 CSS pixel target and interactive elements
  have visible keyboard focus; reduced-motion preferences are honored.
- [x] Chromium checks cover phone, tablet, and desktop launchers, page overflow,
  focus, status announcements, and familiar menu navigation.
- [x] `shell-compatibility-inventory.md` maps the responsive adaptation to the
  manual and legacy C#/XAML assets without declaring an old branch retired.

#### Exit record

Phase 3A is complete for the shared application shell and main launcher. Inner
module workspaces still contain transitional desktop-first responsive rules; they
move one workflow at a time in Phases 3B onward and are not included in this exit
claim.

### 3B. Enter Data

- Show one clear record-entry task on phones.
- Keep field prompts and entry order identical across viewports.
- Move the line list into a reachable secondary view rather than placing a wide
  table below an excessively long form.
- Preserve desktop side-by-side density where space allows.
- Make save state, validation errors, and synchronization state visible near the
  action that caused them.

#### Implementation status

- [x] Phones open with New record as the primary task and expose Saved records as
  an explicit secondary view with a live record count.
- [x] The view switch does not modify schema order, prompts, storage keys, CSV
  contracts, records, or the Enter Data > Maps linkage.
- [x] Tablet layouts show both panels in task order and desktop restores the
  familiar side-by-side form and line list.
- [x] Record save feedback remains beside Save/Clear; CSV import/export feedback
  remains directly below its controls; the local/hosted working-copy badge remains
  visible in the Enter Data heading.
- [x] Record controls and view actions meet the mobile touch target and visible
  focus contract inherited from Phase 3A.
- [x] Chromium tests cover field order, phone view switching, local save, line-list
  visibility, CSV import feedback, and tablet/desktop panel composition.
- [x] `enter-data-compatibility-inventory.md` maps the slice to the manual and C#
  assets and retains unimplemented record, validation, and Check Code capabilities
  as stable gaps.

#### Exit record

Phase 3B is complete as a responsive migration of the current Enter Data slice.
It does not claim full Enter Data parity: record navigation/edit/delete, multi-page
forms, legal values, Check Code, and scalable persistence remain open
`LEGACY-ENTER-*` gaps.

### 3C. Project storage and main menu

- Reflow storage/authentication dialogs without hiding status messages below the
  viewport.
- Keep Create Forms, Enter Data, Classic, Visual Dashboard, Create Maps, StatCalc,
  and their familiar grouping on all sizes.

#### Implementation status

- [x] Project and Project Storage dialogs use a phone-first bounded-height layout
  with scrollable content, persistent title/actions, 44-pixel controls, and wider
  tablet/desktop presentation.
- [x] Connection feedback remains below Test Connection/Copy Setup SQL, account
  feedback below sign-in/account actions, and synchronization feedback below
  upload/download actions.
- [x] The storage summary distinguishes offline, local, pending, connected,
  synchronized, and failed states; synchronized is only set after a confirmed
  upload or validated download.
- [x] Phone/tablet/desktop tests lock the familiar launcher labels, Analyze Data
  grouping, and order without enabling unfinished Classic or Dashboard controls.
- [x] Browser tests cover dialog bounds/scrolling, touch targets, feedback
  placement, connection and failure states, network transitions, and the local
  New Project note.
- [x] `storage-compatibility-inventory.md` records legacy project/database paths,
  safe browser adaptation boundaries, and new browser/Supabase branches.

#### Exit record

Phase 3C implementation is complete. The automated Phase 3 gate passes across
phone, tablet, and desktop. Formal experienced-user review remains required before
the related shell, Enter Data, or storage gaps can be marked parity-complete.

### Exit gate

The main menu, project storage, and Enter Data pass keyboard and touch checks at
representative phone, tablet, and desktop widths. Experienced users can identify
and complete the same workflow without relearning module names or task order.

## Phase 4 - Form Designer and data-quality validation

An enabling migration slice now provides the V2 portable project envelope,
read-only `Sample.mdb` converter, official Sample fixture, and familiar File >
Open Project / Save Project As flow. It preserves the `Statistics` PGM and the
complete legacy metadata inventory needed to drive later Form Designer and
program-engine compatibility tests. This does not complete Phase 7 durable
storage. The Phase 4 prototype exit gate is now complete; remaining legacy-form
parity gaps stay open in the compatibility inventories.

### Implementation status

- [x] Typed, serializable required, number/date range, legal/comment-legal,
  pattern, unique, and calculated-age rules are runtime validated.
- [x] Calculated age uses completed years from a configured source date and
  optional as-of date, is read-only during entry, and is materialized on save and
  tabular import.
- [x] The safe Check Code subset supports field After-event conditions with
  same-form `GOTO`, `ENABLE`, `DISABLE`, `HIDE`, `UNHIDE`, `SET-REQUIRED`, and
  `SET-NOT-REQUIRED`; arbitrary imported source is never executed.
- [x] Manual entry and CSV/TSV/JSON/Excel imports share record validation;
  restored local, portable, and hosted snapshots are revalidated and direct the
  user to Data Quality without silently discarding records. Enter Data imports
  first produce a non-mutating review: SHA-256 repeat-file warning, suggested
  identity key, new/matching/changed/unchanged and validation counts, then an
  explicit legacy-informed update-and-append, update-only, append-new, or
  browser-adapted replace choice. Ambiguous keys and invalid rows fail closed.
- [x] Data Quality reports completeness and violations, identifies unique-field
  and exact-row duplicate candidates, and provides side-by-side comparison.
- [x] Duplicate deletion requires a reason and confirmation, moves the record to
  a persisted Recycle Bin, records an audit event, and supports restoration.
- [x] Contract, pure-function, build-artifact, and Chromium workflow tests cover
  the Phase 4 slice.

### Form Designer

- Desktop/tablet retains the Project Explorer, field palette, dotted canvas, and
  drag/drop placement.
- Phone layout uses focused views or drawers for the explorer and palette; precise
  field positioning may use properties and ordering controls in addition to touch
  drag/drop.
- Snap-to-grid remains an explicit project/user preference.

### Validation model

Add typed, serializable field rules for:

- required values;
- lower and upper number/date bounds;
- legal and comment-legal values;
- text/number/date patterns;
- stable unique identifiers;
- calculated age using an auditable date-based function;
- safe skip logic and an allowlisted Check Code subset.

Apply the same rules during manual entry, every supported tabular adapter (CSV,
TSV, JSON records, and Excel `.xlsx`), hosted download, and project restore.
Validation results must identify the form, record, field, rule, severity, and
suggested resolution.

### Data Quality workspace

- Missing-value review.
- Range and legal-value violations.
- Frequency-based duplicate candidates.
- Side-by-side record review before any merge or deletion.
- Recoverable deletion and an audit event; do not reproduce an unguarded permanent
  delete command in the browser UI.

### Geo-location parity slice

Preserve the official Form Designer Geo-location template and desktop workflow:
Address -> Get Coordinates command button -> `GEOCODE Address, Latitude,
Longitude` -> result review/selection -> signed coordinate fields -> Enter Data
Maps/Case Cluster. The first browser candidate uses a typed Click statement and
provider boundary; it never changes coordinate fields on service failure or
before explicit selection. Manual/imported coordinates stay usable.

After the familiar selection step, a labeled Preview Map new branch may show the
current point over OpenStreetMap. Dragging that point or clicking the map updates
the current unsaved latitude/longitude controls immediately at seven decimal
places. This refinement must never silently select an ambiguous geocoder result,
and manual point placement must remain usable when basemap tiles are unavailable.

The direct public Nominatim adapter is limited to the light GitLab Pages demo and
is not the target service for a large deployment. Before parity closure, provide
approved configurable infrastructure, privacy and audit controls, provider
policy/capacity handling, richer legacy result semantics, acquisition provenance,
and experienced-user review. Browser GPS and any click-map coordinate picker are
separately registered adaptations/new branches, not substitutes for this path.

### Exit gate

The manual's core Data Quality Check workflow is represented by tested validation
rules and a familiar review flow. Imported and manually entered records are checked
consistently, and destructive actions are auditable and recoverable.

### Exit record

The prototype exit gate is met. This records completion of the planned migration
slice, not Epi Info Form Designer parity: pages/templates, the full Check Code
language and event model, editing/navigation, group actions, and scalable
persistence remain named legacy gaps.

## Phase 5 - Rust epidemiology kernel expansion

The Rust kernel owns deterministic epidemiologic computation, not DOM, storage,
authentication, formatting, or AI interpretation.

All work in this phase must pass the repository's
[algorithm validation standard](docs/validation/algorithm-validation-standard.md).
The [Validation Lab plan](validation-lab.md) defines how immutable fixtures,
legacy output, independent Python references, and the release Rust/WASM artifact
are brought together, beginning with the canonical foodborne-outbreak corpus.
Candidate Rust crates are implementation options behind the owned `epi-core`
facade, not trusted result sources. See the
[Rust epidemiology landscape assessment](docs/research/rust-epidemiology-landscape.md).

### Programming curriculum and reference corpus

The browser implementation must preserve not only individual statistical results
but also the learned Epi Info programming workflows that compose commands into
repeatable investigations. Use the following CDC materials as behavioral evidence
and sources for acceptance fixtures:

The classified source list and promotion workflow are maintained in the
[programming curriculum corpus](docs/design/programming-curriculum-corpus.md) and
its machine-readable registry. Curriculum priority describes representative user
workflows; legacy source and grammar still decide detailed semantics.

- The [Epi Info Community Health Assessment Tutorial](https://www.cdc.gov/epiinfo/pdfs/eihat/EIHATFull.pdf)
  provides a two-hour intermediate Check Code lesson covering the Program Editor,
  `IF/THEN/ELSE`, `GOTO`, skip patterns, `ASSIGN`, `YEARS`, and `DIALOG`.
- The [Classic Analysis user-defined commands chapter](https://www.cdc.gov/epiinfo/user-guide/classic-analysis/userdefinedcommands.html)
  documents editing generated commands, saving and opening project-backed or
  external `.pgm7` programs, running selected or complete command blocks, and
  composing programs with `RUNPGM`.
- The [CDC/NIOSH industry and occupation coding tutorial](https://archive.cdc.gov/www_cdc_gov/niosh/topics/coding/epiinfo.html)
  is a concrete Program Editor exercise using `READ`, `DEFINE`, `RECODE`, `FREQ`,
  saved programs, reruns against updated data, and `WRITE` export.
- The [CDC programming and command-reference introduction](https://www.cdc.gov/epiinfo/user-guide/command-reference/introduction.html)
  defines programs as scripts for data-entry guidance, data restructuring, and
  analysis, and distinguishes Form Designer Check Code from Classic Analysis PGM
  execution.
- The historical [CDC/Emory intermediate-to-advanced course notice](https://www.cdc.gov/mmwr/preview/mmwrhtml/mm5804a5.htm)
  records a curriculum spanning advanced Check Code, functions, relational data,
  regression, survival analysis, complex surveys, maps, and reports. Treat this as
  historical scope evidence unless the complete course materials are recovered.

Turn this corpus into three initial end-to-end programming fixtures:

1. **Check Code lesson:** date of birth to calculated age, conditional skip, and
   user dialog. This extends the Phase 4 safe subset; unsupported commands remain
   preserved and non-executable.
2. **Data-management PGM:** `READ -> DEFINE -> RECODE -> FREQ -> WRITE`, adapted
   from the NIOSH exercise with synthetic non-sensitive data and deterministic
   expected output.
3. **Official Sample Statistics PGM:** execute progressively reviewed sections of
   the preserved `Statistics.pgm`, from `READ`/`LIST`/`FREQ` through tables,
   regression, survival, complex samples, graphs, and routed output.

The Program Editor, parser, command dispatcher, dataset state, and output history
belong to the TypeScript application layer. Validated epidemiologic operations are
versioned calls into the Rust kernel. Browser-inapplicable commands such as
unrestricted `EXECUTE`, DLL loading, filesystem paths, or external process launch
must be explicitly blocked or replaced by permissioned browser workflows; they
must never be translated into arbitrary JavaScript execution.

### Migration order

1. Confidence intervals and chi-square p-values. **Candidate implementation
   complete:** Rust/WASM owns Katz risk-ratio, Wald odds-ratio, unpooled Wald
   risk-difference intervals, and one-degree-of-freedom chi-square survival
   probabilities. The V0.2 foodborne fixture and notebook provide initial
   independent evidence; legacy corpus classification and G5 review remain open.
2. Fisher/mid-p exact tails, conditional-MLE odds ratios, and exact confidence
   limits. **Candidate implementation complete:** Rust/WASM owns the exact tails,
   conditional estimate, central Fisher interval, and mid-p interval. CI compares
   Fisher p-values and confidence limits for all 100 legacy-derived tables; the
   foodborne lab independently exercises SciPy's noncentral hypergeometric
   reference. Expanded pathological/performance evidence and G5 review remain.
3. Stratified 2 x 2 and Mantel-Haenszel estimates. **Candidate V0.8 slice
   complete:** Rust/WASM owns adjusted OR/RR, legacy confidence-limit formulas,
   corrected/uncorrected MH tests, fixed-margin Breslow-Day/Tarone OR tests, and
   the legacy Epi Info-labelled Woolf OR/RR homogeneity statistics, and bounded
   product-hypergeometric conditional MLE/Fisher inference. The browser supports
   ordered manual strata. The V0.8 operational-closure slice adds pathological,
   metamorphic, maximum-strata, performance, native/WASM, and cancellable Worker
   evidence. Broader reviewed legacy-output corpora remain open, and G5 is deferred
   to the consolidated review of all candidate outputs.
   **Current-form adapter complete for the next prototype slice:** the familiar
   TABLES panel selects exposure, outcome, and one stratifier from saved records,
   explicitly maps positive values, reports missing exclusions, displays the
   generated command, and feeds auditable tables to the V0.8 kernel. Multiple
   stratifiers, weights, filters, saved PGM execution, and full output parity remain.
4. Frequencies, means, rates, and sample-size calculations. **Candidate V0.9
   frequency slice complete:** the browser selects one current-form variable,
   preserves typed categories and optional missing values, shows familiar `FREQ`
   syntax and cumulative output, and calls Rust/WASM for proportion and audited
   legacy exact-under-300/Wilson-at-least-300 confidence limits. The canonical
   foodborne fixture and JupyterLite notebook supply initial independent evidence.
   Multiple variables, `* EXCEPT`, strata, weights, `OUTTABLE`, filters, saved
   execution, broader corpora, and consolidated G5 review remain open.
   **Candidate V0.10 means slice complete:** one current-form numeric variable
   now produces the familiar descriptive tables using a bounded Rust/WASM value
   buffer and an audited legacy quartile/mode contract. The foodborne Age fixture
   and notebook provide initial independent evidence. Cross-tabs and their t,
   ANOVA, Bartlett, and Kruskal-Wallis output, strata, weights, `OUTTABLE`,
   settings, saved execution, broader corpora, and G5 review remain open for
   ordinary MEANS. **Complex Sample Means V0.1 candidate complete:** `PSUVAR`
   routes to a separate bounded survey engine for weighted domain means,
   PSU-within-stratum Taylor standard errors, legacy design df/t limits, and a
   two-domain contrast. The mechanical foodborne fixture runs in the Program
   Editor and is independently reproduced in the JupyterLite TABLES and Complex
   Samples lab. A documented browser adaptation materializes the visible CSM
   result rows through session `OUTTABLE`/`READ`/`LIST`; the desktop dialog leaves
   Output to Table disabled and defines no working result schema. Meaningful
   survey corpora, persistent output adapters, desktop differential evidence,
   Rust migration, experienced-user review, and G5 remain open.
   **Candidate V0.11 Visual Dashboard Rates slice complete:** a
   distinct old-tree Visual Dashboard launcher now exposes the audited
   aggregate-of / PER / aggregate-of workflow for COUNT equality over a
   non-missing denominator. Rust/WASM owns the fail-closed ratio-times-multiplier
   calculation, while the foodborne 22/96 fixture and notebook provide initial
   independent evidence. Other aggregates, condition builders, distinct counts,
   grouping, sorting, filters, display/export, saved dashboards, broader corpora,
   and G5 review remain open. **V0.16 Visual Dashboard Epi Curve prototype
   complete:** the familiar Charts branch now exposes main-date, optional
   grouping, interval/step, x-axis-bound, and missing-value controls; deterministic
   TypeScript bins feed a browser chart and accessible data table using the
   canonical foodborne records. Weighting, legacy faceting, complete display and
   export properties, saved gadget state, the general canvas, and the other chart
   types remain explicit gaps in `charts-compatibility-inventory.md`.
   **Candidate V0.12 StatCalc Population Survey slice
   complete:** the first legacy StatCalc menu item now preserves the five inputs,
   defaults, simple-random-sampling guidance, seven confidence levels, cluster
   sizes, and total samples. Rust/WASM reproduces the audited normal-tail
   approximation, finite-population correction, and legacy rounding sequence;
   an immutable fixture and JupyterLite notebook provide initial independent
   evidence. Save/Print, broader corpora, the other StatCalc calculators, and G5
   remain open. **Candidate V0.13 StatCalc Cohort or Cross-Sectional slice
   complete:** the second legacy StatCalc menu item now preserves its confidence,
   power, group-ratio, and linked effect-measure workflow plus the three-method
   exposed/unexposed/total table. Rust/WASM reproduces the audited Kelsey, Fleiss,
   and continuity-correction sequence; source-derived fixtures and JupyterLite
   provide initial independent evidence. **Candidate V0.14 StatCalc Unmatched
   Case-Control slice complete:** the third legacy StatCalc menu item preserves
   its confidence, power, controls-to-cases ratio, and linked exposure workflow
   plus the cases/controls/total Kelsey and Fleiss table. A distinct Rust/WASM
   contract reuses the audited mathematical core while retaining independent
   provenance, fixtures, browser coverage, and JupyterLite evidence. Chi Square
   for Trend is the next planned StatCalc branch.
5. Regression, survival, and other advanced analysis modules.

### Required work for every operation

- Complete validation gates G0 through G6, including independent statistical and
  implementation review.
- Define a versioned request/result schema.
- Capture legacy fixtures and independent edge cases before translation.
- Preserve method identity, warnings, undefined states, convergence failures, and
  engine version in the result.
- Test native Rust and browser WASM against the same fixtures and tolerances.
- Run computation in a Worker when dataset size or latency could block the UI.
- Benchmark payload, cold start, execution time, and memory on representative
  lower-powered hardware.
- Keep formatting and plain-language interpretation in TypeScript.

### Exit gate

An operation replaces its JavaScript implementation only after parity, edge-case,
browser, provenance, and performance gates pass. The old path remains available
for comparison during one release and is then removed.

## Phase 5B - Epi Info programming IDE

The gap between the legacy Program Editor/Check Code Editor and a safe modern
browser IDE is the roadmap for this phase. The complete capability floor, stable
gap IDs, new branches, six implementation waves, and closure rules are maintained
in the [programming IDE compatibility inventory](docs/design/programming-ide-compatibility-inventory.md).

**First executable V0.1 slice complete:** Classic Analysis now exposes visible
editable source, Verify Program, Run Commands, trusted canonical output, structured
frequency results, and browser-local history for the ordered
`DEFINE TEXTINPUT -> numeric RECODE -> FREQ [STRATAVAR]` shape. The canonical
foodborne AgeGroup-by-Sex program is covered end to end. An appended `EXECUTE`
command is rejected with a line diagnostic and no output. This does not complete
the familiar workspace, program persistence, general parser, selected execution,
or unified history requirements.

### Delivery order

1. Complete the command/function/event/dialog inventory and executable fixtures.
2. Reproduce the familiar editor shell, project program list, source editing,
   `.pgm7` exchange, find/replace, and open/save paths.
3. Add the versioned parser, typed intermediate representation, command generation,
   language service, and precise unsupported-command diagnostics.
   Natural-language and Visual Epi Info inputs must produce this typed model first;
   only trusted code renders canonical Epi Info source. Never execute arbitrary
   model-authored program text.
4. Execute the first safe PGM slice with bounded `RUNPGM`, dataset/session state,
   Worker cancellation, structured Output, and immutable run provenance.
   Append every operation to one command history, whether it originated in a
   manual dialog, user program, visual flow, reviewed AI plan, or approved plugin.
   For AI origins, retain the exact prompt locally plus model/revision, runtime,
   prompt/tool/context schema versions, generation settings, and approval outcome.
5. Expand through the Check Code course, NIOSH data-management exercise, and
   official Sample `Statistics.pgm` as their underlying operations pass validation.
6. Add the modern branches—program tests, richer language assistance, debugger,
   source history, optional reviewed AI assistance, responsive authoring, and the
   typed **Visual Epi Info** dataflow view defined by `LEGACY-PROGRAM-020`. Flow,
   Program, and Output remain synchronized, and the complete effective source is
   always inspectable in the traditional Program Editor.

### Interpreter modernization workstream

The browser interpreter is a compatibility migration, not a mechanical C# port.
Legacy `.grm`/`.cgt` grammar tables and interpreter rules remain primary evidence,
while the maintained browser boundary becomes explicit and independently testable:

`source -> TypeScript parser -> versioned typed AST -> semantic validator ->
auditable execution plan -> TypeScript services and Rust/WASM epi kernel`.

Manual dialogs, directly edited source, Visual Epi Info, Epi Assist, and approved
plugins must all enter through the same AST/plan boundary. No origin receives a
more permissive executor. In particular, a successfully parsed program is not
automatically executable.

| Component | Required contract | Current state | Next acceptance boundary |
|---|---|---|---|
| Legacy grammar evidence | Trace each supported production and semantic decision to GOLD grammar, rule object, User Guide, or fixture | Analysis grammar/parser architecture audited | Add command-by-command production and ambiguity fixtures |
| Lexer/parser | Deterministic parsing, nested blocks, error recovery, and precise source ranges without evaluation | TypeScript AST V0.4 parses `READ`, `LIST`, `FREQ`, `MEANS`, `TABLES`, `RECODE`, `DEFINE`, `ASSIGN`, `IF`, `SELECT`, and `SORT`; expressions include literals, identifiers, calls, unary/binary operators, and nested `IF` blocks | Expand legacy syntax variants and return multiple recoverable diagnostics |
| Typed AST | Discriminated, versioned nodes with source spans; JSON-safe serialization and migration rules | `classic-ast.ts` defines additive AST `1.0.0`; every statement/expression carries a source span | Publish JSON schema, canonical serializer, comments/trivia policy, and AST compatibility tests |
| Name and type resolution | Resolve fields/variables/scopes case-insensitively; reject missing, ambiguous, or type-invalid references | Bounded full-program and selected-command resolvers validate their allowlisted shapes; DEFINE/ASSIGN resolves Standard scalar type/lifetime separately from data fields | Add a standalone schema-aware semantic pass for every parsed command family |
| Canonical source | Generate stable, reviewable Epi Info source without discarding unsupported text | Existing bounded plan canonicalizes its executable program | Add AST printer and parse-print-parse equivalence fixtures |
| Execution planner | Lower only validated AST into a versioned allowlisted plan with declared capabilities and effects | Existing bounded program plan is the sole executable subset | Define plan nodes for dataset read/filter, variable mutation, recode, frequency, and tables; reject every unregistered node |
| Session/runtime | Explicit dataset, selection, variables, output, limits, cancellation, and rollback; no ambient DOM/OS authority | A cloned READ source, bounded Standard scalar variables, and independent SELECT/SORT state drive selected commands; broader lifetimes, rollback, and full-program sequencing remain open | Introduce serializable session V0.1 and transactional statement boundaries |
| Operation adapters | TypeScript orchestrates data/UI/storage; validated epidemiologic operations dispatch to Rust/WASM contracts | `FREQ` and `TABLES` operations already exist outside the general interpreter | Bind planner nodes to existing typed operations without duplicating statistical formulas |
| Audit/provenance | Record source/AST/plan versions, origin, inputs, project revision, approvals, results, warnings, and engine versions | Browser-local bounded run history exists | Unify manual, program, visual, AI, and plugin histories and add immutable export |
| Compatibility validation | Differential legacy/browser fixtures, metamorphic checks, hostile-input tests, and curriculum programs | Phase 0 covers the nine AST command families, typed selected-command resolution, and fail-closed unsupported input | Promote legacy Sample/training programs progressively; no parity claim without reviewed output comparisons |
| IDE language service | Parse without execution; expose syntax, semantic, and compatibility diagnostics plus completion | CodeMirror live checks the AST; only the existing three-statement shape receives field validation and execution eligibility | Add token-precise multi-diagnostics, hover/signature help, folding, and quick fixes |

#### Tracked implementation sequence

1. Freeze grammar-derived positive, negative, and ambiguity fixtures for the first
   nine commands and expressions used by them.
2. Stabilize AST `0.3`, its JSON schema, source-span rules, canonical printer, and
   parse/serialize/parse tests before broader full-program execution is added.
3. Implement schema-aware name, scope, and type resolution as a pure pass that
   produces diagnostics and an annotated AST without changing project data.
4. Define a capability-labelled execution-plan schema. Planning fails closed when
   any AST node, function, option, data source, or effect lacks a registered lowerer.
5. Add an explicit transactional program session with resource limits, selection
   state, standard/global/permanent variables, cancellation, and rollback.
6. Bind safe plans to existing TypeScript data operations and Rust/WASM statistical
   contracts. Never translate statistical formulas into the parser or UI layer.
7. Append one provenance event for verification, planning, approval, execution,
   rejection, cancellation, and output, regardless of whether the origin is manual,
   textual, visual, AI-assisted, or plugin-provided.
8. Differentially validate each promoted command against legacy Epi Info and the
   curriculum corpus; document adaptations, new branches, and retirements in the
   capability register before expanding execution authority.
9. Only after semantics stabilize, add selected-statement execution, debugger/replay,
   visual round-tripping, and AI drafting over the same AST and plan contracts.

**Current security boundary:** AST V0.4 broadens syntax understanding only.
Full-program execution remains the reviewed `DEFINE TEXTINPUT -> numeric RECODE
-> FREQ [STRATAVAR]` plan. A separate selected-statement allowlist permits
current-project READ, bounded Standard DEFINE/ASSIGN, SELECT/CANCEL SELECT,
SORT/CANCEL SORT, and LIST/FREQ/MEANS/TABLES; external READ fails closed.
Selected TABLES produces a categorical count matrix and never infers exposed or
case meanings; the separate stratified 2 x 2 workflow still stops for explicit
value review. SELECT V0.2 accepts
schema-typed compound expressions, applies cumulatively with legacy AND
semantics, and affects only the Classic session; unreviewed functions still fail
closed pending the complete legacy function/type matrix. ASSIGN accepts only a
type-compatible literal for an explicitly defined Standard session variable and
cannot mutate records; wider expressions and `IF` cannot yet invoke operations. SORT is limited to current-form
fields and changes ordering only; its candidate collation remains under differential review.

**Classic command-surface slice complete:** the browser now restores the shipped
File/View/Tools/Help shell, nine Command Explorer folders, and recognizable
Command Explorer/Program Editor/Output/Message Area frame. Frequencies, Tables,
and Means route to the existing bounded implementations; all other legacy
commands remain explicit gaps. The follow-on slice now restores the exact nested
Program Editor File/Edit/Fonts and toolbar orders plus the Output toolbar. Safe
CodeMirror edit/navigation commands, saved PGM and `.pgm7` lifecycle,
Find/Replace, permission-aware Cut/Copy/Paste, browser printing, bounded
Run/Cancel, Output navigation/Open/Bookmark/Print/Maximize/Clear, History, and
program metadata/delete are active. Opened HTML is sandboxed with a network-
denying content policy, bookmarks remain session-scoped like the desktop
Session History, and TIFF viewing remains an explicit browser adaptation gap.
Remaining command dialogs do not acquire execution authority from this
structural work.

**Legacy docking parity decision:** the default desktop arrangement follows the
manual and `AnalysisMainForm` source: Command Explorer is the left dock, Output
is the upper-right work area, Program Editor is the lower-right dock, and the
Message Area belongs to the Program Editor. Direct browser validation controls
remain available in a collapsed developer disclosure below those four familiar
areas; they are not treated as a legacy UI branch. Narrow screens preserve the
same reading and keyboard order by stacking the Explorer before Output and the
Program Editor instead of inventing a different analysis workflow.

### Exit gate

An experienced user can recognize the Classic Analysis programming workflow,
open or author a program, understand compatibility diagnostics, run a validated
command subset or selection, inspect reproducible Output, save and reopen source,
and execute the three curriculum fixtures supported at that release. Unsupported
source round-trips unchanged and cannot acquire ambient browser or operating-system
capabilities. Visual Epi Info cannot meet this gate unless every flow exposes its
effective code in the traditional editor and reports partial/source-only conversion
without hiding or discarding source.

## Phase 5C - Epi Assist local-AI new branch

V0.1 attaches a new Tools > Epi Assist branch to the familiar tree. IBM Granite
4.0 350M Instruct runs in a dedicated WebGPU Worker after an explicit model-load
action. The model receives field metadata and aggregate quality counts, not record
values, and may propose only host-validated handoffs to Data Quality, Classic
Analysis `FREQ`, and Visual Dashboard Epi Curve. Every action remains visible and
requires user approval; deterministic results continue to come from the existing
application operations and Rust/WASM kernel.

The implementation and remaining distribution, performance, security, privacy,
and governance gates are maintained in the
[Epi Assist new-branch inventory](docs/design/epi-assist-compatibility-inventory.md).
Do not describe local inference as a fully offline deployment until model artifacts
are integrity-pinned and delivered from an approved or packaged source.

### Exit gate

The branch is eligible beyond prototype only after model artifacts and versions
are pinned, supported-device budgets pass, malformed/adversarial output fails
closed, proposal provenance is auditable, privacy/security/accessibility/model
governance reviews approve the path, and Epi Assist can be disabled without
changing any core workflow or result.

Cross-instance learning is a later governance slice, separate from project and
run-history synchronization. It requires explicit user/organization opt-in,
approved minimization and redaction, a preview of transmitted metadata, a
CDC-controlled authenticated intake and quarantine service, retention/deletion
controls, and human promotion into versioned evaluation or fine-tuning corpora.
Raw project history and live synchronized records must never feed training
directly.

## Phase 6 - Plugin platform foundation

The plugin platform is added only after shared TypeScript contracts and the host
component boundaries are stable. It is an extension mechanism, not a shortcut around
the Rust kernel, Row Level Security, validation, or application permissions.

### Initial extension points

- Import and export adapters.
- Additional validation rules and Data Quality checks.
- Analysis operations backed by a reviewed WASM module or a named core-kernel call.
- Dashboard gadgets and declarative result views.
- Map data sources, renderers, and layers.
- Form field types and allowlisted Check Code functions.
- Optional AI tool descriptions that invoke versioned deterministic operations.

### Package and API model

- Define a versioned manifest schema with plugin ID, version, host API range,
  entry point, integrity hash, publisher, contributions, and capabilities.
- Define a typed message/RPC SDK. Plugins never import application internals.
- Render ordinary plugin UI from declarative host components. Isolate unavoidable
  rich UI in a sandboxed frame.
- Run plugin computation in a Worker or WASM sandbox with explicit time, memory,
  cancellation, and output-size limits.
- Deny network, storage, project, record, clipboard, geolocation, and export access
  unless the manifest requests it and policy/user approval grants it.
- Never pass authentication tokens, service secrets, unrestricted database clients,
  or direct host DOM references to a plugin.
- Record plugin ID, version, package hash, capability grants, inputs, outputs, and
  approved changes in provenance and audit events.

### Distribution and lifecycle

- Begin with bundled first-party reference plugins and local test packages.
- Add a CDC-curated or organization-approved catalog only after signing, integrity,
  review, update, rollback, and revocation procedures exist.
- Do not load executable production plugins from arbitrary URLs.
- Cache approved packages for offline use and verify integrity before every activation.
- Disable incompatible, revoked, corrupt, or over-permissioned packages with a clear
  explanation; never attempt best-effort execution across incompatible API versions.
- Keep all core outbreak workflows functional when every plugin is disabled.

### Reference plugins

Use two deliberately bounded reference implementations to prove the API:

1. A synthetic-data import adapter that receives only a user-selected file and
   returns a typed preview without direct project write access.
2. A validation plugin that receives a redacted or selected record view and returns
   structured findings without mutating data.

### Exit gate

Reference plugins install from integrity-checked packages, work offline, render on
phone, tablet, and desktop through host components, and pass capability-denial,
timeout, malformed-output, incompatible-version, revocation, and audit-provenance
tests. With the plugin subsystem disabled, all core workflows still pass.

## Phase 7 - Durable local projects and offline recovery

- [x] Add an optional New Project study-area step that works without a dataset:
  draw or enter a WGS84 bounding box, review approximate dimensions and a
  size-based maximum-zoom recommendation, and preserve the boundary plus the
  initial 100 MiB offline-package policy in the portable project snapshot.
- [x] Add deterministic Web Mercator tile-count and byte estimates, explicit
  provider assumptions, browser quota preflight, and project-limit feedback.
  Treat the ordinary browser HTTP cache as opportunistic rather than evidence of
  offline coverage; keep OpenStreetMap Standard preview-only under its current
  public tile policy.
- [x] Import a reviewed regional `.pmtiles` archive, validate its v3 header and
  section ranges, WGS 84 bounds, planned zoom coverage, data license,
  attribution, size, and SHA-256, then persist it on Apply as a typed
  browser-local OPFS project asset. Remove uncommitted assets when the pending
  study area is removed or New Project is cancelled.
- [x] Decode and render validated raster PNG/JPEG/WebP/AVIF PMTiles assets from
  OPFS, rechecking byte length, SHA-256, header provenance, directory lookup,
  and removing Street before activation. Browser regression asserts that the
  selected raster path makes no tile-server requests.
- [x] Add a self-hosted MapLibre renderer for vector MVT PMTiles. A custom local
  protocol returns only decompressed bytes from the integrity-checked OPFS
  reader; metadata-declared source layers receive a conservative generic style
  beneath existing Leaflet overlays. Missing `vector_layers` metadata fails
  closed rather than guessing.
- [x] Include attached PMTiles bytes in the explicit binary `.epia` backup and
  restore them into a newly integrity-checked OPFS path. Legacy JSON-only V2
  packages still open and explicitly require PMTiles re-import when they carry
  offline-map provenance without bytes. A browser regression removes the
  original archive before restore to prove the backup is self-contained.
- [x] Persist uploaded GeoJSON and GeoTIFF sources plus their layer visibility,
  label, and opacity settings as project map assets; embed their bytes in
  `.epia`/`.epiax`, validate size/type/SHA-256, restore them to digest-addressed
  OPFS paths, and reconstruct their map layers when the project opens.
- [x] Detect a missing, corrupt, or unavailable OPFS package before Maps claims
  readiness; fail to a blank background and offer explicit `.epia` restore,
  digest-matched PMTiles re-import, blank-map continuation, or detachment while
  retaining the study-area plan. Browser regressions delete and corrupt the
  stored file and reject a nonmatching replacement.
- [ ] Expand corrupt directory/tile fixtures and perform network-disabled field
  acceptance, mobile performance, proactive quota-pressure/eviction warning,
  and update/revocation tests.
- [ ] Add the offline basemap package implementation only after provider terms,
  tile-count/byte estimates, quota preflight, cancellation, integrity, expiry,
  attribution, update/recovery behavior, and field-offline tests are reviewed.
- Build a reviewed `.mdb`/`.accdb` to SQLite conversion facility outside the
  browser runtime. Begin from the existing read-only Access inventory converter,
  add an explicit Access-object-to-Epi-SQLite mapping, preserve the original
  input, and emit a versioned migration manifest with source/output hashes,
  warnings, unsupported objects, and converter provenance.
- Validate conversion with schema/object inventories, table/row/column counts,
  type/null/date/GUID/blob handling, keys/indexes/relationships, code tables,
  forms/pages, Check Code source, deleted-state metadata, and referential
  integrity. Never silently omit Access macros/VBA, OLE/attachments, saved
  queries, encryption, or provider-specific values.
- Introduce SQLite WASM in a dedicated Worker with an OPFS strategy selected by
  concurrency and browser-support testing.
- Add schema migrations, storage quota handling, corruption detection, backup,
  explicit export, and restore.
- Define a portable Epi Info AI project package containing versioned schema,
  records, validation rules, metadata, and optional attachments.
- Promote the validated V2 JSON prototype to the final `.epia` container while
  retaining its programs, code tables, migration evidence, and version rejection.
- Add a service worker only after update and recovery behavior is designed.
- Preserve compatibility with existing localStorage demo snapshots during the
  migration window.

### Exit gate

A project survives offline reload, can be exported and restored after browser data
is cleared, and reports actionable storage/update failures without silent loss.
The Access conversion gate additionally requires repeatable `.mdb` and `.accdb`
fixtures, immutable source files, deterministic SQLite output, complete migration
manifests, row/schema reconciliation, and reviewed comparison with the same
projects opened in desktop Epi Info/Access.

## Phase 8 - Hosted synchronization hardening

- Replace the demo OAuth/session handling with a maintained typed client and tested
  token refresh/recovery behavior.
- Keep privileged credentials out of the browser.
- Version the hosted schema and automate safe migrations.
- Test Row Level Security policies for owner isolation and denied anonymous access.
- Add explicit upload/download state, retry behavior, cancellation where practical,
  and actionable conflict messages.
- Retain whole-project snapshot synchronization as single-user until the next phase;
  do not describe it as collaborative merging.

### Exit gate

A signed-in user can refresh, resume, upload, download, and recover from an expired
session or revision conflict without losing the local working copy.

## Phase 9 - Multi-user record synchronization

This phase implements the existing collaboration TODO; it is not part of the
single-user snapshot demo.

- Add project membership, invitations, and explicit roles.
- Normalize forms and records into individually versioned rows.
- Use stable record IDs, per-record revisions, timestamps, authorship, and deletion
  markers.
- Merge changes automatically when users edit different records.
- Present a review workflow when users edit the same record.
- Maintain an audit history suitable for authorized project review.
- Extend Row Level Security tests to every role and operation.

### Exit gate

Two authorized users can enter different records offline/online and synchronize
without overwriting each other. Same-record conflicts are never silently resolved,
and unauthorized users cannot discover or access the project.

## Phase 10 - Secure encrypted project exchange

This is one coordinated compatibility/new-branch backlog item named **Secure
Epi Info Share**. It combines encrypted package handling with consent-gated
browser-to-browser delivery; it does not make collaboration or synchronization
claims.

### V0.1 implementation status

- [x] Restored the familiar Enter Data menu paths and a bounded Package Data for
  Transport dialog with package name/timestamp, optional-field blanking,
  single-condition record selection, password confirmation, and completion
  feedback.
- [x] Added a versioned `.epiax` envelope using Web Crypto
  PBKDF2-HMAC-SHA-256 (600,000 iterations, random 128-bit salt) and AES-256-GCM
  (random 96-bit IV, authenticated header, 128-bit tag), plus plaintext digest,
  length, wrong-password, and tamper validation. PBKDF2 is the dependency-free
  V0.1 browser baseline; reviewed Argon2id remains the target KDF.
- [x] Added manual, serverless WebRTC offer/answer exchange, visible DTLS
  fingerprints, ordered 64 KiB binary chunks, buffered-amount backpressure,
  progress, bounded receive state, SHA-256 verification, and explicit
  passphrase/import review. No nearby discovery, QR, STUN, TURN, or resumability
  is claimed.
- [x] Added a canonical 96-record foodborne browser round-trip that blanks one
  optional field, downloads/imports the encrypted package, transfers it between
  two local peer connections, verifies it, and blocks a blind repeated import.
- [x] Added distinct top-level Save/Open Encrypted Project paths. Save assembles
  the complete validated `.epia` working copy—including all forms and records,
  saved programs, code tables, study-area metadata, audit history, and attached
  PMTiles, GeoJSON, and GeoTIFF assets—before `.epiax` encryption. Open decrypts and validates into a
  non-mutating inventory before explicit project replacement.
- [x] Added an encrypted complete-project runbook that distinguishes this path
  from filtered data-only Package For Transport, guides archive inventory and
  passphrase separation, and hands off to Secure Epi Info Share. A verified
  received ciphertext can be downloaded before File > Open Encrypted Project.

### Remaining work

- Inventory and fixture-test legacy Epi Info `.edp7` package variants, password
  parameters, compression, manifest contents, update/append behavior, and error
  handling. Implement legacy decryption only in an isolated, bounded adapter;
  never write new data using the inspected unauthenticated legacy cipher format.
- Define a versioned encrypted `.epia` envelope with algorithm/KDF identifiers,
  random salt and nonce, reviewed Argon2id parameters appropriate to supported
  browsers, AES-256-GCM authenticated encryption, authenticated non-sensitive
  metadata, and cryptographic agility. Wrong passwords and tampering fail without
  exposing partial plaintext.
- Extend the current Send and Receive workflow for complete encrypted `.epia`
  packages with negotiated message-size limits, cancellation, resumability,
  quota preflight, durable quarantine/OPFS staging, and a direct reviewed-open
  handoff. V0.1 already transfers bounded ciphertext with conservative chunks,
  `bufferedAmount` backpressure and progress, and can save the verified received
  package for the top-level reviewed Open Encrypted Project path.
- Pair through QR/manual offer-answer exchange for serverless field use or an
  approved expiring short-code signaling service. Bind the visible peer
  confirmation to the WebRTC certificate fingerprint; do not claim automatic
  nearby discovery from an ordinary browser.
- Make route policy explicit: direct-only, STUN-assisted, or approved TURN relay.
  Signaling never carries project bytes, and the UI must disclose when a relay
  was used even though WebRTC transport remains encrypted.
- Before acceptance, show sender, project/package label, byte size, format,
  SHA-256, and available quota. After receipt, verify length/digest/envelope,
  retain it in quarantine/staging, and require the existing project preview and
  explicit Open/Import decision. Never automatically execute programs, plugins,
  Check Code, or merge records from received content.
- Record privacy-minimized transfer receipts and test wrong password, corruption,
  truncation, replay, signaling substitution, disconnect/resume policy, buffer
  pressure, cancellation, quota exhaustion, direct/TURN paths, and supported
  desktop/mobile browser pairs.

### Exit gate

A sender and receiver can exchange a bounded encrypted `.epia` package through
an explicitly verified pairing, detect modification or truncation before import,
cancel without leaving accepted partial data, and review the package before any
project state changes. A representative legacy `.edp7` fixture can be read in
compatibility mode, but new exports never use the legacy cryptography.

## Cross-cutting page walkthroughs

V0.3 now supplies a reusable Help > Automated Runbooks library, a foodborne
Program Editor walkthrough, a Secure Epi Info Share walkthrough, and an encrypted
complete-project package walkthrough. The Share
runbook follows the encrypted-package, manual offer/answer, DTLS fingerprint,
transfer-status, passphrase, and non-mutating import-preview workflow without
creating a connection or sending data on the user's behalf. Runbooks point to
actual controls, provide Back/Next/Finish/Stop, advance after expected user
actions, and never silently load source, execute analysis, transfer a package,
or import records. Automated browser coverage fails when semantic targets
disappear.

After the core migration phases are complete, extend this foundation to every
user-facing page while leaving project and partially entered form state unchanged.

The shared walkthrough contract must cover keyboard and touch operation, focus
return, screen-reader announcements, reduced motion, phone/tablet/desktop
placement, content versioning, and automated detection of missing or stale target
controls. Approved plugin pages may contribute declarative walkthrough steps
through the host API; plugins do not receive unrestricted DOM access. Implement
the shared host instead of duplicating page-specific tour code.

## Cross-cutting test matrix

| Concern | Required coverage |
|---|---|
| TypeScript | Unit tests, strict type-check, invalid external-data tests |
| Rust/WASM | Native tests, WASM parity fixtures, numerical edge cases, provenance |
| Browser workflows | Main menu, forms, entry, CSV, maps, analysis, storage, and sync smoke tests |
| Responsive UI | Representative phone, tablet, and desktop widths; touch and keyboard input |
| Accessibility | Semantic names, focus order, status announcements, contrast, zoom, and reduced motion |
| Storage | Reload, quota/error, migration, export, restore, and corruption/recovery paths |
| Security | RLS allow/deny tests, OAuth redirects, session expiry, secret scanning, dependency review |
| Plugins | Manifest/schema validation, capability denial, sandbox escape resistance, timeout/cancellation, integrity, revocation, API compatibility, and provenance |
| Compatibility | Existing local snapshots, representative legacy forms, Unicode/CSV edge cases |
| Walkthroughs (deferred) | Every page registered, all targets present/visible, keyboard/touch navigation, focus return, responsive placement, reduced motion, no project-state mutation |

## Pull-request slicing

- Prefer changes that can be reviewed independently and reverted without data
  migration.
- Keep generated artifacts separate from source changes.
- Do not mix a numerical algorithm port, a UI redesign, and a storage-schema change
  in one pull request.
- Use temporary compatibility adapters instead of flag-day rewrites.
- Record schema and contract changes in migration notes with forward and rollback
  behavior.
- Require experienced-user review when familiar controls move or change names.

## Release and rollback rules

1. Deploy migration work to the demo before making it the only path.
2. Preserve the last known-good Pages artifact and database migration information.
3. Feature-flag high-risk storage, synchronization, and kernel replacements while
   both paths need comparison.
4. Never roll back a database schema by deleting user data; use forward fixes or
   compatible readers.
5. If a browser update cannot read an existing local project, block the migration
   and offer export/recovery rather than initializing an empty project.
6. A plugin can be disabled or revoked independently without rolling back the host
   application or making a project unreadable.
7. Treat any loss of an implemented legacy-floor capability or learned navigation
   path as a blocking regression, not an acceptable migration tradeoff.

## Definition of done for a migrated module

A module is migrated only when:

- its maintained feature code is TypeScript or Rust according to the language
  boundary;
- user-visible behavior and familiar terminology are documented;
- phone, tablet, and desktop behavior is intentional;
- keyboard, touch, and screen-reader status paths are covered;
- external data is validated at its boundary;
- unit and relevant browser/parity tests pass in CI;
- storage and serialized contract compatibility are addressed;
- failure, recovery, security, and audit behavior are documented;
- GitLab Pages builds from a clean checkout; and
- architecture and migration documentation reflect the delivered state.

A plugin is complete only when its manifest and requested capabilities are reviewed,
its package integrity and publisher are verifiable, denial and failure behavior are
tested, its UI uses host accessibility/responsive behavior, and its outputs carry
provenance.

## Immediate next slice

The **saved PGM lifecycle** is now a tested candidate: project program list,
guarded New/Open/Save/Save As/Delete, Author/Comments/Created/Updated metadata,
explicit 1 MB text-only `.pgm7` import/export, dirty-state disclosure,
browser-safe find/find-next/replace all, and source-only browser printing share
one typed program-document service. Deletion retains the editor source, and
unsupported source remains visible without broader execution authority. A
separate Page Setup command stays disclosed because its settings live inside
the browser print dialog. Typed Read, List, Frequencies, Means, and Tables
builders now insert visible source. Exactly one selected READ, LIST, FREQ, MEANS,
or categorical TABLES command may execute; binary TABLES classification remains
an explicit reviewed step in the separate stratified 2 x 2 workflow,
and every unsupported or multi-statement selection fails closed. READ is
restricted to named forms in the current project; LIST provides bounded browser
line-list Output and subsequent FREQ/MEANS use the same explicit session. Typed
DEFINE and numeric RECODE dialogs now expose the legacy scope/type and editable
range-grid workflow, generate visible source, and can author the complete bounded
foodborne program with FREQ. Broader displayed DEFINE/RECODE forms remain
source-only unless a reviewed plan permits them. SELECT/CANCEL SELECT now has a
typed source dialog, audited cumulative compound-expression filtering, explicit
counts, history, and LIST/FREQ/MEANS integration. Its V0.2 evaluator covers
boolean/comparison/arithmetic operators, missing `(.)`, wildcard LIKE, Standard
variables, and a reviewed initial function set; the remaining function/date/
collation matrix stays open. SORT/CANCEL SORT now independently
applies or clears stable, typed, multi-field ordering without changing selection
membership. Selected DEFINE/ASSIGN now adds bounded Standard scalar state, resets
it on READ, and rejects field mutation and general expressions. The next
command-runtime candidate is bounded IF control flow; Supabase
program/extras sync needs a separate versioned contract and conflict policy.

Phase 5 V0.15 restores Chi Square for Trend as the fourth learned StatCalc menu
branch. It preserves the legacy editable score/case/control table, Add Row action,
reference-row odds ratios, Extended Mantel-Haenszel statistic, and p value behind
`epi.chiSquareTrend`, with a bounded Rust buffer, immutable fixture, browser test,
method contract, and JupyterLite comparison. G5 remains intentionally batched for
one consolidated statistical and implementation review across candidate outputs.

The next release activity is a focused **demo-readiness gate**, not another broad
algorithm slice. It must verify the launcher-to-workflow rehearsal path, sticky
familiar module tree, type-aware validation dialogs, successful adjusted-results
Worker startup/recovery, seeded foodborne/Toledo/WorldPop examples, GeoTIFF upload,
responsive desktop/tablet/phone behavior, visible failures, README links, clean CI,
and Pages publication. This is a release-hardening step and does not claim that
open parity gaps are closed.

**Phase 5B IDE V0.1 is now underway.** The recognizable Program Editor shell,
project program list, visible editable source, open/save and `.pgm7` exchange,
find/replace, diagnostics, and a bounded first command execution path with
structured Output and provenance are implemented candidates. The typed
Visual Epi Info box-and-connection view begins against the same intermediate
representation; effective source remains visible beside it from the start. Thus
the IDE starts after the demo-readiness pass, before returning to the remaining
Poisson, Population Binomial, and Matched Pair StatCalc branches.

Phase 5B now also has a bounded CodeMirror 6 Command Assist prototype. It keeps
the traditional source visible and executable only through the existing typed
parser, while offering current-form, type-filtered variables after `RECODE` and
context-aware suggestions for `TO`, `FREQ`, and `STRATAVAR`. This is registered
as a new branch: it extends the legacy command-dialog guidance and does not claim
that the desktop IDE provided modern inline IntelliSense parity.

The same new branch now adds visible line numbers, `Ln/Col` cursor status, and
browser-local 2/4/8-column plus tabs/spaces preferences under the familiar View
menu. A debounced live check calls the typed parser and, for the executable shape,
the bounded field validator; it marks the affected line and reports validity
without executing source. The audited desktop `RichTextBox`
accepted tabs and copied indentation but exposed no line-number gutter, column
ruler, or explicit tab-width setting.

The interpreter-modernization slice now has typed AST `1.0.0` and a source-span
parser that includes LIST and SORT among the initial command families. The existing bounded
executor is lowered from this AST, while every broader parsed program remains
syntax-only. A separately allowlisted selected-command path now resolves
current-project READ/RELATE active data, explicit WRITE REPLACE Text downloads, reviewed current-project MERGE, DELETE TABLES, recoverable DELETE/UNDELETE RECORDS mutations, named SUMMARIZE session tables, Standard DEFINE/ASSIGN/UNDEFINE scalar state, named
DEFINE GROUPVAR session groups with bounded LIST expansion, bounded DISPLAY
DBVARIABLES Output, SELECT/SORT session
effects, bounded Standard-variable IF/ELSE branching, and active-session
LIST/FREQ/MEANS/TABLES and session `SET MISSING=OFF/ON`, while external READ targets fail closed. TABLES V0.11
renders all observed exposure/outcome categories unstratified or by one or more strata fields; reports counts,
row/column percentages, totals, expected counts, Pearson chi-square/df/probability,
and sparse-cell warnings; and reports missing exclusions. When an observed table
is exactly 2 × 2, it preserves the legacy automatic Single Table Analysis,
visibly states the category orientation, and sends the four cells to the
validated Rust/WebAssembly kernel for OR, RR, RD, chi-square, mid-p, Fisher, and
confidence-limit results. Its JupyterLite notebooks independently reconstruct
the checksummed foodborne results. `STATISTICS=FISHER` now performs bounded
general R × C fixed-margin enumeration; `STATISTICS=NONE` suppresses inference;
and `ONEISYES` applies numeric affirmative-first orientation. `OUTTABLE`
materializes the inspected long-form cell table in session for a later `READ`.
For expanded exposures it preserves the inspected desktop last-wins replacement
order. Browser persistence remains open. Record-context IF,
compound expressions, functions, nested/arbitrary blocks, and missing-value
comparisons remain outside that allowlist. The next interpreter slice is the
standalone schema-aware semantic resolver and diagnostic model, followed by
canonical printing and the capability-labelled execution planner tracked above.

Classic commands now form a separate tested parity set. The registry contains
all 49 entries from the nine legacy enum groups, while preserving the 45-command
shipped Command Explorer tree and the enum-only status of Match, Map, Reports,
and Help. Each command tracks discovery, syntax, dialog generation, semantics,
selected execution, full-program execution, Output, browser adaptation, and
validation independently. A visible or successfully parsed command is therefore
never counted as execution parity.

The registry's overall parity status is evidence-gated. `browser-verified`
requires a real `.pgm` tied to the checksummed foodborne dataset plus a
machine-asserted expected-output artifact. `legacy-parity-verified` additionally
requires captured and reviewed output from desktop Epi Info for that same
program. The bounded READ, IF, UNDEFINE, DISPLAY, DEFINE GROUPVAR, RELATE, WRITE, MERGE, DELETE TABLES, DELETE RECORDS, UNDELETE RECORDS, LIST, FREQ, MEANS, TABLES, and SUMMARIZE fixtures use this
rule; none is yet a desktop parity claim.

Sequential `.pgm7` execution now builds a current-run Output document in source
order. Every statement receives a numbered status and audit summary; each
output-producing statement also retains a read-only snapshot before a later
command can reuse its live panel. This closes the misleading behavior where
multiple successful FREQ, LIST, or TABLES statements looked skipped because
only the last result remained visible. Persistent/exportable output documents
and exact desktop navigation semantics remain open.

The legacy grammar also contains thematic `MAP` forms (`AVG`, `CASE_BASED`,
`SUM`, `COUNT`, `MIN`, and `MAX`), but the inspected desktop Command Explorer
reports Map as unimplemented and its interpreter cases do not execute. Epi Info
AI therefore records `MAP` as a revival/new-branch target: retain the familiar
spelling and reconcile its intended semantics with typed, auditable map-layer
plans. GeoJSON, H3, GeoTIFF, offline packages, and future spatial-analysis
syntax remain separately labeled modern branches rather than retroactive legacy
parity claims.

**Ordinary TABLES browser candidate complete at V0.11:** the tested floor now
includes unstratified and Cartesian-strata categorical M×N counts, percentages,
totals, expected counts, Pearson statistics, sparse-cell warnings, missing-value
settings, finite non-negative frequency weights, automatic Rust/WASM 2 × 2 and
stratified adjusted output, GROUPVAR/wildcard exposure expansion, bounded general
R × C Fisher–Freeman–Halton enumeration, `STATISTICS=NONE`, numeric `ONEISYES`,
the inspected `NOWRAP`/`COLUMNSIZE` no-op behavior, and session `OUTTABLE` with
desktop-compatible final-expanded-exposure replacement. The command tour and
standalone foodborne `.pgm` fixtures exercise these paths. The inspected grammar
retains one outcome per command, so multiple outcome fields are not presented as
a parity requirement. `MATCH` is a distinct command. `PSUVAR` switches to the
separate Complex Sample Tables statistics engine under Advanced Statistics.
Its bounded V0.2 candidate now ports the inspected
PSU-within-design-stratum Taylor variance, legacy t limits and design effects,
plus survey OR/RR/RD for complete 2 × 2 tables. The mechanical foodborne
fixture and visible command tour exercise the branch; they do not claim that
Household Neighborhood and Age form a defensible survey design. The inspected
complex `OUTTABLE` result schema now materializes session-locally for subsequent
`READ`/`LIST`; external persistence, meaningful survey corpora, desktop differential review, and Rust
migration remain open. Persistent/external
output-table adapters, desktop differential evidence, experienced-user review,
Rust `epi-lang` migration, and consolidated G5 remain gates on a formal legacy
parity claim rather than unimplemented ordinary TABLES syntax.

**Complex Sample Frequencies V0.1 browser candidate:** `FREQ ... PSUVAR`
now follows its separate legacy Advanced Statistics path. The typed host accepts
one analysis field, optional design stratum and numeric weight, a required PSU,
and optional session `OUTTABLE`; it reports weighted proportions, Taylor standard
errors, linear/logit limits, design df, and the inspected repeated design effect.
The foodborne command tour, exact fixture, READ/LIST round trip, and independent
JupyterLite Python cell establish browser evidence only. Desktop differential
capture, meaningful survey designs, Rust migration, experienced-user review, and
G5 remain open.

Browser-constrained legacy commands use a common adaptation contract: retain
their learned names, syntax, and menu placement; replace ambient desktop
authority with a capability explicitly granted by the user; validate and
preview before mutation; keep an auditable command/result record; fail closed
when the requested adapter is unavailable; and provide a portable fallback.
WRITE is the first reference: REPLACE Text produces a CSV download, while the
planned APPEND adapter will choose an existing file, validate and preview the
combined schema/data, require confirmation, write through a granted handle on
supporting browsers, and fall back to upload/merge/download elsewhere. MERGE and
the current-project DELETE TABLES subset now follow this rule. External DELETE
FILE/TABLE, ROUTEOUT, RUNPGM, and related commands remain adapter work.

The shared adapter should expose a virtual **Project Files** workspace backed by
origin-private browser storage as the portable baseline. Legacy commands can
then use coherent file-like create/read/append/replace/delete semantics without
receiving operating-system paths. A separately labelled **Link local file or
folder** capability may retain a user-granted File System Access handle where
the browser supports it. A future managed Tauri/Electron shell may implement the
same adapter interface with reviewed desktop policy; it must not broaden the
web deployment's authority or change command semantics invisibly.

The Program Editor also exposes three reviewed runnable examples over the
foodborne form: life-stage age groups by Sex, broad age bands by Case Status, and
an overall decade distribution. The versioned catalog resides beside, identifies,
and checksums the foodborne dataset rather than acting as a global language catalog.
Each derived variable declares its display prompt explicitly in source, for
example `DEFINE AgeGroup TEXTINPUT "Age group"`. Program Output preserves that
prompt through the typed plan, derived-field metadata, title, and column heading.
When the prompt is omitted, Output uses the exact variable identifier and does
not invent a human-readable label.
Selection loads ordinary editable source; examples receive no execution privilege
beyond the same AST, field checks, and bounded plan used for user-authored source.
The form now persists dataset ID, source filename, and original-import SHA-256.
The editor does not fetch or display this catalog until a form with matching
provenance and records is current, and it checks every required field name and
data type before enabling an individual program. Record edits do not change the
original provenance digest or detach otherwise compatible examples.
