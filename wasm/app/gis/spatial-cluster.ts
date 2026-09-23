/** K09-S7: deterministic candidate spatial cluster methods. */

export type SpatialClusterMethodV01 = "dbscan" | "scan-circle";
export interface SpatialClusterPlanV01 {
  schema: "epi-gis-spatial-cluster/0.1";
  planId: string;
  method: SpatialClusterMethodV01;
  radiusMeters: number;
  minPoints: number;
  maxObservations: number;
}
export interface SpatialClusterObservationV01 { id: string; latitude: number | null; longitude: number | null; }
export interface SpatialClusterV01 { id: string; memberIds: readonly string[]; centerId: string; center: readonly [longitude: number, latitude: number]; memberCount: number; overlapping: boolean; }
export interface SpatialClusterResultV01 {
  schema: "epi-gis-spatial-cluster-result/0.1";
  planId: string;
  method: SpatialClusterMethodV01;
  clusters: readonly SpatialClusterV01[];
  noiseIds: readonly string[];
  diagnostics: readonly { code: "missing-coordinate" | "invalid-coordinate"; observationId: string; message: string }[];
  validationStatus: "candidate";
}
export class SpatialClusterErrorV01 extends Error { constructor(message: string) { super(message); this.name = "SpatialClusterErrorV01"; } }

const EARTH_RADIUS_METERS = 6_371_008.8;
function distanceMeters(left: SpatialClusterObservationV01, right: SpatialClusterObservationV01): number {
  const radians = Math.PI / 180;
  const lat1 = left.latitude! * radians;
  const lat2 = right.latitude! * radians;
  const deltaLat = (right.latitude! - left.latitude!) * radians;
  const deltaLon = (right.longitude! - left.longitude!) * radians;
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, a)));
}
function validatePlan(plan: SpatialClusterPlanV01): void {
  if (plan.schema !== "epi-gis-spatial-cluster/0.1") throw new SpatialClusterErrorV01("Unsupported spatial-cluster schema.");
  if (!plan.planId.trim()) throw new SpatialClusterErrorV01("A spatial-cluster plan id is required.");
  if (plan.method !== "dbscan" && plan.method !== "scan-circle") throw new SpatialClusterErrorV01("method must be dbscan or scan-circle.");
  if (!Number.isFinite(plan.radiusMeters) || plan.radiusMeters <= 0 || plan.radiusMeters > 1_000_000) throw new SpatialClusterErrorV01("radiusMeters must be greater than zero and no greater than 1000000.");
  if (!Number.isSafeInteger(plan.minPoints) || plan.minPoints < 2 || plan.minPoints > 100_000) throw new SpatialClusterErrorV01("minPoints must be an integer from 2 through 100000.");
  if (!Number.isSafeInteger(plan.maxObservations) || plan.maxObservations < plan.minPoints || plan.maxObservations > 1_000_000) throw new SpatialClusterErrorV01("maxObservations must be an integer from minPoints through 1000000.");
}
export function createSpatialClusterPlanV01(input: Omit<SpatialClusterPlanV01, "schema">): SpatialClusterPlanV01 { const plan = { schema: "epi-gis-spatial-cluster/0.1", ...input } as SpatialClusterPlanV01; validatePlan(plan); return plan; }

export function detectSpatialClustersV01(plan: SpatialClusterPlanV01, observationsInput: readonly SpatialClusterObservationV01[]): SpatialClusterResultV01 {
  validatePlan(plan);
  if (observationsInput.length > plan.maxObservations) throw new SpatialClusterErrorV01("The observation count exceeds maxObservations.");
  const diagnostics: Array<{ code: "missing-coordinate" | "invalid-coordinate"; observationId: string; message: string }> = [];
  const seen = new Set<string>();
  const observations: SpatialClusterObservationV01[] = [];
  for (const observation of [...observationsInput].sort((left, right) => left.id.localeCompare(right.id))) {
    if (!observation.id.trim()) throw new SpatialClusterErrorV01("Observation ids must be non-empty.");
    if (seen.has(observation.id)) throw new SpatialClusterErrorV01(`Observation id is duplicated: ${observation.id}.`);
    seen.add(observation.id);
    if (observation.latitude === null || observation.latitude === undefined || observation.longitude === null || observation.longitude === undefined) { diagnostics.push({ code: "missing-coordinate", observationId: observation.id, message: `Observation ${observation.id} has a missing coordinate.` }); continue; }
    if (!Number.isFinite(observation.latitude) || !Number.isFinite(observation.longitude) || observation.latitude < -90 || observation.latitude > 90 || observation.longitude < -180 || observation.longitude > 180) { diagnostics.push({ code: "invalid-coordinate", observationId: observation.id, message: `Observation ${observation.id} is outside WGS84 latitude/longitude ranges.` }); continue; }
    observations.push(observation);
  }
  if (observations.length < plan.minPoints) throw new SpatialClusterErrorV01("At least minPoints valid observations are required.");
  const neighbors = (index: number): number[] => observations.map((_, candidate) => candidate).filter((candidate) => distanceMeters(observations[index]!, observations[candidate]!) <= plan.radiusMeters);
  const clusters: SpatialClusterV01[] = [];
  const noise = new Set<number>();
  if (plan.method === "dbscan") {
    const visited = new Set<number>();
    const assigned = new Set<number>();
    for (let index = 0; index < observations.length; index += 1) {
      if (visited.has(index)) continue;
      visited.add(index);
      const seed = neighbors(index);
      if (seed.length < plan.minPoints) { noise.add(index); continue; }
      const members = new Set<number>(seed);
      const queue = [...seed];
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (!visited.has(current)) {
          visited.add(current);
          const currentNeighbors = neighbors(current);
          if (currentNeighbors.length >= plan.minPoints) for (const neighbor of currentNeighbors) if (!members.has(neighbor)) { members.add(neighbor); queue.push(neighbor); }
        }
        assigned.add(current);
        noise.delete(current);
      }
      const memberIds = [...members].sort((left, right) => observations[left]!.id.localeCompare(observations[right]!.id)).map((member) => observations[member]!.id);
      const centerId = memberIds[0]!;
      const centerObservation = observations.find((observation) => observation.id === centerId)!;
      clusters.push({ id: `cluster-${clusters.length + 1}`, memberIds, centerId, center: [centerObservation.longitude!, centerObservation.latitude!], memberCount: memberIds.length, overlapping: false });
      void assigned;
    }
    for (let index = 0; index < observations.length; index += 1) if (!clusters.some((cluster) => cluster.memberIds.includes(observations[index]!.id))) noise.add(index);
  } else {
    const candidates = observations.map((observation, index) => ({ center: observation, members: neighbors(index).map((member) => observations[member]!) })).filter((candidate) => candidate.members.length >= plan.minPoints).sort((left, right) => right.members.length - left.members.length || left.center.id.localeCompare(right.center.id));
    for (const candidate of candidates) clusters.push({ id: `circle-${clusters.length + 1}`, memberIds: candidate.members.map((member) => member.id).sort(), centerId: candidate.center.id, center: [candidate.center.longitude!, candidate.center.latitude!], memberCount: candidate.members.length, overlapping: true });
    const memberIds = new Set(clusters.flatMap((cluster) => cluster.memberIds));
    for (const observation of observations) if (!memberIds.has(observation.id)) noise.add(observations.indexOf(observation));
  }
  return { schema: "epi-gis-spatial-cluster-result/0.1", planId: plan.planId, method: plan.method, clusters, noiseIds: [...noise].sort((left, right) => observations[left]!.id.localeCompare(observations[right]!.id)).map((index) => observations[index]!.id), diagnostics, validationStatus: "candidate" };
}
