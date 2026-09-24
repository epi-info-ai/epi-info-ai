# Security, privacy, and geoprivacy review

**Status:** code-backed prototype review, not a security authorization
**Reviewed:** 2026-09-24

Epi Info AI must assume that project records, identities, free text, precise
locations, dates, program literals, and derived small-cell outputs can be
sensitive public-health information. Running in a browser reduces ambient
desktop authority; it does not by itself provide confidentiality, safe network
egress, encrypted storage, or geoprivacy.

## Scope and trust boundaries

This review covers the maintained browser shell, TypeScript contracts and
kernels, Rust/WASM interface, Web Workers, browser storage, project/package
import and export, mapping, Epi Assist, Supabase synchronization, and static
deployment. It distinguishes five boundaries:

1. **Untrusted input:** project packages, teaching repositories, tabular files,
   map files, programs, prompts, URLs, and provider responses.
2. **Browser-local authority:** DOM, localStorage, sessionStorage, OPFS, Cache
   Storage, clipboard, downloads, geolocation, and cryptographic APIs.
3. **Computation:** the main thread, Workers, WebAssembly, DuckDB-Wasm, and the
   emerging `epi-gis` kernel. Workers and WASM improve isolation and
   responsiveness but are not confidentiality boundaries from the host page.
4. **Network egress:** static assets, OpenStreetMap tiles/Nominatim, model
   weights, same-origin AI gateway, Supabase, and governed package sources.
5. **Released artifacts:** `.epia`, authenticated encrypted `.epiax`, CSV,
   images, HTML output, GIS files, receipts, screenshots, and clipboard data.

The current prototype is appropriate for synthetic demonstration data. It must
not be represented as approved for identifiable production data until the open
gates below are resolved and reviewed under the applicable CDC process.

## Controls verified in the current code

| Boundary | Current control | Evidence | Qualification |
| --- | --- | --- | --- |
| Programs and Check Code | Typed parse → validate → bounded execution; unsupported desktop authority fails closed; no application `eval` or generated JavaScript execution path | `app/programming/`, `app/check-code/`, compatibility registries | Parser coverage and capability review remain incomplete; imported source is still untrusted text |
| Workers/kernels | Versioned plans/results, schema validation, byte/feature/coordinate limits, cancellation for non-trivial work, and value-minimized GIS receipts | `app/gis/contracts.ts`, `demo/gis-worker.ts`, statistical Worker clients | Raw records or coordinates may legitimately enter a local Worker; a Worker is not a privacy boundary and must not gain network or storage authority implicitly |
| Project archives | Package validation plus exact asset count, byte length, SHA-256, format/header checks, and rejection of trailing bytes | `app/contracts/project-archive.ts` | SHA-256 supplies integrity, not publisher identity or confidentiality |
| Teaching projects | Catalog v2 authenticates the archive and recomputes logical dataset, program, runbook, settings, and map-asset manifests before opening | `app/projects/example-repository.ts`, `app/projects/project-content-manifest.ts` | Signing, revocation, rollback, and a curated trust root remain open |
| Encrypted exchange | `.epiax` uses authenticated AES-256-GCM with a passphrase-derived key and fails on wrong password or tampering | `app/contracts/encrypted-project.ts` and browser tests | PBKDF2 parameters need independent review; Argon2id, recovery, recipient keys, and security assessment remain open |
| AI | Local Granite receives schema/aggregate-quality context in a Worker; cloud choices use a same-origin gateway and native typed tool calls; no action runs automatically | `demo/epi-assist.ts`, `app/assistant/`, `app/contracts/assistant.ts` | Project/form/field names, prompts, aggregate counts, and the user's prompt can still be sensitive; the gateway path needs deployment, retention, and model-governance approval |
| Hosted sync | Supabase requires explicit sign-in and upload/download, validates returned snapshots, uses optimistic revisions, and relies on per-owner RLS setup | `demo/supabase-sync.ts`, `demo/setup/supabase-schema.sql` | The complete project snapshot—including precise coordinates—travels to Supabase over TLS without application-level record encryption |
| DOM output | Most imported values are rendered with `textContent`; current complex-table headings no longer interpolate project prompts through `innerHTML` | `demo/app.ts` | Static `innerHTML` remains and must be inventoried; enforce a no-untrusted-HTML rule with tests and, where feasible, Trusted Types |
| Geolocation | Browser location is permission-gated and user initiated; Check Code reads a session-only last position and never prompts silently | `demo/maps.ts`, `app/check-code/check-code-location.ts` | Staleness, retention, mobile permission UX, and privacy approval remain open |

## Material findings

### P0 — production-sensitive use blockers

1. **Browser-local records are not encrypted at rest.** Active/recent project
   snapshots are stored in the browser profile, including records and precise
   coordinates. OPFS map assets are also plaintext. Device/browser profile
   protection is currently the only at-rest boundary. `.epiax` protects an
   exported backup, not the live workspace.
2. **No deployment-wide Content Security Policy is evidenced.** The application
   uses local scripts and bounded URLs, but a strict tested CSP, framing policy,
   referrer policy, permissions policy, and production security headers are not
   established for both Pages deployments.
3. **Network egress is not centrally governed.** OpenStreetMap tiles can reveal
   the user's IP address and viewed tile area; Nominatim receives the entered
   address; Supabase receives complete snapshots; model hosts receive weight
   requests; a managed AI gateway receives the prompt and minimized context.
   Each route needs a visible purpose, provider, data-classification, consent,
   offline behavior, and auditable allowlist.
4. **There is no application-wide geoprivacy policy.** Precise coordinates can
   appear in forms, popups, cluster results, screenshots, map/image exports,
   project packages, CSV, GIS assets, sync snapshots, and user-authored program
   output. Accuracy and five-decimal precision are data-quality requirements,
   not permission to disclose that precision.
5. **Security release evidence is incomplete.** Threat modeling, dependency and
   SBOM policy, secret scanning, browser security-header tests, malicious
   package corpus, penetration testing, and incident/revocation procedures need
   named owners and release gates.

### P1 — high-priority hardening

- Program history persists project/form names, source, summaries, and
  diagnostics in localStorage. Source can contain sensitive literals. Define
  retention, per-project separation, clear/export controls, and synchronization
  policy before centralizing history for training.
- Clipboard, downloads, print, HTML output, PNG, CSV, GeoJSON, GeoTIFF, PMTiles,
  and screenshots are user-initiated disclosure paths. Add consistent privacy
  classification, destination warnings, provenance, and redaction/generalization
  options without silently changing authoritative data.
- The OAuth access token is tab-memory only, which is preferable to persistent
  token storage, but the URL and publishable key persist in localStorage. Confirm
  that only publishable credentials are accepted and add tests that secrets and
  tokens never enter project packages, logs, URLs, or error messages.
- Archive and GIS defenses need continuing negative tests for decompression
  bombs, path traversal, duplicate/conflicting assets, pathological geometry,
  oversized output, malformed TIFF/PMTiles/SQLite containers, and parser
  differential behavior.
- Service-worker and model/package caching require explicit version pinning,
  integrity, update/rollback, eviction, and offline-readiness behavior.

## Geoprivacy policy floor

Implement geoprivacy as a typed policy applied at presentation and release
boundaries while retaining authoritative coordinates inside the governed
project when the study requires them.

1. Classify every geography as `precise-sensitive`, `generalized`,
   `administrative-area`, or `public-synthetic`, with provenance, purpose, CRS,
   precision, and approved uses.
2. Default maps and popups to the least revealing view that satisfies the task.
   Record identifiers and exact coordinates require an explicit reviewed layer
   choice; they must not leak into generic tooltips, receipts, telemetry, or
   screenshots.
3. Add export policies for coordinate suppression, decimal reduction, spatial
   aggregation, approved administrative-area joins, and small-cell thresholds.
   Generalized exports are derived copies and never overwrite source locations.
4. Treat jitter as a disclosure-control transformation with a recorded method,
   seed policy, maximum displacement, boundary behavior, and warning—not as a
   cosmetic map option or a substitute for aggregation.
5. Warn before enabling online tiles or geocoding for a sensitive study area.
   Offline/blank basemaps and manual coordinates must remain functional.
6. Prevent inadvertent exact-location exposure in AI context, command history,
   error reports, runbook evidence, accessibility artifacts, and automated test
   screenshots.
7. Require privacy review of spatial joins and cluster outputs: a centroid,
   member point, rare-area label, or time window can re-identify cases even when
   names are absent.

## Prioritized implementation roadmap

### Security/privacy slice 1 — inventory and fail-closed defaults

- Create a machine-readable network-egress registry and test that every `fetch`,
  tile, geocoder, AI, package, and sync route maps to an approved capability.
- Add data/privacy classifications to project, package, map-layer, output, and
  receipt contracts; reject missing classifications at governed export/sync
  boundaries.
- Add a visible **Privacy and offline readiness** review that lists local data,
  external providers, precise layers, pending sync, and backup status.
- Test strict security headers in GitLab and GitHub deployment probes.

### Security/privacy slice 2 — geoprivacy controls

- Add project-level policy plus per-layer display/export decisions.
- Implement deterministic derived generalization/aggregation with receipts and
  independent spatial tests; add small-cell and exact-coordinate warnings.
- Exercise foodborne, cluster, record-linkage, and environmental teaching
  projects with public-synthetic classifications and negative fixtures.

### Security/privacy slice 3 — storage and synchronization

- Threat-model live-workspace encryption, key custody, recovery, multi-tab use,
  backup, and performance before choosing an implementation.
- Add client-side encryption options for hosted snapshots where compatible with
  approved collaboration and recovery requirements; do not describe Supabase
  database encryption as end-to-end encryption.
- Add explicit retention/clear controls for local projects, history, models,
  packages, maps, and cached provider responses.

### Security/privacy slice 4 — assurance

- Maintain malicious input and disclosure-regression corpora in CI.
- Produce an SBOM, dependency review, secret scan, CSP/Trusted Types tests, and
  reproducible package provenance for each release.
- Complete independent security, privacy, geoprivacy, accessibility, and field
  workflow review before authorizing identifiable data.

## Required regression questions

Every feature review must answer:

- What exact record, location, identity, prompt, or derived values enter it?
- Which thread, Worker, WASM module, storage area, server, and provider receive
  those values?
- Can the operation work offline, and what does it do when the network appears
  or disappears?
- What leaves the browser through network, clipboard, download, print, image,
  log, error, receipt, or screenshot?
- How is integrity checked, authority granted, cancellation handled, and partial
  state rolled back?
- How does the user inspect, minimize, back up, retain, synchronize, or delete
  the information?
- For geography, what is the finest disclosed spatial and temporal resolution,
  and is it necessary for the stated epidemiologic purpose?
