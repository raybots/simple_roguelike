// Light falloff shared by the engine and the renderer.

// Intensity of a light of the given radius at offset (dx, dy), from 0.18 to 1.
// Bright at the source, falling off smoothly to a faint glow at the edge.
export function lightLevel(dx, dy, radius) {
  const t = Math.min(1, Math.hypot(dx, dy) / (radius + 1));
  return Math.round((0.18 + 0.82 * (1 - t) ** 1.6) * 100) / 100;
}
