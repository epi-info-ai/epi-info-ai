import { parseClassicProgram } from "./classic-ast.ts";
import type { ClassicSessionVariableDefinition } from "./classic-assignment.ts";

export const EPIAI_GIS_INSPECT_VERSION = "epi-ai-gis-inspect-v0.1.0" as const;

export interface EpiAiGisInspectCommandInput {
  fileVariable: string;
  resultName: string;
  declaredCrs: "CRS84" | "EPSG:4326";
}

export interface EpiAiGisInspectPlan extends EpiAiGisInspectCommandInput {
  version: typeof EPIAI_GIS_INSPECT_VERSION;
  canonicalSource: string;
}

function identifierToken(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name)) throw new RangeError("GIS variable names must be valid Epi Info identifiers.");
  return name;
}

export function buildEpiAiGisInspectCommand(input: EpiAiGisInspectCommandInput): string {
  return `EPIAI GIS INSPECT FILE=${identifierToken(input.fileVariable)} RESULT=${identifierToken(input.resultName)} CRS=${input.declaredCrs}`;
}

export function resolveEpiAiGisInspectCommand(
  source: string,
  variables: readonly ClassicSessionVariableDefinition[],
): EpiAiGisInspectPlan {
  const parsed = parseClassicProgram(source);
  if (parsed.body.length !== 1 || parsed.body[0]!.type !== "EpiAiGisInspectStatement") throw new RangeError("EPIAI GIS INSPECT requires FILE=variable and RESULT=name.");
  const statement = parsed.body[0]!;
  const fileVariable = variables.find((variable) => variable.name.toLocaleLowerCase("en-US") === statement.fileVariable.name.toLocaleLowerCase("en-US"));
  if (!fileVariable) throw new RangeError(`EPIAI GIS INSPECT requires a defined file variable named ${statement.fileVariable.name}.`);
  if (fileVariable.variableType !== "TEXTINPUT") throw new RangeError(`EPIAI GIS INSPECT FILE=${fileVariable.name} requires a TEXTINPUT variable bound by DIALOG ... READ.`);
  const resultName = identifierToken(statement.resultName.name);
  return {
    fileVariable: fileVariable.name,
    resultName,
    declaredCrs: statement.declaredCrs,
    version: EPIAI_GIS_INSPECT_VERSION,
    canonicalSource: buildEpiAiGisInspectCommand({ fileVariable: fileVariable.name, resultName, declaredCrs: statement.declaredCrs }),
  };
}
