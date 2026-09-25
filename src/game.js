import { BRAZIER_RADIUS, Level } from "./level.js";
import { lightLevel } from "./light.js";
import { generateLevel } from "./levelgen.js";
import { BRAZIER_COST, OIL_FUEL, Player, POTION_HEAL } from "./player.js";
import { applyRelic, draftRelics, RELICS } from "./relics.js";
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
export const SHADOWSTEP_MULTIPLIER = 5;
export const FALL_DAMAGE = 3;
export const ECHO_RANGE = 6;
const NOISE_RADIUS = 6;
const MAX_MESSAGES = 100;

const FUEL_WARNINGS = [
  { at: 100, text: "Your torch burns low." },
  { at: 40, text: "Your torch gutters. Find oil." },
];

// The turn engine. Knows nothing about the DOM.
//
// Options:
//   seed  - replay the same cave on every restart (used by the daily cave)
//   bones - { depth, potions } left by a previous death, found on that depth
export class Game {
  constructor({ width = 60, height = 60, rng, seed, bones = null } = {}) {
    this.width = width;
    this.height = height;
    this.seed = seed;
    this.rng = rng ?? createRng(seed);
    this.bones = bones;
    this.newGame();
  }

  newGame() {
    if (this.seed !== undefined && this.started) this.rng = createRng(this.seed);
    this.started = true;
    this.effects = [];
    this.bonesFound = false;
    this.player = new Player();
    this.depth = 1;
    this.turn = 0;
    this.state = "playing";
    this.messages = [];
    this.messageCount = 0;
    this.killedBy = null;
    this.draft = null;
    this.enterLevel();
    this.log("You enter the caves. Find the stairs (>) to go deeper.");
  }

  enterLevel() {
    const blueprint = generateLevel({ width: this.width, height: this.height, depth: this.depth, rng: this.rng });
    this.level = new Level(blueprint);
    this.level.placeCreature(this.player, blueprint.playerStart.x, blueprint.playerStart.y);
    this.placeBones(blueprint);
    if (this.player.hasRelic("cartographer")) this.revealStairs();
    this.updateVisibility();
  }

  // A previous adventurer's remains lie on the depth where they died.
  placeBones(blueprint) {
    const { bones } = this;
    if (!bones || this.bonesFound || bones.depth !== this.depth || bones.depth < 2) return;
    const { level } = this;
    const spot = blueprint.walls.cells
      .map((v, i) => ({ x: i % level.width, y: Math.floor(i / level.width), v }))
      .filter(({ x, y, v }) => v === 0 && level.isPassable(x, y) && !level.itemAt(x, y) && !level.isStairs(x, y))
      .filter(({ x, y }) => Math.hypot(x - this.player.x, y - this.player.y) >= 8);
    if (spot.length === 0) return;
    const { x, y } = this.rng.pick(spot);
    level.items.set(x, y, { type: "bones", potions: bones.potions });
  }

  // Describes this run for leaving bones behind, or null if there's nothing to leave.
  bonesRecord() {
    if (this.state !== "dead" || this.depth < 2) return null;
    return { depth: this.depth, potions: Math.max(1, this.player.potions) };
  }

  effect(type, data = {}) {
    this.effects.push({ type, ...data });
  }

  revealStairs() {
    const { stairs } = this.level;
    if (!stairs) return;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) this.level.explored.set(stairs.x + dx, stairs.y + dy, true);
    }
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

    // Echolocation: monsters nearby are sensed even without sight.
    this.sensed = new Set();
    if (player.hasRelic("echolocation")) {
      for (const m of level.monsters) {
        if (m.alive && Math.hypot(m.x - player.x, m.y - player.y) <= ECHO_RANGE) this.sensed.add(m);
      }
    }
    this.danger = level.dangerTiles();
  }

  isSensed(monster) {
    return this.sensed.has(monster);
  }

  isDanger(x, y) {
    return this.danger.has(this.index(x, y));
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
  // After each call, `effects` lists what happened, for sound and animation.
  playerAction(action) {
    this.effects = [];
    if (this.state === "dead") {
      if (action !== "restart") return false;
      this.newGame();
      this.effect("restart");
      return true;
    }
    if (this.state === "draft") {
      const pick = { choose1: 0, choose2: 1, choose3: 2 }[action];
      if (pick === undefined || pick >= this.draft.length) return false;
      return this.takeRelic(this.draft[pick]);
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
    if (this.level.isChasm(x, y) && !this.level.creatureAt(x, y)) return this.fall();

    const target = this.level.creatureAt(x, y);
    const sneak = target && target.unaware;
    const multiplier = sneak ? (this.player.hasRelic("shadowstep") ? SHADOWSTEP_MULTIPLIER : SNEAK_MULTIPLIER) : 1;
    const result = this.level.moveCreature(this.player, x, y, { multiplier });
    if (result.moved) this.effect("step");
    if (result.target) this.reportAttack(result, sneak);
    if (result.item) this.pickUp(result.item);
    if (result.moved && this.level.isStairs(x, y)) this.log("There are stairs down here. Press > to descend.");
    return this.endTurn();
  }

  reportAttack(result, sneak) {
    const { target, killed, damage } = result;
    const name = target.name;
    this.effect("hit", { x: target.x, y: target.y, amount: damage, killed, sneak, by: "player" });
    if (sneak) this.log(killed ? `You strike the unaware ${name} dead!` : `You strike the unaware ${name}!`);
    else this.log(killed ? `You kill the ${name}.` : `You hit the ${name}.`);
    if (!killed) target.state = "hunting";
    if (killed && this.player.hasRelic("vampiric") && this.player.heal(1) > 0) {
      this.log("You drink its life. (+1)");
      this.effect("heal", { x: this.player.x, y: this.player.y, amount: 1 });
    }
    this.makeNoise(target.x, target.y);
  }

  // Fighting wakes sleepers nearby.
  makeNoise(x, y) {
    for (const m of this.level.monsters) {
      if (m.alive && m.state === "asleep" && Math.hypot(m.x - x, m.y - y) <= NOISE_RADIUS) m.state = "idle";
    }
  }

  pickUp(item) {
    this.effect("pickup", { kind: item.type });
    if (item.type === "potion") {
      this.player.potions++;
      this.log("You pick up a potion. Press q to drink it.");
    } else if (item.type === "oil") {
      const added = this.player.addFuel(OIL_FUEL);
      this.log(`You refill your torch with oil (+${added}).`);
    } else if (item.type === "bones") {
      this.bonesFound = true;
      this.player.potions += item.potions;
      this.log(`You find the bones of a past adventurer, and ${plural(item.potions, "potion")} they never drank.`);
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
    this.effect("brazier", { x, y });
    if (this.player.hasRelic("lantern")) {
      const healed = this.player.heal(5);
      if (healed > 0) {
        this.log(`The flame mends you. (+${healed})`);
        this.effect("heal", { x: this.player.x, y: this.player.y, amount: healed });
      }
    }
    return this.endTurn();
  }

  toggleTorch() {
    const { player } = this;
    if (player.torchLit) {
      player.torchLit = false;
      this.log("You douse your torch. The dark hides you.");
      this.effect("torch", { lit: false });
    } else if (player.fuel <= 0) {
      this.log("Your torch has no fuel left.");
      return true;
    } else {
      player.torchLit = true;
      this.log("You relight your torch.");
      this.effect("torch", { lit: true });
    }
    return this.endTurn();
  }

  descend() {
    if (!this.level.isStairs(this.player.x, this.player.y)) {
      this.log("There are no stairs here.");
      return true;
    }
    this.goDeeper();
    this.effect("descend");
    this.log(`You descend to depth ${this.depth}.`);
    return true;
  }

  // Jumping into a chasm drops you a level, at a cost.
  fall() {
    const { player } = this;
    const hurt = Math.min(FALL_DAMAGE, player.hp - 1);
    player.hp -= hurt;
    this.goDeeper();
    this.effect("fall", { amount: hurt });
    this.log(`You leap into the chasm and land hard on depth ${this.depth}. (-${hurt})`);
    return true;
  }

  goDeeper() {
    this.depth++;
    this.enterLevel();
    this.startDraft();
  }

  startDraft() {
    const options = draftRelics(this.rng, this.player.relics);
    if (options.length === 0) return;
    this.draft = options;
    this.state = "draft";
  }

  takeRelic(id) {
    this.player.relics.push(id);
    applyRelic(id, this.player);
    if (id === "cartographer") this.revealStairs();
    this.draft = null;
    this.state = "playing";
    this.effect("relic", { id });
    this.log(`You take the ${RELICS[id].name}. ${RELICS[id].text}`);
    this.updateVisibility();
    return true;
  }

  quaff() {
    if (this.player.potions === 0) {
      this.log("You have no potions.");
      return true;
    }
    this.player.potions--;
    const healed = this.player.heal(POTION_HEAL + this.player.potionBonus);
    this.effect("heal", { x: this.player.x, y: this.player.y, amount: healed });
    this.log(`You drink a potion and recover ${healed} HP.`);
    return this.endTurn();
  }

  burnFuel() {
    const { player } = this;
    if (!player.torchBurning) return;
    player.fuel--;
    const warning = FUEL_WARNINGS.find((w) => w.at === player.fuel);
    if (warning) this.log(warning.text);
    if (player.fuel === 0) {
      this.log("Your torch dies. Darkness closes in.");
      this.effect("torch", { lit: false, died: true });
    }
  }

  endTurn() {
    this.burnFuel();
    // Monsters see you by the light as it is before they move.
    this.updateVisibility();
    const darkNotice = this.player.hasRelic("hush") ? 1 : undefined;
    const events = this.level.processMonsters(this.player, this.rng, { playerLit: this.playerLit, darkNotice });
    for (const event of events) {
      const seen = this.isVisible(event.actor.x, event.actor.y);
      if (event.windup) {
        if (seen) this.log(`The ${event.actor.name} raises its club!`);
        this.effect("windup", { x: event.actor.x, y: event.actor.y });
      } else if (event.smash) {
        for (const hit of event.hits) this.reportSmash(event.actor, hit);
        if (event.hits.length === 0 && seen) this.log(`The ${event.actor.name}'s club thuds into the ground.`);
        this.effect("smash", { x: event.actor.x, y: event.actor.y });
      } else if (event.target === this.player) {
        this.log(`The ${event.actor.name} ${event.actor.verb} you for ${event.damage}.`);
        this.effect("hit", { x: this.player.x, y: this.player.y, amount: event.damage, by: "monster" });
        if (event.killed) this.killedBy = event.actor.name;
      } else if (event.noticed && seen) {
        this.log(`The ${event.actor.name} notices you.`);
        this.effect("notice", { x: event.actor.x, y: event.actor.y });
      }
    }
    this.turn++;
    if (!this.player.alive) {
      this.state = "dead";
      this.log(`You die on depth ${this.depth} after ${plural(this.turn, "turn")}.`);
      this.effect("death");
    }
    this.updateVisibility();
    return true;
  }
}

Game.prototype.reportSmash = function reportSmash(actor, hit) {
  this.effect("hit", {
    x: hit.target.x,
    y: hit.target.y,
    amount: hit.damage,
    killed: hit.killed,
    by: hit.target === this.player ? "monster" : "smash",
  });
  if (hit.target === this.player) {
    this.log(`The ${actor.name}'s club crashes down on you for ${hit.damage}!`);
    if (hit.killed) this.killedBy = actor.name;
  } else {
    this.log(`The ${actor.name}'s club ${hit.killed ? "crushes" : "hits"} the ${hit.target.name}.`);
  }
};

export function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}
