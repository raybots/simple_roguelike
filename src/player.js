import { Creature } from "./creature.js";

export class Player extends Creature {
  constructor({ x = 0, y = 0 } = {}) {
    super({ x, y, glyph: "@", name: "you", hp: 30, damage: 1 });
    this.isPlayer = true;
  }
}
