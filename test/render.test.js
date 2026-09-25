import assert from "node:assert/strict";
import { test } from "node:test";
import { renderViewport } from "../src/render.js";
import { levelFromStrings } from "./helpers/maps.js";

test("the player is drawn at the viewport centre", () => {
  const { level, player } = levelFromStrings(["....", ".@..", "...."]);
  const rows = renderViewport(level, player);
  assert.equal(rows.length, 40);
  assert.equal(rows[20][20], "@");
  for (const row of rows) assert.equal(row.length, 40);
});

test("out-of-bounds cells are drawn as +", () => {
  const { level, player } = levelFromStrings(["@.", ".."]);
  const rows = renderViewport(level, player, { width: 6, height: 6 });
  assert.equal(rows[0], "++++++");
  assert.equal(rows[3], "+++@ +");
});

test("walls, living monsters and corpses have distinct glyphs", () => {
  const { level, player, monsters } = levelFromStrings(["@r#r"]);
  monsters[1].hp = 0;
  const rows = renderViewport(level, player, { width: 4, height: 1 });
  assert.equal(rows[0], "++@r");
  const wide = renderViewport(level, player, { width: 8, height: 1 });
  assert.equal(wide[0], "++++@r#x");
});
