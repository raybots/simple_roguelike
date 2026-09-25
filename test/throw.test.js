import assert from "node:assert/strict";
import { test } from "node:test";
import { actionForKey } from "../src/input.js";
import { gameFromStrings } from "./helpers/maps.js";

function throwTorch(game, direction) {
  game.playerAction("throw");
  return game.playerAction(direction);
}

test("r starts aiming, and a direction throws the torch up to 6 tiles", () => {
  const { game, level, player } = gameFromStrings(["@.........."]);
  assert.equal(actionForKey({ key: "r" }), "throw");
  game.playerAction("throw");
  assert.equal(game.state, "aiming");
  assert.equal(game.turn, 0, "aiming is free");
  game.playerAction("right");
  assert.equal(game.state, "playing");
  assert.equal(player.hasTorch, false);
  assert.deepEqual(level.torch, { x: 6, y: 0 });
  assert.equal(game.turn, 1);
  assert.deepEqual(game.effects.find((e) => e.type === "throw").path.at(-1), { x: 6, y: 0 });
});

test("anything but a direction cancels aiming", () => {
  const { game, player } = gameFromStrings(["@...."]);
  game.playerAction("throw");
  game.playerAction("cancel");
  assert.equal(game.state, "playing");
  assert.equal(player.hasTorch, true);
  assert.equal(game.messages.at(-1), "You keep hold of your torch.");
});

test("the torch stops at walls and at the first creature, hurting it", () => {
  const wall = gameFromStrings(["@..#...."]);
  throwTorch(wall.game, "right");
  assert.deepEqual(wall.level.torch, { x: 2, y: 0 });

  const hit = gameFromStrings(["@..g..."]);
  throwTorch(hit.game, "right");
  assert.deepEqual(hit.level.torch, { x: 3, y: 0 });
  assert.equal(hit.monsters[0].hp, hit.monsters[0].maxHp - 2);
  assert.equal(hit.monsters[0].state, "hunting");
});

test("with the torch thrown, it lights where it lies and you stand in the dark", () => {
  const { game, player } = gameFromStrings(["@........."]);
  throwTorch(game, "right");
  assert.equal(game.isVisible(6, 0), true, "you can see the lit spot");
  assert.ok(game.lightAt(6, 0) > game.lightAt(0, 0));
  assert.equal(game.playerLit, false, "six tiles away, you're outside its light");
  assert.equal(player.carryingLight, false);
});

test("walking onto the torch picks it up", () => {
  const { game, player } = gameFromStrings(["@.."]);
  throwTorch(game, "right");
  game.playerAction("right");
  game.playerAction("right");
  assert.equal(player.hasTorch, true);
  assert.equal(game.level.torch, null);
});

test("idle monsters that see it land go to look", () => {
  const { game, monsters } = gameFromStrings(["@.......", "........", ".......r"]);
  game.player.torchLit = true;
  throwTorch(game, "right");
  assert.deepEqual(monsters[0].investigate, { x: 6, y: 0 });
  const before = Math.abs(monsters[0].x - 6) + Math.abs(monsters[0].y);
  game.playerAction("wait");
  assert.ok(Math.abs(monsters[0].x - 6) + Math.abs(monsters[0].y) < before);
});

test("goblins steal a loose torch, and drop it when killed", () => {
  const { game, level, monsters } = gameFromStrings(["@.....", "######", ".....g"]);
  const [goblin] = monsters;
  level.torch = { x: 4, y: 2 };
  game.player.hasTorch = false;
  goblin.investigate = { x: 4, y: 2 };
  game.playerAction("wait");
  assert.equal(level.torchThief, goblin);
  assert.equal(level.torch, null);
  assert.match(game.messages.join("\n"), /snatches up your torch/);
  assert.deepEqual(game.torchPosition, { x: goblin.x, y: goblin.y });
  level.strikeCreature(game.player, goblin, 99);
  assert.deepEqual(level.torch, { x: goblin.x, y: goblin.y });
  assert.equal(level.torchThief, null);
});

test("you can't descend, jump, douse or light things without the torch", () => {
  const { game, level, player } = gameFromStrings([">@.:..."]);
  level.stairs = { x: 0, y: 0 };
  level.features.set(3, 0, { type: "chasm" });
  throwTorch(game, "right");
  game.playerAction("left");
  game.playerAction("descend");
  assert.equal(game.depth, 1);
  assert.equal(game.messages.at(-1), "You won't go deeper without your torch.");
  game.playerAction("torch");
  assert.equal(game.messages.at(-1), "Your torch is out of reach.");
  assert.equal(player.torchLit, true);
});

test("a torch thrown into grass sets it alight, into water puts it out", () => {
  const grass = gameFromStrings(["@..."]);
  grass.level.terrain.set(3, 0, "grass");
  throwTorch(grass.game, "right");
  assert.ok(grass.level.isBurning(3, 0) || grass.level.terrainAt(3, 0) === "ash");

  const water = gameFromStrings(["@..."]);
  water.level.terrain.set(3, 0, "water");
  throwTorch(water.game, "right");
  assert.equal(water.player.torchLit, false);
});

test("a torch never lands in a chasm", () => {
  const { game, level } = gameFromStrings(["@....:"]);
  level.features.set(5, 0, { type: "chasm" });
  throwTorch(game, "right");
  assert.deepEqual(level.torch, { x: 4, y: 0 });
});

test("with no room to throw, nothing happens", () => {
  const { game, player } = gameFromStrings(["@#"]);
  throwTorch(game, "right");
  assert.equal(player.hasTorch, true);
  assert.equal(game.turn, 0);
});
