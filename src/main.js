import { Game } from "./game.js";
import { createRng } from "./rng.js";
import { DomUI } from "./ui.js";

// ?seed=12345 reproduces a specific map.
const seedParam = new URLSearchParams(location.search).get("seed");
const seed = seedParam && /^\d+$/.test(seedParam) ? Number(seedParam) >>> 0 : undefined;
const rng = createRng(seed);
console.log(`seed: ${rng.seed}`);

const game = new Game({ rng });
const ui = new DomUI(game, document.getElementById("stage"));
ui.bindKeyboard();
ui.render();
