import assert from "node:assert/strict";
import { test } from "node:test";
import { findPath } from "../src/pathfinding.js";
import { levelFromStrings } from "./helpers/maps.js";

function pathOn(rows, passable) {
  const { level, marks } = levelFromStrings(rows);
  const isPassable = passable ?? ((x, y) => !level.isWall(x, y));
  return { level, path: findPath(level.width, level.height, isPassable, marks.S, marks.G) };
}

test("finds a shortest path in an open room", () => {
  const { path } = pathOn(["S....", ".....", "....G"]);
  assert.equal(path.length, 4 + 2 + 1);
  assert.deepEqual(path[0], { x: 0, y: 0 });
  assert.deepEqual(path.at(-1), { x: 4, y: 2 });
});

test("routes around walls and never enters one", () => {
  const { level, path } = pathOn(["S.#..", "..#..", "....G"]);
  assert.ok(path);
  for (const p of path) assert.equal(level.isWall(p.x, p.y), false);
  for (let i = 1; i < path.length; i++) {
    assert.equal(Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y), 1);
  }
});

test("returns null when the goal is unreachable", () => {
  const { path } = pathOn(["S.#..", "..#.G", "..#.."]);
  assert.equal(path, null);
});

test("the goal counts as reachable even when it is not passable", () => {
  const { path } = pathOn(["S..G"], (x, y) => !(x === 3 && y === 0));
  assert.equal(path.length, 4);
});

test("start equal to goal returns a single-point path", () => {
  assert.deepEqual(findPath(3, 3, () => true, { x: 1, y: 1 }, { x: 1, y: 1 }), [{ x: 1, y: 1 }]);
});

test("bfsDistances counts steps and marks unreachable cells -1", async () => {
  const { bfsDistances } = await import("../src/pathfinding.js");
  const { level } = levelFromStrings(["...#.", ".#.#.", "...#."]);
  const d = bfsDistances(level.width, level.height, (x, y) => !level.isWall(x, y), { x: 0, y: 0 });
  assert.equal(d.get(0, 0), 0);
  assert.equal(d.get(2, 2), 4);
  assert.equal(d.get(4, 0), -1);
  assert.equal(d.get(3, 0), -1);
});
