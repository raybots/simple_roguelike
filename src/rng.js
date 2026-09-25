// Seeded pseudo-random numbers so a map can be reproduced from its seed.

// mulberry32: a tiny, fast 32-bit PRNG. Returns a function producing floats in [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  return (Math.random() * 2 ** 32) >>> 0;
}

export function createRng(seed = randomSeed()) {
  const random = mulberry32(seed);
  return {
    seed,
    random,
    // integer in [min, max)
    int: (min, max) => min + Math.floor(random() * (max - min)),
    chance: (p) => random() < p,
    pick: (arr) => arr[Math.floor(random() * arr.length)],
  };
}
