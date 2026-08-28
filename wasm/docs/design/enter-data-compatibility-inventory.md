# Enter Data compatibility inventory

## Scope and evidence

This inventory covers the learned Enter Data path from a project form to record
entry, saving, record navigation, line listing, import/export, validation, and
linked tools. Evidence starts with the Epi Info 7 User Guide Enter Data workflow
and these legacy code assets:

- `Epi.Windows.Enter/Forms/EnterMainForm.cs`, its designer and resources;
- `Epi.Windows.Enter/Forms/Canvas*` and `LineListingViewer*`;
- `Epi.Windows.Enter/PresentationLogic/GuiMediator*`;
- `Epi.Enter.CheckCodeEngine/` and `Epi.Core.EnterInterpreter/`;
- `Epi.Core/Data/Services/CollectedDataProvider.cs`; and
- shared form/view models in `Epi.Core/`.

The browser prototype in `demo/form-data.ts` and `demo/index.html` implements a
small vertical slice. It does not define the legacy capability floor by itself.

## Capability and gap register

| Gap ID | Familiar capability | Current browser state | Disposition and closure gate |
|---|---|---|---|
| LEGACY-ENTER-001 | Open a project form and retain its page/field order | Current form fields render in schema order; multi-page forms are absent | Preserve. Add project/view/page compatibility and tests before parity. |
| LEGACY-ENTER-002 | Enter and save a new record | Browser-local save works with adjacent status feedback | Parity in progress. Add field-type semantics, persistence failures, identifiers, and legacy edge cases. |
| LEGACY-ENTER-003 | Navigate, find, edit, delete, and undelete records | Map can open a record; duplicate review supports reasoned Recycle Bin deletion, audit, and restore | Recoverable duplicate slice implemented. Preserve and implement general find/edit/navigation/delete/undelete semantics. |
| LEGACY-ENTER-004 | Required fields, legal values, ranges, patterns, and Check Code | Typed rules plus a safe field After-event Check Code subset run during entry/import/restore | Phase 4 slice implemented. Preserve and expand field/event/type compatibility without executing arbitrary source. |
| LEGACY-ENTER-005 | Line Listing / browse saved records | Read-only browser line list | Parity in progress. Add selection, navigation, field display, paging/filtering, and large-data behavior. |
| LEGACY-ENTER-006 | Import/export and compatible data stores | CSV/TSV/JSON-record/Excel `.xlsx` input, CSV export, and browser/Supabase project snapshots | Adapt with explicit format, validation, security, and compatibility boundaries. Legacy `.xls` remains open. |
| LEGACY-ENTER-007 | Linked Maps and other Enter Data tools | Current-form Maps link works | Preserve learned paths; inventory all linked commands before claiming parity. |
| LEGACY-ENTER-008 | Record status, storage status, and error feedback | Local/hosted badge plus adjacent save/import status | Adapt to browser persistence and asynchronous synchronization states. |
| LEGACY-ENTER-009 | Phone field-entry workflow | Phase 3B entry/records switcher on narrow screens | Responsive adaptation. Keep labels/order identical and retain both familiar panels on wider screens. |
| LEGACY-ENTER-010 | Acquire and review record coordinates | Desktop-style Address -> Get Coordinates -> review/select -> signed coordinate fields works through a typed provider boundary; manual/imported coordinates remain valid | Bounded desktop parity candidate. Replace the demonstration provider before production, preserve failure-without-mutation, add acquisition provenance, and separately adapt the mobile Capture Coordinates workflow. A click-map picker remains an optional labeled new branch. |

When the configured geocoding service is unavailable, the form remains usable.
Manual/imported signed coordinates are retained; permission-gated browser GPS is
an adapted mobile branch; and a click-map picker may be offered as a labeled new
branch. No fallback silently invents a coordinate. Address, acquisition status,
coordinate provenance, and validation remain distinguishable.

## Phase 3B responsive contract

On a phone, New record is the initial task and Saved records is an explicit
secondary view. Switching views does not change the schema, record collection,
field order, CSV contract, storage keys, or map linkage. Saving remains in the
entry view and reports status beside the action; CSV import/export remains in the
line-list view and reports status directly below those controls.

At tablet width both panels are present in task order. At desktop width the
familiar form and line list remain side by side. This is an adaptation of the
existing Enter Data branch, not a new feature branch, deprecation, or retirement.

## Automated evidence

`tests/browser/application-shell.spec.mjs` verifies that phone entry is primary,
field prompts retain their schema order, a saved record updates status/counts and
appears in the secondary line list, CSV feedback stays in that view, and tablet
and desktop layouts retain both panels. It also uploads TSV, JSON, and a real
`.xlsx` workbook through the shared schema-inference path. Pure delimited/JSON and
snapshot contracts remain covered by the Phase 0 checks. Phase 4 browser tests
also cover calculated age, safe field-state actions, Data Quality review, and the
audited Recycle Bin lifecycle. Field completeness uses accessible proportional
mini-bars in the Missing column to expose zero, partial, and at-least-50-percent
missingness without replacing the exact count. The geolocation parity test mocks the external
provider and verifies that coordinates remain blank before selection, retain
seven decimal places after selection, save as record data, and preselect the
Case Cluster latitude/longitude fields.

## Remaining audit work

- Inventory every Enter Data menu/toolbar command and its manual path.
- Inventory field behavior, Check Code events, record lifecycle, related forms,
  paging, printing, and line-list options from the legacy implementation.
- Define scalable SQLite/OPFS behavior and record-level hosted synchronization.
- Obtain experienced-user review before marking any `LEGACY-ENTER-*` gap complete.
