// Pure presentation helpers for the torchlit theme. No DOM access, so they're testable.

import { lightLevel as falloff } from "./light.js";

// How the map's ASCII glyphs are drawn on screen.
const DISPLAY_GLYPHS = { ".": "·" };

export function displayGlyph(glyph) {
  return DISPLAY_GLYPHS[glyph] ?? glyph;
}

// Torchlight intensity for a cell at (dx, dy) from the player, from 0 to 1.
// Bright near the player, falling off smoothly to a faint glow at the edge of sight.
export function lightLevel(dx, dy, radius = 8) {
  return falloff(dx, dy, radius);
}

// The CSS class for a rendered map cell.
export function cellClass(cell) {
  const danger = cell.danger ? " danger" : "";
  if (cell.cls === "vis") return (cell.glyph === "#" ? "wall" : "floor") + danger;
  if (cell.cls === "dim") return "memory" + danger;
  if (cell.kind) return `${cell.cls} k-${cell.kind}${danger}`;
  return cell.cls + danger;
}

// Small marker drawn over a monster to show what it knows: z asleep, ? alert, ! hunting.
export const STATE_MARKERS = { asleep: "z", alert: "?", hunting: "!" };

// Colour-codes log messages by what happened.
export function messageTone(text) {
  if (/ you for /.test(text) || /^You die/.test(text) || /on you for/.test(text)) return "hurt";
  if (/^You kill/.test(text)) return "kill";
  if (/^You hit/.test(text)) return "hit";
  if (/potion/.test(text) && !/no potions/.test(text)) return "potion";
  if (/unaware/.test(text)) return "kill";
  if (/notices you|raises its club/.test(text)) return "warn";
  if (/^You take the/.test(text)) return "relic";
  if (/chasm/.test(text)) return "depth";
  if (/torch|oil|brazier|[Dd]arkness/.test(text)) return "fire";
  if (/descend|stairs down/.test(text)) return "depth";
  return "plain";
}

// Returns an epitaph for the death screen.
export function epitaph(game) {
  const cause = game.killedBy ? `Slain by a ${game.killedBy}` : "Slain";
  const turns = `${game.turn} ${game.turn === 1 ? "turn" : "turns"}`;
  return { title: "Here lies Ray", line: `${cause} on depth ${game.depth}, after ${turns}.` };
}
