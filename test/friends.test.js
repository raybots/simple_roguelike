import assert from "node:assert/strict";
import { test } from "node:test";
import { createMonster } from "../src/bestiary.js";
import { Game } from "../src/game.js";
import { createRng } from "../src/rng.js";
import { restoreGame, serializeGame } from "../src/save.js";
import { addBrazier, gameFromStrings, levelFromStrings } from "./helpers/maps.js";

function addCat(game, x, y, state = "friendly") {
  const cat = createMonster("cat", x, y, 1, state);
  cat.companion = true;
  cat.follows = state === "friendly";
  game.level.addMonster(cat);
  if (state === "friendly") game.player.hasCat = true;
  return cat;
}

test("a stray cat waits on depth 2, and walking up to it makes it yours", () => {
  const game = new Game({ rng: createRng(4) });
  game.goDeeper();
  if (game.state === "draft") game.playerAction("choose1");
  const stray = game.cat;
  assert.ok(stray, "a cat on depth 2");
  assert.equal(stray.state, "shy");
  assert.match(game.messages.join("\n"), /hungry mew/);

  const { game: g, player } = gameFromStrings(["@c.."]);
  const cat = addCat(g, 1, 0, "shy");
  g.level.creatures.set(1, 0, cat);
  g.playerAction("right");
  assert.equal(cat.state, "friendly");
  assert.equal(player.hasCat, true);
  assert.ok(g.effects.some((e) => e.type === "befriend" && e.kind === "cat"));
});

test("once yours, the cat follows you to every level", () => {
  const game = new Game({ rng: createRng(5), hasCat: true });
  assert.ok(game.cat?.friendly);
  game.goDeeper();
  if (game.state === "draft") game.playerAction("choose1");
  const { cat, player } = game;
  assert.ok(cat?.friendly);
  assert.ok(Math.abs(cat.x - player.x) + Math.abs(cat.y - player.y) <= 2, "right beside you");
});

test("the cat trots after you, and curls up when you rest", () => {
  const { game, player } = gameFromStrings(["@........"]);
  const cat = addCat(game, 1, 0);
  for (let i = 0; i < 5; i++) game.playerAction("right");
  assert.ok(Math.abs(cat.x - player.x) <= 2, "kept up");
  game.playerAction("wait");
  assert.equal(cat.curled, true);
});

test("you swap places with friends instead of attacking them", () => {
  const { game, player } = gameFromStrings(["@c."]);
  const cat = addCat(game, 1, 0);
  game.playerAction("right");
  assert.deepEqual([player.x, cat.x], [1, 0]);
  assert.equal(cat.hp, cat.maxHp);
});

test("the cat can't be hurt: caught in a blow, it bolts to the stairs and waits", () => {
  const { game, level, monsters } = gameFromStrings(["@......>", "..O....."]);
  level.stairs = { x: 7, y: 0 };
  const cat = addCat(game, 2, 0);
  const ogre = monsters[0];
  ogre.state = "hunting";
  ogre.windup = [{ x: 2, y: 0 }];
  game.playerAction("wait");
  assert.equal(cat.hp, cat.maxHp);
  assert.ok(Math.abs(cat.x - 7) + Math.abs(cat.y) <= 3);
  assert.equal(cat.waiting, true);
  assert.match(game.messages.join("\n"), /bolts into the dark, unhurt/);
});

test("petting the cat heals 1, once per level", () => {
  const { game, player } = gameFromStrings(["@c."]);
  addCat(game, 1, 0);
  player.hp = 20;
  game.playerAction("pet");
  assert.equal(player.hp, 21);
  game.playerAction("pet");
  assert.equal(player.hp, 21);
  assert.match(game.messages.at(-1), /purrs/);
});

test("the cat warns you about unseen hunters", () => {
  const { game, player } = gameFromStrings(["@c.#....", "...#..g.", "...#...."]);
  const cat = addCat(game, 1, 0);
  const goblin = game.level.monsters.find((m) => m.type === "goblin");
  goblin.state = "hunting";
  goblin.torch = 0;
  player.torchLit = false;
  game.updateVisibility();
  game.playerAction("wait");
  assert.match(game.messages.join("\n"), /ears prick up/);
  assert.ok(cat.warning > 0);
});

test("a crust befriends a rat, which then follows you", () => {
  const { game, player, monsters } = gameFromStrings(["@r...."]);
  player.crusts = 1;
  game.playerAction("right");
  assert.equal(monsters[0].state, "friendly");
  assert.equal(monsters[0].follows, true);
  assert.equal(monsters[0].hp, monsters[0].maxHp);
  assert.equal(player.crusts, 0);
});

test("a coin buys a goblin's friendship and a vial or some oil", () => {
  const { game, player, monsters } = gameFromStrings(["@g"]);
  player.coins = 1;
  const potions = player.potions;
  game.playerAction("right");
  assert.equal(monsters[0].state, "friendly");
  assert.equal(player.coins, 0);
  assert.ok(player.potions === potions + 1 || player.fuel > 0);
  game.playerAction("wait");
  assert.equal(player.hp, player.maxHp, "friends don't hit");
});

test("stew calms a grumpy ogre, even mid-swing", () => {
  const { game, player, monsters } = gameFromStrings(["@O"]);
  const ogre = monsters[0];
  ogre.state = "hunting";
  ogre.windup = [{ x: 0, y: 0 }];
  player.stews = 1;
  game.playerAction("right");
  game.playerAction("wait");
  assert.equal(ogre.state, "friendly");
  assert.equal(player.hp, player.maxHp);
});

test("at Night there are no gifts", () => {
  const { game, player, monsters } = gameFromStrings(["@r"], 1, { night: true });
  player.crusts = 1;
  game.playerAction("right");
  assert.equal(monsters[0].alive, false);
});

test("cooking glowcaps by the fire makes stew; eating it heals and brightens the torch", () => {
  const { game, level, player } = gameFromStrings(["@.....", "......"]);
  player.mushrooms = 1;
  game.playerAction("cook");
  assert.match(game.messages.at(-1), /by a lit brazier/);
  addBrazier(level, 1, 1, true);
  game.playerAction("cook");
  assert.equal(player.stews, 1);
  player.hp = 10;
  const radius = game.torchRadius;
  game.playerAction("eat");
  assert.equal(player.hp, 22);
  assert.equal(game.torchRadius, radius + 2);
});

test("comfort items are picked up into the satchel", () => {
  const { game, level, player } = gameFromStrings(["@...."]);
  level.items.set(1, 0, { type: "crust" });
  level.items.set(2, 0, { type: "coin" });
  level.items.set(3, 0, { type: "mushroom" });
  for (let i = 0; i < 3; i++) game.playerAction("right");
  assert.deepEqual([player.crusts, player.coins, player.mushrooms], [1, 1, 1]);
});

test("sleeping bats stay asleep in the dark", () => {
  const { level, player, monsters } = levelFromStrings(["b.@"]);
  monsters[0].state = "asleep";
  monsters[0].takeTurn(level, player, { chance: () => true }, { playerLit: false });
  assert.equal(monsters[0].state, "asleep");
  monsters[0].takeTurn(level, player, { chance: () => true }, { playerLit: true });
  assert.equal(monsters[0].state, "alert");
});

test("friends and the cat survive a save", () => {
  const game = new Game({ rng: createRng(6), hasCat: true });
  game.player.crusts = 2;
  const back = restoreGame(JSON.parse(JSON.stringify(serializeGame(game))));
  assert.ok(back.cat?.friendly && back.cat.follows && back.cat.companion);
  assert.equal(back.player.crusts, 2);
  assert.equal(back.player.hasCat, true);
});
