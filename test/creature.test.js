import assert from "node:assert/strict";
import { test } from "node:test";
import { Creature } from "../src/creature.js";

test("attack reduces hp by damage and reports the killing blow", () => {
  const a = new Creature({ damage: 1 });
  const b = new Creature({ hp: 2 });
  assert.deepEqual(a.attack(b), { damage: 1, killed: false });
  assert.equal(b.hp, 1);
  assert.deepEqual(a.attack(b), { damage: 1, killed: true });
});

test("alive flips at zero hp", () => {
  const c = new Creature({ hp: 1 });
  assert.equal(c.alive, true);
  c.hp = 0;
  assert.equal(c.alive, false);
});
