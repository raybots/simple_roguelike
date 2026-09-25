export class Creature {
  constructor({ x = 0, y = 0, glyph = "x", name = "creature", hp = 2, damage = 1 } = {}) {
    this.x = x;
    this.y = y;
    this.glyph = glyph;
    this.name = name;
    this.hp = hp;
    this.maxHp = hp;
    this.damage = damage;
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
    const damage = this.damage * multiplier;
    target.hp -= damage;
    return { damage, killed: !target.alive };
  }
}
