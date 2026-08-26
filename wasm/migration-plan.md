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
- [ ] Migrate Maps, the application controller, forms/data entry, and the engine
  adapter in the order below.

### Module order

1. **Contracts and utilities:** project, form, field, record, map, storage, sync,
   validation, and engine result types.
2. **Supabase synchronization:** type public configuration, sessions, snapshots,
   revisions, and API responses; keep Row Level Security as the authorization
   boundary.
3. **Maps:** type data sources, coordinate selection, layers, popups, and browser
   geolocation results.
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

### 3B. Enter Data

- Show one clear record-entry task on phones.
- Keep field prompts and entry order identical across viewports.
- Move the line list into a reachable secondary view rather than placing a wide
  table below an excessively long form.
- Preserve desktop side-by-side density where space allows.
- Make save state, validation errors, and synchronization state visible near the
  action that caused them.

### 3C. Project storage and main menu

- Reflow storage/authentication dialogs without hiding status messages below the
  viewport.
- Keep Create Forms, Enter Data, Classic, Visual Dashboard, Create Maps, StatCalc,
  and their familiar grouping on all sizes.

### Exit gate

The main menu, project storage, and Enter Data pass keyboard and touch checks at
representative phone, tablet, and desktop widths. Experienced users can identify
and complete the same workflow without relearning module names or task order.

## Phase 4 - Form Designer and data-quality validation

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

Apply the same rules during manual entry, CSV import, hosted download, and project
restore. Validation results must identify the form, record, field, rule, severity,
and suggested resolution.

### Data Quality workspace

- Missing-value review.
- Range and legal-value violations.
- Frequency-based duplicate candidates.
- Side-by-side record review before any merge or deletion.
- Recoverable deletion and an audit event; do not reproduce an unguarded permanent
  delete command in the browser UI.

### Exit gate

The manual's core Data Quality Check workflow is represented by tested validation
rules and a familiar review flow. Imported and manually entered records are checked
consistently, and destructive actions are auditable and recoverable.

## Phase 5 - Rust epidemiology kernel expansion

The Rust kernel owns deterministic epidemiologic computation, not DOM, storage,
authentication, formatting, or AI interpretation.

### Migration order

1. Confidence intervals and chi-square p-values.
2. Fisher exact and other exact methods.
3. Stratified 2 x 2 and Mantel-Haenszel estimates.
4. Frequencies, means, rates, and sample-size calculations.
5. Regression, survival, and other advanced analysis modules.

### Required work for every operation

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

- Introduce SQLite WASM in a dedicated Worker with an OPFS strategy selected by
  concurrency and browser-support testing.
- Add schema migrations, storage quota handling, corruption detection, backup,
  explicit export, and restore.
- Define a portable Epi Info AI project package containing versioned schema,
  records, validation rules, metadata, and optional attachments.
- Add a service worker only after update and recovery behavior is designed.
- Preserve compatibility with existing localStorage demo snapshots during the
  migration window.

### Exit gate

A project survives offline reload, can be exported and restored after browser data
is cleared, and reports actionable storage/update failures without silent loss.

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

Phases 0 and 1 are closed. Begin Phase 2 without changing user-visible behavior:

1. Convert Maps to TypeScript before adding more mapping features.
2. Convert the application controller.
3. Split forms and data entry into schema, designer, entry, CSV, persistence, and
   project-state modules before converting them.

This keeps the safety net ahead of the feature migration and prevents additional
JavaScript migration debt.
