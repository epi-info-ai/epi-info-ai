# Localization and language-pack parity inventory

Status: legacy inventory and browser internals stubbed, 2026-09-10. This is a
parity set. It does not claim that Epi Info AI is translated yet.

## Parity principle

Legacy Epi Info's language workflow is the old branch to preserve: users choose
an installed language under Options, the choice persists, and application UI
resources load for that culture. Epi Info AI may add signed, browser-installable
catalogs and immediate switching as new branches, but it must not translate
field identifiers, program source, coded values, or statistical meaning behind
the user's back.

## Inspected legacy floor

| Capability | Legacy evidence | Browser target | Current status |
|---|---|---|---|
| Default language | Configuration initializes `Language` to `en-US`. | Bundled, complete `en-US` source catalog. | Internals stubbed |
| Language discovery | Options scans culture-named subdirectories for `*.Resources.dll`. | Registry lists validated installed catalogs. | Internals stubbed |
| Select and persist | Options saves the selected culture; modules assign it to `.NET CurrentUICulture`; the legacy UI says restart is required. | Project-independent user preference with explicit fallback; immediate safe rerender where possible. | Bounded Options UI and versioned local preference candidate |
| Import translation | Options opens the Localization import workflow and turns translation data into satellite resource assemblies. | Import a bounded versioned catalog only after schema, locale, placeholder, size, provenance, and compatibility checks. | Structural validation stubbed; file UI/signing pending |
| Remove translation | Options deletes the selected culture directory and falls back to English. | Remove an installed pack without allowing removal of the source catalog. | Registry operation stubbed |
| Create/export translation | Options exports translatable resources to an Access `.mdb`; Localization Manager can create translated resource assemblies. | Export a translator-oriented neutral catalog with source strings, context, version, and stable IDs. | Pending |
| Older translation compatibility | `LegacyLanguageDbTranslator` reads Epi Info 3.x two-column Access translation tables. | Isolated, read-only MDB conversion/import adapter with an inventory and collision report. | Pending |
| Shipped localized resources | The checkout contains satellite resources for `es-ES`, `fr-FR`, and some `pt-BR` components. | Use these only as migration/reference inputs after license, completeness, terminology, and encoding review. | Legacy assets inventoried; no browser translation claim |
| Culture-sensitive presentation | Desktop modules use the selected UI culture. | `Intl.NumberFormat` and `Intl.DateTimeFormat` for display only. | Internals stubbed |
| Right-to-left layout | No complete installed RTL pack was found in this checkout. | Pack declares `ltr`/`rtl`; accessibility and layout acceptance required before release. | Metadata and document-direction switch stubbed; RTL acceptance pending |
| Help/manual localization | Not established by the inspected application-resource path. | Versioned manual locale, fallback, and visible translation status independent of UI catalogs. | Pending |

Primary evidence lives in the checked-out legacy files:

- `Epi.Core/Defaults.cs` and `Epi.Core/Configuration_Static.cs`
- `Epi.Windows/Dialogs/OptionsDialog.cs`
- `Epi.Windows/Dialogs/LanguageSelectionDialog.cs`
- `Epi.Windows.Globalization/Forms/LocalizationManager.cs`
- `Epi.Windows.Globalization/Translators/LegacyLanguageDbTranslator.cs`
- the `es-ES`, `fr-FR`, and `Epi.Core/pt-BR` resource directories

## Browser contract V0.1

`wasm/app/localization/localization.ts` provides the non-UI seam:

1. A source English pack is always present and cannot be removed.
2. Locale identifiers are canonical BCP 47 tags.
3. Imported catalogs are plain, bounded data with stable namespaced keys.
4. A translation must preserve the source message's named placeholders.
5. Lookup falls back from exact locale to a registered related language and then
   to English. Missing IDs remain visible and emit diagnostics.
6. Formatting uses the active locale, but parsing, storage, field identifiers,
   Classic Analysis syntax, AST nodes, audit events, and statistical kernels do
   not change with UI locale.
7. Translations are text. UI adapters must assign them with `textContent` or an
   equivalent safe binding; catalogs are not trusted HTML.

The stub deliberately has no network fetch, dynamic code execution, or ambient
storage access. A future host adapter will own IndexedDB/OPFS persistence,
signature policy, import preview, and user consent.

`wasm/app/localization/browser-localization.ts` is that core's first host
adapter. It restores the familiar **Tools > Options > Language** path, stores
only a versioned locale preference in local storage, binds translations as text,
and updates the document language/direction. Its `en-XA` pseudolocale preserves
placeholders while accenting and expanding the bounded shell catalog. This is a
layout-test tool, not a supported human language or evidence that the rest of
the application has been externalized.

## Acceptance gates

- Inventory every legacy user-visible resource surface and its fallback behavior.
- Establish reviewed public-health terminology glossaries per locale.
- Test missing/extra keys, placeholder changes, malformed BCP 47 tags, oversized
  packs, Unicode normalization, bidi/RTL layout, long strings, and mixed scripts.
- Test keyboard, screen-reader, responsive, offline, and print behavior in every
  supported locale.
- Verify that identical input data and programs produce identical typed analysis
  plans and numeric results under every UI locale.
- Capture desktop Epi Info screenshots/results for the language Options workflow
  before declaring legacy parity.
- Display pack version, source, coverage, review state, and application-version
  compatibility. Community translations must never be presented as CDC-reviewed
  without the corresponding governance evidence.
