import {
  validateProjectSnapshot,
  type HostedProjectReference,
  type ProjectSnapshotV1,
} from "../app/contracts/core.ts";

const CONFIG_KEY = "epi-info-ai.supabase-config.v1";

interface ProviderAvailability {
  email?: boolean;
  github?: boolean;
}

interface SupabaseConfig {
  url: string;
  publishableKey: string;
  providers?: ProviderAvailability;
}

interface SupabaseUser {
  id: string;
  email?: string;
}

interface SupabaseSession {
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number;
  token_type?: string;
  user: SupabaseUser;
}

interface HostedProjectSummary {
  id: string;
  name: string;
  revision: number;
  updated_at: string;
}

interface HostedProject extends HostedProjectSummary {
  snapshot: unknown;
}

interface SyncedProjectReference extends HostedProjectReference {
  syncedAt: string;
}

interface InitializeSupabaseSyncOptions {
  getSnapshot: () => ProjectSnapshotV1;
  markSynced: (remote: SyncedProjectReference) => void;
  applySnapshot: (snapshot: ProjectSnapshotV1, remote: SyncedProjectReference) => void;
  testConnection: (url: string, publishableKey: string) => Promise<SupabaseConfig>;
}

class SupabaseApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "SupabaseApiError";
    this.status = status;
    if (code !== undefined) this.code = code;
  }
}

let session: SupabaseSession | null = null;
let githubAvailable = false;

function requiredElement<T extends Element>(selector: string): T {
  const value = document.querySelector<T>(selector);
  if (!value) throw new Error(`Required interface element is missing: ${selector}`);
  return value;
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} is not an object.`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} is missing or invalid.`);
  return value;
}

function revisionValue(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} is missing or invalid.`);
  }
  return value;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "An unexpected synchronization error occurred.";
}

function loadConfig(): Partial<SupabaseConfig> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
    const config = objectValue(value, "Saved Supabase configuration");
    const result: Partial<SupabaseConfig> = {};
    if (typeof config.url === "string") result.url = config.url;
    if (typeof config.publishableKey === "string") result.publishableKey = config.publishableKey;
    if (typeof config.providers === "object" && config.providers !== null && !Array.isArray(config.providers)) {
      const providers = config.providers as Record<string, unknown>;
      result.providers = {
        email: providers.email === true,
        github: providers.github === true,
      };
    }
    return result;
  } catch {
    return {};
  }
}

function saveConfig(config: SupabaseConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function status(message: string): void {
  requiredElement<HTMLElement>("#project-storage-status").textContent = message;
}

function formConfig(): SupabaseConfig {
  return {
    url: requiredElement<HTMLInputElement>("#storage-supabase-url").value.trim().replace(/\/$/, ""),
    publishableKey: requiredElement<HTMLInputElement>("#storage-supabase-key").value.trim(),
  };
}

function setProviderAvailability(config: Partial<SupabaseConfig> = {}): void {
  githubAvailable = config.providers?.github === true;
  const button = requiredElement<HTMLButtonElement>("#storage-sign-in-github");
  const providerStatus = requiredElement<HTMLElement>("#storage-github-status");
  button.disabled = Boolean(session) || !githubAvailable;
  providerStatus.textContent = githubAvailable
    ? "GitHub sign-in is enabled for this Supabase project."
    : config.providers
      ? "GitHub is not enabled in Supabase Authentication providers."
      : "Test the connection to check whether GitHub sign-in is enabled.";
}

function apiErrorMessage(payload: unknown): { message?: string; code?: string } {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return {};
  const value = payload as Record<string, unknown>;
  const candidate = value.message ?? value.msg ?? value.error_description ?? value.hint;
  const result: { message?: string; code?: string } = {};
  if (typeof candidate === "string") result.message = candidate;
  if (typeof value.code === "string") result.code = value.code;
  return result;
}

async function apiRequest(
  config: SupabaseConfig,
  path: string,
  options: RequestInit = {},
  authenticated = false,
): Promise<unknown> {
  const headers = new Headers(options.headers);
  headers.set("apikey", config.publishableKey);
  if (authenticated) {
    if (!session?.access_token) throw new Error("Sign in to Supabase first.");
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${config.url}${path}`, { ...options, headers, cache: "no-store" });
  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    const detail = apiErrorMessage(payload);
    throw new SupabaseApiError(
      detail.message || `Supabase request failed (HTTP ${response.status}).`,
      response.status,
      detail.code,
    );
  }
  return payload;
}

function parseUser(value: unknown, label = "Supabase user"): SupabaseUser {
  const user = objectValue(value, label);
  const result: SupabaseUser = { id: stringValue(user.id, `${label} ID`) };
  if (typeof user.email === "string") result.email = user.email;
  return result;
}

function parseSession(value: unknown, label: string): SupabaseSession {
  const source = objectValue(value, label);
  const result: SupabaseSession = {
    access_token: stringValue(source.access_token, `${label} access token`),
    user: parseUser(source.user, `${label} user`),
  };
  if (typeof source.refresh_token === "string" || source.refresh_token === null) result.refresh_token = source.refresh_token;
  if (typeof source.expires_in === "number" && Number.isFinite(source.expires_in)) result.expires_in = source.expires_in;
  if (typeof source.token_type === "string") result.token_type = source.token_type;
  return result;
}

function parseHostedSummary(value: unknown, label: string): HostedProjectSummary {
  const project = objectValue(value, label);
  return {
    id: stringValue(project.id, `${label} ID`),
    name: stringValue(project.name, `${label} name`),
    revision: revisionValue(project.revision, `${label} revision`),
    updated_at: stringValue(project.updated_at, `${label} update time`),
  };
}

function parseHostedSummaries(value: unknown): HostedProjectSummary[] {
  if (!Array.isArray(value)) throw new Error("Supabase returned an invalid hosted-project list.");
  return value.map((project, index) => parseHostedSummary(project, `Hosted project ${index + 1}`));
}

function parseHostedProjects(value: unknown): HostedProject[] {
  if (!Array.isArray(value)) throw new Error("Supabase returned an invalid hosted-project response.");
  return value.map((item, index) => {
    const source = objectValue(item, `Hosted project ${index + 1}`);
    return { ...parseHostedSummary(source, `Hosted project ${index + 1}`), snapshot: source.snapshot };
  });
}

function setSignedInState(signedIn: boolean): void {
  requiredElement<HTMLButtonElement>("#storage-sign-in").disabled = signedIn;
  requiredElement<HTMLButtonElement>("#storage-sign-up").disabled = signedIn;
  requiredElement<HTMLButtonElement>("#storage-sign-out").disabled = !signedIn;
  requiredElement<HTMLButtonElement>("#storage-sign-in-github").disabled = signedIn || !githubAvailable;
  requiredElement<HTMLButtonElement>("#storage-upload").disabled = true;
  requiredElement<HTMLButtonElement>("#storage-download").disabled = true;
}

function startGitHubSignIn(config: SupabaseConfig): void {
  if (!config.providers?.github) {
    throw new Error("GitHub sign-in is not enabled for this Supabase project. Enable GitHub under Authentication > Sign In / Providers, then test the connection again.");
  }
  saveConfig(config);
  const redirectTo = `${window.location.origin}${window.location.pathname}`;
  const authorizeUrl = new URL("/auth/v1/authorize", config.url);
  authorizeUrl.searchParams.set("provider", "github");
  authorizeUrl.searchParams.set("redirect_to", redirectTo);
  window.location.assign(authorizeUrl.href);
}

async function restoreOAuthSession(): Promise<void> {
  if (!window.location.hash) return;
  const callback = new URLSearchParams(window.location.hash.slice(1));
  const oauthError = callback.get("error_description") || callback.get("error");
  if (oauthError) {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    status(`GitHub sign-in failed: ${oauthError}`);
    return;
  }
  const accessToken = callback.get("access_token");
  if (!accessToken) return;
  history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  const saved = loadConfig();
  if (!saved.url || !saved.publishableKey) {
    status("GitHub sign-in returned, but the saved Supabase connection is missing.");
    return;
  }
  const config: SupabaseConfig = { url: saved.url, publishableKey: saved.publishableKey };
  if (saved.providers) config.providers = saved.providers;
  const oauthSession: SupabaseSession = {
    access_token: accessToken,
    user: { id: "pending" },
  };
  const refreshToken = callback.get("refresh_token");
  if (refreshToken !== null) oauthSession.refresh_token = refreshToken;
  const expiresIn = Number(callback.get("expires_in") || 0);
  if (Number.isFinite(expiresIn)) oauthSession.expires_in = expiresIn;
  oauthSession.token_type = callback.get("token_type") || "bearer";
  session = oauthSession;
  try {
    session.user = parseUser(await apiRequest(config, "/auth/v1/user", {}, true));
    setProviderAvailability(config);
    setSignedInState(true);
    status(`Signed in with GitHub as ${session.user.email || "a Supabase user"}.`);
  } catch (error) {
    session = null;
    setSignedInState(false);
    status(`GitHub sign-in could not be completed: ${messageOf(error)}`);
  }
}

async function refreshHostedProjects(config: SupabaseConfig, preferredId = ""): Promise<HostedProjectSummary[]> {
  const select = requiredElement<HTMLSelectElement>("#storage-hosted-project");
  try {
    const projects = parseHostedSummaries(await apiRequest(
      config,
      "/rest/v1/epi_projects?select=id,name,revision,updated_at&order=updated_at.desc",
      {},
      true,
    ));
    select.replaceChildren(new Option("No hosted project selected", ""), ...projects.map((project) => (
      new Option(`${project.name} (revision ${project.revision})`, project.id)
    )));
    if (preferredId && projects.some((project) => project.id === preferredId)) select.value = preferredId;
    requiredElement<HTMLButtonElement>("#storage-upload").disabled = false;
    requiredElement<HTMLButtonElement>("#storage-download").disabled = !select.value;
    return projects;
  } catch (error) {
    select.replaceChildren(new Option("Run the Supabase setup SQL first", ""));
    if (error instanceof SupabaseApiError && (error.status === 404 || error.code === "PGRST205")) {
      throw new Error("Connected and signed in, but epi_projects is not installed. Click Copy Setup SQL and run it in the Supabase SQL Editor.");
    }
    throw error;
  }
}

async function signIn(config: SupabaseConfig): Promise<SupabaseSession> {
  const email = requiredElement<HTMLInputElement>("#storage-auth-email").value.trim();
  const password = requiredElement<HTMLInputElement>("#storage-auth-password").value;
  if (!email || !password) throw new Error("Enter the Supabase account email and password.");
  session = parseSession(await apiRequest(config, "/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  }), "Supabase sign-in response");
  setSignedInState(true);
  return session;
}

async function signUp(config: SupabaseConfig): Promise<SupabaseSession | null> {
  const email = requiredElement<HTMLInputElement>("#storage-auth-email").value.trim();
  const password = requiredElement<HTMLInputElement>("#storage-auth-password").value;
  if (!email || !password) throw new Error("Enter an email and a password of at least six characters.");
  const value = await apiRequest(config, "/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const source = objectValue(value, "Supabase sign-up response");
  if (typeof source.access_token !== "string") return null;
  session = parseSession(source, "Supabase sign-up response");
  setSignedInState(true);
  return session;
}

async function getHostedProject(config: SupabaseConfig, id: string): Promise<HostedProject | null> {
  const rows = parseHostedProjects(await apiRequest(
    config,
    `/rest/v1/epi_projects?id=eq.${encodeURIComponent(id)}&select=id,name,snapshot,revision,updated_at`,
    {},
    true,
  ));
  return rows[0] ?? null;
}

async function uploadProject(
  config: SupabaseConfig,
  getSnapshot: () => ProjectSnapshotV1,
  markSynced: (remote: SyncedProjectReference) => void,
): Promise<{ saved: HostedProjectSummary; formCount: number; recordCount: number }> {
  const local = validateProjectSnapshot(getSnapshot());
  const tracked = local.remote ?? null;
  const remoteId = tracked?.id || crypto.randomUUID();
  const hosted = await getHostedProject(config, remoteId);
  if (hosted && hosted.revision !== tracked?.revision) {
    throw new Error(`The hosted copy is revision ${hosted.revision}, but this browser last synchronized revision ${tracked?.revision || 0}. Download it before uploading.`);
  }

  const snapshot = structuredClone(local);
  delete snapshot.remote;
  snapshot.storage = { type: "supabase" };
  const revision = hosted ? hosted.revision + 1 : 1;
  let rows: HostedProjectSummary[];
  if (hosted) {
    rows = parseHostedSummaries(await apiRequest(
      config,
      `/rest/v1/epi_projects?id=eq.${encodeURIComponent(remoteId)}&revision=eq.${hosted.revision}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ name: snapshot.name, snapshot, revision, updated_at: new Date().toISOString() }),
      },
      true,
    ));
    if (!rows.length) throw new Error("The hosted project changed during upload. Download it and review the changes first.");
  } else {
    if (!session) throw new Error("Sign in to Supabase first.");
    rows = parseHostedSummaries(await apiRequest(config, "/rest/v1/epi_projects", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ id: remoteId, owner_id: session.user.id, name: snapshot.name, snapshot, revision }),
    }, true));
  }
  const saved = rows[0];
  if (!saved) throw new Error("Supabase did not return the synchronized project.");
  markSynced({ id: saved.id, revision: saved.revision, syncedAt: saved.updated_at });
  return {
    saved,
    formCount: snapshot.forms.length,
    recordCount: snapshot.forms.reduce((total, form) => total + form.records.length, 0),
  };
}

export function initializeSupabaseSync({
  getSnapshot,
  markSynced,
  applySnapshot,
  testConnection,
}: InitializeSupabaseSyncOptions): void {
  const dialog = requiredElement<HTMLDialogElement>("#project-storage-dialog");
  const hostedSelect = requiredElement<HTMLSelectElement>("#storage-hosted-project");

  requiredElement<HTMLButtonElement>("#project-storage").addEventListener("click", () => {
    const config = loadConfig();
    const snapshot = validateProjectSnapshot(getSnapshot());
    requiredElement<HTMLElement>("#storage-current-project").textContent = snapshot.name;
    requiredElement<HTMLInputElement>("#storage-supabase-url").value = config.url || "";
    requiredElement<HTMLInputElement>("#storage-supabase-key").value = config.publishableKey || "";
    setProviderAvailability(config);
    hostedSelect.replaceChildren(new Option(session ? "Loading hosted projects..." : "Sign in to list hosted projects", ""));
    setSignedInState(Boolean(session));
    status(session ? `Signed in as ${session.user.email || "a Supabase user"}. Refreshing hosted projects...` : "Not signed in.");
    dialog.showModal();
    if (session && config.url && config.publishableKey) {
      const completeConfig: SupabaseConfig = { url: config.url, publishableKey: config.publishableKey };
      if (config.providers) completeConfig.providers = config.providers;
      refreshHostedProjects(completeConfig, snapshot.remote?.id).catch((error: unknown) => status(messageOf(error)));
    }
  });

  for (const button of document.querySelectorAll<HTMLElement>("[data-close-project-storage]")) {
    button.addEventListener("click", () => dialog.close("close"));
  }

  requiredElement<HTMLButtonElement>("#storage-test-connection").addEventListener("click", async () => {
    try {
      const entered = formConfig();
      const config = await testConnection(entered.url, entered.publishableKey);
      saveConfig(config);
      setProviderAvailability(config);
      status(config.providers?.github
        ? "Supabase connection verified. Sign in with GitHub or email to synchronize this project."
        : "Supabase connection verified. GitHub sign-in is not enabled for this project; use email or enable the GitHub provider.");
    } catch (error) {
      status(messageOf(error));
    }
  });

  requiredElement<HTMLButtonElement>("#storage-sign-in-github").addEventListener("click", async () => {
    try {
      const entered = formConfig();
      const config = await testConnection(entered.url, entered.publishableKey);
      setProviderAvailability(config);
      startGitHubSignIn(config);
    } catch (error) {
      status(messageOf(error));
    }
  });

  requiredElement<HTMLButtonElement>("#storage-copy-schema").addEventListener("click", async () => {
    try {
      const response = await fetch("setup/supabase-schema.sql", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load the setup SQL.");
      await navigator.clipboard.writeText(await response.text());
      status("Setup SQL copied. Run it once in the Supabase SQL Editor, then return and sign in.");
    } catch (error) {
      status(messageOf(error));
    }
  });

  requiredElement<HTMLButtonElement>("#storage-sign-in").addEventListener("click", async () => {
    try {
      const entered = formConfig();
      const config = await testConnection(entered.url, entered.publishableKey);
      saveConfig(config);
      await signIn(config);
      status(`Signed in as ${session?.user.email || "a Supabase user"}.`);
      await refreshHostedProjects(config, validateProjectSnapshot(getSnapshot()).remote?.id);
    } catch (error) {
      setSignedInState(false);
      status(messageOf(error));
    }
  });

  requiredElement<HTMLButtonElement>("#storage-sign-up").addEventListener("click", async () => {
    try {
      const entered = formConfig();
      const config = await testConnection(entered.url, entered.publishableKey);
      saveConfig(config);
      const result = await signUp(config);
      if (result) {
        status(`Account created and signed in as ${result.user.email || "a Supabase user"}.`);
        await refreshHostedProjects(config, validateProjectSnapshot(getSnapshot()).remote?.id);
      } else {
        status("Account created. Confirm the email from Supabase, then use Sign In.");
      }
    } catch (error) {
      status(messageOf(error));
    }
  });

  requiredElement<HTMLButtonElement>("#storage-sign-out").addEventListener("click", async () => {
    const config = formConfig();
    try {
      if (session) await apiRequest(config, "/auth/v1/logout", { method: "POST" }, true);
    } catch {
      // Clearing this tab's session still signs the demo out locally.
    }
    session = null;
    setSignedInState(false);
    hostedSelect.replaceChildren(new Option("Sign in to list hosted projects", ""));
    status("Signed out.");
  });

  hostedSelect.addEventListener("change", () => {
    requiredElement<HTMLButtonElement>("#storage-download").disabled = !session || !hostedSelect.value;
  });

  requiredElement<HTMLButtonElement>("#storage-upload").addEventListener("click", async () => {
    try {
      const entered = formConfig();
      const config = await testConnection(entered.url, entered.publishableKey);
      saveConfig(config);
      status("Uploading the current project snapshot...");
      const result = await uploadProject(config, getSnapshot, markSynced);
      status(`Synchronized ${result.formCount} form${result.formCount === 1 ? "" : "s"} and ${result.recordCount} record${result.recordCount === 1 ? "" : "s"} as revision ${result.saved.revision}.`);
      await refreshHostedProjects(config, result.saved.id);
    } catch (error) {
      status(messageOf(error));
    }
  });

  requiredElement<HTMLButtonElement>("#storage-download").addEventListener("click", async () => {
    try {
      if (!hostedSelect.value) throw new Error("Select a hosted project first.");
      if (!window.confirm("Replace the current local working copy with the selected hosted project?")) return;
      const entered = formConfig();
      const config = await testConnection(entered.url, entered.publishableKey);
      const hosted = await getHostedProject(config, hostedSelect.value);
      if (!hosted) throw new Error("The selected hosted project no longer exists.");
      const snapshot = validateProjectSnapshot(hosted.snapshot);
      applySnapshot(snapshot, { id: hosted.id, revision: hosted.revision, syncedAt: hosted.updated_at });
      requiredElement<HTMLElement>("#storage-current-project").textContent = hosted.name;
      status(`Downloaded ${hosted.name}, revision ${hosted.revision}.`);
    } catch (error) {
      status(messageOf(error));
    }
  });

  void restoreOAuthSession();
}
