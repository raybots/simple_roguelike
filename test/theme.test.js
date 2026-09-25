import assert from "node:assert/strict";
import { test } from "node:test";
import { cellClass, displayGlyph, epitaph, lightLevel, messageTone } from "../src/theme.js";
import { gameFromStrings } from "./helpers/maps.js";

test("light is brightest at the player and fades with distance", () => {
  assert.equal(lightLevel(0, 0), 1);
  assert.ok(lightLevel(3, 0) < lightLevel(1, 0));
  assert.ok(lightLevel(8, 0) > 0.18 && lightLevel(8, 0) < 0.3);
  assert.equal(lightLevel(30, 30), 0.18);
});

test("cells map to theme classes", () => {
  assert.equal(cellClass({ glyph: "#", cls: "vis" }), "wall");
  assert.equal(cellClass({ glyph: ".", cls: "vis" }), "floor");
  assert.equal(cellClass({ glyph: "#", cls: "dim" }), "memory");
  assert.equal(cellClass({ glyph: "g", cls: "mon", kind: "goblin" }), "mon k-goblin");
  assert.equal(cellClass({ glyph: "@", cls: "player" }), "player");
  assert.equal(displayGlyph("."), "·");
  assert.equal(displayGlyph("#"), "#");
});

test("log messages get a tone", () => {
  assert.equal(messageTone("The rat bites you for 1."), "hurt");
  assert.equal(messageTone("You kill the ogre."), "kill");
  assert.equal(messageTone("You hit the bat."), "hit");
  assert.equal(messageTone("You pick up a potion. Press q to drink it."), "potion");
  assert.equal(messageTone("You have no potions."), "plain");
  assert.equal(messageTone("You descend to depth 3."), "depth");
});

test("the epitaph names the killer", () => {
  const { game, player, monsters } = gameFromStrings(["@g."]);
  monsters[0].seenPlayer = true;
  player.hp = 2;
  game.playerAction("wait");
  assert.equal(game.killedBy, "goblin");
  assert.deepEqual(epitaph(game), { title: "Here lies Wick", line: "Slain by a goblin on depth 1, after 1 turn." });
});
