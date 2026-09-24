/**
 * Retained Enter PFROMZ profile: AS66 lower-tail standard-normal percentile,
 * multiplied by 100, rounded to two decimals, with the legacy 99.99 ceiling.
 */
export function normalPercentileFromZ(zScore: number): number {
  if (!Number.isFinite(zScore)) throw new RangeError("PFROMZ requires a finite Z-score.");
  const z = Math.abs(zScore);
  const upper = zScore < 0;
  let tail = 0;
  if (z <= 7 || (upper && z <= 18.66)) {
    const y = 0.5 * z * z;
    if (z > 1.28) {
      tail = 0.398942280385 * Math.exp(-y)
        / (z - 3.8052e-8 + 1.00000615302
          / (z + 3.98064794e-4 + 1.986153813664
            / (z - 0.151679116635 + 5.29330324926
              / (z + 4.8385912808 - 15.1508972451
                / (z + 0.742380924027 + 30.789933034
                  / (z + 3.99019417011))))));
    } else {
      tail = 0.5 - z * (0.398942280444 - 0.399903438504 * y
        / (y + 5.75885480458 - 29.8213557808
          / (y + 2.62433121679 + 48.6959930692
            / (y + 5.92885724438))));
    }
  }
  if (!upper) tail = 1 - tail;
  const percentile = tail * 100;
  const scaled = percentile * 100;
  const lower = Math.floor(scaled);
  const fraction = scaled - lower;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 4;
  const roundedUnits = Math.abs(fraction - 0.5) <= tolerance
    ? (lower % 2 === 0 ? lower : lower + 1)
    : Math.round(scaled);
  const rounded = roundedUnits / 100;
  return rounded >= 99.9999 ? 99.99 : rounded <= -99.9999 ? -99.99 : rounded;
}
