import { Monster } from "./monster.js";

// Monster definitions. These numbers are the main difficulty tuning knobs.
// - minDepth: shallowest depth the monster appears on
// - weight: relative spawn frequency among eligible monsters
// - range: how far away it can notice the player
// - speed: actions per turn (0.5 = every other turn)
// - erratic: chance per turn of a random step instead of chasing
// - remembers: keeps chasing after losing sight of the player
// - torch: carries a light of this radius
// - fearsLight: won't enter brazier light
export const MONSTER_TYPES = {
  rat: { name: "rat", glyph: "r", hp: 2, damage: 1, verb: "bites", minDepth: 1, weight: 10, range: 20 },
  bat: {
    name: "bat",
    glyph: "b",
    hp: 3,
    damage: 1,
    verb: "bites",
    minDepth: 1,
    weight: 5,
    range: 20,
    erratic: 0.5,
    remembers: false,
    fearsLight: true,
  },
  goblin: { name: "goblin", glyph: "g", hp: 6, damage: 2, verb: "hits", minDepth: 2, weight: 6, range: 12, torch: 3 },
  ogre: { name: "ogre", glyph: "O", hp: 14, damage: 4, verb: "smashes", minDepth: 4, weight: 3, range: 20, speed: 0.5 },
};

export function eligibleTypes(depth) {
  return Object.keys(MONSTER_TYPES).filter((type) => MONSTER_TYPES[type].minDepth <= depth);
}

export function pickMonsterType(rng, depth) {
  const types = eligibleTypes(depth);
  const total = types.reduce((sum, t) => sum + MONSTER_TYPES[t].weight, 0);
  let roll = rng.random() * total;
  for (const type of types) {
    roll -= MONSTER_TYPES[type].weight;
    if (roll < 0) return type;
  }
  return types.at(-1);
}

// Deeper monsters get one extra hit point every three levels.
export function createMonster(type, x, y, depth = 1, state = "idle") {
  const def = MONSTER_TYPES[type];
  if (!def) throw new Error(`Unknown monster type: ${type}`);
  const bonusHp = Math.floor((depth - 1) / 3);
  return new Monster({ ...def, type, x, y, state, hp: def.hp + bonusHp });
}

export function monsterCount(depth, openCells) {
  return Math.min(6 + 2 * depth, Math.floor(openCells * 0.1));
}

export function potionCount(depth) {
  return 2 + Math.floor(depth / 3);
}

export function oilCount(rng) {
  return rng.chance(0.35) ? 2 : 1;
}

export function brazierCount(depth) {
  return depth >= 4 ? 3 : 2;
}
