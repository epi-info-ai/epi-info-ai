# Project and storage compatibility inventory

## Scope and evidence

This inventory covers creating, opening, saving, and synchronizing Epi Info
projects and their collected data. Evidence begins with the project/data-store
workflows in the Epi Info 7 User Guide and these legacy assets:

- `Epi.Core/Project.cs`, `View.cs`, and the metadata/data service abstractions;
- `Epi.Core/Data/Services/CollectedDataProvider.cs`;
- database drivers and connection models under `Epi.Data` and `Epi.Core`;
- the MakeView new-project wizard, including Access and SQL project panels; and
- Enter Data import paths in `Epi.Windows.Enter/Forms/ImportData.cs`.

The browser implementation uses a versioned project snapshot, browser storage,
CSV exchange, and an optional authenticated Supabase copy. A browser cannot
connect directly to a SQL Server socket or safely hold privileged database
credentials; any such compatibility path requires a reviewed HTTPS service.

## Capability and gap register

| Gap ID | Familiar capability | Current browser state | Disposition and closure gate |
|---|---|---|---|
| LEGACY-STORAGE-001 | Project metadata, forms/pages, code tables, and collected-data relationships | Versioned JSON snapshot covers forms and flat records | Preserve. Inventory and map the complete legacy project model before format parity. |
| LEGACY-STORAGE-002 | Create, open, save, copy, and select projects | File > Open Project and Save Project As validate/export a V2 JSON project envelope; project history/copy remain open | Preserve with final `.epia` container, recovery, and compatibility tests. |
| LEGACY-STORAGE-003 | Microsoft Access project/data store | Read-only Windows inventory converter and official Sample package fixture; no direct browser driver or SQLite conversion yet | Add a reviewed `.mdb`/`.accdb` to SQLite converter outside the browser, an explicit object/type mapping, immutable-source handling, migration manifest, unsupported-object reporting, and desktop differential validation; do not silently drop. |
| LEGACY-STORAGE-004 | SQL Server project/data store | No direct browser connection | Adapt through a least-privilege HTTPS organizational connector; never expose database credentials to WASM/browser code. |
| LEGACY-STORAGE-005 | Import data between projects and related tables | CSV form/record import only | Preserve semantics with typed adapters, validation, relationships, and audit evidence. |
| LEGACY-STORAGE-006 | Browser-local working copy (new branch) | `localStorage` prototype | Extend to SQLite WASM/OPFS, export/recovery, quota handling, and migration. |
| LEGACY-STORAGE-007 | Supabase hosted copy (new branch) | Authenticated whole-project upload/download with RLS and revision checks | Harden configuration, sessions, recovery, audit, and deployment policy. |
| LEGACY-STORAGE-008 | Multi-user record merge (new branch) | Not present; whole-project conflict rejection only | Add record identities, operation/conflict model, review UI, and validation before collaboration claims. |
| LEGACY-STORAGE-009 | Clear local/offline/pending/synchronized/failed feedback | Phase 3C state and action-local feedback present | Parity in progress. Persist truthful dirty/last-sync state and test recovery across reloads. |

## Phase 3C interaction contract

Project and Project Storage dialogs use a narrow-screen base with a bounded
viewport-height form, a scrollable body, persistent title/actions, 44 CSS pixel
controls, and tablet/desktop width enhancements. Connection results remain below
Test Connection and Copy Setup SQL; account results remain below account actions;
synchronization results remain below upload/download actions.

The state summary distinguishes offline, local, pending, connected, synchronized,
and failed states. “Synchronized” is only emitted after a confirmed upload or
validated download. Loading saved connection settings does not imply that the
current working copy matches its hosted counterpart.

The main launcher retains Create Forms, Enter Data, the Classic/Visual Dashboard
Analyze Data group, Create Maps, Website, and Exit in their learned order, with
StatCalc retained in the application menu/module tree. Responsive reflow does not
rename, reorder, deprecate, or retire those branches.

## Automated evidence

Browser tests verify launcher order at phone/tablet/desktop widths, bounded and
scrollable phone dialogs, visible action-adjacent connection/account feedback,
44-pixel connection controls, pending/connected/failed transitions, offline/local
transitions, and the New Project dialog’s immediately visible local-storage note.

## Remaining audit work

- Complete the legacy project schema and database-driver inventory.
- Extend the read-only Access inventory tool into a sandboxed `.mdb`/`.accdb`
  to SQLite converter. Preserve project/form/page metadata, code tables,
  relationships, keys/indexes, records, deletion state, and Check Code source;
  record source/output hashes, converter version, object mappings, warnings, and
  unsupported macros/VBA/OLE/attachments/queries/encryption in a migration
  manifest. Reconcile table/row/column counts, values, types, nulls, dates,
  GUIDs, blobs, and referential integrity against desktop Epi Info/Access.
- Define portable project package, Access conversion, and organizational connector
  boundaries without placing privileged credentials in the browser.
- Track local changes since the last hosted revision and survive reload/session
  expiry without making a false synchronization claim.
- Implement recoverable SQLite/OPFS storage and record-level collaboration only
  after their contracts and conflict tests are reviewed.
- Evolve the V2 JSON envelope into the final `.epia` container without changing
  its preservation rules; add attachments, integrity metadata, and streaming limits.
