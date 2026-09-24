export const CHECK_CODE_IDENTITY_PREFERENCE_KEY = "epi-info-ai.operator-identity.v1";
export const CHECK_CODE_IDENTITY_CHANGED_EVENT = "epi-info-ai-identity-changed";

export type CheckCodeIdentitySource = "authenticated-account" | "local-profile";

export interface CheckCodeIdentityReading {
  identity: string | null;
  source: CheckCodeIdentitySource | "unavailable";
}

interface StoredOperatorIdentity {
  schemaVersion: 1;
  displayName: string;
}

export function normalizeOperatorIdentity(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length > 100) throw new RangeError("Operator identity must be 100 characters or fewer.");
  return normalized;
}

export function readLocalOperatorIdentity(storage: Storage = localStorage): CheckCodeIdentityReading {
  try {
    const parsed = JSON.parse(storage.getItem(CHECK_CODE_IDENTITY_PREFERENCE_KEY) ?? "null") as Partial<StoredOperatorIdentity> | null;
    if (parsed?.schemaVersion !== 1 || typeof parsed.displayName !== "string") return { identity: null, source: "unavailable" };
    const identity = normalizeOperatorIdentity(parsed.displayName);
    return identity ? { identity, source: "local-profile" } : { identity: null, source: "unavailable" };
  } catch {
    return { identity: null, source: "unavailable" };
  }
}

export function writeLocalOperatorIdentity(value: string, storage: Storage = localStorage): CheckCodeIdentityReading {
  const identity = normalizeOperatorIdentity(value);
  if (!identity) {
    storage.removeItem(CHECK_CODE_IDENTITY_PREFERENCE_KEY);
    return { identity: null, source: "unavailable" };
  }
  const stored: StoredOperatorIdentity = { schemaVersion: 1, displayName: identity };
  storage.setItem(CHECK_CODE_IDENTITY_PREFERENCE_KEY, JSON.stringify(stored));
  return { identity, source: "local-profile" };
}
