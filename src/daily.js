// The daily cave: everyone who plays on the same (UTC) day gets the same seed.

// FNV-1a hash of a string to a 32-bit unsigned integer.
export function hashString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function dailySeed(key = todayKey()) {
  return hashString(`simple-roguelike:${key}`);
}
