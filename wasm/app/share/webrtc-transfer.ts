import { MAX_ENCRYPTED_PROJECT_BYTES } from "../contracts/encrypted-project.ts";

export const SECURE_SHARE_PROTOCOL_VERSION = 1 as const;
export const SECURE_SHARE_CHUNK_BYTES = 64 * 1024;
const HIGH_WATER_BYTES = 4 * 1024 * 1024;
const LOW_WATER_BYTES = 1024 * 1024;

interface TransferStart {
  version: typeof SECURE_SHARE_PROTOCOL_VERSION;
  type: "transfer-start";
  id: string;
  name: string;
  byteLength: number;
  sha256: string;
  mediaType: string;
}

interface TransferComplete {
  version: typeof SECURE_SHARE_PROTOCOL_VERSION;
  type: "transfer-complete";
  id: string;
}

export interface SecureShareProgress {
  transferred: number;
  total: number;
}

export interface SecureShareReceiverCallbacks {
  onStatus(message: string): void;
  onProgress(progress: SecureShareProgress): void;
  onFile(file: File, sha256: string): void;
  onError(error: Error): void;
}

export interface SecureShareSenderCallbacks {
  onStatus(message: string): void;
  onProgress(progress: SecureShareProgress): void;
  onError(error: Error): void;
}

async function sha256(blob: Blob): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()))]
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeTransferName(name: string): string {
  const leaf = name.split(/[\\/]/).pop()?.trim() ?? "";
  if (!leaf || leaf.length > 180 || !/\.epiax$/i.test(leaf)) throw new Error("Secure Share accepts a bounded .epiax package only.");
  return leaf;
}

function waitForIceGathering(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const changed = () => {
      if (peer.iceGatheringState !== "complete") return;
      peer.removeEventListener("icegatheringstatechange", changed);
      resolve();
    };
    peer.addEventListener("icegatheringstatechange", changed);
  });
}

function parseDescription(value: string, expected: "offer" | "answer"): RTCSessionDescriptionInit {
  let parsed: unknown;
  try { parsed = JSON.parse(value); }
  catch { throw new Error(`The ${expected} code is not valid JSON.`); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`The ${expected} code is invalid.`);
  const description = parsed as RTCSessionDescriptionInit;
  if (description.type !== expected || typeof description.sdp !== "string" || description.sdp.length < 1 || description.sdp.length > 1_000_000) {
    throw new Error(`The ${expected} code is invalid.`);
  }
  return { type: expected, sdp: description.sdp };
}

export function signalingFingerprint(signaling: string): string {
  const parsed = JSON.parse(signaling) as RTCSessionDescriptionInit;
  const match = parsed.sdp?.match(/^a=fingerprint:[^ ]+ ([A-F0-9:]+)$/im);
  if (!match) throw new Error("The pairing code does not contain a DTLS fingerprint.");
  return match[1]!;
}

async function localDescription(peer: RTCPeerConnection): Promise<string> {
  await waitForIceGathering(peer);
  if (!peer.localDescription?.sdp) throw new Error("The browser did not create a complete pairing description.");
  return JSON.stringify({ type: peer.localDescription.type, sdp: peer.localDescription.sdp });
}

function waitForLowBuffer(channel: RTCDataChannel): Promise<void> {
  if (channel.bufferedAmount <= HIGH_WATER_BYTES) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const low = () => { cleanup(); resolve(); };
    const closed = () => { cleanup(); reject(new Error("The peer connection closed during transfer.")); };
    const cleanup = () => {
      channel.removeEventListener("bufferedamountlow", low);
      channel.removeEventListener("close", closed);
      channel.removeEventListener("error", closed);
    };
    channel.addEventListener("bufferedamountlow", low, { once: true });
    channel.addEventListener("close", closed, { once: true });
    channel.addEventListener("error", closed, { once: true });
  });
}

export async function createSecureShareSender(
  file: File,
  callbacks: SecureShareSenderCallbacks,
): Promise<{ offer: string; fingerprint: string; acceptAnswer(answer: string): Promise<void>; close(): void }> {
  const name = safeTransferName(file.name);
  if (file.size < 1 || file.size > MAX_ENCRYPTED_PROJECT_BYTES) throw new Error("The encrypted package is outside the Secure Share size limit.");
  const digest = await sha256(file);
  const peer = new RTCPeerConnection({ iceServers: [] });
  const channel = peer.createDataChannel("epi-info-secure-share", { ordered: true });
  channel.binaryType = "arraybuffer";
  channel.bufferedAmountLowThreshold = LOW_WATER_BYTES;
  let started = false;
  const send = async () => {
    if (started) return;
    started = true;
    try {
      const id = crypto.randomUUID();
      const start: TransferStart = { version: SECURE_SHARE_PROTOCOL_VERSION, type: "transfer-start", id, name, byteLength: file.size, sha256: digest, mediaType: file.type };
      channel.send(JSON.stringify(start));
      let offset = 0;
      while (offset < file.size) {
        await waitForLowBuffer(channel);
        const end = Math.min(offset + SECURE_SHARE_CHUNK_BYTES, file.size);
        channel.send(await file.slice(offset, end).arrayBuffer());
        offset = end;
        callbacks.onProgress({ transferred: offset, total: file.size });
      }
      const complete: TransferComplete = { version: SECURE_SHARE_PROTOCOL_VERSION, type: "transfer-complete", id };
      channel.send(JSON.stringify(complete));
      callbacks.onStatus("Encrypted package sent. The receiver must verify and explicitly import it.");
    } catch (error) { callbacks.onError(error instanceof Error ? error : new Error("Secure Share transfer failed.")); }
  };
  channel.addEventListener("open", () => { callbacks.onStatus("Peer verified by the exchanged fingerprint; sending encrypted package..."); void send(); });
  channel.addEventListener("error", () => callbacks.onError(new Error("The Secure Share data channel failed.")));
  await peer.setLocalDescription(await peer.createOffer());
  const offer = await localDescription(peer);
  callbacks.onStatus("Offer ready. Send it to the receiver and compare the fingerprint out of band.");
  return {
    offer,
    fingerprint: signalingFingerprint(offer),
    async acceptAnswer(answer: string) { await peer.setRemoteDescription(parseDescription(answer, "answer")); },
    close() { channel.close(); peer.close(); },
  };
}

export function createSecureShareReceiver(callbacks: SecureShareReceiverCallbacks): {
  acceptOffer(offer: string): Promise<{ answer: string; fingerprint: string; senderFingerprint: string }>;
  close(): void;
} {
  const peer = new RTCPeerConnection({ iceServers: [] });
  let start: TransferStart | null = null;
  let received = 0;
  let chunks: BlobPart[] = [];
  peer.addEventListener("datachannel", ({ channel }) => {
    if (channel.label !== "epi-info-secure-share") { channel.close(); callbacks.onError(new Error("The peer opened an unsupported data channel.")); return; }
    channel.binaryType = "arraybuffer";
    channel.addEventListener("message", async ({ data }) => {
      try {
        if (typeof data === "string") {
          const message = JSON.parse(data) as Record<string, unknown>;
          if (message.version !== SECURE_SHARE_PROTOCOL_VERSION) throw new Error("The peer uses an unsupported Secure Share protocol version.");
          if (message.type === "transfer-start") {
            if (start) throw new Error("The peer attempted to start more than one transfer.");
            if (!Number.isSafeInteger(message.byteLength) || typeof message.byteLength !== "number" || message.byteLength < 1 || message.byteLength > MAX_ENCRYPTED_PROJECT_BYTES
              || typeof message.id !== "string" || !/^[a-f0-9-]{20,}$/i.test(message.id)
              || typeof message.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(message.sha256)) throw new Error("The transfer metadata is invalid.");
            start = { version: SECURE_SHARE_PROTOCOL_VERSION, type: "transfer-start", id: message.id, name: safeTransferName(String(message.name)), byteLength: message.byteLength, sha256: message.sha256, mediaType: String(message.mediaType ?? "application/octet-stream") };
            callbacks.onStatus(`Receiving ${start.name}...`);
          } else if (message.type === "transfer-complete") {
            if (!start || message.id !== start.id || received !== start.byteLength) throw new Error("The encrypted transfer is incomplete.");
            const file = new File(chunks, start.name, { type: start.mediaType });
            const receivedDigest = await sha256(file);
            if (receivedDigest !== start.sha256) throw new Error("The received encrypted package failed its SHA-256 check.");
            callbacks.onFile(file, receivedDigest);
            callbacks.onStatus("Encrypted package received and verified. Review it before import.");
            chunks = [];
          } else throw new Error("The peer sent an unsupported control message.");
        } else {
          if (!start || !(data instanceof ArrayBuffer)) throw new Error("The peer sent unexpected binary data.");
          received += data.byteLength;
          if (received > start.byteLength || received > MAX_ENCRYPTED_PROJECT_BYTES) throw new Error("The peer exceeded the declared transfer size.");
          chunks.push(data);
          callbacks.onProgress({ transferred: received, total: start.byteLength });
        }
      } catch (error) {
        channel.close();
        chunks = [];
        callbacks.onError(error instanceof Error ? error : new Error("Secure Share receive failed."));
      }
    });
  });
  return {
    async acceptOffer(offer: string) {
      const description = parseDescription(offer, "offer");
      await peer.setRemoteDescription(description);
      await peer.setLocalDescription(await peer.createAnswer());
      const answer = await localDescription(peer);
      callbacks.onStatus("Answer ready. Return it to the sender and compare both fingerprints out of band.");
      return { answer, fingerprint: signalingFingerprint(answer), senderFingerprint: signalingFingerprint(offer) };
    },
    close() { peer.close(); },
  };
}
