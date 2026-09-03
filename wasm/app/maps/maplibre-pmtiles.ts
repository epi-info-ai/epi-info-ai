import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import type { BrowserPmtilesSource } from "./pmtiles-reader.ts";

const PROTOCOL = "epi-pmtiles";
const registeredSources = new Map<string, BrowserPmtilesSource>();
let protocolRegistered = false;
let mapLibrePromise: Promise<typeof import("maplibre-gl")> | null = null;

export interface MapLibrePmtilesOverlay {
  layerCount: number;
  loaded: Promise<void>;
  resize(): void;
  setView(longitude: number, latitude: number, zoom: number): void;
  remove(): void;
}

interface VectorLayerMetadata {
  id: string;
}

function tileArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function vectorLayerIds(metadata: Readonly<Record<string, unknown>>): string[] {
  const layers = metadata.vector_layers;
  if (!Array.isArray(layers)) return [];
  return [...new Set(layers.flatMap((candidate): string[] => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const id = (candidate as Partial<VectorLayerMetadata>).id;
    return typeof id === "string" && id.trim() ? [id.trim()] : [];
  }))];
}

function ensureProtocol(maplibregl: typeof import("maplibre-gl")): void {
  if (protocolRegistered) return;
  maplibregl.addProtocol(PROTOCOL, async (request, abortController) => {
    const match = /^epi-pmtiles:\/\/([a-f0-9]{64})\/(\d+)\/(\d+)\/(\d+)\.mvt(?:\?.*)?$/.exec(request.url);
    if (!match) throw new Error("The offline vector-tile request is malformed.");
    const source = registeredSources.get(match[1]!);
    if (!source) throw new Error("The offline vector-tile source is no longer active.");
    if (abortController.signal.aborted) throw new DOMException("The offline vector-tile request was cancelled.", "AbortError");
    const tile = await source.getTile(Number(match[2]), Number(match[3]), Number(match[4]));
    if (!tile) throw new Error("The offline PMTiles archive does not contain the requested vector tile.");
    return { data: tileArrayBuffer(tile) };
  });
  protocolRegistered = true;
}

function colorForLayer(index: number): string {
  return ["#2f7f9d", "#3f8f65", "#9b6b42", "#765a9e", "#a04f67", "#5e7d38"][index % 6]!;
}

export function vectorPmtilesStyle(source: BrowserPmtilesSource): StyleSpecification {
  const layerIds = vectorLayerIds(source.metadata);
  if (layerIds.length === 0) {
    throw new Error("This MVT archive does not declare vector_layers metadata, so Epi Info AI cannot style it safely.");
  }
  return {
    version: 8,
    sources: {
      offline: {
        type: "vector",
        tiles: [`${PROTOCOL}://${source.asset.id}/{z}/{x}/{y}.mvt`],
        minzoom: source.header.minZoom,
        maxzoom: source.header.maxZoom,
        attribution: `${source.asset.attribution} · ${source.asset.license}`,
      },
    },
    layers: layerIds.flatMap((sourceLayer, index) => {
      const color = colorForLayer(index);
      const safeId = `${index}-${sourceLayer.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
      return [
        {
          id: `${safeId}-fill`,
          type: "fill" as const,
          source: "offline",
          "source-layer": sourceLayer,
          paint: { "fill-color": color, "fill-opacity": 0.34 },
        },
        {
          id: `${safeId}-line`,
          type: "line" as const,
          source: "offline",
          "source-layer": sourceLayer,
          paint: { "line-color": color, "line-width": 1.4, "line-opacity": 0.9 },
        },
        {
          id: `${safeId}-circle`,
          type: "circle" as const,
          source: "offline",
          "source-layer": sourceLayer,
          paint: { "circle-color": color, "circle-radius": 3.5, "circle-stroke-color": "#ffffff", "circle-stroke-width": 0.8 },
        },
      ];
    }),
  };
}

export async function createMapLibrePmtilesOverlay(
  container: HTMLElement,
  source: BrowserPmtilesSource,
  onError: (message: string) => void,
): Promise<MapLibrePmtilesOverlay> {
  mapLibrePromise ||= import("maplibre-gl");
  const maplibregl = await mapLibrePromise;
  ensureProtocol(maplibregl);
  registeredSources.set(source.asset.id, source);
  const style = vectorPmtilesStyle(source);
  const map: MapLibreMap = new maplibregl.Map({
    container,
    style,
    center: [0, 0],
    zoom: source.header.minZoom,
    interactive: false,
    attributionControl: false,
    renderWorldCopies: true,
    fadeDuration: 0,
  });
  map.on("error", (event) => onError(event.error?.message || "Unable to render an offline vector tile."));
  let removed = false;
  const loaded = new Promise<void>((resolve, reject) => {
    map.once("load", () => resolve());
    map.once("error", (event) => reject(event.error || new Error("Unable to initialize the offline vector map.")));
  });
  return {
    layerCount: style.layers.length / 3,
    loaded,
    resize: () => map.resize(),
    setView: (longitude, latitude, zoom) => map.jumpTo({ center: [longitude, latitude], zoom }),
    remove: () => {
      if (removed) return;
      removed = true;
      map.remove();
      registeredSources.delete(source.asset.id);
    },
  };
}
