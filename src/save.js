// Saving and restoring a game in progress, as plain JSON.
// A restored game continues exactly as the original would have, random numbers included.

import { Game } from "./game.js";
import { Grid } from "./grid.js";
import { Level } from "./level.js";
import { Monster } from "./monster.js";
import { Player } from "./player.js";
import { createRng } from "./rng.js";

export const SAVE_VERSION = 1;

const LEVEL_GRIDS = ["walls", "terrain", "fire", "features", "items", "explored"];
const LEVEL_FIELDS = ["width", "height", "depth", "biome", "stairs", "torch", "warmed", "petted"];
const GAME_FIELDS = [
  "width",
  "height",
  "night",
  "seed",
  "started",
  "bones",
  "bonesFound",
  "depth",
  "turn",
  "state",
  "messages",
  "messageCount",
  "killedBy",
  "draft",
  "smothered",
  "waded",
  "faints",
  "deepest",
  "discovered",
  "startsWithCat",
];

const gridToJSON = (grid) => ({ width: grid.width, height: grid.height, cells: grid.cells });

function gridFromJSON(data) {
  const grid = new Grid(data.width, data.height);
  grid.cells = data.cells;
  return grid;
}

// Only a creature's own data is saved; methods come back from its class.
const plain = (object) => JSON.parse(JSON.stringify(object));

export function serializeGame(game) {
  const { level } = game;
  const out = { version: SAVE_VERSION, rng: { seed: game.rng.seed, state: game.rng.state } };
  for (const f of GAME_FIELDS) out[f] = game[f];
  out.player = plain(game.player);
  out.level = { monsters: level.monsters.map(plain), torchThief: level.monsters.indexOf(level.torchThief) };
  for (const f of LEVEL_FIELDS) out.level[f] = level[f];
  for (const g of LEVEL_GRIDS) out.level[g] = gridToJSON(level[g]);
  return out;
}

export function restoreGame(data) {
  if (!data || data.version !== SAVE_VERSION) return null;
  const game = Object.create(Game.prototype);
  for (const f of GAME_FIELDS) game[f] = data[f];
  game.rng = createRng(data.rng.seed, data.rng.state);
  game.effects = [];
  game.slowed = false;
  game.player = Object.assign(new Player(), data.player);

  const level = Object.create(Level.prototype);
  for (const f of LEVEL_FIELDS) level[f] = data.level[f] ?? null;
  for (const g of LEVEL_GRIDS) level[g] = gridFromJSON(data.level[g]);
  level.warmed = !!data.level.warmed;
  level.monsters = data.level.monsters.map((m) => Object.assign(new Monster(), m));
  level.torchThief = level.monsters[data.level.torchThief] ?? null;
  level.creatures = new Grid(level.width, level.height, null);
  for (const m of level.monsters) if (m.alive) level.creatures.set(m.x, m.y, m);
  level.creatures.set(game.player.x, game.player.y, game.player);
  level.updateStaticLight();
  game.level = level;

  game.updateVisibility();
  return game;
}
