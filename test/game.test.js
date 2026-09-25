import assert from "node:assert/strict";
import { test } from "node:test";
import { Game } from "../src/game.js";
import { createRng } from "../src/rng.js";
import { gameFromStrings } from "./helpers/maps.js";

const ACTIONS = ["left", "right", "up", "down", "wait", "descend", "quaff", "torch", "choose1", "choose2", "choose3"];

test("the player moves one tile and the turn advances", () => {
  const { game, player } = gameFromStrings(["@.."]);
  assert.equal(game.playerAction("right"), true);
  assert.deepEqual([player.x, player.y], [1, 0]);
  assert.equal(game.turn, 1);
});

test("bumping a wall costs no turn", () => {
  const { game } = gameFromStrings(["@#"]);
  assert.equal(game.playerAction("right"), false);
  assert.equal(game.turn, 0);
});

test("unknown actions are ignored", () => {
  const { game } = gameFromStrings(["@."]);
  assert.equal(game.playerAction("dance"), false);
  assert.equal(game.turn, 0);
});

test("waiting lets monsters act", () => {
  const { game, monsters } = gameFromStrings(["r...@"]);
  monsters[0].seenPlayer = true;
  game.playerAction("wait");
  assert.equal(monsters[0].x, 1);
  assert.equal(game.turn, 1);
});

test("combat is reported in the message log", () => {
  const { game, monsters } = gameFromStrings(["@g"]);
  monsters[0].seenPlayer = true;
  game.playerAction("right");
  assert.deepEqual(game.messages, ["You hit the goblin.", "The goblin hits you for 2."]);
  game.playerAction("right");
  game.playerAction("right");
  assert.equal(game.messages.at(-1), "You kill the goblin.");
});

test("descending on stairs builds a new level and keeps hp and potions", () => {
  const { game, player } = gameFromStrings(["@>."]);
  player.hp = 17;
  player.potions = 2;
  game.playerAction("right");
  game.playerAction("descend");
  assert.equal(game.depth, 2);
  assert.equal(game.level.width, 60);
  assert.equal(game.player.hp, 17);
  assert.equal(game.player.potions, 2);
  assert.equal(game.level.creatureAt(game.player.x, game.player.y), game.player);
  assert.equal(game.messages.at(-1), "You descend to depth 2.");
});

test("descending without stairs just logs a message", () => {
  const { game } = gameFromStrings(["@.>"]);
  assert.equal(game.playerAction("descend"), true);
  assert.equal(game.depth, 1);
  assert.equal(game.turn, 0);
  assert.equal(game.messages.at(-1), "There are no stairs here.");
});

test("potions are picked up and heal up to max hp", () => {
  const { game, player } = gameFromStrings(["@!!"]);
  game.playerAction("right");
  game.playerAction("right");
  assert.equal(player.potions, 2);

  player.hp = 25;
  game.playerAction("quaff");
  assert.equal(player.hp, 30);
  assert.equal(player.potions, 1);
  assert.equal(game.turn, 3, "drinking takes a turn");
  assert.equal(game.messages.at(-1), "You drink a potion and recover 5 HP.");
});

test("drinking with no potions costs no turn", () => {
  const { game } = gameFromStrings(["@."]);
  game.playerAction("quaff");
  assert.equal(game.turn, 0);
  assert.equal(game.messages.at(-1), "You have no potions.");
});

test("the player can die, then only restart works", () => {
  const { game, player, monsters } = gameFromStrings(["@g."]);
  monsters[0].seenPlayer = true;
  player.hp = 2;
  game.playerAction("wait");
  assert.equal(game.state, "dead");
  assert.match(game.messages.at(-1), /^You die on depth 1 after 1 turn\.$/);

  assert.equal(game.playerAction("left"), false);
  assert.equal(game.playerAction("restart"), true);
  assert.equal(game.state, "playing");
  assert.equal(game.depth, 1);
  assert.equal(game.player.hp, 30);
  assert.equal(game.turn, 0);
});

test("the field of view marks tiles as explored", () => {
  const { game, level } = gameFromStrings(["@....#...."]);
  assert.equal(game.isVisible(4, 0), true);
  assert.equal(game.isVisible(5, 0), true, "the wall itself is visible");
  assert.equal(game.isVisible(6, 0), false, "nothing behind the wall");
  assert.equal(level.explored.get(4, 0), true);
  assert.equal(level.explored.get(6, 0), false);
});

test("random play keeps the world consistent", () => {
  for (let seed = 1; seed <= 5; seed++) {
    const game = new Game({ rng: createRng(seed) });
    const moves = createRng(seed + 1000);
    for (let i = 0; i < 400; i++) {
      if (game.state === "dead") game.playerAction("restart");
      game.playerAction(moves.pick(ACTIONS));
      for (const c of [game.player, ...game.level.monsters.filter((m) => m.alive)]) {
        assert.equal(game.level.isWall(c.x, c.y), false, `seed ${seed} turn ${i}`);
        assert.equal(game.level.creatureAt(c.x, c.y), c);
      }
      assert.ok(game.player.hp <= game.player.maxHp);
    }
  }
});

test("the same seed and actions produce the same game", () => {
  const snapshot = (g) =>
    JSON.stringify([g.depth, g.player.x, g.player.y, g.player.hp, g.level.monsters.map((m) => [m.x, m.y, m.hp])]);
  const a = new Game({ rng: createRng(99) });
  const b = new Game({ rng: createRng(99) });
  const moves = createRng(5);
  for (let i = 0; i < 100; i++) {
    const action = moves.pick(ACTIONS);
    a.playerAction(action);
    b.playerAction(action);
  }
  assert.equal(snapshot(a), snapshot(b));
});
