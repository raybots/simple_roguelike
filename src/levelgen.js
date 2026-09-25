import { monsterCount, pickMonsterType, potionCount } from "./bestiary.js";
import { FLOOR, generateCave, keepLargestRegion } from "./cavegen.js";
import { bfsDistances } from "./pathfinding.js";

const MIN_REGION_FRACTION = 0.2;
const MAX_ATTEMPTS = 10;
const MIN_STAIRS_DISTANCE = 20;
const SAFE_RADIUS = 6;

// Takes a random element out of the array.
function takeRandom(rng, cells) {
  const i = rng.int(0, cells.length);
  const [cell] = cells.splice(i, 1);
  return cell;
}

// Builds a description of a level: walls, where the player starts, the stairs down,
// monsters and items. Every floor tile is reachable from the start.
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

  const monsters = [];
  const count = monsterCount(depth, region.length);
  for (let i = 0; i < count && spawnable.length > 0; i++) {
    const { x, y } = takeRandom(rng, spawnable);
    monsters.push({ x, y, type: pickMonsterType(rng, depth) });
  }

  const items = [];
  for (let i = 0; i < potionCount(depth) && spawnable.length > 0; i++) {
    const { x, y } = takeRandom(rng, spawnable);
    items.push({ x, y, type: "potion" });
  }

  return { walls, playerStart, stairs, monsters, items, depth };
}
