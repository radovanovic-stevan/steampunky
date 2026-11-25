# Steampunky

A small isometric steampunk town that runs on its own clock. Everything is drawn in code on a
low-resolution canvas and scaled up as pixel art, with no image files and no build step.

## The townsfolk

| Who | Does what |
|---|---|
| Ada Cogsworth, inventor | Works in the workshop, blows it up twice a day, and flies her new ornithopter over the fountain at 13:00 |
| Barnaby Bunsworth, baker | Bakes from 5:00, brings hot buns to the tea kiosk at 7:30, checks the square's sundial at 9:00, delivers bread at 10:00, runs a market stall |
| Pip Wicklow, lamplighter | Snuffs the street lamps at dawn, waters the new vegetable patch on the west street at 7:50, and lights the lamps again at dusk |
| Odette Quill, postmistress | Two rounds of letters from the pneumatic post office, feeds the pigeons with Pip at half past one, and taps out the evening telegram at the telegraph pole at half past four |
| Mabel Steamwright, boiler engineer | Carries coal to the boiler all day, calibrates gauges in her shed at half past two, and lets the new water tower down into the boiler at 17:10 |
| Fergus Barrow, tavern keeper | Checks the cask delivery at the docks at 9:30 and stacks the casks in his new cask store, pins the evening menu on the square's noticeboard at 15:45, then opens The Rusty Kettle at 16:45 |
| Tilly Fenwick, tea seller | Runs the tea kiosk, takes in Barnaby's morning buns, does a tea round at 10:30 and serves the bench at noon, and pours Captain Rook his afternoon tea |
| Ignatius Thimble, clockmaker | Opens his clock shop at 8:00, checks the sundial at 8:50, winds the clocktower at 9:30 and oils its hands at 15:00 |
| Hettie Inkwell, printer | Prints the Steampunky Gazette at the Inkwell Print Shop from 6:00, collects the wires at the post office, sells papers by the fountain at 9:20, and takes down Odette's evening telegram at the telegraph pole |
| Crumpet, bakery cat | Suns on the bakery step at dawn, trails Fergus to the docks for fish scraps at 9:35, begs crumbs at the lunch bench, watches the pigeons, guards Barnaby's market stall and sleeps by the Kettle's hearth in the evening |
| Captain Rook, airship captain | Arrives by airship at 10:00, signs the harbour book at the Harbour Master's Office, and leaves at 16:00 with tea at the kiosk before he goes |

There's also a steam tram, an hourly bell, a day/night cycle and smoke from every chimney.

## Controls

Drag to pan, scroll or pinch to zoom, and click someone to follow them. Buildings turn
see-through when they hide someone (the person you follow most of all) or when you point at
them, and the Walls button lowers every building to its floor so the whole town is visible. The clock runs at
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
