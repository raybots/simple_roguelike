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
  if (/ you for /.test(text) || /^You die/.test(text) || /on you for/.test(text) || /^You burn/.test(text)) return "hurt";
  if (/^You kill/.test(text)) return "kill";
  if (/^You hit/.test(text)) return "hit";
  if (/potion/.test(text) && !/no potions/.test(text)) return "potion";
  if (/unaware/.test(text)) return "kill";
  if (/notices you|raises its club/.test(text)) return "warn";
  if (/^You take the/.test(text)) return "relic";
  if (/chasm/.test(text)) return "depth";
  if (/Sun Stone/.test(text)) return "relic";
  if (/sighs|warm at last/.test(text)) return "relic";
  if (/warm your hands|rest by the fire|coax the brazier|crackles happily/.test(text)) return "fire";
  if (/too tired|wakes at the Hearth/.test(text)) return "depth";
  if (/burn|grass|alight|catches/.test(text)) return "fire";
  if (/snatches|flees|wade|water|fungus|[Cc]rystal/.test(text)) return "plain";
  if (/bones of a past/.test(text)) return "relic";
  if (/on the shelf at the Hearth|glints in the warm light/.test(text)) return "relic";
  if (/torch|oil|brazier|[Dd]arkness/.test(text)) return "fire";
  if (/descend|stairs down/.test(text)) return "depth";
  return "plain";
}

function relicsText(n) {
  return n === 0 ? "no relics at all" : `${n} ${n === 1 ? "relic" : "relics"}`;
}

// The torchbearer's name. The wick is the part of the torch that burns down.
export const HERO_NAME = "Wick";

// Returns an epitaph for the death or victory screen.
export function epitaph(game) {
  const turnsText = `${game.turn} ${game.turn === 1 ? "turn" : "turns"}`;
  if (game.state === "resting") {
    return {
      title: `${HERO_NAME} Dozes Off`,
      line: `Worn out on depth ${game.depth}. The embers will keep, and so will everything in your satchel.`,
    };
  }
  if (game.state === "won") {
    return {
      title: "The Sun Rises Below",
      line: `${HERO_NAME} carried the Sun Stone out of the deep after ${turnsText}, bearing ${relicsText(game.player.relics.length)}.`,
    };
  }
  const causes = { flames: "Burned alive", Lightless: "Devoured by the Lightless" };
  const cause = causes[game.killedBy] ?? (game.killedBy ? `Slain by a ${game.killedBy}` : "Slain");
  const turns = `${game.turn} ${game.turn === 1 ? "turn" : "turns"}`;
  return { title: `Here lies ${HERO_NAME}`, line: `${cause} on depth ${game.depth}, after ${turns}.` };
}
