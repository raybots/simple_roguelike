export const VIEWPORT = { width: 40, height: 40 };

const FLOOR_GLYPH = " ";
const WALL_GLYPH = "#";
const OUT_OF_BOUNDS_GLYPH = "+";
const CORPSE_GLYPH = "x";

// Top-left map coordinate of a viewport centred on the player.
export function viewportOrigin(player, size = VIEWPORT) {
  return {
    x: player.x - Math.floor(size.width / 2),
    y: player.y - Math.floor(size.height / 2),
  };
}

// Returns the visible part of the map as an array of strings, one per row.
export function renderViewport(level, player, size = VIEWPORT) {
  const origin = viewportOrigin(player, size);
  const rows = [];

  for (let y = 0; y < size.height; y++) {
    const row = [];
    for (let x = 0; x < size.width; x++) {
      const tile = level.walls.get(origin.x + x, origin.y + y);
      row.push(tile === null ? OUT_OF_BOUNDS_GLYPH : tile === 0 ? FLOOR_GLYPH : WALL_GLYPH);
    }
    rows.push(row);
  }

  const draw = (mapX, mapY, glyph) => {
    const x = mapX - origin.x;
    const y = mapY - origin.y;
    if (x >= 0 && x < size.width && y >= 0 && y < size.height) rows[y][x] = glyph;
  };

  // Corpses first so a living monster standing on one is drawn on top.
  for (const m of level.monsters) if (!m.alive) draw(m.x, m.y, CORPSE_GLYPH);
  for (const m of level.monsters) if (m.alive) draw(m.x, m.y, m.glyph);
  draw(player.x, player.y, player.glyph);

  return rows.map((row) => row.join(""));
}
