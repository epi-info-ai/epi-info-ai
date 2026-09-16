# Epi Info AI teaching repository contract

## Purpose

Epi Info AI should be able to discover and install public teaching material
published from a Git repository without treating the repository or its programs
as trusted executable code. GitHub is an initial publication transport; the
content contract is host-neutral so the same repository can be mirrored on
GitLab Pages, an approved internal web server, or removable media.

A teaching repository may contain:

- synthetic or explicitly cleared datasets and data dictionaries;
- browser project packages, forms, and supporting code tables;
- visible `.pgm` or `.pgm7` programs bound to compatible datasets;
- GeoJSON, GeoTIFF, PMTiles, and other declared project map assets;
- lesson/runbook metadata and Markdown guidance;
- expected aggregate outputs, statistical tolerances, and validation notebooks;
- provenance, license, attribution, language, and audience metadata.

It is a curriculum and artifact distribution boundary, not a plugin boundary.
HTML, JavaScript, native executables, macros, and arbitrary network callbacks are
not teaching artifacts and must never run during discovery or installation.

## Repository manifest

The repository root publishes `epi-info-teaching.json`. V0.1 requires a pinned
commit or immutable release and a bounded data-only manifest similar to:

```json
{
  "schemaVersion": 1,
  "id": "org.example.field-epi-foodborne",
  "title": "Foodborne outbreak investigation",
  "version": "1.0.0",
  "license": "CC-BY-4.0",
  "source": {
    "repository": "https://github.com/example/field-epi-foodborne",
    "revision": "full-commit-sha"
  },
  "artifacts": [
    {
      "path": "examples/outbreak.csv",
      "mediaType": "text/csv",
      "sha256": "...",
      "bytes": 12345,
      "role": "dataset"
    },
    {
      "path": "programs/command-tour.pgm7",
      "mediaType": "text/plain",
      "sha256": "...",
      "bytes": 2048,
      "role": "program",
      "dataset": "examples/outbreak.csv"
    }
  ]
}
```

Stable IDs must be globally namespaced. Every installed byte is declared by
relative path, media type, length, role, and SHA-256. Paths cannot be absolute,
contain traversal segments, or escape the repository root. Unknown manifest
keys are preserved for forward compatibility but grant no capability.

## Browser workflow

1. The user chooses **Teaching Library > Add Repository** and supplies a public
   manifest URL or a locally downloaded teaching archive.
2. Epi Info AI retrieves only the bounded manifest and presents publisher,
   immutable revision, license, artifact counts/sizes, validation status, and
   requested storage before downloading anything else.
3. The user explicitly installs the reviewed revision. Each artifact is size
   checked, fetched, hashed, type checked, and staged before an atomic commit to
   browser storage. A failed artifact leaves the prior installed version intact.
4. Installed material is available offline and remains labeled with its source
   and revision. Updates are reviewable side-by-side; following a mutable branch
   silently is prohibited.
5. Opening a project or dataset exposes only its compatible program catalog.
   Programs remain visible and editable and pass the normal typed AST, semantic
   validation, plan review, command-history, and execution allowlist. Installing
   a repository never runs a program.
6. Uninstall removes only that installed teaching revision after confirmation;
   projects copied or derived by the user remain separate.

GitHub API credentials and personal access tokens are outside V0.1. Private
repository access requires a separately reviewed identity/token broker and must
never persist a broad repository token in the teaching package or project.

## Publication and review gates

- Prefer synthetic, de-identified, or public-domain records. The publisher must
  declare disclosure review and intended audience; a public Git repository is
  not an acceptable place for operational or identifiable surveillance data.
- Require explicit licenses for data, programs, documentation, and map assets.
- Validate dataset fingerprints and required fields before offering programs.
- Show whether expected outputs are illustrative, browser-tested, independently
  validated, or legacy-parity verified. Repository authors cannot self-promote
  core command parity by changing manifest text.
- Keep aggregate expected results separate from source records and prohibit
  secrets, credentials, executable binaries, and undeclared files.
- A future curated index may sign approved repository/revision pairs and revoke
  compromised releases. Curated status is independent from GitHub popularity.
- Run schema, path, hash, size, archive-bomb, AST, compatibility, accessibility,
  and offline reinstall tests in CI using a minimal fixture repository.

## Relationship to current catalogs

The existing `demo/examples/program-catalogs.json` and per-dataset
`*.programs.json` files are the embedded foundation of this design. The V0.1
loader validates a host-neutral manifest, derives immutable GitHub raw URLs,
checks byte lengths and SHA-256 digests before writing to OPFS, records installed
revisions, re-verifies artifacts when read, and registers installed program
catalogs through the same dataset fingerprint boundary. The foodborne bundle is
the first end-to-end fixture. No dataset-specific branch belongs in the
interpreter or Program Editor.
