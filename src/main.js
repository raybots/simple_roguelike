import { createAudio } from "./audio.js";
import { dailySeed, todayKey } from "./daily.js";
import { Game } from "./game.js";
import { createRng } from "./rng.js";
import { restoreGame } from "./save.js";
import { loadBones, loadSave } from "./storage.js";
import { DomUI } from "./ui.js";

// ?seed=12345 reproduces a specific map. ?daily or #daily plays today's cave, the same
// for everyone. ?night or #night plays by the old, unforgiving rules. The # forms work
// where query strings don't reach the page.
const params = new URLSearchParams(location.search);
const seedParam = params.get("seed");
const hash = location.hash.slice(1);
const daily = params.has("daily") || hash === "daily";
const night = params.has("night") || hash === "night";

let options;
if (daily) {
  options = { seed: dailySeed(), mode: `daily-${todayKey()}` };
} else if (seedParam && /^\d+$/.test(seedParam)) {
  options = { rng: createRng(Number(seedParam) >>> 0), mode: "seeded" };
} else {
  options = { rng: createRng(), mode: night ? "night" : "random" };
}
options.night = night;
console.log(`seed: ${options.seed ?? options.rng.seed}`);

// Seeded games are for reproducing a map, so they always start fresh.
const saved = options.mode === "seeded" ? null : restoreGame(loadSave(options.mode));

// Exported so the game can be inspected from the browser console:
//   const { game } = await import("./src/main.js")
// Bones only turn up at Night, where death is real.
export const game =
  saved && saved.night === night
    ? saved
    : new Game({ ...options, bones: options.mode === "night" ? loadBones() : null });
const ui = new DomUI(game, document.getElementById("stage"), { audio: createAudio(), mode: options.mode, daily });
ui.bindKeyboard();
ui.render();
