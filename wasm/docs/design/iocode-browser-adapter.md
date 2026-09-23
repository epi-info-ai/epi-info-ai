# IOCODE browser adapter assessment

Status: **future TODO—deferred for deeper investigation**; typed migration boundary retained, execution deliberately unavailable for now
Reviewed: 2026-09-22

Reference package pilot: authoritative
[CDC GitLab package-occupational-epidemiology](https://git.cdc.gov/epi-info-ai/package-occupational-epidemiology),
with the public
[GitHub mirror](https://github.com/epi-info-ai/iocode-occupational-epidemiology).
Its initial release is synthetic and approved only for exercising package
import/integrity boundaries; scientific execution remains disabled.

## Recovered desktop behavior

The retained Check Code form is:

```text
IOCODE Industry, Occupation, ICode, OCode, ITitle, OTitle, Scheme
```

All seven arguments are Text fields. The first two contain user-entered
industry and occupation descriptions. Desktop Epi Info passes those values to
`NIOSH.IOCode.IOCoder`, opens a review dialog with up to ten candidate industry
and occupation matches, and preselects a first candidate only when its
probability is at least 0.80. Accepting the dialog writes the possibly edited
descriptions, selected codes, standardized titles, and model coding scheme to
the seven fields. Cancelling does not assign a result.

The reviewed legacy checkout contains an unsigned 26,624-byte .NET assembly
and a 46,194,210-byte `NIOSH.IOCoder.C12.190829.bin` model. Neither artifact is
a browser module, and the retained repository does not establish a license or
validation contract for republishing the model as part of Epi Info AI. The
standard-variable fallback in `Rule_IOCode` also passes the industry expression
for both input strings; this apparent source anomaly requires desktop
differential evidence rather than silent reproduction.

## Current browser boundary

Epi Info AI recognizes IOCODE as a typed seven-field Check Code statement and
validates that every argument exists and is a Text field. Verification then
fails with a specific unavailable-capability diagnostic. The Phase 1
Capability Packages UI can now preview and install the synthetic reference
package after immutable-revision length/SHA-256 verification. Installation
updates the diagnostic to distinguish installed/integrity-checked assets from
pending scientific approval; it does not enable Apply. The runtime also
fails closed if invoked without verification. It never fabricates occupational
codes, loads the legacy DLL, reads the binary model, calls a network service, or
partially changes form values.

This is grammar and migration preservation, not an executable candidate or a
parity claim.

## Package boundary

The occupational coder should not become a permanently embedded core service.
Core Epi Info AI owns the stable IOCODE grammar, seven-field typed request,
permission and capability checks, atomic-result contract, and value-free audit
receipt. A separately governed **Occupational Epidemiology** package should own
the NIOSH-compatible model or service adapter, coding-taxonomy assets, candidate
review UI, model-version policy, validation corpus, and occupational-health
documentation.

This keeps ordinary data collection and analysis small and offline-capable
without silently distributing a large specialist model. Installing the package
must be an explicit, manifest-verified action. Uninstalling or disabling it must
leave IOCODE source readable and editable, while verification returns the
actionable unavailable-package diagnostic instead of treating the statement as
unknown source. The package may register only the narrow typed
`io.coder.review/0.1` capability; it must not gain arbitrary Check Code, file,
network, or form mutation authority.

## Shelving decision

Here, **shelved means deferred to a future TODO when sufficient time is
available for a dedicated technical, scientific, privacy, and governance
investigation**. It does not mean rejected, abandoned, or permanently excluded.

No IOCODE model or service adapter will be implemented in the current Check
Code parity batch. A future browser implementation needs separate occupational-health
governance: authorized training/validation data, taxonomy and model provenance,
qualified reviewer acceptance, privacy review, and an approved deployment mode.
NIOSH NIOCCS is a candidate service boundary only after that process; it is not
used as an undisclosed training-label source. A future offline compact model is
also a package concern, not a core Check Code shortcut.

## Future provider architecture notes

These notes are retained as future design input, not as approval to reactivate
IOCODE. They were compared with the official
[NIOCCS Web API documentation](https://wwwn.cdc.gov/NIOCCS/default.html) and
[NIOSH coding guidance](https://www.cdc.gov/niosh/occupation-industry-data/about-data/coding/index.html)
on 2026-09-22.

### Stable language boundary

`IOCODE` should continue to express the epidemiologic operation rather than a
URL, model, or vendor. The existing typed AST already retains the seven legacy
field references. A future executable package should resolve that statement to
the narrow `io.coder.review/0.1` capability and an asynchronous provider:

```text
IOCODE AST -> capability gate -> IOCode provider -> ranked review -> atomic assignment
                                  |            |
                                  |            +-- future approved offline Worker/WASM/ONNX model
                                  +--------------- optional approved NIOCCS service adapter
```

The normalized provider result should retain codes as strings so leading zeros
and punctuation survive (for example Census `0310` and SOC `29-1141`). It should
carry ranked industry and occupation candidates, titles, probabilities,
classification scheme/version, provider/model identity, and an unexpected-code-
combination indicator when supplied. HTTP response shapes must remain inside
the provider adapter rather than leaking into the language AST.

The Check Code runtime is already asynchronous: statements, dialogs, geocoding,
and host effects are awaited in source order. IOCODE therefore does not require
a second interpreter or a synchronous compatibility shim. A future adapter must
support cancellation, timeout, project-switch invalidation, and continuation
only after the review dialog resolves.

Options such as candidate count, scheme, or version are not part of the
recovered seven-argument grammar. If eventually exposed in source, they require
a separately versioned, legacy-reviewed grammar extension or an explicitly
labeled `EPIAI` new branch; provider defaults must not silently redefine saved
legacy source.

### Candidate NIOCCS online adapter

The official API is free, needs no account, returns JSON by default, and supports
only HTTP `GET` with query-string parameters. The documented endpoint is
`https://wwwn.cdc.gov/nioccs/IOCode`; inputs include industry (`i`), occupation
(`o`), candidate count (`n`), version (`v`), code scheme (`c`), unexpected-
combination output (`u`), and response format (`t`). As documented at review
time, `c=0` returns NAICS 2017/SOC 2018, `c=1` returns Census 2018, and `c=2`
returns both; `v=18` and `v=12` select the documented classification families.
These are external service facts, not permanent Epi Info defaults, and must be
capability-discovered or configuration-pinned when work resumes.

NIOSH states that the service does not retain request information, IP addresses,
or coding-request content. Nevertheless, occupation and industry narratives are
potentially sensitive and the GET-only design places them in a URL, where
browsers, gateways, proxies, monitoring systems, or diagnostic logs may handle
them. A connected provider therefore requires explicit user disclosure and
consent, sends only the two necessary narratives, never sends the surrounding
record, and must not write narratives or request URLs to general command history.

Direct use from GitLab Pages, GitHub Pages, or another Epi Info AI origin also
depends on current CORS behavior and restrictive-network policy. CORS has not
been verified and is a required deployment spike. If a governed first-party
gateway is needed, it must have an approved data-flow, authentication/rate-limit
policy, logging minimization, retention statement, and threat model. A public
third-party CORS proxy is not acceptable. An installed desktop shell may use
native HTTP only through the same consent and capability contract.

`c=2` is a useful evaluation option because it returns NAICS/SOC and Census
representations together, but it is not yet the product default. Classification
choice depends on the study and comparison data; NIOSH recommends NAICS/SOC for
many internal analyses, while Census codes may be necessary for compatible
external comparisons. The review UI must make the selected scheme explicit.

### Human review and atomic results

The legacy mental model is ranked candidate review, not automatic acceptance of
candidate one. A future dialog should show editable industry and occupation
narratives, ranked codes and titles, probabilities, scheme/version, provider
identity, and any unexpected-combination warning. The operator may revise and
rerun, cancel without mutation, or explicitly choose both candidates.

Only **Use Codes** may commit. The two possibly revised narratives, two codes,
two titles, and scheme must be validated and assigned as one form-state
transaction. Failure, cancellation, timeout, malformed output, navigation, or
project switch must leave all seven fields unchanged.

Optional provenance may record provider/model version and digest, taxonomy
version, selected probabilities, timestamp, coding method, and whether a human
reviewed the selection. It belongs in a defined protected record-metadata
contract—not invisible global telemetry—and must remain distinguishable from
the value-free general command audit. Export, encryption, retention, and
de-identification behavior must be specified before enabling it.

## Promotion requirements

1. Establish the model, assembly, taxonomy, and training-data provenance,
   redistribution terms, update authority, supported coding schemes, and
   retirement policy.
2. Define the signed Occupational Epidemiology package manifest, capability,
   integrity, update, revocation, and compatibility requirements.
3. Obtain or implement a reviewed browser-compatible engine behind a typed
   `io.coder.review/0.1` contract. Prefer an offline Worker/WASM adapter; an
   approved NIOSH service must require explicit disclosure and consent before
   occupational text leaves the browser.
4. Freeze a synthetic validation corpus containing exact candidate order,
   probabilities, codes, titles, scheme, blank inputs, misspellings,
   ambiguous descriptions, ties, and no-match behavior. Compare independently
   with the retained desktop coder and qualified occupational-health reviewers.
5. Preserve the desktop review step: show candidate code, title, probability,
   model/version, and coding scheme; never auto-commit a low-confidence result.
6. Apply all seven assignments atomically only after confirmation. Cancel,
   timeout, unavailable model, invalid output, or project switch must leave the
   draft unchanged.
7. Enforce model digest/version pinning, lazy loading, browser storage quotas,
   Worker cancellation and timing, offline restart, package integrity, value-
   free general history, accessibility, and Chromium/Firefox/WebKit tests.

Until this future TODO is resumed and all promotion gates are met, IOCODE
remains visible and diagnosable but disabled.
