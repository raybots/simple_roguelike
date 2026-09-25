import { FLOOR, generateCave } from "./cavegen.js";

// Builds a description of a level: walls, where the player starts, and monster spawns.
export function generateLevel({ width, height, rng }) {
  const walls = generateCave(width, height, rng);
  const playerStart = { x: 0, y: 0 };

  const monsters = [];
  for (let y = Math.floor(height / 2); y < height - 8; y++) {
    for (let x = 0; x < width; x++) {
      if (rng.chance(0.01) && walls.get(x, y) === FLOOR) monsters.push({ x, y, type: "rat" });
    }
  }
  return { walls, playerStart, monsters };
}
