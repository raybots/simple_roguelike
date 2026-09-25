import { DIRECTIONS } from "./game.js";
import { actionForKey } from "./input.js";
import { recentMessages, renderStatus, renderViewport, VIEWPORT, viewportOrigin } from "./render.js";
import { RELICS } from "./relics.js";
import { bestDepth, clearBones, recordDepth, saveBones } from "./storage.js";
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
  constructor(game, root, { audio = null, mode = "random", daily = false } = {}) {
    this.game = game;
    this.root = root;
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
    this.relics = root.querySelector("#relics");
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
    this.modeLink.addEventListener("click", (event) => {
      event.preventDefault();
      if (location.search) {
        location.assign(location.pathname + (this.daily ? "" : "#daily"));
      } else {
        location.hash = this.daily ? "" : "daily";
        location.reload();
      }
    });

    // The start card: a click or key press gives the page focus and lets sound play.
    this.start = this.root.querySelector("#start");
    this.start?.addEventListener("click", () => this.begin());
    this.overlay.addEventListener("click", () => this.act("restart"));
    this.setupTouch();
    this.muteButton.addEventListener("click", () => {
      this.audio?.start();
      this.audio?.toggleMute();
      this.renderMute();
    });
    this.renderMute();
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
    const over = this.game.state === "dead" || this.game.state === "won";
    const dead = this.game.state === "dead";
    this.root.classList.toggle("dead", dead);
    this.overlay.classList.toggle("won", this.game.state === "won");
    if (over === !this.overlay.hidden) return;
    this.overlay.hidden = !over;
    if (!over) return;
    this.overlay.querySelector(".rip").textContent = dead ? "✝" : "☼";
    this.overlay.querySelector(".again").lastChild.textContent = dead ? " to rise again" : " to descend once more";
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
        this.sparks(pos, e.by === "fire" ? "ember" : e.by === "monster" ? "blood" : "spark", e.killed ? 12 : 7);
        if (e.amount >= IMPACT_DAMAGE || e.killed) impact = true;
      } else if (e.type === "heal" && e.amount > 0) {
        this.floater(at(e), `+${e.amount}`, "heal");
      } else if (e.type === "smash") {
        impact = true;
      } else if (e.type === "brazier") {
        this.sparks(at(e), "ember", 16);
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

  // Saves the best depth and leaves bones for a later run.
  recordRun() {
    const { game } = this;
    this.newBest = recordDepth(this.mode, game.depth);
    if (this.newBest) this.best = game.depth;
    if (this.mode === "random") {
      if (game.bonesFound) clearBones();
      saveBones(game.bonesRecord());
    }
  }

  act(action) {
    const { game } = this;
    const wasPlaying = game.state !== "dead" && game.state !== "won";
    if (!game.playerAction(action)) return;
    if (wasPlaying && (game.state === "dead" || game.state === "won")) this.recordRun();
    if (action === "restart") this.newBest = false;
    this.render();
    this.spawnEffects(game.effects);
    this.audio?.setDepth(game.depth);
    this.audio?.setTorch(game.player.carryingLight ? game.torchRadius : 0);
    this.audio?.play(game.effects);
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
