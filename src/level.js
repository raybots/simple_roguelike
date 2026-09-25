import { createMonster } from "./bestiary.js";
import { FLOOR } from "./cavegen.js";
import { Grid } from "./grid.js";

const NO_MOVE = Object.freeze({ moved: false, target: null, damage: 0, killed: false, item: null });

export class Level {
  constructor({ walls, monsters = [], items = [], stairs = null, depth = 1 }) {
    this.walls = walls;
    this.width = walls.width;
    this.height = walls.height;
    this.depth = depth;
    this.stairs = stairs;
    this.creatures = new Grid(this.width, this.height, null);
    this.items = new Grid(this.width, this.height, null);
    this.explored = new Grid(this.width, this.height, false);
    // Dead monsters stay in this list so they can be drawn as corpses.
    this.monsters = [];
    for (const spec of monsters) this.addMonster(createMonster(spec.type, spec.x, spec.y, depth));
    for (const item of items) this.items.set(item.x, item.y, { type: item.type });
  }

  // Out-of-bounds counts as wall.
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

  isPassable(x, y) {
    return !this.isWall(x, y) && !this.creatureAt(x, y);
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
  moveCreature(creature, x, y) {
    if (this.isWall(x, y)) return NO_MOVE;

    const other = this.creatureAt(x, y);
    if (other && other !== creature) {
      const { damage, killed } = creature.attack(other);
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

  // Every living monster takes a turn. Returns what each one did.
  processMonsters(player, rng) {
    const events = [];
    for (const monster of this.monsters) {
      if (!monster.alive || !player.alive) continue;
      const result = monster.takeTurn(this, player, rng);
      if (result) events.push({ actor: monster, ...result });
    }
    return events;
  }

  markExplored(indices) {
    for (const i of indices) this.explored.cells[i] = true;
  }
}
