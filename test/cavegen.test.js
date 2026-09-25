import assert from "node:assert/strict";
import { test } from "node:test";
import { countWallNeighbors, generateCave, smooth } from "../src/cavegen.js";
import { Grid } from "../src/grid.js";
import { createRng } from "../src/rng.js";

test("generateCave is deterministic for a seed", () => {
  const a = generateCave(60, 60, createRng(7));
  const b = generateCave(60, 60, createRng(7));
  assert.deepEqual(a.cells, b.cells);
  assert.notDeepEqual(a.cells, generateCave(60, 60, createRng(8)).cells);
});

test("the top 5 and bottom 8 rows stay open", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const grid = generateCave(60, 60, createRng(seed));
    grid.forEach((x, y, v) => {
      if (y < 5 || y >= 52) assert.equal(v, 0, `seed ${seed} (${x},${y})`);
    });
  }
});

test("the cave contains a reasonable mix of wall and floor", () => {
  const grid = generateCave(60, 60, createRng(3));
  const walls = grid.cells.filter((v) => v === 1).length;
  assert.ok(walls > 300 && walls < 2500, `wall count ${walls}`);
});

test("smooth removes a lone wall and keeps a solid block", () => {
  const g = new Grid(7, 7, 0);
  g.set(1, 1, 1);
  for (let y = 3; y < 7; y++) for (let x = 3; x < 7; x++) g.set(x, y, 1);
  const s = smooth(g);
  assert.equal(s.get(1, 1), 0);
  assert.equal(s.get(5, 5), 1);
});

test("countWallNeighbors does not count out-of-bounds cells as walls", () => {
  const g = new Grid(3, 3, 1);
  assert.equal(countWallNeighbors(g, 0, 0), 4);
  assert.equal(countWallNeighbors(g, 1, 1), 9);
});
