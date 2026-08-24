const ENGINE = Object.freeze({
  id: "rust-wasm-spike",
  version: "0.1.0",
  operation: "epi.table2x2",
});

async function loadWasm() {
  const response = await fetch(new URL("./epi2x2.wasm", import.meta.url));
  if (!response.ok) throw new Error(`Unable to load the WASM engine (${response.status}).`);

  if (WebAssembly.instantiateStreaming) {
    try {
      return (await WebAssembly.instantiateStreaming(response.clone(), {})).instance.exports;
    } catch {
      // Some development servers do not send application/wasm.
    }
  }
  return (await WebAssembly.instantiate(await response.arrayBuffer(), {})).instance.exports;
}

const WASM = await loadWasm();

function wasmNumber(value) {
  return Number.isFinite(value) ? value : null;
}

const Z_VALUES = new Map([
  [0.9, 1.6448536269514722],
  [0.95, 1.959963984540054],
  [0.99, 2.5758293035489004],
]);

function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + z / 2);
  const polynomial = t * Math.exp(
    -z * z - 1.26551223 +
      t * (1.00002368 +
        t * (0.37409196 +
          t * (0.09678418 +
            t * (-0.18628806 +
              t * (0.27886807 +
                t * (-1.13520398 +
                  t * (1.48851587 +
                    t * (-0.82215223 + t * 0.17087277)))))))),
  );
  return x >= 0 ? polynomial : 2 - polynomial;
}

function chiSquareP(value) {
  return erfc(Math.sqrt(Math.max(0, value) / 2));
}

function logGamma(value) {
  const coefficients = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ];

  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) - logGamma(1 - value);
  }

  let z = value - 1;
  let sum = 0.9999999999998099;
  for (let index = 0; index < coefficients.length; index += 1) {
    sum += coefficients[index] / (z + index + 1);
  }
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

function logChoose(n, k) {
  if (k < 0 || k > n) return Number.NEGATIVE_INFINITY;
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

function hypergeometricProbability(a, rowOne, columnOne, total) {
  return Math.exp(logChoose(columnOne, a) + logChoose(total - columnOne, rowOne - a) - logChoose(total, rowOne));
}

function fisherExact(a, b, c, d) {
  const rowOne = a + b;
  const rowTwo = c + d;
  const columnOne = a + c;
  const total = rowOne + rowTwo;
  const lower = Math.max(0, rowOne - (total - columnOne));
  const upper = Math.min(rowOne, columnOne);
  const observed = hypergeometricProbability(a, rowOne, columnOne, total);
  let left = 0;
  let right = 0;
  let twoTailed = 0;

  for (let candidate = lower; candidate <= upper; candidate += 1) {
    const probability = hypergeometricProbability(candidate, rowOne, columnOne, total);
    if (candidate <= a) left += probability;
    if (candidate >= a) right += probability;
    if (probability <= observed * (1 + 1e-10)) twoTailed += probability;
  }

  return {
    left: Math.min(1, left),
    right: Math.min(1, right),
    oneTailed: Math.min(left, right),
    twoTailed: Math.min(1, twoTailed),
  };
}

function interval(estimate, standardError, z, transform = Math.exp) {
  if (!Number.isFinite(estimate) || !Number.isFinite(standardError)) return null;
  return {
    lower: transform(estimate - z * standardError),
    upper: transform(estimate + z * standardError),
  };
}

function validate(input) {
  const cells = [input.exposedCases, input.exposedNonCases, input.unexposedCases, input.unexposedNonCases];
  if (cells.some((cell) => !Number.isFinite(cell) || cell < 0 || !Number.isInteger(cell))) {
    throw new RangeError("Cell counts must be non-negative whole numbers.");
  }
  if (cells.every((cell) => cell === 0)) {
    throw new RangeError("Enter at least one observation.");
  }
  if (!Z_VALUES.has(input.confidenceLevel)) {
    throw new RangeError("Confidence level must be 0.90, 0.95, or 0.99.");
  }
}

export function calculateTable2x2(input) {
  validate(input);

  const a = input.exposedCases;
  const b = input.exposedNonCases;
  const c = input.unexposedCases;
  const d = input.unexposedNonCases;
  const confidenceLevel = input.confidenceLevel;
  const z = Z_VALUES.get(confidenceLevel);
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

  const oddsRatioCi = oddsRatio !== null && a * b * c * d > 0
    ? interval(Math.log(oddsRatio), Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d), z)
    : null;

  const riskRatioCi = riskRatio !== null && a > 0 && c > 0
    ? interval(
        Math.log(riskRatio),
        Math.sqrt(b / (a * exposedTotal) + d / (c * unexposedTotal)),
        z,
      )
    : null;

  const riskDifferenceStandardError = riskExposed !== null && riskUnexposed !== null && exposedTotal > 0 && unexposedTotal > 0
    ? Math.sqrt(
        (riskExposed * (1 - riskExposed)) / exposedTotal +
        (riskUnexposed * (1 - riskUnexposed)) / unexposedTotal,
      )
    : null;
  const riskDifferenceCi = riskDifference !== null && riskDifferenceStandardError !== null
    ? interval(riskDifference, riskDifferenceStandardError, z, (value) => value)
    : null;

  const pearson = wasmNumber(WASM.pearson_chi_square(a, b, c, d));
  const mantelHaenszel = wasmNumber(WASM.mantel_haenszel_chi_square(a, b, c, d));
  const yates = wasmNumber(WASM.yates_chi_square(a, b, c, d));

  const expected = denominator > 0
    ? [
        (exposedTotal * casesTotal) / total,
        (exposedTotal * nonCasesTotal) / total,
        (unexposedTotal * casesTotal) / total,
        (unexposedTotal * nonCasesTotal) / total,
      ]
    : [];

  const warnings = [];
  if ([a, b, c, d].some((cell) => cell === 0)) {
    warnings.push("At least one cell is zero; some estimates and confidence intervals are undefined.");
  }
  if (expected.length > 0 && Math.min(...expected) < 5) {
    warnings.push("An expected cell count is below 5; prefer the Fisher exact result over asymptotic chi-square tests.");
  }
  if (exposedTotal === 0 || unexposedTotal === 0) {
    warnings.push("One exposure group has no observations, so risk comparisons cannot be calculated.");
  }

  return {
    schemaVersion: "0.1.0",
    operation: ENGINE.operation,
    engine: { ...ENGINE },
    input: { ...input },
    totals: { exposed: exposedTotal, unexposed: unexposedTotal, cases: casesTotal, nonCases: nonCasesTotal, overall: total },
    estimates: {
      riskExposed,
      riskUnexposed,
      riskRatio: { estimate: riskRatio, confidenceInterval: riskRatioCi },
      oddsRatio: { estimate: oddsRatio, confidenceInterval: oddsRatioCi },
      riskDifference: { estimate: riskDifference, confidenceInterval: riskDifferenceCi },
    },
    tests: {
      pearson: pearson === null ? null : { value: pearson, pValue: chiSquareP(pearson), degreesOfFreedom: 1 },
      mantelHaenszel: mantelHaenszel === null ? null : { value: mantelHaenszel, pValue: chiSquareP(mantelHaenszel), degreesOfFreedom: 1 },
      yates: yates === null ? null : { value: yates, pValue: chiSquareP(yates), degreesOfFreedom: 1 },
      fisherExact: Number.isInteger(a) && Number.isInteger(b) && Number.isInteger(c) && Number.isInteger(d)
        ? fisherExact(a, b, c, d)
        : null,
    },
    diagnostics: { expectedCellCounts: expected, warnings },
  };
}
