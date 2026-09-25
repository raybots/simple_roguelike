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
