# Epi Assist new-branch inventory

## Placement in the familiar tree

Epi Assist is an explicit **new branch** under the existing Tools menu. It does
not rename or replace Create Forms, Enter Data, Classic Analysis, Visual
Dashboard, Maps, StatCalc, or the future Programming IDE. Its first actions hand
the user back to Data Quality, `FREQ`, and Epi Curve using those existing screens.

## V0.1 model and privacy boundary

- Provider: selectable IBM Granite 4.0 350M Instruct for CPU/WebAssembly
  compatibility (`q4`, approximately 576 MB), 350M WebGPU (`fp16`, approximately
  709 MB), or Granite 4.0 1B WebGPU (`q4`, approximately 1.78 GB), using browser
  ONNX models through Transformers.js. Changing the selection terminates the
  current Worker so multiple models are not retained in execution memory.
- Inference: inside a dedicated browser Worker. No prompt, schema, aggregate, or
  record is submitted to an inference API.
- First use: model loading is user initiated and retrieves the selected model
  files from the configured model host. Browser caching is enabled;
  a network-independent/offline claim requires a later self-hosted and packaged
  model distribution review.
- Context: field name, prompt, type, record count, missing counts/percentages, and
  validation-issue counts only. V0.1 does not give record values to the model.
- Output: Granite receives OpenAI-style function definitions through its native
  tool-aware chat template and emits independently delimited `<tool_call>` blocks.
  TypeScript constructs the proposal only from complete calls that pass the action,
  field, and field-type allowlist. Unknown tools, invented fields, incorrect date
  types, malformed arguments, and incomplete calls are discarded independently,
  allowing an earlier valid call to survive a truncated later call. If none pass,
  the UI may offer deterministic schema-derived actions labeled as a safe fallback;
  it never repairs or executes malformed model text. A question is mapped to a
  versioned typed action first. The host may render familiar Epi Info source from
  that action for inspection, but model-authored source is never an execution input.
- Authority: proposals never run automatically. The user selects a reviewed
  action, and the host opens an existing workflow. Granite cannot execute code,
  alter records, call the Rust kernel directly, access storage credentials, or
  make network requests through a host tool.
- Provenance: every model result exposes its exact local user and system prompts,
  prompt/tool/context schema versions, model ID/revision, execution device and dtype, runtime
  version, and generation settings. User prompts remain local by default. The
  prototype's mutable `main` model revision must be replaced by an approved pinned
  revision and artifact hashes before production claims.

The model choice follows IBM's [Granite 4.0 model documentation](https://www.ibm.com/granite/docs/models/granite4-0)
and [official Granite WebGPU demonstration](https://huggingface.co/spaces/ibm-granite/Granite-4.0-WebGPU).
Granite's model license does not by itself approve model hosting, model output,
clinical use, or use with production public-health data; those remain governance
gates.

## V0.1 actions

| Stable gap | Parent branch | Bounded behavior | State |
|---|---|---|---|
| LEGACY-AI-001 | Tools | Visible Epi Assist entry, local-model disclosure, explicit load, status and failure feedback | Prototype |
| LEGACY-AI-002 | Enter Data > Data Quality | Focus a named field in the existing completeness report | Prototype |
| LEGACY-AI-003 | Classic Analysis > FREQ | Select a real current-form field and optional different single `STRATAVAR`, show the canonical command, and run the existing deterministic frequency operation | Prototype |
| LEGACY-AI-004 | Visual Dashboard > Epi Curve | Select a typed date field and optional real grouping field, then run the existing chart operation | Prototype |
| LEGACY-AI-005 | Cross-cutting security | Aggregate-only context, strict proposal parser, action allowlist, user approval and fail-closed errors | Prototype |
| LEGACY-AI-006 | Model distribution | Approved CDC-hosted model artifacts, integrity/version pinning, cache/offline policy, device budgets and fallback | Open |

The **Preview without AI** button is a deterministic demonstration of the same
reviewed-action handoff. It is labeled as not using Granite and makes no AI claim.

## Question-to-program boundary

The intended path is `question -> validated typed analysis plan -> canonical Epi
Info source -> validated host operation -> output`. The source view preserves the
learned programming workflow and later synchronizes with the traditional and
visual IDEs. It is not a general-purpose execution channel: free-form model text,
unknown commands, invented fields, and unsupported clauses fail closed before
the host operation can be selected.

## Closure evidence still required

1. Pin model, tokenizer, ONNX files, dependency graph, hashes, and model card in a
   reviewed supply-chain manifest; do not rely on a mutable third-party model ID.
2. Select an approved CDC model host and content-security policy, or package an
   offline model install, before claiming local-only deployment rather than
   local-only inference.
3. Measure download, cold/warm startup, memory, generation latency, thermal/battery
   impact, and failure behavior on supported desktop and mobile devices.
4. Create prompt-injection, invalid-output, invented-field, denial-of-service,
   privacy, accessibility, and cancellation test suites.
5. Add model provenance to every proposal and audit approved actions without
   recording sensitive prompt content by default.
6. Obtain security, privacy, accessibility, model-governance, experienced-user,
   and public-health review before using non-synthetic or production data.
