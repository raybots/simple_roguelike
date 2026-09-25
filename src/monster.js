import { Creature } from "./creature.js";
import { CARDINALS, distance } from "./geometry.js";
import { findPath } from "./pathfinding.js";
import { hasLineOfSight } from "./visibility.js";

// Awareness states, from least to most dangerous:
//   asleep   - only wakes if you come close in the light, or make noise
//   idle     - awake, not yet aware of you
//   alert    - has just noticed you and takes one turn to react (shown as '?')
//   hunting  - chasing you (shown as '!')
export const STATES = ["asleep", "idle", "alert", "hunting"];

// In the dark you can only be noticed from this close.
export const DARK_NOTICE_RANGE = 2;
// Sleepers wake reliably within this distance if you're lit.
const WAKE_RANGE = 3;
const ALERT_PATIENCE = 4;

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
    torch = 0,
    fearsLight = false,
    stride = 1,
    telegraph = false,
    fears = null,
    collects = false,
    eatsLight = 0,
    state = "idle",
  } = {}) {
    super({ x, y, glyph, name, hp, damage });
    this.type = type;
    this.verb = verb;
    this.range = range;
    this.speed = speed;
    this.erratic = erratic;
    this.remembers = remembers;
    this.torch = torch;
    this.fearsLight = fearsLight;
    this.stride = stride;
    this.telegraph = telegraph;
    this.strideCount = 0;
    this.fears = fears;
    this.collects = collects;
    this.eatsLight = eatsLight;
    this.loot = [];
    // A spot an idle monster wanders over to look at, like a torch landing nearby.
    this.investigate = null;
    // Tiles this monster will smash on its next turn, or null.
    this.windup = null;
    this.state = state;
    this.alertTurns = 0;
    this.energy = 0;
  }

  // Kept for convenience: a monster that has "seen the player" is hunting.
  get seenPlayer() {
    return this.state === "hunting";
  }

  set seenPlayer(value) {
    this.state = value ? "hunting" : "idle";
  }

  get unaware() {
    return this.state !== "hunting";
  }

  hasLineOfSightTo(level, target) {
    return hasLineOfSight((x, y) => level.isWall(x, y), this.x, this.y, target.x, target.y);
  }

  // Whether the monster can see the player at all.
  canSee(level, target) {
    return distance(this.x, this.y, target.x, target.y) <= this.range && this.hasLineOfSightTo(level, target);
  }

  // Whether an unaware monster notices the player. Being lit makes you visible from afar.
  notices(level, player, playerLit, darkRange = DARK_NOTICE_RANGE) {
    const d = distance(this.x, this.y, player.x, player.y);
    const reach = playerLit ? this.range : darkRange;
    return d <= reach && this.hasLineOfSightTo(level, player);
  }

  canEnter(level, x, y) {
    if (!level.isPassable(x, y) || level.isBurning(x, y)) return false;
    return !(this.fearsLight && level.inStaticLight(x, y));
  }

  // The nearest living monster of the type this one fears, if it's close and in sight.
  threat(level) {
    if (!this.fears) return null;
    return level.monsters.find(
      (m) => m.alive && m.type === this.fears && distance(m.x, m.y, this.x, this.y) <= 4 && this.hasLineOfSightTo(level, m),
    );
  }

  // Steps to whichever neighbouring tile is furthest from the threat.
  flee(level, threat) {
    let best = null;
    let bestDistance = distance(this.x, this.y, threat.x, threat.y);
    for (const [dx, dy] of CARDINALS) {
      const x = this.x + dx;
      const y = this.y + dy;
      const d = distance(x, y, threat.x, threat.y);
      if (d > bestDistance && this.canEnter(level, x, y)) {
        best = { x, y };
        bestDistance = d;
      }
    }
    return best ? { ...level.moveCreature(this, best.x, best.y), fled: true } : null;
  }

  // The nearest item in sight within 6 tiles, for thieves.
  wantedItem(level) {
    let best = null;
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        const x = this.x + dx;
        const y = this.y + dy;
        const item = level.itemAt(x, y);
        if (!item || item.type === "sun") continue;
        const d = Math.abs(dx) + Math.abs(dy);
        if ((!best || d < best.d) && this.hasLineOfSightTo(level, { x, y })) best = { x, y, d };
      }
    }
    return best;
  }

  // Returns the level's move result, or null if the monster did nothing.
  // ctx.playerLit says whether the player is standing in any light.
  takeTurn(level, player, rng, ctx = {}) {
    if (!this.alive) return null;
    const playerLit = ctx.playerLit ?? true;
    const darkRange = ctx.darkNotice ?? DARK_NOTICE_RANGE;
    const notices = () => this.notices(level, player, playerLit, darkRange);

    // Slow monsters build up energy and only act once they have a full point.
    this.energy += this.speed;
    if (this.energy < 1) return null;
    this.energy -= 1;

    if (this.state === "asleep") {
      const close = distance(this.x, this.y, player.x, player.y) <= WAKE_RANGE;
      if (notices() && (close || rng?.chance(0.1))) this.state = "alert";
      return null;
    }

    const threat = this.threat(level);
    if (threat) return this.flee(level, threat);

    if (this.erratic && rng && rng.chance(this.erratic)) return this.wander(level, player, rng);

    if (this.state === "idle") {
      if (notices()) {
        this.state = "alert";
        this.alertTurns = 0;
        return null;
      }
      if (this.collects) {
        const item = this.wantedItem(level);
        if (item) return this.stepToward(level, item, true);
      }
      if (this.investigate) {
        const { x, y } = this.investigate;
        if (this.x === x && this.y === y) {
          this.investigate = null;
          return null;
        }
        const result = this.stepToward(level, this.investigate, true);
        if (!result) this.investigate = null;
        return result;
      }
      return null;
    }

    if (this.state === "alert") {
      if (!notices()) {
        if (++this.alertTurns >= ALERT_PATIENCE) this.state = "idle";
        return null;
      }
      this.state = "hunting";
    }

    // Hunting.
    if (this.windup) return this.smash(level);
    if (!this.canSee(level, player) && !this.remembers) {
      this.state = "idle";
      return null;
    }
    if (this.telegraph && Math.abs(player.x - this.x) + Math.abs(player.y - this.y) === 1) {
      return this.windUp(level, player);
    }
    if (this.stride > 1 && this.strideCount++ % this.stride !== 0) return null;
    return this.stepToward(level, player);
  }

  // Marks the player's tile and the two tiles either side of it, across the line of attack.
  // Stepping straight back is the only way out.
  windUp(level, player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const side = [dy, dx];
    this.windup = [
      { x: player.x, y: player.y },
      { x: player.x + side[0], y: player.y + side[1] },
      { x: player.x - side[0], y: player.y - side[1] },
    ].filter(({ x, y }) => !level.isWall(x, y));
    return { windup: true };
  }

  // Brings the blow down on every marked tile. Anything standing there gets hurt,
  // other monsters included.
  smash(level) {
    const hits = [];
    for (const { x, y } of this.windup) {
      const target = level.creatureAt(x, y);
      if (!target || target === this || !target.alive) continue;
      hits.push({ target, ...level.strikeCreature(this, target, this.damage * 2) });
    }
    this.windup = null;
    return { smash: true, hits };
  }

  // One step along the shortest path. Unless `onto` is set, the goal tile itself is
  // entered by attacking whatever stands there.
  stepToward(level, target, onto = false) {
    const path = findPath(
      level.width,
      level.height,
      (x, y) => this.canEnter(level, x, y),
      { x: this.x, y: this.y },
      { x: target.x, y: target.y },
    );
    if (!path || path.length < 2) return null;
    const next = path[1];
    if (onto && !this.canEnter(level, next.x, next.y)) return null;
    return level.moveCreature(this, next.x, next.y);
  }

  // A random step. Stumbling into the player still counts as an attack.
  wander(level, player, rng) {
    const options = CARDINALS.map(([dx, dy]) => ({ x: this.x + dx, y: this.y + dy })).filter(
      ({ x, y }) => this.canEnter(level, x, y) || level.creatureAt(x, y) === player,
    );
    if (options.length === 0) return null;
    const step = rng.pick(options);
    return level.moveCreature(this, step.x, step.y);
  }
}
