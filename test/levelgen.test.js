import assert from "node:assert/strict";
import { test } from "node:test";
import { MONSTER_TYPES, monsterCount } from "../src/bestiary.js";
import { generateLevel } from "../src/levelgen.js";
import { bfsDistances, findPath } from "../src/pathfinding.js";
import { createRng } from "../src/rng.js";

const levels = (depth) =>
  Array.from({ length: 30 }, (_, i) => generateLevel({ width: 60, height: 60, depth, rng: createRng(i + 1) }));

test("the stairs are always reachable and usually far from the start", () => {
  let far = 0;
  for (const bp of levels(1)) {
    const floor = (x, y) => bp.walls.get(x, y) === 0;
    const path = findPath(60, 60, floor, bp.playerStart, bp.stairs);
    assert.ok(path, "stairs reachable");
    if (path.length - 1 >= 20) far++;
  }
  assert.ok(far >= 28, `stairs far away on ${far}/30 maps`);
});

test("every floor tile is reachable from the start", () => {
  for (const bp of levels(1)) {
    const d = bfsDistances(60, 60, (x, y) => bp.walls.get(x, y) === 0, bp.playerStart);
    bp.walls.forEach((x, y, v) => {
      if (v === 0) assert.ok(d.get(x, y) >= 0);
    });
  }
});

test("monsters and items spawn on free floor away from the start", () => {
  for (const bp of levels(3)) {
    const d = bfsDistances(60, 60, (x, y) => bp.walls.get(x, y) === 0, bp.playerStart);
    const taken = new Set();
    for (const thing of [...bp.monsters, ...bp.items]) {
      const key = `${thing.x},${thing.y}`;
      assert.equal(bp.walls.get(thing.x, thing.y), 0);
      assert.ok(d.get(thing.x, thing.y) >= 6);
      assert.ok(!taken.has(key), "no two spawns share a tile");
      assert.ok(!(thing.x === bp.stairs.x && thing.y === bp.stairs.y));
      taken.add(key);
    }
  }
});

test("depth controls which monsters appear and how many", () => {
  for (const bp of levels(1)) {
    for (const m of bp.monsters) assert.ok(MONSTER_TYPES[m.type].minDepth <= 1, m.type);
    assert.equal(bp.monsters.length, 8);
  }
  const deepTypes = new Set(levels(6).flatMap((bp) => bp.monsters.map((m) => m.type)));
  assert.ok(deepTypes.has("ogre") && deepTypes.has("goblin"));
  assert.equal(monsterCount(5, 10000), 16);
  assert.equal(monsterCount(50, 100), 10, "capped at 10% of open tiles");
});
