import type { FieldDefinition } from "../contracts/core.ts";
import { CLASSIC_AST_VERSION, parseClassicProgram } from "./classic-ast.ts";
import type { ClassicSessionVariableDefinition } from "./classic-assignment.ts";

export const CLASSIC_GROUP_PLAN_VERSION = "0.1.0" as const;
export interface ClassicGroupDefinition { name: string; members: string[] }
export interface ClassicDefineGroupPlan extends ClassicGroupDefinition {
  kind: "define-group";
  version: typeof CLASSIC_GROUP_PLAN_VERSION;
  astVersion: typeof CLASSIC_AST_VERSION;
  source: string;
  canonicalSource: string;
}

const key = (name: string): string => name.toLocaleLowerCase("en-US");
const token = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) throw new RangeError("Group and member names cannot be empty.");
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed) ? trimmed : `[${trimmed}]`;
};

export function buildClassicDefineGroupCommand(name: string, members: readonly string[]): string {
  if (!members.length) throw new RangeError("DEFINE GROUPVAR requires at least one member variable.");
  if (new Set(members.map(key)).size !== members.length) throw new RangeError("Each GROUPVAR member may appear only once.");
  return `DEFINE ${token(name)} GROUPVAR ${members.map(token).join(" ")}`;
}

export function resolveClassicDefineGroupCommand(
  source: string,
  fields: readonly FieldDefinition[],
  variables: readonly ClassicSessionVariableDefinition[],
  groups: readonly ClassicGroupDefinition[],
): ClassicDefineGroupPlan {
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "DefineGroupStatement") throw new RangeError("Select exactly one complete DEFINE GROUPVAR command.");
  const statement = ast.body[0];
  const groupKey = key(statement.group.name);
  if (fields.some((field) => key(field.name) === groupKey) || variables.some((variable) => key(variable.name) === groupKey)) {
    throw new RangeError(`${statement.group.name} is already a field or scalar variable and cannot be a group name.`);
  }
  if (groups.some((group) => key(group.name) === groupKey)) throw new RangeError(`${statement.group.name} is already a defined group in this Classic session.`);
  const available = new Map<string, string>();
  for (const field of fields) available.set(key(field.name), field.name);
  for (const variable of variables) available.set(key(variable.name), variable.name);
  const members: string[] = [];
  const seen = new Set<string>();
  for (const requested of statement.members) {
    const memberKey = key(requested.name);
    if (seen.has(memberKey)) throw new RangeError(`${requested.name} appears more than once in the group.`);
    seen.add(memberKey);
    const resolved = available.get(memberKey);
    if (!resolved) {
      if (groups.some((group) => key(group.name) === memberKey)) throw new RangeError("Nested GROUPVAR membership remains fail-closed in this slice.");
      throw new RangeError(`${requested.name} is not a current field or Standard variable.`);
    }
    members.push(resolved);
  }
  const name = statement.group.name;
  return {
    kind: "define-group", version: CLASSIC_GROUP_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION, source,
    canonicalSource: buildClassicDefineGroupCommand(name, members), name, members,
  };
}

export function expandClassicGroupNames(names: readonly string[], groups: readonly ClassicGroupDefinition[]): string[] {
  const groupMap = new Map(groups.map((group) => [key(group.name), group]));
  const expanded: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const members = groupMap.get(key(name))?.members ?? [name];
    for (const member of members) {
      const memberKey = key(member);
      if (!seen.has(memberKey)) { seen.add(memberKey); expanded.push(member); }
    }
  }
  return expanded;
}
