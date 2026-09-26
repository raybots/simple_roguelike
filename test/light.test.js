import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_FUEL } from "../src/player.js";
import { addBrazier, gameFromStrings, levelFromStrings } from "./helpers/maps.js";

const row = (s) => s;

test("the torch radius shrinks as fuel burns", () => {
  const { player } = levelFromStrings(["@"]);
  assert.equal(player.torchRadius, 8);
  player.fuel = MAX_FUEL / 2;
  assert.equal(player.torchRadius, 6);
  player.fuel = 1;
  assert.equal(player.torchRadius, 4);
  player.fuel = 0;
  assert.equal(player.torchRadius, 0);
});

test("each turn burns one fuel, and warnings are logged", () => {
  const { game, player } = gameFromStrings(["@.."]);
  player.fuel = 101;
  game.playerAction("wait");
  assert.equal(player.fuel, 100);
  assert.equal(game.messages.at(-1), "Your torch burns low.");
  player.fuel = 1;
  game.playerAction("wait");
  assert.equal(game.messages.at(-1), "Your torch sputters out. The dark settles around you.");
  assert.equal(player.torchBurning, false);
});

test("without a torch you only see adjacent tiles", () => {
  const { game, player } = gameFromStrings([row("@......")]);
  player.torchLit = false;
  game.updateVisibility();
  assert.equal(game.isVisible(1, 0), true);
  assert.equal(game.isVisible(2, 0), false);
  assert.equal(game.playerLit, false);
});

test("a doused torch saves fuel and can be relit", () => {
  const { game, player } = gameFromStrings(["@.."]);
  game.playerAction("torch");
  assert.equal(player.torchLit, false);
  const fuel = player.fuel;
  game.playerAction("wait");
  assert.equal(player.fuel, fuel);
  game.playerAction("torch");
  assert.equal(player.torchLit, true);
});

test("oil refills the torch up to the maximum", () => {
  const { game, player } = gameFromStrings(["@¤."]);
  player.fuel = MAX_FUEL - 50;
  game.level.items.set(1, 0, { type: "oil" });
  game.playerAction("right");
  assert.equal(player.fuel, MAX_FUEL - 1);
});

test("you can see things lit by a brazier far beyond your own torch", () => {
  const { game, level, player } = gameFromStrings(["@" + ".".repeat(14)]);
  player.torchLit = false;
  addBrazier(level, 13, 0, true);
  game.updateVisibility();
  assert.equal(game.isVisible(12, 0), true);
  assert.equal(game.isVisible(5, 0), false, "dark gap between you and the light");
  assert.ok(game.lightAt(12, 0) > game.lightAt(10, 0));
});

test("light around a corner shows as glow but is not visible", () => {
  const { game, level } = gameFromStrings([
    "@....#....",
    "#####.....",
  ]);
  addBrazier(level, 8, 1, true);
  game.updateVisibility();
  assert.ok(game.lightAt(8, 0) > 0);
  assert.equal(game.isVisible(8, 0), false);
});

test("bumping an unlit brazier lights it for some fuel", () => {
  const { game, level, player } = gameFromStrings(["@....."]);
  addBrazier(level, 1, 0, false);
  addBrazier(level, 5, 0, false);
  const fuel = player.fuel;
  game.playerAction("right");
  assert.equal(level.featureAt(1, 0).lit, true);
  assert.equal(player.fuel, fuel - 5 - 1);
  assert.match(game.messages.at(-1), /\(1 of 2\)/);

  const night = gameFromStrings(["@.."], 1, { night: true });
  addBrazier(night.level, 1, 0, false);
  const nightFuel = night.player.fuel;
  night.game.playerAction("right");
  assert.equal(night.player.fuel, nightFuel - 10 - 1, "Night braziers cost more");
  assert.deepEqual([player.x, player.y], [0, 0], "braziers block movement");
});

test("bats won't enter brazier light, rats will", () => {
  const { level, monsters } = levelFromStrings(["b.......@", ".........", "r........"]);
  const [bat, rat] = monsters;
  addBrazier(level, 3, 1, true);
  assert.equal(level.inStaticLight(2, 0), true);
  assert.equal(bat.canEnter(level, 2, 0), false);
  assert.equal(rat.canEnter(level, 2, 0), true);
  assert.equal(bat.canEnter(level, 8, 2), true, "outside the light is fine");
});

test("goblins carry their own light", () => {
  const { game, player, monsters } = gameFromStrings(["@.............g"]);
  player.torchLit = false;
  game.updateVisibility();
  assert.ok(game.lightAt(monsters[0].x - 1, 0) > 0);
  assert.equal(game.isVisible(monsters[0].x, 0), true, "you see the goblin by its own torch");
});
