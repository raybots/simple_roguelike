# simple_roguelike

A simple roguelike with a character, enemies and a procedurally generated cave to move about.
Graphics are ASCII characters.

You are Wick, a torchbearer. Find the stairs on each level and fight your way down to depth 10, where the Sun Stone waits,
guarded by something that eats light. Take it and you win.

Your torch is everything. It lights what you can see, it burns down as you walk, and its
light shrinks as the fuel runs low. You can also see anything lit by a brazier or a goblin's
torch, and light around corners glows through the dark. Tiles you've explored stay faintly
remembered.

Light cuts both ways. Monsters notice a lit player from far away, but in the dark they only
notice you up close. Unaware monsters take triple damage, so douse your torch and creep up.

Play it here: https://raybots.github.io/simple_roguelike/

## Controls

| Action | Keys |
| --- | --- |
| Move | Arrow keys, `h` `j` `k` `l`, or `w` `a` `s` `d` |
| Attack | Walk into a monster |
| Wait a turn | `.` or Space |
| Go down stairs | `>` |
| Drink a potion | `q` |
| Douse or relight your torch | `t` |
| Pick a relic | `1` `2` `3` |
| Sound on or off | `m` |
| Set the grass next to you alight | `f` |
| Play again after dying | Enter |

## What's in the caves

| Glyph | Thing | Notes |
| --- | --- | --- |
| `@` | You | 30 HP. Potions and HP carry over between levels. |
| `>` | Stairs down | Usually on the far side of the level. |
| `!` | Potion | Picked up automatically. Heals 10 HP. |
| `¤` | Oil | Refuels your torch. |
| `Ω` | Brazier | Bump it to light it for a little fuel. Lights the area for good, and bats won't enter. |
| `r` | Rat | Weak, but remembers you once it has seen you. |
| `b` | Bat | Flits about randomly and forgets you when you're out of sight. |
| `g` | Goblin | Appears from depth 2. Hits for 2. Carries a torch, so you'll see its light first. |
| `O` | Ogre | Appears from depth 4. Lumbers, then raises its club and smashes three tiles next turn. Step out of the red. |
| `:` | Chasm | From depth 2. Jump in to drop a level at once, for 3 damage. |
| `&` | The Lightless | Guards the Sun Stone on depth 10. Every light near it shrinks to an ember. |
| `☼` | Sun Stone | Take it to win. The one light the Lightless can't eat. |
| `"` | Grass | Burns. Fire `^` spreads through it, hurts anything standing in it, and leaves ash `,`. |
| `~` | Water | Slows you down, so monsters get an extra move, and may put your torch out. |
| `♣` | Fungus | Glows faintly, lighting the dark around it. |
| `†` | Bones | A past adventurer's remains, with the potions they never drank. |
| `x` | Corpse | |

Each level past the first rolls a cave type: plain caves, overgrown (grass everywhere, so mind the
fire), flooded, fungal (glowing) or crystal (walls throw your torchlight 3 tiles further).

Monsters have lives of their own. Rats flee from ogres, goblins pick up potions and oil before you
can and drop them when they die, goblin torches can set grass alight, and an ogre's smash hits
whatever stands in the red, friend or foe.

Small marks over a monster show what it knows: `z` asleep, `?` has just noticed you, `!` hunting.

Each time you go deeper, by stairs or by chasm, you pick one of three relics. Relics bend the
rules: kills that heal you, a torch that never shrinks below radius 5, sensing monsters through
walls, fivefold sneak attacks, and more. Hover a relic in the HUD to read it.

When you die past depth 1, your bones stay behind on that depth with your unused potions.
A later run can find them. Your deepest depth is remembered.

**Today's cave:** open the page with `?daily` or `#daily`, or use the link under the map. Everyone who plays
on the same day gets the same cave, and every retry starts it fresh.

All sound is synthesised live in the browser: footsteps, blows, a crackling torch and a drone
that sinks as you go deeper.

Each level has more monsters than the last, and they gain HP every two levels and damage every six.
The numbers live in `src/bestiary.js` and `src/player.js` if you want to rebalance things.

## Running locally

The game is plain ES modules with no build step and no dependencies. Browsers won't load
modules from `file://`, so serve the folder over HTTP:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

Add `?seed=12345` to the URL to replay a specific map. The seed of each game is printed
to the browser console. The running game can be inspected from the console with
`const { game } = await import("./src/main.js")`.

## Tests

The game logic has no DOM dependencies and is tested with Node's built-in test runner
(Node 22 or newer):

```sh
npm test
```

## Layout

- `src/game.js`: turn engine
- `src/level.js`, `src/levelgen.js`, `src/cavegen.js`: map state and generation
- `src/creature.js`, `src/player.js`, `src/monster.js`, `src/bestiary.js`: entities, monster AI and monster stats
- `src/pathfinding.js`, `src/visibility.js`, `src/geometry.js`: breadth-first search, line of sight and field of view, Bresenham lines
- `src/render.js`, `src/input.js`: turn game state into text, and keys into actions
- `src/ui.js`, `src/main.js`: the only browser-specific code
