import { parseProjectSnapshotJson, type ProjectSnapshotV1 } from "../contracts/core.ts";

export interface LoadedProjectSnapshot {
  snapshot: ProjectSnapshotV1 | null;
  warning: string;
}

export function loadProjectSnapshot(
  projectStateKey: string,
  recoveryKey: string,
): LoadedProjectSnapshot {
  let raw: string | null;
  try {
    raw = localStorage.getItem(projectStateKey);
  } catch {
    return { snapshot: null, warning: "Browser project storage is unavailable; this working copy will not persist." };
  }
  if (!raw) return { snapshot: null, warning: "" };
  try {
    return { snapshot: parseProjectSnapshotJson(raw), warning: "" };
  } catch (error) {
    let preserved = false;
    try {
      localStorage.setItem(recoveryKey, raw);
      preserved = true;
    } catch {
      // The original value remains untouched until a later explicit save attempt.
    }
    const detail = error instanceof Error ? error.message : "unknown validation error";
    const recovery = preserved
      ? `Its original JSON was preserved under ${recoveryKey}`
      : "Its original storage value remains in place, but a separate recovery copy could not be created";
    return {
      snapshot: null,
      warning: `The saved project could not be opened (${detail}). ${recovery}; legacy form data was loaded instead.`,
    };
  }
}
