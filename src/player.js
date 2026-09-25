import { Creature } from "./creature.js";

export const POTION_HEAL = 10;

export class Player extends Creature {
  constructor({ x = 0, y = 0 } = {}) {
    super({ x, y, glyph: "@", name: "you", hp: 30, damage: 2 });
    this.isPlayer = true;
    this.potions = 0;
  }

  // Returns how much was actually healed.
  heal(amount) {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }
}
