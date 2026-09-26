// Little things found in the caves. They do nothing except sit on the Hearth's shelf,
// each with a story of its own.
export const KEEPSAKES = {
  pebble: { name: "a smooth river pebble", story: "Warm from somewhere, though there's no sun down here." },
  moth: { name: "a moth's wing", story: "Dusty and soft. Moths always find the light." },
  coin: { name: "an old copper coin", story: "Stamped with a sun nobody remembers." },
  letter: { name: "a folded letter", story: "\"Keep the fires lit. I'll be home by winter.\"" },
  acorn: { name: "an acorn", story: "How did this get all the way down here?" },
  feather: { name: "a wren's feather", story: "Brown and speckled, light as a breath." },
  key: { name: "a tiny brass key", story: "It opens nothing you've found. Yet." },
  marble: { name: "a blue glass marble", story: "Hold it up to the fire and it holds a sky." },
  spoon: { name: "a wooden spoon", story: "Worn smooth by a lifetime of stirring soup." },
  bell: { name: "a little bell", story: "It rings softly when you walk, like company." },
  ribbon: { name: "a faded red ribbon", story: "Someone tied it in their hair once, for luck." },
  candle: { name: "a candle stub", story: "Burned down to the last good inch." },
  teacup: { name: "a chipped teacup", story: "Still holds tea. Still worth keeping." },
  button: { name: "a brass button", story: "From a coat that kept someone warm." },
  shell: { name: "a snail shell", story: "The snail moved out a long time ago." },
  drawing: { name: "a child's drawing", story: "A stick figure holding a torch. It looks a bit like you." },
};

export const KEEPSAKE_IDS = Object.keys(KEEPSAKES);

// A keepsake you don't have yet, or null if you've found them all.
export function pickKeepsake(rng, owned) {
  const left = KEEPSAKE_IDS.filter((id) => !owned.includes(id));
  return left.length > 0 ? rng.pick(left) : null;
}
