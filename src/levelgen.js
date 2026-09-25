import { brazierCount, monsterCount, oilCount, pickMonsterType, potionCount } from "./bestiary.js";
import { FLOOR, generateCave, keepLargestRegion } from "./cavegen.js";
import { bfsDistances } from "./pathfinding.js";

const MIN_REGION_FRACTION = 0.2;
const MAX_ATTEMPTS = 10;
const MIN_STAIRS_DISTANCE = 20;
const SAFE_RADIUS = 6;
const SLEEP_CHANCE = 0.35;
const LIT_BRAZIER_CHANCE = 0.25;
const CHASM_MIN_DEPTH = 2;
const CHASM_SAFE_DISTANCE = 8;

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

  const features = [];
  const chasmCells = placeChasms({ walls, region, playerStart, stairs, distanceTo, depth, rng });
  for (const c of chasmCells) features.push({ x: c.x, y: c.y, type: "chasm" });
  const isChasm = (c) => chasmCells.some((k) => k.x === c.x && k.y === c.y);
  for (let i = spawnable.length - 1; i >= 0; i--) if (isChasm(spawnable[i])) spawnable.splice(i, 1);

  // Braziers stand in open ground (all 8 neighbours open) so they never seal a corridor.
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

// Chasms are small blobs of pit you can jump into to drop a level. A blob is only kept
// if every other floor tile is still reachable from the start without crossing a pit.
function placeChasms({ walls, region, playerStart, stairs, distanceTo, depth, rng }) {
  if (depth < CHASM_MIN_DEPTH) return [];
  const taken = new Set();
  const key = (c) => `${c.x},${c.y}`;
  const isFloor = (x, y) => walls.get(x, y) === FLOOR;
  const seeds = region.filter(
    (c) => distanceTo(c) >= CHASM_SAFE_DISTANCE && !(c.x === stairs.x && c.y === stairs.y),
  );
  const blobs = rng.int(1, 3);

  for (let b = 0; b < blobs && seeds.length > 0; b++) {
    const seed = rng.pick(seeds);
    const blob = [seed];
    const size = rng.int(3, 7);
    for (let tries = 0; blob.length < size && tries < 30; tries++) {
      const from = rng.pick(blob);
      const [dx, dy] = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      const c = { x: from.x + dx, y: from.y + dy };
      if (!isFloor(c.x, c.y) || blob.some((k) => key(k) === key(c))) continue;
      if ((c.x === stairs.x && c.y === stairs.y) || distanceTo(c) < CHASM_SAFE_DISTANCE) continue;
      blob.push(c);
    }

    const trial = new Set([...taken, ...blob.map(key)]);
    const passable = (x, y) => isFloor(x, y) && !trial.has(`${x},${y}`);
    const reach = bfsDistances(walls.width, walls.height, passable, playerStart);
    const connected = region.every((c) => trial.has(key(c)) || reach.get(c.x, c.y) >= 0);
    if (connected) for (const c of blob) taken.add(key(c));
  }

  return [...taken].map((k) => {
    const [x, y] = k.split(",").map(Number);
    return { x, y };
  });
}
