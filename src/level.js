import { createMonster } from "./bestiary.js";
import { FLOOR } from "./cavegen.js";
import { Grid } from "./grid.js";
import { computeFov } from "./visibility.js";

export const BRAZIER_RADIUS = 4;
export const FIRE_RADIUS = 2;
export const FUNGUS_RADIUS = 2;
export const FIRE_START = 4;
export const FIRE_DAMAGE = 2;
const FIRE_SPREAD_CHANCE = 0.45;

const NO_MOVE = Object.freeze({ moved: false, target: null, damage: 0, killed: false, item: null });

export class Level {
  constructor({ walls, monsters = [], items = [], features = [], stairs = null, depth = 1, terrain = null, biome = "caves" }) {
    this.walls = walls;
    this.width = walls.width;
    this.height = walls.height;
    this.depth = depth;
    this.stairs = stairs;
    this.creatures = new Grid(this.width, this.height, null);
    this.items = new Grid(this.width, this.height, null);
    this.features = new Grid(this.width, this.height, null);
    this.explored = new Grid(this.width, this.height, false);
    this.biome = biome;
    // Ground cover: null, "grass", "water", "fungus" or "ash".
    this.terrain = terrain ?? new Grid(this.width, this.height, null);
    // Burning tiles: 0 for none, otherwise turns of fire left.
    this.fire = new Grid(this.width, this.height, 0);
    // Your torch when it isn't in your hand: lying at `torch`, or carried off by `torchThief`.
    this.torch = null;
    this.torchThief = null;
    // Dead monsters stay in this list so they can be drawn as corpses.
    this.monsters = [];
    for (const f of features) this.features.set(f.x, f.y, { type: f.type, lit: !!f.lit, ring: !!f.ring });
    for (const spec of monsters) {
      this.addMonster(createMonster(spec.type, spec.x, spec.y, depth, spec.state ?? "idle"));
    }
    for (const { x, y, ...item } of items) this.items.set(x, y, item);
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
      if (f?.type === "brazier") list.push({ x, y, lit: f.lit, ring: !!f.ring });
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

  terrainAt(x, y) {
    return this.terrain.get(x, y);
  }

  isBurning(x, y) {
    return this.fire.get(x, y) > 0;
  }

  // Sets grass alight. Returns true if it caught.
  ignite(x, y) {
    if (this.terrainAt(x, y) !== "grass" || this.isBurning(x, y)) return false;
    this.fire.set(x, y, FIRE_START);
    return true;
  }

  burningTiles() {
    const tiles = [];
    this.fire.forEach((x, y, f) => {
      if (f > 0) tiles.push({ x, y, f });
    });
    return tiles;
  }

  fungusTiles() {
    const tiles = [];
    this.terrain.forEach((x, y, t) => {
      if (t === "fungus") tiles.push({ x, y });
    });
    return tiles;
  }

  // One turn of fire: burning tiles hurt whoever stands in them, spread to neighbouring
  // grass, and burn down to ash. Returns who got burned.
  updateFire(rng) {
    const burning = this.burningTiles();
    const burns = [];
    for (const { x, y } of burning) {
      const creature = this.creatureAt(x, y);
      if (creature?.friendly) {
        burns.push({ target: creature, damage: 0, killed: false, spared: true });
      } else if (creature?.alive) {
        creature.hp -= FIRE_DAMAGE;
        const killed = !creature.alive;
        if (killed && !creature.isPlayer) this.removeCreature(creature);
        if (killed) this.dropLoot(creature);
        burns.push({ target: creature, damage: FIRE_DAMAGE, killed });
      }
    }
    for (const { x, y } of burning) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!this.isBurning(x + dx, y + dy) && this.terrainAt(x + dx, y + dy) === "grass" && rng.chance(FIRE_SPREAD_CHANCE)) {
          this.fire.set(x + dx, y + dy, FIRE_START + 1);
        }
      }
    }
    for (const { x, y } of burning) {
      const left = this.fire.get(x, y) - 1;
      this.fire.set(x, y, left);
      if (left === 0) this.terrain.set(x, y, "ash");
    }
    return burns;
  }

  // Two creatures trade places (Wick stepping past a friend).
  swap(a, b) {
    const [ax, ay, bx, by] = [a.x, a.y, b.x, b.y];
    a.moveTo(bx, by);
    b.moveTo(ax, ay);
    this.creatures.set(bx, by, a);
    this.creatures.set(ax, ay, b);
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
      if (killed) this.dropLoot(other);
      return { ...NO_MOVE, target: other, damage, killed };
    }

    this.removeCreature(creature);
    creature.moveTo(x, y);
    this.creatures.set(x, y, creature);

    // Thieves snatch up your torch if they find it lying about.
    let stoleTorch = false;
    if (creature.collects && this.isTorchAt(x, y)) {
      this.torch = null;
      this.torchThief = creature;
      stoleTorch = true;
    }

    // The player picks up anything. Thieving monsters grab anything but the Sun Stone.
    let item = null;
    const here = this.itemAt(x, y);
    if (here && (creature.isPlayer || (creature.collects && here.type !== "sun"))) {
      item = here;
      this.items.set(x, y, null);
      if (!creature.isPlayer) creature.loot.push(item);
    }
    return { ...NO_MOVE, moved: true, item, stoleTorch };
  }

  // Direct damage outside a normal bump attack. Removes monsters that die.
  // Friendly creatures are never hurt: they're `spared` instead.
  strikeCreature(attacker, target, amount) {
    if (target.friendly) return { damage: 0, killed: false, spared: true };
    const { damage, killed } = attacker.strike(target, amount);
    if (killed && !target.isPlayer) this.removeCreature(target);
    if (killed) this.dropLoot(target);
    return { damage, killed };
  }

  isTorchAt(x, y) {
    return this.torch !== null && this.torch.x === x && this.torch.y === y;
  }

  // Where your torch is when you aren't holding it.
  looseTorchPosition() {
    if (this.torchThief) return { x: this.torchThief.x, y: this.torchThief.y };
    return this.torch;
  }

  // A dead thief drops what it carried on and around the spot it died.
  dropLoot(creature) {
    if (creature === this.torchThief) {
      this.torchThief = null;
      this.torch = { x: creature.x, y: creature.y };
    }
    if (!creature.loot?.length) return;
    const spots = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
    for (const [dx, dy] of spots) {
      if (creature.loot.length === 0) break;
      const x = creature.x + dx;
      const y = creature.y + dy;
      if (this.isBlocked(x, y) || this.itemAt(x, y) || this.isStairs(x, y)) continue;
      this.items.set(x, y, creature.loot.shift());
    }
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
