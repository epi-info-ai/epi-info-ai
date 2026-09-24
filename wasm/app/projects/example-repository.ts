import { isBinaryProjectArchive, parseProjectArchive } from "../contracts/project-archive.ts";
import { parseProjectPackage } from "../contracts/project-package.ts";
import { validateProjectContentManifest, verifyProjectContentManifest, type ProjectContentManifestV1 } from "./project-content-manifest.ts";

const MAX_CATALOG_BYTES = 256 * 1024;
const MAX_PROJECT_BYTES = 150 * 1024 * 1024;
const MAX_PROJECTS = 50;
export const exampleProjectCatalogSchemaVersion = 2 as const;

export interface ExampleProjectEntry {
  id: string;
  title: string;
  description: string;
  file: string;
  repository: string;
  bytes: number;
  sha256: string;
  contents: ProjectContentManifestV1;
}

export interface ExampleProjectCatalog {
  schemaVersion: 2;
  id: string;
  title: string;
  description: string;
  projects: ExampleProjectEntry[];
}

export interface LoadedExampleProjectCatalog {
  catalog: ExampleProjectCatalog;
  url: URL;
}

export class ExampleProjectRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExampleProjectRepositoryError";
  }
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ExampleProjectRepositoryError(`${name} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ExampleProjectRepositoryError(`${name} must be a non-empty string.`);
  return value.trim();
}

function safeRelativeFile(value: unknown, name: string): string {
  const file = text(value, name).replaceAll("\\", "/");
  const parts = file.split("/");
  if (file.startsWith("/") || parts.some((part) => !part || part === ".") || parts.filter((part) => part === "..").length > 1) {
    throw new ExampleProjectRepositoryError(`${name} must be a safe relative path.`);
  }
  if (!/\.epia(?:\.json)?$/i.test(file)) throw new ExampleProjectRepositoryError(`${name} must identify an .epia or .epia.json project package.`);
  return file;
}
function allowedCatalogUrl(value: URL): boolean {
  return value.origin === location.origin
    || (value.protocol === "https:" && ["git.cdc.gov", "raw.githubusercontent.com"].includes(value.hostname));
}

export function validateExampleProjectCatalog(value: unknown): ExampleProjectCatalog {
  const source = record(value, "catalog");
  if (source.schemaVersion !== exampleProjectCatalogSchemaVersion) throw new ExampleProjectRepositoryError("catalog.schemaVersion must be 2; content manifests are required.");
  if (!Array.isArray(source.projects) || source.projects.length < 1 || source.projects.length > MAX_PROJECTS) {
    throw new ExampleProjectRepositoryError(`catalog.projects must contain 1 to ${MAX_PROJECTS} projects.`);
  }
  const ids = new Set<string>();
  const projects = source.projects.map((value, index): ExampleProjectEntry => {
    const item = record(value, `catalog.projects[${index}]`);
    const id = text(item.id, `catalog.projects[${index}].id`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || ids.has(id)) {
      throw new ExampleProjectRepositoryError(`catalog.projects[${index}].id must be a unique lowercase identifier.`);
    }
    ids.add(id);
    const repository = text(item.repository, `catalog.projects[${index}].repository`).replace(/\/$/, "");
    const repositoryUrl = new URL(repository);
    if (repositoryUrl.protocol !== "https:" || !["git.cdc.gov", "github.com"].includes(repositoryUrl.hostname)) {
      throw new ExampleProjectRepositoryError(`catalog.projects[${index}].repository must be an approved HTTPS GitLab or GitHub repository.`);
    }
    if (!Number.isSafeInteger(item.bytes) || (item.bytes as number) < 1 || (item.bytes as number) > MAX_PROJECT_BYTES) {
      throw new ExampleProjectRepositoryError(`catalog.projects[${index}].bytes must be between 1 byte and 150 MiB.`);
    }
    const sha256 = text(item.sha256, `catalog.projects[${index}].sha256`).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new ExampleProjectRepositoryError(`catalog.projects[${index}].sha256 must be a SHA-256 digest.`);
    return {
      id,
      title: text(item.title, `catalog.projects[${index}].title`),
      description: text(item.description, `catalog.projects[${index}].description`),
      file: safeRelativeFile(item.file, `catalog.projects[${index}].file`),
      repository,
      bytes: item.bytes as number,
      sha256,
      contents: validateProjectContentManifest(item.contents, `catalog.projects[${index}].contents`),
    };
  });
  return {
    schemaVersion: exampleProjectCatalogSchemaVersion,
    id: text(source.id, "catalog.id"),
    title: text(source.title, "catalog.title"),
    description: text(source.description, "catalog.description"),
    projects,
  };
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function loadExampleProjectCatalog(catalogUrl: URL | string): Promise<LoadedExampleProjectCatalog> {
  const url = new URL(String(catalogUrl), document.baseURI);
  if (!allowedCatalogUrl(url)) throw new ExampleProjectRepositoryError("Project catalogs require this application origin or an approved HTTPS GitLab/GitHub source.");
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-cache" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "network request failed";
    throw new ExampleProjectRepositoryError(`Unable to fetch the project catalog from ${url.href} (${detail}).`);
  }
  if (!response.ok) throw new ExampleProjectRepositoryError(`Unable to load the project catalog (${response.status}).`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_CATALOG_BYTES) throw new ExampleProjectRepositoryError("Project catalog exceeds 256 KiB.");
  let value: unknown;
  try { value = JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
  catch { throw new ExampleProjectRepositoryError("Project catalog is not valid JSON."); }
  return { catalog: validateExampleProjectCatalog(value), url };
}

export async function fetchExampleProject(loaded: LoadedExampleProjectCatalog, entry: ExampleProjectEntry): Promise<File> {
  if (!loaded.catalog.projects.some((candidate) => candidate.id === entry.id && candidate.sha256 === entry.sha256)) {
    throw new ExampleProjectRepositoryError("The selected project is not declared by the active catalog.");
  }
  const url = new URL(entry.file, loaded.url);
  if (!allowedCatalogUrl(url)) throw new ExampleProjectRepositoryError("The project package resolved outside an approved repository source.");
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-cache" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "network request failed";
    throw new ExampleProjectRepositoryError(`Unable to fetch ${entry.title} from ${url.href} (${detail}).`);
  }
  if (!response.ok) throw new ExampleProjectRepositoryError(`Unable to retrieve ${entry.title} (${response.status}).`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== entry.bytes) throw new ExampleProjectRepositoryError(`${entry.title} has ${bytes.byteLength} bytes; expected ${entry.bytes}.`);
  if (await sha256Hex(bytes) !== entry.sha256) throw new ExampleProjectRepositoryError(`${entry.title} failed SHA-256 verification.`);
  const file = new File([bytes], entry.file.split("/").at(-1) ?? `${entry.id}.epia.json`, { type: "application/vnd.epi-info-ai.project" });
  try {
    if (await isBinaryProjectArchive(file)) {
      const parsed = await parseProjectArchive(file);
      await verifyProjectContentManifest(parsed.projectPackage, parsed.assets, entry.contents);
    } else {
      await verifyProjectContentManifest(parseProjectPackage(await file.text()), [], entry.contents);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "content verification failed";
    throw new ExampleProjectRepositoryError(`${entry.title} failed its declared content inventory (${detail}).`);
  }
  return file;
}
