# Repository instructions for coding agents

## CDC endpoint-security constraint

This repository is developed on a CDC-managed Windows device. Locally generated,
unsigned Windows executables can be flagged by endpoint security even when they
are ordinary Cargo test binaries.

- Do not run native Rust build or test commands locally on Windows, including
  `cargo build`, `cargo test`, or `cargo run`, unless the user explicitly asks.
- Do not execute binaries from `wasm/engine-rust/target`.
- Prefer Rust-to-WebAssembly checks that do not produce Windows executables. When
  a native executable would still be generated, use the GitLab CI runners for
  build and test validation instead.
- TypeScript and browser checks may be run locally as long as they do not invoke
  a native Cargo build as a side effect.
- Treat all `target` contents as disposable generated artifacts. If an accidental
  native build creates `.exe` files, stop, tell the user, and remove only the
  verified `wasm/engine-rust/target` directory after obtaining approval.
- Never commit Cargo `target` artifacts or generated `.exe` files.

## Local JavaScript runtime

`node.exe` is not always added to `PATH` on this managed workstation. Before
concluding that Node.js is unavailable, inspect the command line of the running
preview server:

```powershell
Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq "node.exe" } |
  Select-Object ExecutablePath, CommandLine
```

The current project runtime is Node.js 24.19.0 at
`C:\Users\cke1\AppData\Local\Temp\epi-info-ai-node-v24.19.0\node-v24.19.0-win-x64\node.exe`.
This is a machine-local temporary path and may change after cleanup or upgrade;
rediscover it with the command above rather than treating it as a repository
dependency. Run repository scripts directly when package-manager shims are not
available, for example:

```powershell
& "<node-path>" wasm/scripts/build.mjs
& "<node-path>" wasm/tests/phase0-smoke.mjs
& "<node-path>" wasm/tests/build-smoke.mjs
```

## Contributor briefing

Epi Info AI is a browser-first, offline-first modernization of CDC Epi Info. It
preserves familiar epidemiology workflows while adding governed browser-era and
AI-assisted capabilities. This is a working prototype, but compatibility and
scientific claims must remain precise and evidence-based.

### Non-negotiable distinctions

- **Legacy parity** requires reviewed Epi Info source/manual evidence, fixtures,
  and ultimately experienced-user or desktop differential evidence. Parsing a
  command or producing plausible output is not parity.
- **Adapted behavior** preserves user intent under browser constraints such as
  explicit file grants, downloads, OPFS, Workers, and permission-gated services.
  Label the adaptation.
- **New branch** is a deliberate Epi Info AI addition and must remain visibly
  separate from the legacy parity floor. Use the `EPIAI` namespace for new
  programming-language commands where applicable.
- **Classic Analysis** is the historical module name; it does not imply that
  every visible command has reached parity.
- Core collection and analysis must work without AI. Epi Assist may propose
  reviewed typed plans/tool calls, but must not execute arbitrary generated Epi
  Info source, JavaScript, shell commands, or transmit record-level data.

Do not invent a replacement workflow merely because it is easier in a browser.
Recover the legacy mental model first. Put intentional innovation on a labeled
new branch.

### Authoritative project records

- `README.md`: current capabilities, deployments, and ordered TODO.
- `COMMAND_SET.md`: concise Classic Analysis command dashboard.
- `wasm/app/programming/classic-command-parity.ts`: machine-readable command
  inventory.
- `wasm/docs/design/classic-command-compatibility-registry.md`: command syntax,
  dialog, execution, output, and evidence gaps.
- `wasm/docs/design/legacy-capability-register.md`: compatibility floor and
  decision/change log.
- `wasm/docs/design/menu-compatibility-registry.md`: menu structure/function
  parity.
- `wasm/docs/design/form-designer-compatibility-inventory.md`: Form Designer and
  Check Code floor.
- `wasm/docs/review/geospatial_mapping.md` and
  `wasm/docs/design/epi-gis-kernel-v0.1.md`: GIS evidence and kernel roadmap.
- `wasm/docs/validation/algorithm-validation-standard.md`: scientific evidence
  and release gates.
- `wasm/demo/examples/`: dataset-bound teaching/evaluation projects.
- `wasm/validation-lab/content/`: independent JupyterLite validation notebooks.

The optional legacy source submodule is
`wasm/source/Epi-Info-Community-Edition`, pinned to a reviewed commit. Ordinary
builds do not require its large checkout. Use it for audits; do not edit it as
current application source.

### Architecture boundaries

- `wasm/demo/`: browser UI and integration shell.
- `wasm/app/contracts/`: validated durable project/data/result contracts.
- `wasm/app/programming/`: typed Classic Analysis language and history.
- `wasm/app/check-code/`: separate event-driven Form Designer Check Code parser
  and bounded runtime. Do not merge it into Classic Analysis.
- `wasm/engine-rust/`: deterministic epidemiology kernel compiled to WASM.
- `wasm/validation-lab/`: independent validation oracles, not production code.

Prefer typed parse → validate → plan → execute → result/receipt pipelines. UI
code may render and orchestrate them but must not become the hidden statistical
or language authority. Fail closed on unknown commands, fields, types, options,
unsafe effects, or incomplete source. Never use `eval`, `Function`, generated
JavaScript, ambient filesystem access, arbitrary DLL/network execution, or an
unconstrained `EXECUTE` path.

Rust/WASM is the destination for mature deterministic analytical kernels.
TypeScript may host bounded candidates, parsers, UI contracts, orchestration,
and spikes, but record the migration/evidence status honestly.

### Porting or extending commands

For a legacy command:

1. Recover source/manual behavior and record it in the compatibility registry.
2. Add typed AST/parser support; preserve unsupported source and reject partial
   execution.
3. Add the familiar source dialog and Program Editor route where applicable.
4. Execute a bounded typed operation, using a cancellable Worker for non-trivial
   computation.
5. Produce visible auditable Output and common command history.
6. Add a dataset-specific `.pgm`/`.pgm7` and asserted expected output.
7. Add an independent validation notebook for statistical work.
8. Update `COMMAND_SET.md`, machine inventory, compatibility register, README,
   and demo/runbook documentation.
9. Keep status at Candidate until the recorded legacy differential and
   experienced-user gates are complete.

Examples are part of the evidence harness, not decorative files. Offer programs
only when their compatible dataset/project is loaded. Assume every command will
eventually run against many projects, not only the foodborne dataset.

### Data, privacy, and security

- Treat public-health records, precise coordinates, learner profiles, and local
  project artifacts as sensitive.
- Keep record values local unless an explicit reviewed workflow says otherwise.
  AI context should use field definitions and aggregate summaries by default.
- Never commit tokens, credentials, restricted source workbooks, downloads, or
  decrypted/generated project packages.
- Ignored secrets live under `wasm/.secrets/`. Read only the named secret needed
  for an active operation, never print it or put it in a remote URL, and remove
  it from process variables promptly.
- `.epia` is the portable project archive; authenticated encrypted packages use
  `.epiax`. Preserve supported data, programs, runbooks, audit history,
  study-area metadata, and map assets with integrity checks.
- Mutating/destructive workflows require preview, explicit Apply, recoverability
  where possible, and audit history. Opening a project must clear stale output
  belonging to the previous project.
- OPFS is browser-private storage, not ambient desktop filesystem access.

### Scientific and UI evidence

Every numerical method needs independently derived expected results, missing and
edge cases, resource limits, method identity, and provenance. Never validate an
algorithm solely against itself or claim equivalence to desktop Epi Info,
SaTScan, or another product without documented differential evidence.

Hard-core Epi Info users and field epidemiology trainees are primary audiences.
Expose assumptions, exclusions, parameters, method/version identity, Worker
timing where useful, and validation status. Avoid black boxes.

- Preserve familiar menus, ordering, dialog intent, Program Editor, Output,
  command history, and keyboard behavior. Disclose gaps rather than repurposing
  a familiar control silently.
- Menus/dialogs must work with keyboard, enlarged text, narrow viewports, and
  Chromium/Firefox/WebKit. Playwright WebKit is the Safari-engine CI floor; real
  Safari/macOS remains a final acceptance check.
- Keep one menu open, return focus on Escape, and avoid clipped popups/no-ops.
- Keep geographic coordinates signed and at least five decimal places where
  point precision matters. Manual/offline collection must remain available when
  geocoding is unavailable.
- Bump the `?v=` cache-buster in `wasm/demo/index.html` when publishing changed
  CSS or JS, and update `wasm/tests/build-smoke.mjs` with it.

### Standard validation and preview

The pinned toolchain is Node.js 24.19.0 plus pnpm. Standard gates are:

```powershell
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run test:build
pnpm run test:browser
```

`pnpm run check` performs typecheck, baseline tests, build, and artifact smoke
tests. Run focused Playwright specs during development. CI supplies the complete
Chromium/Firefox/WebKit matrix when browser binaries are unavailable locally.
Do not weaken tests to make a candidate pass.

The preview command is `pnpm run preview`. Port 8765 is the established manual
demo port when requested. Serve the rebuilt `wasm/dist` artifact so the local
demo matches what CI publishes.

### Git collaboration and CPPR

- Inspect `git status` before editing. Dirty/untracked work belongs to the user
  or another collaborator; preserve it and stage deliberately.
- Every contributor must use an individually attributable GitLab/GitHub account,
  MFA, and their own least-privilege, repository-scoped credentials. Never share
  a PAT or copy another developer's `.secrets` directory. Prefer short-lived or
  fine-grained tokens and revoke them when access ends.
- Store local credentials only in the ignored `wasm/.secrets/` directory or an
  organization-approved credential manager. CI publishing credentials belong in
  protected/masked CI variables, not local files, source, project archives,
  examples, issue text, screenshots, or logs.
- Keep commits coherent. Never rewrite published history, force-push, hard
  reset, or discard another contributor's work.
- `origin` is authoritative CDC GitLab; `github` is the public replica; the
  default branch is `main`.
- Contributors with CDC GitLab access branch from current GitLab `main` and
  propose changes through a GitLab merge request. Do not push directly to
  protected `main`. The merge request must pass applicable CI, receive human
  review, and disclose parity
  status, validation evidence, privacy/security effects, changed documentation
  or examples, and known gaps. Resolve conflicts and rerun CI before merging;
  prefer a focused squash merge unless preserving separate commits is useful.
- Contributors are responsible for local checks and an honest evidence report,
  not for privileged CI or deployment actions. Eligible branch/MR pipelines
  should start automatically. If policy requires a protected/manual job the
  contributor cannot start, mark it **maintainer CI required**; a maintainer
  triggers/approves it and owns the resulting gate.
- External contributors without CDC GitLab access may open a GitHub pull request
  as a proposal. A maintainer imports the commit(s) into a GitLab branch while
  preserving authorship, opens the authoritative merge request, and runs the
  protected CI/review path. Do not independently merge GitHub `main` while
  GitLab is authoritative.
- In this project, **CPPR** means **commit, push to CDC GitLab, publish and verify
  GitLab Pages, replicate the same commit to GitHub, and verify GitHub Pages**.
  A successful push alone is not completion.
- GitLab CI validates Rust, browser code, production build, JupyterLite,
  Playwright, and Pages. GitHub Actions independently rebuilds/tests/deploys the
  public mirror.
- Report the commit SHA and both deployment results/links. If either host is
  blocked, state exactly which CPPR stages completed and remain pending.
- Published links and the visible application version must remain aligned.
- CPPR is performed only by a designated maintainer/release manager after merge.
  Contributors do not need production credentials or permission to trigger
  protected release jobs, publish Pages, or update the public mirror.

External collaboration may eventually justify reversing repository roles. That
is a governed migration, not dual-primary operation: declare a cutover date and
exact commit, briefly freeze merges, reconcile branches, rotate CI credentials,
change protections/default links, validate both deployments, then synchronize
one-way from authoritative GitHub to the CDC GitLab mirror. Until that recorded
cutover occurs, the GitLab-first rules above remain in force.

Before committing, run `git diff --check` and inspect staged files. After
pushing, monitor the actual CI and Pages deployment through completion. Never
expose secret values in commands, logs, remotes, screenshots, or responses.

### Current near-term direction

Use the README TODO as the ordered live backlog. At this checkpoint:

1. Cross-browser menu/navigation has a Chromium-tested candidate; Firefox and
   WebKit CI are the remaining evidence gate.
2. Check Code has a bounded typed Form/Page/Record/Field event-runtime candidate;
   broader grammar, multi-page/form navigation, exact desktop timing, editor
   enhancements, other engines, and field-user review remain open.
3. Continue command parity and evidence, followed by measured JupyterGIS/
   `epi-gis` integration. Do not replace current MapLibre/project/OPFS contracts
   with an unmeasured framework adoption.

Update this section when priorities materially change rather than allowing it to
become a second stale backlog.
