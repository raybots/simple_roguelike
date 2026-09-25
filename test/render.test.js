import assert from "node:assert/strict";
import { test } from "node:test";
import { recentMessages, renderStatus, renderViewport, rowsToText } from "../src/render.js";
import { rowsToHtml } from "../src/ui.js";
import { gameFromStrings, levelFromStrings } from "./helpers/maps.js";

test("the player is drawn at the viewport centre", () => {
  const { level, player } = levelFromStrings(["....", ".@..", "...."]);
  const rows = rowsToText(renderViewport(level, player));
  assert.equal(rows.length, 40);
  assert.equal(rows[20][20], "@");
  for (const row of rows) assert.equal(row.length, 40);
});

test("terrain, items, stairs, monsters and corpses have distinct glyphs", () => {
  const { level, player, monsters } = levelFromStrings(["@!>#rg"]);
  monsters[0].hp = 0;
  const rows = renderViewport(level, player, { size: { width: 7, height: 1 } });
  assert.equal(rowsToText(rows)[0], "   @!>#");
  const wide = renderViewport(level, player, { size: { width: 13, height: 1 } });
  assert.equal(rowsToText(wide)[0], "      @!>#xg ");
  assert.deepEqual(wide[0].map((c) => c.cls), [
    "dark", "dark", "dark", "dark", "dark", "dark", "player", "item", "stairs", "vis", "corpse", "mon", "dark",
  ]);
});

test("out of view tiles are dark unless explored, and hide monsters", () => {
  const { level, player } = levelFromStrings(["@.r."]);
  level.explored.set(1, 0, true);
  level.explored.set(2, 0, true);
  const isVisible = (x) => x === 0;
  const rows = renderViewport(level, player, { size: { width: 9, height: 1 }, isVisible });
  assert.equal(rowsToText(rows)[0], "    @..  ");
  assert.equal(rows[0][5].cls, "dim");
  assert.equal(rows[0][7].cls, "dark");
});

test("the status line and message log", () => {
  const { game, player } = gameFromStrings(["@."]);
  player.hp = 12;
  player.potions = 3;
  assert.equal(renderStatus(game), "HP 12/30   Potions 3   Depth 1   Turn 0");
  for (let i = 0; i < 8; i++) game.log(`m${i}`);
  assert.deepEqual(recentMessages(game, 3), ["m5", "m6", "m7"]);
});

test("html output groups runs and escapes >", () => {
  const html = rowsToHtml([[
    { glyph: ".", cls: "vis" },
    { glyph: ".", cls: "vis" },
    { glyph: ">", cls: "stairs" },
  ]]);
  assert.equal(html, '<span class="vis">..</span><span class="stairs">&gt;</span>');
});
