# Phase 2 snapshot and Supabase migration verification

## Scope

- Runtime validation for browser-local and hosted project snapshots.
- Recovery preservation for unreadable local project JSON.
- Behavior-preserving migration of Supabase synchronization from JavaScript to
  TypeScript.
- Production bundling of TypeScript runtime contracts without publishing raw
  TypeScript files.

## Automated result

Pass on 2026-08-26 with portable Node 24.19.0:

- strict TypeScript type check;
- seven Phase 0 baseline check groups;
- valid project snapshot fixture;
- four malformed snapshot fixtures;
- unreadable local-state recovery-key preservation;
- production build and 20 required artifact checks; and
- confirmation that `wasm/dist` contains no raw `.ts` files.

## Manual browser status

Pending connected-browser availability. The local production preview responded,
but no controllable browser instance was available for interactive verification.
This is recorded as a limitation rather than an observed pass.

Before treating the Supabase module as fully browser-verified, repeat these checks
with synthetic data:

1. Test Connection feedback appears below its trigger controls.
2. Email and GitHub sign-in retain their existing behavior.
3. Schema detection distinguishes an installed and missing `epi_projects` table.
4. Upload creates or advances a revision.
5. Download validates the hosted snapshot before confirmation replaces local data.
6. A malformed hosted snapshot produces an actionable error and leaves the local
   project unchanged.
7. A stale revision reports a conflict without overwriting the hosted copy.
8. A malformed local snapshot is preserved under
   `epi-info-ai.project-state-unreadable.v1`, and the legacy working form opens with
   a visible warning.
