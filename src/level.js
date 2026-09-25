import { FLOOR } from "./cavegen.js";
import { Grid } from "./grid.js";
import { Monster } from "./monster.js";

export class Level {
  constructor({ walls, monsters = [] }) {
    this.walls = walls;
    this.width = walls.width;
    this.height = walls.height;
    this.creatures = new Grid(this.width, this.height, null);
    // Dead monsters stay in this list so they can be drawn as corpses.
    this.monsters = [];
    for (const spec of monsters) this.addMonster(new Monster({ x: spec.x, y: spec.y }));
  }

  // Out-of-bounds counts as wall.
  isWall(x, y) {
    return this.walls.get(x, y) !== FLOOR;
  }

  creatureAt(x, y) {
    return this.creatures.get(x, y);
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
  moveCreature(creature, x, y) {
    if (this.isWall(x, y)) return { moved: false, target: null, damage: 0, killed: false };

    const other = this.creatureAt(x, y);
    if (other && other !== creature) {
      const { damage, killed } = creature.attack(other);
      // Corpses don't block movement. The player stays on the map so the UI can show them.
      if (killed && !other.isPlayer) this.removeCreature(other);
      return { moved: false, target: other, damage, killed };
    }

    this.removeCreature(creature);
    creature.moveTo(x, y);
    this.creatures.set(x, y, creature);
    return { moved: true, target: null, damage: 0, killed: false };
  }

  // Every living monster takes a turn. Returns what each one did.
  processMonsters(player) {
    const events = [];
    for (const monster of this.monsters) {
      if (!monster.alive) continue;
      const result = monster.takeTurn(this, player);
      if (result) events.push({ actor: monster, ...result });
    }
    return events;
  }
}
