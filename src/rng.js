// Seeded pseudo-random numbers so a map can be reproduced from its seed.

// mulberry32: a tiny, fast 32-bit PRNG. Returns a function producing floats in [0, 1).
// Its internal state is exposed as `.state.a`, so a game in progress can be saved.
export function mulberry32(seed) {
  const state = { a: seed >>> 0 };
  const next = () => {
    state.a = (state.a + 0x6d2b79f5) | 0;
    let t = Math.imul(state.a ^ (state.a >>> 15), 1 | state.a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.state = state;
  return next;
}

export function randomSeed() {
  return (Math.random() * 2 ** 32) >>> 0;
}

// `state` resumes a generator exactly where a saved one left off.
export function createRng(seed = randomSeed(), state = undefined) {
  const random = mulberry32(state ?? seed);
  return {
    seed,
    random,
    get state() {
      return random.state.a;
    },
    // integer in [min, max)
    int: (min, max) => min + Math.floor(random() * (max - min)),
    chance: (p) => random() < p,
    pick: (arr) => arr[Math.floor(random() * arr.length)],
  };
}
