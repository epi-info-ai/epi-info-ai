Yes. In fact, I would now put **browser + WASM ahead of a conventional desktop rewrite**.

But I would make one important distinction:

> **Epi Info's deterministic epidemiology engine runs in WASM.
> The AI agent sits above it and calls the engine as tools.**

The LLM should never be the thing calculating an odds ratio or deciding how Mantel-Haenszel adjustment works.

### The architecture I would pursue

```text
┌──────────────────────────────────────────────────────────┐
│                     EPI INFO NEXT                        │
│                       Browser                            │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                PWA / Web UI                        │  │
│  │                                                    │  │
│  │ Forms │ Data │ Analyze │ Visualize │ Maps │ AI    │  │
│  └───────────────────────┬────────────────────────────┘  │
│                          │                               │
│                 ┌────────▼────────┐                      │
│                 │   AI AGENT      │                      │
│                 │                 │                      │
│                 │ intent          │                      │
│                 │ planning        │                      │
│                 │ explanation     │                      │
│                 │ tool selection  │                      │
│                 └────────┬────────┘                      │
│                          │ tool calls                    │
│        ┌─────────────────┼──────────────────┐            │
│        ▼                 ▼                  ▼            │
│  ┌──────────┐      ┌────────────┐     ┌───────────┐     │
│  │Epi Core  │      │ Form/Check │     │ Chart/Map │     │
│  │  WASM    │      │   Engine   │     │  Engine   │     │
│  └────┬─────┘      └──────┬─────┘     └─────┬─────┘     │
│       └───────────────────┼─────────────────┘            │
│                           ▼                              │
│                  SQLite WASM / OPFS                      │
│                  local project data                     │
│                                                          │
│       ┌─────────────────────────────────────────┐        │
│       │ OPTIONAL LOCAL AI                       │        │
│       │ WebGPU + quantized local model          │        │
│       │       OR                                │        │
│       │ optional remote model endpoint          │        │
│       └─────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────┘
```

This is technically quite realistic now.

WebAssembly itself has approximately **96% global browser support**, so the epidemiologic application isn't dependent on exotic browser capabilities. ([Can I use...][1]) SQLite maintains an official browser WASM distribution, including persistent database storage through the browser's Origin Private File System (OPFS). OPFS-backed SQLite works in modern Chromium, Firefox, and Safari implementations. ([SQLite][2])

So your epidemiologist could literally visit:

```text
epiinfo.org
```

and after the first load:

```text
Internet disappears
       ↓
Epi Info continues working
       ↓
forms work
data entry works
analysis works
SQLite works
AI can work locally if downloaded
```

That is extremely attractive for low-resource environments.

---

## And the AI agent is where this becomes much more than an Epi Info port

Imagine opening a line list and typing:

> I am investigating acute watery diarrhea in this district.
> Show me whether drinking from Well 3 is associated with illness.

The agent shouldn't answer from the LLM.

Instead it translates that into something like:

```text
inspect_dataset()

identify:
  outcome = acute_watery_diarrhea
  exposure = water_source == "Well 3"

run_2x2(
    exposure = "Well 3",
    outcome = "illness"
)

return:
    exposed_cases
    exposed_non_cases
    unexposed_cases
    unexposed_non_cases
    risk_ratio
    odds_ratio
    confidence_intervals
    fisher_exact
```

The **WASM epidemiology engine** produces the numbers.

Then the agent explains:

> People who reported drinking from Well 3 had 3.8 times the risk of illness compared with people who did not (RR 3.8, 95% CI …).

That distinction is crucial.

### LLM

Understands epidemiologist.

### Epi engine

Does epidemiology.

That is a much safer architecture than handing the dataset to an LLM and asking it to calculate statistics.

---

# The agent could expose a surprisingly small tool vocabulary

For example:

```text
dataset.describe
dataset.variables
dataset.filter
dataset.recode

epi.frequency
epi.crosstab
epi.means
epi.rate
epi.risk_ratio
epi.odds_ratio
epi.stratify
epi.mantel_haenszel
epi.logistic_regression
epi.survival
epi.sample_size

outbreak.epidemic_curve
outbreak.attack_rate
outbreak.case_definition

form.create
form.add_field
form.add_validation
form.skip_logic

chart.histogram
chart.bar
chart.epicurve

map.points
map.choropleth

project.import
project.export
```

The agent simply generates structured calls:

```json
{
  "tool": "epi.stratify",
  "arguments": {
    "outcome": "ill",
    "exposure": "ate_chicken",
    "strata": "age_group"
  }
}
```

That architecture is also easy to audit.

Every AI interaction can produce:

```text
User question
     ↓
Agent plan
     ↓
Tools called
     ↓
Variables used
     ↓
Exact statistical results
     ↓
Interpretation
```

For public-health work, that provenance is enormously important.

---

# Local AI in the browser is now realistic too

This part has changed considerably.

WebLLM currently runs LLM inference completely inside a browser using **WebGPU**, supports structured JSON generation, streaming, and an OpenAI-compatible API. ([GitHub][3]) Hugging Face's Transformers.js similarly supports browser-side model execution using WASM on CPU and WebGPU acceleration when available, including quantized models. ([Hugging Face][4])

So you could have:

```text
AgentProvider
   │
   ├── LocalBrowserModel
   │       WebGPU
   │       no network
   │       data stays local
   │
   ├── OrganizationModel
   │       ministry / CDC / university endpoint
   │
   └── CommercialModel
           optional
```

The application itself doesn't care which one is underneath.

That is the architecture I would want.

---

## But I would make AI completely optional

This is particularly important for Epi Info's audience.

WebGPU support has improved greatly but is still not universal—current browser-usage data puts broad WebGPU support at roughly **85%**, with meaningful browser/platform differences. ([Can I use...][5])

And there's a larger problem:

**RAM and model download size.**

A district surveillance laptop might have:

```text
4 GB RAM
integrated GPU
slow connection
older Chromium
```

You don't want the application saying:

> Download this 4.7 GB language model before you can calculate an odds ratio.

So:

```text
             Epi Info
                 │
           works everywhere
                 │
        ┌────────┴────────┐
        │                 │
       AI                no AI
        │                 │
     optional          full app
        │
   ┌────┴─────┐
   │          │
 Local      Remote
 model      model
```

**AI enhances Epi Info. AI never becomes a runtime dependency.**

---

# There is also an interesting migration path from the existing C#

This is where WASM gets particularly interesting.

Microsoft's current .NET toolchain can compile .NET code directly to browser WebAssembly using AOT compilation. Microsoft specifically notes that AOT can substantially improve performance for CPU-intensive workloads, although it increases download size. ([Microsoft Learn][6])

So I would first investigate whether portions of the existing Epi Info statistical code are sufficiently isolated from the Windows-specific UI.

Potential migration:

```text
Epi Info C# repository
         │
         ├── WinForms/WPF/etc.
         │        ↓
         │      discard
         │
         └── pure statistical C#
                  ↓
             extract library
                  ↓
            .NET WebAssembly
                  ↓
             browser tests
```

That could give you a functioning reference implementation surprisingly quickly.

Then you have two options.

### Short/medium term

Keep `EpiInfo.Core` in C# → .NET WASM.

### Long term

Only if there is a compelling reason, migrate the computational kernel to something like Rust:

```text
epi-core
   Rust
    ↓
   WASM
    ↓
JS / TypeScript API
```

I would **not rewrite into Rust just because Rust+WASM is fashionable**. If twenty years of validated epidemiologic code can be separated cleanly from the Windows dependencies, retaining it initially carries considerable value.

---

# SQLite WASM is almost tailor-made for this

One project could literally be:

```text
outbreak.epi
```

internally containing:

```text
project.json
survey.sqlite
forms.json
checkcode.json
analysis.json
attachments/
audit/
```

During use:

```text
SQLite WASM
      ↓
OPFS
      ↓
browser-local persistent database
```

SQLite's official WASM implementation specifically supports OPFS persistence and provides several VFS implementations depending on performance/concurrency requirements. ([SQLite][7])

I'd still give users an explicit:

**Save Project / Export Project**

mechanism.

Browser storage should be treated as the working store, not the sole backup, because clearing site data should never destroy someone's outbreak investigation.

---

# Now imagine the form-building experience

This might be one of the killer applications for the agent.

Epidemiologist:

> Create a case investigation form for suspected measles. I need demographics, vaccination history, symptom onset, rash onset, travel, exposure history and specimen collection.

Agent:

```text
I'll create:

CASE INFORMATION
- Case ID
- District
- Village

DEMOGRAPHICS
- Date of birth
- Sex

CLINICAL
- Fever
- Fever onset
- Rash
- Rash onset
...

VACCINATION
...

LABORATORY
...
```

Then it calls:

```text
form.create(...)
form.add_field(...)
form.add_validation(...)
form.add_skip_logic(...)
```

The user sees a working form immediately.

Then:

> If vaccinated is no, hide number of doses.

Agent edits the check logic.

That is essentially **natural-language programming for field epidemiology**.

And it maps remarkably well onto what Epi Info already does.

---

# Another compelling use case: teach while analyzing

The agent shouldn't merely spit out an answer.

Suppose a field epidemiologist asks:

> Should I calculate an odds ratio or risk ratio here?

The AI has access to the actual dataset structure and workflow.

It might respond:

> This appears to be a retrospective cohort investigation because your line list includes exposed and unexposed members of a defined population and illness status for each. A risk ratio is therefore directly estimable. I'll calculate both, but use the risk ratio as the primary measure of association.

Then:

```text
[Calculate risk ratio]
```

And the WASM engine performs it.

That could make Epi Info both:

**an epidemiology application**

and

**an embedded field-epidemiology tutor.**

For FETP programs and similar training settings, that could be extremely valuable.

---

# I would also give the agent epidemiologic “skills”

Not one giant system prompt.

Something closer to:

```text
/skills
    outbreak-investigation
    case-control
    cohort
    surveillance
    sample-size
    questionnaire-design
    data-cleaning
    regression
    mapping
    report-writing
```

For example:

```text
outbreak-investigation
    1 verify diagnosis
    2 establish existence
    3 define cases
    4 descriptive epi
       person
       place
       time
    5 hypotheses
    6 analytic epidemiology
    7 control measures
    8 communicate
```

The agent could recognize where the epidemiologist is in an investigation and suggest appropriate next analyses.

But again:

> **Agent proposes.
> Deterministic tools calculate.
> Epidemiologist decides.**

That should be an architectural principle.

---

# There is one more substantial advantage: deployment disappears

A conventional application entails:

```text
MSI
admin permissions
Windows version
.NET version
patching
endpoint security
installation
updates
```

A PWA/WASM version becomes:

```text
open URL
```

Then optionally:

```text
Install Epi Info
```

and it behaves much like a desktop app.

The same application runs on:

```text
Windows
Mac
Linux
Chromebook
Android tablet
potentially iPad
```

Microsoft itself supports standalone Blazor WebAssembly deployments from static web servers; the application, dependencies, and .NET runtime execute client-side in the browser. ([Microsoft Learn][8])

And for places without reliable internet, you can ship the PWA assets and model through:

```text
USB
local ministry server
hospital LAN
field Wi-Fi appliance
```

The origin server could be incredibly boring.

No server-side epidemiology application is necessary.

---

## So my target would actually be something like this

**Epi Info Next**

```text
Browser-first
Open source
Offline-first
Local-first
WASM epidemiology kernel
SQLite local data
PWA installability
Legacy Epi Info import
Optional synchronization
Optional local AI
Optional cloud AI
Auditable agent tool calls
No AI dependency
```

And I think the AI changes the modernization calculus considerably.

Without AI, we would mostly be asking:

> How do we faithfully reproduce Epi Info 7 in modern technology?

With an agent, the more interesting question becomes:

> **What would Epi Info have become if every field epidemiologist had an experienced epidemiologic analyst sitting next to them?**

That is a product worth building—not merely maintaining.

The next thing I would do is **inspect the actual Epi Info GitHub source specifically for WASM feasibility**: identify which C# assemblies are pure computational code, what the database abstractions look like, where Windows APIs leak into the core, and whether we could get the first statistical function executing in browser WASM without rewriting it. That would tell us very quickly whether a browser-first successor can bootstrap from the existing codebase or whether the core needs extraction/reimplementation.

[1]: https://caniuse.com/wasm?utm_source=chatgpt.com "WebAssembly | Can I use... Support tables for HTML5, CSS3, etc"
[2]: https://sqlite.org/wasm/doc/92e1d3dab4/persistence.md?utm_source=chatgpt.com "Persistent Storage Options"
[3]: https://github.com/mlc-ai/web-llm?utm_source=chatgpt.com "GitHub - mlc-ai/web-llm: High-performance In-browser LLM Inference Engine · GitHub"
[4]: https://huggingface.co/docs/transformers.js/en/index?utm_source=chatgpt.com "Transformers.js · Hugging Face"
[5]: https://caniuse.com/webgpu?utm_source=chatgpt.com "WebGPU | Can I use... Support tables for HTML5, CSS3, etc"
[6]: https://learn.microsoft.com/th-th/aspnet/core/blazor/webassembly-build-tools-and-aot?view=aspnetcore-10.0&utm_source=chatgpt.com "ASP.NET Core Blazor WebAssembly build tools and ahead-of-time (AOT) compilation | Microsoft Learn"
[7]: https://sqlite.org/wasm/doc/tip/persistence.md?utm_source=chatgpt.com "Persistent Storage Options"
[8]: https://learn.microsoft.com/en-us/aspnet/core/blazor/host-and-deploy/webassembly/?view=aspnetcore-10.0&utm_source=chatgpt.com "Host and deploy ASP.NET Core Blazor WebAssembly | Microsoft Learn"
