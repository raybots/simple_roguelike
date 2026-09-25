import { FLOOR, smooth } from "./cavegen.js";
import { Grid } from "./grid.js";

// Each level after the first rolls a biome that decides its terrain.
//   fill   - chance per floor tile of seeding each terrain before smoothing into patches
//   torch  - bonus torch radius (crystal walls reflect light)
export const BIOMES = {
  caves: { name: "caves", terrain: { grass: 0.12 }, arrival: null },
  overgrown: { name: "overgrown", terrain: { grass: 0.5 }, arrival: "Dry grass chokes this cave. Mind your torch." },
  flooded: { name: "flooded", terrain: { water: 0.45, grass: 0.1 }, arrival: "Black water pools across the floor." },
  fungal: {
    name: "fungal",
    terrain: { fungus: 0.3, grass: 0.12 },
    arrival: "Pale fungus glows in the dark here.",
  },
  crystal: { name: "crystal", terrain: {}, torch: 3, arrival: "Crystal walls throw your torchlight far." },
};

const WEIGHTS = { caves: 4, overgrown: 2, flooded: 2, fungal: 2, crystal: 2 };

export function pickBiome(rng, depth) {
  if (depth <= 1) return "caves";
  const names = Object.keys(WEIGHTS);
  const total = names.reduce((s, n) => s + WEIGHTS[n], 0);
  let roll = rng.random() * total;
  for (const n of names) {
    roll -= WEIGHTS[n];
    if (roll < 0) return n;
  }
  return "caves";
}

// Scatters terrain over floor tiles in natural-looking patches: random seeds, then the
// same smoothing that carves the caves. `keepClear` tiles stay bare floor.
export function paintTerrain(walls, biome, rng, keepClear = () => false) {
  const terrain = new Grid(walls.width, walls.height, null);
  for (const [type, fill] of Object.entries(BIOMES[biome].terrain)) {
    let mask = new Grid(walls.width, walls.height, 0);
    walls.forEach((x, y, v) => {
      if (v === FLOOR && rng.chance(fill)) mask.set(x, y, 1);
    });
    for (let i = 0; i < 3; i++) mask = smooth(mask, 5);
    // Fungus is sparse: keep it as scattered clumps rather than smoothed fields.
    if (type === "fungus") {
      mask = new Grid(walls.width, walls.height, 0);
      walls.forEach((x, y, v) => {
        if (v === FLOOR && rng.chance(fill / 8)) mask.set(x, y, 1);
      });
    }
    mask.forEach((x, y, v) => {
      if (v === 1 && walls.get(x, y) === FLOOR && terrain.get(x, y) === null && !keepClear(x, y)) {
        terrain.set(x, y, type);
      }
    });
  }
  return terrain;
}
