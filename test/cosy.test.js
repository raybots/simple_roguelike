import assert from "node:assert/strict";
import { test } from "node:test";
import { Game } from "../src/game.js";
import { generateLevel } from "../src/levelgen.js";
import { bfsDistances } from "../src/pathfinding.js";
import { createRng } from "../src/rng.js";
import { restoreGame, serializeGame } from "../src/save.js";
import { addBrazier, gameFromStrings } from "./helpers/maps.js";

test("every cosy level has several cold braziers, one close to the start", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const bp = generateLevel({ width: 60, height: 60, depth: 2, rng: createRng(seed) });
    const braziers = bp.features.filter((f) => f.type === "brazier");
    assert.ok(braziers.length >= 3, `seed ${seed}: ${braziers.length} braziers`);
    assert.ok(braziers.every((b) => !b.lit), "all start cold");
    const d = bfsDistances(60, 60, (x, y) => bp.walls.get(x, y) === 0, bp.playerStart);
    const nearest = Math.min(...braziers.map((b) => d.get(b.x, b.y)));
    assert.ok(nearest <= 12, `seed ${seed}: nearest brazier ${nearest} away`);
  }
});

test("Night has fewer braziers, some already lit", () => {
  const counts = [];
  for (let seed = 1; seed <= 20; seed++) {
    const bp = generateLevel({ width: 60, height: 60, depth: 2, rng: createRng(seed), night: true });
    counts.push(bp.features.filter((f) => f.type === "brazier").length);
  }
  assert.ok(Math.max(...counts) <= 2);
});

test("warmth counts lit braziers", () => {
  const { game, level } = gameFromStrings(["@....."]);
  addBrazier(level, 2, 0, true);
  addBrazier(level, 4, 0, false);
  assert.deepEqual(game.warmth, { lit: 1, total: 2 });
});

test("resting by a lit brazier heals and refuels, but not while hunted", () => {
  const { game, level, player, monsters } = gameFromStrings(["@.....", "......", ".....r"]);
  addBrazier(level, 1, 1, true);
  player.hp = 10;
  player.fuel = 100;
  monsters[0].state = "asleep";
  game.playerAction("wait");
  assert.equal(player.hp, 12);
  assert.equal(player.fuel, 100 - 1 + 25);
  assert.match(game.messages.at(-1), /warm your hands/);

  monsters[0].state = "hunting";
  game.updateVisibility();
  game.playerAction("wait");
  assert.equal(player.hp, 12, "no rest with something hunting you");
});

test("resting away from any fire does nothing special, and Night never rests", () => {
  const { game, player } = gameFromStrings(["@....."]);
  player.hp = 10;
  game.playerAction("wait");
  assert.equal(player.hp, 10);

  const night = gameFromStrings(["@....."], 1, { night: true });
  addBrazier(night.level, 1, 0, true);
  night.player.hp = 10;
  night.game.playerAction("wait");
  assert.equal(night.player.hp, 10);
});

test("lighting the last brazier makes the cave sigh: full health, full torch, sleeping monsters", () => {
  const { game, level, player, monsters } = gameFromStrings(["@......", ".......", "......g"]);
  addBrazier(level, 1, 0, true);
  addBrazier(level, 3, 1, false);
  monsters[0].state = "hunting";
  player.hp = 5;
  player.fuel = 50;
  game.playerAction("down");
  game.playerAction("right");
  game.playerAction("right");
  game.playerAction("right");
  assert.equal(level.warmed, true);
  assert.equal(monsters[0].state, "asleep");
  assert.equal(player.hp, player.maxHp);
  assert.match(game.messages.join("\n"), /whole cave sighs/);
  assert.ok(game.effects.some((e) => e.type === "warmed"));
});

test("in the cosy game you don't die: you faint, then wake rested on the same depth", () => {
  const { game, player, monsters } = gameFromStrings(["@g."]);
  monsters[0].seenPlayer = true;
  player.hp = 2;
  player.potions = 2;
  player.relics.push("whetstone");
  game.depth = 3;
  game.playerAction("wait");
  assert.equal(game.state, "resting");
  assert.equal(game.playerAction("left"), false);
  game.playerAction("restart");
  assert.equal(game.state, "playing");
  assert.equal(game.depth, 3);
  assert.equal(game.player, player, "same Wick");
  assert.equal(player.hp, player.maxHp);
  assert.equal(player.potions, 2);
  assert.deepEqual(player.relics, ["whetstone"]);
  assert.equal(game.faints, 1);
  assert.match(game.messages.at(-1), /wakes at the Hearth/);
});

test("a saved game restores exactly and plays on identically", () => {
  const moves = createRng(77);
  const ACTIONS = ["left", "right", "up", "down", "wait", "torch", "throw", "ignite", "choose1", "descend"];
  const a = new Game({ rng: createRng(31) });
  for (let i = 0; i < 150; i++) a.playerAction(moves.pick(ACTIONS));
  const saved = JSON.parse(JSON.stringify(serializeGame(a)));
  const b = restoreGame(saved);
  assert.ok(b);
  const snap = (g) =>
    JSON.stringify([
      g.depth,
      g.turn,
      g.state,
      g.player,
      g.level.monsters.map((m) => [m.type, m.x, m.y, m.hp, m.state]),
      g.level.features.cells,
      g.messages.slice(-5),
    ]);
  assert.equal(snap(b), snap(a));
  for (let i = 0; i < 150; i++) {
    const action = moves.pick(ACTIONS);
    a.playerAction(action);
    b.playerAction(action);
  }
  assert.equal(snap(b), snap(a));
});

test("old or broken saves are ignored", () => {
  assert.equal(restoreGame(null), null);
  assert.equal(restoreGame({ version: 0 }), null);
});
