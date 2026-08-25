const CONFIG_KEY = "epi-info-ai.supabase-config.v1";
let session = null;
let githubAvailable = false;

function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function status(message) {
  document.querySelector("#project-storage-status").textContent = message;
}

function formConfig() {
  return {
    url: document.querySelector("#storage-supabase-url").value.trim().replace(/\/$/, ""),
    publishableKey: document.querySelector("#storage-supabase-key").value.trim(),
  };
}

function setProviderAvailability(config = {}) {
  githubAvailable = config.providers?.github === true;
  const button = document.querySelector("#storage-sign-in-github");
  const providerStatus = document.querySelector("#storage-github-status");
  button.disabled = Boolean(session) || !githubAvailable;
  providerStatus.textContent = githubAvailable
    ? "GitHub sign-in is enabled for this Supabase project."
    : config.providers
      ? "GitHub is not enabled in Supabase Authentication providers."
      : "Test the connection to check whether GitHub sign-in is enabled.";
}

async function apiRequest(config, path, options = {}, authenticated = false) {
  const headers = new Headers(options.headers || {});
  headers.set("apikey", config.publishableKey);
  if (authenticated) {
    if (!session?.access_token) throw new Error("Sign in to Supabase first.");
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${config.url}${path}`, { ...options, headers, cache: "no-store" });
  let payload = null;
  const text = await response.text();
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  if (!response.ok) {
    const message = payload?.message || payload?.msg || payload?.error_description || payload?.hint;
    const error = new Error(message || `Supabase request failed (HTTP ${response.status}).`);
    error.status = response.status;
    error.code = payload?.code;
    throw error;
  }
  return payload;
}

function setSignedInState(signedIn) {
  document.querySelector("#storage-sign-in").disabled = signedIn;
  document.querySelector("#storage-sign-up").disabled = signedIn;
  document.querySelector("#storage-sign-out").disabled = !signedIn;
  document.querySelector("#storage-sign-in-github").disabled = signedIn || !githubAvailable;
  document.querySelector("#storage-upload").disabled = true;
  document.querySelector("#storage-download").disabled = true;
}

function startGitHubSignIn(config) {
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

async function restoreOAuthSession() {
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
  const config = loadConfig();
  if (!config.url || !config.publishableKey) {
    status("GitHub sign-in returned, but the saved Supabase connection is missing.");
    return;
  }
  session = {
    access_token: accessToken,
    refresh_token: callback.get("refresh_token"),
    expires_in: Number(callback.get("expires_in") || 0),
    token_type: callback.get("token_type") || "bearer",
  };
  try {
    session.user = await apiRequest(config, "/auth/v1/user", {}, true);
    setProviderAvailability(config);
    setSignedInState(true);
    status(`Signed in with GitHub as ${session.user.email || "a Supabase user"}.`);
  } catch (error) {
    session = null;
    setSignedInState(false);
    status(`GitHub sign-in could not be completed: ${error.message}`);
  }
}

async function refreshHostedProjects(config, preferredId = "") {
  const select = document.querySelector("#storage-hosted-project");
  try {
    const projects = await apiRequest(
      config,
      "/rest/v1/epi_projects?select=id,name,revision,updated_at&order=updated_at.desc",
      {},
      true,
    );
    select.replaceChildren(new Option("No hosted project selected", ""), ...projects.map((project) => (
      new Option(`${project.name} (revision ${project.revision})`, project.id)
    )));
    if (preferredId && projects.some((project) => project.id === preferredId)) select.value = preferredId;
    document.querySelector("#storage-upload").disabled = false;
    document.querySelector("#storage-download").disabled = !select.value;
    return projects;
  } catch (error) {
    select.replaceChildren(new Option("Run the Supabase setup SQL first", ""));
    if (error.status === 404 || error.code === "PGRST205") {
      throw new Error("Connected and signed in, but epi_projects is not installed. Click Copy Setup SQL and run it in the Supabase SQL Editor.");
    }
    throw error;
  }
}

async function signIn(config) {
  const email = document.querySelector("#storage-auth-email").value.trim();
  const password = document.querySelector("#storage-auth-password").value;
  if (!email || !password) throw new Error("Enter the Supabase account email and password.");
  session = await apiRequest(config, "/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setSignedInState(true);
  return session;
}

async function signUp(config) {
  const email = document.querySelector("#storage-auth-email").value.trim();
  const password = document.querySelector("#storage-auth-password").value;
  if (!email || !password) throw new Error("Enter an email and a password of at least six characters.");
  const result = await apiRequest(config, "/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (result.access_token) {
    session = result;
    setSignedInState(true);
  }
  return result;
}

async function getHostedProject(config, id) {
  const rows = await apiRequest(
    config,
    `/rest/v1/epi_projects?id=eq.${encodeURIComponent(id)}&select=id,name,snapshot,revision,updated_at`,
    {},
    true,
  );
  return rows[0] || null;
}

async function uploadProject(config, getSnapshot, markSynced) {
  const local = getSnapshot();
  const tracked = local.remote || null;
  const remoteId = tracked?.id || crypto.randomUUID();
  const hosted = await getHostedProject(config, remoteId);
  if (hosted && hosted.revision !== tracked?.revision) {
    throw new Error(`The hosted copy is revision ${hosted.revision}, but this browser last synchronized revision ${tracked?.revision || 0}. Download it before uploading.`);
  }

  const snapshot = structuredClone(local);
  delete snapshot.remote;
  snapshot.storage = { type: "supabase" };
  const revision = hosted ? hosted.revision + 1 : 1;
  let rows;
  if (hosted) {
    rows = await apiRequest(
      config,
      `/rest/v1/epi_projects?id=eq.${encodeURIComponent(remoteId)}&revision=eq.${hosted.revision}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ name: snapshot.name, snapshot, revision, updated_at: new Date().toISOString() }),
      },
      true,
    );
    if (!rows.length) throw new Error("The hosted project changed during upload. Download it and review the changes first.");
  } else {
    rows = await apiRequest(config, "/rest/v1/epi_projects", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ id: remoteId, owner_id: session.user.id, name: snapshot.name, snapshot, revision }),
    }, true);
  }
  const saved = rows[0];
  markSynced({ id: saved.id, revision: saved.revision, syncedAt: saved.updated_at });
  return { saved, formCount: snapshot.forms.length, recordCount: snapshot.forms.reduce((total, form) => total + (form.records?.length || 0), 0) };
}

export function initializeSupabaseSync({ getSnapshot, markSynced, applySnapshot, testConnection }) {
  const dialog = document.querySelector("#project-storage-dialog");
  const hostedSelect = document.querySelector("#storage-hosted-project");

  document.querySelector("#project-storage").addEventListener("click", () => {
    const config = loadConfig();
    const snapshot = getSnapshot();
    document.querySelector("#storage-current-project").textContent = snapshot.name;
    document.querySelector("#storage-supabase-url").value = config.url || "";
    document.querySelector("#storage-supabase-key").value = config.publishableKey || "";
    setProviderAvailability(config);
    hostedSelect.replaceChildren(new Option(session ? "Loading hosted projects..." : "Sign in to list hosted projects", ""));
    setSignedInState(Boolean(session));
    status(session ? `Signed in as ${session.user.email}. Refreshing hosted projects...` : "Not signed in.");
    dialog.showModal();
    if (session) refreshHostedProjects(config, snapshot.remote?.id).catch((error) => status(error.message));
  });

  for (const button of document.querySelectorAll("[data-close-project-storage]")) {
    button.addEventListener("click", () => dialog.close("close"));
  }

  document.querySelector("#storage-test-connection").addEventListener("click", async () => {
    try {
      const config = await testConnection(formConfig().url, formConfig().publishableKey);
      saveConfig(config);
      setProviderAvailability(config);
      status(config.providers.github
        ? "Supabase connection verified. Sign in with GitHub or email to synchronize this project."
        : "Supabase connection verified. GitHub sign-in is not enabled for this project; use email or enable the GitHub provider.");
    } catch (error) {
      status(error.message);
    }
  });

  document.querySelector("#storage-sign-in-github").addEventListener("click", async () => {
    try {
      const config = await testConnection(formConfig().url, formConfig().publishableKey);
      setProviderAvailability(config);
      startGitHubSignIn(config);
    } catch (error) {
      status(error.message);
    }
  });

  document.querySelector("#storage-copy-schema").addEventListener("click", async () => {
    try {
      const response = await fetch("setup/supabase-schema.sql", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load the setup SQL.");
      await navigator.clipboard.writeText(await response.text());
      status("Setup SQL copied. Run it once in the Supabase SQL Editor, then return and sign in.");
    } catch (error) {
      status(error.message);
    }
  });

  document.querySelector("#storage-sign-in").addEventListener("click", async () => {
    try {
      const config = await testConnection(formConfig().url, formConfig().publishableKey);
      saveConfig(config);
      await signIn(config);
      status(`Signed in as ${session.user.email}.`);
      await refreshHostedProjects(config, getSnapshot().remote?.id);
    } catch (error) {
      setSignedInState(false);
      status(error.message);
    }
  });

  document.querySelector("#storage-sign-up").addEventListener("click", async () => {
    try {
      const config = await testConnection(formConfig().url, formConfig().publishableKey);
      saveConfig(config);
      const result = await signUp(config);
      if (result.access_token) {
        status(`Account created and signed in as ${session.user.email}.`);
        await refreshHostedProjects(config, getSnapshot().remote?.id);
      } else {
        status("Account created. Confirm the email from Supabase, then use Sign In.");
      }
    } catch (error) {
      status(error.message);
    }
  });

  document.querySelector("#storage-sign-out").addEventListener("click", async () => {
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
    document.querySelector("#storage-download").disabled = !session || !hostedSelect.value;
  });

  document.querySelector("#storage-upload").addEventListener("click", async () => {
    try {
      const config = await testConnection(formConfig().url, formConfig().publishableKey);
      saveConfig(config);
      status("Uploading the current project snapshot...");
      const result = await uploadProject(config, getSnapshot, markSynced);
      status(`Synchronized ${result.formCount} form${result.formCount === 1 ? "" : "s"} and ${result.recordCount} record${result.recordCount === 1 ? "" : "s"} as revision ${result.saved.revision}.`);
      await refreshHostedProjects(config, result.saved.id);
    } catch (error) {
      status(error.message);
    }
  });

  document.querySelector("#storage-download").addEventListener("click", async () => {
    try {
      if (!hostedSelect.value) throw new Error("Select a hosted project first.");
      if (!window.confirm("Replace the current local working copy with the selected hosted project?")) return;
      const config = await testConnection(formConfig().url, formConfig().publishableKey);
      const hosted = await getHostedProject(config, hostedSelect.value);
      if (!hosted) throw new Error("The selected hosted project no longer exists.");
      applySnapshot(hosted.snapshot, { id: hosted.id, revision: hosted.revision, syncedAt: hosted.updated_at });
      document.querySelector("#storage-current-project").textContent = hosted.name;
      status(`Downloaded ${hosted.name}, revision ${hosted.revision}.`);
    } catch (error) {
      status(error.message);
    }
  });

  restoreOAuthSession();
}
