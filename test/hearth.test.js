import assert from "node:assert/strict";
import { test } from "node:test";
import { Game } from "../src/game.js";
import { buy, canBuy, DECOR, DECOR_IDS, EMBERS, hearthScene } from "../src/hearth.js";
import { JOURNAL } from "../src/journal.js";
import { KEEPSAKE_IDS, KEEPSAKES, pickKeepsake } from "../src/keepsakes.js";
import { MONSTER_TYPES } from "../src/bestiary.js";
import { createRng } from "../src/rng.js";
import { addBrazier, gameFromStrings } from "./helpers/maps.js";

const embers = (game) => game.effects.filter((e) => e.type === "ember").reduce((s, e) => s + e.amount, 0);

test("lighting braziers, warming a cave and going deeper earn embers", () => {
  const { game, level } = gameFromStrings(["@......"]);
  addBrazier(level, 1, 0, false);
  addBrazier(level, 5, 0, false);
  game.playerAction("right");
  assert.equal(embers(game), EMBERS.brazier);

  level.features.get(1, 0).lit = true;
  level.features.get(5, 0).lit = false;
  level.updateStaticLight();
  game.level.removeCreature(game.player);
  game.level.placeCreature(game.player, 4, 0);
  game.playerAction("right");
  assert.equal(embers(game), EMBERS.brazier + EMBERS.warmed);

  game.effects = [];
  game.goDeeper();
  assert.equal(embers(game), EMBERS.depth);
  game.depth = 1;
  game.effects = [];
  game.goDeeper();
  assert.equal(embers(game), 0, "only new depths count");
});

test("Night earns no embers", () => {
  const { game, level } = gameFromStrings(["@......"], 1, { night: true });
  addBrazier(level, 1, 0, false);
  game.playerAction("right");
  assert.equal(embers(game), 0);
});

test("keepsakes are found, logged, and never repeat", () => {
  const owned = [];
  const game = new Game({ rng: createRng(9), ownedKeepsakes: owned });
  const found = new Set();
  for (let i = 0; i < 40; i++) {
    game.level.items.forEach((x, y, item) => {
      if (item?.type !== "keepsake") return;
      assert.ok(!found.has(item.id), `${item.id} found twice`);
      found.add(item.id);
      game.pickUp(item);
      game.level.items.set(x, y, null);
    });
    game.goDeeper();
    if (game.state === "draft") game.playerAction("choose1");
  }
  assert.ok(found.size >= 10, `found ${found.size}`);
  assert.deepEqual([...found].sort(), [...owned].sort(), "the shared shelf list is updated");
  assert.equal(pickKeepsake(createRng(1), KEEPSAKE_IDS), null, "none left to find");
});

test("a warmed cave leaves a keepsake close by", () => {
  const { game, level } = gameFromStrings(["@......", "......."]);
  addBrazier(level, 1, 0, false);
  game.playerAction("right");
  let nearby = false;
  level.items.forEach((x, y, item) => {
    if (item?.type === "keepsake" && Math.hypot(x, y) <= 4) nearby = true;
  });
  assert.ok(nearby);
});

test("the first sighting of each creature is reported once, for the journal", () => {
  const { game } = gameFromStrings(["@....r...r"]);
  game.playerAction("wait");
  assert.deepEqual(game.effects.filter((e) => e.type === "discover").map((e) => e.kind), ["rat"]);
  game.playerAction("wait");
  assert.equal(game.effects.filter((e) => e.type === "discover").length, 0);
});

test("every creature has a journal entry and every keepsake a story", () => {
  for (const type of Object.keys(MONSTER_TYPES)) assert.ok(JOURNAL[type]?.note, type);
  for (const id of KEEPSAKE_IDS) assert.ok(KEEPSAKES[id].name && KEEPSAKES[id].story, id);
});

test("decorations cost embers and can only be bought once", () => {
  const meta = { embers: 12, decor: [] };
  assert.equal(canBuy(meta, "kettle"), false);
  assert.equal(buy(meta, "rug"), true);
  assert.equal(meta.embers, 2);
  assert.equal(buy(meta, "rug"), false);
  assert.deepEqual(meta.decor, ["rug"]);
  const total = DECOR_IDS.reduce((s, id) => s + DECOR[id].cost, 0);
  assert.ok(total > 100 && total < 300, `all decor costs ${total}`);
});

test("the Hearth scene shows what you own", () => {
  const text = (rows) => rows.map((r) => r.map(([g]) => g).join("")).join("\n");
  const bare = text(hearthScene([]));
  const cosy = text(hearthScene(["kettle", "rug", "lanterns", "books"], { cat: true }));
  assert.ok(!bare.includes("♨") && cosy.includes("♨"));
  assert.ok(cosy.includes("✧") && cosy.includes("▤") && cosy.includes("c"));
  assert.ok(bare.includes("@") && bare.includes("^^^"));
  for (const row of hearthScene(DECOR_IDS)) assert.equal(row.length, 30);
});
