# Example project repository contract

Epi Info AI can import complete teaching projects from a small JSON catalog.
The first catalog is maintained in the CDC `epi-info-ai` GitLab group and is
mirrored into every static-site build so a live demonstration does not depend
on API credentials, cross-origin policy, or GitLab availability.

## User boundary

**File > Import Example Project...** retrieves the visible catalog and lists
the project title, purpose, package size, abbreviated SHA-256 digest, and source
repository. Selecting **Import** performs these steps in order:

1. fetch the declared `.epia` archive or legacy `.epia.json` file;
2. require the exact declared byte length and SHA-256 digest;
3. pass the file through the normal Project Package V2 validator;
4. save the active project to Recent Projects and close it safely;
5. for a binary archive, validate and restore every declared map asset to OPFS;
6. activate the imported project, including its data, saved programs, map
   assets, and map-layer definitions; and
7. emit the normal project-activation event so stale analysis and map output is
   cleared.

Import never executes a saved program. The analyst must inspect and run it.
Project-scoped runbooks are validated package content and are registered only
while their project is active. A runbook may highlight a control and observe a
learner's click or change to advance, but it does not perform the substantive
action. Orientation and review steps require the learner to acknowledge Next.

Catalog URLs are limited to the application's own origin, CDC GitLab, and the
GitHub raw-content host. Project packages are bounded at 150 MiB. The current
catalog contains synthetic Foodborne Investigation, Space-Time Cluster
Detection, and Patient Record Linkage projects.

## Training publication workflow

An instructor can develop a project in its own repository under the GitLab
group, run its dataset, program, browser, and statistical validation in CI, and
publish an immutable `.epia` archive or `.epia.json` release. Binary `.epia`
archives are required when project-owned map bytes must travel with the data,
programs, and runbooks. A reviewed catalog change then adds
the release metadata and digest. Static-site CI mirrors accepted packages for a
predictable classroom and conference experience while preserving a link to the
governed source.

## Relationship to installable packages

The same release discipline can later support application packages, but the
trust boundary must remain explicit. Project catalogs distribute inert project
content. They cannot install JavaScript, WebAssembly, Workers, or other
executable modules. A future package registry requires its own compatibility
manifest, signed releases, permission declarations, dependency review,
isolated execution boundary, rollback support, and CI evidence before an
administrator enables a package.
