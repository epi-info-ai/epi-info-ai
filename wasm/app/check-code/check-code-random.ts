export const CHECK_CODE_RANDOM_GENERATOR = "mulberry32-rejection-v1" as const;

export interface CheckCodeRandomDraw {
  value: number;
  generator: typeof CHECK_CODE_RANDOM_GENERATOR;
  seed: number;
  draw: number;
}

export interface CheckCodeSeededRandom {
  readonly generator: typeof CHECK_CODE_RANDOM_GENERATOR;
  readonly seed: number;
  nextInteger(minimumInclusive: number, maximumExclusive: number): CheckCodeRandomDraw;
}

const UINT32_RANGE = 0x1_0000_0000;

export function createCheckCodeSeededRandom(seed: number): CheckCodeSeededRandom {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError("Check Code random seed must be an unsigned 32-bit integer.");
  }
  const originalSeed = seed;
  let state = seed >>> 0;
  let draw = 0;
  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  };
  return {
    generator: CHECK_CODE_RANDOM_GENERATOR,
    seed: originalSeed,
    nextInteger(minimumInclusive, maximumExclusive) {
      if (!Number.isSafeInteger(minimumInclusive) || !Number.isSafeInteger(maximumExclusive)
        || minimumInclusive < -0x8000_0000 || minimumInclusive > 0x7fff_ffff
        || maximumExclusive < -0x8000_0000 || maximumExclusive > 0x7fff_ffff) {
        throw new RangeError("RND bounds must be signed 32-bit integers.");
      }
      if (maximumExclusive < minimumInclusive) throw new RangeError("RND upper bound must be greater than or equal to its lower bound.");
      draw += 1;
      if (maximumExclusive === minimumInclusive) {
        return { value: minimumInclusive, generator: CHECK_CODE_RANDOM_GENERATOR, seed: originalSeed, draw };
      }
      const span = maximumExclusive - minimumInclusive;
      const limit = Math.floor(UINT32_RANGE / span) * span;
      let sample = nextUint32();
      while (sample >= limit) sample = nextUint32();
      return { value: minimumInclusive + sample % span, generator: CHECK_CODE_RANDOM_GENERATOR, seed: originalSeed, draw };
    },
  };
}
