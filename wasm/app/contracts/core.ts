export const PROJECT_SNAPSHOT_VERSION = 1 as const;

export type FieldType =
  | "text"
  | "text-uppercase"
  | "multiline"
  | "unique-id"
  | "number"
  | "phone"
  | "date"
  | "time"
  | "checkbox"
  | "yes-no"
  | "option";

export type RecordValue = string | number | boolean | null;
export type EpiRecord = Record<string, RecordValue>;

export interface FieldDefinition {
  name: string;
  prompt: string;
  type: FieldType;
  required: boolean;
}

export interface FormSchema {
  name: string;
  fields: FieldDefinition[];
}

export interface ProjectForm {
  id: string;
  schema: FormSchema;
  records: EpiRecord[];
}

export interface BrowserStorageLocation {
  type: "browser";
}

export interface SupabaseStorageLocation {
  type: "supabase";
}

export type ProjectStorageLocation = BrowserStorageLocation | SupabaseStorageLocation;

export interface HostedProjectReference {
  id: string;
  revision: number;
}

export interface ProjectSnapshotV1 {
  version?: typeof PROJECT_SNAPSHOT_VERSION;
  name: string;
  currentFormId: string;
  storage?: ProjectStorageLocation;
  remote?: HostedProjectReference;
  forms: ProjectForm[];
}

export interface MapPoint {
  record: EpiRecord;
  recordIndex: number;
  latitude: number;
  longitude: number;
}
