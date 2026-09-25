import assert from "node:assert/strict";
import { test } from "node:test";
import { Game } from "../src/game.js";
import { createRng } from "../src/rng.js";

const ACTIONS = ["left", "right", "up", "down"];

test("the player moves one tile and the turn advances", () => {
  const game = new Game({ rng: createRng(1) });
  assert.equal(game.playerAction("right"), true);
  assert.deepEqual([game.player.x, game.player.y], [1, 0]);
  assert.equal(game.turn, 1);
});

test("unknown actions are ignored", () => {
  const game = new Game({ rng: createRng(1) });
  assert.equal(game.playerAction("dance"), false);
  assert.equal(game.turn, 0);
});

test("a blocked move still spends a turn", () => {
  const game = new Game({ rng: createRng(1) });
  game.playerAction("left");
  assert.deepEqual([game.player.x, game.player.y], [0, 0]);
  assert.equal(game.turn, 1);
});

test("random play never puts a creature in a wall or out of bounds", () => {
  for (let seed = 1; seed <= 5; seed++) {
    const game = new Game({ rng: createRng(seed) });
    const moves = createRng(seed + 1000);
    for (let i = 0; i < 300; i++) {
      game.playerAction(moves.pick(ACTIONS));
      for (const c of [game.player, ...game.level.monsters.filter((m) => m.alive)]) {
        assert.equal(game.level.isWall(c.x, c.y), false, `seed ${seed} turn ${i}`);
        assert.equal(game.level.creatureAt(c.x, c.y), c);
      }
    }
  }
});

test("the same seed and actions produce the same game", () => {
  const snapshot = (g) =>
    JSON.stringify([g.player.x, g.player.y, g.player.hp, g.level.monsters.map((m) => [m.x, m.y, m.hp])]);
  const a = new Game({ rng: createRng(99) });
  const b = new Game({ rng: createRng(99) });
  const moves = ["down", "down", "right", "down", "left", "down", "down", "right"];
  for (let i = 0; i < 50; i++) {
    a.playerAction(moves[i % moves.length]);
    b.playerAction(moves[i % moves.length]);
  }
  assert.equal(snapshot(a), snapshot(b));
});
