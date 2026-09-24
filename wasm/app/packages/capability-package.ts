export const CAPABILITY_PACKAGE_SCHEMA = "epi.package/0.1" as const;
export const IOCODE_PACKAGE_ID = "org.cdc.epi-info-ai.occupational-epidemiology-iocode" as const;
export const IOCODE_CAPABILITY_ID = "io.coder.review/0.1" as const;
export const ENVIRONMENT_PACKAGE_ID = "org.cdc.epi-info-ai.environmental-epidemiology" as const;
export const ENVIRONMENT_CAPABILITY_ID = "environment.assets.review/0.1" as const;

const REGISTRY_KEY = "epi-info-ai.capability-packages.v1";
const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_ARTIFACTS = 16;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const PACKAGE_POLICIES = {
  [IOCODE_PACKAGE_ID]: {
    repositories: new Set([
      "https://git.cdc.gov/epi-info-ai/package-occupational-epidemiology",
      "https://github.com/epi-info-ai/iocode-occupational-epidemiology",
    ]),
    capability: IOCODE_CAPABILITY_ID,
    adapter: IOCODE_CAPABILITY_ID,
    roles: new Set(["check-code-example", "validation", "model-card"]),
  },
  [ENVIRONMENT_PACKAGE_ID]: {
    repositories: new Set([
      "https://git.cdc.gov/epi-info-ai/package-environmental-epidemiology",
      "https://github.com/epi-info-ai/package-environmental-epidemiology",
      "https://git.cdc.gov/epi-info-ai/epi-info-ai",
      "https://github.com/epi-info-ai/epi-info-ai",
    ]),
    capability: ENVIRONMENT_CAPABILITY_ID,
    adapter: ENVIRONMENT_CAPABILITY_ID,
    roles: new Set(["provider-catalog", "validation", "documentation"]),
  },
} as const;
const ALLOWED_MEDIA_TYPES = new Set(["text/vnd.epi.check-code", "application/json", "text/markdown"]);
const PROHIBITED_EXTENSIONS = /\.(?:js|mjs|cjs|wasm|dll|exe|bin|onnx|safetensors|zip|tar|gz)$/i;

export interface CapabilityPackageArtifact {
  role: "check-code-example" | "validation" | "model-card" | "provider-catalog" | "documentation";
  path: string;
  mediaType: string;
  bytes: number;
  digest: string;
}

export interface CapabilityPackageManifest {
  schemaVersion: typeof CAPABILITY_PACKAGE_SCHEMA;
  id: typeof IOCODE_PACKAGE_ID | typeof ENVIRONMENT_PACKAGE_ID;
  version: string;
  artifactType: "epi.capability-assets";
  publisher: string;
  title: string;
  description: string;
  license: string;
  source: { authoritative: string; mirrors: string[]; revision: string };
  compatibility: { application: string; capabilities: string[] };
  privacy: { classification: "public-synthetic"; containsRecordData: false };
  approval: { installation: "approved-synthetic-demo"; scientificExecution: "not-approved"; reason: string };
  activation: { adapter: typeof IOCODE_CAPABILITY_ID | typeof ENVIRONMENT_CAPABILITY_ID; executable: false; network: false };
  artifacts: CapabilityPackageArtifact[];
  dependencies: [];
  signatures: { profile: string; status: "pending-protected-ci" };
}

export interface CapabilityPackagePreview {
  manifest: CapabilityPackageManifest;
  manifestUrl: string;
  manifestSha256: string;
  totalBytes: number;
}

export interface InstalledCapabilityPackage extends CapabilityPackagePreview {
  installedAt: string;
  storageDirectory: string;
  receipt: {
    decision: "installed-inert";
    executable: false;
    verifiedArtifacts: number;
  };
}

export class CapabilityPackageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapabilityPackageError";
  }
}

function objectValue(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CapabilityPackageError(`${path} must be an object.`);
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) throw new CapabilityPackageError(`${path} must be a non-empty string.`);
  return value.trim();
}

function exactValue<T extends string | boolean>(value: unknown, expected: T, path: string): T {
  if (value !== expected) throw new CapabilityPackageError(`${path} must be ${JSON.stringify(expected)}.`);
  return expected;
}

function safePath(value: unknown, path: string): string {
  const text = stringValue(value, path).replaceAll("\\", "/");
  if (text.length > 300 || text.startsWith("/") || text.split("/").some((part) => !part || part === "." || part === "..") || PROHIBITED_EXTENSIONS.test(text)) {
    throw new CapabilityPackageError(`${path} is not an allowed inert package path.`);
  }
  return text;
}

function repositoryUrl(value: unknown, path: string, allowedRepositories: ReadonlySet<string>): string {
  const url = stringValue(value, path).replace(/\/$/, "");
  if (!allowedRepositories.has(url)) throw new CapabilityPackageError(`${path} is not an allowlisted repository for this capability package.`);
  return url;
}

export function validateCapabilityPackageManifest(value: unknown): CapabilityPackageManifest {
  const manifest = objectValue(value, "manifest");
  exactValue(manifest.schemaVersion, CAPABILITY_PACKAGE_SCHEMA, "manifest.schemaVersion");
  const packageId = stringValue(manifest.id, "manifest.id") as keyof typeof PACKAGE_POLICIES;
  const policy = PACKAGE_POLICIES[packageId];
  if (!policy) throw new CapabilityPackageError(`manifest.id ${JSON.stringify(packageId)} is not an allowlisted capability package.`);
  exactValue(manifest.artifactType, "epi.capability-assets", "manifest.artifactType");
  const version = stringValue(manifest.version, "manifest.version");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new CapabilityPackageError("manifest.version must be semantic version text.");
  const source = objectValue(manifest.source, "manifest.source");
  const authoritative = repositoryUrl(source.authoritative, "manifest.source.authoritative", policy.repositories);
  if (!Array.isArray(source.mirrors) || source.mirrors.length > 4) throw new CapabilityPackageError("manifest.source.mirrors must be a bounded array.");
  const mirrors = source.mirrors.map((item, index) => repositoryUrl(item, `manifest.source.mirrors[${index}]`, policy.repositories));
  const revision = stringValue(source.revision, "manifest.source.revision").toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new CapabilityPackageError("manifest.source.revision must be a full immutable Git commit SHA.");

  const compatibility = objectValue(manifest.compatibility, "manifest.compatibility");
  const applicationCompatibility = stringValue(compatibility.application, "manifest.compatibility.application");
  if (applicationCompatibility !== ">=0.2.0 <0.3.0") throw new CapabilityPackageError("This capability package is not compatible with the Epi Info AI 0.2 release line.");
  if (!Array.isArray(compatibility.capabilities) || !compatibility.capabilities.every((item) => typeof item === "string")) throw new CapabilityPackageError("manifest.compatibility.capabilities must be a string array.");
  const capabilities = compatibility.capabilities as string[];
  if (!capabilities.includes(policy.capability)) throw new CapabilityPackageError(`manifest must require ${policy.capability}.`);
  const privacy = objectValue(manifest.privacy, "manifest.privacy");
  exactValue(privacy.classification, "public-synthetic", "manifest.privacy.classification");
  exactValue(privacy.containsRecordData, false, "manifest.privacy.containsRecordData");
  const approval = objectValue(manifest.approval, "manifest.approval");
  exactValue(approval.installation, "approved-synthetic-demo", "manifest.approval.installation");
  exactValue(approval.scientificExecution, "not-approved", "manifest.approval.scientificExecution");
  const activation = objectValue(manifest.activation, "manifest.activation");
  exactValue(activation.adapter, policy.adapter, "manifest.activation.adapter");
  exactValue(activation.executable, false, "manifest.activation.executable");
  exactValue(activation.network, false, "manifest.activation.network");
  const signatures = objectValue(manifest.signatures, "manifest.signatures");
  exactValue(signatures.status, "pending-protected-ci", "manifest.signatures.status");
  if (!Array.isArray(manifest.dependencies) || manifest.dependencies.length !== 0) throw new CapabilityPackageError("The V0.1 capability-package pilot cannot declare dependencies.");

  if (!Array.isArray(manifest.artifacts) || !manifest.artifacts.length || manifest.artifacts.length > MAX_ARTIFACTS) {
    throw new CapabilityPackageError(`manifest.artifacts must contain 1 to ${MAX_ARTIFACTS} entries.`);
  }
  const paths = new Set<string>();
  let totalBytes = 0;
  const artifacts = manifest.artifacts.map((item, index): CapabilityPackageArtifact => {
    const artifact = objectValue(item, `manifest.artifacts[${index}]`);
    const artifactPath = safePath(artifact.path, `manifest.artifacts[${index}].path`);
    if (paths.has(artifactPath.toLowerCase())) throw new CapabilityPackageError(`Duplicate artifact path ${JSON.stringify(artifactPath)}.`);
    paths.add(artifactPath.toLowerCase());
    const role = stringValue(artifact.role, `manifest.artifacts[${index}].role`);
    if (!policy.roles.has(role as never)) throw new CapabilityPackageError(`Unsupported artifact role ${JSON.stringify(role)} for ${packageId}.`);
    const mediaType = stringValue(artifact.mediaType, `manifest.artifacts[${index}].mediaType`);
    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) throw new CapabilityPackageError(`Unsupported media type ${JSON.stringify(mediaType)}.`);
    if (!Number.isSafeInteger(artifact.bytes) || (artifact.bytes as number) < 0) throw new CapabilityPackageError(`manifest.artifacts[${index}].bytes must be a non-negative integer.`);
    totalBytes += artifact.bytes as number;
    const digest = stringValue(artifact.digest, `manifest.artifacts[${index}].digest`).toLowerCase();
    if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new CapabilityPackageError(`manifest.artifacts[${index}].digest must be a SHA-256 descriptor.`);
    return { role: role as CapabilityPackageArtifact["role"], path: artifactPath, mediaType, bytes: artifact.bytes as number, digest };
  });
  if (totalBytes > MAX_TOTAL_BYTES) throw new CapabilityPackageError("Capability package exceeds the 10 MiB pilot limit.");

  return {
    schemaVersion: CAPABILITY_PACKAGE_SCHEMA,
    id: packageId,
    version,
    artifactType: "epi.capability-assets",
    publisher: stringValue(manifest.publisher, "manifest.publisher"),
    title: stringValue(manifest.title, "manifest.title"),
    description: stringValue(manifest.description, "manifest.description"),
    license: stringValue(manifest.license, "manifest.license"),
    source: { authoritative, mirrors, revision },
    compatibility: { application: applicationCompatibility, capabilities: [...capabilities] },
    privacy: { classification: "public-synthetic", containsRecordData: false },
    approval: { installation: "approved-synthetic-demo", scientificExecution: "not-approved", reason: stringValue(approval.reason, "manifest.approval.reason") },
    activation: { adapter: policy.adapter, executable: false, network: false },
    artifacts,
    dependencies: [],
    signatures: { profile: stringValue(signatures.profile, "manifest.signatures.profile"), status: "pending-protected-ci" },
  };
}

async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function allowedManifestUrl(value: URL): boolean {
  if (value.origin === location.origin) return true;
  return (value.hostname === "git.cdc.gov" && value.pathname.startsWith("/epi-info-ai/package-occupational-epidemiology/-/raw/"))
    || (value.hostname === "git.cdc.gov" && value.pathname.startsWith("/epi-info-ai/package-environmental-epidemiology/-/raw/"))
    || (value.hostname === "raw.githubusercontent.com" && value.pathname.startsWith("/epi-info-ai/iocode-occupational-epidemiology/"))
    || (value.hostname === "raw.githubusercontent.com" && value.pathname.startsWith("/epi-info-ai/package-environmental-epidemiology/"));
}

export async function previewCapabilityPackage(manifestUrl: URL | string): Promise<CapabilityPackagePreview> {
  const url = new URL(String(manifestUrl), location.href);
  if (url.protocol !== "https:" && url.origin !== location.origin) throw new CapabilityPackageError("Capability package manifests require HTTPS or this application origin.");
  if (!allowedManifestUrl(url)) throw new CapabilityPackageError("The capability-package pilot accepts only an allowlisted CDC GitLab/GitHub source or a bundled same-origin manifest.");
  const candidates = [url];
  if (url.hostname === "git.cdc.gov" && url.pathname.includes("package-occupational-epidemiology")) {
    candidates.push(new URL("https://raw.githubusercontent.com/epi-info-ai/iocode-occupational-epidemiology/main/epi-info-capability.json"));
  }
  const failures: string[] = [];
  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > MAX_MANIFEST_BYTES) throw new Error("manifest exceeds 256 KiB");
      let value: unknown;
      try { value = JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
      catch { throw new Error("response is not a JSON manifest"); }
      const manifest = validateCapabilityPackageManifest(value);
      return {
        manifest,
        manifestUrl: candidate.href,
        manifestSha256: await sha256(bytes),
        totalBytes: manifest.artifacts.reduce((total, artifact) => total + artifact.bytes, 0),
      };
    } catch (error) {
      failures.push(`${candidate.hostname}: ${error instanceof Error ? error.message : "fetch failed"}`);
    }
  }
  throw new CapabilityPackageError(`Unable to load a valid capability manifest from an approved mirror (${failures.join("; ")}).`);
}

function artifactUrl(repository: string, revision: string, path: string): URL {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const repo = new URL(repository);
  if (repo.hostname === "git.cdc.gov") return new URL(`${repository}/-/raw/${revision}/${encodedPath}`);
  const [owner, name] = repo.pathname.slice(1).split("/");
  return new URL(`https://raw.githubusercontent.com/${owner}/${name}/${revision}/${encodedPath}`);
}

async function verifiedArtifact(preview: CapabilityPackagePreview, artifact: CapabilityPackageArtifact): Promise<ArrayBuffer> {
  const manifest = preview.manifest;
  const failures: string[] = [];
  const manifestUrl = new URL(preview.manifestUrl);
  const publishedPath = artifact.path.startsWith("wasm/demo/") ? artifact.path.slice("wasm/demo/".length) : null;
  const localCandidate = manifestUrl.origin === location.origin
    ? [publishedPath ? new URL(publishedPath, new URL("./", location.href)) : new URL(artifact.path, new URL("./", manifestUrl))]
    : [];
  for (const candidate of localCandidate) {
    try {
      const response = await fetch(candidate, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== artifact.bytes) throw new Error(`received ${bytes.byteLength} bytes; expected ${artifact.bytes}`);
      if (`sha256:${await sha256(bytes)}` !== artifact.digest) throw new Error("SHA-256 mismatch");
      return bytes;
    } catch (error) {
      failures.push(`${candidate.hostname}: ${error instanceof Error ? error.message : "fetch failed"}`);
    }
  }
  for (const repository of [manifest.source.authoritative, ...manifest.source.mirrors]) {
    try {
      const response = await fetch(artifactUrl(repository, manifest.source.revision, artifact.path), { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== artifact.bytes) throw new Error(`received ${bytes.byteLength} bytes; expected ${artifact.bytes}`);
      if (`sha256:${await sha256(bytes)}` !== artifact.digest) throw new Error("SHA-256 mismatch");
      return bytes;
    } catch (error) {
      failures.push(`${new URL(repository).hostname}: ${error instanceof Error ? error.message : "fetch failed"}`);
    }
  }
  throw new CapabilityPackageError(`${artifact.path} could not be verified from an approved mirror (${failures.join("; ")}).`);
}

function safeSegment(value: string): string { return value.replace(/[^a-z0-9.-]/gi, "-").slice(0, 100); }

async function packageRoot(create: boolean): Promise<FileSystemDirectoryHandle> {
  if (!navigator.storage?.getDirectory) throw new CapabilityPackageError("This browser does not provide OPFS for offline capability packages.");
  const root = await navigator.storage.getDirectory();
  const app = await root.getDirectoryHandle("epi-info-ai", { create });
  return app.getDirectoryHandle("capability-packages", { create });
}

async function artifactFile(root: FileSystemDirectoryHandle, path: string, create: boolean): Promise<FileSystemFileHandle> {
  const parts = path.split("/");
  const name = parts.pop()!;
  let directory = root;
  for (const part of parts) directory = await directory.getDirectoryHandle(part, { create });
  return directory.getFileHandle(name, { create });
}

function registry(storage: Storage): InstalledCapabilityPackage[] {
  try {
    const raw = JSON.parse(storage.getItem(REGISTRY_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
      try {
        const record = objectValue(item, "installed package");
        const manifest = validateCapabilityPackageManifest(record.manifest);
        const receipt = objectValue(record.receipt, "installed package receipt");
        exactValue(receipt.decision, "installed-inert", "installed package receipt decision");
        exactValue(receipt.executable, false, "installed package receipt executable");
        return [{
          manifest,
          manifestUrl: stringValue(record.manifestUrl, "installed package manifestUrl"),
          manifestSha256: stringValue(record.manifestSha256, "installed package manifestSha256"),
          totalBytes: manifest.artifacts.reduce((total, artifact) => total + artifact.bytes, 0),
          installedAt: stringValue(record.installedAt, "installed package installedAt"),
          storageDirectory: stringValue(record.storageDirectory, "installed package storageDirectory"),
          receipt: { decision: "installed-inert" as const, executable: false as const, verifiedArtifacts: Number(receipt.verifiedArtifacts) },
        }];
      } catch { return []; }
    });
  } catch { return []; }
}

export function listInstalledCapabilityPackages(storage: Storage = localStorage): InstalledCapabilityPackage[] {
  return registry(storage);
}

export function installedCapabilityStatus(capability: string, storage: Storage = localStorage): { installed: boolean; executable: false; packageTitle?: string; reason: string } {
  const installed = registry(storage).find((item) => item.manifest.compatibility.capabilities.includes(capability));
  return installed
    ? { installed: true, executable: false, packageTitle: installed.manifest.title, reason: installed.manifest.approval.reason }
    : { installed: false, executable: false, reason: "The governed capability package is not installed." };
}

export async function installCapabilityPackage(preview: CapabilityPackagePreview, storage: Storage = localStorage): Promise<InstalledCapabilityPackage> {
  const artifacts: Array<{ artifact: CapabilityPackageArtifact; bytes: ArrayBuffer }> = [];
  for (const artifact of preview.manifest.artifacts) artifacts.push({ artifact, bytes: await verifiedArtifact(preview, artifact) });
  const storageDirectory = `${safeSegment(preview.manifest.id)}--${safeSegment(preview.manifest.version)}--${preview.manifestSha256.slice(0, 12)}--${crypto.randomUUID()}`;
  const root = await packageRoot(true);
  const directory = await root.getDirectoryHandle(storageDirectory, { create: true });
  try {
    for (const { artifact, bytes } of artifacts) {
      const handle = await artifactFile(directory, artifact.path, true);
      const writable = await handle.createWritable();
      await writable.write(bytes);
      await writable.close();
    }
  } catch (error) {
    await root.removeEntry(storageDirectory, { recursive: true }).catch(() => undefined);
    throw error;
  }
  const installed: InstalledCapabilityPackage = {
    ...preview,
    installedAt: new Date().toISOString(),
    storageDirectory,
    receipt: { decision: "installed-inert", executable: false, verifiedArtifacts: artifacts.length },
  };
  storage.setItem(REGISTRY_KEY, JSON.stringify([...registry(storage).filter((item) => item.manifest.id !== installed.manifest.id), installed]));
  return installed;
}
