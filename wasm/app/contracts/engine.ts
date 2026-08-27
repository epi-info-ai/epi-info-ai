export interface Table2x2Input {
  exposedCases: number;
  exposedNonCases: number;
  unexposedCases: number;
  unexposedNonCases: number;
  confidenceLevel: number;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
}

export interface EstimateWithInterval {
  estimate: number | null;
  confidenceInterval: ConfidenceInterval | null;
}

export interface ChiSquareTestResult {
  value: number;
  pValue: number;
  degreesOfFreedom: number;
}

export interface FisherExactResult {
  left: number;
  right: number;
  oneTailed: number;
  twoTailed: number;
}

export interface MidPExactResult {
  left: number;
  right: number;
  oneTailed: number;
}

export interface BoundaryNumber {
  value: number | null;
  state: "finite" | "zero" | "positive-infinity" | "unavailable";
}

export interface BoundaryInterval {
  lower: BoundaryNumber;
  upper: BoundaryNumber;
}

export interface ConditionalOddsRatioResult {
  estimate: BoundaryNumber;
  fisherConfidenceInterval: BoundaryInterval;
  midPConfidenceInterval: BoundaryInterval;
}

export interface StratifiedConditionalOddsRatioResult {
  estimate: BoundaryNumber;
  fisherConfidenceInterval: BoundaryInterval;
}

export interface Table2x2Result {
  schemaVersion: "0.4.0";
  operation: "epi.table2x2";
  engine: {
    id: string;
    version: string;
    operation: "epi.table2x2";
  };
  input: Table2x2Input;
  methods: {
    riskRatioConfidenceInterval: "katz-log";
    oddsRatioConfidenceInterval: "wald-log";
    riskDifferenceConfidenceInterval: "wald-unpooled";
    chiSquarePValue: "chi-square-survival-df1-erfc";
    fisherExact: "conditional-hypergeometric-probability-ordering-epi-info-1.000001";
    midPExact: "conditional-hypergeometric-half-observed";
    conditionalOddsRatio: "conditional-noncentral-hypergeometric-mean-root";
    fisherExactOddsRatioConfidenceInterval: "conditional-noncentral-hypergeometric-central-tail-inversion";
    midPExactOddsRatioConfidenceInterval: "conditional-noncentral-hypergeometric-mid-p-tail-inversion";
  };
  totals: {
    exposed: number;
    unexposed: number;
    cases: number;
    nonCases: number;
    overall: number;
  };
  estimates: {
    riskExposed: number | null;
    riskUnexposed: number | null;
    riskRatio: EstimateWithInterval;
    oddsRatio: EstimateWithInterval;
    riskDifference: EstimateWithInterval;
    conditionalOddsRatio: ConditionalOddsRatioResult;
  };
  tests: {
    pearson: ChiSquareTestResult | null;
    mantelHaenszel: ChiSquareTestResult | null;
    yates: ChiSquareTestResult | null;
    fisherExact: FisherExactResult | null;
    midPExact: MidPExactResult | null;
  };
  diagnostics: {
    expectedCellCounts: number[];
    warnings: string[];
  };
}

export interface StratifiedTable2x2Input {
  strata: Array<{
    id: string;
    label: string;
    exposedCases: number;
    exposedNonCases: number;
    unexposedCases: number;
    unexposedNonCases: number;
  }>;
  confidenceLevel: number;
}

export interface StratifiedTable2x2Result {
  schemaVersion: "0.8.0";
  operation: "epi.stratified2x2";
  engine: { id: string; version: "0.8.0"; operation: "epi.stratified2x2" };
  input: StratifiedTable2x2Input;
  methods: {
    oddsRatio: "mantel-haenszel";
    oddsRatioConfidenceInterval: "robins-breslow-greenland-legacy-epi-info";
    riskRatio: "mantel-haenszel";
    riskRatioConfidenceInterval: "legacy-epi-info-log";
    associationTest: "mantel-haenszel";
    breslowDayOddsRatio: "fixed-margin-expected-cell-common-mh-or";
    breslowDayTaroneOddsRatio: "fixed-margin-expected-cell-tarone-correction-common-mh-or";
    legacyBreslowDayOddsRatio: "woolf-weighted-log-odds-dispersion-legacy-epi-info-label";
    legacyBreslowDayRiskRatio: "woolf-weighted-log-risk-dispersion-legacy-epi-info-label";
    conditionalOddsRatio: "conditional-product-hypergeometric-mean-root";
    fisherExactOddsRatioConfidenceInterval: "conditional-product-hypergeometric-central-tail-inversion";
  };
  estimates: {
    adjustedOddsRatio: EstimateWithInterval;
    adjustedRiskRatio: EstimateWithInterval;
    adjustedConditionalOddsRatio: StratifiedConditionalOddsRatioResult;
  };
  tests: {
    mantelHaenszelUncorrected: ChiSquareTestResult | null;
    mantelHaenszelCorrected: ChiSquareTestResult | null;
    breslowDayOddsRatio: ChiSquareTestResult | null;
    breslowDayTaroneOddsRatio: ChiSquareTestResult | null;
    legacyBreslowDayOddsRatio: ChiSquareTestResult | null;
    legacyBreslowDayRiskRatio: ChiSquareTestResult | null;
  };
  diagnostics: { informativeStrata: number; warnings: string[] };
}

export interface DatasetStratifiedTable2x2Request {
  exposureField: string;
  exposedValues: string[];
  outcomeField: string;
  caseValues: string[];
  strataField: string;
  confidenceLevel: number;
}

export interface DatasetStratifiedTable2x2Derivation {
  input: StratifiedTable2x2Input;
  audit: {
    sourceRecords: number;
    includedRecords: number;
    excludedMissing: number;
    exposureReferenceValues: string[];
    outcomeReferenceValues: string[];
  };
  command: string;
}

export interface FrequencyInput {
  field: string;
  prompt: string;
  includeMissing: boolean;
  confidenceLevel: 0.95;
}

export interface FrequencyCategory {
  value: string;
  missing: boolean;
  frequency: number;
  percent: number;
  cumulativePercent: number;
  confidenceInterval: ConfidenceInterval;
}

export interface FrequencyResult {
  schemaVersion: "0.9.0";
  operation: "epi.frequency";
  engine: { id: "epi-core-wasm"; version: "0.9.0"; operation: "epi.frequency" };
  input: FrequencyInput;
  methods: {
    categoryOrdering: "typed-value-ascending-missing-last";
    percent: "frequency-over-included-total";
    confidenceInterval: "legacy-epi-info-exact-under-300-wilson-at-least-300";
  };
  categories: FrequencyCategory[];
  totals: {
    sourceRecords: number;
    includedRecords: number;
    excludedMissing: number;
    categoryCount: number;
  };
  command: string;
  diagnostics: { warnings: string[] };
}

export interface DatasetFrequencyRequest {
  field: string;
  prompt: string;
  includeMissing: boolean;
}

export interface DatasetMeansRequest {
  field: string;
  prompt: string;
}

export interface MeansResult {
  schemaVersion: "0.10.0";
  operation: "epi.means";
  engine: { id: "epi-core-wasm"; version: "0.10.0"; operation: "epi.means" };
  input: { field: string; prompt: string };
  methods: {
    variance: "sample-n-minus-one";
    quartiles: "legacy-epi-info-n-times-p-midpoint-on-integer-rank";
    mode: "lowest-value-on-frequency-tie";
  };
  statistics: {
    observations: number;
    total: number;
    mean: number;
    variance: number;
    standardDeviation: number;
    minimum: number;
    quartile25: number;
    median: number;
    quartile75: number;
    maximum: number;
    mode: number;
  };
  totals: { sourceRecords: number; includedRecords: number; excludedMissingOrNonNumeric: number };
  command: string;
  diagnostics: { warnings: string[] };
}

export interface DatasetRateRequest {
  numeratorField: string;
  numeratorPrompt: string;
  numeratorValue: string;
  denominatorField: string;
  denominatorPrompt: string;
  multiplier: number;
}

export interface RateResult {
  schemaVersion: "0.11.0";
  operation: "epi.rate";
  engine: { id: "epi-core-wasm"; version: "0.11.0"; operation: "epi.rate" };
  input: DatasetRateRequest;
  methods: {
    numerator: "count-equal-nonmissing";
    denominator: "count-nonmissing";
    rate: "numerator-over-denominator-times-multiplier";
  };
  aggregates: { numerator: number; denominator: number; falseCount: number };
  rate: number;
  totals: { sourceRecords: number; excludedDenominatorMissing: number };
  diagnostics: { warnings: string[] };
}

export interface PopulationSurveyInput {
  populationSize: number;
  expectedFrequencyPercent: number;
  marginOfErrorPercent: number;
  designEffect: number;
  clusters: number;
}

export interface PopulationSurveyRow {
  confidenceLevel: 0.80 | 0.90 | 0.95 | 0.97 | 0.99 | 0.999 | 0.9999;
  clusterSize: number;
  totalSample: number;
}

export interface PopulationSurveyResult {
  schemaVersion: "0.12.0";
  operation: "epi.sampleSize.populationSurvey";
  engine: { id: "epi-core-wasm"; version: "0.12.0"; operation: "epi.sampleSize.populationSurvey" };
  input: PopulationSurveyInput;
  methods: {
    normalQuantile: "legacy-epi-info-tail-approximation";
    finitePopulationCorrection: "n-over-one-plus-n-over-population";
    rounding: "base-to-even-then-design-effect-per-cluster-ceiling";
  };
  rows: PopulationSurveyRow[];
  diagnostics: { warnings: string[] };
}

export interface CohortSampleSizeInput {
  confidenceLevel: 0.80 | 0.90 | 0.95 | 0.99 | 0.999 | 0.9999;
  powerPercent: number;
  unexposedToExposedRatio: number;
  unexposedOutcomePercent: number;
  oddsRatio: number;
}

export interface CohortSampleSizeMethodResult {
  method: "Kelsey" | "Fleiss" | "Fleiss with continuity correction";
  exposed: number;
  unexposed: number;
  total: number;
}

export interface CohortSampleSizeResult {
  schemaVersion: "0.13.0";
  operation: "epi.sampleSize.cohortCrossSectional";
  engine: { id: "epi-core-wasm"; version: "0.13.0"; operation: "epi.sampleSize.cohortCrossSectional" };
  input: CohortSampleSizeInput;
  derived: { exposedOutcomePercent: number; riskRatio: number };
  methods: CohortSampleSizeMethodResult[];
  diagnostics: { warnings: string[] };
}
