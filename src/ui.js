import { actionForKey } from "./input.js";
import { plural } from "./game.js";
import { recentMessages, renderStatus, renderViewport } from "./render.js";

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const escapeHtml = (text) => text.replace(/[&<>]/g, (ch) => ESCAPES[ch]);

// Groups neighbouring cells with the same class into one span.
export function rowsToHtml(rows) {
  return rows
    .map((row) => {
      let html = "";
      let run = "";
      let cls = null;
      for (const cell of row) {
        if (cell.cls !== cls) {
          if (run) html += `<span class="${cls}">${escapeHtml(run)}</span>`;
          run = "";
          cls = cell.cls;
        }
        run += cell.glyph;
      }
      if (run) html += `<span class="${cls}">${escapeHtml(run)}</span>`;
      return html;
    })
    .join("\n");
}

// The only module that touches the DOM, apart from the entry point.
export class DomUI {
  constructor(game, root) {
    this.game = game;
    this.status = root.querySelector("#status");
    this.map = root.querySelector("#map");
    this.log = root.querySelector("#log");
    this.overlay = root.querySelector("#overlay");
  }

  render() {
    const { game } = this;
    const rows = renderViewport(game.level, game.player, { isVisible: (x, y) => game.isVisible(x, y) });
    this.map.innerHTML = rowsToHtml(rows);
    this.status.textContent = renderStatus(game);
    this.log.textContent = recentMessages(game, 5).join("\n");

    const dead = game.state === "dead";
    this.overlay.hidden = !dead;
    if (dead) {
      this.overlay.textContent = `You died on depth ${game.depth} after ${plural(game.turn, "turn")}.\n\nPress Enter to play again.`;
    }
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
