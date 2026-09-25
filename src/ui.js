import { actionForKey } from "./input.js";
import { recentMessages, renderStatus, renderViewport, VIEWPORT } from "./render.js";
import { cellClass, displayGlyph, epitaph, lightLevel, messageTone } from "./theme.js";

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
    this.hud = root.querySelector("#hud");
    this.potions = root.querySelector("#potions");
    this.depth = root.querySelector("#depth");
    this.turn = root.querySelector("#turn");

    this.buildGrid();
    this.last = { hp: game.player.hp, depth: game.depth, messageCount: game.messageCount, state: game.state };
  }

  // One span per map cell, created once and updated in place on every render.
  buildGrid() {
    const { width, height } = VIEWPORT;
    this.map.style.setProperty("--cols", width);
    this.map.style.setProperty("--rows", height);
    this.cells = [];
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const fragment = document.createDocumentFragment();
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        const span = document.createElement("span");
        // The player is always at the centre, so each cell's light level is fixed.
        span.style.setProperty("--l", lightLevel(x - cx, y - cy));
        fragment.appendChild(span);
        row.push(span);
      }
      this.cells.push(row);
    }
    this.map.appendChild(fragment);
  }

  render() {
    const { game } = this;
    const rows = renderViewport(game.level, game.player, { isVisible: (x, y) => game.isVisible(x, y) });
    rows.forEach((row, y) =>
      row.forEach((cell, x) => {
        const span = this.cells[y][x];
        const className = cellClass(cell);
        if (span.className !== className) span.className = className;
        const glyph = displayGlyph(cell.glyph);
        if (span.textContent !== glyph) span.textContent = glyph;
      }),
    );

    this.renderHud();
    this.renderLog();
    this.renderEffects();
    this.renderOverlay();
    this.status.textContent = renderStatus(game);
  }

  renderHud() {
    const { player, depth, turn } = this.game;
    const hp = Math.max(0, player.hp);
    const ratio = hp / player.maxHp;
    this.hpFill.style.setProperty("--hp", ratio);
    this.hpText.textContent = `${hp}/${player.maxHp}`;
    this.hud.classList.toggle("low", ratio <= 0.3 && hp > 0);
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
