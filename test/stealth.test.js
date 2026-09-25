import assert from "node:assert/strict";
import { test } from "node:test";
import { gameFromStrings, levelFromStrings } from "./helpers/maps.js";

test("an idle monster notices a lit player, takes a turn to react, then hunts", () => {
  const { level, player, monsters } = levelFromStrings(["r.....@"]);
  const rat = monsters[0];
  rat.takeTurn(level, player, null, { playerLit: true });
  assert.equal(rat.state, "alert");
  rat.takeTurn(level, player, null, { playerLit: true });
  assert.equal(rat.state, "hunting");
});

test("in the dark you are only noticed up close", () => {
  const { level, player, monsters } = levelFromStrings(["r.....@"]);
  const rat = monsters[0];
  rat.takeTurn(level, player, null, { playerLit: false });
  assert.equal(rat.state, "idle");
  const close = levelFromStrings(["r.@"]);
  close.monsters[0].takeTurn(close.level, close.player, null, { playerLit: false });
  assert.equal(close.monsters[0].state, "alert");
});

test("an alert monster that loses you calms down", () => {
  const { level, player, monsters } = levelFromStrings(["r.....@"]);
  const rat = monsters[0];
  rat.state = "alert";
  for (let i = 0; i < 4; i++) rat.takeTurn(level, player, null, { playerLit: false });
  assert.equal(rat.state, "idle");
});

test("sleepers only wake when you're close and lit", () => {
  const { level, player, monsters } = levelFromStrings(["r......@"]);
  const rat = monsters[0];
  rat.state = "asleep";
  rat.takeTurn(level, player, { chance: () => false }, { playerLit: true });
  assert.equal(rat.state, "asleep");
  level.moveCreature(player, 3, 0);
  rat.takeTurn(level, player, { chance: () => false }, { playerLit: true });
  assert.equal(rat.state, "alert");
});

test("attacking an unaware monster does triple damage", () => {
  const { game, monsters } = gameFromStrings(["@g"]);
  game.playerAction("right");
  assert.equal(monsters[0].alive, false);
  assert.equal(game.messages[0], "You strike the unaware goblin dead!");
});

test("hitting a monster makes it hunt you and wakes nearby sleepers", () => {
  const { game, monsters } = gameFromStrings(["@O..r"]);
  const [ogre, rat] = monsters;
  rat.state = "asleep";
  game.playerAction("right");
  assert.equal(ogre.state, "hunting");
  assert.notEqual(rat.state, "asleep");
});

test("a monster noticing you is logged when you can see it", () => {
  const { game } = gameFromStrings(["@....r"]);
  game.playerAction("wait");
  assert.equal(game.messages.at(-1), "The rat notices you.");
});
