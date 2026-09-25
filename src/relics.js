// Relics are picked one at a time from a draft of three each time you go deeper.
// Each one bends a rule; together they make every run's build different.

export const RELICS = {
  vampiric: { name: "Vampiric Fang", glyph: "♥", text: "Every kill heals you 1 HP." },
  ember: { name: "Ember Soul", glyph: "✹", text: "Your torch never shrinks below radius 5." },
  echolocation: { name: "Echolocation", glyph: "◎", text: "Sense monsters within 6 tiles, even through walls." },
  whetstone: { name: "Whetstone", glyph: "⚔", text: "+1 damage.", stackable: true },
  ironskin: { name: "Iron Skin", glyph: "◆", text: "Blows against you do 1 less damage (never below 1)." },
  pockets: { name: "Deep Pockets", glyph: "✚", text: "Potions heal 6 more." },
  bandolier: { name: "Oil Bandolier", glyph: "¤", text: "+50% torch capacity, and a full refill now." },
  shadowstep: { name: "Shadowstep", glyph: "☾", text: "Sneak attacks do 5x damage instead of 3x." },
  heartwood: { name: "Heartwood", glyph: "♣", text: "+10 max HP, and heal 10 now.", stackable: true },
  hush: { name: "Assassin's Hush", glyph: "∿", text: "In the dark, monsters only notice you when adjacent." },
  lantern: { name: "Lantern of the Lost", glyph: "Ω", text: "Lighting a brazier heals you 5 HP." },
  cartographer: { name: "Cartographer's Eye", glyph: "⌖", text: "The stairs of each new level are revealed." },
};

export const RELIC_IDS = Object.keys(RELICS);

export const MAX_STACK = 2;

// Relics you can still be offered. Stackable ones can be taken twice.
export function availableRelics(owned) {
  const count = (id) => owned.filter((o) => o === id).length;
  return RELIC_IDS.filter((id) => count(id) < (RELICS[id].stackable ? MAX_STACK : 1));
}

// Three distinct relics, drawn at random.
export function draftRelics(rng, owned, count = 3) {
  const pool = availableRelics(owned);
  const picks = [];
  while (picks.length < count && pool.length > 0) {
    picks.push(pool.splice(rng.int(0, pool.length), 1)[0]);
  }
  return picks;
}

// One-off effects applied the moment a relic is taken.
export function applyRelic(id, player) {
  if (id === "whetstone") player.damage += 1;
  if (id === "ironskin") player.armor += 1;
  if (id === "pockets") player.potionBonus += 6;
  if (id === "ember") player.minTorchRadius = 5;
  if (id === "heartwood") {
    player.maxHp += 10;
    player.heal(10);
  }
  if (id === "bandolier") {
    player.maxFuel = Math.round(player.maxFuel * 1.5);
    player.fuel = player.maxFuel;
  }
}
