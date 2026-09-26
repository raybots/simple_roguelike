import { DIRECTIONS } from "./game.js";
import { actionForKey } from "./input.js";
import { recentMessages, renderStatus, renderViewport, VIEWPORT, viewportOrigin } from "./render.js";
import { buy, canBuy, DECOR, DECOR_IDS, hearthScene } from "./hearth.js";
import { JOURNAL } from "./journal.js";
import { KEEPSAKE_IDS, KEEPSAKES } from "./keepsakes.js";
import { RELICS } from "./relics.js";
import { serializeGame } from "./save.js";
import { bestDepth, clearBones, clearSave, recordDepth, saveBones, saveMeta, writeSave } from "./storage.js";
import { cellClass, displayGlyph, epitaph, messageTone, STATE_MARKERS } from "./theme.js";

// Visible tiles never go fully black, even outside any light.
const MIN_VISIBLE_LIGHT = 0.14;
const SPARK_GLYPHS = ["*", "'", "`", ",", ".", "+", "·"];
const IMPACT_DAMAGE = 4;
// Touch: how far a finger must travel to count as a swipe, and D-pad repeat timing.
const SWIPE_DISTANCE = 24;
const REPEAT_DELAY = 280;
const REPEAT_EVERY = 130;

const LOG_LINES = 6;

// Restarts a CSS animation by toggling its class.
function replay(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

// The only module that touches the DOM, apart from the entry point.
export class DomUI {
  constructor(game, root, { audio = null, mode = "random", daily = false, meta = null } = {}) {
    this.game = game;
    this.root = root;
    this.meta = meta ?? { embers: 0, decor: [], keepsakes: [], journal: [] };
    this.hearth = root.querySelector("#hearth");
    this.hearthTab = "camp";
    this.audio = audio;
    this.mode = mode;
    this.daily = daily;
    this.best = bestDepth(mode);
    this.newBest = false;
    this.bestEl = root.querySelector("#best");
    this.muteButton = root.querySelector("#mute");
    this.kicker = root.querySelector(".kicker");
    this.modeLink = root.querySelector("#mode-link");
    this.status = root.querySelector("#status");
    this.map = root.querySelector("#map");
    this.mapWrap = root.querySelector("#map-wrap");
    this.log = root.querySelector("#log");
    this.overlay = root.querySelector("#overlay");
    this.hpFill = root.querySelector("#hp-fill");
    this.hpText = root.querySelector("#hp-text");
    this.fuelFill = root.querySelector("#fuel-fill");
    this.fuelText = root.querySelector("#fuel-text");
    this.hud = root.querySelector("#hud");
    this.potions = root.querySelector("#potions");
    this.depth = root.querySelector("#depth");
    this.turn = root.querySelector("#turn");
    this.warmthEl = root.querySelector("#warmth");
    this.relics = root.querySelector("#relics");
    this.satchel = root.querySelector("#satchel");
    this.draft = root.querySelector("#draft");
    this.relicCount = -1;

    this.buildGrid();
    this.last = {
      hp: game.player.hp,
      depth: game.depth,
      messageCount: game.messageCount,
      state: game.state,
      x: game.player.x,
      y: game.player.y,
    };
    this.setupChrome();
  }

  // Page furniture that depends on the mode: the kicker line, the mode link, mute button.
  setupChrome() {
    if (this.daily) {
      this.kicker.textContent = `today's cave · ${new Date().toISOString().slice(0, 10)}`;
      this.modeLink.textContent = "Play a random cave";
    } else {
      this.modeLink.textContent = "Play today's cave";
    }
    this.modeLink.href = this.daily ? "#" : "#daily";
    // Switching modes reloads the page with a different #hash (or none).
    const switchTo = (hash) => (event) => {
      event.preventDefault();
      if (location.search) {
        location.assign(location.pathname + (hash ? `#${hash}` : ""));
      } else {
        location.hash = hash;
        location.reload();
      }
    };
    this.modeLink.addEventListener("click", switchTo(this.daily ? "" : "daily"));
    const night = this.game.night;
    const nightToggle = this.root.querySelector("#night-toggle");
    nightToggle.textContent = night ? "Back to the Hearth" : "Night mode";
    nightToggle.href = night ? "#" : "#night";
    nightToggle.addEventListener("click", switchTo(night ? "" : "night"));
    this.root.querySelector(".night-link")?.addEventListener("click", switchTo("night"));
    if (night) this.kicker.textContent = "night mode · no resting, no second chances";
    document.body.classList.toggle("night", night);

    // The start card: a click or key press gives the page focus and lets sound play.
    this.start = this.root.querySelector("#start");
    this.start?.addEventListener("click", () => this.begin());
    this.setupHearth();
    this.overlay.addEventListener("click", () => this.act("restart"));
    this.setupTouch();
    this.muteButton.addEventListener("click", () => {
      this.audio?.start();
      this.audio?.toggleMute();
      this.renderMute();
    });
    this.renderMute();
  }

  // The Hearth opens the game (except at Night) and greets you after every doze.
  setupHearth() {
    if (!this.hearth) return;
    this.hearth.querySelector(".hearth-go").addEventListener("click", () => this.leaveHearth());
    for (const tab of this.hearth.querySelectorAll("[data-tab]")) {
      tab.addEventListener("click", () => {
        this.hearthTab = tab.dataset.tab;
        this.renderHearth();
      });
    }
    if (!this.game.night) {
      this.start.hidden = true;
      this.openHearth();
    }
  }

  openHearth() {
    this.atHearth = true;
    this.hearth.hidden = false;
    this.renderHearth();
  }

  leaveHearth() {
    if (!this.atHearth) return;
    this.atHearth = false;
    this.hearth.hidden = true;
    this.audio?.start();
    window.focus();
    this.render();
  }

  buyDecor(id) {
    if (!buy(this.meta, id)) return;
    saveMeta(this.meta);
    this.audio?.start();
    this.audio?.play([{ type: "relic" }]);
    this.renderHearth();
  }

  renderHearth() {
    if (!this.hearth || this.hearth.hidden) return;
    const { meta } = this;
    const scene = hearthScene(meta.decor, { cat: meta.hasCat || !!this.game.player.hasCat });
    this.hearth.querySelector(".hearth-scene").innerHTML = scene
      .map((row) => row.map(([g, cls]) => (cls ? `<span class="h-${cls}">${g}</span>` : g)).join(""))
      .join("\n");
    this.hearth.querySelector("#embers").textContent = meta.embers;

    for (const tab of this.hearth.querySelectorAll("[data-tab]")) {
      tab.setAttribute("aria-selected", String(tab.dataset.tab === this.hearthTab));
    }
    for (const panel of this.hearth.querySelectorAll("[data-panel]")) panel.hidden = panel.dataset.panel !== this.hearthTab;

    this.hearth.querySelector(".decor-list").replaceChildren(
      ...DECOR_IDS.map((id, i) => {
        const li = document.createElement("li");
        const owned = meta.decor.includes(id);
        li.className = owned ? "owned" : canBuy(meta, id) ? "affordable" : "";
        li.innerHTML = `<kbd></kbd><span class="d-name"></span><span class="d-blurb"></span><span class="d-cost"></span>`;
        li.querySelector("kbd").textContent = i + 1;
        li.querySelector(".d-name").textContent = DECOR[id].name;
        li.querySelector(".d-blurb").textContent = DECOR[id].blurb;
        li.querySelector(".d-cost").textContent = owned ? "home" : `${DECOR[id].cost} ✹`;
        li.addEventListener("click", () => this.buyDecor(id));
        return li;
      }),
    );

    const found = KEEPSAKE_IDS.filter((id) => meta.keepsakes.includes(id));
    const missing = KEEPSAKE_IDS.length - found.length;
    const shelf = found.map((id) =>
      Object.assign(document.createElement("li"), {
        className: "found",
        textContent: `✦ ${KEEPSAKES[id].name}. ${KEEPSAKES[id].story}`,
      }),
    );
    if (missing > 0) {
      const text = found.length === 0 ? `✧ The shelf is bare. ${missing} keepsakes are waiting somewhere in the dark.` : `✧ ${missing} more still somewhere in the dark.`;
      shelf.push(Object.assign(document.createElement("li"), { textContent: text }));
    }
    this.hearth.querySelector(".shelf-list").replaceChildren(...shelf);

    const entries = meta.journal.filter((t) => JOURNAL[t]);
    this.hearth.querySelector(".journal-list").replaceChildren(
      ...(entries.length
        ? entries.map((t) => {
            const li = document.createElement("li");
            li.innerHTML = `<b></b> <span></span>`;
            li.querySelector("b").textContent = JOURNAL[t].title;
            li.querySelector("span").textContent = JOURNAL[t].note;
            return li;
          })
        : [Object.assign(document.createElement("li"), { textContent: "Empty pages, for now. Creatures you meet are written here." })]),
    );

    const go = this.hearth.querySelector(".hearth-go span");
    go.textContent = this.game.depth > 1 || this.game.turn > 0 ? `Back down to depth ${this.game.depth}` : "Down into the caves";
  }

  // Keys at the Hearth: numbers buy decorations, c/s/j switch tabs, Enter heads back down.
  hearthKey(event) {
    if (event.key === "Enter" || event.key === " " || event.key === "Escape") return this.leaveHearth();
    const n = Number(event.key);
    if (n >= 1 && n <= DECOR_IDS.length) this.buyDecor(DECOR_IDS[n - 1]);
    const tabs = { c: "camp", s: "shelf", j: "journal" };
    if (tabs[event.key]) {
      this.hearthTab = tabs[event.key];
      this.renderHearth();
    }
  }

  // Banks embers, keepsakes and journal entries as they're earned.
  bank(effects) {
    let changed = false;
    for (const e of effects) {
      if (e.type === "ember") {
        this.meta.embers += e.amount;
        changed = true;
      } else if (e.type === "keepsake") {
        if (!this.meta.keepsakes.includes(e.id)) this.meta.keepsakes.push(e.id);
        changed = true;
      } else if (e.type === "befriend" && e.kind === "cat") {
        this.meta.hasCat = true;
        if (!this.meta.journal.includes("cat")) this.meta.journal.push("cat");
        changed = true;
      } else if (e.type === "discover" && !this.meta.journal.includes(e.kind)) {
        this.meta.journal.push(e.kind);
        changed = true;
      }
    }
    if (changed) saveMeta(this.meta);
  }

  // On-screen D-pad and action buttons, plus swiping on the map.
  setupTouch() {
    const pad = this.root.querySelector("#pad");
    if (!pad) return;
    if (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window) {
      document.body.classList.add("touch");
    }
    let timer = null;
    const stop = () => {
      clearTimeout(timer);
      clearInterval(timer);
      timer = null;
    };
    for (const button of pad.querySelectorAll("[data-act]")) {
      const action = button.dataset.act;
      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        document.body.classList.add("touch");
        if (this.begin()) return;
        this.act(action);
        stop();
        if (action in DIRECTIONS && this.game.state === "playing") {
          timer = setTimeout(() => {
            timer = setInterval(() => {
              if (this.game.state === "playing") this.act(action);
              else stop();
            }, REPEAT_EVERY);
          }, REPEAT_DELAY);
        }
      });
      for (const end of ["pointerup", "pointerleave", "pointercancel"]) button.addEventListener(end, stop);
      // Keyboard users can still press the buttons with Enter or Space.
      button.addEventListener("click", (event) => {
        if (event.detail === 0) this.act(action);
      });
    }

    let origin = null;
    this.mapWrap.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse") origin = { x: event.clientX, y: event.clientY };
    });
    this.mapWrap.addEventListener("pointerup", (event) => {
      if (!origin || event.target.closest("#start, #overlay, #draft")) return (origin = null);
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      origin = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE) return;
      if (Math.abs(dx) > Math.abs(dy)) this.act(dx > 0 ? "right" : "left");
      else this.act(dy > 0 ? "down" : "up");
    });
    this.pad = pad;
  }

  renderMute() {
    const muted = this.audio?.muted ?? true;
    this.muteButton.textContent = muted ? "sound off" : "sound on";
    this.muteButton.setAttribute("aria-pressed", String(!muted));
  }

  get cellSize() {
    return this.map.offsetWidth / VIEWPORT.width;
  }

  // One span per map cell, created once and updated in place on every render.
  buildGrid() {
    const { width, height } = VIEWPORT;
    this.map.style.setProperty("--cols", width);
    this.map.style.setProperty("--rows", height);
    this.cells = [];
    const fragment = document.createDocumentFragment();
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        const span = document.createElement("span");
        span.light = -1;
        span.marker = "";
        fragment.appendChild(span);
        row.push(span);
      }
      this.cells.push(row);
    }
    this.map.appendChild(fragment);
  }

  render() {
    const { game } = this;
    const isVisible = (x, y) => game.isVisible(x, y);
    const lightAt = (x, y) => game.lightAt(x, y);
    const rows = renderViewport(game.level, game.player, {
      isVisible,
      lightAt,
      isSensed: (m) => game.isSensed(m),
      isDanger: (x, y) => game.isDanger(x, y),
    });
    const origin = viewportOrigin(game.player);
    rows.forEach((row, y) =>
      row.forEach((cell, x) => {
        const span = this.cells[y][x];
        const className = cellClass(cell);
        if (span.className !== className) span.className = className;
        const glyph = displayGlyph(cell.glyph);
        if (span.textContent !== glyph) span.textContent = glyph;

        const mx = origin.x + x;
        const my = origin.y + y;
        const raw = lightAt(mx, my);
        const light = isVisible(mx, my) ? Math.max(raw, MIN_VISIBLE_LIGHT) : raw;
        if (span.light !== light) {
          span.light = light;
          span.style.setProperty("--l", light);
        }

        const marker = STATE_MARKERS[cell.state] ?? "";
        if (span.marker !== marker) {
          span.marker = marker;
          if (marker) span.dataset.m = marker;
          else delete span.dataset.m;
        }
      }),
    );
    this.mapWrap.style.setProperty("--torch", game.torchRadius / 8);
    this.mapWrap.classList.toggle("doused", !game.player.carryingLight);
    this.mapWrap.classList.toggle("aiming", game.state === "aiming");
    this.pad?.classList.toggle("aiming", game.state === "aiming");
    this.renderAim(origin);
    const biome = `biome-${game.level.biome}`;
    if (this.biomeClass !== biome) {
      if (this.biomeClass) this.mapWrap.classList.remove(this.biomeClass);
      this.mapWrap.classList.add(biome);
      this.biomeClass = biome;
    }

    this.renderHud();
    this.renderLog();
    this.renderEffects();
    this.renderOverlay();
    this.renderRelics();
    this.renderSatchel();
    this.renderDraft();
    this.status.textContent = renderStatus(game);
  }

  renderHud() {
    const { player, depth, turn } = this.game;
    const hp = Math.max(0, player.hp);
    const ratio = hp / player.maxHp;
    this.hpFill.style.setProperty("--hp", ratio);
    this.hpText.textContent = `${hp}/${player.maxHp}`;
    this.hud.classList.toggle("low", ratio <= 0.3 && hp > 0);
    this.fuelFill.style.setProperty("--fuel", player.fuel / player.maxFuel);
    this.fuelText.textContent = !player.hasTorch
      ? "thrown"
      : player.torchBurning
        ? `r${this.game.torchRadius}`
        : player.fuel > 0
          ? "out"
          : "dead";
    this.hud.classList.toggle("fuel-low", player.fuel <= 100);
    this.potions.textContent = player.potions;
    this.potions.parentElement.classList.toggle("empty", player.potions === 0);
    this.depth.textContent = depth;
    this.turn.textContent = turn;
    const { lit, total } = this.game.warmth;
    this.warmthEl.textContent = `${lit}/${total}`;
    this.warmthEl.parentElement.classList.toggle("warm", total > 0 && lit === total);
    this.bestEl.textContent = Math.max(this.best, depth);
  }

  renderLog() {
    const { game } = this;
    const messages = recentMessages(game, LOG_LINES);
    const fresh = Math.min(messages.length, game.messageCount - this.last.messageCount);
    this.log.replaceChildren(
      ...messages.map((text, i) => {
        const line = document.createElement("li");
        line.textContent = text;
        line.className = `tone-${messageTone(text)}`;
        line.style.setProperty("--age", messages.length - 1 - i);
        if (i >= messages.length - fresh) line.classList.add("fresh");
        return line;
      }),
    );
  }

  renderEffects() {
    const { game, last } = this;
    const moved = game.depth === last.depth && Math.abs(game.player.x - last.x) + Math.abs(game.player.y - last.y) === 1;
    if (moved) this.glide(game.player.x - last.x, game.player.y - last.y);
    last.x = game.player.x;
    last.y = game.player.y;
    if (game.depth !== last.depth) replay(this.mapWrap, "descend");
    else if (game.player.hp < last.hp) replay(this.mapWrap, "hurt");
    else if (game.player.hp > last.hp && game.state === last.state) replay(this.mapWrap, "heal");
    if (game.depth !== last.depth) replay(this.depth.parentElement, "bump");

    this.mapWrap.classList.toggle("dying", game.player.hp > 0 && game.player.hp <= game.player.maxHp * 0.3);
    last.hp = game.player.hp;
    last.depth = game.depth;
    last.messageCount = game.messageCount;
    last.state = game.state;
  }

  renderRelics() {
    const { relics } = this.game.player;
    if (relics.length === this.relicCount) return;
    this.relicCount = relics.length;
    this.relics.replaceChildren(
      ...relics.map((id, i) => {
        const chip = document.createElement("span");
        chip.className = "relic";
        chip.textContent = RELICS[id].glyph;
        chip.title = `${RELICS[id].name}: ${RELICS[id].text}`;
        if (i === relics.length - 1) chip.classList.add("new");
        return chip;
      }),
    );
  }

  renderSatchel() {
    const p = this.game.player;
    const parts = [
      [p.crusts, "%", "crust"],
      [p.coins, "$", "coin"],
      [p.mushrooms, "♠", "cap"],
      [p.stews, "◒", "stew"],
    ].filter(([n]) => n > 0);
    const text = parts.map(([n, g, cls]) => `<span class="s-${cls}">${g}</span>${n}`).join(" ");
    const cat = this.game.cat?.follows ? '<span class="s-cat">c</span> with you' : "";
    const html = [text, cat].filter(Boolean).join(" · ");
    if (this.satchel.innerHTML !== html) this.satchel.innerHTML = html;
  }

  renderDraft() {
    const { game } = this;
    const open = game.state === "draft";
    if (open === !this.draft.hidden) return;
    this.draft.hidden = !open;
    if (!open) return;
    this.draft.querySelector(".cards").replaceChildren(
      ...game.draft.map((id, i) => {
        const card = document.createElement("div");
        card.className = "card";
        card.style.setProperty("--i", i);
        const relic = RELICS[id];
        card.innerHTML = `<kbd></kbd><span class="card-glyph"></span><h3></h3><p></p>`;
        card.querySelector("kbd").textContent = i + 1;
        card.querySelector(".card-glyph").textContent = relic.glyph;
        card.querySelector("h3").textContent = relic.name;
        card.querySelector("p").textContent = relic.text;
        card.addEventListener("click", () => this.act(`choose${i + 1}`));
        return card;
      }),
    );
  }

  renderOverlay() {
    const { state } = this.game;
    const over = state === "dead" || state === "won" || state === "resting";
    const dead = state === "dead";
    this.root.classList.toggle("dead", dead);
    this.overlay.classList.toggle("won", state === "won");
    this.overlay.classList.toggle("resting", state === "resting");
    if (over === !this.overlay.hidden) return;
    this.overlay.hidden = !over;
    if (!over) return;
    this.overlay.querySelector(".rip").textContent = { dead: "✝", won: "☼", resting: "☾" }[state];
    this.overlay.querySelector(".again").lastChild.textContent = {
      dead: " to rise again",
      won: " to descend once more",
      resting: " to wake",
    }[state];
    const { title, line } = epitaph(this.game);
    this.overlay.querySelector(".epitaph-title").textContent = title;
    this.overlay.querySelector(".epitaph-line").textContent = line;
    this.overlay.querySelector(".epitaph-best").textContent = this.newBest
      ? `A new record: depth ${this.game.depth}.`
      : `Deepest so far: depth ${this.best}.`;
  }

  // While aiming, shows where the torch would fly in each direction.
  renderAim(origin) {
    for (const span of this.aimed ?? []) span.classList.remove("aim", "aim-land");
    this.aimed = [];
    if (this.game.state !== "aiming") return;
    for (const [dx, dy] of Object.values(DIRECTIONS)) {
      const path = this.game.throwPath(dx, dy);
      path.forEach(({ x, y }, i) => {
        const span = this.cells[y - origin.y]?.[x - origin.x];
        if (!span) return;
        span.classList.add(i === path.length - 1 ? "aim-land" : "aim");
        this.aimed.push(span);
      });
    }
  }

  // The torch arcs along its path, tile by tile.
  flyTorch(path, origin, size) {
    const el = document.createElement("span");
    el.className = "flying-torch";
    el.textContent = "/";
    const px = ({ x, y }) => `translate(${(x - origin.x + 0.5) * size}px, ${(y - origin.y + 0.5) * size}px)`;
    const start = { x: this.game.player.x, y: this.game.player.y };
    const frames = [start, ...path].map((p, i, all) => ({
      transform: `${px(p)} rotate(${i * 120}deg) scale(${1 + Math.sin((i / (all.length - 1)) * Math.PI) * 0.6})`,
    }));
    this.map.appendChild(el);
    const flight = el.animate(frames, { duration: 60 * frames.length + 120, easing: "cubic-bezier(0.3, 0.6, 0.4, 1)" });
    flight.onfinish = () => el.remove();
    flight.oncancel = () => el.remove();
  }

  // Slides the map from where the camera was to where it is now, so movement glides.
  glide(dx, dy) {
    const size = this.cellSize;
    this.map.style.transition = "none";
    this.map.style.transform = `translate(${dx * size}px, ${dy * size}px)`;
    void this.map.offsetWidth;
    this.map.style.transition = "";
    this.map.style.transform = "";
  }

  // Floating numbers and spark bursts for this turn's hits and heals.
  spawnEffects(effects) {
    const origin = viewportOrigin(this.game.player);
    const size = this.cellSize;
    const at = (e) => ({ left: (e.x - origin.x + 0.5) * size, top: (e.y - origin.y + 0.5) * size });
    let impact = false;

    for (const e of effects) {
      if (e.type === "hit") {
        const pos = at(e);
        const cls = e.by === "monster" || e.by === "fire" ? "hurt" : e.sneak ? "sneak" : "deal";
        this.floater(pos, e.killed && e.by !== "monster" ? `${e.amount}✝` : `${e.amount}`, cls);
        const blood = e.by === "monster" && this.game.night;
        this.sparks(pos, e.by === "fire" || (e.by === "monster" && !blood) ? "ember" : blood ? "blood" : "spark", e.killed ? 12 : 7);
        if (e.amount >= IMPACT_DAMAGE || e.killed) impact = true;
      } else if ((e.type === "heal" || e.type === "rest") && e.amount > 0) {
        this.floater(at(e), `+${e.amount}`, "heal");
        if (e.type === "rest") this.sparks(at(e), "ember", 4);
      } else if (e.type === "warmed") {
        replay(this.mapWrap, "sigh");
        this.sparks(at(this.game.player), "ember", 30);
      } else if (e.type === "smash") {
        impact = true;
      } else if (e.type === "brazier") {
        this.sparks(at(e), "ember", 16);
      } else if (e.type === "thaw") {
        this.sparks(at(e), "ember", 20);
      } else if (e.type === "pet" || e.type === "befriend") {
        this.floater(at(e), "♥", "heart");
      } else if (e.type === "ember") {
        this.floater(at(this.game.player), `+${e.amount} ✹`, "ember");
      } else if (e.type === "throw") {
        this.flyTorch(e.path, origin, size);
        this.sparks(at(e.path.at(-1)), "ember", 10);
      }
    }
    if (impact) replay(this.mapWrap, "impact");
  }

  floater({ left, top }, text, cls) {
    const el = document.createElement("span");
    el.className = `floater ${cls}`;
    el.textContent = text;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.addEventListener("animationend", () => el.remove());
    this.map.appendChild(el);
  }

  sparks({ left, top }, cls, count) {
    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      el.className = `spark ${cls}`;
      el.textContent = SPARK_GLYPHS[Math.floor(Math.random() * SPARK_GLYPHS.length)];
      const angle = Math.random() * Math.PI * 2;
      const dist = 12 + Math.random() * 26;
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
      el.style.setProperty("--dy", `${Math.sin(angle) * dist - 6}px`);
      el.style.setProperty("--spin", `${Math.random() * 360 - 180}deg`);
      el.addEventListener("animationend", () => el.remove());
      this.map.appendChild(el);
    }
  }

  // Saves the best depth and, at Night, leaves bones for a later run.
  recordRun() {
    const { game } = this;
    this.newBest = recordDepth(this.mode, game.depth);
    if (this.newBest) this.best = game.depth;
    if (this.mode === "night" && game.state === "dead") {
      if (game.bonesFound) clearBones();
      saveBones(game.bonesRecord());
    }
  }

  // Keeps the game saved after every turn. A finished run leaves nothing to resume.
  persist() {
    if (this.mode === "seeded") return;
    const { state } = this.game;
    if (state === "dead" || state === "won") clearSave(this.mode);
    else writeSave(this.mode, serializeGame(this.game));
  }

  act(action) {
    const { game } = this;
    if (this.atHearth) return;
    const ended = (s) => s === "dead" || s === "won" || s === "resting";
    const wasPlaying = !ended(game.state);
    if (!game.playerAction(action)) return;
    if (wasPlaying && ended(game.state)) this.recordRun();
    this.bank(game.effects);
    this.persist();
    if (action === "restart") this.newBest = false;
    this.render();
    this.spawnEffects(game.effects);
    this.audio?.setDepth(game.depth);
    this.audio?.setTorch(game.player.carryingLight ? game.torchRadius : 0);
    this.audio?.play(game.effects);
    // Waking up, or starting over after a win, happens at the Hearth.
    if (!game.night && game.effects.some((e) => e.type === "wake" || e.type === "restart")) this.openHearth();
  }

  begin() {
    if (!this.start || this.start.hidden) return false;
    this.start.hidden = true;
    this.audio?.start();
    window.focus();
    return true;
  }

  bindKeyboard(target = window) {
    target.addEventListener("keydown", (event) => {
      if (this.atHearth) {
        if (!event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          this.hearthKey(event);
        }
        return;
      }
      if (this.begin()) {
        event.preventDefault();
        return;
      }
      this.audio?.start();
      if (event.key === "m" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        this.audio?.toggleMute();
        this.renderMute();
        return;
      }
      const action = actionForKey(event);
      if (!action) return;
      event.preventDefault();
      this.act(action);
    });
  }
}
