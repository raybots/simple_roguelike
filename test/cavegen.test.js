import assert from "node:assert/strict";
import { test } from "node:test";
import { countWallNeighbors, generateCave, keepLargestRegion, smooth } from "../src/cavegen.js";
import { Grid } from "../src/grid.js";
import { bfsDistances } from "../src/pathfinding.js";
import { createRng } from "../src/rng.js";

test("generateCave is deterministic for a seed", () => {
  const a = generateCave(60, 60, createRng(7));
  const b = generateCave(60, 60, createRng(7));
  assert.deepEqual(a.cells, b.cells);
  assert.notDeepEqual(a.cells, generateCave(60, 60, createRng(8)).cells);
});

test("the map edge is always wall", () => {
  for (let seed = 1; seed <= 10; seed++) {
    const grid = generateCave(60, 60, createRng(seed));
    grid.forEach((x, y, v) => {
      if (x === 0 || y === 0 || x === 59 || y === 59) assert.equal(v, 1, `seed ${seed} (${x},${y})`);
    });
  }
});

test("openTop and openBottom leave bands of floor when borders are off", () => {
  const grid = generateCave(60, 60, createRng(1), { openTop: 5, openBottom: 8, borderWalls: false });
  grid.forEach((x, y, v) => {
    if (y < 5 || y >= 52) assert.equal(v, 0);
  });
});

test("keepLargestRegion leaves exactly one connected floor region", () => {
  for (let seed = 1; seed <= 10; seed++) {
    const grid = generateCave(60, 60, createRng(seed));
    const region = keepLargestRegion(grid);
    const floorCount = grid.cells.filter((v) => v === 0).length;
    assert.equal(region.length, floorCount);
    const d = bfsDistances(60, 60, (x, y) => grid.get(x, y) === 0, region[0]);
    for (const c of region) assert.ok(d.get(c.x, c.y) >= 0);
  }
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
