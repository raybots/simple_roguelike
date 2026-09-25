import { Level } from "./level.js";
import { generateLevel } from "./levelgen.js";
import { Player, POTION_HEAL } from "./player.js";
import { createRng } from "./rng.js";
import { computeFov } from "./visibility.js";

export const DIRECTIONS = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

export const FOV_RADIUS = 8;
const MAX_MESSAGES = 100;

// The turn engine. Knows nothing about the DOM.
export class Game {
  constructor({ width = 60, height = 60, rng = createRng() } = {}) {
    this.width = width;
    this.height = height;
    this.rng = rng;
    this.newGame();
  }

  newGame() {
    this.player = new Player();
    this.depth = 1;
    this.turn = 0;
    this.state = "playing";
    this.messages = [];
    this.enterLevel();
    this.log("You enter the caves. Find the stairs (>) to go deeper.");
  }

  enterLevel() {
    const blueprint = generateLevel({ width: this.width, height: this.height, depth: this.depth, rng: this.rng });
    this.level = new Level(blueprint);
    this.level.placeCreature(this.player, blueprint.playerStart.x, blueprint.playerStart.y);
    this.updateVisibility();
  }

  log(text) {
    this.messages.push(text);
    if (this.messages.length > MAX_MESSAGES) this.messages.shift();
  }

  updateVisibility() {
    const { level, player } = this;
    this.visible = computeFov(level.width, level.height, (x, y) => level.isWall(x, y), player.x, player.y, FOV_RADIUS);
    level.markExplored(this.visible);
  }

  isVisible(x, y) {
    return this.visible.has(y * this.level.width + x);
  }

  // Returns true when anything changed and the screen should be redrawn.
  playerAction(action) {
    if (this.state === "dead") {
      if (action !== "restart") return false;
      this.newGame();
      return true;
    }

    if (action in DIRECTIONS) return this.move(...DIRECTIONS[action]);
    if (action === "wait") return this.endTurn();
    if (action === "descend") return this.descend();
    if (action === "quaff") return this.quaff();
    return false;
  }

  move(dx, dy) {
    const x = this.player.x + dx;
    const y = this.player.y + dy;
    // Bumping a wall is free.
    if (this.level.isWall(x, y)) return false;

    const result = this.level.moveCreature(this.player, x, y);
    if (result.target) {
      const name = result.target.name;
      this.log(result.killed ? `You kill the ${name}.` : `You hit the ${name}.`);
    }
    if (result.item?.type === "potion") {
      this.player.potions++;
      this.log("You pick up a potion. Press q to drink it.");
    }
    if (result.moved && this.level.isStairs(x, y)) this.log("There are stairs down here. Press > to descend.");
    return this.endTurn();
  }

  descend() {
    if (!this.level.isStairs(this.player.x, this.player.y)) {
      this.log("There are no stairs here.");
      return true;
    }
    this.depth++;
    this.enterLevel();
    this.log(`You descend to depth ${this.depth}.`);
    return true;
  }

  quaff() {
    if (this.player.potions === 0) {
      this.log("You have no potions.");
      return true;
    }
    this.player.potions--;
    const healed = this.player.heal(POTION_HEAL);
    this.log(`You drink a potion and recover ${healed} HP.`);
    return this.endTurn();
  }

  endTurn() {
    const events = this.level.processMonsters(this.player, this.rng);
    for (const event of events) {
      if (event.target === this.player) {
        this.log(`The ${event.actor.name} ${event.actor.verb} you for ${event.damage}.`);
      }
    }
    this.turn++;
    if (!this.player.alive) {
      this.state = "dead";
      this.log(`You die on depth ${this.depth} after ${plural(this.turn, "turn")}.`);
    }
    this.updateVisibility();
    return true;
  }
}

export function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}
