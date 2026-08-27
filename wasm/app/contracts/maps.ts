import type { EpiRecord, FieldDefinition, MapPoint } from "./core.js";

export type MapLaunchContext = "standalone" | "current-form";

export interface MapDataSource {
  formId: string;
  projectName: string;
  formName: string;
  fields: FieldDefinition[];
  records: EpiRecord[];
}

export interface MapFieldSelection {
  latitude: string;
  longitude: string;
  label: string;
}

export interface BrowserCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export type LegacyMapLayerKind =
  | "case-cluster"
  | "choropleth"
  | "dot-density"
  | "point"
  | "reference"
  | "marker"
  | "text"
  | "zone";

export type BrowserMapLayerKind = "geojson" | "h3" | "current-location" | "raster";
export type MapLayerKind = LegacyMapLayerKind | BrowserMapLayerKind;

export type MapGeometryFamily = "raster" | "polygon" | "line" | "point";

export interface MapLayerIdentity {
  id: string;
  name: string;
  kind: MapLayerKind;
  visible: boolean;
  order: number;
}

export interface RecordMapLayerDefinition extends MapLayerIdentity {
  kind: "case-cluster" | "point" | "h3";
  sourceFormId: string;
  fields: MapFieldSelection;
  filter?: string;
}

export interface GeoJsonMapLayerDefinition extends MapLayerIdentity {
  kind: "geojson" | "reference" | "choropleth" | "dot-density";
  sourceName: string;
  labelProperty?: string;
  coordinateReferenceSystem?: string;
}

export interface OverlayMapLayerDefinition extends MapLayerIdentity {
  kind: "marker" | "text" | "zone" | "current-location" | "raster";
}

export type MapLayerDefinition =
  | RecordMapLayerDefinition
  | GeoJsonMapLayerDefinition
  | OverlayMapLayerDefinition;

export type CurrentMapDataProvider = () => MapDataSource;
export type ProjectMapDataProvider = () => MapDataSource[];
export type OpenRecordHandler = (formId: string, recordIndex: number) => boolean;

export interface MapsInitializationOptions {
  getCurrentMapData: CurrentMapDataProvider;
  getProjectDataSources: ProjectMapDataProvider;
  onOpenRecord: OpenRecordHandler;
}

export interface InferredMapFields extends MapFieldSelection {
  date: string;
  time: string;
}

export interface H3CellAggregate {
  cell: string;
  count: number;
  points: MapPoint[];
}

export interface TimeLapseStop {
  timestamp: number;
  label: string;
  points: MapPoint[];
}

export type GeoJsonScalar = string | number | boolean | null;
export type GeoJsonProperties = Record<string, unknown>;
export type GeoJsonPosition = number[];
export type GeoJsonCoordinates = GeoJsonPosition | GeoJsonCoordinates[];

export interface GeoJsonGeometry {
  type: "Point" | "MultiPoint" | "LineString" | "MultiLineString" | "Polygon" | "MultiPolygon";
  coordinates: GeoJsonCoordinates;
}

export interface GeoJsonGeometryCollection {
  type: "GeometryCollection";
  geometries: Array<GeoJsonGeometry | GeoJsonGeometryCollection>;
}

export type SupportedGeoJsonGeometry = GeoJsonGeometry | GeoJsonGeometryCollection;

export interface GeoJsonFeature {
  type: "Feature";
  properties: GeoJsonProperties | null;
  geometry: SupportedGeoJsonGeometry | null;
}

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
}

export type SupportedGeoJson = GeoJsonFeatureCollection | GeoJsonFeature | SupportedGeoJsonGeometry;

export interface ParsedGeoJson {
  geojson: SupportedGeoJson;
  featureCount: number;
}
