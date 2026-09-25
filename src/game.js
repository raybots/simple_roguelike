import { BIOMES } from "./biomes.js";
import { BRAZIER_RADIUS, FIRE_RADIUS, FUNGUS_RADIUS, Level } from "./level.js";
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
export const IGNITE_COST = 5;
// Chance per turn that a goblin's torch sets the grass it stands in alight.
export const GOBLIN_IGNITE_CHANCE = 0.12;
// Chance that wading into water puts your torch out.
export const WATER_DOUSE_CHANCE = 0.25;
// Inside the Lightless's reach, every light shrinks to this.
export const SMOTHERED_RADIUS = 1;
// The Sun Stone shines, and it's the one light the Lightless can't eat.
export const SUN_RADIUS = 4;
export const THROW_RANGE = 6;
export const THROW_DAMAGE = 2;
// Idle monsters this close that see your torch land go to look at it.
export const LURE_RANGE = 10;
// A torch lying on the ground or in a thief's hands burns lower than one held high.
export const LOOSE_TORCH_RADIUS = 4;
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
    this.smothered = false;
    this.enterLevel();
    this.log("You enter the caves. Find the stairs (>) to go deeper.");
  }

  enterLevel() {
    const blueprint = generateLevel({ width: this.width, height: this.height, depth: this.depth, rng: this.rng });
    this.level = new Level(blueprint);
    this.level.placeCreature(this.player, blueprint.playerStart.x, blueprint.playerStart.y);
    this.placeBones(blueprint);
    if (this.player.hasRelic("cartographer")) this.revealStairs();
    this.waded = false;
    this.updateVisibility();
    const arrival = BIOMES[this.level.biome]?.arrival;
    if (arrival && this.depth > 1) this.log(arrival);
    if (this.level.monsters.some((m) => m.eatsLight)) {
      this.log("The deepest dark. Somewhere ahead, the Sun Stone waits, and something guards it.");
    }
  }

  // The living light-eater, if there is one on this level.
  get lightEater() {
    return this.level.monsters.find((m) => m.alive && m.eatsLight) ?? null;
  }

  inDarkAura(x, y) {
    const eater = this.lightEater;
    return !!eater && Math.hypot(x - eater.x, y - eater.y) <= eater.eatsLight;
  }

  // Your torch radius, after crystal walls and the Lightless have had their say.
  get torchRadius() {
    const { player } = this;
    if (!player.torchBurning) return 0;
    const at = this.torchPosition;
    let radius = player.torchRadius + (BIOMES[this.level.biome]?.torch ?? 0);
    if (!player.hasTorch) radius = Math.min(radius, LOOSE_TORCH_RADIUS);
    if (at && this.inDarkAura(at.x, at.y)) radius = SMOTHERED_RADIUS;
    return radius;
  }

  // Where your torch is: in your hand, lying where you threw it, or with a thief.
  get torchPosition() {
    const { player } = this;
    return player.hasTorch ? { x: player.x, y: player.y } : this.level.looseTorchPosition();
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
    const torch = this.torchPosition;
    if (player.torchBurning && torch) sources.push({ ...torch, radius: this.torchRadius });
    for (const b of level.braziers()) if (b.lit) sources.push({ x: b.x, y: b.y, radius: BRAZIER_RADIUS });
    for (const m of level.monsters) if (m.alive && m.torch) sources.push({ x: m.x, y: m.y, radius: m.torch });
    for (const f of level.burningTiles()) sources.push({ x: f.x, y: f.y, radius: FIRE_RADIUS });
    for (const f of level.fungusTiles()) sources.push({ x: f.x, y: f.y, radius: FUNGUS_RADIUS });
    const smothered = sources.map((s) =>
      this.inDarkAura(s.x, s.y) ? { ...s, radius: Math.min(s.radius, SMOTHERED_RADIUS) } : s,
    );
    level.items.forEach((x, y, item) => {
      if (item?.type === "sun") smothered.push({ x, y, radius: SUN_RADIUS });
    });
    return smothered;
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

    const ownRadius = player.carryingLight ? this.torchRadius : DARK_SIGHT;
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
    if (this.state === "dead" || this.state === "won") {
      if (action !== "restart") return false;
      this.newGame();
      this.effect("restart");
      return true;
    }
    if (this.state === "aiming") {
      this.state = "playing";
      if (action in DIRECTIONS) return this.throwTorch(...DIRECTIONS[action]);
      this.log("You keep hold of your torch.");
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
    if (action === "ignite") return this.ignite();
    if (action === "throw") return this.aim();
    return false;
  }

  move(dx, dy) {
    const x = this.player.x + dx;
    const y = this.player.y + dy;
    // Bumping a wall is free.
    if (this.level.isWall(x, y)) return false;
    if (this.level.featureAt(x, y)?.type === "brazier") return this.useBrazier(x, y);
    if (this.level.isChasm(x, y) && !this.level.creatureAt(x, y)) {
      if (!this.player.hasTorch) {
        this.log("You won't jump without your torch.");
        return true;
      }
      return this.fall();
    }

    const target = this.level.creatureAt(x, y);
    const sneak = target && target.unaware;
    const multiplier = sneak ? (this.player.hasRelic("shadowstep") ? SHADOWSTEP_MULTIPLIER : SNEAK_MULTIPLIER) : 1;
    const result = this.level.moveCreature(this.player, x, y, { multiplier });
    if (result.moved) this.effect("step");
    if (result.moved && this.level.isTorchAt(x, y)) this.pickUpTorch();
    if (result.moved && this.level.terrainAt(x, y) === "water") this.wade();
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
    } else if (item.type === "sun") {
      this.win();
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
    if (!this.player.carryingLight || this.player.fuel < BRAZIER_COST) {
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

  // Wading is slow: monsters get an extra move, and the water may put your torch out.
  wade() {
    this.slowed = true;
    if (!this.waded) {
      this.waded = true;
      this.log("You wade through black water. It slows you down.");
    }
    if (this.player.carryingLight && this.rng.chance(WATER_DOUSE_CHANCE)) {
      this.player.torchLit = false;
      this.log("Water splashes over your torch and puts it out! Press t to relight it.");
      this.effect("torch", { lit: false });
    }
  }

  // Sets the grass next to you alight with your torch.
  ignite() {
    const { player, level } = this;
    if (!player.carryingLight || player.fuel < IGNITE_COST) {
      this.log("You need a burning torch to start a fire.");
      return true;
    }
    let lit = 0;
    for (const [dx, dy] of Object.values(DIRECTIONS)) if (level.ignite(player.x + dx, player.y + dy)) lit++;
    if (lit === 0) {
      this.log("Nothing next to you will burn.");
      return true;
    }
    player.fuel -= IGNITE_COST;
    this.log("You touch your torch to the grass. It catches!");
    this.effect("ignite");
    return this.endTurn();
  }

  win() {
    this.state = "won";
    this.log(`You lift the Sun Stone. Light floods the deep. You won in ${plural(this.turn, "turn")}!`);
    this.effect("win");
  }

  // Enters aiming: the next direction throws the torch.
  aim() {
    const { player } = this;
    if (!player.hasTorch) {
      this.log("Your torch is out of reach.");
      return true;
    }
    if (!player.torchBurning) {
      this.log("Light your torch before you throw it.");
      return true;
    }
    this.state = "aiming";
    this.log("Throw your torch which way?");
    return true;
  }

  // The tiles a torch thrown this way would fly over, ending where it lands.
  // It stops at walls and braziers, and at the first creature it hits.
  throwPath(dx, dy) {
    const { level, player } = this;
    const path = [];
    for (let i = 1; i <= THROW_RANGE; i++) {
      const x = player.x + dx * i;
      const y = player.y + dy * i;
      if (level.isBlocked(x, y)) break;
      path.push({ x, y });
      if (level.creatureAt(x, y)) break;
    }
    // It can't come to rest over a chasm; it drops short instead.
    while (path.length > 0 && level.isChasm(path.at(-1).x, path.at(-1).y)) path.pop();
    return path;
  }

  throwTorch(dx, dy) {
    const { level, player } = this;
    const path = this.throwPath(dx, dy);
    if (path.length === 0) {
      this.log("There's no room to throw it.");
      return true;
    }
    const land = path.at(-1);
    player.hasTorch = false;
    level.torch = { x: land.x, y: land.y };
    this.effect("throw", { path });

    const target = level.creatureAt(land.x, land.y);
    if (target) {
      const { damage, killed } = level.strikeCreature(player, target, THROW_DAMAGE);
      this.log(killed ? `Your torch strikes the ${target.name} dead!` : `Your torch cracks into the ${target.name}.`);
      this.effect("hit", { x: land.x, y: land.y, amount: damage, killed, by: "player" });
      if (!killed) target.state = "hunting";
    } else {
      this.log("Your torch tumbles through the air and lands, burning.");
    }
    if (level.ignite(land.x, land.y)) this.log("The grass catches!");
    if (level.terrainAt(land.x, land.y) === "water") {
      player.torchLit = false;
      this.log("Your torch hisses out in the water.");
    }
    this.lure(land);
    return this.endTurn();
  }

  // Idle monsters that see the torch land wander over to look.
  lure(spot) {
    for (const m of this.level.monsters) {
      if (!m.alive || m.state !== "idle") continue;
      if (Math.hypot(m.x - spot.x, m.y - spot.y) > LURE_RANGE || !m.hasLineOfSightTo(this.level, spot)) continue;
      m.investigate = { x: spot.x, y: spot.y };
      if (this.isVisible(m.x, m.y)) this.log(`The ${m.name} turns toward the light.`);
    }
  }

  pickUpTorch() {
    this.level.torch = null;
    this.player.hasTorch = true;
    this.log(this.player.torchBurning ? "You take up your torch again." : "You pick up your torch. Press t to relight it.");
    this.effect("pickup", { kind: "torch" });
  }

  toggleTorch() {
    const { player } = this;
    if (!player.hasTorch) {
      this.log("Your torch is out of reach.");
      return true;
    }
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
    if (!this.player.hasTorch) {
      this.log("You won't go deeper without your torch.");
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
    if (this.state === "won") return true;
    // Monsters see you by the light as it is before they move.
    this.updateVisibility();
    this.monstersAct();
    if (this.slowed && this.player.alive) this.monstersAct();
    this.slowed = false;
    this.worldActs();
    this.turn++;
    if (!this.player.alive) {
      this.state = "dead";
      this.log(`You die on depth ${this.depth} after ${plural(this.turn, "turn")}.`);
      this.effect("death");
    }
    this.updateVisibility();
    return true;
  }

  // Fire burns and spreads, goblin torches catch the grass, and the Lightless snuffs braziers.
  worldActs() {
    const { level, player } = this;
    for (const m of level.monsters) {
      if (m.alive && m.torch && level.terrainAt(m.x, m.y) === "grass" && this.rng.chance(GOBLIN_IGNITE_CHANCE)) {
        if (level.ignite(m.x, m.y) && this.isVisible(m.x, m.y)) this.log(`The ${m.name}'s torch sets the grass alight!`);
      }
    }
    for (const burn of level.updateFire(this.rng)) {
      this.effect("hit", { x: burn.target.x, y: burn.target.y, amount: burn.damage, killed: burn.killed, by: "fire" });
      if (burn.target === player) {
        this.log(`You burn! (-${burn.damage})`);
        if (burn.killed) this.killedBy = "flames";
      } else if (this.isVisible(burn.target.x, burn.target.y)) {
        this.log(burn.killed ? `The ${burn.target.name} burns to death.` : `The ${burn.target.name} burns.`);
      }
    }
    let snuffed = false;
    for (const b of level.braziers()) {
      if (b.lit && this.inDarkAura(b.x, b.y)) {
        level.features.get(b.x, b.y).lit = false;
        snuffed = true;
      }
    }
    if (snuffed) level.updateStaticLight();
    const smothered = this.inDarkAura(player.x, player.y) && player.carryingLight;
    if (smothered && !this.smothered) this.log("Your torch shrinks to an ember. Something is drinking the light.");
    this.smothered = smothered;
  }

  monstersAct() {
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
      } else if (event.stoleTorch) {
        this.log(`The ${event.actor.name} snatches up your torch! Kill it to get it back.`);
      } else if (event.item && seen) {
        this.log(`The ${event.actor.name} snatches up the ${event.item.type}!`);
      } else if (event.fled && seen && !event.actor.fledBefore) {
        event.actor.fledBefore = true;
        this.log(`The ${event.actor.name} flees in terror.`);
      }
    }
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
