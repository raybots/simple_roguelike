import assert from "node:assert/strict";
import { test } from "node:test";
import { generateLevel } from "../src/levelgen.js";
import { bfsDistances } from "../src/pathfinding.js";
import { draftRelics, RELIC_IDS } from "../src/relics.js";
import { createRng } from "../src/rng.js";
import { gameFromStrings, levelFromStrings } from "./helpers/maps.js";

function hunt(monsters) {
  for (const m of monsters) m.state = "hunting";
}

test("an adjacent ogre winds up, marking three tiles across the line of attack", () => {
  const { level, player, monsters } = levelFromStrings([".....", "..O..", "..@..", "....."]);
  hunt(monsters);
  const result = monsters[0].takeTurn(level, player);
  assert.deepEqual(result, { windup: true });
  assert.deepEqual(monsters[0].windup, [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 1, y: 2 }]);
  assert.equal(player.hp, player.maxHp, "no damage yet");
});

test("stepping out of the marked tiles dodges the smash", () => {
  const { game, player, monsters } = gameFromStrings([".....", "..O..", "..@..", "....."]);
  hunt(monsters);
  game.playerAction("wait");
  assert.ok(game.isDanger(2, 2));
  game.playerAction("down");
  assert.equal(player.hp, player.maxHp);
  assert.match(game.messages.join("\n"), /thuds into the ground/);
});

test("staying in the marked tiles hurts, and the blow hits other monsters too", () => {
  const { game, player, monsters } = gameFromStrings([".....", "..O..", ".r@..", "....."]);
  const [ogre, rat] = monsters;
  ogre.state = "hunting";
  rat.state = "asleep";
  game.playerAction("wait");
  game.playerAction("wait");
  assert.equal(player.hp, player.maxHp - 8);
  assert.equal(rat.alive, false);
  assert.match(game.messages.join("\n"), /crashes down on you for 8/);
  assert.match(game.messages.join("\n"), /crushes the rat/);
});

test("jumping into a chasm drops you a level for a little damage, then offers relics", () => {
  const { game, level, player } = gameFromStrings(["@...."]);
  level.features.set(1, 0, { type: "chasm" });
  game.playerAction("right");
  assert.equal(game.depth, 2);
  assert.equal(player.hp, player.maxHp - 3);
  assert.equal(game.state, "draft");
  assert.equal(game.draft.length, 3);
});

test("a fall never kills you", () => {
  const { game, level, player } = gameFromStrings(["@...."]);
  level.features.set(1, 0, { type: "chasm" });
  player.hp = 2;
  game.playerAction("right");
  assert.equal(player.hp, 1);
});

test("monsters won't walk into chasms", () => {
  const { level, monsters } = levelFromStrings(["r.@"]);
  level.features.set(1, 0, { type: "chasm" });
  assert.equal(monsters[0].canEnter(level, 1, 0), false);
});

test("chasms never cut off part of the level", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const bp = generateLevel({ width: 60, height: 60, depth: 3, rng: createRng(seed) });
    const pits = new Set(bp.features.filter((f) => f.type === "chasm").map((f) => `${f.x},${f.y}`));
    const blocked = new Set(bp.features.map((f) => `${f.x},${f.y}`));
    const d = bfsDistances(60, 60, (x, y) => bp.walls.get(x, y) === 0 && !blocked.has(`${x},${y}`), bp.playerStart);
    assert.ok(d.get(bp.stairs.x, bp.stairs.y) >= 0, `stairs reachable on seed ${seed}`);
    bp.walls.forEach((x, y, v) => {
      if (v === 0 && !blocked.has(`${x},${y}`)) assert.ok(d.get(x, y) >= 0, `seed ${seed} (${x},${y})`);
    });
    if (seed === 1) assert.ok(pits.size > 0, "some chasms exist");
  }
});

test("no chasms on the first level", () => {
  const bp = generateLevel({ width: 60, height: 60, depth: 1, rng: createRng(1) });
  assert.equal(bp.features.filter((f) => f.type === "chasm").length, 0);
});

test("going down the stairs starts a draft, and only a pick ends it", () => {
  const { game, player } = gameFromStrings(["@>."]);
  game.playerAction("right");
  game.playerAction("descend");
  assert.equal(game.state, "draft");
  assert.equal(game.playerAction("left"), false);
  const pick = game.draft[1];
  game.playerAction("choose2");
  assert.equal(game.state, "playing");
  assert.deepEqual(player.relics, [pick]);
});

test("drafts offer distinct relics and skip ones you own unless stackable", () => {
  const rng = createRng(3);
  for (let i = 0; i < 50; i++) {
    const d = draftRelics(rng, ["ember", "hush"]);
    assert.equal(new Set(d).size, 3);
    assert.ok(!d.includes("ember") && !d.includes("hush"));
  }
  const all = RELIC_IDS.filter((id) => id !== "whetstone" && id !== "heartwood");
  assert.deepEqual(draftRelics(rng, all).sort(), ["heartwood", "whetstone"]);
  assert.deepEqual(draftRelics(rng, [...all, "whetstone", "whetstone"]), ["heartwood"], "stacks cap at two");
});

function withRelic(rows, id) {
  const setup = gameFromStrings(rows);
  setup.game.state = "draft";
  setup.game.draft = [id];
  setup.game.playerAction("choose1");
  return setup;
}

test("Whetstone and Heartwood stack", () => {
  const { game, player } = withRelic(["@."], "whetstone");
  game.state = "draft";
  game.draft = ["whetstone"];
  game.playerAction("choose1");
  assert.equal(player.damage, 4);
  const h = withRelic(["@."], "heartwood");
  assert.equal(h.player.maxHp, 40);
});

test("Iron Skin reduces damage but never below 1", () => {
  const { game, player, monsters } = withRelic(["@g", "r."], "ironskin");
  hunt(monsters);
  game.playerAction("wait");
  assert.equal(player.hp, player.maxHp - 1 - 1, "goblin 2-1, rat 1 stays 1");
});

test("Vampiric Fang heals on kills", () => {
  const { game, player } = withRelic(["@r"], "vampiric");
  player.hp = 20;
  game.playerAction("right");
  assert.equal(player.hp, 21);
});

test("Ember Soul keeps the torch at radius 5", () => {
  const { player } = withRelic(["@."], "ember");
  player.fuel = 1;
  assert.equal(player.torchRadius, 5);
});

test("Shadowstep makes sneak attacks deal 5x", () => {
  const { game, monsters } = withRelic(["@O"], "shadowstep");
  game.playerAction("right");
  assert.equal(monsters[0].hp, 14 - 10);
});

test("Assassin's Hush: in the dark, monsters only notice you when adjacent", () => {
  const { game, player, monsters } = withRelic(["@.r"], "hush");
  player.torchLit = false;
  game.updateVisibility();
  game.playerAction("wait");
  assert.equal(monsters[0].state, "idle");
});

test("Echolocation senses monsters through walls", () => {
  const { game, monsters } = withRelic(["@.#.r"], "echolocation");
  assert.equal(game.isVisible(4, 0), false);
  assert.equal(game.isSensed(monsters[0]), true);
});

test("Deep Pockets, Bandolier and Lantern", () => {
  const p = withRelic(["@."], "pockets");
  p.player.potions = 1;
  p.player.hp = 5;
  p.game.playerAction("quaff");
  assert.equal(p.player.hp, 21);

  const b = withRelic(["@."], "bandolier");
  assert.equal(b.player.maxFuel, 450);
  assert.equal(b.player.fuel, 450);

  const l = withRelic(["@....."], "lantern");
  l.level.features.set(1, 0, { type: "brazier", lit: false });
  l.level.features.set(5, 0, { type: "brazier", lit: false });
  l.player.hp = 10;
  l.game.playerAction("right");
  assert.equal(l.player.hp, 15);
});

test("Cartographer's Eye reveals the stairs", () => {
  const { game } = withRelic(["@."], "cartographer");
  game.goDeeper();
  game.playerAction("choose1");
  const { stairs } = game.level;
  assert.equal(game.level.explored.get(stairs.x, stairs.y), true);
});
