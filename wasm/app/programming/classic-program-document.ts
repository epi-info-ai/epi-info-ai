import type { ProjectProgram } from "../contracts/project-package.ts";

export const CLASSIC_PROGRAM_FILE_EXTENSION = ".pgm7";
export const MAX_CLASSIC_PROGRAM_BYTES = 1024 * 1024;

export type ClassicProgramOrigin = "untitled" | "project" | "file";

export interface ClassicProgramDocumentState {
  name: string;
  source: string;
  savedSource: string;
  origin: ClassicProgramOrigin;
  author?: string;
  comment?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export function normalizeClassicProgramName(value: string): string {
  const name = value.trim().replace(/\.pgm7$/i, "");
  if (!name) throw new RangeError("Enter a program name.");
  if (name.length > 100) throw new RangeError("Program names are limited to 100 characters.");
  if (/[\\/:*?"<>|\u0000-\u001f]/.test(name)) throw new RangeError("Program names cannot contain file-path characters.");
  return name;
}

export function safeClassicProgramFileName(name: string): string {
  return `${normalizeClassicProgramName(name).replace(/\s+/g, "-")}${CLASSIC_PROGRAM_FILE_EXTENSION}`;
}

export async function readClassicProgramFile(file: File): Promise<{ name: string; source: string }> {
  if (!file.name.toLowerCase().endsWith(CLASSIC_PROGRAM_FILE_EXTENSION)) throw new RangeError("Choose an Epi Info .pgm7 program file.");
  if (file.size > MAX_CLASSIC_PROGRAM_BYTES) throw new RangeError("Program files are limited to 1 MB.");
  const source = (await file.text()).replace(/^\uFEFF/, "");
  if (source.includes("\u0000")) throw new RangeError("The selected program is not a text .pgm7 file.");
  return { name: normalizeClassicProgramName(file.name), source };
}

export class ClassicProgramDocumentService {
  #state: ClassicProgramDocumentState = { name: "Untitled", source: "", savedSource: "", origin: "untitled" };

  get state(): Readonly<ClassicProgramDocumentState> { return { ...this.#state }; }
  isDirty(source: string): boolean { return source !== this.#state.savedSource; }
  newDocument(source = ""): void { this.#state = { name: "Untitled", source, savedSource: source, origin: "untitled" }; }
  open(program: Pick<ProjectProgram, "name" | "source" | "author" | "comment" | "createdAt" | "modifiedAt">, origin: Exclude<ClassicProgramOrigin, "untitled">): void {
    this.#state = { name: normalizeClassicProgramName(program.name), source: program.source, savedSource: program.source, origin,
      ...(program.author ? { author: program.author } : {}), ...(program.comment ? { comment: program.comment } : {}),
      ...(program.createdAt ? { createdAt: program.createdAt } : {}), ...(program.modifiedAt ? { modifiedAt: program.modifiedAt } : {}) };
  }
  markSaved(name: string, source: string, origin: Exclude<ClassicProgramOrigin, "untitled">, metadata: Partial<Pick<ProjectProgram, "author" | "comment" | "createdAt" | "modifiedAt">> = {}): void {
    this.open({ name, source, ...metadata }, origin);
  }
}
