import { Grid } from "./grid.js";
import { bfsDistances } from "./pathfinding.js";

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

function addBorder(grid) {
  grid.forEach((x, y) => {
    if (x === 0 || y === 0 || x === grid.width - 1 || y === grid.height - 1) grid.set(x, y, WALL);
  });
}

// Random fill followed by smoothing passes gives cave-like walls.
// openTop / openBottom rows are left unfilled. borderWalls closes the map edge.
export function generateCave(width, height, rng, options = {}) {
  const {
    wallChance = 0.45,
    smoothPasses = 5,
    wallThreshold = 5,
    openTop = 0,
    openBottom = 0,
    borderWalls = true,
  } = options;

  let grid = new Grid(width, height, FLOOR);
  for (let y = openTop; y < height - openBottom; y++) {
    for (let x = 0; x < width; x++) {
      if (rng.chance(wallChance)) grid.set(x, y, WALL);
    }
  }
  if (borderWalls) addBorder(grid);
  for (let i = 0; i < smoothPasses; i++) {
    grid = smooth(grid, wallThreshold);
    if (borderWalls) addBorder(grid);
  }
  return grid;
}

// Fills every floor region except the largest with wall, so the whole cave is
// connected. Returns the floor cells that remain.
export function keepLargestRegion(grid) {
  const isFloor = (x, y) => grid.get(x, y) === FLOOR;
  const seen = new Grid(grid.width, grid.height, false);
  let largest = [];

  grid.forEach((x, y, value) => {
    if (value !== FLOOR || seen.get(x, y)) return;
    const distances = bfsDistances(grid.width, grid.height, isFloor, { x, y });
    const region = [];
    distances.forEach((rx, ry, d) => {
      if (d < 0) return;
      seen.set(rx, ry, true);
      region.push({ x: rx, y: ry });
    });
    if (region.length > largest.length) largest = region;
  });

  const keep = new Set(largest.map(({ x, y }) => grid.index(x, y)));
  grid.forEach((x, y, value) => {
    if (value === FLOOR && !keep.has(grid.index(x, y))) grid.set(x, y, WALL);
  });
  return largest;
}
