# Project migration examples

[`epi-info-projects.json`](epi-info-projects.json) is the checksummed catalog
shown by **File > Import Example Project...**. It provides three complete,
browser-ready demonstration projects maintained from the CDC Epi Info AI GitLab
group:

- [`foodborne-outbreak-investigation.epia.json`](foodborne-outbreak-investigation.epia.json)
  contains 96 synthetic records, saved foodborne command examples, and a
  learner-operated investigation runbook;
- [`space-time-cluster-detection.epia.json`](space-time-cluster-detection.epia.json)
  contains 30 synthetic events, the reproducible cluster command tour, and a
  learner-operated mapping runbook; and
- [`../recordlink/recordlink-synthetic-project.epia.json`](../recordlink/recordlink-synthetic-project.epia.json)
  contains both synthetic sources, known truth links, and the governed
  RECORDLINK workflow and runbook.

Run `node --experimental-strip-types wasm/scripts/generate-example-projects.mjs`
from the repository root after changing the source CSV or program catalogs. The
generator rebuilds the first two packages and all catalog sizes and hashes.
Normal CI validates every package against the Project Package V2 contract.
The independently governed repositories copy
[`validate-example-project-package.mjs`](../../../scripts/validate-example-project-package.mjs)
as `validate-project.mjs` and
[`example-project.gitlab-ci.yml`](example-project.gitlab-ci.yml) as
`.gitlab-ci.yml`, giving every teaching-project change the same minimum CI gate.

[`sample-project.epia.json`](sample-project.epia.json) is a reproducible,
browser-native conversion of the Community Edition `Sample.mdb`. It preserves
18 forms, 26 pages, 417 legacy fields, 22 code tables, and the saved
`Statistics` Classic Analysis program.

Use **File > Open Project...** to load it. Complete legacy metadata and
unsupported-command findings remain in the package for compatibility work.
Regeneration and format details are documented in
[`project-package-v2.md`](../../../docs/design/project-package-v2.md).

SHA-256:
`e23dda745ff351b153158ecb920785933aaf077355cbcad9aa8e84e54cd693b`.
