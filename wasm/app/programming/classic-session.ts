import type { MapDataSource } from "../contracts/maps.ts";

export class ClassicProgramSession {
  #source: MapDataSource | null = null;
  #explicitRead = false;

  reset(source: MapDataSource): void {
    this.#source = structuredClone(source);
    this.#explicitRead = false;
  }
  syncDefault(source: MapDataSource): void {
    if (!this.#explicitRead) this.#source = structuredClone(source);
  }
  current(fallback: MapDataSource): MapDataSource { return structuredClone(this.#source ?? fallback); }
  read(formName: string, sources: readonly MapDataSource[]): MapDataSource {
    const matches = sources.filter((source) => source.formName.toLocaleLowerCase("en-US") === formName.toLocaleLowerCase("en-US"));
    if (matches.length === 0) throw new RangeError(`${formName} is not a form in the current project.`);
    if (matches.length > 1) throw new RangeError(`${formName} is ambiguous in the current project.`);
    this.#source = structuredClone(matches[0]!);
    this.#explicitRead = true;
    return structuredClone(this.#source);
  }
}
