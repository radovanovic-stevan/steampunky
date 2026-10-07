# Steampunky

A small isometric steampunk town that runs on its own clock. Everything is drawn in code on a
low-resolution canvas and scaled up as pixel art, with no image files and no build step.

## The townsfolk

| Who | Does what |
|---|---|
| Ada Cogsworth, inventor | Works in the workshop and blows it up twice a day |
| Barnaby Bunsworth, baker | Bakes from 5:00, delivers bread at 10:00, runs a market stall |
| Pip Wicklow, lamplighter | Snuffs the street lamps at dawn and lights them again at dusk |
| Odette Quill, postmistress | Two rounds of letters from the pneumatic post office |
| Mabel Steamwright, boiler engineer | Carries coal to the boiler all day |
| Fergus Barrow, tavern keeper | Opens The Rusty Kettle at 16:45 |
| Captain Rook, airship captain | Arrives by airship at 10:00 and leaves at 16:00 |

There's also a steam tram, an hourly bell, a day/night cycle and smoke from every chimney.

## Controls

Drag to pan, scroll or pinch to zoom, and click someone to follow them. The clock runs at
1×, 3× or 10×, or can be paused.

## Files

- `index.html`: page and UI
- `town.js`: map, rendering, lighting and the scripted schedules
- `changelog.json`: the town log, one line per change, shown under the Town log button
- `GROWING.md`: how the town changes on its own every other day
- `tools/check.cjs`: headless check and screenshots (`node tools/check.cjs`)

Each person's day is a list of timed entries in `town.js` (`sched`), where each entry is a list of
steps: walk somewhere, stay a while and say something, do an action, or loop.

## The town grows

A scheduled Claude routine makes one change to the town every other morning, such as a new
building, a newcomer or a new habit, and records it in `changelog.json`. See `GROWING.md`.

## Deploy

`.github/workflows/pages.yml` publishes the repository root to GitHub Pages on every push to `main`.
