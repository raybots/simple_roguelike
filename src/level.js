import { createMonster } from "./bestiary.js";
import { FLOOR } from "./cavegen.js";
import { Grid } from "./grid.js";
import { computeFov } from "./visibility.js";

export const BRAZIER_RADIUS = 4;

const NO_MOVE = Object.freeze({ moved: false, target: null, damage: 0, killed: false, item: null });

export class Level {
  constructor({ walls, monsters = [], items = [], features = [], stairs = null, depth = 1 }) {
    this.walls = walls;
    this.width = walls.width;
    this.height = walls.height;
    this.depth = depth;
    this.stairs = stairs;
    this.creatures = new Grid(this.width, this.height, null);
    this.items = new Grid(this.width, this.height, null);
    this.features = new Grid(this.width, this.height, null);
    this.explored = new Grid(this.width, this.height, false);
    // Dead monsters stay in this list so they can be drawn as corpses.
    this.monsters = [];
    for (const f of features) this.features.set(f.x, f.y, { type: f.type, lit: !!f.lit });
    for (const spec of monsters) {
      this.addMonster(createMonster(spec.type, spec.x, spec.y, depth, spec.state ?? "idle"));
    }
    for (const item of items) this.items.set(item.x, item.y, { type: item.type });
    this.updateStaticLight();
  }

  // Out-of-bounds counts as wall. Walls are the only thing that blocks sight.
  isWall(x, y) {
    return this.walls.get(x, y) !== FLOOR;
  }

  isStairs(x, y) {
    return this.stairs !== null && this.stairs.x === x && this.stairs.y === y;
  }

  creatureAt(x, y) {
    return this.creatures.get(x, y);
  }

  itemAt(x, y) {
    return this.items.get(x, y);
  }

  featureAt(x, y) {
    return this.features.get(x, y);
  }

  // Features such as braziers block movement but not sight.
  isBlocked(x, y) {
    return this.isWall(x, y) || this.featureAt(x, y) !== null;
  }

  isPassable(x, y) {
    return !this.isBlocked(x, y) && !this.creatureAt(x, y);
  }

  // Lit braziers. Their light doesn't move, so it's computed once per change.
  braziers() {
    const list = [];
    this.features.forEach((x, y, f) => {
      if (f?.type === "brazier") list.push({ x, y, lit: f.lit });
    });
    return list;
  }

  updateStaticLight() {
    this.staticLight = new Set();
    for (const b of this.braziers()) {
      if (!b.lit) continue;
      const fov = computeFov(this.width, this.height, (x, y) => this.isWall(x, y), b.x, b.y, BRAZIER_RADIUS);
      for (const i of fov) this.staticLight.add(i);
    }
  }

  inStaticLight(x, y) {
    return this.staticLight.has(y * this.width + x);
  }

  lightBrazier(x, y) {
    const f = this.featureAt(x, y);
    if (f?.type !== "brazier" || f.lit) return false;
    f.lit = true;
    this.updateStaticLight();
    return true;
  }

  // Puts a creature on an empty floor tile. Returns false if the tile is taken.
  placeCreature(creature, x, y) {
    if (!this.isPassable(x, y)) return false;
    this.removeCreature(creature);
    creature.moveTo(x, y);
    this.creatures.set(x, y, creature);
    return true;
  }

  addMonster(monster) {
    if (!this.placeCreature(monster, monster.x, monster.y)) return false;
    this.monsters.push(monster);
    return true;
  }

  removeCreature(creature) {
    if (this.creatures.get(creature.x, creature.y) === creature) {
      this.creatures.set(creature.x, creature.y, null);
    }
  }

  // Moves a creature one tile. Walking into another creature attacks it instead.
  // When the player steps onto an item it is picked up and returned as `item`.
  // `multiplier` scales the damage of an attack (used for sneak attacks).
  moveCreature(creature, x, y, { multiplier = 1 } = {}) {
    if (this.isBlocked(x, y)) return NO_MOVE;

    const other = this.creatureAt(x, y);
    if (other && other !== creature) {
      const { damage, killed } = creature.attack(other, multiplier);
      // Corpses don't block movement. The player stays on the map so the UI can show them.
      if (killed && !other.isPlayer) this.removeCreature(other);
      return { ...NO_MOVE, target: other, damage, killed };
    }

    this.removeCreature(creature);
    creature.moveTo(x, y);
    this.creatures.set(x, y, creature);

    let item = null;
    if (creature.isPlayer && this.itemAt(x, y)) {
      item = this.itemAt(x, y);
      this.items.set(x, y, null);
    }
    return { ...NO_MOVE, moved: true, item };
  }

  // Direct damage outside a normal bump attack. Removes monsters that die.
  strikeCreature(attacker, target, amount) {
    const { damage, killed } = attacker.strike(target, amount);
    if (killed && !target.isPlayer) this.removeCreature(target);
    return { damage, killed };
  }

  // Tiles about to be smashed by winding-up monsters.
  dangerTiles() {
    const tiles = new Set();
    for (const m of this.monsters) {
      if (m.alive && m.windup) for (const { x, y } of m.windup) tiles.add(y * this.width + x);
    }
    return tiles;
  }

  isChasm(x, y) {
    return this.featureAt(x, y)?.type === "chasm";
  }

  // Every living monster takes a turn. Returns what each one did.
  processMonsters(player, rng, ctx = {}) {
    const events = [];
    for (const monster of this.monsters) {
      if (!monster.alive || !player.alive) continue;
      const before = monster.state;
      const result = monster.takeTurn(this, player, rng, ctx);
      if (result) events.push({ actor: monster, ...result });
      else if (before !== "alert" && monster.state === "alert") events.push({ actor: monster, noticed: true });
    }
    return events;
  }

  markExplored(indices) {
    for (const i of indices) this.explored.cells[i] = true;
  }
}
