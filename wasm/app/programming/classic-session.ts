import type { MapDataSource } from "../contracts/maps.ts";
import { applyClassicSort, type ClassicSortPlan } from "./classic-sort.ts";
import type { ClassicSessionVariableDefinition, ClassicVariableValue } from "./classic-assignment.ts";

export interface ClassicSessionVariable extends ClassicSessionVariableDefinition { value: ClassicVariableValue }

export class ClassicProgramSession {
  #source: MapDataSource | null = null;
  #explicitRead = false;
  #selectedRecords: MapDataSource["records"] | null = null;
  #selectionCriteria: string[] = [];
  #excludedMissing = 0;
  #sortPlan: Extract<ClassicSortPlan, { kind: "apply" }> | null = null;
  #variables = new Map<string, ClassicSessionVariable>();

  #clearSelection(): void {
    this.#selectedRecords = null;
    this.#selectionCriteria = [];
    this.#excludedMissing = 0;
  }
  #clearSort(): void { this.#sortPlan = null; }
  #clearVariables(): void { this.#variables.clear(); }

  reset(source: MapDataSource): void {
    this.#source = structuredClone(source);
    this.#explicitRead = false;
    this.#clearSelection();
    this.#clearSort();
    this.#clearVariables();
  }
  syncDefault(source: MapDataSource): void {
    if (!this.#explicitRead) {
      this.#source = structuredClone(source);
      this.#clearSelection();
      this.#clearSort();
      this.#clearVariables();
    }
  }
  current(fallback: MapDataSource): MapDataSource {
    const source = structuredClone(this.#source ?? fallback);
    source.records = structuredClone(this.#selectedRecords ?? source.records);
    if (this.#sortPlan) source.records = applyClassicSort(source.records, this.#sortPlan);
    return source;
  }
  filtered(fallback: MapDataSource): MapDataSource {
    const source = structuredClone(this.#source ?? fallback);
    source.records = structuredClone(this.#selectedRecords ?? source.records);
    return source;
  }
  base(fallback: MapDataSource): MapDataSource { return structuredClone(this.#source ?? fallback); }
  select(records: MapDataSource["records"], canonicalCriterion: string, excludedMissing: number): void {
    this.#selectedRecords = structuredClone(records);
    this.#selectionCriteria.push(canonicalCriterion.replace(/^SELECT\s+/i, ""));
    this.#excludedMissing += excludedMissing;
  }
  cancelSelection(): boolean {
    const hadSelection = this.#selectionCriteria.length > 0;
    this.#clearSelection();
    return hadSelection;
  }
  sort(plan: Extract<ClassicSortPlan, { kind: "apply" }>): void { this.#sortPlan = structuredClone(plan); }
  cancelSort(): boolean { const hadSort = this.#sortPlan !== null; this.#clearSort(); return hadSort; }
  sortStatus(): { canonicalSource?: string; fields: number } {
    return this.#sortPlan ? { canonicalSource: this.#sortPlan.canonicalSource, fields: this.#sortPlan.items.length } : { fields: 0 };
  }
  variables(): ClassicSessionVariable[] { return [...this.#variables.values()].map((variable) => structuredClone(variable)); }
  defineVariable(definition: ClassicSessionVariableDefinition): ClassicSessionVariable {
    const key = definition.name.toLocaleLowerCase("en-US");
    if (this.#variables.has(key)) throw new RangeError(`${definition.name} is already defined in this Classic session.`);
    const variable = { ...structuredClone(definition), value: null };
    this.#variables.set(key, variable);
    return structuredClone(variable);
  }
  assignVariable(name: string, value: ClassicVariableValue): ClassicSessionVariable {
    const key = name.toLocaleLowerCase("en-US");
    const variable = this.#variables.get(key);
    if (!variable) throw new RangeError(`${name} is not defined in this Classic session.`);
    variable.value = value;
    return structuredClone(variable);
  }
  undefineVariable(name: string): ClassicSessionVariable {
    const key = name.toLocaleLowerCase("en-US");
    const variable = this.#variables.get(key);
    if (!variable) throw new RangeError(`${name} is not defined in this Classic session.`);
    this.#variables.delete(key);
    return structuredClone(variable);
  }
  undefineAllStandard(): ClassicSessionVariable[] {
    const removed = this.variables();
    this.#clearVariables();
    return removed;
  }
  selectionStatus(fallback: MapDataSource): { total: number; selected: number; excluded: number; excludedMissing: number; canonicalSource?: string } {
    const base = this.#source ?? fallback;
    const selected = this.#selectedRecords?.length ?? base.records.length;
    return {
      total: base.records.length, selected, excluded: base.records.length - selected, excludedMissing: this.#excludedMissing,
      ...(this.#selectionCriteria.length ? { canonicalSource: `SELECT ${this.#selectionCriteria.map((criterion) => `(${criterion})`).join(" AND ")}` } : {}),
    };
  }
  read(formName: string, sources: readonly MapDataSource[]): MapDataSource {
    const matches = sources.filter((source) => source.formName.toLocaleLowerCase("en-US") === formName.toLocaleLowerCase("en-US"));
    if (matches.length === 0) throw new RangeError(`${formName} is not a form in the current project.`);
    if (matches.length > 1) throw new RangeError(`${formName} is ambiguous in the current project.`);
    this.#source = structuredClone(matches[0]!);
    this.#explicitRead = true;
    this.#clearSelection();
    this.#clearSort();
    this.#clearVariables();
    return structuredClone(this.#source);
  }
}
