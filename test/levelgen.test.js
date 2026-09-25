import assert from "node:assert/strict";
import { test } from "node:test";
import { generateLevel } from "../src/levelgen.js";
import { createRng } from "../src/rng.js";

test("monsters spawn on open tiles in the lower half", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { walls, monsters } = generateLevel({ width: 60, height: 60, rng: createRng(seed) });
    for (const m of monsters) {
      assert.equal(walls.get(m.x, m.y), 0);
      assert.ok(m.y >= 30 && m.y < 52);
    }
  }
});

test("the player start tile is open", () => {
  const { walls, playerStart } = generateLevel({ width: 60, height: 60, rng: createRng(1) });
  assert.equal(walls.get(playerStart.x, playerStart.y), 0);
});
