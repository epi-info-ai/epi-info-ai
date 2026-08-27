import type {
  ConfidenceInterval,
  BoundaryNumber,
  DatasetStratifiedTable2x2Derivation,
  DatasetStratifiedTable2x2Request,
  DatasetFrequencyRequest,
  DatasetMeansRequest,
  DatasetRateRequest,
  FisherExactResult,
  FrequencyResult,
  MeansResult,
  RateResult,
  PopulationSurveyInput,
  PopulationSurveyResult,
  MidPExactResult,
  StratifiedTable2x2Input,
  StratifiedTable2x2Result,
  Table2x2Input,
  Table2x2Result,
} from "../app/contracts/engine.js";
import type { EpiRecord } from "../app/contracts/core.js";

const ENGINE = Object.freeze({
  id: "epi-core-wasm",
  version: "0.8.0",
  operation: "epi.table2x2",
} as const);

type WasmNumericFunction = (...values: number[]) => number;

interface EpiWasmExports {
  risk_exposed: WasmNumericFunction;
  risk_unexposed: WasmNumericFunction;
  odds_ratio: WasmNumericFunction;
  risk_ratio: WasmNumericFunction;
  risk_difference: WasmNumericFunction;
  odds_ratio_ci_lower: WasmNumericFunction;
  odds_ratio_ci_upper: WasmNumericFunction;
  risk_ratio_ci_lower: WasmNumericFunction;
  risk_ratio_ci_upper: WasmNumericFunction;
  risk_difference_ci_lower: WasmNumericFunction;
  risk_difference_ci_upper: WasmNumericFunction;
  pearson_chi_square: WasmNumericFunction;
  mantel_haenszel_chi_square: WasmNumericFunction;
  yates_chi_square: WasmNumericFunction;
  chi_square_p_value: WasmNumericFunction;
  fisher_exact_left: WasmNumericFunction;
  fisher_exact_right: WasmNumericFunction;
  fisher_exact_one_tailed: WasmNumericFunction;
  fisher_exact_two_tailed: WasmNumericFunction;
  mid_p_exact_left: WasmNumericFunction;
  mid_p_exact_right: WasmNumericFunction;
  mid_p_exact_one_tailed: WasmNumericFunction;
  conditional_odds_ratio: WasmNumericFunction;
  conditional_odds_ratio_fisher_lower: WasmNumericFunction;
  conditional_odds_ratio_fisher_upper: WasmNumericFunction;
  conditional_odds_ratio_mid_p_lower: WasmNumericFunction;
  conditional_odds_ratio_mid_p_upper: WasmNumericFunction;
  stratified_set_table: WasmNumericFunction;
  stratified_mh_odds_ratio: WasmNumericFunction;
  stratified_mh_odds_ratio_ci_lower: WasmNumericFunction;
  stratified_mh_odds_ratio_ci_upper: WasmNumericFunction;
  stratified_mh_risk_ratio: WasmNumericFunction;
  stratified_mh_risk_ratio_ci_lower: WasmNumericFunction;
  stratified_mh_risk_ratio_ci_upper: WasmNumericFunction;
  stratified_mh_chi_square_uncorrected: WasmNumericFunction;
  stratified_mh_chi_square_corrected: WasmNumericFunction;
  stratified_breslow_day_odds_ratio: WasmNumericFunction;
  stratified_breslow_day_tarone_odds_ratio: WasmNumericFunction;
  stratified_legacy_woolf_odds_ratio: WasmNumericFunction;
  stratified_legacy_woolf_risk_ratio: WasmNumericFunction;
  stratified_conditional_odds_ratio: WasmNumericFunction;
  stratified_conditional_odds_ratio_fisher_lower: WasmNumericFunction;
  stratified_conditional_odds_ratio_fisher_upper: WasmNumericFunction;
  chi_square_p_value_df: WasmNumericFunction;
  frequency_proportion: WasmNumericFunction;
  frequency_ci_lower: WasmNumericFunction;
  frequency_ci_upper: WasmNumericFunction;
  means_reset: WasmNumericFunction;
  means_set_value: WasmNumericFunction;
  means_prepare: WasmNumericFunction;
  means_sum: WasmNumericFunction;
  means_mean: WasmNumericFunction;
  means_sample_variance: WasmNumericFunction;
  means_sample_std_dev: WasmNumericFunction;
  means_minimum: WasmNumericFunction;
  means_quartile_25: WasmNumericFunction;
  means_median: WasmNumericFunction;
  means_quartile_75: WasmNumericFunction;
  means_maximum: WasmNumericFunction;
  means_mode: WasmNumericFunction;
  rate_calculate: WasmNumericFunction;
  population_survey_cluster_size: WasmNumericFunction;
}

function validateWasmExports(exports: WebAssembly.Exports): EpiWasmExports {
  const required = [
    "risk_exposed",
    "risk_unexposed",
    "odds_ratio",
    "risk_ratio",
    "risk_difference",
    "odds_ratio_ci_lower",
    "odds_ratio_ci_upper",
    "risk_ratio_ci_lower",
    "risk_ratio_ci_upper",
    "risk_difference_ci_lower",
    "risk_difference_ci_upper",
    "pearson_chi_square",
    "mantel_haenszel_chi_square",
    "yates_chi_square",
    "chi_square_p_value",
    "fisher_exact_left",
    "fisher_exact_right",
    "fisher_exact_one_tailed",
    "fisher_exact_two_tailed",
    "mid_p_exact_left",
    "mid_p_exact_right",
    "mid_p_exact_one_tailed",
    "conditional_odds_ratio",
    "conditional_odds_ratio_fisher_lower",
    "conditional_odds_ratio_fisher_upper",
    "conditional_odds_ratio_mid_p_lower",
    "conditional_odds_ratio_mid_p_upper",
    "stratified_set_table",
    "stratified_mh_odds_ratio",
    "stratified_mh_odds_ratio_ci_lower",
    "stratified_mh_odds_ratio_ci_upper",
    "stratified_mh_risk_ratio",
    "stratified_mh_risk_ratio_ci_lower",
    "stratified_mh_risk_ratio_ci_upper",
    "stratified_mh_chi_square_uncorrected",
    "stratified_mh_chi_square_corrected",
    "stratified_breslow_day_odds_ratio",
    "stratified_breslow_day_tarone_odds_ratio",
    "stratified_legacy_woolf_odds_ratio",
    "stratified_legacy_woolf_risk_ratio",
    "stratified_conditional_odds_ratio",
    "stratified_conditional_odds_ratio_fisher_lower",
    "stratified_conditional_odds_ratio_fisher_upper",
    "frequency_proportion",
    "frequency_ci_lower",
    "frequency_ci_upper",
    "means_reset",
    "means_set_value",
    "means_prepare",
    "means_sum",
    "means_mean",
    "means_sample_variance",
    "means_sample_std_dev",
    "means_minimum",
    "means_quartile_25",
    "means_median",
    "means_quartile_75",
    "means_maximum",
    "means_mode",
    "rate_calculate",
    "population_survey_cluster_size",
    "chi_square_p_value_df",
  ] as const;
  const validated = {} as EpiWasmExports;
  for (const name of required) {
    const value = exports[name];
    if (typeof value !== "function") throw new Error(`The WASM engine is missing its ${name} function.`);
    validated[name] = value as WasmNumericFunction;
  }
  return validated;
}

async function loadWasm(): Promise<EpiWasmExports> {
  const response = await fetch(new URL("./epi2x2.wasm", import.meta.url));
  if (!response.ok) throw new Error(`Unable to load the WASM engine (${response.status}).`);

  if (WebAssembly.instantiateStreaming) {
    try {
      return validateWasmExports((await WebAssembly.instantiateStreaming(response.clone(), {})).instance.exports);
    } catch {
      // Some development servers do not send application/wasm.
    }
  }
  return validateWasmExports((await WebAssembly.instantiate(await response.arrayBuffer(), {})).instance.exports);
}

const WASM = await loadWasm();

function wasmNumber(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

const Z_VALUES = new Map<number, number>([
  [0.9, 1.6448536269514722],
  [0.95, 1.959963984540054],
  [0.99, 2.5758293035489004],
]);

function fisherExact(a: number, b: number, c: number, d: number): FisherExactResult | null {
  const result = {
    left: WASM.fisher_exact_left(a, b, c, d),
    right: WASM.fisher_exact_right(a, b, c, d),
    oneTailed: WASM.fisher_exact_one_tailed(a, b, c, d),
    twoTailed: WASM.fisher_exact_two_tailed(a, b, c, d),
  };
  return Object.values(result).every(Number.isFinite) ? result : null;
}

function midPExact(a: number, b: number, c: number, d: number): MidPExactResult | null {
  const result = {
    left: WASM.mid_p_exact_left(a, b, c, d),
    right: WASM.mid_p_exact_right(a, b, c, d),
    oneTailed: WASM.mid_p_exact_one_tailed(a, b, c, d),
  };
  return Object.values(result).every(Number.isFinite) ? result : null;
}

function wasmInterval(lower: number, upper: number): ConfidenceInterval | null {
  return Number.isFinite(lower) && Number.isFinite(upper) ? { lower, upper } : null;
}

function boundaryNumber(value: number): BoundaryNumber {
  if (value === Number.POSITIVE_INFINITY) return { value: null, state: "positive-infinity" };
  if (!Number.isFinite(value)) return { value: null, state: "unavailable" };
  if (value === 0) return { value: 0, state: "zero" };
  return { value, state: "finite" };
}

function validate(input: Table2x2Input): void {
  const cells = [input.exposedCases, input.exposedNonCases, input.unexposedCases, input.unexposedNonCases];
  if (cells.some((cell) => !Number.isSafeInteger(cell) || cell < 0)) {
    throw new RangeError("Cell counts must be non-negative safe whole numbers.");
  }
  if (cells.every((cell) => cell === 0)) {
    throw new RangeError("Enter at least one observation.");
  }
  if (!Z_VALUES.has(input.confidenceLevel)) {
    throw new RangeError("Confidence level must be 0.90, 0.95, or 0.99.");
  }
}

export function calculateTable2x2(input: Table2x2Input): Table2x2Result {
  validate(input);

  const a = input.exposedCases;
  const b = input.exposedNonCases;
  const c = input.unexposedCases;
  const d = input.unexposedNonCases;
  const confidenceLevel = input.confidenceLevel;
  const z = Z_VALUES.get(confidenceLevel)!;
  const exposedTotal = a + b;
  const unexposedTotal = c + d;
  const casesTotal = a + c;
  const nonCasesTotal = b + d;
  const total = exposedTotal + unexposedTotal;
  const denominator = exposedTotal * unexposedTotal * casesTotal * nonCasesTotal;
  const crossProductDifference = a * d - b * c;
  const riskExposed = wasmNumber(WASM.risk_exposed(a, b));
  const riskUnexposed = wasmNumber(WASM.risk_unexposed(c, d));
  const oddsRatio = wasmNumber(WASM.odds_ratio(a, b, c, d));
  const riskRatio = wasmNumber(WASM.risk_ratio(a, b, c, d));
  const riskDifference = wasmNumber(WASM.risk_difference(a, b, c, d));

  const oddsRatioCi = wasmInterval(
    WASM.odds_ratio_ci_lower(a, b, c, d, z),
    WASM.odds_ratio_ci_upper(a, b, c, d, z),
  );
  const riskRatioCi = wasmInterval(
    WASM.risk_ratio_ci_lower(a, b, c, d, z),
    WASM.risk_ratio_ci_upper(a, b, c, d, z),
  );
  const riskDifferenceCi = wasmInterval(
    WASM.risk_difference_ci_lower(a, b, c, d, z),
    WASM.risk_difference_ci_upper(a, b, c, d, z),
  );

  const pearson = wasmNumber(WASM.pearson_chi_square(a, b, c, d));
  const mantelHaenszel = wasmNumber(WASM.mantel_haenszel_chi_square(a, b, c, d));
  const yates = wasmNumber(WASM.yates_chi_square(a, b, c, d));
  const fisher = fisherExact(a, b, c, d);
  const midP = midPExact(a, b, c, d);
  const conditionalOddsRatio = {
    estimate: boundaryNumber(WASM.conditional_odds_ratio(a, b, c, d)),
    fisherConfidenceInterval: {
      lower: boundaryNumber(WASM.conditional_odds_ratio_fisher_lower(a, b, c, d, confidenceLevel)),
      upper: boundaryNumber(WASM.conditional_odds_ratio_fisher_upper(a, b, c, d, confidenceLevel)),
    },
    midPConfidenceInterval: {
      lower: boundaryNumber(WASM.conditional_odds_ratio_mid_p_lower(a, b, c, d, confidenceLevel)),
      upper: boundaryNumber(WASM.conditional_odds_ratio_mid_p_upper(a, b, c, d, confidenceLevel)),
    },
  };

  const expected = denominator > 0
    ? [
        (exposedTotal * casesTotal) / total,
        (exposedTotal * nonCasesTotal) / total,
        (unexposedTotal * casesTotal) / total,
        (unexposedTotal * nonCasesTotal) / total,
      ]
    : [];

  const warnings: string[] = [];
  if ([a, b, c, d].some((cell) => cell === 0)) {
    warnings.push("At least one cell is zero; some estimates and confidence intervals are undefined.");
  }
  if (expected.length > 0 && Math.min(...expected) < 5) {
    warnings.push("An expected cell count is below 5; prefer the Fisher exact result over asymptotic chi-square tests.");
  }
  if (exposedTotal === 0 || unexposedTotal === 0) {
    warnings.push("One exposure group has no observations, so risk comparisons cannot be calculated.");
  }
  if (fisher === null || midP === null) {
    warnings.push("Exact tests are unavailable because the fixed-margin support exceeds 100,000 tables or numerical limits.");
  }
  if (conditionalOddsRatio.estimate.state === "unavailable"
      || conditionalOddsRatio.fisherConfidenceInterval.lower.state === "unavailable"
      || conditionalOddsRatio.fisherConfidenceInterval.upper.state === "unavailable"
      || conditionalOddsRatio.midPConfidenceInterval.lower.state === "unavailable"
      || conditionalOddsRatio.midPConfidenceInterval.upper.state === "unavailable") {
    warnings.push("Conditional odds-ratio estimation or an exact confidence limit is unavailable because the margins are uninformative or numerical limits were reached.");
  }

  return {
    schemaVersion: "0.4.0",
    operation: ENGINE.operation,
    engine: { ...ENGINE },
    input: { ...input },
    methods: {
      riskRatioConfidenceInterval: "katz-log",
      oddsRatioConfidenceInterval: "wald-log",
      riskDifferenceConfidenceInterval: "wald-unpooled",
      chiSquarePValue: "chi-square-survival-df1-erfc",
      fisherExact: "conditional-hypergeometric-probability-ordering-epi-info-1.000001",
      midPExact: "conditional-hypergeometric-half-observed",
      conditionalOddsRatio: "conditional-noncentral-hypergeometric-mean-root",
      fisherExactOddsRatioConfidenceInterval: "conditional-noncentral-hypergeometric-central-tail-inversion",
      midPExactOddsRatioConfidenceInterval: "conditional-noncentral-hypergeometric-mid-p-tail-inversion",
    },
    totals: { exposed: exposedTotal, unexposed: unexposedTotal, cases: casesTotal, nonCases: nonCasesTotal, overall: total },
    estimates: {
      riskExposed,
      riskUnexposed,
      riskRatio: { estimate: riskRatio, confidenceInterval: riskRatioCi },
      oddsRatio: { estimate: oddsRatio, confidenceInterval: oddsRatioCi },
      riskDifference: { estimate: riskDifference, confidenceInterval: riskDifferenceCi },
      conditionalOddsRatio,
    },
    tests: {
      pearson: pearson === null ? null : { value: pearson, pValue: WASM.chi_square_p_value(pearson), degreesOfFreedom: 1 },
      mantelHaenszel: mantelHaenszel === null ? null : { value: mantelHaenszel, pValue: WASM.chi_square_p_value(mantelHaenszel), degreesOfFreedom: 1 },
      yates: yates === null ? null : { value: yates, pValue: WASM.chi_square_p_value(yates), degreesOfFreedom: 1 },
      fisherExact: fisher,
      midPExact: midP,
    },
    diagnostics: { expectedCellCounts: expected, warnings },
  };
}

export function calculateStratifiedTable2x2(input: StratifiedTable2x2Input): StratifiedTable2x2Result {
  if (input.strata.length === 0 || input.strata.length > 1024) {
    throw new RangeError("Enter between 1 and 1,024 strata.");
  }
  const z = Z_VALUES.get(input.confidenceLevel);
  if (z === undefined) throw new RangeError("Confidence level must be 0.90, 0.95, or 0.99.");
  const seen = new Set<string>();
  let informativeStrata = 0;
  input.strata.forEach((stratum, index) => {
    if (!stratum.id || seen.has(stratum.id)) throw new RangeError("Each stratum needs a unique ID.");
    seen.add(stratum.id);
    const cells = [stratum.exposedCases, stratum.exposedNonCases, stratum.unexposedCases, stratum.unexposedNonCases];
    if (cells.some((cell) => !Number.isSafeInteger(cell) || cell < 0)) {
      throw new RangeError(`Stratum ${stratum.label || index + 1} contains an invalid cell count.`);
    }
    if (cells.some((cell) => cell > 0)) informativeStrata += 1;
    if (WASM.stratified_set_table(index, ...cells) !== 1) {
      throw new RangeError(`Stratum ${stratum.label || index + 1} could not be loaded into the WASM kernel.`);
    }
  });
  if (informativeStrata === 0) throw new RangeError("Enter at least one observation.");

  const count = input.strata.length;
  const adjustedOddsRatio = wasmNumber(WASM.stratified_mh_odds_ratio(count));
  const adjustedRiskRatio = wasmNumber(WASM.stratified_mh_risk_ratio(count));
  const oddsInterval = wasmInterval(
    WASM.stratified_mh_odds_ratio_ci_lower(count, z),
    WASM.stratified_mh_odds_ratio_ci_upper(count, z),
  );
  const riskInterval = wasmInterval(
    WASM.stratified_mh_risk_ratio_ci_lower(count, z),
    WASM.stratified_mh_risk_ratio_ci_upper(count, z),
  );
  const uncorrected = wasmNumber(WASM.stratified_mh_chi_square_uncorrected(count));
  const corrected = wasmNumber(WASM.stratified_mh_chi_square_corrected(count));
  const degreesOfFreedom = count - 1;
  const breslowDay = wasmNumber(WASM.stratified_breslow_day_odds_ratio(count));
  const breslowDayTarone = wasmNumber(WASM.stratified_breslow_day_tarone_odds_ratio(count));
  const legacyBreslowDay = wasmNumber(WASM.stratified_legacy_woolf_odds_ratio(count));
  const legacyBreslowDayRiskRatio = wasmNumber(WASM.stratified_legacy_woolf_risk_ratio(count));
  const adjustedConditionalOddsRatio = {
    estimate: boundaryNumber(WASM.stratified_conditional_odds_ratio(count)),
    fisherConfidenceInterval: {
      lower: boundaryNumber(WASM.stratified_conditional_odds_ratio_fisher_lower(count, input.confidenceLevel)),
      upper: boundaryNumber(WASM.stratified_conditional_odds_ratio_fisher_upper(count, input.confidenceLevel)),
    },
  };
  const warnings: string[] = [];
  if (informativeStrata < count) warnings.push("Empty strata were ignored by the estimates and tests.");
  if (adjustedOddsRatio === null || oddsInterval === null) warnings.push("The adjusted odds ratio or its confidence interval is undefined for these strata.");
  if (adjustedRiskRatio === null || riskInterval === null) warnings.push("The adjusted risk ratio or its confidence interval is undefined for these strata.");
  if (breslowDay === null || breslowDayTarone === null) warnings.push("Fixed-margin odds-ratio homogeneity tests require at least two informative strata and a finite positive common odds ratio.");
  if (legacyBreslowDay === null) warnings.push("The legacy Epi Info odds-ratio homogeneity result is unavailable when any stratum contains a zero cell.");
  if (legacyBreslowDayRiskRatio === null) warnings.push("The legacy Epi Info risk-ratio homogeneity result requires at least two strata, positive case counts in both exposure groups, and non-zero log-risk variance.");
  if (adjustedConditionalOddsRatio.estimate.state === "unavailable"
      || adjustedConditionalOddsRatio.fisherConfidenceInterval.lower.state === "unavailable"
      || adjustedConditionalOddsRatio.fisherConfidenceInterval.upper.state === "unavailable") {
    warnings.push("Exact adjusted odds-ratio inference exceeded its reviewed support or work limit, received unsupported margins, or did not converge.");
  }

  return {
    schemaVersion: "0.8.0",
    operation: "epi.stratified2x2",
    engine: { id: "epi-core-wasm", version: "0.8.0", operation: "epi.stratified2x2" },
    input: { confidenceLevel: input.confidenceLevel, strata: input.strata.map((stratum) => ({ ...stratum })) },
    methods: {
      oddsRatio: "mantel-haenszel",
      oddsRatioConfidenceInterval: "robins-breslow-greenland-legacy-epi-info",
      riskRatio: "mantel-haenszel",
      riskRatioConfidenceInterval: "legacy-epi-info-log",
      associationTest: "mantel-haenszel",
      breslowDayOddsRatio: "fixed-margin-expected-cell-common-mh-or",
      breslowDayTaroneOddsRatio: "fixed-margin-expected-cell-tarone-correction-common-mh-or",
      legacyBreslowDayOddsRatio: "woolf-weighted-log-odds-dispersion-legacy-epi-info-label",
      legacyBreslowDayRiskRatio: "woolf-weighted-log-risk-dispersion-legacy-epi-info-label",
      conditionalOddsRatio: "conditional-product-hypergeometric-mean-root",
      fisherExactOddsRatioConfidenceInterval: "conditional-product-hypergeometric-central-tail-inversion",
    },
    estimates: {
      adjustedOddsRatio: { estimate: adjustedOddsRatio, confidenceInterval: oddsInterval },
      adjustedRiskRatio: { estimate: adjustedRiskRatio, confidenceInterval: riskInterval },
      adjustedConditionalOddsRatio,
    },
    tests: {
      mantelHaenszelUncorrected: uncorrected === null ? null : { value: uncorrected, pValue: WASM.chi_square_p_value(uncorrected), degreesOfFreedom: 1 },
      mantelHaenszelCorrected: corrected === null ? null : { value: corrected, pValue: WASM.chi_square_p_value(corrected), degreesOfFreedom: 1 },
      breslowDayOddsRatio: breslowDay === null ? null : { value: breslowDay, pValue: WASM.chi_square_p_value_df(breslowDay, degreesOfFreedom), degreesOfFreedom },
      breslowDayTaroneOddsRatio: breslowDayTarone === null ? null : { value: breslowDayTarone, pValue: WASM.chi_square_p_value_df(breslowDayTarone, degreesOfFreedom), degreesOfFreedom },
      legacyBreslowDayOddsRatio: legacyBreslowDay === null ? null : { value: legacyBreslowDay, pValue: WASM.chi_square_p_value_df(legacyBreslowDay, degreesOfFreedom), degreesOfFreedom },
      legacyBreslowDayRiskRatio: legacyBreslowDayRiskRatio === null ? null : { value: legacyBreslowDayRiskRatio, pValue: WASM.chi_square_p_value_df(legacyBreslowDayRiskRatio, degreesOfFreedom), degreesOfFreedom },
    },
    diagnostics: { informativeStrata, warnings },
  };
}

function analysisValue(value: EpiRecord[string] | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length === 0 ? null : normalized;
}

function commandField(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `[${name.replaceAll("]", "]]")}]`;
}

export function deriveStratifiedTable2x2(
  records: readonly EpiRecord[],
  request: DatasetStratifiedTable2x2Request,
): DatasetStratifiedTable2x2Derivation {
  const fields = [request.exposureField, request.outcomeField, request.strataField];
  if (fields.some((field) => field.trim().length === 0) || new Set(fields).size !== fields.length) {
    throw new RangeError("Select three different exposure, outcome, and stratification fields.");
  }
  if (request.exposedValues.length === 0 || request.caseValues.length === 0) {
    throw new RangeError("Select at least one exposed value and at least one case value.");
  }
  const exposedValues = new Set(request.exposedValues);
  const caseValues = new Set(request.caseValues);
  const strata = new Map<string, [number, number, number, number]>();
  const exposureReferences = new Set<string>();
  const outcomeReferences = new Set<string>();
  let excludedMissing = 0;

  for (const record of records) {
    const exposure = analysisValue(record[request.exposureField]);
    const outcome = analysisValue(record[request.outcomeField]);
    const stratum = analysisValue(record[request.strataField]);
    if (exposure === null || outcome === null || stratum === null) {
      excludedMissing += 1;
      continue;
    }
    const cells = strata.get(stratum) ?? [0, 0, 0, 0];
    const exposed = exposedValues.has(exposure);
    const illness = caseValues.has(outcome);
    const cellIndex = (exposed ? 0 : 2) + (illness ? 0 : 1);
    cells[cellIndex] = (cells[cellIndex] ?? 0) + 1;
    strata.set(stratum, cells);
    if (!exposed) exposureReferences.add(exposure);
    if (!illness) outcomeReferences.add(outcome);
  }
  if (strata.size === 0) throw new RangeError("No complete records remain for the selected fields.");

  const input: StratifiedTable2x2Input = {
    confidenceLevel: request.confidenceLevel,
    strata: [...strata.entries()].sort(([left], [right]) => left.localeCompare(right, "en-US")).map(([label, cells], index) => ({
      id: `derived-stratum-${index + 1}`,
      label,
      exposedCases: cells[0],
      exposedNonCases: cells[1],
      unexposedCases: cells[2],
      unexposedNonCases: cells[3],
    })),
  };
  return {
    input,
    audit: {
      sourceRecords: records.length,
      includedRecords: records.length - excludedMissing,
      excludedMissing,
      exposureReferenceValues: [...exposureReferences].sort((a, b) => a.localeCompare(b, "en-US")),
      outcomeReferenceValues: [...outcomeReferences].sort((a, b) => a.localeCompare(b, "en-US")),
    },
    command: `TABLES ${commandField(request.exposureField)} ${commandField(request.outcomeField)} STRATAVAR=${commandField(request.strataField)}`,
  };
}

interface GroupedFrequencyValue {
  key: string;
  value: string;
  missing: boolean;
  rank: number;
  numericValue: number | null;
  frequency: number;
}

function groupedFrequencyValue(value: EpiRecord[string] | undefined): Omit<GroupedFrequencyValue, "frequency"> {
  if (value === null || value === undefined || (typeof value === "string" && value.trim().length === 0)) {
    return { key: "missing", value: "Missing", missing: true, rank: 3, numericValue: null };
  }
  if (typeof value === "number") {
    return { key: `number:${value}`, value: String(value), missing: false, rank: 0, numericValue: value };
  }
  if (typeof value === "boolean") {
    return { key: `boolean:${value}`, value: value ? "Yes" : "No", missing: false, rank: 1, numericValue: null };
  }
  const normalized = value.trim();
  return { key: `string:${normalized}`, value: normalized, missing: false, rank: 2, numericValue: null };
}

export function deriveFrequency(
  records: readonly EpiRecord[],
  request: DatasetFrequencyRequest,
): FrequencyResult {
  if (request.field.trim().length === 0) throw new RangeError("Select a frequency variable.");
  const groups = new Map<string, GroupedFrequencyValue>();
  let missingRecords = 0;
  for (const record of records) {
    const candidate = groupedFrequencyValue(record[request.field]);
    if (candidate.missing) missingRecords += 1;
    if (candidate.missing && !request.includeMissing) continue;
    const existing = groups.get(candidate.key);
    if (existing) existing.frequency += 1;
    else groups.set(candidate.key, { ...candidate, frequency: 1 });
  }
  const includedRecords = records.length - (request.includeMissing ? 0 : missingRecords);
  if (includedRecords === 0) throw new RangeError("No records remain for the selected frequency variable and missing-value setting.");
  const ordered = [...groups.values()].sort((left, right) => {
    if (left.rank !== right.rank) return left.rank - right.rank;
    if (left.numericValue !== null && right.numericValue !== null) return left.numericValue - right.numericValue;
    return left.value.localeCompare(right.value, "en-US");
  });
  let cumulative = 0;
  const categories = ordered.map((category) => {
    cumulative += category.frequency;
    const percent = WASM.frequency_proportion(category.frequency, includedRecords);
    const lower = WASM.frequency_ci_lower(category.frequency, includedRecords);
    const upper = WASM.frequency_ci_upper(category.frequency, includedRecords);
    if (![percent, lower, upper].every(Number.isFinite)) {
      throw new RangeError("The frequency kernel rejected the derived category counts.");
    }
    return {
      value: category.value,
      missing: category.missing,
      frequency: category.frequency,
      percent,
      cumulativePercent: WASM.frequency_proportion(cumulative, includedRecords),
      confidenceInterval: { lower, upper },
    };
  });
  const warnings: string[] = [];
  if (missingRecords > 0) warnings.push(request.includeMissing
    ? `${missingRecords} record${missingRecords === 1 ? "" : "s"} with missing values are shown as a category.`
    : `${missingRecords} record${missingRecords === 1 ? "" : "s"} with missing values were excluded.`);
  return {
    schemaVersion: "0.9.0",
    operation: "epi.frequency",
    engine: { id: "epi-core-wasm", version: "0.9.0", operation: "epi.frequency" },
    input: {
      field: request.field,
      prompt: request.prompt,
      includeMissing: request.includeMissing,
      confidenceLevel: 0.95,
    },
    methods: {
      categoryOrdering: "typed-value-ascending-missing-last",
      percent: "frequency-over-included-total",
      confidenceInterval: "legacy-epi-info-exact-under-300-wilson-at-least-300",
    },
    categories,
    totals: {
      sourceRecords: records.length,
      includedRecords,
      excludedMissing: request.includeMissing ? 0 : missingRecords,
      categoryCount: categories.length,
    },
    command: `FREQ ${commandField(request.field)}`,
    diagnostics: { warnings },
  };
}

function numericMeansValue(value: EpiRecord[string] | undefined): number | null {
  if (value === null || value === undefined || typeof value === "boolean") return null;
  if (typeof value === "string" && value.trim().length === 0) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function deriveMeans(
  records: readonly EpiRecord[],
  request: DatasetMeansRequest,
): MeansResult {
  if (request.field.trim().length === 0) throw new RangeError("Select a numeric variable for MEANS.");
  const values = records.map((record) => numericMeansValue(record[request.field]))
    .filter((value): value is number => value !== null);
  if (values.length < 2) throw new RangeError("MEANS requires at least two numeric observations.");
  if (values.length > 65_536) throw new RangeError("This candidate MEANS slice is limited to 65,536 observations.");
  WASM.means_reset();
  for (const [index, value] of values.entries()) {
    if (WASM.means_set_value(index, value) !== 1) throw new RangeError("The MEANS kernel rejected an observation.");
  }
  if (WASM.means_prepare(values.length) !== 1) throw new RangeError("The MEANS kernel could not prepare the observations.");
  const statistics = {
    observations: values.length,
    total: WASM.means_sum(values.length),
    mean: WASM.means_mean(values.length),
    variance: WASM.means_sample_variance(values.length),
    standardDeviation: WASM.means_sample_std_dev(values.length),
    minimum: WASM.means_minimum(values.length),
    quartile25: WASM.means_quartile_25(values.length),
    median: WASM.means_median(values.length),
    quartile75: WASM.means_quartile_75(values.length),
    maximum: WASM.means_maximum(values.length),
    mode: WASM.means_mode(values.length),
  };
  if (!Object.values(statistics).every(Number.isFinite)) {
    throw new RangeError("The MEANS kernel returned an unavailable statistic.");
  }
  const excluded = records.length - values.length;
  return {
    schemaVersion: "0.10.0",
    operation: "epi.means",
    engine: { id: "epi-core-wasm", version: "0.10.0", operation: "epi.means" },
    input: { field: request.field, prompt: request.prompt },
    methods: {
      variance: "sample-n-minus-one",
      quartiles: "legacy-epi-info-n-times-p-midpoint-on-integer-rank",
      mode: "lowest-value-on-frequency-tie",
    },
    statistics,
    totals: {
      sourceRecords: records.length,
      includedRecords: values.length,
      excludedMissingOrNonNumeric: excluded,
    },
    command: `MEANS ${commandField(request.field)}`,
    diagnostics: { warnings: excluded > 0 ? [`${excluded} missing or non-numeric record${excluded === 1 ? " was" : "s were"} excluded.`] : [] },
  };
}

function normalizedRateValue(value: EpiRecord[string] | undefined): string | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized.toLocaleLowerCase() : null;
}

export function deriveRate(records: readonly EpiRecord[], request: DatasetRateRequest): RateResult {
  if (!request.numeratorField.trim() || !request.denominatorField.trim()) {
    throw new RangeError("Select numerator and denominator fields for the rate.");
  }
  const target = request.numeratorValue.trim().toLocaleLowerCase();
  if (!target) throw new RangeError("Select the numerator value to count.");
  if (!Number.isFinite(request.multiplier) || request.multiplier <= 0) {
    throw new RangeError("The rate multiplier must be greater than zero.");
  }
  let denominator = 0;
  let numerator = 0;
  for (const record of records) {
    if (normalizedRateValue(record[request.denominatorField]) === null) continue;
    denominator += 1;
    if (normalizedRateValue(record[request.numeratorField]) === target) numerator += 1;
  }
  if (denominator === 0) throw new RangeError("No records have a non-missing denominator value.");
  const rate = WASM.rate_calculate(numerator, denominator, request.multiplier);
  if (!Number.isFinite(rate)) throw new RangeError("The rate kernel rejected the derived aggregates.");
  return {
    schemaVersion: "0.11.0",
    operation: "epi.rate",
    engine: { id: "epi-core-wasm", version: "0.11.0", operation: "epi.rate" },
    input: request,
    methods: {
      numerator: "count-equal-nonmissing",
      denominator: "count-nonmissing",
      rate: "numerator-over-denominator-times-multiplier",
    },
    aggregates: { numerator, denominator, falseCount: denominator - numerator },
    rate,
    totals: { sourceRecords: records.length, excludedDenominatorMissing: records.length - denominator },
    diagnostics: {
      warnings: numerator === 0 ? ["No denominator-eligible records matched the selected numerator value."] : [],
    },
  };
}

const POPULATION_SURVEY_LEVELS = [0.80, 0.90, 0.95, 0.97, 0.99, 0.999, 0.9999] as const;

export function calculatePopulationSurvey(input: PopulationSurveyInput): PopulationSurveyResult {
  if (!Number.isSafeInteger(input.populationSize) || input.populationSize <= 0) {
    throw new RangeError("Population size must be a positive whole number.");
  }
  if (!(input.expectedFrequencyPercent > 0 && input.expectedFrequencyPercent < 100)) {
    throw new RangeError("Expected frequency must be greater than 0% and less than 100%.");
  }
  if (!(input.marginOfErrorPercent > 0)) throw new RangeError("Acceptable margin of error must be greater than 0%.");
  if (!(input.designEffect > 0)) throw new RangeError("Design effect must be greater than zero.");
  if (!Number.isSafeInteger(input.clusters) || input.clusters < 1) {
    throw new RangeError("Clusters must be a positive whole number.");
  }
  const rows = POPULATION_SURVEY_LEVELS.map((confidenceLevel) => {
    const clusterSize = WASM.population_survey_cluster_size(
      input.populationSize,
      input.expectedFrequencyPercent,
      input.marginOfErrorPercent,
      input.designEffect,
      input.clusters,
      confidenceLevel,
    );
    if (!Number.isSafeInteger(clusterSize) || clusterSize < 0) {
      throw new RangeError("The Population Survey kernel rejected these inputs.");
    }
    return { confidenceLevel, clusterSize, totalSample: clusterSize * input.clusters };
  });
  return {
    schemaVersion: "0.12.0",
    operation: "epi.sampleSize.populationSurvey",
    engine: { id: "epi-core-wasm", version: "0.12.0", operation: "epi.sampleSize.populationSurvey" },
    input,
    methods: {
      normalQuantile: "legacy-epi-info-tail-approximation",
      finitePopulationCorrection: "n-over-one-plus-n-over-population",
      rounding: "base-to-even-then-design-effect-per-cluster-ceiling",
    },
    rows,
    diagnostics: {
      warnings: input.designEffect === 1 && input.clusters === 1 ? [] : ["Cluster size is rounded up after applying design effect and dividing by the number of clusters."],
    },
  };
}
