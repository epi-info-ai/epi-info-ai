# Phase 0 generated Pages verification record

## Test record

| Item | Value |
|---|---|
| Source commit | `b4324c4c689a9de7d58decc3b6e4c614be0a3548` |
| Recorded by | Codex, incorporating prior user-observed browser sessions |
| Date | 2026-08-26 |
| Build environment | GitLab CI: Node 24.19 Alpine and Rust 1.85 Alpine |
| Deployment | `https://epi-info-ai-2859c9.gitpages.cdc.gov/` |
| Generated deployment pipelines | 293728 and 293878 |
| Result | Pass with documented limitations |

## Evidence

- Pipeline 293878 completed `browser-baseline`, `rust-kernel`,
  `production-build`, and `pages` successfully.
- The downloaded `production-build` artifact was inspected. It contains the
  generated `wasm/dist` application, source maps, build manifest, and WASM file.
- The build manifest reports schema version 1, application version 0.1.0, five
  maintained source modules, and ten generated module outputs.
- The dependency-free baseline covers required UI landmarks, JavaScript syntax,
  WASM checksum and exports, the versioned 2 x 2 result contract, CSV quoting and
  Unicode, snapshot structure, snap-to-grid arithmetic, map coordinate filtering,
  and Supabase table/RLS statements.
- Previous user-observed sessions confirmed the familiar launcher, Form Designer,
  snap-to-grid, CSV-created forms and records, linked record mapping, GeoJSON
  layers and labels, H3 layers, layer ordering, time lapse, and Supabase schema
  detection.
- Phase 1 changes the build and deployment path only. It does not intentionally
  change DOM IDs, browser storage keys, workflows, calculations, or serialized
  data.

## Checklist disposition

| Area | Result | Evidence or limitation |
|---|---|---|
| Main menu and navigation | Pass | Previously exercised in the deployed demo; required landmarks are also checked in CI. |
| Form Designer | Pass | Drag/drop and snap behavior were user-observed; CSV, Unicode, schema, and snap arithmetic have automated fixtures. |
| Enter Data and CSV | Pass | User-observed imported line list plus automated CSV and snapshot checks. |
| Maps | Pass with limitations | Core linked/standalone workflows and later layer features were user-observed. Offline tile failure was not repeated for this record. |
| StatCalc 2 x 2 | Pass | Result contract, WASM exports, representative table, and rejected edge cases are covered by automated checks and Rust tests. |
| Project storage and Supabase | Pass with limitations | Connection/schema feedback and installed table were user-observed. OAuth return, stale-revision conflict, and second-user RLS isolation were not repeated for this record. |
| Responsive and accessibility | Pass with limitations | Desktop layout was user-observed. The exact generated artifact was not rechecked at phone/tablet widths, 200% zoom, or with assistive technology for this record. |

## Limitations and follow-up rule

The GitLab Pages site requires CDC GitLab authentication, and no connected browser
was available when this record was finalized. Therefore the unobserved checks above
are explicitly retained as limitations, not marked as newly observed passes. They
must be repeated whenever a later migration changes visible UI, browser storage,
authentication, mapping, or deployment behavior. Any failure blocks that migration.

The generated artifact itself passed the Phase 0 automated baseline and the Phase 1
clean build/deployment gates, so these limitations do not indicate a known regression.
