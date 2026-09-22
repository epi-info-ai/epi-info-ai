import type { GisOperationV01, GisValidationStatusV01 } from "./contracts.ts";

export interface GisOperationDescriptorV01 {
  operation: GisOperationV01;
  implementationVersion: string;
  validationStatus: GisValidationStatusV01;
  mutatesSource: false;
  requiresWorker: true;
  description: string;
}

const descriptors: readonly GisOperationDescriptorV01[] = [
  { operation: "gis.dataset.inspect", implementationVersion: "0.1.0", validationStatus: "candidate", mutatesSource: false, requiresWorker: true, description: "Inventory a selected dataset without changing source bytes." },
  { operation: "gis.vector.normalize", implementationVersion: "0.1.0", validationStatus: "candidate", mutatesSource: false, requiresWorker: true, description: "Normalize one reviewed vector layer to GeoJSON in CRS84." },
  { operation: "gis.geometry.validate", implementationVersion: "0.1.0", validationStatus: "candidate", mutatesSource: false, requiresWorker: true, description: "Report geometry defects without repairing source geometry." },
  { operation: "gis.vector.spatialJoin", implementationVersion: "0.1.0", validationStatus: "candidate", mutatesSource: false, requiresWorker: true, description: "Run a bounded deterministic point-in-polygon join." },
];

export function listGisOperationsV01(): readonly GisOperationDescriptorV01[] {
  return descriptors;
}

export function getGisOperationV01(operation: GisOperationV01): GisOperationDescriptorV01 {
  const descriptor = descriptors.find((candidate) => candidate.operation === operation);
  if (!descriptor) throw new RangeError(`Unregistered Epi GIS operation: ${operation}`);
  return descriptor;
}
