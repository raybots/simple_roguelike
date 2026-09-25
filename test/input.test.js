import assert from "node:assert/strict";
import { test } from "node:test";
import { actionForKey } from "../src/input.js";

const key = (k, mods = {}) => ({ key: k, ctrlKey: false, metaKey: false, altKey: false, ...mods });

test("arrow keys map to directions", () => {
  assert.equal(actionForKey(key("ArrowLeft")), "left");
  assert.equal(actionForKey(key("ArrowRight")), "right");
  assert.equal(actionForKey(key("ArrowUp")), "up");
  assert.equal(actionForKey(key("ArrowDown")), "down");
});

test("vi keys and WASD map to directions, ignoring case", () => {
  assert.equal(actionForKey(key("h")), "left");
  assert.equal(actionForKey(key("j")), "down");
  assert.equal(actionForKey(key("k")), "up");
  assert.equal(actionForKey(key("l")), "right");
  assert.equal(actionForKey(key("W")), "up");
  assert.equal(actionForKey(key("a")), "left");
});

test("modifier combinations and unknown keys are ignored", () => {
  assert.equal(actionForKey(key("w", { ctrlKey: true })), null);
  assert.equal(actionForKey(key("ArrowUp", { metaKey: true })), null);
  assert.equal(actionForKey(key("z")), null);
});

test("wait, descend, quaff and restart keys", () => {
  assert.equal(actionForKey(key(".")), "wait");
  assert.equal(actionForKey(key(" ")), "wait");
  assert.equal(actionForKey(key(">")), "descend");
  assert.equal(actionForKey(key("q")), "quaff");
  assert.equal(actionForKey(key("Enter")), "restart");
});
