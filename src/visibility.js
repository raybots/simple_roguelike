import { line } from "./geometry.js";

// True when no opaque cell lies strictly between the two endpoints.
export function hasLineOfSight(isOpaque, x0, y0, x1, y1) {
  const points = line(x0, y0, x1, y1);
  for (let i = 1; i < points.length - 1; i++) {
    if (isOpaque(points[i].x, points[i].y)) return false;
  }
  return true;
}
