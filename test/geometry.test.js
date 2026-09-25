import assert from "node:assert/strict";
import { test } from "node:test";
import { distance, line } from "../src/geometry.js";

const pts = (arr) => arr.map(({ x, y }) => [x, y]);

test("line includes both endpoints and every step moves at most one tile", () => {
  const points = line(2, 1, 9, 5);
  assert.deepEqual(points[0], { x: 2, y: 1 });
  assert.deepEqual(points.at(-1), { x: 9, y: 5 });
  for (let i = 1; i < points.length; i++) {
    assert.ok(Math.abs(points[i].x - points[i - 1].x) <= 1);
    assert.ok(Math.abs(points[i].y - points[i - 1].y) <= 1);
  }
});

test("line handles horizontal, vertical, diagonal and single-point cases", () => {
  assert.deepEqual(pts(line(0, 0, 3, 0)), [[0, 0], [1, 0], [2, 0], [3, 0]]);
  assert.deepEqual(pts(line(1, 3, 1, 0)), [[1, 3], [1, 2], [1, 1], [1, 0]]);
  assert.deepEqual(pts(line(0, 0, 2, 2)), [[0, 0], [1, 1], [2, 2]]);
  assert.deepEqual(pts(line(4, 4, 4, 4)), [[4, 4]]);
});

test("distance is Euclidean", () => {
  assert.equal(distance(0, 0, 3, 4), 5);
});
