// Pure presentation helpers for the torchlit theme. No DOM access, so they're testable.

import { FOV_RADIUS } from "./game.js";

// How the map's ASCII glyphs are drawn on screen.
const DISPLAY_GLYPHS = { ".": "·" };

export function displayGlyph(glyph) {
  return DISPLAY_GLYPHS[glyph] ?? glyph;
}

// Torchlight intensity for a cell at (dx, dy) from the player, from 0 to 1.
// Bright near the player, falling off smoothly to a faint glow at the edge of sight.
export function lightLevel(dx, dy, radius = FOV_RADIUS) {
  const t = Math.min(1, Math.hypot(dx, dy) / (radius + 1));
  return Math.round((0.18 + 0.82 * (1 - t) ** 1.6) * 100) / 100;
}

// The CSS class for a rendered map cell.
export function cellClass(cell) {
  if (cell.cls === "vis") return cell.glyph === "#" ? "wall" : "floor";
  if (cell.cls === "dim") return "memory";
  if (cell.kind) return `${cell.cls} k-${cell.kind}`;
  return cell.cls;
}

// Colour-codes log messages by what happened.
export function messageTone(text) {
  if (/ you for /.test(text) || /^You die/.test(text)) return "hurt";
  if (/^You kill/.test(text)) return "kill";
  if (/^You hit/.test(text)) return "hit";
  if (/potion/.test(text) && !/no potions/.test(text)) return "potion";
  if (/descend|stairs down/.test(text)) return "depth";
  return "plain";
}

// Returns an epitaph for the death screen.
export function epitaph(game) {
  const cause = game.killedBy ? `Slain by a ${game.killedBy}` : "Slain";
  const turns = `${game.turn} ${game.turn === 1 ? "turn" : "turns"}`;
  return { title: "Here lies Ray", line: `${cause} on depth ${game.depth}, after ${turns}.` };
}
