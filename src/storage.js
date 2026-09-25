// Small wrappers around localStorage. Storage can be unavailable (private mode,
// blocked cookies), so every call is guarded and the game works without it.

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function bestDepth(mode) {
  return read(`sr.best.${mode}`, 0);
}

// Records a finished run. Returns true if it set a new best.
export function recordDepth(mode, depth) {
  if (depth <= bestDepth(mode)) return false;
  write(`sr.best.${mode}`, depth);
  return true;
}

export function loadBones() {
  return read("sr.bones", null);
}

export function saveBones(bones) {
  if (bones) write("sr.bones", bones);
}

export function clearBones() {
  write("sr.bones", null);
}
