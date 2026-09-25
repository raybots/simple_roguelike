import { CARDINALS } from "./geometry.js";

// Breadth-first search on a 4-connected grid. Returns the path from start to goal
// as [{x, y}, ...] including both ends, or null when the goal is unreachable.
// The goal is always accepted even if isPassable(goal) is false, so a monster can
// path to the tile the player is standing on.
export function findPath(width, height, isPassable, start, goal) {
  if (start.x === goal.x && start.y === goal.y) return [{ x: start.x, y: start.y }];

  const inBounds = (x, y) => x >= 0 && x < width && y >= 0 && y < height;
  if (!inBounds(start.x, start.y) || !inBounds(goal.x, goal.y)) return null;

  const startIndex = start.y * width + start.x;
  const goalIndex = goal.y * width + goal.x;
  const previous = new Int32Array(width * height).fill(-1);
  const visited = new Uint8Array(width * height);
  const queue = [startIndex];
  visited[startIndex] = 1;

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head];
    const cx = current % width;
    const cy = (current - cx) / width;

    for (const [dx, dy] of CARDINALS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny)) continue;
      const next = ny * width + nx;
      if (visited[next]) continue;
      if (next !== goalIndex && !isPassable(nx, ny)) continue;

      visited[next] = 1;
      previous[next] = current;
      if (next === goalIndex) return rebuildPath(previous, goalIndex, width);
      queue.push(next);
    }
  }
  return null;
}

function rebuildPath(previous, goalIndex, width) {
  const path = [];
  for (let i = goalIndex; i !== -1; i = previous[i]) {
    path.push({ x: i % width, y: Math.floor(i / width) });
  }
  return path.reverse();
}
