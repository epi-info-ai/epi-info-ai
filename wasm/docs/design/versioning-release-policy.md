# Versioning and release policy

Status: adopted for the Epi Info AI `0.2` release line

Epi Info AI uses Semantic Versioning while the application remains a prototype.
Before `1.0.0`, a minor version identifies an integrated capability milestone and
a patch version identifies compatible corrections to that milestone. A future
`1.0.0` requires an explicit stability and compatibility decision; command or
scientific parity is never implied by an application version alone.

## Authority

- `package.json` is the authoritative application version.
- The visible header, README deployment labels, production build manifest, and
  browser/build assertions must match that version in a release commit.
- GitLab and GitHub Pages must publish the same Git commit. A successful build
  from different commits is not deployment parity.
- Release tags use `vMAJOR.MINOR.PATCH` after both Pages deployments are verified.

## Independent versions

Application releases do not silently change typed contracts. AST, project,
package, GIS, algorithm, receipt, and validation-fixture versions remain
independent and change only when their own compatibility contract changes.
Capability-package compatibility ranges must explicitly include the intended
application release line.

## Current milestone

`0.2.0` integrates the governed GIS reference-layer boundary, consolidated
project documentation, and the bounded Check Code editor/runtime and teaching
examples. It remains a prototype release with the parity and validation gaps
recorded in `COMMAND_SET.md` and the compatibility registries.
