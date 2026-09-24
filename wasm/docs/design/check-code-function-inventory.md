# Check Code function parity inventory

Status: source-reviewed inventory, 2026-09-23. This document covers functions
dispatched by the retained Epi Info 7 Enter interpreter. It does not turn source
presence into a parity claim: every executable candidate still needs desktop
differential and experienced-user evidence.

The machine-readable companion is
[`check-code-function-inventory.ts`](../../app/check-code/check-code-function-inventory.ts).
Phase 0 verifies that its executable set exactly matches the current typed
parser allowlist.

The browser adaptation for `CURRENTUSER()` and its explicitly non-authenticating
**Local demo sign-in** are specified in
[`browser-identity.md`](browser-identity.md).

## Baseline and progress

| Measure | Count |
|---|---:|
| Retained Enter dispatcher functions | 51 |
| Typed executable candidates | 45 |
| Remaining dispositions | 6 |

The 51-name floor comes from `Rule_FunctionCall` in retained
`Epi.Core.EnterInterpreter/Rules/EpiFunctions.cs`, checked against the Check
Code context menu list and individual rule classes. The source contains other
rule files that are not part of this dispatcher; those are called out below
rather than silently counted.

## Disposition by implementation boundary

| Status | Functions | Next gate |
|---|---|---|
| Executable candidate (45) | `ABS`, `COS`, `CURRENTUSER`, `DAY`, `DAYS`, `EPIWEEK`, `EXP`, `FINDTEXT`, `FORMAT`, `HOUR`, `HOURS`, `ISUNIQUE`, `LINEBREAK`, `LN`, `LOG`, `MINUTE`, `MINUTES`, `MONTH`, `MONTHS`, `NUMTODATE`, `NUMTOTIME`, `PFROMZ`, `RECORDCOUNT`, `RND`, `ROUND`, `SECOND`, `SECONDS`, `SIN`, `SQRT`, `STEP`, `STRLEN`, `SUBSTRING`, `SYSALTITUDE`, `SYSLATITUDE`, `SYSLONGITUDE`, `SYSTEMDATE`, `SYSTEMTIME`, `TAN`, `TRUNC`, `TXTTODATE`, `TXTTONUM`, `UPPERCASE`, `YEAR`, `YEARS`, `ZSCORE` | Desktop differential and experienced-user review; see REG-0113 through REG-0125. |
| Shelved device new branch (1) | `SYSBARCODE` | The retained rule always returns missing. A useful scanner needs explicit permission, supported formats, manual fallback, provenance, accessibility, and validation. |
| Excluded desktop authority (3) | `ENVIRON`, `EXISTS`, `FILEDATE` | No ambient environment or filesystem access. Use typed project assets or explicit user file grants outside Check Code. |
| Retained source placeholder (2) | `GETCOORDINATES`, `SENDSMS` | The inspected rules only return the absolute value of a numeric argument. Coordinate acquisition already has a governed `GEOCODE`/map workflow; messaging would be a labeled new branch. |

## Important source distinctions

- `DATEPART` and `DATEDIFF` rule files exist, but the retained Enter function
  dispatcher does not route to them. They are evidence to investigate, not two
  additional parity-floor functions.
- `AUTOSEARCH` has both statement and helper source. The browser candidate is
  tracked as a statement workflow, not counted again as a scalar function.
- `GROUPROWINDEX`, `LAGVALUE`, `POISSONLCL`, and `POISSONUCL` occur in other
  interpreter contexts. They are not part of this Enter Check Code inventory.
- The retained Analysis `PFROMZ` implementation reports the function as no
  longer supported. The browser candidate is therefore explicitly scoped to
  retained Enter Check Code behavior; it does not revive the Analysis function.
- System/device names found in source are not ordinary deterministic values.
  Permission denial and unavailable hardware must remain normal, visible
  outcomes rather than fabricated data.

## Ordered implementation batches

1. `ZSCORE` is a governed executable candidate with pinned retained reference
   assets, a fixed oracle fixture, and an independent-formula Validation Lab.
   Desktop differentials and specialist scientific approval remain open.
2. `SYSBARCODE` remains a shelved governed new branch. The desktop placeholder
   and excluded authority are not shortcuts into a camera/scanner adapter.
