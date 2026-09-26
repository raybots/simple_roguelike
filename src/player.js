import { Creature } from "./creature.js";

export const POTION_HEAL = 10;
export const MAX_FUEL = 300;
export const OIL_FUEL = 120;
export const BRAZIER_COST = 10;
// Resting by a lit brazier restores this much each turn.
export const REST_HEAL = 2;
export const REST_FUEL = 25;

export class Player extends Creature {
  constructor({ x = 0, y = 0 } = {}) {
    super({ x, y, glyph: "@", name: "you", hp: 30, damage: 2 });
    this.isPlayer = true;
    this.potions = 0;
    this.fuel = MAX_FUEL;
    this.maxFuel = MAX_FUEL;
    this.torchLit = true;
    // False while the torch lies where you threw it, or a goblin has run off with it.
    this.hasTorch = true;
    this.minTorchRadius = 0;
    this.potionBonus = 0;
    this.relics = [];
  }

  hasRelic(id) {
    return this.relics.includes(id);
  }

  // Whether the flame is alive, wherever the torch is.
  get torchBurning() {
    return this.torchLit && this.fuel > 0;
  }

  // Whether you're holding a burning torch.
  get carryingLight() {
    return this.hasTorch && this.torchBurning;
  }

  // Sight radius from the torch: 8 when full, shrinking to 3 as fuel runs low. 0 when dark.
  get torchRadius() {
    if (!this.torchBurning) return 0;
    return Math.max(this.minTorchRadius, 3 + Math.ceil((5 * this.fuel) / this.maxFuel));
  }

  // Returns how much was actually healed.
  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }

  addFuel(amount) {
    const before = this.fuel;
    this.fuel = Math.min(this.maxFuel, this.fuel + amount);
    return this.fuel - before;
  }
}
