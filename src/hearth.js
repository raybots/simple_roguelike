// The Hearth: Wick's camp at the cave mouth, and the things you can add to it with embers.
// Everything here is for warmth, not power.

export const DECOR = {
  rug: { name: "Woven rug", cost: 10, blurb: "Something soft to sit on." },
  kettle: { name: "Copper kettle", cost: 15, blurb: "It whistles when the water's ready." },
  fungus: { name: "Window box of glowcaps", cost: 20, blurb: "A little light that grows." },
  lanterns: { name: "Hanging lanterns", cost: 25, blurb: "Two more lights against the dark." },
  books: { name: "Bookshelf", cost: 30, blurb: "Somewhere to keep your journal." },
  chimes: { name: "Wind chimes", cost: 35, blurb: "They sing when the rain comes in." },
  chair: { name: "Armchair", cost: 45, blurb: "The best seat by the fire." },
};

export const DECOR_IDS = Object.keys(DECOR);

// Embers earned for the kind things you do below.
export const EMBERS = { brazier: 3, warmed: 10, depth: 5 };

export function canBuy(meta, id) {
  return !meta.decor.includes(id) && meta.embers >= DECOR[id].cost;
}

export function buy(meta, id) {
  if (!canBuy(meta, id)) return false;
  meta.embers -= DECOR[id].cost;
  meta.decor.push(id);
  return true;
}

// The camp as rows of [glyph, class] pairs, with whatever decorations you own.
export function hearthScene(decor = [], { cat = false } = {}) {
  const has = (id) => decor.includes(id);
  const W = 30;
  const rows = [];
  const blank = () => Array.from({ length: W }, () => [" ", ""]);
  const put = (row, x, text, cls) => {
    [...text].forEach((ch, i) => {
      if (x + i >= 0 && x + i < W) row[x + i] = [ch, cls];
    });
  };

  // Rain falling past the cave mouth.
  const rain = blank();
  for (let x = 0; x < W; x += 3) put(rain, x + ((x * 7) % 2), "╎", "rain");
  rows.push(rain);

  const roof = blank();
  put(roof, 0, "▁".repeat(W), "rock");
  rows.push(roof);

  const top = blank();
  put(top, 0, "█", "rock");
  put(top, W - 1, "█", "rock");
  if (has("lanterns")) {
    put(top, 7, "✧", "lantern");
    put(top, 22, "✧", "lantern");
  }
  if (has("chimes")) put(top, 15, "⁂", "chimes");
  rows.push(top);

  const shelf = blank();
  put(shelf, 0, "█", "rock");
  put(shelf, W - 1, "█", "rock");
  if (has("books")) put(shelf, 3, "▤▥▤", "books");
  if (has("fungus")) put(shelf, 24, "♣♣", "glowcap");
  rows.push(shelf);

  const smoke = blank();
  put(smoke, 0, "█", "rock");
  put(smoke, W - 1, "█", "rock");
  put(smoke, 14, "°", "smoke");
  rows.push(smoke);

  const flames = blank();
  put(flames, 0, "█", "rock");
  put(flames, W - 1, "█", "rock");
  put(flames, 13, "^^^", "flame");
  rows.push(flames);

  const hearth = blank();
  put(hearth, 0, "█", "rock");
  put(hearth, W - 1, "█", "rock");
  put(hearth, 12, "(≡≡≡)", "stones");
  if (has("kettle")) put(hearth, 19, "♨", "kettle");
  if (has("chair")) put(hearth, 4, "╓╖", "chair");
  rows.push(hearth);

  const floor = blank();
  put(floor, 0, "█", "rock");
  put(floor, W - 1, "█", "rock");
  if (has("rug")) put(floor, 9, "░▒▓▒▓▒▓▒▒░", "rug");
  put(floor, 16, "@", "wick");
  if (cat) put(floor, 18, "c", "cat");
  rows.push(floor);

  const ground = blank();
  put(ground, 0, "▀".repeat(W), "rock");
  rows.push(ground);

  return rows;
}
