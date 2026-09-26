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

// A game in progress, saved after every turn so closing the tab loses nothing.
export function loadSave(mode) {
  return read(`hearthlight.save.${mode}`, null);
}

export function writeSave(mode, data) {
  write(`hearthlight.save.${mode}`, data);
}

export function clearSave(mode) {
  try {
    localStorage.removeItem(`hearthlight.save.${mode}`);
  } catch {}
}

// What carries over between runs: embers, decorations, keepsakes and journal entries.
export function loadMeta() {
  const meta = read("hearthlight.meta", null) ?? {};
  return {
    embers: meta.embers ?? 0,
    decor: meta.decor ?? [],
    keepsakes: meta.keepsakes ?? [],
    journal: meta.journal ?? [],
  };
}

export function saveMeta(meta) {
  write("hearthlight.meta", meta);
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
