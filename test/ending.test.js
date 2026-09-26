import assert from "node:assert/strict";
import { test } from "node:test";
import { COMFORT_NEEDED, Game } from "../src/game.js";
import { FINAL_DEPTH, generateLevel } from "../src/levelgen.js";
import { createRng } from "../src/rng.js";
import { epitaph } from "../src/theme.js";
import { gameFromStrings } from "./helpers/maps.js";

function ringScene() {
  // The Lightless beside the Sun Stone, with four ring braziers around them.
  const rows = [
    "...........",
    "...........",
    "...........",
    "...........",
    ".....&.....",
    ".....☼.....",
    "...........",
    "...........",
    "@..........",
  ];
  const setup = gameFromStrings(rows);
  const { level } = setup;
  level.items.set(5, 5, { type: "sun" });
  for (const [x, y] of [[2, 2], [8, 2], [2, 8], [8, 8]]) level.features.set(x, y, { type: "brazier", lit: false, ring: true });
  level.updateStaticLight();
  setup.lightless = setup.monsters.find((m) => m.type === "lightless");
  return setup;
}

function lightRing(game, level, count) {
  const ring = [[2, 2], [8, 2], [2, 8], [8, 8]].slice(0, count);
  for (const [x, y] of ring) {
    level.features.get(x, y).lit = true;
    level.updateStaticLight();
    game.warmTheLightless();
  }
}

test("the final level rings the Sun Stone with four cold braziers", () => {
  let rings = 0;
  for (let seed = 1; seed <= 15; seed++) {
    const bp = generateLevel({ width: 60, height: 60, depth: FINAL_DEPTH, rng: createRng(seed) });
    const sun = bp.items.find((i) => i.type === "sun");
    const ring = bp.features.filter((f) => f.ring);
    for (const b of ring) {
      assert.equal(b.lit, false);
      assert.ok(Math.max(Math.abs(b.x - sun.x), Math.abs(b.y - sun.y)) <= 10);
    }
    if (ring.length === 4) rings++;
  }
  assert.ok(rings >= 14, `full rings on ${rings}/15 levels`);
});

test("each lit ring brazier pushes the Lightless's cold back", () => {
  const { game, level } = ringScene();
  const before = game.darkReach;
  lightRing(game, level, 2);
  assert.equal(game.darkReach, before - 3);
});

test("in the cosy game you can't take the Sun Stone from a cold Lightless", () => {
  const { game, level, player } = ringScene();
  level.removeCreature(player);
  level.placeCreature(player, 4, 5);
  game.playerAction("right");
  assert.equal(game.state, "playing");
  assert.deepEqual(level.itemAt(5, 5), { type: "sun" }, "the stone stays put");
  assert.match(game.messages.join("\n"), /so cold and alone/);
});

test("warm it with all four braziers, sit with it, and it becomes a friend; then the stone is yours", () => {
  const { game, level, player, lightless } = ringScene();
  lightRing(game, level, 4);
  assert.equal(lightless.state, "thawing");
  assert.match(game.messages.at(-1), /leans toward the warmth/);

  level.removeCreature(player);
  level.placeCreature(player, 4, 4);
  for (let i = 0; i < COMFORT_NEEDED; i++) game.playerAction("wait");
  assert.equal(lightless.state, "friendly");
  assert.equal(game.darkReach, 0);
  assert.match(game.messages.join("\n"), /only lonely/);

  game.playerAction("down");
  game.playerAction("right");
  assert.equal(game.state, "won");
  assert.match(epitaph(game).line, /warmed the Lightless/);
});

test("a thawing Lightless doesn't fight", () => {
  const { game, level, player, lightless } = ringScene();
  lightRing(game, level, 4);
  level.removeCreature(player);
  level.placeCreature(player, 4, 4);
  player.hp = 5;
  for (let i = 0; i < 2; i++) game.playerAction("wait");
  assert.ok(player.hp >= 5, "never hurt");
  assert.equal(lightless.windup, null);
});

test("at Night the old ending stands: grab the stone and win", () => {
  const game = new Game({ rng: createRng(3), night: true });
  while (game.depth < FINAL_DEPTH) {
    game.goDeeper();
    if (game.state === "draft") game.playerAction("choose1");
  }
  let sun = null;
  game.level.items.forEach((x, y, item) => {
    if (item?.type === "sun") sun = { x, y, item };
  });
  game.level.removeCreature(game.player);
  game.player.moveTo(sun.x, sun.y);
  game.pickUp(sun.item);
  assert.equal(game.state, "won");
});
