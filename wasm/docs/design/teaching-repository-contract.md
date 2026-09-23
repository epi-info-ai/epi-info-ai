# Epi Info AI teaching repository contract

The broader discovery, signing, dependency, storage, update, revocation, and
governance roadmap is maintained in the
[package-manager branch plan](package-manager-branch.md). This document remains
the content contract for teaching repositories and learning modules.

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

An optional **ML Package** profile may additionally declare:

- a problem statement, intended epidemiologic use, population, outcome, and
  excluded uses;
- schemas, data dictionaries, synthetic or disclosure-cleared training and
  validation datasets, and deterministic split definitions;
- typed preprocessing, training, validation, scoring, and explanation plans;
- expected aggregate metrics with tolerances and independent validation
  notebooks;
- model cards, fairness/subgroup assessments, privacy classifications, and
  reproducibility receipts; and
- optional portable model artifacts whose format and operators are allowlisted
  by the installed Epi Info AI kernel.

Users should be able to author, validate, export, publish, inspect, and import
this profile through the same package workflow. A public repository distributes
an immutable teaching revision; an encrypted `.epiax` may transport a private
working copy. Import must preview provenance, license, artifact inventory,
storage, privacy classification, required kernel capabilities, and compatibility
before installation. Importing never trains, validates, scores, or runs a
program automatically.

It is a curriculum and artifact distribution boundary, not a plugin boundary.
HTML, JavaScript, native executables, macros, and arbitrary network callbacks are
not teaching artifacts and must never run during discovery or installation.
Runbook completion evidence is declarative package data: selectors and check
kinds pass the project-package validator, observed values are never included in
the emitted feedback event, and the runbook receives no arbitrary script hook.
ML packages also reject serialized Python objects, credentials, arbitrary model
operators, and bundled runtimes. Versioned TypeScript/WASM kernels belong to the
application; a package can request an allowlisted capability but cannot add one.

## Curated signed learning modules

The ML-for-epidemiologists curriculum may be distributed as an importable
**Epi Info AI Learning Module**, a curated profile of this teaching-package
contract. It behaves like a software product from the learner's perspective—one
reviewed package can be discovered, imported, updated, used offline, and
removed—but it remains a declarative content package rather than an executable
plugin.

The trust envelope must cover the canonical manifest plus the digest and length
of every artifact. A separately signed catalog pins the allowed package ID,
publisher identity, version, immutable source revision, package digest,
compatibility range, publication time, and revocation state. The import preview
reports one of: verified and curated, verified but not curated, untrusted,
expired, revoked, or invalid. It also displays who signed the package and which
catalog authorized it. Files are staged, hashed, signature-checked, schema-
checked, and capability-checked before an atomic install. Offline verification
uses a previously approved signed catalog snapshot and records its age.

A cryptographically valid package is not automatically safe or executable.
Signatures prove origin and byte integrity; curation records review; neither
grants new application capabilities. The package may declare a minimum/maximum
Epi Info AI version and required allowlisted kernel capabilities. Missing
capabilities produce a visible compatibility failure. TypeScript, WASM, native
binaries, dynamic libraries, Python pickles, macros, and remote callbacks remain
prohibited inside the learning module.

If a curriculum requires a new ML algorithm, its reviewed TypeScript/WASM kernel
ships through the normal administrator-controlled Epi Info AI software release,
with its own source review, build provenance, dependency inventory, tests, and
rollback path. Only after that kernel is installed may the signed learning
module invoke its typed capability. This keeps project/lesson import separate
from software installation and supports restrictive or disconnected networks.

### Release-to-package trust chain

Every downloadable Epi Info AI release must carry or cryptographically bind the
exact curated catalog snapshot that it trusts. This is a catalog of approved
packages, not a requirement to place every package byte inside the application
download. An approved GitLab, GitHub, internal web, or removable-media mirror
may serve the bytes because identity comes from the signed metadata and content
digest rather than the download URL.

Use four explicit records:

1. **Application release manifest** — identifies the Epi Info AI version and
   build, trusted-root version, curated-catalog version/digest, supported package
   schema versions, and installed kernel capabilities.
2. **Curated catalog snapshot** — lists every approved package ID and immutable
   version with its manifest digest/size, publisher, compatibility constraints,
   channel, review status, publication/expiry times, and revocation or withdrawal
   state. The complete snapshot is signed and versioned for offline use.
3. **Package manifest** — inventories every package artifact and dependency by
   media type, byte length, digest, role, license, privacy classification, and
   provenance. It is signed by the publisher and bound to the catalog entry.
4. **Installed-module lockfile** — records the exact catalog, package, manifest,
   artifact, dependency, and kernel-capability versions/digests actually
   installed. Reopening offline uses this record; updates never silently change
   it.

This makes the trust path auditable:

```text
Epi Info AI release
  -> signed curated catalog snapshot
    -> signed package manifest
      -> content-addressed artifacts
        -> local installed-module lockfile and install receipt
```

### Package-manager security baseline

Adopt proven patterns instead of inventing a single signing flag:

- Follow [The Update Framework](https://theupdateframework.github.io/specification/draft/)
  model for separated root, targets, snapshot, and timestamp responsibilities;
  signature thresholds; metadata expiry; consistent snapshots; key rotation;
  delegated publisher namespaces; and rollback/freeze protection. The initial
  implementation may be “TUF-inspired,” but must not claim TUF compliance until
  its metadata and client behavior pass an appropriate conformance review.
- Model each artifact descriptor after the
  [OCI content descriptor](https://github.com/opencontainers/image-spec/blob/main/descriptor.md):
  media type, digest, and byte size are mandatory and verified before content is
  parsed. This does not require deploying container images or an OCI registry.
- Allow packaged verification evidence following the
  [Sigstore bundle](https://docs.sigstore.dev/about/bundle/) concept so a
  signature, signer certificate or public-key reference, timestamp, and optional
  transparency-log proof can travel with a package and be checked offline.
  Public transparency is supplemental evidence; the Epi Info AI trusted catalog
  remains the authorization decision.
- Generate provenance for application/kernel builds using the
  [SLSA provenance model](https://slsa.dev/spec/v1.2/) and accept only reviewed
  signer/builder identities. Content-only lesson packages record analogous source
  revision and CI validation receipts without pretending they are compiled
  software builds.
- Include an [SPDX](https://spdx.github.io/spdx-spec/v3.0.1/scope/) SBOM for
  software kernels and evaluate the
  [CycloneDX ML-BOM](https://www.cyclonedx.org/capabilities/mlbom/) profile for
  model and dataset lineage, dependencies, licenses, limitations, and model-card
  references.
- Preserve exact resolved versions and integrity digests in the local lockfile,
  following the reproducibility purpose of established package-manager lockfiles.

### Required client behavior

The client must reject unknown critical fields, malformed canonical metadata,
hash/length mismatches, invalid signature thresholds, expired required metadata,
version rollback, revoked packages, incompatible kernels, undeclared artifacts,
dependency cycles, and size/quota violations. Downloads are staged and verified
before an atomic install. Existing verified installations continue to work
offline unless local policy marks a package blocked; a failed update never
damages the installed revision. Catalog refresh, install, update, downgrade,
removal, mirror selection, and override decisions produce durable receipts.

Trust roots ship with the application and rotate through threshold-authorized
root metadata. Ordinary project files, package authors, Git branches, Git tags,
mirrors, and CI jobs cannot add a trust root. Emergency revocation and catalog
expiry must have a documented restrictive-network process using a newly signed
offline catalog snapshot.

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
