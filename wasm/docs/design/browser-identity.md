# Browser identity and `CURRENTUSER()`

**Status:** browser-adapted candidate with a local demo sign-in placeholder
**Last reviewed:** 2026-09-23

## Decision

The retained desktop `CURRENTUSER()` rule reads the active Windows account.
Ordinary browser code cannot read the signed-in Windows, macOS, or Linux account
name, and Epi Info AI must not infer an identity from the user agent, device
name, project author, or other browser metadata.

Epi Info AI therefore uses an explicit application-identity contract:

1. A future authenticated organizational or Supabase account may supply the
   current identity with source `authenticated-account`.
2. Until that integration is complete, the visible **Log in** control in the
   application header accepts a display name and supplies it with source
   `local-profile`.
3. If neither source is available, `CURRENTUSER()` returns missing (`null`). It
   does not invent `Local user`, a device name, or an operating-system account.

The current header control is deliberately titled **Local demo sign-in**. It is
a functional identity placeholder, not authentication and not proof that the
person entering the name owns that identity.

## User workflow

1. Select **Log in** beside the Epi Info AI header.
2. Enter a display name and select **Log in locally**.
3. The header shows that display name. Check Code `CURRENTUSER()` returns the
   same normalized value.
4. Select the displayed name and then **Sign out** to remove the local identity.

The same value can be reviewed or changed under **Tools > Options > Operator
identity**. Whitespace is normalized and names are limited to 100 characters.

## Storage, privacy, and audit behavior

| Concern | Current contract |
|---|---|
| Storage | Browser `localStorage`, schema `epi-info-ai.operator-identity.v1` |
| Scope | The current browser profile and origin |
| Project/package export | Not included automatically |
| Patient or record data | Never used to derive identity |
| Check Code syntax | `CURRENTUSER()` |
| No configured identity | Returns missing |
| Audit receipt | Records function name, source, and availability only |
| Audit exclusion | The display-name value is not copied into the general project audit entry |
| Operating-system identity | Never read or inferred |

Project code can explicitly assign the returned value to a field or variable;
that assignment follows the ordinary project data and privacy rules. The audit
exclusion above does not erase a value that project authors deliberately store.

## Teaching example

The foodborne Check Code expression tour declares `ReviewOperator` and runs:

```text
ASSIGN ReviewOperator = CURRENTUSER()
```

Before demonstrating it, the instructor should use **Log in** and explain that
the displayed identity is local demo context. Running the same event while
signed out demonstrates the governed missing-value behavior.

## Future authenticated integration

The runtime host already distinguishes `authenticated-account`, `local-profile`,
and `unavailable`. A later authentication adapter can prefer a validated
application account without changing Check Code syntax or letting the
interpreter access tokens. Required follow-up work includes session-change
handling, logout invalidation, privacy and accessibility review, multi-user
tests, Supabase/organization identity mapping, and additional-browser evidence.

Authenticated integration must not silently fall back to an old cached profile
when an authentication failure should be visible. It must also keep access
tokens outside the Check Code runtime and project exports.

## Evidence

- Retained source: `Rule_CurrentUser.cs` reads `WindowsIdentity.GetCurrent().Name`.
- Typed contract and persistence: `app/check-code/check-code-identity.ts`.
- Header placeholder: `app/check-code/browser-identity.ts`.
- Runtime and audit adapter: `app/check-code/check-code-runtime.ts` and
  `demo/form-data.ts`.
- Automated evidence: Phase 0 parser/runtime/storage fixtures and the Chromium
  local sign-in, persistence, and sign-out workflow.

This decision is also tracked as REG-0123 in the
[legacy capability register](legacy-capability-register.md).
