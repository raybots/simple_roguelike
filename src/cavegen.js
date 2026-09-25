import { Grid } from "./grid.js";

export const WALL = 1;
export const FLOOR = 0;

// Counts walls in the 3x3 block centred on (x, y), including the cell itself.
// Out-of-bounds cells do not count as walls.
export function countWallNeighbors(grid, x, y) {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (grid.get(x + dx, y + dy) === WALL) count++;
    }
  }
  return count;
}

// One cellular-automata pass: a cell becomes wall when enough of its block is wall.
export function smooth(grid, threshold = 5) {
  const next = new Grid(grid.width, grid.height, FLOOR);
  grid.forEach((x, y) => {
    next.set(x, y, countWallNeighbors(grid, x, y) >= threshold ? WALL : FLOOR);
  });
  return next;
}

// Random fill followed by smoothing passes gives cave-like walls.
// openTop / openBottom rows are left unfilled.
export function generateCave(width, height, rng, options = {}) {
  const { wallChance = 0.45, smoothPasses = 5, wallThreshold = 5, openTop = 5, openBottom = 8 } = options;

  let grid = new Grid(width, height, FLOOR);
  for (let y = openTop; y < height - openBottom; y++) {
    for (let x = 0; x < width; x++) {
      if (rng.chance(wallChance)) grid.set(x, y, WALL);
    }
  }
  for (let i = 0; i < smoothPasses; i++) grid = smooth(grid, wallThreshold);
  return grid;
}
