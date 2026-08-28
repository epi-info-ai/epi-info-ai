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
  };
  programs: ClassicProgramExample[];
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
    },
    programs,
  };
}

export async function loadClassicProgramExampleCatalog(url: URL | string): Promise<ClassicProgramExampleCatalog> {
  const response = await fetch(url);
  if (!response.ok) throw new ClassicProgramCatalogError(`Unable to load example program catalog (${response.status}).`);
  return validateClassicProgramExampleCatalog(await response.json() as unknown);
}
