import type { AdvancedSpatialOperationV01 } from "./advanced-spatial-contracts.ts";

export interface AdvancedSpatialOperationDescriptorV01 {
  operation: AdvancedSpatialOperationV01;
  implementationVersion: "0.1.0";
  validationStatus: "unvalidated" | "candidate" | "validated";
  executionStatus: "planned";
  requiresWorker: true;
  mutatesSource: false;
  description: string;
}

const descriptors: readonly AdvancedSpatialOperationDescriptorV01[] = [
  { operation: "gis.spatial.weights", implementationVersion: "0.1.0", validationStatus: "unvalidated", executionStatus: "planned", requiresWorker: true, mutatesSource: false, description: "Build deterministic spatial weights from a reviewed geometry input." },
  { operation: "gis.spatial.moran", implementationVersion: "0.1.0", validationStatus: "unvalidated", executionStatus: "planned", requiresWorker: true, mutatesSource: false, description: "Compute global Moran's I only after an independently validated weights plan." },
  { operation: "gis.spatial.lisa", implementationVersion: "0.1.0", validationStatus: "unvalidated", executionStatus: "planned", requiresWorker: true, mutatesSource: false, description: "Compute local indicators of spatial association with explicit permutation policy." },
  { operation: "gis.spatial.getisOrd", implementationVersion: "0.1.0", validationStatus: "unvalidated", executionStatus: "planned", requiresWorker: true, mutatesSource: false, description: "Compute governed Getis-Ord hotspot statistics." },
  { operation: "gis.spatial.h3Aggregate", implementationVersion: "0.1.0", validationStatus: "unvalidated", executionStatus: "planned", requiresWorker: true, mutatesSource: false, description: "Aggregate point observations into bounded H3 cells." },
  { operation: "gis.spatial.density", implementationVersion: "0.1.0", validationStatus: "unvalidated", executionStatus: "planned", requiresWorker: true, mutatesSource: false, description: "Produce a bounded density surface from signed WGS84 coordinates." },
  { operation: "gis.spatial.cluster", implementationVersion: "0.1.0", validationStatus: "unvalidated", executionStatus: "planned", requiresWorker: true, mutatesSource: false, description: "Run a reviewed spatial cluster method with explicit parameters and limits." },
  { operation: "gis.geometry.repair", implementationVersion: "0.1.0", validationStatus: "unvalidated", executionStatus: "planned", requiresWorker: true, mutatesSource: false, description: "Report or apply only a bounded, source-preserving geometry repair policy." },
  { operation: "gis.raster.zonalStatistics", implementationVersion: "0.1.0", validationStatus: "unvalidated", executionStatus: "planned", requiresWorker: true, mutatesSource: false, description: "Compute bounded raster statistics by an explicit zone field and NoData policy." },
];

export function listAdvancedSpatialOperationsV01(): readonly AdvancedSpatialOperationDescriptorV01[] { return descriptors; }

export function getAdvancedSpatialOperationV01(operation: AdvancedSpatialOperationV01): AdvancedSpatialOperationDescriptorV01 {
  const descriptor = descriptors.find((candidate) => candidate.operation === operation);
  if (!descriptor) throw new RangeError(`Unregistered K09 advanced spatial operation: ${operation}`);
  return descriptor;
}
