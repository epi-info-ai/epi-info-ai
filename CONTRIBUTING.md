# Contributing to Epi Info AI

Epi Info AI welcomes collaboration while it remains a prototype. The CDC
GitLab repository is currently authoritative; GitHub is its public, read-only
development replica. See `AGENTS.md` for the detailed architecture, safety,
validation, and release rules that also apply to coding agents.

## Accounts and credentials

Use your own named GitLab and GitHub accounts with MFA. Create a separate,
least-privilege, repository-scoped token when command-line access requires one.
Never share credentials or commit them. Local secrets belong only in the
ignored `wasm/.secrets/` directory or an approved credential manager.

## Change workflow

1. Synchronize with GitLab `main` and create a focused feature or fix branch.
2. Make the smallest coherent change. Preserve unrelated or untracked work.
3. Run the relevant checks. The normal non-Rust gate is `pnpm run check`, plus
   focused Playwright tests. Do not run native Rust builds on CDC Windows; CI is
   the evidence source for that gate.
4. Update parity inventories, architecture decisions, examples, test programs,
   validation evidence, and user documentation when the behavior changes.
5. If you have CDC GitLab access, open a GitLab merge request using the
   repository template. State whether the change is parity, a browser
   adaptation, or a labeled new branch. External contributors without CDC
   GitLab access may instead open a GitHub pull request as a proposal; a
   maintainer will carry it into GitLab while preserving attribution.
6. Obtain human review and passing CI. Eligible pipelines should start
   automatically. If you cannot start a protected/manual job, mark the merge
   request **maintainer CI required**; a maintainer owns that gate. Resolve
   conflicts against current `main` and rerun affected local checks.
7. Prefer squash merge for a focused branch. Do not force-push or rewrite
   published `main` history.
8. After merge, a designated maintainer—not the contributor—completes CPPR:
   approve protected release jobs, verify GitLab Pages, replicate the exact
   merge commit to GitHub, and verify GitHub Pages.

Do not merge independently into GitHub `main` while GitLab is authoritative.
A GitHub pull request is an external proposal until a maintainer imports and
merges it through GitLab. A future move to GitHub-first external collaboration
requires a documented cutover; the two repositories must never operate as
competing writable authorities.

## Review floor

A reviewer should be able to answer yes to each applicable question:

- Is legacy parity distinguished from browser adaptation and new functionality?
- Is unsupported behavior visible and fail-closed rather than silently guessed?
- Are numerical results independently validated and provenance/limitations
  exposed to users?
- Are sensitive record values excluded from logs, AI prompts, examples, and
  audit receipts unless explicitly governed?
- Are menus, dialogs, keyboard behavior, narrow layouts, and relevant browser
  engines tested?
- Do project packages preserve intended data, programs, runbooks, audit history,
  study-area metadata, and map assets without including credentials?
- Are documentation, examples, cache-busters, and parity inventories current?

Deployment success is part of completion. A push without both required Pages
verifications is not a completed CPPR release.
