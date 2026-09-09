import { MAX_PROJECT_ARCHIVE_BYTES } from "./project-archive.ts";

export const ENCRYPTED_PROJECT_FORMAT = "epi-info-ai-encrypted-project" as const;
export const ENCRYPTED_PROJECT_VERSION = 1 as const;
export const ENCRYPTED_PROJECT_EXTENSION = ".epiax" as const;
export const ENCRYPTED_PROJECT_MEDIA_TYPE = "application/vnd.epi-info-ai.encrypted-project" as const;
export const DEFAULT_PBKDF2_ITERATIONS = 600_000;
export const MAX_ENCRYPTED_PROJECT_BYTES = MAX_PROJECT_ARCHIVE_BYTES + 64 * 1024;

const MAGIC = new Uint8Array([0x45, 0x50, 0x49, 0x41, 0x45, 0x4e, 0x43, 0x01]);
const HEADER_BYTES = 12;
const MAX_HEADER_BYTES = 16 * 1024;
const MIN_PBKDF2_ITERATIONS = 100_000;
const MAX_PBKDF2_ITERATIONS = 5_000_000;

interface EncryptedProjectHeader {
  format: typeof ENCRYPTED_PROJECT_FORMAT;
  version: typeof ENCRYPTED_PROJECT_VERSION;
  kdf: {
    name: "PBKDF2";
    hash: "SHA-256";
    iterations: number;
    salt: string;
  };
  cipher: {
    name: "AES-GCM";
    keyLength: 256;
    tagLength: 128;
    iv: string;
  };
  plaintext: {
    byteLength: number;
    sha256: string;
    mediaType: "application/vnd.epi-info-ai.project";
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string, expectedLength: number, label: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error(`The encrypted package ${label} is invalid.`);
  let decoded: string;
  try { decoded = atob(value); }
  catch { throw new Error(`The encrypted package ${label} is invalid.`); }
  const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  if (bytes.byteLength !== expectedLength) throw new Error(`The encrypted package ${label} has the wrong length.`);
  return bytes;
}

async function sha256(blob: Blob): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function validateNewPassphrase(passphrase: string): void {
  if (passphrase.length < 12) throw new Error("Use a passphrase of at least 12 characters.");
  if (passphrase.length > 1024) throw new Error("The passphrase is too long.");
}

function validateHeader(value: unknown): { header: EncryptedProjectHeader; salt: Uint8Array; iv: Uint8Array } {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The encrypted package header is invalid.");
  const header = value as EncryptedProjectHeader;
  if (header.format !== ENCRYPTED_PROJECT_FORMAT || header.version !== ENCRYPTED_PROJECT_VERSION) {
    throw new Error("The encrypted package format or version is unsupported.");
  }
  if (header.kdf?.name !== "PBKDF2" || header.kdf.hash !== "SHA-256"
    || !Number.isSafeInteger(header.kdf.iterations)
    || header.kdf.iterations < MIN_PBKDF2_ITERATIONS || header.kdf.iterations > MAX_PBKDF2_ITERATIONS) {
    throw new Error("The encrypted package key-derivation parameters are invalid.");
  }
  if (header.cipher?.name !== "AES-GCM" || header.cipher.keyLength !== 256 || header.cipher.tagLength !== 128) {
    throw new Error("The encrypted package cipher parameters are unsupported.");
  }
  if (!header.plaintext || !Number.isSafeInteger(header.plaintext.byteLength)
    || header.plaintext.byteLength < 1 || header.plaintext.byteLength > MAX_PROJECT_ARCHIVE_BYTES
    || !/^[a-f0-9]{64}$/.test(header.plaintext.sha256)
    || header.plaintext.mediaType !== "application/vnd.epi-info-ai.project") {
    throw new Error("The encrypted package plaintext metadata is invalid.");
  }
  return {
    header,
    salt: base64ToBytes(header.kdf.salt, 16, "salt"),
    iv: base64ToBytes(header.cipher.iv, 12, "initialization vector"),
  };
}

export async function encryptProjectArchive(
  plaintext: Blob,
  passphrase: string,
  iterations = DEFAULT_PBKDF2_ITERATIONS,
): Promise<Blob> {
  validateNewPassphrase(passphrase);
  if (plaintext.size < 1 || plaintext.size > MAX_PROJECT_ARCHIVE_BYTES) {
    throw new Error("The project archive is outside the encrypted-package size limit.");
  }
  if (!Number.isSafeInteger(iterations) || iterations < MIN_PBKDF2_ITERATIONS || iterations > MAX_PBKDF2_ITERATIONS) {
    throw new Error("The requested key-derivation work factor is invalid.");
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const header: EncryptedProjectHeader = {
    format: ENCRYPTED_PROJECT_FORMAT,
    version: ENCRYPTED_PROJECT_VERSION,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations, salt: bytesToBase64(salt) },
    cipher: { name: "AES-GCM", keyLength: 256, tagLength: 128, iv: bytesToBase64(iv) },
    plaintext: {
      byteLength: plaintext.size,
      sha256: await sha256(plaintext),
      mediaType: "application/vnd.epi-info-ai.project",
    },
  };
  const encodedHeader = new TextEncoder().encode(JSON.stringify(header));
  if (encodedHeader.byteLength > MAX_HEADER_BYTES) throw new Error("The encrypted package header exceeds its limit.");
  const key = await deriveKey(passphrase, salt, iterations);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: encodedHeader as BufferSource, tagLength: 128 },
    key,
    await plaintext.arrayBuffer(),
  );
  const prefix = new Uint8Array(HEADER_BYTES);
  prefix.set(MAGIC);
  new DataView(prefix.buffer).setUint32(8, encodedHeader.byteLength, true);
  const result = new Blob([prefix, encodedHeader, ciphertext], { type: ENCRYPTED_PROJECT_MEDIA_TYPE });
  if (result.size > MAX_ENCRYPTED_PROJECT_BYTES) throw new Error("The encrypted project package exceeds its size limit.");
  return result;
}

export async function decryptProjectArchive(file: Blob, passphrase: string): Promise<File> {
  if (!passphrase || passphrase.length > 1024) throw new Error("Enter the package passphrase.");
  if (file.size < HEADER_BYTES + 16 || file.size > MAX_ENCRYPTED_PROJECT_BYTES) {
    throw new Error("The encrypted project package is outside its size limit.");
  }
  const prefix = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  if (!MAGIC.every((byte, index) => prefix[index] === byte)) throw new Error("The selected file is not an encrypted Epi Info AI package.");
  const headerLength = new DataView(prefix.buffer).getUint32(8, true);
  if (headerLength < 1 || headerLength > MAX_HEADER_BYTES || HEADER_BYTES + headerLength + 16 > file.size) {
    throw new Error("The encrypted project package header length is invalid.");
  }
  const encodedHeader = new Uint8Array(await file.slice(HEADER_BYTES, HEADER_BYTES + headerLength).arrayBuffer());
  let rawHeader: unknown;
  try { rawHeader = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(encodedHeader)); }
  catch { throw new Error("The encrypted project package header is not valid UTF-8 JSON."); }
  const { header, salt, iv } = validateHeader(rawHeader);
  const expectedCiphertextLength = header.plaintext.byteLength + 16;
  if (file.size !== HEADER_BYTES + headerLength + expectedCiphertextLength) {
    throw new Error("The encrypted project package length does not match its authenticated metadata.");
  }
  const key = await deriveKey(passphrase, salt, header.kdf.iterations);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource, additionalData: encodedHeader as BufferSource, tagLength: 128 },
      key,
      await file.slice(HEADER_BYTES + headerLength).arrayBuffer(),
    );
  } catch {
    throw new Error("The package could not be decrypted. The passphrase is incorrect or the package was modified.");
  }
  const result = new File([plaintext], "decrypted.epia", { type: header.plaintext.mediaType });
  if (result.size !== header.plaintext.byteLength || await sha256(result) !== header.plaintext.sha256) {
    throw new Error("The decrypted project package failed its integrity check.");
  }
  return result;
}

export async function isEncryptedProjectArchive(file: Blob): Promise<boolean> {
  if (file.size < MAGIC.length) return false;
  const prefix = new Uint8Array(await file.slice(0, MAGIC.length).arrayBuffer());
  return MAGIC.every((byte, index) => prefix[index] === byte);
}
