export class Creature {
  constructor({ x = 0, y = 0, glyph = "x", name = "creature", hp = 2, damage = 1 } = {}) {
    this.x = x;
    this.y = y;
    this.glyph = glyph;
    this.name = name;
    this.hp = hp;
    this.maxHp = hp;
    this.damage = damage;
    this.armor = 0;
  }

  // A getter, so it can't be mistakenly referenced without being called.
  get alive() {
    return this.hp > 0;
  }

  moveTo(x, y) {
    this.x = x;
    this.y = y;
  }

  attack(target, multiplier = 1) {
    return this.strike(target, this.damage * multiplier);
  }

  // Deals raw damage, reduced by the target's armour but never below 1.
  strike(target, amount) {
    const damage = Math.max(1, amount - target.armor);
    target.hp -= damage;
    return { damage, killed: !target.alive };
  }
}
