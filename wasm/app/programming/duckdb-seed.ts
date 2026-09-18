export const DUCKDB_SEED_VERSION = "1" as const;
export const DUCKDB_SEED_FILE = "seed-v1.duckdb" as const;
export const DUCKDB_SEED_SHA256 = "eaffa154f61f16789211ac80161b0dea2cd4f79cf0e0a3413443303def9a1ffc" as const;
export const DUCKDB_SEED_BYTES = 274432 as const;

export interface DuckDbSeedResult {
  bytes: Uint8Array;
  version: typeof DUCKDB_SEED_VERSION;
  sha256: typeof DUCKDB_SEED_SHA256;
  storage: "opfs-installed" | "opfs-reused" | "bundled-fallback";
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verified(bytes: Uint8Array): Promise<boolean> {
  return bytes.byteLength === DUCKDB_SEED_BYTES && await sha256(bytes) === DUCKDB_SEED_SHA256;
}

async function bundledSeed(): Promise<Uint8Array> {
  const response = await fetch(new URL(`./assets/duckdb/${DUCKDB_SEED_FILE}`, document.baseURI));
  if (!response.ok) throw new Error(`Bundled DuckDB seed request failed with HTTP ${response.status}.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!await verified(bytes)) throw new Error("The bundled DuckDB seed failed its reviewed length or SHA-256 integrity check.");
  return bytes;
}

async function seedDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!navigator.storage?.getDirectory) throw new Error("This browser does not provide OPFS.");
  const root = await navigator.storage.getDirectory();
  const app = await root.getDirectoryHandle("epi-info-ai", { create: true });
  const system = await app.getDirectoryHandle("system", { create: true });
  return system.getDirectoryHandle("duckdb", { create: true });
}

let activeSeed: Promise<DuckDbSeedResult> | null = null;

export async function loadDuckDbSeed(): Promise<DuckDbSeedResult> {
  if (activeSeed === null) {
    const pending: Promise<DuckDbSeedResult> = (async (): Promise<DuckDbSeedResult> => {
    try {
      const directory = await seedDirectory();
      const handle = await directory.getFileHandle(DUCKDB_SEED_FILE, { create: true });
      const existingFile = await handle.getFile();
      if (existingFile.size) {
        const existing = new Uint8Array(await existingFile.arrayBuffer());
        if (await verified(existing)) return { bytes: existing, version: DUCKDB_SEED_VERSION, sha256: DUCKDB_SEED_SHA256, storage: "opfs-reused" };
      }
      const bytes = await bundledSeed();
      const writable = await handle.createWritable();
      try { await writable.write(bytes.slice().buffer); } finally { await writable.close(); }
      const installed = new Uint8Array(await (await handle.getFile()).arrayBuffer());
      if (!await verified(installed)) throw new Error("The OPFS DuckDB seed failed verification after installation.");
      await navigator.storage.persist?.().catch(() => false);
      return { bytes: installed, version: DUCKDB_SEED_VERSION, sha256: DUCKDB_SEED_SHA256, storage: "opfs-installed" };
    } catch (error) {
      if (error instanceof Error && /integrity|verification/i.test(error.message)) throw error;
      const bytes = await bundledSeed();
      return { bytes, version: DUCKDB_SEED_VERSION, sha256: DUCKDB_SEED_SHA256, storage: "bundled-fallback" };
    }
    })();
    activeSeed = pending.catch((error) => {
      activeSeed = null;
      throw error;
    });
  }
  const seed = await activeSeed;
  // DuckDB-Wasm may take ownership of registered buffers. Keep the cached,
  // verified seed immutable and give every database build its own byte copy.
  return { ...seed, bytes: seed.bytes.slice() };
}
