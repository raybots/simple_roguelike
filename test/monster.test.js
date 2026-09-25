import assert from "node:assert/strict";
import { test } from "node:test";
import { createRng } from "../src/rng.js";
import { levelFromStrings } from "./helpers/maps.js";

// An rng stub whose chance() always returns the given answer.
const fixedRng = (answer) => ({ ...createRng(1), chance: () => answer });

test("a monster with line of sight steps toward the player", () => {
  const { level, player, monsters } = levelFromStrings(["r.....@"]);
  monsters[0].takeTurn(level, player);
  assert.equal(monsters[0].state, "alert", "first it notices");
  assert.deepEqual([monsters[0].x, monsters[0].y], [0, 0]);
  monsters[0].takeTurn(level, player);
  assert.deepEqual([monsters[0].x, monsters[0].y], [1, 0]);
  assert.equal(monsters[0].seenPlayer, true);
});

test("a monster that has never seen the player stays put", () => {
  const { level, player, monsters } = levelFromStrings(["r.#...", "..#..@", "......"]);
  assert.equal(monsters[0].takeTurn(level, player), null);
  assert.deepEqual([monsters[0].x, monsters[0].y], [0, 0]);
});

test("once it has seen the player it chases without line of sight", () => {
  const { level, player, monsters } = levelFromStrings(["r.#...", "..#..@", "......"]);
  monsters[0].seenPlayer = true;
  monsters[0].takeTurn(level, player);
  assert.notDeepEqual([monsters[0].x, monsters[0].y], [0, 0]);
});

test("a monster next to the player attacks", () => {
  const { level, player, monsters } = levelFromStrings(["r@"]);
  monsters[0].seenPlayer = true;
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
  assert.equal(rear.takeTurn(level, player), null, "rear rat has no free path and waits");
  assert.equal(front.hp, front.maxHp, "rear rat did not attack the front rat");
});

test("a monster out of range that has not seen the player ignores them", () => {
  const { level, player, monsters } = levelFromStrings(["r" + ".".repeat(25) + "@"]);
  assert.equal(monsters[0].takeTurn(level, player), null);
  assert.equal(monsters[0].seenPlayer, false);
});

test("an ogre acts every other turn", () => {
  const { level, player, monsters } = levelFromStrings(["O.....@"]);
  const ogre = monsters[0];
  ogre.seenPlayer = true;
  const xs = [];
  for (let i = 0; i < 4; i++) {
    ogre.takeTurn(level, player);
    xs.push(ogre.x);
  }
  assert.deepEqual(xs, [0, 1, 1, 2]);
});

test("an erratic bat sometimes takes a random step instead of chasing", () => {
  const { level, player, monsters } = levelFromStrings(["#####", "#.b.#", "#...#", "#..@#"]);
  const bat = monsters[0];
  bat.takeTurn(level, player, fixedRng(true));
  assert.equal(Math.abs(bat.x - 2) + Math.abs(bat.y - 1), 1, "moved exactly one tile");
  assert.equal(level.isWall(bat.x, bat.y), false);
});

test("a bat forgets the player once out of sight, a rat does not", () => {
  const rows = ["b.#...", "r.#..@", "......"];
  const { level, player, monsters } = levelFromStrings(rows);
  const [bat, rat] = monsters;
  bat.seenPlayer = true;
  rat.seenPlayer = true;
  assert.equal(bat.takeTurn(level, player, fixedRng(false)), null);
  assert.notEqual(rat.takeTurn(level, player, fixedRng(false)), null);
});
