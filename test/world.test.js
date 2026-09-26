import assert from "node:assert/strict";
import { test } from "node:test";
import { BIOMES, paintTerrain, pickBiome } from "../src/biomes.js";
import { Game } from "../src/game.js";
import { FINAL_DEPTH, generateLevel } from "../src/levelgen.js";
import { createRng } from "../src/rng.js";
import { epitaph } from "../src/theme.js";
import { gameFromStrings, levelFromStrings } from "./helpers/maps.js";

function grass(level, cells) {
  for (const [x, y] of cells) level.terrain.set(x, y, "grass");
}
const always = { ...createRng(1), chance: () => true };
const never = { ...createRng(1), chance: () => false };

test("fire spreads through grass, burns down to ash and gives light", () => {
  const { level } = levelFromStrings(["......"]);
  grass(level, [[0, 0], [1, 0], [2, 0]]);
  assert.equal(level.ignite(0, 0), true);
  assert.equal(level.ignite(3, 0), false, "bare floor won't burn");
  level.updateFire(always);
  assert.ok(level.isBurning(1, 0), "spread to the neighbour");
  for (let i = 0; i < 10; i++) level.updateFire(always);
  assert.equal(level.terrainAt(0, 0), "ash");
  assert.equal(level.terrainAt(2, 0), "ash");
  assert.equal(level.burningTiles().length, 0);
});

test("standing in fire hurts, and monsters won't walk into it", () => {
  const { level, player, monsters } = levelFromStrings(["@.r"]);
  grass(level, [[0, 0], [1, 0]]);
  level.ignite(0, 0);
  level.ignite(1, 0);
  const burns = level.updateFire(never);
  assert.equal(burns[0].target, player);
  assert.equal(player.hp, player.maxHp - 2);
  assert.equal(monsters[0].canEnter(level, 1, 0), false);
});

test("pressing f sets adjacent grass alight for fuel", () => {
  const { game, level, player } = gameFromStrings(["@.."]);
  const fuel = player.fuel;
  game.playerAction("ignite");
  assert.equal(game.messages.at(-1), "Nothing next to you will burn.");
  grass(level, [[1, 0]]);
  game.playerAction("ignite");
  assert.ok(level.isBurning(1, 0) || level.terrainAt(1, 0) === "ash");
  assert.equal(player.fuel, fuel - 5 - 1);
});

test("fire kills monsters and, at Night, can kill you", () => {
  const { game, level, player, monsters } = gameFromStrings(["@r"], 1, { night: true });
  grass(level, [[1, 0], [0, 0]]);
  level.ignite(1, 0);
  level.ignite(0, 0);
  player.hp = 2;
  game.playerAction("wait");
  assert.equal(monsters[0].alive, false);
  assert.equal(game.state, "dead");
  assert.equal(epitaph(game).line.startsWith("Burned alive"), true);
});

test("wading is slow: monsters move twice", () => {
  const { game, level, monsters } = gameFromStrings(["r.......@."]);
  monsters[0].seenPlayer = true;
  level.terrain.set(9, 0, "water");
  game.rng = never;
  game.playerAction("right");
  assert.equal(monsters[0].x, 2);
  assert.match(game.messages.join("\n"), /wade/);
});

test("water can put your torch out", () => {
  const { game, level, player } = gameFromStrings(["@~"]);
  level.terrain.set(1, 0, "water");
  game.rng = always;
  game.playerAction("right");
  assert.equal(player.torchLit, false);
});

test("fungus glows and crystal caves widen your torch", () => {
  const { game, level, player } = gameFromStrings(["@" + ".".repeat(14)]);
  player.torchLit = false;
  level.terrain.set(12, 0, "fungus");
  game.updateVisibility();
  assert.ok(game.lightAt(11, 0) > 0);
  assert.equal(game.isVisible(11, 0), true);

  player.torchLit = true;
  level.biome = "crystal";
  assert.equal(game.torchRadius, player.torchRadius + 3);
});

test("rats flee from ogres", () => {
  const { level, player, monsters } = levelFromStrings(["......", "..rO..", "......", ".....@"]);
  const [rat] = monsters;
  const before = Math.hypot(rat.x - 3, rat.y - 1);
  const result = rat.takeTurn(level, player, null);
  assert.equal(result.fled, true);
  assert.ok(Math.hypot(rat.x - 3, rat.y - 1) > before);
});

test("goblins go for items, carry them, and drop them when killed", () => {
  const { level, player, monsters } = levelFromStrings(["g.!....", "#######", "......@"]);
  const [goblin] = monsters;
  goblin.takeTurn(level, player, null, { playerLit: false });
  goblin.takeTurn(level, player, null, { playerLit: false });
  assert.equal(level.itemAt(2, 0), null);
  assert.equal(goblin.loot.length, 1);
  goblin.hp = 1;
  level.strikeCreature(player, goblin, 5);
  assert.deepEqual(level.itemAt(goblin.x, goblin.y), { type: "potion" });
});

test("biomes: depth 1 is plain caves, deeper levels vary", () => {
  assert.equal(pickBiome(createRng(1), 1), "caves");
  const seen = new Set();
  const rng = createRng(2);
  for (let i = 0; i < 200; i++) seen.add(pickBiome(rng, 5));
  assert.deepEqual([...seen].sort(), Object.keys(BIOMES).sort());
});

test("terrain only lands on floor and never on kept-clear tiles", () => {
  const bp = generateLevel({ width: 60, height: 60, depth: 3, rng: createRng(8) });
  const t = paintTerrain(bp.walls, "overgrown", createRng(3), (x, y) => x === bp.playerStart.x && y === bp.playerStart.y);
  let count = 0;
  t.forEach((x, y, v) => {
    if (!v) return;
    count++;
    assert.equal(bp.walls.get(x, y), 0);
  });
  assert.ok(count > 100, `overgrown caves are grassy (${count})`);
  assert.equal(t.get(bp.playerStart.x, bp.playerStart.y), null);
});

test("the final level has the Sun Stone and its guardian instead of stairs", () => {
  const bp = generateLevel({ width: 60, height: 60, depth: FINAL_DEPTH, rng: createRng(4) });
  assert.equal(bp.stairs, null);
  const sun = bp.items.find((i) => i.type === "sun");
  assert.ok(sun);
  const boss = bp.monsters.find((m) => m.type === "lightless");
  assert.ok(boss);
  assert.ok(Math.abs(boss.x - sun.x) + Math.abs(boss.y - sun.y) <= 3);
  assert.equal(bp.features.filter((f) => f.type === "chasm").length, 0);
});

test("the Lightless smothers lights near it and snuffs braziers", () => {
  const { game, level, player } = gameFromStrings(["@....&" + ".".repeat(10)]);
  game.updateVisibility();
  assert.equal(game.torchRadius, 1);
  level.features.set(9, 0, { type: "brazier", lit: true });
  level.updateStaticLight();
  game.playerAction("wait");
  assert.equal(level.featureAt(9, 0).lit, false);
  assert.match(game.messages.join("\n"), /drinking the light/);
  player.hp = player.maxHp;
});

test("the Sun Stone shines even inside the Lightless's reach", () => {
  const { game, level, player } = gameFromStrings(["@" + ".".repeat(10) + "&."]);
  player.torchLit = false;
  level.items.set(12, 0, { type: "sun" });
  game.updateVisibility();
  assert.ok(game.lightAt(10, 0) > 0.3);
  assert.equal(game.isVisible(11, 0), true, "the guardian is silhouetted against it");
});

test("taking the Sun Stone wins the game; Enter starts again", () => {
  const { game, level } = gameFromStrings(["@☼"]);
  level.items.set(1, 0, { type: "sun" });
  game.playerAction("right");
  assert.equal(game.state, "won");
  assert.equal(epitaph(game).title, "The Sun Rises Below");
  assert.equal(game.playerAction("left"), false);
  game.playerAction("restart");
  assert.equal(game.state, "playing");
  assert.equal(game.depth, 1);
});

test("a full game can be reached down to the final depth", () => {
  const game = new Game({ rng: createRng(12) });
  while (game.depth < FINAL_DEPTH) {
    game.goDeeper();
    if (game.state === "draft") game.playerAction("choose1");
  }
  assert.ok(game.lightEater, "the guardian is waiting");
  assert.match(game.messages.join("\n"), /Sun Stone waits/);
});
