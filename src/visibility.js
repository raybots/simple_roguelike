import { line } from "./geometry.js";

// True when no opaque cell lies strictly between the two endpoints.
export function hasLineOfSight(isOpaque, x0, y0, x1, y1) {
  const points = line(x0, y0, x1, y1);
  for (let i = 1; i < points.length - 1; i++) {
    if (isOpaque(points[i].x, points[i].y)) return false;
  }
  return true;
}

// Field of view by casting a Bresenham ray to every cell within the radius.
// A ray stops at the first opaque cell, which is itself visible.
// Returns a Set of cell indices (y * width + x).
export function computeFov(width, height, isOpaque, ox, oy, radius) {
  const visible = new Set([oy * width + ox]);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > radius * radius) continue;
      const points = line(ox, oy, ox + dx, oy + dy);
      for (let i = 1; i < points.length; i++) {
        const { x, y } = points[i];
        if (x < 0 || x >= width || y < 0 || y >= height) break;
        visible.add(y * width + x);
        if (isOpaque(x, y)) break;
      }
    }
  }
  return visible;
}
