export const VIEWPORT = { width: 32, height: 32 };

const GLYPHS = {
  floor: ".",
  wall: "#",
  stairs: ">",
  potion: "!",
  corpse: "x",
  unknown: " ",
};

// Top-left map coordinate of a viewport centred on the player.
export function viewportOrigin(player, size = VIEWPORT) {
  return {
    x: player.x - Math.floor(size.width / 2),
    y: player.y - Math.floor(size.height / 2),
  };
}

// Returns the viewport as rows of { glyph, cls, kind? } cells.
// kind is the monster type for monsters and corpses.
// cls is one of: vis (in view), dim (remembered), dark (unknown), or an entity class.
// `isVisible(x, y)` decides what the player can currently see. It defaults to
// everything, which is handy for tests.
export function renderViewport(level, player, { size = VIEWPORT, isVisible = () => true } = {}) {
  const origin = viewportOrigin(player, size);
  const rows = [];

  for (let vy = 0; vy < size.height; vy++) {
    const row = [];
    for (let vx = 0; vx < size.width; vx++) {
      row.push(terrainCell(level, origin.x + vx, origin.y + vy, isVisible));
    }
    rows.push(row);
  }

  const draw = (x, y, glyph, cls, kind) => {
    const vx = x - origin.x;
    const vy = y - origin.y;
    if (vx >= 0 && vx < size.width && vy >= 0 && vy < size.height) rows[vy][vx] = kind ? { glyph, cls, kind } : { glyph, cls };
  };

  // Corpses are remembered like terrain. Living monsters only show while in view.
  for (const m of level.monsters) {
    if (m.alive) continue;
    if (isVisible(m.x, m.y)) draw(m.x, m.y, GLYPHS.corpse, "corpse", m.type);
    else if (level.explored.get(m.x, m.y)) draw(m.x, m.y, GLYPHS.corpse, "dim");
  }
  for (const m of level.monsters) {
    if (m.alive && isVisible(m.x, m.y)) draw(m.x, m.y, m.glyph, "mon", m.type);
  }
  draw(player.x, player.y, player.glyph, "player");

  return rows;
}

function terrainCell(level, x, y, isVisible) {
  if (!level.walls.contains(x, y)) return { glyph: GLYPHS.unknown, cls: "dark" };
  const visible = isVisible(x, y);
  if (!visible && !level.explored.get(x, y)) return { glyph: GLYPHS.unknown, cls: "dark" };

  if (level.isWall(x, y)) return { glyph: GLYPHS.wall, cls: visible ? "vis" : "dim" };
  if (level.isStairs(x, y)) return { glyph: GLYPHS.stairs, cls: visible ? "stairs" : "dim" };
  if (level.itemAt(x, y)) return { glyph: GLYPHS.potion, cls: visible ? "item" : "dim" };
  return { glyph: GLYPHS.floor, cls: visible ? "vis" : "dim" };
}

export function rowsToText(rows) {
  return rows.map((row) => row.map((cell) => cell.glyph).join(""));
}

export function renderStatus(game) {
  const { player } = game;
  return `HP ${Math.max(0, player.hp)}/${player.maxHp}   Potions ${player.potions}   Depth ${game.depth}   Turn ${game.turn}`;
}

export function recentMessages(game, count = 5) {
  return game.messages.slice(-count);
}
