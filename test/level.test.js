import assert from "node:assert/strict";
import { test } from "node:test";
import { levelFromStrings } from "./helpers/maps.js";

test("moving into a wall does nothing", () => {
  const { level, player } = levelFromStrings(["@#"]);
  const result = level.moveCreature(player, 1, 0);
  assert.equal(result.moved, false);
  assert.deepEqual([player.x, player.y], [0, 0]);
});

test("moving out of bounds is rejected", () => {
  const { level, player } = levelFromStrings(["@."]);
  assert.equal(level.moveCreature(player, -1, 0).moved, false);
  assert.deepEqual([player.x, player.y], [0, 0]);
});

test("moving onto floor updates position and the creature grid", () => {
  const { level, player } = levelFromStrings(["@."]);
  assert.equal(level.moveCreature(player, 1, 0).moved, true);
  assert.equal(level.creatureAt(0, 0), null);
  assert.equal(level.creatureAt(1, 0), player);
});

test("moving into a living creature attacks instead of moving", () => {
  const { level, player, monsters } = levelFromStrings(["@g"]);
  const result = level.moveCreature(player, 1, 0);
  assert.equal(result.moved, false);
  assert.equal(result.target, monsters[0]);
  assert.equal(monsters[0].hp, monsters[0].maxHp - player.damage);
  assert.deepEqual([player.x, player.y], [0, 0]);
});

test("a killed monster frees its tile", () => {
  const { level, player, monsters } = levelFromStrings(["@r"]);
  const result = level.moveCreature(player, 1, 0);
  assert.equal(result.killed, true);
  assert.equal(level.creatureAt(1, 0), null);
  assert.equal(level.moveCreature(player, 1, 0).moved, true);
  assert.equal(monsters.length, 1, "corpse stays in the monster list for rendering");
});

test("placeCreature refuses occupied tiles and walls", () => {
  const { level, monsters } = levelFromStrings(["@r#"]);
  assert.equal(level.placeCreature(monsters[0], 0, 0), false);
  assert.equal(level.placeCreature(monsters[0], 2, 0), false);
});

test("the player picks up an item by stepping on it, monsters don't", () => {
  const { level, player, monsters } = levelFromStrings(["@!.", "..r", "..!"]);
  const result = level.moveCreature(player, 1, 0);
  assert.deepEqual(result.item, { type: "potion" });
  assert.equal(level.itemAt(1, 0), null);

  const monsterMove = level.moveCreature(monsters[0], 2, 2);
  assert.equal(monsterMove.item, null);
  assert.deepEqual(level.itemAt(2, 2), { type: "potion" });
});

test("monsters are built from the bestiary with depth bonus hp", () => {
  const shallow = levelFromStrings(["g"]).monsters[0];
  const deep = levelFromStrings(["g"], { depth: 7 }).monsters[0];
  assert.equal(shallow.name, "goblin");
  assert.equal(deep.maxHp, shallow.maxHp + 2);
});
