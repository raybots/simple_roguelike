import { actionForKey } from "./input.js";
import { recentMessages, renderStatus, renderViewport, VIEWPORT, viewportOrigin } from "./render.js";
import { RELICS } from "./relics.js";
import { cellClass, displayGlyph, epitaph, messageTone, STATE_MARKERS } from "./theme.js";

// Visible tiles never go fully black, even outside any light.
const MIN_VISIBLE_LIGHT = 0.14;

const LOG_LINES = 6;

// Restarts a CSS animation by toggling its class.
function replay(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

// The only module that touches the DOM, apart from the entry point.
export class DomUI {
  constructor(game, root) {
    this.game = game;
    this.root = root;
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
    this.last = { hp: game.player.hp, depth: game.depth, messageCount: game.messageCount, state: game.state };
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
    this.mapWrap.style.setProperty("--torch", game.player.torchRadius / 8);
    this.mapWrap.classList.toggle("doused", !game.player.torchBurning);

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
    this.fuelText.textContent = player.torchBurning ? `r${player.torchRadius}` : player.fuel > 0 ? "out" : "dead";
    this.hud.classList.toggle("fuel-low", player.fuel <= 100);
    this.potions.textContent = player.potions;
    this.potions.parentElement.classList.toggle("empty", player.potions === 0);
    this.depth.textContent = depth;
    this.turn.textContent = turn;
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
        card.addEventListener("click", () => {
          if (game.playerAction(`choose${i + 1}`)) this.render();
        });
        return card;
      }),
    );
  }

  renderOverlay() {
    const dead = this.game.state === "dead";
    this.root.classList.toggle("dead", dead);
    if (dead === !this.overlay.hidden) return;
    this.overlay.hidden = !dead;
    if (!dead) return;
    const { title, line } = epitaph(this.game);
    this.overlay.querySelector(".epitaph-title").textContent = title;
    this.overlay.querySelector(".epitaph-line").textContent = line;
  }

  bindKeyboard(target = window) {
    target.addEventListener("keydown", (event) => {
      const action = actionForKey(event);
      if (!action) return;
      event.preventDefault();
      if (this.game.playerAction(action)) this.render();
    });
  }
}
