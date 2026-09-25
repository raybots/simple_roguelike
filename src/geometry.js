// Up, right, down, left. Movement and pathfinding are 4-connected.
export const CARDINALS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export function distance(x0, y0, x1, y1) {
  return Math.hypot(x1 - x0, y1 - y0);
}

// Bresenham line from (x0, y0) to (x1, y1), both endpoints included.
export function line(x0, y0, x1, y1) {
  const points = [];
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;

  for (;;) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}
