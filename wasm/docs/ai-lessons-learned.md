# AI enablement lessons learned

This is a living engineering record for Epi Info AI. It captures observed model
behavior, architectural consequences, validation requirements, and open work. It
does not treat a successful demonstration as evidence of clinical, statistical,
privacy, security, or production readiness.

## Durable principles

1. **The model proposes; the application validates and executes.** Granite output
   is untrusted input. It cannot call the Rust/WASM kernel, mutate project data,
   access credentials, or execute Epi Info, JavaScript, operating-system, or plugin
   code directly.
2. **Questions map to a typed analysis plan before they map to code.** The safe
   path is `question -> versioned typed plan -> canonical Epi Info command ->
   allowlisted operation -> structured output`.
3. **Canonical Epi Info source remains visible.** A trusted renderer produces the
   familiar command from the validated plan. This supports immediate review,
   reproducible tests, the traditional IDE, and the future Visual Epi Info view.
4. **AI is optional around the old tree.** Removing or disabling Epi Assist must
   not change manual workflows or deterministic results.
5. **Audit history and learning telemetry are different systems.** Project run
   history is authoritative local provenance. It is not silently uploaded or used
   as a direct training source.
6. **AI runs need exact provenance.** Record the user prompt locally together
   with model ID/revision, dtype/device, runtime version, system-prompt version and
   text, tool-schema version, context-schema version, and generation settings.

## Observations and decisions

### 2026-08-28 — Native tool calls are preferable to free-form JSON

- **Observation:** unconstrained text generation could end with incomplete JSON,
  especially with a small local model and bounded token budget.
- **Decision:** use Granite's native tool-aware chat template with independently
  delimited tool calls. Parse each complete call separately, retain earlier valid
  calls when a later call is truncated, and reject malformed or unknown calls.
- **Test consequence:** cover incomplete trailing calls, unknown tools, invented
  fields, wrong field types, invalid arguments, and the case where no valid call
  remains.

### 2026-08-28 — A tool schema determines what the model can express

- **Observation:** “Run by age by sex distribution” produced only Frequency of
  Age. The original `run_frequency` tool accepted one field and had no legal way
  to express stratification.
- **Decision:** extend the typed action with an optional, distinct `stratifyBy`
  field and map it to the legacy command `FREQ age STRATAVAR=sex`.
- **Lesson:** first inspect the tool and intermediate-representation vocabulary
  before changing prompts or replacing the model. A larger model cannot emit a
  capability that the host contract does not provide.
- **Test consequence:** assert the native call, typed plan, canonical command,
  selector handoff, within-stratum output, and fixed foodborne Age-by-Sex results.

### 2026-08-28 — Canonical source is audit output, not model authority

- **Observation:** mapping a natural-language question to Epi Info programming is
  useful because experienced users can recognize and inspect the result.
- **Decision:** trusted TypeScript generates canonical source from the typed plan.
  Free-form model-authored source is never an execution input.
- **Test consequence:** plan-to-source rendering must be deterministic and
  round-trip against the future parser. Unsupported clauses fail closed.

### 2026-08-28 — One execution path needs one history

- **Observation:** manual dialogs, user programs, visual flows, AI-assisted plans,
  and plugins can invoke the same operation.
- **Decision:** record one append-only command/run history with canonical command,
  typed-plan schema, origin, approval state, project/dataset revision, engine and
  application versions, timestamps, status, diagnostics, and immutable output
  provenance. Origin must remain visible without changing calculation semantics.
- **Open work:** implement the Phase 5B run-history contract and Output/History UI.

### 2026-08-28 — Training materials provide representative program fixtures

- **Observation:** legacy source describes the capability floor, while CDC
  tutorials show the command sequences and terminology users were actually taught.
- **Decision:** maintain a provenance-tracked curriculum registry for Check Code,
  Classic Analysis, NIOSH recoding, command-reference, and Sample-program examples.
  Promote them progressively through transcription, parsing, execution, legacy
  comparison, and review.
- **Caution:** instructional priority does not override detailed semantics found
  in the grammar, dialogs, and legacy implementation.

### 2026-08-28 — Local inference is not the same as offline distribution

- **Observation:** Granite runs in a browser Worker through WebGPU, but first use
  retrieves large model artifacts from the configured host before browser caching.
- **Decision:** describe this accurately as local inference. Do not claim a fully
  offline deployment until artifacts are approved, integrity-pinned, packaged or
  self-hosted, and tested under the supported cache/offline policy.
- **Test consequence:** measure cold/warm load, download size, memory, latency,
  cancellation, device compatibility, and failure behavior.

### 2026-08-28 — Minimize context before inference

- **Observation:** current proposals need form metadata and aggregate quality
  counts, not individual record values.
- **Decision:** send only project/form labels, field metadata, record counts,
  missingness aggregates, and validation-issue counts to the Worker. Keep record
  values, storage credentials, and ambient application authority unavailable.
- **Open work:** formal privacy review and adversarial tests are required before
  non-synthetic or production use.

### 2026-08-28 — Cross-instance learning requires a separate governed pipeline

- **Observation:** accepted, edited, and rejected plans could improve evaluation
  and future fine-tuning, but raw run histories can contain sensitive field names,
  filters, prompts, output values, or operational context.
- **Decision:** do not train directly from local history, Supabase project storage,
  or another live synchronization repository. Any future learning event must be
  explicitly enabled, minimized/redacted, previewable, authenticated, quarantined
  in a CDC-controlled service, retention-controlled, and promoted by human privacy
  and model-governance review into a versioned corpus.
- **Test consequence:** verify opt-out by default, no-network behavior, redaction,
  consent, deletion/retention, tenant separation, provenance, and corpus promotion.

### 2026-08-28 — Small-model quality should be improved in the right order

- **Observation:** the 350M model can produce useful bounded proposals, but its
  output is sensitive to tool vocabulary and generation limits.
- **Decision:** improve typed tools, schemas, examples, field grounding, parsing,
  and deterministic fallbacks before increasing model size. Evaluate a larger
  model only against the same frozen prompt/tool corpus and device budgets.
- **Measure:** plan validity, correct operation and field selection, unnecessary
  actions, abstention quality, latency, memory, download size, and user edits—not
  conversational fluency alone.

### 2026-08-28 — Prompt and model provenance must travel together

- **Observation:** a proposal cannot be reproduced or compared if the recorded
  history says only “Granite” or retains only the user's question.
- **Decision:** V0.1 exposes local AI run details containing model
  `onnx-community/granite-4.0-350m-ONNX-web`, its requested revision, WebGPU/fp16,
  Transformers.js version, exact system and user prompts, prompt/tool/context
  schema versions, and deterministic generation settings.
- **Caution:** the current model revision is `main`, which is mutable and therefore
  insufficient for a production provenance claim. Pin an approved immutable model
  revision and artifact hashes before production or formal evaluation.
- **Privacy:** exact user prompts remain local by default. A future learning event
  may include only an approved, previewed and redacted derivative.

### 2026-08-28 — Typed plans can safely bridge source and tools

- **Observation:** the CDC-taught age-range workflow needs multiple commands:
  `DEFINE`, `RECODE`, and `FREQ`, not a larger single Frequency tool.
- **Decision:** the first Program Editor parser accepts only that bounded ordered
  shape, resolves fields and types, generates trusted canonical source, and sends
  only the final frequency operation to the existing validated engine.
- **Safety result:** appending `EXECUTE "malware.exe"` produces a line-numbered
  rejection before any operation runs. The source is never evaluated as code.
- **AI implication:** future Granite multi-step proposals should target this same
  typed plan. They do not need or receive a general program-execution tool.

## Required evaluation layers

- **Contract tests:** every model action is known, typed, field-grounded, bounded,
  and independently validated.
- **Plan fixtures:** representative questions map to an expected typed plan or a
  deliberate abstention, including paraphrases and adversarial prompts.
- **Provenance fixtures:** prompt text/version, model ID/revision, runtime, tool
  schema, context schema, and generation settings are complete and internally
  consistent.
- **Source fixtures:** typed plans render deterministic canonical Epi Info source.
- **Operation fixtures:** the same plan invokes the same validated TypeScript and
  Rust/WASM operation as the manual workflow.
- **Browser tests:** proposals never auto-run; review controls, status, errors,
  cancellation, keyboard use, and responsive layouts remain usable.
- **Safety/privacy tests:** prompt injection, invented commands and fields,
  oversized input/output, data-exfiltration requests, credential access, network
  boundaries, and disabled-AI behavior fail closed.
- **Experienced-user review:** users recognize the proposed command and can reach
  the familiar manual workflow without relying on AI.

## Next experiments

1. Implement the unified run-history contract before collecting any learning
   signals.
2. Create a frozen question-to-plan evaluation set from the programming curriculum
   registry and canonical foodborne example.
3. Record accepted, edited, rejected, and abstained outcomes locally without
   transmitting them.
4. Compare prompt/tool-schema revisions—and later model sizes—against the same
   corpus and device budgets.
5. Define governance requirements and a threat model before designing any central
   learning-event endpoint.

### 2026-09-03 — Ground small-model distribution requests before generation

- **Evaluation prompt:** `Show age distribution by sex` with IBM Granite 4.0
  350M Instruct (`onnx-community/granite-4.0-350m-ONNX-web`, revision `main`).
- **Expected reviewed action:** `run_frequency(field_name="age",
  stratify_by="sex")`, rendered by the host as `FREQ age STRATAVAR=sex`.
- **Observed prior failure mode:** the small model could retain `age` while
  dropping the `by sex` stratification argument.
- **Decision:** version the prompt and tool schema, resolve only the narrow
  `X distribution by Y` request shape against actual field names/prompts, and
  constrain the Granite tool schema to those grounded enum values. Both arguments
  become required for this request. This grounding creates no executable code and
  grants no authority; the returned call must still pass the host allowlist and
  wait for explicit user approval.
- **Ambiguity case:** `Show gender distribution by status` must not silently map
  `gender` to `sex` or `status` to `case_status`. V0.1 resolves it to no trusted
  deterministic intent. The general Granite path can still suggest real fields,
  so a clarification gate remains open work: it may present `sex` and
  `case_status` as candidates, but must not enable execution until the user
  confirms both mappings.
- **1B comparison:** the UI can rerun the same frozen questions with Granite 4.0
  1B Instruct (`onnx-community/granite-4.0-1b-ONNX-web`, `q4`, approximately
  1.78 GB). Selecting it terminates any loaded 350M Worker first. Compare tool,
  field and abstention accuracy as well as download size, load/generation latency,
  GPU memory and failure behavior; do not treat model size alone as improvement.

### 2026-09-03 — Managed-browser execution fallback

- **Observed environment:** a managed Edge browser exposed the WebGPU API but
  could not obtain a GPU adapter. Enabling an unsafe browser flag is not an
  acceptable deployment requirement.
- **Decision:** retain explicit WebGPU options, but make Granite 4.0 350M q4 on
  CPU/WebAssembly (approximately 576 MB) the compatibility default. Record the
  actual execution device and dtype with every model result.
- **Implementation lesson:** resolve the Worker URL from `document.baseURI`.
  Resolving from `import.meta.url` broke after bundling the caller into `/chunks`,
  leaving the UI at “Starting” before any download callback could run.

### 2026-09-03 — One reviewed action boundary across foundation models

- **Decision:** retain local IBM Granite as the offline/default model path and
  expose OpenAI (ChatGPT-model) and Anthropic (Claude-model) examples only
  through an administrator-configured, same-origin Epi Assist gateway.
- **Secret boundary:** provider credentials belong to the gateway. They are not
  accepted by, embedded in, or persisted by the browser application.
- **Data boundary:** the cloud request contains the prompt and the existing
  minimized field/schema and aggregate-quality context, never record values.
- **Normalization:** each provider adapter returns native tool calls using the
  shared Epi Assist contract. The browser does not execute vendor-authored code
  or trust vendor prose; it independently validates tools, fields, types, and
  argument bounds.
- **Audit:** store the provider, exact resolved model/revision, opaque gateway
  request ID, and prompt/tool schema versions with the proposal. A friendly
  label such as “ChatGPT” or “Claude” is insufficient provenance.
- **Deployment result:** static GitLab/GitHub Pages can demonstrate the choices
  and preserve local Granite, but cloud inference requires a separately deployed
  approved gateway. Failure or absence of that service leaves core Epi Info
  workflows available and enables no cloud-authored action.
