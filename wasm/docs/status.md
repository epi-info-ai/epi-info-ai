# Epi Info AI current status

**Status:** concise implementation and evidence snapshot

**Last reviewed:** 2026-09-24

## Purpose

This page answers “what exists now?” without turning the README, architecture,
or migration plan into competing status authorities. It is intentionally
concise. Detailed evidence remains in the machine-readable command inventory,
compatibility registers, method contracts, tests, and example projects.

The terms have strict meanings:

- **Legacy parity** requires reviewed historical behavior plus differential or
  experienced-user evidence. No Classic Analysis command currently meets every
  legacy-parity gate.
- **Candidate** means a bounded implementation and some automated evidence
  exist, while recorded parity, scientific, security, browser, or field-review
  gates remain.
- **New branch** is an Epi Info AI capability and does not count toward legacy
  parity.

## Current capability snapshot

| Area | Current state | Leading open gates |
|---|---|---|
| Application shell and data entry | Browser-first TypeScript application with familiar modules, form design, record entry, typed validation, guarded project lifecycle, and import preview | Remaining menu/function parity, field-user review, and multi-engine acceptance |
| Projects and exchange | Validated `.epia` working packages, authenticated `.epiax` encrypted packages, map/runbook artifacts, explicit import review, and manual Secure Epi Info Share | Durable SQLite/OPFS project store, legacy `.edp7`, stronger KDF, recovery, and security review |
| Check Code | Separate typed AST/editor/runtime for bounded Form, Page, Record, and Field events with safe browser adaptations | Broader legacy grammar/functions, exact timing/scope behavior, unsafe-desktop exclusions, differential and field-user review |
| Classic Analysis | 49-entry legacy inventory; 37 typed parser branches, 37 typed dialogs, 36 selected/reviewed execution paths, 17 bounded full-program components, and 30 browser-verified entries | Desktop/experienced-user differential evidence, remaining command families and variants, and Rust `epi-lang` consolidation |
| Statistical kernel | Rust/WASM 2 x 2, stratified, matched-pair, survey, and related candidate operations with independent notebooks | Method-specific G5 review, broader corpora, differential evidence, and production promotion |
| Maps and GIS | Familiar mapping paths, coordinate/geocoding candidates, project map assets, point, choropleth, dot-density, map-document, offline PMTiles, cluster rendering, and an emerging `epi-gis` Worker/kernel boundary | Correct and independently validate the pending K09 advanced-spatial candidates, full legacy map parity, CRS/format hardening, field-offline and cartographic review |
| Teaching and runbooks | Dataset-bound examples, importable teaching-repository candidate, action-aware runbooks, and JupyterLite validation labs | Signed/curated distribution, update/uninstall lifecycle, broader lessons, and competency governance |
| Epi Assist | Optional local Granite and managed-provider proposal boundaries using minimized context and typed reviewed actions | Reliable local-model distribution, device/browser support, gateway governance, and formal evaluations |
| New-branch analysis | Governed `QUALITY`, Access table conversion, space-time cluster, and record-linkage candidates | Each branch’s recorded validation, privacy, usability, persistence, and promotion gates |

## Deployments and evidence

- GitLab is the authoritative repository and Pages release path.
- GitHub is the public replica and independently rebuilt Pages deployment.
- JupyterLite notebooks are independent validation evidence, not the production
  statistics implementation.
- Example projects and programs are acceptance fixtures; successful execution
  does not by itself establish legacy parity.
- Published version labels, GitLab Pages, GitHub Pages, and the replicated commit
  must agree before CPPR is complete.

## Ordered near-term priorities

1. Run the strengthened navigation assertions in Firefox, Desktop WebKit, and
   Mobile WebKit CI, then retain real Edge, Safari/macOS, Mobile Safari/device,
   and assistive-technology acceptance as explicit release gates.
2. Correct and revalidate MR !6's K09 advanced-spatial candidates before merge;
   do not expose unvalidated scientific methods through the public GIS index.
3. Keep the completed bounded Check Code function batch at Candidate while
   field-validation usability, exact desktop timing/scope, differential review,
   and broader browser evidence remain open.
4. Continue Classic command parity with dataset-independent programs, asserted
   outputs, and differential evidence.
5. Keep package management, adaptive learning, IOCODE, command-line, JupyterGIS,
   and broader AI work as governed roadmap branches until their gates are met.

## Maintenance rule

Update this snapshot when a capability changes category, a priority changes, or
a release is published. Update the machine registry before changing command
counts. Keep dated history in the README progress sections or release notes;
do not turn this page into a cumulative changelog.
