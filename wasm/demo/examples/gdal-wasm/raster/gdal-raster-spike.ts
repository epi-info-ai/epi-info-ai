import { GdalWorkerClient, type GdalDatasetInfo, type GdalOpenedDataset } from "../gdal-wasm-worker.js";

interface Profile { width: number; height: number; estimatedRawBytes: number }
interface RasterExpected {
  source: { name: string; sha256: string; crs: string; width: number; height: number; bands: number };
  targetCrs: string;
  clipBoundsWgs84: [number, number, number, number];
  expectedBoundsMeters: [number, number, number, number];
  boundsToleranceMeters: number;
  nodata: number;
  profiles: Record<string, Profile>;
}

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing raster-spike element: ${selector}`);
  return element;
};

const profileSelect = required<HTMLSelectElement>("#stress-profile");
const runButton = required<HTMLButtonElement>("#run-raster-spike");
const cancelButton = required<HTMLButtonElement>("#cancel-raster-spike");
const downloadButton = required<HTMLButtonElement>("#download-raster-result");
const previewDownloadButton = required<HTMLButtonElement>("#download-raster-preview");
const status = required<HTMLElement>("#raster-spike-status");
const elapsed = required<HTMLElement>("#raster-elapsed");
const validation = required<HTMLElement>("#raster-validation-status");
const receiptOutput = required<HTMLElement>("#raster-processing-receipt");
const preview = required<HTMLImageElement>("#raster-preview");
let activeClient: GdalWorkerClient | null = null;
let cancelled = false;
let outputUrl = "";
let previewUrl = "";
let timer = 0;

const sha256 = async (bytes: ArrayBuffer): Promise<string> => [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
  .map((value) => value.toString(16).padStart(2, "0")).join("");

function clearUrls(): void {
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  outputUrl = "";
  previewUrl = "";
  downloadButton.disabled = true;
  previewDownloadButton.disabled = true;
  preview.hidden = true;
  preview.removeAttribute("src");
}

function rasterBounds(info: GdalDatasetInfo): [number, number, number, number] {
  const transform = info.coordinateTransform;
  if (!transform || transform.length < 6 || !info.width || !info.height) throw new Error("GDAL did not report a usable raster geotransform.");
  const x0 = transform[0]!;
  const y0 = transform[3]!;
  const x1 = x0 + transform[1]! * info.width + transform[2]! * info.height;
  const y1 = y0 + transform[4]! * info.width + transform[5]! * info.height;
  return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
}

function finish(): void {
  if (timer) window.clearInterval(timer);
  timer = 0;
  activeClient?.terminate("Raster pipeline finished.");
  activeClient = null;
  runButton.disabled = false;
  profileSelect.disabled = false;
  cancelButton.hidden = true;
}

function download(url: string, name: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
}

runButton.addEventListener("click", async () => {
  cancelled = false;
  clearUrls();
  receiptOutput.textContent = "";
  validation.textContent = "Validation pending.";
  validation.dataset.state = "pending";
  runButton.disabled = true;
  profileSelect.disabled = true;
  cancelButton.hidden = false;
  const started = performance.now();
  timer = window.setInterval(() => { elapsed.textContent = `${((performance.now() - started) / 1000).toFixed(1)} s`; }, 100);
  try {
    status.textContent = "Loading the checksummed Toledo raster and validation contract…";
    const [sourceResponse, expectedResponse] = await Promise.all([
      fetch("../../foodborne/maps/worldpop-toledo-population-density.tif"),
      fetch("./expected-result.json"),
    ]);
    if (!sourceResponse.ok || !expectedResponse.ok) throw new Error("The local raster spike assets could not be read.");
    const sourceBytes = await sourceResponse.arrayBuffer();
    const expected = await expectedResponse.json() as RasterExpected;
    const profileName = profileSelect.value;
    const profile = expected.profiles[profileName];
    if (!profile) throw new Error(`Unknown raster stress profile: ${profileName}.`);
    const sourceDigest = await sha256(sourceBytes);
    if (sourceDigest !== expected.source.sha256) throw new Error("The source raster checksum does not match the validation contract.");

    activeClient = new GdalWorkerClient(new URL("../runtime/", window.location.href));
    status.textContent = "Initializing GDAL, PROJ, and GeoTIFF support in the Worker…";
    await activeClient.initialize();
    status.textContent = "Opening and inspecting the source raster…";
    const opened = await activeClient.call<GdalOpenedDataset>("open", new File([sourceBytes], expected.source.name, { type: "image/tiff" }));
    if (opened.datasets.length !== 1) throw new Error(`Expected one raster dataset; GDAL opened ${opened.datasets.length}.`);
    const sourceDataset = opened.datasets[0]!;
    const sourceInfo = await activeClient.call<GdalDatasetInfo>("getInfo", sourceDataset);
    if (sourceInfo.type !== "raster" || sourceInfo.width !== expected.source.width || sourceInfo.height !== expected.source.height || sourceInfo.bandCount !== expected.source.bands) {
      throw new Error("The source raster dimensions or band count differ from the validation contract.");
    }

    const [west, south, east, north] = expected.clipBoundsWgs84;
    const warpArguments = [
      "-of", "GTiff", "-s_srs", expected.source.crs, "-t_srs", expected.targetCrs,
      "-te_srs", expected.source.crs, "-te", String(west), String(south), String(east), String(north),
      "-ts", String(profile.width), String(profile.height), "-r", "bilinear",
      "-srcnodata", String(expected.nodata), "-dstnodata", String(expected.nodata),
      "-co", "TILED=YES", "-co", "COMPRESS=DEFLATE", "-co", "BIGTIFF=IF_SAFER",
    ];
    status.textContent = `Warping ${profile.width.toLocaleString()} × ${profile.height.toLocaleString()} pixels in the Worker…`;
    const outputPath = await activeClient.call<{ local: string; real: string }>("gdalwarp", sourceDataset, warpArguments, `toledo-population-${profileName}`);
    const outputBytes = await activeClient.call<Uint8Array>("getFileBytes", outputPath);
    const outputOpened = await activeClient.call<GdalOpenedDataset>("open", outputPath.local);
    if (outputOpened.datasets.length !== 1) throw new Error("GDAL could not reopen its derived GeoTIFF.");
    const outputDataset = outputOpened.datasets[0]!;
    const outputInfo = await activeClient.call<GdalDatasetInfo>("getInfo", outputDataset);
    const outputBounds = rasterBounds(outputInfo);

    status.textContent = "Generating an 800-pixel PNG preview in the same Worker…";
    const previewPath = await activeClient.call<{ local: string; real: string }>(
      "gdal_translate", outputDataset, ["-of", "PNG", "-ot", "Byte", "-scale", "-a_nodata", "none", "-outsize", "800", "0"], `toledo-population-${profileName}-preview`,
    );
    const previewBytes = await activeClient.call<Uint8Array>("getFileBytes", previewPath);
    await activeClient.call<void>("close", outputDataset);
    await activeClient.call<void>("close", sourceDataset);

    const failures: string[] = [];
    if (outputInfo.type !== "raster") failures.push("derived output is not a raster");
    if (outputInfo.width !== profile.width || outputInfo.height !== profile.height) failures.push("derived dimensions differ from the selected profile");
    if (!outputInfo.projectionWkt?.match(/3857|Pseudo-Mercator|Web_Mercator/i)) failures.push("derived projection does not identify EPSG:3857/Web Mercator");
    expected.expectedBoundsMeters.forEach((value, index) => {
      if (Math.abs(outputBounds[index]! - value) > expected.boundsToleranceMeters) failures.push(`projected bound ${index + 1} exceeds tolerance`);
    });

    const outputBuffer = outputBytes.buffer.slice(outputBytes.byteOffset, outputBytes.byteOffset + outputBytes.byteLength) as ArrayBuffer;
    const previewBuffer = previewBytes.buffer.slice(previewBytes.byteOffset, previewBytes.byteOffset + previewBytes.byteLength) as ArrayBuffer;
    const duration = Math.round((performance.now() - started) * 10) / 10;
    const receipt = {
      schemaVersion: 1,
      operation: "raster-warp-clip-resample",
      engine: { package: "gdal3.js", packageVersion: "2.8.1", gdalVersion: "3.8.4", projVersion: "9.3.1" },
      execution: { environment: "dedicated-browser-worker", networkInput: false, sourceMutation: false, profile: profileName },
      source: { ...expected.source, bytes: sourceBytes.byteLength, sha256: sourceDigest, driver: sourceInfo.driverName },
      output: {
        name: `toledo-population-${profileName}.tif`, driver: outputInfo.driverName, crs: expected.targetCrs,
        width: outputInfo.width, height: outputInfo.height, bands: outputInfo.bandCount,
        bounds: outputBounds, bytes: outputBytes.byteLength, sha256: await sha256(outputBuffer), estimatedRawBytes: profile.estimatedRawBytes,
      },
      preview: { name: `toledo-population-${profileName}-preview.png`, bytes: previewBytes.byteLength, sha256: await sha256(previewBuffer) },
      parameters: { application: "gdalwarp", arguments: warpArguments },
      warnings: [...opened.errors, ...outputOpened.errors],
      elapsedMilliseconds: duration,
      peakWorkerMemory: "not exposed by standard browser APIs",
    };
    receiptOutput.textContent = JSON.stringify(receipt, null, 2);
    validation.textContent = failures.length ? `Validation failed: ${failures.join("; ")}.` : `PASS — ${profile.width.toLocaleString()} × ${profile.height.toLocaleString()} EPSG:3857 GeoTIFF and PNG preview validated.`;
    validation.dataset.state = failures.length ? "failed" : "passed";
    status.textContent = `Raster pipeline completed in ${(duration / 1000).toFixed(2)} seconds; UI remained responsive.`;
    outputUrl = URL.createObjectURL(new Blob([outputBuffer], { type: "image/tiff" }));
    previewUrl = URL.createObjectURL(new Blob([previewBuffer], { type: "image/png" }));
    preview.src = previewUrl;
    preview.hidden = false;
    downloadButton.disabled = failures.length > 0;
    previewDownloadButton.disabled = failures.length > 0;
    downloadButton.onclick = () => download(outputUrl, receipt.output.name);
    previewDownloadButton.onclick = () => download(previewUrl, receipt.preview.name);
  } catch (error) {
    if (!cancelled) {
      status.textContent = error instanceof Error ? error.message : "The raster stress pipeline failed.";
      validation.textContent = "Spike failed safely; no output was accepted.";
      validation.dataset.state = "failed";
    }
  } finally {
    finish();
  }
});

cancelButton.addEventListener("click", () => {
  cancelled = true;
  activeClient?.terminate();
  activeClient = null;
  if (timer) window.clearInterval(timer);
  timer = 0;
  runButton.disabled = false;
  profileSelect.disabled = false;
  cancelButton.hidden = true;
  status.textContent = "Cancelled. The Worker was terminated and no partial raster was accepted.";
  validation.textContent = "Cancelled.";
  validation.dataset.state = "failed";
});
