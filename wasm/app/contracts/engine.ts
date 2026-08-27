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
