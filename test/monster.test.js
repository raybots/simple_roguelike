import assert from "node:assert/strict";
import { test } from "node:test";
import { levelFromStrings } from "./helpers/maps.js";

test("a monster with line of sight steps toward the player", () => {
  const { level, player, monsters } = levelFromStrings(["r.....@"]);
  monsters[0].takeTurn(level, player);
  assert.deepEqual([monsters[0].x, monsters[0].y], [1, 0]);
  assert.equal(monsters[0].seenPlayer, true);
});

test("a monster that has never seen the player stays put", () => {
  const { level, player, monsters } = levelFromStrings([
    "r.#...",
    "..#..@",
    "......",
  ]);
  assert.equal(monsters[0].takeTurn(level, player), null);
  assert.deepEqual([monsters[0].x, monsters[0].y], [0, 0]);
});

test("once it has seen the player it chases without line of sight", () => {
  const { level, player, monsters } = levelFromStrings([
    "r.#...",
    "..#..@",
    "......",
  ]);
  monsters[0].seenPlayer = true;
  monsters[0].takeTurn(level, player);
  assert.notDeepEqual([monsters[0].x, monsters[0].y], [0, 0]);
});

test("a monster next to the player attacks", () => {
  const { level, player, monsters } = levelFromStrings(["r@"]);
  const result = monsters[0].takeTurn(level, player);
  assert.equal(result.target, player);
  assert.equal(player.hp, player.maxHp - 1);
  assert.deepEqual([monsters[0].x, monsters[0].y], [0, 0]);
});

test("living monsters block each other's paths", () => {
  // Regression: the old code checked `isAlive` without calling it, so rats pathed
  // through each other and ended up biting each other.
  const { level, player, monsters } = levelFromStrings(["#####", "rr..@", "#####"]);
  const [rear, front] = monsters;
  rear.seenPlayer = true;
  const result = rear.takeTurn(level, player);
  assert.equal(result, null, "rear rat has no free path and waits");
  assert.equal(front.hp, front.maxHp, "rear rat did not attack the front rat");
});

test("a monster out of range that has not seen the player ignores them", () => {
  const { level, player, monsters } = levelFromStrings(["r" + ".".repeat(25) + "@"]);
  assert.equal(monsters[0].takeTurn(level, player), null);
  assert.equal(monsters[0].seenPlayer, false);
});
