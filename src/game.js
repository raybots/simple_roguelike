import { BRAZIER_RADIUS, Level } from "./level.js";
import { lightLevel } from "./light.js";
import { generateLevel } from "./levelgen.js";
import { BRAZIER_COST, OIL_FUEL, Player, POTION_HEAL } from "./player.js";
import { createRng } from "./rng.js";
import { computeFov } from "./visibility.js";

export const DIRECTIONS = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

export const FOV_RADIUS = 8;
// How far you can see things that are lit by something other than your own torch.
export const SIGHT_RANGE = 16;
// Without a torch you can still make out the tiles right next to you.
export const DARK_SIGHT = 1;
export const SNEAK_MULTIPLIER = 3;
const NOISE_RADIUS = 6;
const MAX_MESSAGES = 100;

const FUEL_WARNINGS = [
  { at: 100, text: "Your torch burns low." },
  { at: 40, text: "Your torch gutters. Find oil." },
];

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
    this.messageCount = 0;
    this.killedBy = null;
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
    this.messageCount++;
    if (this.messages.length > MAX_MESSAGES) this.messages.shift();
  }

  index(x, y) {
    return y * this.level.width + x;
  }

  // Everything that gives off light right now: your torch, lit braziers, goblin torches.
  lightSources() {
    const { player, level } = this;
    const sources = [];
    if (player.torchBurning) sources.push({ x: player.x, y: player.y, radius: player.torchRadius });
    for (const b of level.braziers()) if (b.lit) sources.push({ x: b.x, y: b.y, radius: BRAZIER_RADIUS });
    for (const m of level.monsters) if (m.alive && m.torch) sources.push({ x: m.x, y: m.y, radius: m.torch });
    return sources;
  }

  // Recomputes the light map and what the player can see.
  // You see everything your torch reaches, plus anything lit by other lights
  // that's in your line of sight.
  updateVisibility() {
    const { level, player } = this;
    const isOpaque = (x, y) => level.isWall(x, y);

    this.light = new Map();
    for (const s of this.lightSources()) {
      for (const i of computeFov(level.width, level.height, isOpaque, s.x, s.y, s.radius)) {
        const x = i % level.width;
        const y = (i - x) / level.width;
        const l = lightLevel(x - s.x, y - s.y, s.radius);
        if (l > (this.light.get(i) ?? 0)) this.light.set(i, l);
      }
    }

    const ownRadius = player.torchBurning ? player.torchRadius : DARK_SIGHT;
    this.visible = computeFov(level.width, level.height, isOpaque, player.x, player.y, ownRadius);
    for (const i of computeFov(level.width, level.height, isOpaque, player.x, player.y, SIGHT_RANGE)) {
      if (this.light.has(i)) this.visible.add(i);
    }
    level.markExplored(this.visible);
  }

  isVisible(x, y) {
    return this.visible.has(this.index(x, y));
  }

  lightAt(x, y) {
    return this.light.get(this.index(x, y)) ?? 0;
  }

  get playerLit() {
    return this.lightAt(this.player.x, this.player.y) > 0;
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
    if (action === "torch") return this.toggleTorch();
    return false;
  }

  move(dx, dy) {
    const x = this.player.x + dx;
    const y = this.player.y + dy;
    // Bumping a wall is free.
    if (this.level.isWall(x, y)) return false;
    if (this.level.featureAt(x, y)?.type === "brazier") return this.useBrazier(x, y);

    const target = this.level.creatureAt(x, y);
    const sneak = target && target.unaware;
    const result = this.level.moveCreature(this.player, x, y, { multiplier: sneak ? SNEAK_MULTIPLIER : 1 });
    if (result.target) this.reportAttack(result, sneak);
    if (result.item) this.pickUp(result.item);
    if (result.moved && this.level.isStairs(x, y)) this.log("There are stairs down here. Press > to descend.");
    return this.endTurn();
  }

  reportAttack(result, sneak) {
    const { target, killed } = result;
    const name = target.name;
    if (sneak) this.log(killed ? `You strike the unaware ${name} dead!` : `You strike the unaware ${name}!`);
    else this.log(killed ? `You kill the ${name}.` : `You hit the ${name}.`);
    if (!killed) target.state = "hunting";
    this.makeNoise(target.x, target.y);
  }

  // Fighting wakes sleepers nearby.
  makeNoise(x, y) {
    for (const m of this.level.monsters) {
      if (m.alive && m.state === "asleep" && Math.hypot(m.x - x, m.y - y) <= NOISE_RADIUS) m.state = "idle";
    }
  }

  pickUp(item) {
    if (item.type === "potion") {
      this.player.potions++;
      this.log("You pick up a potion. Press q to drink it.");
    } else if (item.type === "oil") {
      const added = this.player.addFuel(OIL_FUEL);
      this.log(`You refill your torch with oil (+${added}).`);
    }
  }

  useBrazier(x, y) {
    const brazier = this.level.featureAt(x, y);
    if (brazier.lit) {
      this.log("The brazier burns steadily.");
      return true;
    }
    if (!this.player.torchBurning || this.player.fuel < BRAZIER_COST) {
      this.log("You need a burning torch to light the brazier.");
      return true;
    }
    this.player.fuel -= BRAZIER_COST;
    this.level.lightBrazier(x, y);
    this.log("You light the brazier. Warm light floods the cave.");
    return this.endTurn();
  }

  toggleTorch() {
    const { player } = this;
    if (player.torchLit) {
      player.torchLit = false;
      this.log("You douse your torch. The dark hides you.");
    } else if (player.fuel <= 0) {
      this.log("Your torch has no fuel left.");
      return true;
    } else {
      player.torchLit = true;
      this.log("You relight your torch.");
    }
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

  burnFuel() {
    const { player } = this;
    if (!player.torchBurning) return;
    player.fuel--;
    const warning = FUEL_WARNINGS.find((w) => w.at === player.fuel);
    if (warning) this.log(warning.text);
    if (player.fuel === 0) this.log("Your torch dies. Darkness closes in.");
  }

  endTurn() {
    this.burnFuel();
    // Monsters see you by the light as it is before they move.
    this.updateVisibility();
    const events = this.level.processMonsters(this.player, this.rng, { playerLit: this.playerLit });
    for (const event of events) {
      if (event.target === this.player) {
        this.log(`The ${event.actor.name} ${event.actor.verb} you for ${event.damage}.`);
        if (event.killed) this.killedBy = event.actor.name;
      } else if (event.noticed && this.isVisible(event.actor.x, event.actor.y)) {
        this.log(`The ${event.actor.name} notices you.`);
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
