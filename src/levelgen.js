import { brazierCount, monsterCount, oilCount, pickMonsterType, potionCount } from "./bestiary.js";
import { FLOOR, generateCave, keepLargestRegion } from "./cavegen.js";
import { bfsDistances } from "./pathfinding.js";

const MIN_REGION_FRACTION = 0.2;
const MAX_ATTEMPTS = 10;
const MIN_STAIRS_DISTANCE = 20;
const SAFE_RADIUS = 6;
const SLEEP_CHANCE = 0.35;
const LIT_BRAZIER_CHANCE = 0.25;

// Takes a random element out of the array.
function takeRandom(rng, cells) {
  const i = rng.int(0, cells.length);
  const [cell] = cells.splice(i, 1);
  return cell;
}

function openNeighbours(walls, x, y) {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) if (walls.get(x + dx, y + dy) === FLOOR) n++;
  }
  return n;
}

// Builds a description of a level: walls, where the player starts, the stairs down,
// monsters, items and braziers. Every floor tile is reachable from the start.
export function generateLevel({ width, height, depth = 1, rng }) {
  let walls;
  let region = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    walls = generateCave(width, height, rng);
    region = keepLargestRegion(walls);
    if (region.length >= width * height * MIN_REGION_FRACTION) break;
  }

  const playerStart = rng.pick(region);
  const distances = bfsDistances(width, height, (x, y) => walls.get(x, y) === FLOOR, playerStart);
  const distanceTo = ({ x, y }) => distances.get(x, y);

  // Stairs go somewhere far from the start.
  const maxDistance = Math.max(...region.map(distanceTo));
  const threshold = Math.max(MIN_STAIRS_DISTANCE, Math.floor(maxDistance * 0.6));
  const far = region.filter((c) => distanceTo(c) >= threshold);
  const stairs = far.length > 0 ? rng.pick(far) : region.find((c) => distanceTo(c) === maxDistance);

  // Nothing spawns right next to the player or on the stairs.
  const spawnable = region.filter(
    (c) => distanceTo(c) >= SAFE_RADIUS && !(c.x === stairs.x && c.y === stairs.y),
  );

  // Braziers stand in open ground (all 8 neighbours open) so they never seal a corridor.
  const features = [];
  const open = spawnable.filter((c) => openNeighbours(walls, c.x, c.y) === 9);
  for (let i = 0; i < brazierCount(depth) && open.length > 0; i++) {
    const { x, y } = takeRandom(rng, open);
    features.push({ x, y, type: "brazier", lit: rng.chance(LIT_BRAZIER_CHANCE) });
    const spot = spawnable.findIndex((c) => c.x === x && c.y === y);
    if (spot >= 0) spawnable.splice(spot, 1);
  }

  const monsters = [];
  const count = monsterCount(depth, region.length);
  for (let i = 0; i < count && spawnable.length > 0; i++) {
    const { x, y } = takeRandom(rng, spawnable);
    const state = rng.chance(SLEEP_CHANCE) ? "asleep" : "idle";
    monsters.push({ x, y, type: pickMonsterType(rng, depth), state });
  }

  const items = [];
  for (let i = 0; i < potionCount(depth) && spawnable.length > 0; i++) {
    const { x, y } = takeRandom(rng, spawnable);
    items.push({ x, y, type: "potion" });
  }
  for (let i = oilCount(rng); i > 0 && spawnable.length > 0; i--) {
    const { x, y } = takeRandom(rng, spawnable);
    items.push({ x, y, type: "oil" });
  }

  return { walls, playerStart, stairs, monsters, items, features, depth };
}
