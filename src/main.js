import { createAudio } from "./audio.js";
import { dailySeed, todayKey } from "./daily.js";
import { Game } from "./game.js";
import { createRng } from "./rng.js";
import { loadBones } from "./storage.js";
import { DomUI } from "./ui.js";

// ?seed=12345 reproduces a specific map. ?daily or #daily plays today's cave, the same
// for everyone. The #daily form works where query strings don't reach the page.
const params = new URLSearchParams(location.search);
const seedParam = params.get("seed");
const daily = params.has("daily") || location.hash === "#daily";

let options;
if (daily) {
  options = { seed: dailySeed(), mode: `daily-${todayKey()}` };
} else if (seedParam && /^\d+$/.test(seedParam)) {
  options = { rng: createRng(Number(seedParam) >>> 0), mode: "seeded" };
} else {
  options = { rng: createRng(), mode: "random" };
}
console.log(`seed: ${options.seed ?? options.rng.seed}`);

// Exported so the game can be inspected from the browser console:
//   const { game } = await import("./src/main.js")
// Bones only turn up in random runs, so the daily cave is the same for everyone.
export const game = new Game({ ...options, bones: options.mode === "random" ? loadBones() : null });
const ui = new DomUI(game, document.getElementById("stage"), { audio: createAudio(), mode: options.mode, daily });
ui.bindKeyboard();
ui.render();
