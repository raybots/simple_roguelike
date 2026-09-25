import { Creature } from "./creature.js";
import { distance } from "./geometry.js";
import { findPath } from "./pathfinding.js";
import { hasLineOfSight } from "./visibility.js";

export class Monster extends Creature {
  constructor({ x = 0, y = 0, glyph = "r", name = "rat", hp = 2, damage = 1, range = 20 } = {}) {
    super({ x, y, glyph, name, hp, damage });
    this.range = range;
    this.seenPlayer = false;
  }

  // Checks line of sight to the target. Once seen, the monster remembers the player.
  canSee(level, target) {
    const visible = hasLineOfSight((x, y) => level.isWall(x, y), this.x, this.y, target.x, target.y);
    if (visible) this.seenPlayer = true;
    return visible;
  }

  // Chases the player one step along the shortest path once it has spotted them.
  // Returns the level's move result, or null if the monster did nothing.
  takeTurn(level, player) {
    if (!this.alive) return null;

    const inRange = distance(this.x, this.y, player.x, player.y) <= this.range;
    if (!inRange && !this.seenPlayer) return null;
    const sees = this.canSee(level, player);
    if (!sees && !this.seenPlayer) return null;

    const path = findPath(
      level.width,
      level.height,
      (x, y) => level.isPassable(x, y),
      { x: this.x, y: this.y },
      { x: player.x, y: player.y },
    );
    if (!path || path.length < 2) return null;
    return level.moveCreature(this, path[1].x, path[1].y);
  }
}
