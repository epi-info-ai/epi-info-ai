export const TEACHING_REPOSITORY_SCHEMA_VERSION = 1 as const;
const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_ARTIFACTS = 64;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const REGISTRY_KEY = "epi-info-ai.teaching-repositories.v1";

export type TeachingArtifactRole = "dataset" | "program-catalog" | "program" | "project" | "map" | "lesson" | "validation";

export interface TeachingRepositoryArtifact {
  path: string;
  mediaType: string;
  sha256: string;
  bytes: number;
  role: TeachingArtifactRole;
  dataset?: string;
}

export interface TeachingRepositoryManifest {
  schemaVersion: typeof TEACHING_REPOSITORY_SCHEMA_VERSION;
  id: string;
  title: string;
  version: string;
  license: string;
  description: string;
  source: { repository: string; revision: string };
  artifacts: TeachingRepositoryArtifact[];
}

export interface TeachingRepositoryPreview {
  manifest: TeachingRepositoryManifest;
  manifestUrl: string;
  manifestSha256: string;
  totalBytes: number;
}

export interface InstalledTeachingRepository extends TeachingRepositoryPreview {
  installedAt: string;
  storageDirectory: string;
}

export class TeachingRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeachingRepositoryError";
  }
}

function objectValue(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TeachingRepositoryError(`${path} must be an object.`);
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) throw new TeachingRepositoryError(`${path} must be a non-empty string.`);
  return value.trim();
}

function safeArtifactPath(value: unknown, path: string): string {
  const text = stringValue(value, path).replaceAll("\\", "/");
  if (text.startsWith("/") || text.split("/").some((part) => !part || part === "." || part === "..") || text.length > 512) {
    throw new TeachingRepositoryError(`${path} must be a safe relative repository path.`);
  }
  return text;
}

const ROLES: ReadonlySet<string> = new Set(["dataset", "program-catalog", "program", "project", "map", "lesson", "validation"]);

export function validateTeachingRepositoryManifest(value: unknown): TeachingRepositoryManifest {
  const manifest = objectValue(value, "manifest");
  if (manifest.schemaVersion !== TEACHING_REPOSITORY_SCHEMA_VERSION) {
    throw new TeachingRepositoryError(`manifest.schemaVersion must be ${TEACHING_REPOSITORY_SCHEMA_VERSION}.`);
  }
  const id = stringValue(manifest.id, "manifest.id");
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(id)) throw new TeachingRepositoryError("manifest.id must be a namespaced lowercase identifier.");
  const version = stringValue(manifest.version, "manifest.version");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new TeachingRepositoryError("manifest.version must be a semantic version.");
  const source = objectValue(manifest.source, "manifest.source");
  const repository = stringValue(source.repository, "manifest.source.repository").replace(/\/$/, "");
  const parsedRepository = new URL(repository);
  if (parsedRepository.protocol !== "https:" || parsedRepository.hostname !== "github.com" || !/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(parsedRepository.pathname)) {
    throw new TeachingRepositoryError("V0.1 supports an HTTPS GitHub owner/repository source only.");
  }
  const revision = stringValue(source.revision, "manifest.source.revision").toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new TeachingRepositoryError("manifest.source.revision must be a full immutable Git commit SHA.");
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length === 0 || manifest.artifacts.length > MAX_ARTIFACTS) {
    throw new TeachingRepositoryError(`manifest.artifacts must contain 1 to ${MAX_ARTIFACTS} artifacts.`);
  }
  const paths = new Set<string>();
  let totalBytes = 0;
  const artifacts = manifest.artifacts.map((item, index): TeachingRepositoryArtifact => {
    const artifact = objectValue(item, `manifest.artifacts[${index}]`);
    const artifactPath = safeArtifactPath(artifact.path, `manifest.artifacts[${index}].path`);
    if (paths.has(artifactPath.toLowerCase())) throw new TeachingRepositoryError(`Duplicate artifact path ${JSON.stringify(artifactPath)}.`);
    paths.add(artifactPath.toLowerCase());
    const sha256 = stringValue(artifact.sha256, `manifest.artifacts[${index}].sha256`).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new TeachingRepositoryError(`manifest.artifacts[${index}].sha256 must be a SHA-256 digest.`);
    if (!Number.isSafeInteger(artifact.bytes) || (artifact.bytes as number) < 0) throw new TeachingRepositoryError(`manifest.artifacts[${index}].bytes must be a non-negative integer.`);
    totalBytes += artifact.bytes as number;
    const role = stringValue(artifact.role, `manifest.artifacts[${index}].role`);
    if (!ROLES.has(role)) throw new TeachingRepositoryError(`manifest.artifacts[${index}].role is not supported.`);
    const dataset = artifact.dataset === undefined ? undefined : safeArtifactPath(artifact.dataset, `manifest.artifacts[${index}].dataset`);
    return {
      path: artifactPath,
      mediaType: stringValue(artifact.mediaType, `manifest.artifacts[${index}].mediaType`),
      sha256,
      bytes: artifact.bytes as number,
      role: role as TeachingArtifactRole,
      ...(dataset ? { dataset } : {}),
    };
  });
  if (totalBytes > MAX_TOTAL_BYTES) throw new TeachingRepositoryError("Teaching repository exceeds the 100 MiB V0.1 installation limit.");
  for (const artifact of artifacts) {
    if (artifact.dataset && !artifacts.some((candidate) => candidate.path === artifact.dataset && candidate.role === "dataset")) {
      throw new TeachingRepositoryError(`${artifact.path} refers to an undeclared dataset artifact.`);
    }
  }
  return {
    schemaVersion: TEACHING_REPOSITORY_SCHEMA_VERSION,
    id,
    title: stringValue(manifest.title, "manifest.title"),
    version,
    license: stringValue(manifest.license, "manifest.license"),
    description: stringValue(manifest.description, "manifest.description"),
    source: { repository, revision },
    artifacts,
  };
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function teachingArtifactUrl(manifest: TeachingRepositoryManifest, artifact: TeachingRepositoryArtifact): URL {
  const repository = new URL(manifest.source.repository);
  const [owner, name] = repository.pathname.slice(1).split("/");
  const encodedPath = artifact.path.split("/").map(encodeURIComponent).join("/");
  return new URL(`https://raw.githubusercontent.com/${owner}/${name}/${manifest.source.revision}/${encodedPath}`);
}

export async function previewTeachingRepository(manifestUrl: URL | string): Promise<TeachingRepositoryPreview> {
  const url = new URL(String(manifestUrl), location.href);
  if (url.protocol !== "https:" && url.origin !== location.origin) throw new TeachingRepositoryError("Teaching manifests require HTTPS or this application origin.");
  const response = await fetch(url);
  if (!response.ok) throw new TeachingRepositoryError(`Unable to load teaching manifest (${response.status}).`);
  const text = await response.text();
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > MAX_MANIFEST_BYTES) throw new TeachingRepositoryError("Teaching manifest exceeds 256 KiB.");
  let value: unknown;
  try { value = JSON.parse(text) as unknown; } catch { throw new TeachingRepositoryError("Teaching manifest is not valid JSON."); }
  const manifest = validateTeachingRepositoryManifest(value);
  return {
    manifest,
    manifestUrl: url.href,
    manifestSha256: await sha256Hex(bytes.buffer),
    totalBytes: manifest.artifacts.reduce((total, artifact) => total + artifact.bytes, 0),
  };
}

function safeDirectorySegment(value: string): string {
  return value.replace(/[^a-z0-9.-]/gi, "-").slice(0, 100);
}

async function teachingRoot(create: boolean): Promise<FileSystemDirectoryHandle> {
  if (!navigator.storage?.getDirectory) throw new TeachingRepositoryError("This browser does not provide OPFS for offline teaching repositories.");
  const root = await navigator.storage.getDirectory();
  const app = await root.getDirectoryHandle("epi-info-ai", { create });
  return app.getDirectoryHandle("teaching-repositories", { create });
}

async function artifactFile(root: FileSystemDirectoryHandle, path: string, create: boolean): Promise<FileSystemFileHandle> {
  const parts = path.split("/");
  const name = parts.pop()!;
  let directory = root;
  for (const part of parts) directory = await directory.getDirectoryHandle(part, { create });
  return directory.getFileHandle(name, { create });
}

function readRegistry(storage: Storage): InstalledTeachingRepository[] {
  try {
    const value = JSON.parse(storage.getItem(REGISTRY_KEY) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
      try {
        const record = objectValue(item, "installed repository");
        const manifest = validateTeachingRepositoryManifest(record.manifest);
        return [{
          manifest,
          manifestUrl: stringValue(record.manifestUrl, "installed manifestUrl"),
          manifestSha256: stringValue(record.manifestSha256, "installed manifestSha256"),
          totalBytes: manifest.artifacts.reduce((total, artifact) => total + artifact.bytes, 0),
          installedAt: stringValue(record.installedAt, "installed installedAt"),
          storageDirectory: stringValue(record.storageDirectory, "installed storageDirectory"),
        }];
      } catch { return []; }
    });
  } catch { return []; }
}

export function listInstalledTeachingRepositories(storage: Storage = localStorage): InstalledTeachingRepository[] {
  return readRegistry(storage);
}

export async function installTeachingRepository(
  preview: TeachingRepositoryPreview,
  storage: Storage = localStorage,
): Promise<InstalledTeachingRepository> {
  const downloaded: Array<{ artifact: TeachingRepositoryArtifact; bytes: ArrayBuffer }> = [];
  for (const artifact of preview.manifest.artifacts) {
    const response = await fetch(teachingArtifactUrl(preview.manifest, artifact));
    if (!response.ok) throw new TeachingRepositoryError(`Unable to retrieve ${artifact.path} (${response.status}).`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== artifact.bytes) throw new TeachingRepositoryError(`${artifact.path} has ${bytes.byteLength} bytes; expected ${artifact.bytes}.`);
    const digest = await sha256Hex(bytes);
    if (digest !== artifact.sha256) throw new TeachingRepositoryError(`${artifact.path} failed SHA-256 verification.`);
    downloaded.push({ artifact, bytes });
  }
  const storageDirectory = `${safeDirectorySegment(preview.manifest.id)}--${safeDirectorySegment(preview.manifest.version)}--${preview.manifestSha256.slice(0, 12)}`;
  const root = await teachingRoot(true);
  const directory = await root.getDirectoryHandle(storageDirectory, { create: true });
  try {
    for (const item of downloaded) {
      const handle = await artifactFile(directory, item.artifact.path, true);
      const writable = await handle.createWritable();
      await writable.write(item.bytes);
      await writable.close();
    }
  } catch (error) {
    await root.removeEntry(storageDirectory, { recursive: true }).catch(() => undefined);
    throw error;
  }
  const installed: InstalledTeachingRepository = {
    ...preview,
    installedAt: new Date().toISOString(),
    storageDirectory,
  };
  const registry = readRegistry(storage).filter((item) => !(item.manifest.id === installed.manifest.id && item.manifest.version === installed.manifest.version));
  storage.setItem(REGISTRY_KEY, JSON.stringify([...registry, installed]));
  return installed;
}

export async function readInstalledTeachingArtifact(
  installed: InstalledTeachingRepository,
  path: string,
): Promise<File> {
  const artifact = installed.manifest.artifacts.find((candidate) => candidate.path === path);
  if (!artifact) throw new TeachingRepositoryError("The requested artifact is not declared by this teaching repository.");
  const root = await teachingRoot(false);
  const directory = await root.getDirectoryHandle(installed.storageDirectory);
  const file = await (await artifactFile(directory, artifact.path, false)).getFile();
  if (file.size !== artifact.bytes || await sha256Hex(await file.arrayBuffer()) !== artifact.sha256) {
    throw new TeachingRepositoryError(`${artifact.path} no longer passes its installed integrity check.`);
  }
  return file;
}
