import { actionForKey } from "./input.js";
import { renderViewport } from "./render.js";

// The only module that touches the DOM, apart from the entry point.
export class DomUI {
  constructor(game, root) {
    this.game = game;
    this.map = root.querySelector("#map");
  }

  render() {
    this.map.textContent = renderViewport(this.game.level, this.game.player).join("\n");
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
