import { Game } from "../../src/game.js";
import { Grid } from "../../src/grid.js";
import { Level } from "../../src/level.js";
import { Player } from "../../src/player.js";
import { createRng } from "../../src/rng.js";

const MONSTER_LETTERS = { r: "rat", b: "bat", g: "goblin", O: "ogre", "&": "lightless" };

// Builds a Level from ASCII rows:
//   '#' wall, '.' floor, '@' player, '>' stairs, '!' potion,
//   'r' rat, 'b' bat, 'g' goblin, 'O' ogre.
// Any other character is floor and its position is recorded in `marks`.
export function levelFromStrings(rows, { depth = 1 } = {}) {
  const height = rows.length;
  const width = rows[0].length;
  const walls = new Grid(width, height, 0);
  const monsters = [];
  const items = [];
  const marks = {};
  let stairs = null;
  let playerPos = null;

  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "#") walls.set(x, y, 1);
      else if (ch === "@") playerPos = { x, y };
      else if (ch === ">") stairs = { x, y };
      else if (ch === "!") items.push({ x, y, type: "potion" });
      else if (MONSTER_LETTERS[ch]) monsters.push({ x, y, type: MONSTER_LETTERS[ch] });
      else if (ch !== ".") marks[ch] = { x, y };
    });
  });

  const level = new Level({ walls, monsters, items, stairs, depth });
  let player = null;
  if (playerPos) {
    player = new Player();
    level.placeCreature(player, playerPos.x, playerPos.y);
  }
  return { level, player, monsters: level.monsters, marks };
}

// A Game whose current level is the given ASCII map.
export function gameFromStrings(rows, seed = 1) {
  const game = new Game({ rng: createRng(seed) });
  const { level, player, monsters, marks } = levelFromStrings(rows);
  game.level = level;
  game.player = player;
  game.messages = [];
  game.updateVisibility();
  return { game, level, player, monsters, marks };
}

// Adds braziers to a fixture level: 'Ω' marks unlit, pass lit positions separately.
export function addBrazier(level, x, y, lit = false) {
  level.features.set(x, y, { type: "brazier", lit });
  level.updateStaticLight();
}
