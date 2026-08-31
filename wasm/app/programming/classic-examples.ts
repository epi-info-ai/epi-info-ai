import type { DatasetProvenance, FieldDefinition, FieldType } from "../contracts/core.js";

export const CLASSIC_PROGRAM_CATALOG_VERSION = 1 as const;

export interface ClassicProgramExample {
  id: string;
  title: string;
  description: string;
  requiredFields: string[];
  source: string;
}

export interface ClassicProgramExampleCatalog {
  schemaVersion: typeof CLASSIC_PROGRAM_CATALOG_VERSION;
  dataset: {
    id: string;
    file: string;
    sha256: string;
    recordCount: number;
    fieldTypes: Record<string, FieldType>;
  };
  programs: ClassicProgramExample[];
}

export interface ClassicProgramExampleAvailability {
  example: ClassicProgramExample;
  compatible: boolean;
  issues: string[];
}

export interface ClassicProgramCatalogAvailability {
  datasetMatches: boolean;
  message: string;
  programs: ClassicProgramExampleAvailability[];
}

export class ClassicProgramCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClassicProgramCatalogError";
  }
}

function objectValue(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ClassicProgramCatalogError(`${path} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ClassicProgramCatalogError(`${path} must be a non-empty string.`);
  return value;
}

const FIELD_TYPES: ReadonlySet<FieldType> = new Set([
  "text", "text-uppercase", "multiline", "unique-id", "number", "phone", "date", "time", "checkbox", "yes-no", "option", "command-button",
]);

export function validateClassicProgramExampleCatalog(value: unknown): ClassicProgramExampleCatalog {
  const catalog = objectValue(value, "catalog");
  if (catalog.schemaVersion !== CLASSIC_PROGRAM_CATALOG_VERSION) {
    throw new ClassicProgramCatalogError(`catalog.schemaVersion must be ${CLASSIC_PROGRAM_CATALOG_VERSION}.`);
  }
  const dataset = objectValue(catalog.dataset, "catalog.dataset");
  if (typeof dataset.recordCount !== "number" || !Number.isSafeInteger(dataset.recordCount) || dataset.recordCount < 0) {
    throw new ClassicProgramCatalogError("catalog.dataset.recordCount must be a non-negative integer.");
  }
  const sha256 = stringValue(dataset.sha256, "catalog.dataset.sha256");
  if (!/^[a-f0-9]{64}$/i.test(sha256)) throw new ClassicProgramCatalogError("catalog.dataset.sha256 must be a SHA-256 digest.");
  const rawFieldTypes = objectValue(dataset.fieldTypes, "catalog.dataset.fieldTypes");
  const fieldTypes = Object.fromEntries(Object.entries(rawFieldTypes).map(([name, value]) => {
    const type = stringValue(value, `catalog.dataset.fieldTypes.${name}`) as FieldType;
    if (!FIELD_TYPES.has(type)) throw new ClassicProgramCatalogError(`catalog.dataset.fieldTypes.${name} is not a supported field type.`);
    return [name, type];
  }));
  if (!Array.isArray(catalog.programs) || catalog.programs.length === 0) {
    throw new ClassicProgramCatalogError("catalog.programs must contain at least one program.");
  }
  const ids = new Set<string>();
  const programs = catalog.programs.map((item, index): ClassicProgramExample => {
    const program = objectValue(item, `catalog.programs[${index}]`);
    const id = stringValue(program.id, `catalog.programs[${index}].id`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new ClassicProgramCatalogError(`catalog.programs[${index}].id must be a kebab-case identifier.`);
    if (ids.has(id)) throw new ClassicProgramCatalogError(`catalog.programs contains duplicate id ${JSON.stringify(id)}.`);
    ids.add(id);
    if (!Array.isArray(program.requiredFields) || program.requiredFields.length === 0) {
      throw new ClassicProgramCatalogError(`catalog.programs[${index}].requiredFields must contain at least one field.`);
    }
    return {
      id,
      title: stringValue(program.title, `catalog.programs[${index}].title`),
      description: stringValue(program.description, `catalog.programs[${index}].description`),
      requiredFields: program.requiredFields.map((field, fieldIndex) => stringValue(field, `catalog.programs[${index}].requiredFields[${fieldIndex}]`)),
      source: stringValue(program.source, `catalog.programs[${index}].source`).replace(/\r\n?/g, "\n"),
    };
  });
  return {
    schemaVersion: CLASSIC_PROGRAM_CATALOG_VERSION,
    dataset: {
      id: stringValue(dataset.id, "catalog.dataset.id"),
      file: stringValue(dataset.file, "catalog.dataset.file"),
      sha256: sha256.toLowerCase(),
      recordCount: dataset.recordCount,
      fieldTypes,
    },
    programs,
  };
}

export function assessClassicProgramCatalog(
  catalog: ClassicProgramExampleCatalog,
  source: { dataset?: DatasetProvenance; fields: readonly FieldDefinition[]; recordCount: number },
): ClassicProgramCatalogAvailability {
  const datasetMatches = source.dataset
    && (source.dataset.id === catalog.dataset.id || source.dataset.sha256 === catalog.dataset.sha256);
  if (!datasetMatches) {
    return {
      datasetMatches: false,
      message: `Load the ${catalog.dataset.id.replace(/-/g, " ")} example dataset to use its programs.`,
      programs: catalog.programs.map((example) => ({ example, compatible: false, issues: ["The current form is not bound to this dataset."] })),
    };
  }
  if (source.recordCount === 0) {
    return {
      datasetMatches: false,
      message: "Import the dataset records before loading its example programs.",
      programs: catalog.programs.map((example) => ({ example, compatible: false, issues: ["The current form has no dataset records."] })),
    };
  }

  const fields = new Map(source.fields.map((field) => [field.name.toLowerCase(), field]));
  const programs = catalog.programs.map((example): ClassicProgramExampleAvailability => {
    const issues = example.requiredFields.flatMap((requiredName) => {
      const field = fields.get(requiredName.toLowerCase());
      if (!field) return [`Missing field ${requiredName}.`];
      const expectedType = catalog.dataset.fieldTypes[requiredName];
      if (expectedType && field.type !== expectedType) return [`${requiredName} must be ${expectedType}, not ${field.type}.`];
      return [];
    });
    return { example, compatible: issues.length === 0, issues };
  });
  const compatibleCount = programs.filter((program) => program.compatible).length;
  return {
    datasetMatches: true,
    message: compatibleCount > 0
      ? `${compatibleCount} compatible program${compatibleCount === 1 ? "" : "s"} available for the current dataset.`
      : "The current dataset is identified, but none of its example programs match this form's field names and data types.",
    programs,
  };
}

export async function loadClassicProgramExampleCatalog(url: URL | string): Promise<ClassicProgramExampleCatalog> {
  const response = await fetch(url);
  if (!response.ok) throw new ClassicProgramCatalogError(`Unable to load example program catalog (${response.status}).`);
  return validateClassicProgramExampleCatalog(await response.json() as unknown);
}
