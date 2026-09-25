import assert from "node:assert/strict";
import { test } from "node:test";
import { hasLineOfSight } from "../src/visibility.js";
import { levelFromStrings } from "./helpers/maps.js";

const opaque = (level) => (x, y) => level.isWall(x, y);

test("line of sight is clear across open floor", () => {
  const { level, marks } = levelFromStrings(["A.....B"]);
  assert.equal(hasLineOfSight(opaque(level), marks.A.x, marks.A.y, marks.B.x, marks.B.y), true);
});

test("a wall between two points blocks line of sight", () => {
  const { level, marks } = levelFromStrings(["A..#..B"]);
  assert.equal(hasLineOfSight(opaque(level), marks.A.x, marks.A.y, marks.B.x, marks.B.y), false);
});

test("endpoints do not block their own line of sight", () => {
  const isOpaque = () => true;
  assert.equal(hasLineOfSight(isOpaque, 0, 0, 1, 0), true);
});

test("field of view respects the radius and stops at walls", async () => {
  const { computeFov } = await import("../src/visibility.js");
  const { level } = levelFromStrings(["..........", "....#.....", ".........."]);
  const fov = computeFov(level.width, level.height, opaque(level), 0, 1, 6);
  const seen = (x, y) => fov.has(y * level.width + x);
  assert.equal(seen(3, 1), true);
  assert.equal(seen(4, 1), true, "wall is visible");
  assert.equal(seen(5, 1), false, "behind the wall");
  assert.equal(seen(5, 0), true, "around the wall");
  assert.equal(seen(6, 0), false, "beyond the radius");
});
