import assert from "node:assert/strict";
import { test } from "node:test";
import { Grid } from "../src/grid.js";

test("get returns null out of bounds and set is a no-op out of bounds", () => {
  const g = new Grid(3, 2);
  assert.equal(g.get(-1, 0), null);
  assert.equal(g.get(3, 0), null);
  assert.equal(g.get(0, 2), null);
  assert.equal(g.set(5, 5, 1), false);
  assert.deepEqual(g.cells, [0, 0, 0, 0, 0, 0]);
});

test("constructor fill value is respected", () => {
  assert.deepEqual(new Grid(2, 2, null).cells, [null, null, null, null]);
  assert.equal(new Grid(2, 2).get(1, 1), 0);
});

test("set and get round-trip at the right index", () => {
  const g = new Grid(4, 3);
  assert.equal(g.set(3, 2, 7), true);
  assert.equal(g.get(3, 2), 7);
  assert.equal(g.cells[2 * 4 + 3], 7);
});

test("clone is a deep copy of cells", () => {
  const g = new Grid(2, 2);
  const c = g.clone();
  c.set(0, 0, 1);
  assert.equal(g.get(0, 0), 0);
  assert.equal(c.get(0, 0), 1);
});
