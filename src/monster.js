import { Creature } from "./creature.js";
import { CARDINALS, distance } from "./geometry.js";
import { findPath } from "./pathfinding.js";
import { hasLineOfSight } from "./visibility.js";

export class Monster extends Creature {
  constructor({
    x = 0,
    y = 0,
    type = "rat",
    glyph = "r",
    name = "rat",
    hp = 2,
    damage = 1,
    verb = "bites",
    range = 20,
    speed = 1,
    erratic = 0,
    remembers = true,
  } = {}) {
    super({ x, y, glyph, name, hp, damage });
    this.type = type;
    this.verb = verb;
    this.range = range;
    this.speed = speed;
    this.erratic = erratic;
    this.remembers = remembers;
    this.seenPlayer = false;
    this.energy = 0;
  }

  // Checks line of sight to the target. Once seen, the monster remembers the player.
  canSee(level, target) {
    const visible = hasLineOfSight((x, y) => level.isWall(x, y), this.x, this.y, target.x, target.y);
    if (visible) this.seenPlayer = true;
    return visible;
  }

  // Returns the level's move result, or null if the monster did nothing.
  takeTurn(level, player, rng) {
    if (!this.alive) return null;

    // Slow monsters build up energy and only act once they have a full point.
    this.energy += this.speed;
    if (this.energy < 1) return null;
    this.energy -= 1;

    if (this.erratic && rng && rng.chance(this.erratic)) return this.wander(level, player, rng);

    const inRange = distance(this.x, this.y, player.x, player.y) <= this.range;
    const remembered = this.remembers && this.seenPlayer;
    if (!inRange && !remembered) return null;
    const sees = this.canSee(level, player);
    if (!sees && !remembered) return null;

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

  // A random step. Stumbling into the player still counts as an attack.
  wander(level, player, rng) {
    const options = CARDINALS.map(([dx, dy]) => ({ x: this.x + dx, y: this.y + dy })).filter(
      ({ x, y }) => level.isPassable(x, y) || level.creatureAt(x, y) === player,
    );
    if (options.length === 0) return null;
    const step = rng.pick(options);
    return level.moveCreature(this, step.x, step.y);
  }
}
