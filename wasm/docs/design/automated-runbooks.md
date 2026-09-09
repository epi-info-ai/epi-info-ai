# Automated UI runbooks

Status: new-branch V0.1 browser candidate (2026-09-09).

Automated runbooks are optional, declarative walkthroughs launched from the
application Help menu. They preserve the learned Epi Info UI and point to real
controls rather than replacing the workflow with a separate wizard.

The first runbook guides a user through a dataset-matched foodborne Program
Editor example: open the program dialog, choose and load an example, verify the
visible source, explicitly run it, and inspect command history. The host may
navigate to a module. Loading data, loading program source, and executing an
analysis require visible user actions.

The V0.1 contract provides:

- versioned runbook and step definitions;
- stable CSS-selector targets checked by automated tests;
- a Help > Automated Runbooks entry and replayable library;
- visible spotlight, step count, instructions, Back, Next, Finish, and Stop;
- action-aware progression after the expected click or selection; and
- an always-available Next control when an equivalent legacy path has already
  completed the requested action or the browser does not expose its event; and
- a screen-reader live region and responsive coach panel.

Open gates include keyboard focus return and trapping review, reduced-motion
handling, persistence of completion state, branch/resume steps, result-based
verification, coverage for every page, localization, and a capability-limited
plugin contribution API. A runbook must never receive unrestricted project data
or execute a consequential action merely because a step became active.
