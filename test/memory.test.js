import assert from "node:assert/strict";
import { test } from "node:test";
import { dailySeed, hashString, todayKey } from "../src/daily.js";
import { Game } from "../src/game.js";
import { gameFromStrings } from "./helpers/maps.js";

test("actions report effects for sound and animation", () => {
  const { game, monsters } = gameFromStrings(["@r.", "..."]);
  game.playerAction("right");
  assert.deepEqual(
    game.effects.map((e) => e.type),
    ["hit"],
  );
  assert.equal(game.effects[0].killed, true);
  assert.equal(game.effects[0].sneak, true);
  assert.equal(monsters[0].alive, false);
  game.playerAction("right");
  assert.deepEqual(game.effects.map((e) => e.type), ["step"]);
});

test("taking a hit and dying are effects too", () => {
  const { game, player, monsters } = gameFromStrings(["@g"], 1, { night: true });
  monsters[0].seenPlayer = true;
  player.hp = 2;
  game.playerAction("wait");
  assert.deepEqual(game.effects.map((e) => e.type), ["hit", "death"]);
  assert.equal(game.effects[0].by, "monster");
});

test("effects reset every action", () => {
  const { game } = gameFromStrings(["@.."]);
  game.playerAction("right");
  game.playerAction("quaff");
  assert.deepEqual(game.effects, []);
});

test("bones are left on the depth you died, holding your potions", () => {
  const { game, player } = gameFromStrings(["@."]);
  assert.equal(game.bonesRecord(), null, "no bones while alive");
  game.depth = 4;
  player.potions = 3;
  game.state = "dead";
  assert.deepEqual(game.bonesRecord(), { depth: 4, potions: 3 });
  player.potions = 0;
  assert.deepEqual(game.bonesRecord(), { depth: 4, potions: 1 }, "always at least one");
});

test("bones appear on their depth and can be picked up", () => {
  const game = new Game({ seed: 5, bones: { depth: 2, potions: 3 } });
  let found = null;
  game.level.items.forEach((x, y, item) => {
    if (item?.type === "bones") found = { x, y };
  });
  assert.equal(found, null, "not on depth 1");
  game.goDeeper();
  game.level.items.forEach((x, y, item) => {
    if (item?.type === "bones") found = { x, y, item };
  });
  assert.ok(found, "bones on depth 2");
  assert.equal(found.item.potions, 3);

  game.pickUp(found.item);
  assert.equal(game.player.potions, 3);
  assert.equal(game.bonesFound, true);
  assert.match(game.messages.at(-1), /bones of a past adventurer, and 3 potions/);
});

test("the daily seed is stable per day and differs between days", () => {
  assert.equal(dailySeed("2026-09-25"), dailySeed("2026-09-25"));
  assert.notEqual(dailySeed("2026-09-25"), dailySeed("2026-09-26"));
  assert.equal(todayKey(new Date("2026-09-25T23:59:00Z")), "2026-09-25");
  assert.equal(hashString(""), 0x811c9dc5);
});

test("a seeded game replays the same cave on every restart", () => {
  const game = new Game({ seed: dailySeed("2026-09-25") });
  const first = [...game.level.walls.cells].join("");
  const start = [game.player.x, game.player.y];
  for (let i = 0; i < 20; i++) game.playerAction(["left", "right", "up", "down"][i % 4]);
  game.state = "dead";
  game.playerAction("restart");
  assert.equal([...game.level.walls.cells].join(""), first);
  assert.deepEqual([game.player.x, game.player.y], start);

  const other = new Game({ seed: dailySeed("2026-09-25") });
  assert.equal([...other.level.walls.cells].join(""), first, "same for everyone");
});
