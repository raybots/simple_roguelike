import { Level } from "./level.js";
import { generateLevel } from "./levelgen.js";
import { Player } from "./player.js";
import { createRng } from "./rng.js";

export const DIRECTIONS = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

// The turn engine. Knows nothing about the DOM.
export class Game {
  constructor({ width = 60, height = 60, rng = createRng() } = {}) {
    this.width = width;
    this.height = height;
    this.rng = rng;
    this.newGame();
  }

  newGame() {
    const blueprint = generateLevel({ width: this.width, height: this.height, rng: this.rng });
    this.level = new Level(blueprint);
    this.player = new Player();
    this.level.placeCreature(this.player, blueprint.playerStart.x, blueprint.playerStart.y);
    this.turn = 0;
  }

  // Returns true when the action was understood and a turn passed.
  playerAction(action) {
    const direction = DIRECTIONS[action];
    if (!direction) return false;

    const [dx, dy] = direction;
    this.level.moveCreature(this.player, this.player.x + dx, this.player.y + dy);
    this.level.processMonsters(this.player);
    this.turn++;
    return true;
  }
}
