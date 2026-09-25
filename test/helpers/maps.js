import { Grid } from "../../src/grid.js";
import { Level } from "../../src/level.js";
import { Player } from "../../src/player.js";

// Builds a Level from ASCII rows: '#' wall, '.' floor, '@' player, 'r' rat.
// Any other letter is floor and its position is recorded in `marks`.
export function levelFromStrings(rows) {
  const height = rows.length;
  const width = rows[0].length;
  const walls = new Grid(width, height, 0);
  const monsters = [];
  const marks = {};
  let playerPos = null;

  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === "#") walls.set(x, y, 1);
      else if (ch === "@") playerPos = { x, y };
      else if (ch === "r") monsters.push({ x, y, type: "rat" });
      else if (ch !== ".") marks[ch] = { x, y };
    });
  });

  const level = new Level({ walls, monsters });
  let player = null;
  if (playerPos) {
    player = new Player();
    level.placeCreature(player, playerPos.x, playerPos.y);
  }
  return { level, player, monsters: level.monsters, marks };
}
