# Growing the town

Steampunky changes a little every other day on its own. A scheduled Claude routine makes one
change, adds a line to `changelog.json`, checks the town still works, and pushes to `main`.
These are the rules for that change.

## One change per run

Pick one thing, small enough to finish properly, and different in kind from the last few
entries in `changelog.json`. Some ideas:

- Build something new: a house, a shop, a greenhouse, a tram depot, a water tower, a warehouse.
- Move someone in. A newcomer needs a home, a role, a look and a full day in `sched`.
- Change someone's day: a new habit, a new job, a friendship (two people meeting at the same
  time and place), a hobby on certain hours.
- Add a prop or a small landmark: a statue, a kiosk, a pigeon coop, a telegraph pole, a well,
  a new street lamp.
- Improve something already there: a sign on a shop, a second chimney, a new airship route.
- Small events that persist: the tavern gets a new name, the bakery adds a new bun.

Things that change the town should stay visible: a reader who opens the page should be able
to spot the change. Don't remove people or buildings, and don't rename existing ids (`id`
values are referenced by schedules).

## Where things live in `town.js`

- `buildings`: each `B({...})` has a tile footprint (`x, y, w, d`), a height `h`, wall colour,
  roof, a door (`face: "y"` on the +y side at offset `u`, or `face: "x"` on the +x side at
  offset `v`), chimneys and optional extras (`gear`, `sign`, `ports`, `plates`, `pipe`,
  `turbine`, `horn`, `tubes`, `clock`, `stack`, `tesla`). The door must open onto a street,
  the plaza or the dock.
- `prop(kind, x, y)`: trees, tanks, cogs, turbines, valves, benches, crates, barrels and so on.
  Every prop blocks its tile. New kinds need a branch in `drawProp`.
- `lampSpots`: street lamps; Pip lights and snuffs them in this order.
- `places` and `placeName`: named spots people can walk to.
- `people`: each person has `home`, `look` and `sched`. A schedule is a list of
  `S("HH:MM", steps, label)` entries in time order; steps are `go(place, { stay, say, carry,
  act, enter })`, `{ wait }`, `{ act }`, `{ lamps }` and `{ loop: true }`.
- The map is `N` x `N` tiles. Streets are the rows `y = 6`, `y = 14` and the columns `x = 7`,
  `x = 15`; the plaza is `x 8-14, y 7-13`; the dock is `x >= 16, y >= 15`. Buildings and props
  may not sit on those tiles.

Match the existing style: the warm brass, copper and soot palette, pixel-art shapes drawn with
`box`, `poly` and `faceQuad`, and short plain sentences in speech bubbles. Update the
townsfolk table in `README.md` when someone moves in or gets a new job.

## Check before pushing

```sh
node tools/check.cjs
```

It loads the page in headless Chromium, runs `window.__town.check()` (overlaps, unreachable
doors and places, schedule order, unknown places), fast-forwards a full day to make sure
everyone moves, checks `changelog.json`, and writes screenshots to `shots/` (ignored by git).
It must print `OK`. Look at the screenshots too: the new thing should be visible and not
clipped, floating or drawn behind something it should be in front of.

## The changelog

Append one entry to the end of `changelog.json`:

```json
{ "date": "2026-10-09", "text": "Barnaby opened a tea kiosk on the corner of the square." }
```

One sentence, past tense, written like a note in a town ledger: what changed, who it involves.
No em dashes, no exclamation marks, no mention of code. The date is the day of the run.
