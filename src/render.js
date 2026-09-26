export const VIEWPORT = { width: 32, height: 32 };

const GLYPHS = {
  floor: ".",
  wall: "#",
  stairs: ">",
  corpse: "x",
  unknown: " ",
  brazier: "Ω",
  chasm: ":",
  torch: "/",
  fire: "^",
};

export const ITEM_GLYPHS = {
  potion: "!",
  oil: "¤",
  bones: "†",
  sun: "☼",
  keepsake: "✦",
  crust: "%",
  coin: "$",
  mushroom: "♠",
};
export const TERRAIN_GLYPHS = { grass: '"', water: "~", fungus: "♣", ash: "," };

// Top-left map coordinate of a viewport centred on the player.
export function viewportOrigin(player, size = VIEWPORT) {
  return {
    x: player.x - Math.floor(size.width / 2),
    y: player.y - Math.floor(size.height / 2),
  };
}

// Returns the viewport as rows of { glyph, cls, kind?, state? } cells.
// cls is one of: vis (in view), dim (remembered), dark (unknown), glow (light seen
// from out of sight), or an entity class. kind is the monster type or item type.
// `isVisible(x, y)` decides what the player can currently see; `lightAt(x, y)` how lit
// a tile is. Both default to "everything, fully lit", which is handy for tests.
export function renderViewport(
  level,
  player,
  { size = VIEWPORT, isVisible = () => true, lightAt = () => 1, isSensed = () => false, isDanger = () => false } = {},
) {
  const origin = viewportOrigin(player, size);
  const rows = [];

  for (let vy = 0; vy < size.height; vy++) {
    const row = [];
    for (let vx = 0; vx < size.width; vx++) {
      row.push(terrainCell(level, origin.x + vx, origin.y + vy, isVisible, lightAt));
    }
    rows.push(row);
  }

  const draw = (x, y, cell) => {
    const vx = x - origin.x;
    const vy = y - origin.y;
    if (vx >= 0 && vx < size.width && vy >= 0 && vy < size.height) rows[vy][vx] = cell;
  };

  // Corpses are remembered like terrain. Living monsters only show while in view.
  for (const m of level.monsters) {
    if (m.alive) continue;
    if (isVisible(m.x, m.y)) draw(m.x, m.y, { glyph: GLYPHS.corpse, cls: "corpse", kind: m.type });
    else if (level.explored.get(m.x, m.y)) draw(m.x, m.y, { glyph: GLYPHS.corpse, cls: "dim", kind: m.type });
  }
  for (const m of level.monsters) {
    if (!m.alive) continue;
    const state = m.curled ? "asleep" : m.warning > 0 ? "hunting" : m.state;
    if (isVisible(m.x, m.y)) draw(m.x, m.y, { glyph: m.glyph, cls: "mon", kind: m.type, state });
    else if (isSensed(m)) draw(m.x, m.y, { glyph: m.glyph, cls: "sensed", kind: m.type });
  }
  draw(player.x, player.y, { glyph: player.glyph, cls: "player" });

  // Tiles about to be smashed are flagged so the UI can warn about them.
  for (let vy = 0; vy < size.height; vy++) {
    for (let vx = 0; vx < size.width; vx++) {
      if (isDanger(origin.x + vx, origin.y + vy)) rows[vy][vx] = { ...rows[vy][vx], danger: true };
    }
  }

  return rows;
}

function terrainGlyph(level, x, y) {
  if (level.isWall(x, y)) return { glyph: GLYPHS.wall, cls: "vis" };
  const feature = level.featureAt(x, y);
  if (feature?.type === "brazier") return { glyph: GLYPHS.brazier, cls: feature.lit ? "brazier-lit" : "brazier" };
  if (feature?.type === "chasm") return { glyph: GLYPHS.chasm, cls: "chasm" };
  if (level.isStairs(x, y)) return { glyph: GLYPHS.stairs, cls: "stairs" };
  if (level.isTorchAt(x, y)) return { glyph: GLYPHS.torch, cls: "torch-item" };
  const item = level.itemAt(x, y);
  if (item) return { glyph: ITEM_GLYPHS[item.type] ?? "?", cls: "item", kind: item.type };
  if (level.isBurning(x, y)) return { glyph: GLYPHS.fire, cls: "fire" };
  const ground = level.terrainAt(x, y);
  if (ground) return { glyph: TERRAIN_GLYPHS[ground], cls: "terrain", kind: ground };
  return { glyph: GLYPHS.floor, cls: "vis" };
}

function terrainCell(level, x, y, isVisible, lightAt) {
  if (!level.walls.contains(x, y)) return { glyph: GLYPHS.unknown, cls: "dark" };
  if (isVisible(x, y)) return terrainGlyph(level, x, y);

  const explored = level.explored.get(x, y);
  // Light you can't see directly still shows as a glow, like torchlight around a corner.
  if (lightAt(x, y) > 0) return { glyph: explored ? terrainGlyph(level, x, y).glyph : GLYPHS.unknown, cls: "glow" };
  if (!explored) return { glyph: GLYPHS.unknown, cls: "dark" };
  return { glyph: terrainGlyph(level, x, y).glyph, cls: "dim" };
}

export function rowsToText(rows) {
  return rows.map((row) => row.map((cell) => cell.glyph).join(""));
}

export function renderStatus(game) {
  const { player } = game;
  return `HP ${Math.max(0, player.hp)}/${player.maxHp}   Torch ${player.fuel}   Potions ${player.potions}   Depth ${game.depth}   Turn ${game.turn}`;
}

export function recentMessages(game, count = 5) {
  return game.messages.slice(-count);
}
