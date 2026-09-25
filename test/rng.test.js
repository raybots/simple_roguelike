import assert from "node:assert/strict";
import { test } from "node:test";
import { createRng, mulberry32 } from "../src/rng.js";

test("same seed yields identical sequences", () => {
  const a = createRng(123);
  const b = createRng(123);
  for (let i = 0; i < 100; i++) assert.equal(a.random(), b.random());
});

test("random() is in [0,1) and int(min,max) stays in range", () => {
  const rng = createRng(9);
  for (let i = 0; i < 10000; i++) {
    const r = rng.random();
    assert.ok(r >= 0 && r < 1);
    const n = rng.int(3, 7);
    assert.ok(Number.isInteger(n) && n >= 3 && n < 7);
  }
});

test("mulberry32(1) produces the known first values", () => {
  const r = mulberry32(1);
  assert.equal(r(), 0.6270739405881613);
  assert.equal(r(), 0.002735721180215478);
  assert.equal(r(), 0.5274470399599522);
});

test("createRng exposes its seed", () => {
  assert.equal(createRng(42).seed, 42);
});
