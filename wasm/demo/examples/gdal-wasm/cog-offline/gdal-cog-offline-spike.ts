import { fromUrl, writeArrayBuffer, type GeoTIFFImage, type TypedArray } from "geotiff";
import { GdalWorkerClient, type GdalDatasetInfo, type GdalOpenedDataset } from "../gdal-wasm-worker.js";

interface RangeRecord { request: string; status: number; bytes: number; contentRange: string | null }
interface QuantileClassification { method: "five-quantile-positive-values"; palette: string[]; breaks: number[]; classCounts: number[]; zeroCount: number; noDataCount: number }
interface StoredWindow { schemaVersion: 2; fileName: string; byteLength: number; sha256: string; sourceSha256: string; window: number[]; statistics: Record<string, number | null>; classification: QuantileClassification; preview: { fileName: string; byteLength: number; sha256: string } }

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing COG-offline element: ${selector}`);
  return element;
};
const coldButton = required<HTMLButtonElement>("#run-cog-cold");
const offlineButton = required<HTMLButtonElement>("#run-cog-offline");
const cancelButton = required<HTMLButtonElement>("#cancel-cog");
const downloadButton = required<HTMLButtonElement>("#download-cog-window");
const status = required<HTMLElement>("#cog-status");
const elapsed = required<HTMLElement>("#cog-elapsed");
const validation = required<HTMLElement>("#cog-validation");
const receiptOutput = required<HTMLElement>("#cog-receipt");
const preview = required<HTMLImageElement>("#cog-preview");
const legend = required<HTMLElement>("#cog-legend");
const sourceBytesOutput = required<HTMLElement>("#cog-source-bytes");
const transferBytesOutput = required<HTMLElement>("#cog-transfer-bytes");
const savingsOutput = required<HTMLElement>("#cog-savings");
const rangeCountOutput = required<HTMLElement>("#cog-range-count");
const sourceUrl = new URL("./toledo-population-cog.tif", window.location.href);
const sourceSha256 = "45b646b879eec22a8824ebe890c4ca2b3240b81f44eb7c0b96c85df0ef46332e";
const sourceByteLength = 9_570_199;
const pixelWindow = [768, 400, 1024, 656] as const;
const storageKey = "epi-info-ai.gdal-cog-offline.v2";
const storageFileName = "toledo-population-window.tif";
const storagePreviewFileName = "toledo-population-window-quantiles.png";
let activeClient: GdalWorkerClient | null = null;
let controller: AbortController | null = null;
let timer = 0;
let previewUrl = "";
let downloadUrl = "";
let receipt: Record<string, unknown> = {};

const sha256 = async (bytes: ArrayBuffer): Promise<string> => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
  .map((value) => value.toString(16).padStart(2, "0")).join("");

function metadataNumber(value: unknown, key: string): number | null {
  if (!value || typeof value !== "object") return null;
  for (const [name, child] of Object.entries(value)) {
    if (name === key) {
      const parsed = Number(child);
      return Number.isFinite(parsed) ? parsed : null;
    }
    const nested = metadataNumber(child, key);
    if (nested !== null) return nested;
  }
  return null;
}

async function cogDirectory(create: boolean): Promise<FileSystemDirectoryHandle> {
  if (!navigator.storage?.getDirectory) throw new Error("This browser does not provide OPFS.");
  const root = await navigator.storage.getDirectory();
  const app = await root.getDirectoryHandle("epi-info-ai", { create });
  return app.getDirectoryHandle("gdal-cog-spike", { create });
}

async function writeOpfs(bytes: ArrayBuffer, fileName: string): Promise<"persistent" | "best-effort"> {
  const directory = await cogDirectory(true);
  const handle = await directory.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  try { await writable.write(bytes); await writable.close(); }
  catch (error) { await writable.abort().catch(() => undefined); throw error; }
  return await navigator.storage.persist?.().catch(() => false) ? "persistent" : "best-effort";
}

async function readOpfs(fileName: string): Promise<File> {
  const directory = await cogDirectory(false);
  return (await directory.getFileHandle(fileName)).getFile();
}

function startTimer(): number {
  const started = performance.now();
  timer = window.setInterval(() => { elapsed.textContent = `${((performance.now() - started) / 1000).toFixed(1)} s`; }, 100);
  return started;
}

function stopTimer(): void {
  if (timer) window.clearInterval(timer);
  timer = 0;
  coldButton.disabled = false;
  cancelButton.hidden = true;
}

async function validateWithGdal(bytes: ArrayBuffer, fileName: string): Promise<{ info: GdalDatasetInfo; statistics: Record<string, number | null> }> {
  if (!activeClient) {
    activeClient = new GdalWorkerClient(new URL("../runtime/", window.location.href));
    await activeClient.initialize();
  }
  const opened = await activeClient.call<GdalOpenedDataset>("open", new File([bytes], fileName, { type: "image/tiff" }));
  if (opened.datasets.length !== 1) throw new Error("GDAL could not open the extracted study-area GeoTIFF.");
  const dataset = opened.datasets[0]!;
  const info = await activeClient.call<GdalDatasetInfo>("getInfo", dataset);
  const detailed = await activeClient.call<{ bands?: Array<{ metadata?: unknown }> }>("gdalinfo", dataset, ["-stats"]);
  const statistics = {
    minimum: metadataNumber(detailed.bands?.[0]?.metadata, "STATISTICS_MINIMUM"),
    maximum: metadataNumber(detailed.bands?.[0]?.metadata, "STATISTICS_MAXIMUM"),
    mean: metadataNumber(detailed.bands?.[0]?.metadata, "STATISTICS_MEAN"),
    validPercent: metadataNumber(detailed.bands?.[0]?.metadata, "STATISTICS_VALID_PERCENT"),
  };
  await activeClient.call<void>("close", dataset);
  return { info, statistics };
}

const quantilePalette = ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"];

function paletteRgb(hex: string): [number, number, number] {
  return [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)];
}

async function renderQuantilePreview(values: TypedArray, width: number, height: number): Promise<{ bytes: Uint8Array; classification: QuantileClassification }> {
  const positive = Array.from(values, Number).filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (positive.length < 5) throw new Error("The extracted raster does not contain enough positive values for five quantile classes.");
  const breaks = [0.2, 0.4, 0.6, 0.8, 1].map((quantile) => positive[Math.min(positive.length - 1, Math.ceil(positive.length * quantile) - 1)]!);
  const classCounts = [0, 0, 0, 0, 0];
  let zeroCount = 0;
  let noDataCount = 0;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable.");
  const pixels = context.createImageData(width, height);
  const colors = quantilePalette.map(paletteRgb);
  for (let index = 0; index < values.length; index += 1) {
    const value = Number(values[index]);
    const offset = index * 4;
    let color: [number, number, number];
    if (!Number.isFinite(value) || value <= -99_998) {
      noDataCount += 1;
      color = [225, 232, 235];
    } else if (value <= 0) {
      zeroCount += 1;
      color = [247, 249, 250];
    } else {
      const classIndex = Math.min(4, breaks.findIndex((upper) => value <= upper) < 0 ? 4 : breaks.findIndex((upper) => value <= upper));
      classCounts[classIndex] += 1;
      color = colors[classIndex]!;
    }
    pixels.data[offset] = color[0];
    pixels.data[offset + 1] = color[1];
    pixels.data[offset + 2] = color[2];
    pixels.data[offset + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG preview encoding failed.")), "image/png"));
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    classification: { method: "five-quantile-positive-values", palette: [...quantilePalette], breaks, classCounts, zeroCount, noDataCount },
  };
}

function showLegend(classification: QuantileClassification): void {
  let lower = 0;
  legend.replaceChildren(...classification.breaks.map((upper, index) => {
    const item = document.createElement("span");
    const swatch = document.createElement("i");
    swatch.style.background = classification.palette[index]!;
    const label = document.createElement("b");
    label.textContent = `Q${index + 1}: ${lower.toLocaleString(undefined, { maximumFractionDigits: 2 })}–${upper.toLocaleString(undefined, { maximumFractionDigits: 2 })} (${classification.classCounts[index]!.toLocaleString()} cells)`;
    item.append(swatch, label);
    lower = upper;
    return item;
  }));
  legend.hidden = false;
}

function showPreview(bytes: Uint8Array): void {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  previewUrl = URL.createObjectURL(new Blob([buffer], { type: "image/png" }));
  preview.src = previewUrl;
  preview.hidden = false;
}

function installDownload(bytes: ArrayBuffer): void {
  if (downloadUrl) URL.revokeObjectURL(downloadUrl);
  downloadUrl = URL.createObjectURL(new Blob([bytes], { type: "image/tiff" }));
  downloadButton.disabled = false;
  downloadButton.onclick = () => {
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = storageFileName;
    link.click();
  };
}

coldButton.addEventListener("click", async () => {
  activeClient?.terminate("Starting a fresh COG experiment.");
  activeClient = null;
  controller?.abort();
  controller = new AbortController();
  coldButton.disabled = true;
  offlineButton.disabled = true;
  downloadButton.disabled = true;
  cancelButton.hidden = false;
  validation.dataset.state = "pending";
  validation.textContent = "Cold range validation pending.";
  const started = startTimer();
  try {
    status.textContent = "Checking source length and HTTP byte-range support…";
    const head = await fetch(sourceUrl, { method: "HEAD", cache: "no-store", signal: controller.signal });
    const declaredBytes = Number(head.headers.get("content-length"));
    if (!head.ok || head.headers.get("accept-ranges") !== "bytes" || declaredBytes !== sourceByteLength) throw new Error("The source server does not expose the reviewed byte length and Accept-Ranges: bytes.");
    const rangeRecords: RangeRecord[] = [];
    const nativeFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await nativeFetch(input, init);
      const requestUrl = new URL(input instanceof Request ? input.url : String(input), location.href);
      if (requestUrl.href === sourceUrl.href) {
        const requestRange = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).get("range") ?? "none";
        rangeRecords.push({ request: requestRange, status: response.status, bytes: Number(response.headers.get("content-length") ?? 0), contentRange: response.headers.get("content-range") });
      }
      return response;
    }) as typeof fetch;
    let image: GeoTIFFImage;
    let values: TypedArray;
    let ghostValues: Record<string, unknown> | null;
    try {
      const tiff = await fromUrl(sourceUrl.href, { allowFullFile: false, blockSize: 65_536, cacheSize: 32 }, controller.signal);
      image = await tiff.getImage();
      ghostValues = await tiff.getGhostValues();
      values = await image.readRasters({ window: [...pixelWindow], samples: [0], interleave: true, signal: controller.signal }) as TypedArray;
    } finally {
      globalThis.fetch = nativeFetch;
    }
    if (!ghostValues || ghostValues.LAYOUT !== "IFDS_BEFORE_DATA" || ghostValues.KNOWN_INCOMPATIBLE_EDITION !== "NO") throw new Error("The source does not expose the reviewed COG structural metadata.");
    const [originX, originY] = image.getOrigin();
    const [resolutionX, resolutionY] = image.getResolution();
    const width = pixelWindow[2] - pixelWindow[0];
    const height = pixelWindow[3] - pixelWindow[1];
    const windowOriginX = originX + pixelWindow[0] * resolutionX;
    const windowOriginY = originY + pixelWindow[1] * resolutionY;
    const windowBytes = writeArrayBuffer(values, {
      width, height, BitsPerSample: [32], SampleFormat: [3], SamplesPerPixel: 1,
      PhotometricInterpretation: 1, PlanarConfiguration: 1, RowsPerStrip: 32,
      ModelPixelScale: [Math.abs(resolutionX), Math.abs(resolutionY), 0],
      ModelTiepoint: [0, 0, 0, windowOriginX, windowOriginY, 0],
      GTModelTypeGeoKey: 2, GTRasterTypeGeoKey: 1, GeographicTypeGeoKey: 4326,
      GDAL_NODATA: "-99999",
    });
    const windowDigest = await sha256(windowBytes);
    const persistence = await writeOpfs(windowBytes, storageFileName);
    status.textContent = "Validating the bounded window in GDAL/WASM…";
    const gdal = await validateWithGdal(windowBytes, storageFileName);
    if (gdal.info.width !== width || gdal.info.height !== height || gdal.info.bandCount !== 1) throw new Error("GDAL reported unexpected window dimensions or bands.");
    const transferredBytes = rangeRecords.reduce((sum, item) => sum + item.bytes, 0);
    const rangeCount = rangeRecords.filter(({ status: code }) => code === 206).length;
    const reduction = 1 - transferredBytes / sourceByteLength;
    const failures: string[] = [];
    if (!rangeRecords.length || rangeRecords.some(({ status: code }) => code !== 206)) failures.push("not every COG request returned HTTP 206");
    if (transferredBytes >= sourceByteLength * 0.5) failures.push("the selected window transferred at least half of the complete COG");
    const quantilePreview = await renderQuantilePreview(values, width, height);
    const previewBuffer = quantilePreview.bytes.buffer.slice(quantilePreview.bytes.byteOffset, quantilePreview.bytes.byteOffset + quantilePreview.bytes.byteLength) as ArrayBuffer;
    const previewDigest = await sha256(previewBuffer);
    await writeOpfs(previewBuffer, storagePreviewFileName);
    const stored: StoredWindow = { schemaVersion: 2, fileName: storageFileName, byteLength: windowBytes.byteLength, sha256: windowDigest, sourceSha256, window: [...pixelWindow], statistics: gdal.statistics, classification: quantilePreview.classification, preview: { fileName: storagePreviewFileName, byteLength: previewBuffer.byteLength, sha256: previewDigest } };
    localStorage.setItem(storageKey, JSON.stringify(stored));
    sourceBytesOutput.textContent = sourceByteLength.toLocaleString();
    transferBytesOutput.textContent = transferredBytes.toLocaleString();
    savingsOutput.textContent = `${(reduction * 100).toFixed(1)}%`;
    rangeCountOutput.textContent = rangeCount.toLocaleString();
    showPreview(quantilePreview.bytes);
    showLegend(quantilePreview.classification);
    installDownload(windowBytes);
    const duration = Math.round((performance.now() - started) * 10) / 10;
    receipt = {
      schemaVersion: 1, operation: "cog-window-opfs-offline-replay",
      engine: { rangeAdapter: "geotiff.js 3.0.5", compute: "gdal3.js 2.8.1 / GDAL 3.8.4" },
      source: { url: sourceUrl.pathname, bytes: sourceByteLength, sha256: sourceSha256, cogStructuralMetadata: ghostValues, width: image.getWidth(), height: image.getHeight(), overviews: 3 },
      cold: { httpRangeRequired: true, records: rangeRecords, transferredBytes, transferReductionPercent: reduction * 100, pixelWindow: [...pixelWindow], output: { bytes: windowBytes.byteLength, sha256: windowDigest, width, height, statistics: gdal.statistics }, classification: { ...quantilePreview.classification, previewSha256: previewDigest }, opfs: { path: `epi-info-ai/gdal-cog-spike/${storageFileName}`, previewPath: `epi-info-ai/gdal-cog-spike/${storagePreviewFileName}`, persistence } },
      separationOfConcerns: "The range adapter owns network and OPFS authority. GDAL/WASM receives only the bounded extracted GeoTIFF.",
      elapsedMilliseconds: duration,
      failures,
    };
    receiptOutput.textContent = JSON.stringify(receipt, null, 2);
    validation.textContent = failures.length ? `Validation failed: ${failures.join("; ")}.` : `PASS — ${transferredBytes.toLocaleString()} of ${sourceByteLength.toLocaleString()} source bytes transferred (${(reduction * 100).toFixed(1)}% reduction); the verified window is stored in OPFS.`;
    validation.dataset.state = failures.length ? "failed" : "passed";
    status.textContent = `Cold extraction completed in ${(duration / 1000).toFixed(2)} seconds.`;
    offlineButton.disabled = failures.length > 0;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "COG range extraction failed.";
    validation.textContent = "Cold stage failed safely; offline replay was not enabled.";
    validation.dataset.state = "failed";
  } finally {
    stopTimer();
  }
});

offlineButton.addEventListener("click", async () => {
  offlineButton.disabled = true;
  coldButton.disabled = true;
  cancelButton.hidden = false;
  validation.dataset.state = "pending";
  validation.textContent = "Offline replay pending.";
  const started = startTimer();
  try {
    status.textContent = "Reading the extracted window from OPFS without requesting the source COG…";
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null") as StoredWindow | null;
    if (!stored || stored.schemaVersion !== 2 || stored.sourceSha256 !== sourceSha256) throw new Error("No compatible stored window metadata is available.");
    const file = await readOpfs(stored.fileName);
    const bytes = await file.arrayBuffer();
    const digest = await sha256(bytes);
    if (file.size !== stored.byteLength || digest !== stored.sha256) throw new Error("The OPFS window failed its length or SHA-256 integrity check.");
    const gdal = await validateWithGdal(bytes, stored.fileName);
    const statisticKeys = Object.keys(stored.statistics);
    if (statisticKeys.some((key) => gdal.statistics[key] !== stored.statistics[key])) throw new Error("Offline GDAL statistics differ from the cold-stage result.");
    const previewFile = await readOpfs(stored.preview.fileName);
    const previewBytes = await previewFile.arrayBuffer();
    if (previewFile.size !== stored.preview.byteLength || await sha256(previewBytes) !== stored.preview.sha256) throw new Error("The stored quantile preview failed its length or SHA-256 integrity check.");
    showPreview(new Uint8Array(previewBytes));
    showLegend(stored.classification);
    installDownload(bytes);
    const duration = Math.round((performance.now() - started) * 10) / 10;
    receipt = { ...receipt, offlineReplay: { sourceNetworkRequests: 0, opfsBytes: bytes.byteLength, sha256: digest, identicalDigest: true, identicalStatistics: true, identicalClassification: true, elapsedMilliseconds: duration } };
    receiptOutput.textContent = JSON.stringify(receipt, null, 2);
    validation.textContent = `PASS — offline replay read ${bytes.byteLength.toLocaleString()} OPFS bytes with no source request; digest and GDAL statistics are identical.`;
    validation.dataset.state = "passed";
    status.textContent = `Offline replay completed in ${(duration / 1000).toFixed(2)} seconds.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Offline replay failed.";
    validation.textContent = "Offline replay failed safely; no result was accepted.";
    validation.dataset.state = "failed";
  } finally {
    stopTimer();
    offlineButton.disabled = false;
  }
});

cancelButton.addEventListener("click", () => {
  controller?.abort();
  controller = null;
  activeClient?.terminate();
  activeClient = null;
  stopTimer();
  status.textContent = "Cancelled. Active range and GDAL operations were stopped.";
  validation.textContent = "Cancelled; no partial result was accepted.";
  validation.dataset.state = "failed";
});
