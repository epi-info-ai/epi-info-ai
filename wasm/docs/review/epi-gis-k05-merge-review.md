# Epi GIS K05 merge review

Review date: 2026-09-23  
Merge request: CDC GitLab `epi-info-ai/epi-info-ai!6`  
Reviewed head: `e3bcacd6116eca24e6cd584f30383321d8c33b11`  
Target reviewed: `main` at release line `v0.2.0`

## Decision

**Changes requested. Do not merge the reviewed head.**

The typed point-layer work is a useful K05 candidate, and its GitLab pipelines
pass. The merge-request branch nevertheless contains stale pre-`v0.2.0`
versions of shared application files. GitLab can merge the text without a
conflict, but the resulting tree would regress already reviewed Check Code,
runbook, capability-package, project-form, and reference-layer behavior.

JLT should rebase or merge the current `main` into `epi-gis-kernel-jlt`, retain
the current-main versions of unrelated shared behavior, reapply only the K05
changes, and rerun the complete pipeline. Passing a branch pipeline does not
demonstrate absence of functional rollback when the branch's own tests and
DOM expectations are also stale.

## Merge-blocking findings

### K05-R01 — shared UI and release rollback

The proposed `wasm/demo/index.html` changes the visible version from `v0.2.0`
to `v0.1.0`, rolls back the CSS and application cache-busters, and removes
unrelated current-main UI. Removed surfaces include:

- Capability Packages;
- runbook step verification and evidence status;
- multi-page record navigation;
- the CodeMirror Check Code editor and its undo, redo, search, font, line,
  cursor, and tab controls;
- packaged Check Code selection;
- extended Check Code dialog inputs and cancellation;
- the Check Code `AUTOSEARCH` result dialog; and
- `HIGHLIGHT` and `UNHIGHLIGHT` editor choices.

The associated CSS deletion removes the same current-main editor, page,
highlight, runbook, and package-manager behavior. K05 must be rebased and
limited to additive point-layer UI changes.

### K05-R02 — multi-page form contract rollback

The proposed `wasm/app/contracts/core.ts` removes `FormPageDefinition`,
`FormSchema.pages`, and the complete project-import validation for ordered,
non-overlapping page membership. This would break the merged multi-page Check
Code navigation contract and teaching projects. K05 must preserve the
current-main page model and add the point-layer contract alongside it.

### K05-R03 — content-addressed reference-source deletion regression

The proposed `wasm/demo/maps.ts` removes the current-main check that determines
whether a stored reference-layer source is already retained by the project.
On a later normalized-asset failure, it then removes the source unconditionally.
Because storage is content addressed, the returned source may already be
referenced by another layer. Preserve
`projectReferencesReferenceLayerSource(...)` and remove a source only when the
failed operation introduced an otherwise unreferenced object.

### K05-R04 — Web Mercator pole handling

`buildPointLayerPreviewV01` accepts valid WGS 84 latitude values through
`-90` and `90`, but `screenPoint` applies the Web Mercator formula directly.
At or sufficiently near a pole this produces a non-finite screen coordinate,
which can make display clustering unstable. Keep the WGS 84 validation range,
but clamp only the display projection to the Web Mercator latitude limit
(`approximately ±85.05112878`) and add tests for both poles and near-pole
points. The source coordinate must remain unchanged.

## Required re-review evidence

1. A refreshed MR diff against current `main` containing no unrelated feature,
   version, cache-buster, or test deletion.
2. Full `pnpm run check` success, including the current Check Code and package
   fixtures rather than the stale branch expectations.
3. The focused K05 point-layer smoke and Chromium workflow.
4. Hosted Firefox and WebKit navigation/map evidence when available.
5. Tests proving project page preservation, reference-source retention after a
   failed normalization, and finite deterministic display coordinates at the
   poles.

## Scope retained for the corrected K05 slice

The corrected MR may retain the typed `spot-map`/`case-cluster` recipe,
allowlisted filters, bounded diagnostics, marker style/color, display-only
clustering, explicit current-form record linkback, persistence/editing, the
synthetic teaching fixture, and focused browser evidence. These remain
candidates until the re-review gates pass.
