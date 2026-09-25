// Maps KeyboardEvent.key values to game actions.
export const KEY_ACTIONS = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  h: "left",
  l: "right",
  k: "up",
  j: "down",
  a: "left",
  d: "right",
  w: "up",
  s: "down",
  ".": "wait",
  " ": "wait",
  ">": "descend",
  q: "quaff",
  Enter: "restart",
};

// Returns the action for a key event, or null. Keys held with Ctrl, Cmd or Alt are
// ignored so browser shortcuts keep working.
export function actionForKey(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  return KEY_ACTIONS[key] ?? null;
}
