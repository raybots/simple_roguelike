# simple_roguelike

A simple roguelike with a character, enemies and a procedurally generated cave to move about.
Graphics are ASCII characters.

Play it here: https://raybots.github.io/simple_roguelike/

## Controls

| Action | Keys |
| --- | --- |
| Move | Arrow keys, `h` `j` `k` `l`, or `w` `a` `s` `d` |

Walk into a monster to attack it.

## Running locally

The game is plain ES modules with no build step and no dependencies. Browsers won't load
modules from `file://`, so serve the folder over HTTP:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

Add `?seed=12345` to the URL to replay a specific map. The seed of each game is printed
to the browser console.

## Tests

The game logic has no DOM dependencies and is tested with Node's built-in test runner
(Node 22 or newer):

```sh
npm test
```

## Layout

- `src/game.js`: turn engine
- `src/level.js`, `src/levelgen.js`, `src/cavegen.js`: map state and generation
- `src/creature.js`, `src/player.js`, `src/monster.js`: entities and monster AI
- `src/pathfinding.js`, `src/visibility.js`, `src/geometry.js`: breadth-first search, line of sight, Bresenham lines
- `src/render.js`, `src/input.js`: turn game state into text, and keys into actions
- `src/ui.js`, `src/main.js`: the only browser-specific code
