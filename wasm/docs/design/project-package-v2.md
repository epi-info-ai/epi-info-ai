# Portable project package V2

## Purpose

The V2 package is the first browser-native bridge from an Epi Info Access project
to Epi Info AI. It preserves the reviewed legacy material while exposing a
validated projection that the current Forms and Enter Data prototype can open.
It is a JSON envelope in this slice; a later durable-storage phase may place the
same versioned payload and SQLite data inside a ZIP-based `.epia` container.

The package is not an Access database emulator. Direct `.mdb` parsing remains an
external migration boundary because ordinary browsers do not provide an Access
database driver.

## Contents

`app/contracts/project-package.ts` validates:

- a `ProjectSnapshotV1` runnable projection;
- saved Classic Analysis and Check Code source;
- code/lookup tables;
- complete legacy form, page, field, tab-order, and Check Code metadata;
- source inventory totals; and
- explicit preserved, adapted, unsupported, or blocked migration findings.

Unknown or unsupported legacy behavior is retained as metadata and reported. It
is never silently treated as executable browser behavior.

## Official Sample conversion

`scripts/convert-epi-info-access.ps1` reads an Epi Info Access project through the
Microsoft Access Database Engine in read-only mode and emits the V2 JSON envelope.
The checked-in `demo/examples/sample-project.epia.json` is generated from the
legacy Community Edition `Sample.mdb` and contains:

| Item | Expected count |
|---|---:|
| Forms/views | 18 |
| Pages | 26 |
| Fields | 417 |
| Code tables | 22 |
| Saved programs | 1 |

The saved `Statistics` program is preserved verbatim. Browser execution remains
command-gated: preserving source does not authorize `EXECUTE`, DLL, filesystem,
process, or unrestricted network behavior.

Regenerate on a Windows host with the Access Database Engine installed:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File wasm/scripts/convert-epi-info-access.ps1 `
  -InputMdb wasm/source/Epi-Info-Community-Edition/Epi.Core/Projects/Sample/Sample.mdb `
  -OutputPackage wasm/demo/examples/sample-project.epia.json
```

## Current UI behavior and limits

The familiar application **File** menu exposes **Open Project...** and
**Save Project As...**. Opening validates the complete package before replacing
the local working copy. Saving preserves programs, code tables, and migration
metadata loaded from the package along with current form/record changes.

This prototype remains JSON plus `localStorage`. It does not yet provide the final
ZIP container, SQLite/OPFS persistence, attachments, streaming import, digital
signatures, or direct `.mdb` upload. Those remain Phase 7 durability gates.

## Acceptance evidence

Phase 0 checks validate the package schema, structural totals, representative
record counts, program identity/source, and rejection of unsupported versions.
Playwright opens the official Sample package through the file control, verifies
the Oswego form is selected, and verifies a Save Project As download.
