/* Steampunky: an isometric steampunk town with scripted townsfolk.
   Everything is drawn in code on a low-resolution canvas and scaled up without smoothing. */
(() => {
  "use strict";

  // ---------------------------------------------------------------- constants
  const N = 22;                 // map is N x N tiles
  const TW = 16, TH = 8;        // half tile width / height in buffer pixels
  const TOP = 190;              // headroom above the map for towers and the airship
  const BW = N * TW * 2 + 40, BH = TOP + N * TH * 2 + 40;
  const OX = N * TW + 20, OY = TOP;
  const MIN_PER_SEC = 2;        // game minutes per real second at 1x
  const WALK = 0.9;             // tiles per game minute

  const P = (x, y, z = 0) => [OX + (x - y) * TW, OY + (x + y) * TH - z];

  const view = document.getElementById("view");
  const vctx = view.getContext("2d");
  const buf = document.createElement("canvas");
  buf.width = BW; buf.height = BH;
  const ctx = buf.getContext("2d");
  const ground = document.createElement("canvas");
  ground.width = BW; ground.height = BH;
  const dark = document.createElement("canvas");
  dark.width = BW; dark.height = BH;

  // ---------------------------------------------------------------- helpers
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) ^ 0x5bd1e995; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => clamp(Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f), 0, 255));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const c = [16, 8, 0].map((s) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, t)));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function poly(c, pts, fill, stroke) {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); }
  }
  const fmt = (m) => { m = ((Math.floor(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
  const hm = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
  const OUTLINE = "rgba(20,12,8,0.55)";

  // ---------------------------------------------------------------- map
  const isStreet = (x, y) => y === 6 || y === 14 || x === 7 || x === 15;
  const isPlaza = (x, y) => x >= 8 && x <= 14 && y >= 7 && y <= 13;
  const isDock = (x, y) => x >= 16 && y >= 15;

  const B = (o) => Object.assign({ occ: 0, chimneys: [], windows: true, lit: false }, o);
  const buildings = [
    B({ id: "workshop", name: "Cogsworth Workshop", x: 1, y: 2, w: 5, d: 4, h: 30, wall: "#8f4b35", roof: { type: "gable", dir: "x", h: 14, color: "#4f8a78" }, door: { face: "y", u: 2.5 }, chim: [[1, 1, 26]], gear: { face: "x", v: 1.4, z: 18, r: 7, teeth: 10, speed: 1.4 }, sign: "gear" }),
    B({ id: "cottageN", name: "Lamplighter's Cottage", x: 8, y: 3, w: 2, d: 3, h: 18, wall: "#8c8577", roof: { type: "gable", dir: "y", h: 10, color: "#3d4250" }, door: { face: "y", u: 0.5 }, chim: [[1.6, 0.6, 16]] }),
    B({ id: "clock", name: "Clocktower", x: 10, y: 3, w: 3, d: 3, h: 74, wall: "#9b8f78", roof: { type: "spire", h: 34, color: "#4f8a78" }, door: { face: "y", u: 1.5 }, clock: true, windows: "tower" }),
    B({ id: "boiler", name: "Boiler House", x: 16, y: 1, w: 4, d: 5, h: 34, wall: "#6f3a2a", roof: { type: "gable", dir: "y", h: 12, color: "#3d4250" }, door: { face: "y", u: 1.5 }, stack: { u: 1.2, v: 1.2, h: 92 }, gear: { face: "y", u: 3.1, z: 20, r: 9, teeth: 12, speed: -0.9 }, gauge: true }),
    B({ id: "cottageNE", name: "Engineer's Cottage", x: 20, y: 3, w: 2, d: 3, h: 18, wall: "#7a5a3c", roof: { type: "gable", dir: "y", h: 10, color: "#b06a3b" }, door: { face: "y", u: 0.5 }, chim: [[1.5, 0.7, 16]] }),
    B({ id: "bakery", name: "Bunsworth Bakery", x: 3, y: 7, w: 4, d: 3, h: 22, wall: "#c9a27a", roof: { type: "gable", dir: "x", h: 12, color: "#8f4b35" }, door: { face: "x", v: 1.5 }, chim: [[0.8, 1.2, 18]], sign: "loaf" }),
    B({ id: "house1", name: "Cogsworth House", x: 1, y: 11, w: 3, d: 3, h: 20, wall: "#8f6b4a", roof: { type: "gable", dir: "x", h: 12, color: "#3d4250" }, door: { face: "y", u: 1.5 }, chim: [[2.4, 0.8, 16]] }),
    B({ id: "post", name: "Pneumatic Post Office", x: 16, y: 10, w: 4, d: 4, h: 26, wall: "#5d6b78", roof: { type: "flat", h: 4, color: "#4a4f5a" }, door: { face: "y", u: 1.5 }, tubes: true, sign: "letter" }),
    B({ id: "house2", name: "Bunsworth House", x: 4, y: 16, w: 3, d: 3, h: 20, wall: "#b07a52", roof: { type: "gable", dir: "y", h: 12, color: "#8f4b35" }, door: { face: "x", v: 1.5 }, chim: [[0.8, 2.2, 16]] }),
    B({ id: "house3", name: "Postmistress's House", x: 4, y: 19, w: 3, d: 3, h: 20, wall: "#7d8a8f", roof: { type: "gable", dir: "y", h: 12, color: "#3d4250" }, door: { face: "x", v: 1.5 }, chim: [[0.8, 0.8, 16]] }),
    B({ id: "tavern", name: "The Rusty Kettle", x: 10, y: 16, w: 5, d: 4, h: 28, wall: "#6b4e32", roof: { type: "gable", dir: "x", h: 14, color: "#8f4b35" }, door: { face: "x", v: 1.5 }, chim: [[1.2, 1.2, 24], [3.6, 2.8, 24]], sign: "mug" }),
  ];
  const byId = Object.fromEntries(buildings.map((b) => [b.id, b]));
  for (const b of buildings) {
    b.doorTile = b.door.face === "y" ? [b.x + Math.floor(b.door.u), b.y + b.d] : [b.x + b.w, b.y + Math.floor(b.door.v)];
    b.chimneys = (b.chim || []).map(([u, v, top]) => ({ x: b.x + u, y: b.y + v, z: b.h + top }));
    if (b.stack) b.chimneys.push({ x: b.x + b.stack.u + 0.4, y: b.y + b.stack.v + 0.4, z: b.stack.h + 2, big: true });
  }

  // small props: trees, lamps, fountain, etc. Each blocks its tile.
  const props = [];
  const prop = (kind, x, y, extra) => props.push(Object.assign({ kind, x, y }, extra));
  [[9, 8], [13, 8], [9, 12], [13, 12], [17, 8], [19, 8], [1, 17], [2, 20], [8, 20], [12, 21], [8, 17], [0, 1], [21, 8]].forEach(([x, y]) => prop("tree", x, y, { s: 0.85 + hash(x, y) * 0.35 }));
  prop("fountain", 11, 10);
  prop("bench", 11, 8); prop("bench", 11, 12);
  prop("coal", 21, 13);
  prop("mast", 19, 18);
  prop("crates", 21, 21); prop("crates", 16, 21); prop("barrels", 14, 20); prop("barrels", 21, 16);
  prop("mailbox", 20, 13);
  const lampSpots = [[6, 5], [14, 5], [6, 13], [8, 7], [14, 7], [8, 13], [14, 13], [6, 15], [14, 15], [16, 15], [20, 15], [21, 5]];
  const lamps = [];
  lampSpots.forEach(([x, y]) => { const p = { kind: "lamp", x, y, lit: false }; props.push(p); lamps.push(p); });

  // occupancy and walkability
  const blocked = Array.from({ length: N }, () => Array(N).fill(false));
  for (const b of buildings) for (let i = b.x; i < b.x + b.w; i++) for (let j = b.y; j < b.y + b.d; j++) blocked[j][i] = true;
  for (const p of props) blocked[p.y][p.x] = true;
  const walk = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => !blocked[y][x] && (isStreet(x, y) || isPlaza(x, y) || isDock(x, y))));
  for (const b of buildings) { const [x, y] = b.doorTile; walk[y][x] = true; }
  const nearWalk = (x, y) => [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([a, b]) => [x + a, y + b]).find(([a, b]) => a >= 0 && b >= 0 && a < N && b < N && walk[b][a]);
  lamps.forEach((l) => (l.stand = nearWalk(l.x, l.y)));

  function bfs(sx, sy, tx, ty) {
    if (sx === tx && sy === ty) return [];
    const prev = new Map(), key = (x, y) => y * N + x, q = [[sx, sy]];
    prev.set(key(sx, sy), null);
    while (q.length) {
      const [x, y] = q.shift();
      if (x === tx && y === ty) break;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N || !walk[ny][nx] || prev.has(key(nx, ny))) continue;
        prev.set(key(nx, ny), [x, y]); q.push([nx, ny]);
      }
    }
    if (!prev.has(key(tx, ty))) return null;
    const path = [];
    for (let c = [tx, ty]; c && !(c[0] === sx && c[1] === sy); c = prev.get(key(c[0], c[1]))) path.unshift(c);
    return path;
  }

  // named places people walk to
  const places = {
    coal: [21, 14], yard: [4, 6], fountain: [10, 10], benchN: [11, 9], benchS: [11, 11], pigeons: [12, 10],
    mast: [18, 18], dock: [17, 17], market: [10, 11], crates: [20, 20],
  };
  const placeTile = (id) => (byId[id] ? byId[id].doorTile : id === "airship" ? places.mast : places[id]);
  const placeName = (id) => (byId[id] ? byId[id].name : { coal: "the coal pile", yard: "the workshop yard", fountain: "the fountain", benchN: "the bench", benchS: "the bench", pigeons: "the square", mast: "the mooring mast", dock: "the docks", market: "the square", crates: "the crates", airship: "the airship" }[id] || id);

  // ---------------------------------------------------------------- townsfolk
  const S = (at, steps, label) => ({ at: hm(at), steps, label });
  const go = (to, extra) => Object.assign({ go: to }, extra);
  const people = [
    {
      id: "ada", name: "Ada Cogsworth", role: "Inventor", home: "house1",
      look: { coat: "#3f6e8c", trim: "#d9a441", skin: "#f0c9a0", hair: "#5a2e1a", hat: "goggles" },
      sched: [
        S("07:15", [go("bakery", { stay: 12, say: "One cog-shaped bun, please" }), go("workshop")], "Breakfast, then the workshop"),
        S("11:00", [{ act: "boom" }, { wait: 2 }, go("yard", { stay: 18, say: "*cough* Nearly had it!" }), go("workshop")], "Testing the steam engine"),
        S("13:00", [go("fountain", { stay: 45, say: "Sketching ornithopters" }), go("workshop")], "Lunch at the fountain"),
        S("16:20", [{ act: "boom", big: true }, { wait: 2 }, go("yard", { stay: 15, say: "EUREKA! ...wait, no." }), go("workshop")], "Another experiment"),
        S("19:00", [go("tavern")], "Evening at the tavern"),
        S("22:30", [go("house1")], "Home to sleep"),
      ],
    },
    {
      id: "barnaby", name: "Barnaby Bunsworth", role: "Baker", home: "house2",
      look: { coat: "#e8e0d0", trim: "#c9a27a", skin: "#e8b48a", hair: "#3b2a1e", hat: "chef" },
      sched: [
        S("05:00", [go("bakery")], "Firing up the ovens"),
        S("10:00", [go("house1", { stay: 3, say: "Fresh bread!", carry: "bread" }), go("cottageN", { stay: 3, say: "Loaf for the lamplighter" }), go("tavern", { stay: 4, say: "Twelve loaves for the Kettle" }), go("house3", { stay: 3, say: "Fresh bread!" }), go("bakery", { carry: null })], "Delivering bread"),
        S("15:00", [go("market", { stay: 40, say: "Selling the last buns" }), go("bakery")], "Market stall"),
        S("18:00", [go("house2")], "Home for supper"),
      ],
    },
    {
      id: "pip", name: "Pip Wicklow", role: "Lamplighter", home: "cottageN",
      look: { coat: "#2e3a2e", trim: "#b06a3b", skin: "#f0c9a0", hair: "#c2502a", hat: "cap" },
      sched: [
        S("05:30", [{ lamps: "snuff" }, go("cottageN")], "Snuffing the street lamps"),
        S("13:30", [go("pigeons", { stay: 50, say: "Feeding the pigeons" }), go("clock"), { wait: 40 }, go("cottageN")], "Pigeons, then winding the clock"),
        S("18:40", [{ lamps: "light", carry: "pole" }, go("tavern", { carry: null })], "Lighting the street lamps"),
        S("22:45", [go("cottageN")], "Home to sleep"),
      ],
    },
    {
      id: "odette", name: "Odette Quill", role: "Postmistress", home: "house3",
      look: { coat: "#7a2f3a", trim: "#d9a441", skin: "#c99a74", hair: "#1e1410", hat: "bonnet" },
      sched: [
        S("08:30", [go("post")], "Sorting the morning tubes"),
        S("10:30", [go("house1", { stay: 3, say: "Letter for Miss Cogsworth!", carry: "letter" }), go("clock", { stay: 3, say: "Telegram for the tower" }), go("boiler", { stay: 3, say: "Parcel of rivets" }), go("cottageNE", { stay: 3, say: "Letter for you!" }), go("tavern", { stay: 3, say: "Bills, I'm afraid" }), go("house2", { stay: 3, say: "Letter for you!" }), go("post", { carry: null }), { loop: true }], "Delivering the post"),
        S("12:30", [go("benchS", { stay: 40, say: "A quiet sandwich" }), go("post")], "Lunch on the bench"),
        S("14:00", [go("cottageN", { stay: 3, say: "Letter for Pip!", carry: "letter" }), go("bakery", { stay: 3, say: "Flour invoice" }), go("workshop", { stay: 3, say: "Strange parcel. It's ticking." }), go("post", { carry: null }), { loop: true }], "Afternoon round"),
        S("17:30", [go("house3")], "Home for the evening"),
      ],
    },
    {
      id: "mabel", name: "Mabel Steamwright", role: "Boiler engineer", home: "cottageNE",
      look: { coat: "#5a4632", trim: "#c9a54a", skin: "#d9a882", hair: "#7a4a22", hat: "goggles" },
      sched: [
        S("06:00", [go("boiler")], "Opening the pressure valves"),
        S("07:00", [go("coal", { stay: 4, say: "Shovelling coal", carry: "coal" }), go("boiler", { stay: 4, say: "Stoking the boiler", act: "stoke", carry: null, enter: false }), { loop: true }], "Keeping the boiler fed"),
        S("12:00", [go("benchN", { stay: 50, say: "Lunch break" }), go("boiler")], "Lunch break"),
        S("13:15", [go("coal", { stay: 4, say: "Shovelling coal", carry: "coal" }), go("boiler", { stay: 4, say: "Stoking the boiler", act: "stoke", carry: null, enter: false }), { loop: true }], "Keeping the boiler fed"),
        S("18:00", [go("tavern")], "A pint at the Kettle"),
        S("21:30", [go("cottageNE")], "Home to sleep"),
      ],
    },
    {
      id: "fergus", name: "Fergus Barrow", role: "Tavern keeper", home: "tavern",
      look: { coat: "#3b5a3a", trim: "#e8e0d0", skin: "#e8b48a", hair: "#b8b0a0", hat: "none", beard: true },
      sched: [
        S("01:00", [{ act: "close" }, go("tavern")], "Closing up and sleeping"),
        S("09:30", [go("bakery", { stay: 6, say: "Morning, Barnaby!" }), go("dock", { stay: 10, say: "Checking the cask delivery" }), go("tavern")], "Buying bread and casks"),
        S("16:45", [go("tavern"), { act: "open" }, go("crates", { stay: 5, say: "The Rusty Kettle is open!" }), go("tavern")], "Opening the tavern"),
      ],
    },
    {
      id: "rook", name: "Captain Rook", role: "Airship captain", home: "airship",
      look: { coat: "#2b3550", trim: "#d9a441", skin: "#c99a74", hair: "#2a2a2a", hat: "tophat", beard: true },
      sched: [
        S("00:00", [go("airship")], "Away on the airship"),
        S("10:10", [go("dock", { stay: 6, say: "Ahoy, Steampunky!" }), go("post", { stay: 10, say: "Air mail, three sacks", carry: "sack" }), go("tavern", { carry: null })], "Unloading the air mail"),
        S("13:00", [go("fountain", { stay: 30, say: "Lovely weather for flying" }), go("clock", { stay: 4, say: "Setting my pocket watch" }), go("tavern")], "A stroll around town"),
        S("15:20", [go("airship")], "Back aboard the airship"),
      ],
    },
  ];
  for (const p of people) {
    p.inside = p.home;
    const t = placeTile(p.home);
    p.x = t[0] + 0.5; p.y = t[1] + 0.5;
    p.path = null; p.wait = 0; p.si = 0; p.entry = -1; p.say = ""; p.bubble = null; p.carry = null; p.face = 1; p.step = 0;
  }

  // ---------------------------------------------------------------- world state
  const state = { min: 7 * 60 + 40, speed: 1, stoke: 0, tavernOpen: false, followId: null, hoverId: null, selId: null, lastHour: -1 };
  const particles = [];
  const floaters = []; // world-anchored text bubbles (BOOM!, bell)

  function entryIndex(p, m) {
    let idx = p.sched.length - 1;
    for (let i = 0; i < p.sched.length; i++) if (p.sched[i].at <= m) idx = i;
    return idx;
  }
  function expand(steps) {
    const out = [];
    for (const s of steps) {
      if (s.lamps) {
        const order = s.lamps === "light" ? lamps : [...lamps].reverse();
        order.forEach((l, i) => out.push({ go: l.stand, lamp: l, act: s.lamps, stay: 2, say: s.lamps === "light" ? "Let there be light" : "Lamp out", carry: i === 0 ? (s.carry === undefined ? "pole" : s.carry) : undefined, enter: false }));
      } else out.push(s);
    }
    return out;
  }
  function startEntry(p, idx) {
    p.entry = idx;
    p.plan = expand(p.sched[idx].steps);
    p.si = 0; p.path = null; p.wait = 0;
    p.doing = p.sched[idx].label;
  }
  function exitBuilding(p) {
    if (!p.inside) return;
    const t = placeTile(p.inside);
    p.x = t[0] + 0.5; p.y = t[1] + 0.5;
    p.inside = null;
  }
  function say(p, text) { if (text) p.bubble = { text, t: performance.now() }; }

  function act(p, s) {
    if (s.act === "light" && s.lamp) s.lamp.lit = true;
    if (s.act === "snuff" && s.lamp) s.lamp.lit = false;
    if (s.act === "stoke") { state.stoke = 1; puff(byId.boiler.chimneys.find((c) => c.big), 14, "#cfcac0"); }
    if (s.act === "open") state.tavernOpen = true;
    if (s.act === "close") state.tavernOpen = false;
    if (s.act === "boom") boom(s.big);
  }

  function updatePerson(p, dt) {
    const m = state.min % 1440;
    const idx = entryIndex(p, m);
    if (idx !== p.entry) startEntry(p, idx);
    let budget = dt;
    for (let guard = 0; guard < 8 && budget > 0; guard++) {
      if (p.wait > 0) { const used = Math.min(p.wait, budget); p.wait -= used; budget -= used; if (p.wait > 0) return; continue; }
      const s = p.plan[p.si];
      if (!s) return;
      if (s.loop) { p.si = 0; continue; }
      if (s.act && !s.go) { act(p, s); p.si++; continue; }
      if (s.wait) { p.wait = s.wait; p.si++; continue; }
      if (s.go) {
        const target = Array.isArray(s.go) ? s.go : placeTile(s.go);
        if (s.go === "airship" && p.inside === "airship") { p.si++; continue; }
        if (!p.path) {
          if (p.inside && p.inside === s.go) { p.si++; continue; }
          if (p.inside) exitBuilding(p);
          p.path = bfs(Math.floor(p.x), Math.floor(p.y), target[0], target[1]) || [];
          p.going = Array.isArray(s.go) ? "the next lamp" : placeName(s.go);
          if (s.carry !== undefined) p.carry = s.carry;
        }
        // walk
        while (budget > 0 && p.path.length) {
          const [tx, ty] = p.path[0];
          const dx = tx + 0.5 - p.x, dy = ty + 0.5 - p.y, dist = Math.hypot(dx, dy);
          const stepLen = WALK * budget;
          if (dx || dy) p.face = dx - dy >= 0 ? 1 : -1;
          if (dist <= stepLen) { p.x = tx + 0.5; p.y = ty + 0.5; p.path.shift(); budget -= dist / WALK; }
          else { p.x += (dx / dist) * stepLen; p.y += (dy / dist) * stepLen; budget = 0; }
          p.step += stepLen * 6;
        }
        if (p.path.length) return;
        // arrived
        p.path = null;
        if (s.act) act(p, s);
        const isBuilding = !Array.isArray(s.go) && (byId[s.go] || s.go === "airship");
        if (s.stay !== undefined || s.enter === false || !isBuilding) {
          p.wait = s.stay || 0;
          if (s.say) { say(p, s.say); p.now = s.say; }
        } else {
          p.inside = s.go;
          p.now = null;
        }
        p.si++;
      }
    }
  }

  // ---------------------------------------------------------------- particles
  function puff(c, n = 1, color = "#d8d4cc", spread = 1) {
    if (!c) return;
    const [sx, sy] = P(c.x, c.y, c.z);
    for (let i = 0; i < n; i++) {
      particles.push({ x: sx + (Math.random() - 0.5) * 3 * spread, y: sy, vx: (Math.random() - 0.3) * 4 * spread + 3, vy: -8 - Math.random() * 6 * spread, r: 1.5 + Math.random() * 1.5 * spread, life: 0, max: 2.2 + Math.random() * 1.6, color });
    }
  }
  function boom(big) {
    const c = byId.workshop.chimneys[0];
    const [sx, sy] = P(c.x, c.y, c.z);
    const colors = ["#8a8a8a", "#5c5c5c", "#c9a54a", "#e86a2a", "#9a6abf"];
    for (let i = 0; i < (big ? 70 : 40); i++) {
      const a = Math.random() * Math.PI * 2, sp = 10 + Math.random() * (big ? 34 : 22);
      particles.push({ x: sx, y: sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10, r: 2 + Math.random() * 3, life: 0, max: 1.2 + Math.random() * 1.8, color: colors[i % colors.length], drag: true });
    }
    floaters.push({ x: sx, y: sy - 18, text: big ? "KA-BOOM!" : "BOOM!", t: performance.now(), dur: 2600, boom: true });
  }

  // ---------------------------------------------------------------- time of day
  // light keyframes: minute, darkness alpha, tint
  const LIGHT = [[0, 0.66, "#0b1030"], [300, 0.66, "#0b1030"], [360, 0.32, "#4a2a40"], [420, 0.05, "#ffb070"], [480, 0, "#ffffff"], [1050, 0, "#ffffff"], [1110, 0.12, "#ff9050"], [1170, 0.4, "#3a2050"], [1260, 0.66, "#0b1030"], [1440, 0.66, "#0b1030"]];
  const SKY = [[0, "#0a0d1e", "#151a33"], [300, "#0a0d1e", "#151a33"], [360, "#3a2a4a", "#c26a4a"], [420, "#6a8aa8", "#f0b880"], [540, "#7aa6c4", "#d9e4dc"], [1020, "#7aa6c4", "#d9e4dc"], [1110, "#5a5a8a", "#f08850"], [1170, "#2a2350", "#8a4060"], [1260, "#0a0d1e", "#151a33"], [1440, "#0a0d1e", "#151a33"]];
  function sample(keys, m) {
    for (let i = 0; i < keys.length - 1; i++) {
      if (m >= keys[i][0] && m <= keys[i + 1][0]) {
        const t = (m - keys[i][0]) / (keys[i + 1][0] - keys[i][0] || 1);
        return keys[i].slice(1).map((v, j) => (typeof v === "number" ? lerp(v, keys[i + 1][j + 1], t) : mix(v, keys[i + 1][j + 1], t)));
      }
    }
    return keys[0].slice(1);
  }
  const isNight = (m) => m < 390 || m > 1140;

  // ---------------------------------------------------------------- airship & tram
  function airship(m) {
    const dock = [19.5, 18.5, 76];
    if (m >= 540 && m < 600) { const t = (m - 540) / 60, e = t * t * (3 - 2 * t); return { pos: [lerp(-8, dock[0], e), lerp(6, dock[1], e), lerp(170, dock[2], e)], docked: false, vis: true, dir: 1 }; }
    if (m >= 600 && m < 960) return { pos: dock, docked: true, vis: true, dir: 1 };
    if (m >= 960 && m < 1030) { const t = (m - 960) / 70, e = t * t; return { pos: [lerp(dock[0], 34, e), lerp(dock[1], 4, e), lerp(dock[2], 190, e)], docked: false, vis: true, dir: 1 }; }
    return { vis: false };
  }
  const tram = { x: 2.5, dir: 1, wait: 0 };
  const STOPS = [2.5, 11.5, 19.5];
  function updateTram(dt) {
    const m = state.min % 1440;
    const running = m >= 360 && m < 1380;
    if (!running) { tram.x = Math.max(2.5, tram.x - dt * 0.6); return; }
    if (tram.wait > 0) { tram.wait -= dt; return; }
    const prev = tram.x;
    tram.x += tram.dir * dt * 0.6;
    for (const s of STOPS) {
      if ((prev - s) * (tram.x - s) <= 0 && prev !== s) { tram.x = s; tram.wait = 6; if (s === STOPS[0] || s === STOPS[STOPS.length - 1]) tram.dir = s === STOPS[0] ? 1 : -1; break; }
    }
    if (Math.random() < dt * 0.8) puff({ x: tram.x + 0.4 * tram.dir, y: 14.5, z: 26 }, 1, "#bdb6aa", 0.6);
  }

  // ---------------------------------------------------------------- drawing: ground (cached)
  function tile(c, x, y, fill, edge) {
    poly(c, [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)], fill, edge);
  }
  function drawGround() {
    const c = ground.getContext("2d");
    c.clearRect(0, 0, BW, BH);
    // earth skirt under the map
    poly(c, [P(0, N), P(N, N), P(N, N, -14), P(0, N, -14)], "#3a2b1e");
    poly(c, [P(N, 0), P(N, N), P(N, N, -14), P(N, 0, -14)], "#2c2016");
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const r = hash(x, y);
      let fill;
      if (isStreet(x, y)) fill = mix("#7d7468", "#8f8576", r);
      else if (isPlaza(x, y)) fill = (x + y) % 2 ? mix("#a39782", "#ada08a", r) : mix("#958a76", "#a09480", r);
      else if (isDock(x, y)) fill = mix("#6b4e32", "#77583a", r);
      else fill = mix("#4f6038", "#5c6e40", r);
      tile(c, x, y, fill, "rgba(0,0,0,0.12)");
      const [cx, cy] = P(x + 0.5, y + 0.5);
      if (isStreet(x, y) || isPlaza(x, y)) {
        for (let k = 0; k < 6; k++) {
          const a = hash(x * 7 + k, y * 13 + k), b = hash(y * 5 + k, x * 11 + k);
          c.fillStyle = k % 2 ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.12)";
          c.fillRect(Math.round(cx + (a - 0.5) * 18), Math.round(cy + (b - 0.5) * 8), 2, 1);
        }
      } else if (isDock(x, y)) {
        c.strokeStyle = "rgba(0,0,0,0.25)";
        for (let k = 1; k < 4; k++) { const [a1, b1] = P(x + k / 4, y), [a2, b2] = P(x + k / 4, y + 1); c.beginPath(); c.moveTo(a1, b1); c.lineTo(a2, b2); c.stroke(); }
      } else {
        for (let k = 0; k < 3; k++) {
          const a = hash(x * 3 + k, y * 17 + k), b = hash(y * 3 + k, x * 19 + k);
          c.fillStyle = k ? "rgba(140,170,90,0.5)" : "rgba(30,40,20,0.35)";
          c.fillRect(Math.round(cx + (a - 0.5) * 20), Math.round(cy + (b - 0.5) * 8), 1, 2);
        }
      }
    }
    // tram rails along y = 14
    for (let x = 0; x < N; x++) {
      for (const s of [0.15, 0.55, 0.85]) { const [a, b] = P(x + s, 14.25), [a2, b2] = P(x + s, 14.75); c.strokeStyle = "#4a3a2a"; c.beginPath(); c.moveTo(a, b); c.lineTo(a2, b2); c.stroke(); }
    }
    for (const r of [14.32, 14.68]) { const [a, b] = P(0, r), [a2, b2] = P(N, r); c.strokeStyle = "#b8b0a0"; c.beginPath(); c.moveTo(a, b); c.lineTo(a2, b2); c.stroke(); }
  }

  // ---------------------------------------------------------------- drawing: shapes
  function box(x, y, z, w, d, h, color, o = {}) {
    const top = z + h;
    poly(ctx, [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, top), P(x, y + d, top)], o.left || color, OUTLINE);
    poly(ctx, [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, top), P(x + w, y, top)], o.right || shade(color, 0.72), OUTLINE);
    if (!o.noTop) poly(ctx, [P(x, y, top), P(x + w, y, top), P(x + w, y + d, top), P(x, y + d, top)], o.top || shade(color, 1.15), OUTLINE);
  }
  // quad on a face: face 'y' uses u along x, face 'x' uses v along y
  function faceQuad(b, face, a, z, wd, ht, fill, stroke) {
    if (face === "y") poly(ctx, [P(b.x + a - wd / 2, b.y + b.d, z), P(b.x + a + wd / 2, b.y + b.d, z), P(b.x + a + wd / 2, b.y + b.d, z + ht), P(b.x + a - wd / 2, b.y + b.d, z + ht)], fill, stroke);
    else poly(ctx, [P(b.x + b.w, b.y + a - wd / 2, z), P(b.x + b.w, b.y + a + wd / 2, z), P(b.x + b.w, b.y + a + wd / 2, z + ht), P(b.x + b.w, b.y + a - wd / 2, z + ht)], fill, stroke);
  }
  function gear(cx, cy, r, teeth, ang, color) {
    ctx.beginPath();
    for (let i = 0; i < teeth * 2; i++) {
      const a0 = ang + (i / (teeth * 2)) * Math.PI * 2, a1 = ang + ((i + 1) / (teeth * 2)) * Math.PI * 2;
      const rr = i % 2 ? r * 0.78 : r;
      ctx.lineTo(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr);
      ctx.lineTo(cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = OUTLINE; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2); ctx.fillStyle = shade(color.startsWith("#") ? color : "#c9a54a", 0.5); ctx.fill();
    for (let k = 0; k < 4; k++) { const a = ang + k * Math.PI / 2; ctx.strokeStyle = shade("#c9a54a", 0.7); ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.32, cy + Math.sin(a) * r * 0.32); ctx.lineTo(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7); ctx.stroke(); }
  }

  const lights = []; // filled each frame: {x, y, r, color}
  // people asleep (23:30 to 05:00) keep their windows dark
  const asleep = (m) => m >= 1410 || m < 300;
  function windowColor(b, night, m) {
    if (b.id === "tavern") return state.tavernOpen ? "#ffcf6a" : night ? "#1c2230" : "#5d7a8c";
    if (b.occ > 0 && (b.id === "workshop" || (night && !asleep(m)))) return "#ffd27a";
    return night ? "#1c2230" : "#5d7a8c";
  }
  function drawBuilding(b, m, t) {
    const night = isNight(m);
    const { x, y, w, d, h } = b;
    // foundation
    box(x - 0.05, y - 0.05, 0, w + 0.1, d + 0.1, 3, "#5a5248");
    box(x, y, 3, w, d, h - 3, b.wall, { noTop: b.roof.type !== "flat" });
    // brick courses
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    for (let z = 8; z < h; z += 6) {
      let [a, c] = [P(x, y + d, z), P(x + w, y + d, z)]; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...c); ctx.stroke();
      [a, c] = [P(x + w, y, z), P(x + w, y + d, z)]; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...c); ctx.stroke();
    }
    // windows
    const wc = windowColor(b, night, m);
    const lit = wc === "#ffd27a" || wc === "#ffcf6a";
    const rows = b.windows === "tower" ? [14, 30, 46] : h > 26 ? [9, 20] : [9];
    const doorA = b.door.face === "y" ? b.door.u : b.door.v;
    for (const face of ["y", "x"]) {
      const len = face === "y" ? w : d;
      for (let a = 0.5; a < len; a += 1) {
        for (const z of rows) {
          if (face === b.door.face && Math.abs(a - doorA) < 0.6 && z < 16) continue;
          faceQuad(b, face, a, z, 0.38, 7, wc, OUTLINE);
          faceQuad(b, face, a, z + 3.5, 0.38, 0.6, "rgba(0,0,0,0.35)");
          if (lit) { const [lx, ly] = face === "y" ? P(x + a, y + d, z + 4) : P(x + w, y + a, z + 4); lights.push({ x: lx, y: ly, r: 14, c: "255,200,110", a: 0.6 }); }
        }
      }
    }
    // door
    faceQuad(b, b.door.face, doorA, 3, 0.5, 12, "#3b2618", OUTLINE);
    faceQuad(b, b.door.face, doorA, 13, 0.56, 2, "#c9a54a");
    // signs
    if (b.sign) {
      const [sx, sy] = b.door.face === "y" ? P(x + doorA + 0.55, y + d, 17) : P(x + w, y + doorA + 0.55, 17);
      ctx.fillStyle = "#3b2618"; ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 1, 9, 7);
      ctx.fillStyle = "#c9a54a";
      if (b.sign === "loaf") { ctx.fillRect(sx + 1, sy + 1, 5, 3); ctx.fillStyle = "#e8c890"; ctx.fillRect(sx + 2, sy + 1, 3, 1); }
      if (b.sign === "mug") { ctx.fillRect(sx + 1, sy + 1, 4, 4); ctx.fillRect(sx + 5, sy + 2, 1, 2); ctx.fillStyle = "#f3e6c8"; ctx.fillRect(sx + 1, sy, 4, 1); }
      if (b.sign === "letter") { ctx.fillStyle = "#f3e6c8"; ctx.fillRect(sx + 1, sy + 1, 6, 4); ctx.fillStyle = "#7a2f3a"; ctx.fillRect(sx + 3, sy + 2, 2, 2); }
      if (b.sign === "gear") { const save = ctx.lineWidth; gear(sx + 3.5, sy + 2.5, 3, 6, t, "#c9a54a"); ctx.lineWidth = save; }
    }
    // roof
    const r = b.roof, rc = r.color, rh = r.h;
    if (r.type === "gable" && r.dir === "x") {
      poly(ctx, [P(x - 0.1, y - 0.1, h), P(x + w + 0.1, y - 0.1, h), P(x + w + 0.1, y + d / 2, h + rh), P(x - 0.1, y + d / 2, h + rh)], shade(rc, 0.85), OUTLINE);
      poly(ctx, [P(x - 0.1, y + d + 0.1, h), P(x + w + 0.1, y + d + 0.1, h), P(x + w + 0.1, y + d / 2, h + rh), P(x - 0.1, y + d / 2, h + rh)], rc, OUTLINE);
      poly(ctx, [P(x + w, y, h), P(x + w, y + d, h), P(x + w, y + d / 2, h + rh)], shade(b.wall, 0.72), OUTLINE);
      for (let k = 1; k < 4; k++) { const z = h + (rh * k) / 4, yy = y + d + 0.1 - ((d / 2 + 0.1) * k) / 4; const [a1, b1] = P(x - 0.1, yy, z), [a2, b2] = P(x + w + 0.1, yy, z); ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke(); }
    } else if (r.type === "gable") {
      poly(ctx, [P(x - 0.1, y - 0.1, h), P(x - 0.1, y + d + 0.1, h), P(x + w / 2, y + d + 0.1, h + rh), P(x + w / 2, y - 0.1, h + rh)], shade(rc, 0.85), OUTLINE);
      poly(ctx, [P(x + w + 0.1, y - 0.1, h), P(x + w + 0.1, y + d + 0.1, h), P(x + w / 2, y + d + 0.1, h + rh), P(x + w / 2, y - 0.1, h + rh)], shade(rc, 0.75), OUTLINE);
      poly(ctx, [P(x, y + d, h), P(x + w, y + d, h), P(x + w / 2, y + d, h + rh)], b.wall, OUTLINE);
      for (let k = 1; k < 4; k++) { const z = h + (rh * k) / 4, xx = x + w + 0.1 - ((w / 2 + 0.1) * k) / 4; const [a1, b1] = P(xx, y - 0.1, z), [a2, b2] = P(xx, y + d + 0.1, z); ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke(); }
    } else if (r.type === "spire") {
      // clock stage
      box(x - 0.1, y - 0.1, h, w + 0.2, d + 0.2, 3, "#6b604f");
      const apex = P(x + w / 2, y + d / 2, h + 3 + rh);
      poly(ctx, [P(x, y + d, h + 3), P(x + w, y + d, h + 3), apex], rc, OUTLINE);
      poly(ctx, [P(x + w, y, h + 3), P(x + w, y + d, h + 3), apex], shade(rc, 0.75), OUTLINE);
      ctx.fillStyle = "#c9a54a"; ctx.fillRect(Math.round(apex[0]) - 0.5, Math.round(apex[1]) - 7, 1, 7);
      // bell swing on the hour
      const minute = m % 60, swing = minute < 2 ? Math.sin(t * 9) * 2 : 0;
      const [bx2, by2] = P(x + w / 2, y + d, h - 10);
      ctx.fillStyle = "#c9a54a"; ctx.fillRect(Math.round(bx2 - 2 + swing), Math.round(by2), 4, 4);
    } else if (r.type === "flat") {
      box(x - 0.05, y - 0.05, h, w + 0.1, d + 0.1, 3, r.color);
    }
    // clock faces
    if (b.clock) {
      for (const face of ["y", "x"]) {
        const [cx, cy] = face === "y" ? P(x + w / 2, y + d, h - 18) : P(x + w, y + d / 2, h - 18);
        ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fillStyle = "#c9a54a"; ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy, 6.5, 0, Math.PI * 2); ctx.fillStyle = night ? "#ffe6a0" : "#f3e6c8"; ctx.fill();
        const hr = ((m / 60) % 12) / 12 * Math.PI * 2 - Math.PI / 2, mn = (m % 60) / 60 * Math.PI * 2 - Math.PI / 2;
        ctx.strokeStyle = "#241708"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(hr) * 3.5, cy + Math.sin(hr) * 3.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(mn) * 5.5, cy + Math.sin(mn) * 5.5); ctx.stroke();
        if (night) lights.push({ x: cx, y: cy, r: 16, c: "255,220,140", a: 0.7 });
      }
    }
    // gear on a facade
    if (b.gear) {
      const g = b.gear;
      const [gx, gy] = g.face === "y" ? P(x + g.u, y + d, g.z) : P(x + w, y + g.v, g.z);
      const spin = b.id === "boiler" ? g.speed * (1 + state.stoke * 3) : g.speed * (b.occ > 0 ? 1 : 0.15);
      gear(gx, gy, g.r, g.teeth, t * spin, "#c9a54a");
      gear(gx + g.r * 1.15, gy + g.r * 0.6, g.r * 0.55, Math.round(g.teeth * 0.6), -t * spin * 1.8, "#b06a3b");
    }
    // pressure gauge
    if (b.gauge) {
      const [gx, gy] = P(x + w, y + 3.5, 14);
      ctx.beginPath(); ctx.arc(gx, gy, 4, 0, Math.PI * 2); ctx.fillStyle = "#f3e6c8"; ctx.fill(); ctx.strokeStyle = "#c9a54a"; ctx.stroke();
      const a = -Math.PI * 0.9 + (0.4 + state.stoke * 0.5 + Math.sin(t * 3) * 0.05) * Math.PI * 1.4;
      ctx.strokeStyle = "#b8302a"; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + Math.cos(a) * 3, gy + Math.sin(a) * 3); ctx.stroke();
    }
    // pneumatic tubes on the post office
    if (b.tubes) {
      ctx.lineWidth = 3; ctx.strokeStyle = "#b06a3b";
      const t1 = P(x + w, y + 0.6, 6), t2 = P(x + w, y + 0.6, h + 18), t3 = P(x + w - 1.5, y + 0.6, h + 18);
      ctx.beginPath(); ctx.moveTo(...t1); ctx.lineTo(...t2); ctx.lineTo(...t3); ctx.stroke();
      ctx.lineWidth = 1;
      // capsule zipping up the tube
      const k = (t * 0.6) % 1, [ax, ay] = P(x + w, y + 0.6, 6 + k * (h + 12));
      ctx.fillStyle = "#e8c890"; ctx.fillRect(Math.round(ax) - 1, Math.round(ay) - 2, 3, 4);
    }
    // chimneys
    for (const c of b.chimneys) {
      if (c.big) {
        const s = b.stack;
        box(x + s.u, y + s.v, h - 6, 0.8, 0.8, s.h - h + 6, "#5a3424");
        for (const z of [h + 20, h + 40, s.h - 4]) box(x + s.u - 0.05, y + s.v - 0.05, z, 0.9, 0.9, 3, "#c9a54a");
      } else {
        box(c.x - 0.2, c.y - 0.2, b.h, 0.4, 0.4, c.z - b.h, shade(b.wall, 0.8));
        box(c.x - 0.25, c.y - 0.25, c.z - 2, 0.5, 0.5, 2, "#3a3a3f");
      }
    }
    if (b.id === "tavern" && state.tavernOpen) {
      const [lx, ly] = P(x + w, y + doorA + 0.7, 15);
      ctx.fillStyle = "#ffcf6a"; ctx.fillRect(Math.round(lx) - 1, Math.round(ly) - 2, 3, 4);
      lights.push({ x: lx, y: ly, r: 22, c: "255,190,90", a: 0.9 });
    }
  }

  function drawProp(p, m, t) {
    const { x, y } = p;
    const [cx, cy] = P(x + 0.5, y + 0.5);
    if (p.kind === "tree") {
      ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.ellipse(cx, cy, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4a3324"; ctx.fillRect(cx - 1, cy - 12, 3, 12);
      const s = p.s, sway = Math.sin(t * 1.3 + x) * 0.6;
      for (const [dx, dy, r, col] of [[0, -18, 8, "#3f5a2e"], [-4, -21, 6, "#4f6e38"], [4, -22, 6, "#4a6834"], [0, -26, 5, "#5d8040"]]) {
        ctx.beginPath(); ctx.arc(cx + dx * s + sway, cy + dy * s, r * s, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
      }
    } else if (p.kind === "lamp") {
      ctx.fillStyle = "#2a2a2e"; ctx.fillRect(cx - 1, cy - 22, 2, 22); ctx.fillRect(cx - 2, cy - 2, 4, 2);
      ctx.fillStyle = "#c9a54a"; ctx.fillRect(cx - 3, cy - 27, 6, 1); ctx.fillRect(cx - 2, cy - 29, 4, 2);
      ctx.fillStyle = p.lit ? "#ffe08a" : "#4a5058"; ctx.fillRect(cx - 2, cy - 26, 4, 4);
      if (p.lit) lights.push({ x: cx, y: cy - 24, r: 30, c: "255,210,120", a: 1 });
    } else if (p.kind === "fountain") {
      box(x + 0.1, y + 0.1, 0, 0.8, 0.8, 4, "#8a8174");
      poly(ctx, [P(x + 0.2, y + 0.2, 4), P(x + 0.8, y + 0.2, 4), P(x + 0.8, y + 0.8, 4), P(x + 0.2, y + 0.8, 4)], "#4f7f9a");
      ctx.fillStyle = "#c9a54a"; ctx.fillRect(cx - 1, cy - 14, 3, 10);
      gear(cx + 0.5, cy - 14, 3, 6, t * 0.8, "#c9a54a");
      for (let k = 0; k < 6; k++) {
        const ph = (t * 1.5 + k / 6) % 1, a = (k / 6) * Math.PI * 2;
        ctx.fillStyle = "rgba(200,230,255,0.85)";
        ctx.fillRect(Math.round(cx + Math.cos(a) * ph * 6), Math.round(cy - 14 + ph * 8 - Math.sin(ph * Math.PI) * 6 + Math.sin(a) * ph * 2), 1, 1);
      }
    } else if (p.kind === "bench") {
      box(x + 0.2, y + 0.35, 3, 0.6, 0.3, 1.5, "#6b4a2a");
      box(x + 0.2, y + 0.35, 0, 0.08, 0.3, 3, "#2a2a2e"); box(x + 0.72, y + 0.35, 0, 0.08, 0.3, 3, "#2a2a2e");
    } else if (p.kind === "coal") {
      ctx.fillStyle = "#1e1e22";
      ctx.beginPath(); ctx.moveTo(cx - 12, cy + 2); ctx.quadraticCurveTo(cx - 2, cy - 14, cx + 12, cy + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#3a3a40"; for (let k = 0; k < 6; k++) ctx.fillRect(Math.round(cx - 7 + hash(k, 3) * 14), Math.round(cy - 6 + hash(3, k) * 6), 2, 1);
    } else if (p.kind === "crates") {
      box(x + 0.1, y + 0.15, 0, 0.5, 0.5, 8, "#9a7448"); box(x + 0.55, y + 0.45, 0, 0.4, 0.4, 6, "#8a6438"); box(x + 0.2, y + 0.25, 8, 0.35, 0.35, 5, "#a27c4e");
    } else if (p.kind === "barrels") {
      for (const [dx, dy] of [[-4, 0], [3, 1], [0, -2]]) { ctx.fillStyle = "#6b4a2a"; ctx.fillRect(cx + dx - 3, cy + dy - 8, 6, 8); ctx.fillStyle = "#3a3a3f"; ctx.fillRect(cx + dx - 3, cy + dy - 7, 6, 1); ctx.fillRect(cx + dx - 3, cy + dy - 3, 6, 1); }
    } else if (p.kind === "mailbox") {
      ctx.fillStyle = "#2a2a2e"; ctx.fillRect(cx - 1, cy - 8, 2, 8);
      ctx.fillStyle = "#b8302a"; ctx.fillRect(cx - 3, cy - 14, 6, 7); ctx.fillStyle = "#f3e6c8"; ctx.fillRect(cx - 2, cy - 12, 4, 1);
    } else if (p.kind === "mast") {
      const top = 66;
      const legs = [[x + 0.15, y + 0.15], [x + 0.85, y + 0.15], [x + 0.85, y + 0.85], [x + 0.15, y + 0.85]];
      ctx.strokeStyle = "#2e2e34"; ctx.lineWidth = 1;
      legs.forEach(([lx, ly]) => { const a = P(lx, ly, 0), b = P(lerp(lx, x + 0.5, 0.6), lerp(ly, y + 0.5, 0.6), top); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); });
      for (let z = 11; z < top; z += 11) {
        const k = z / top, pts = legs.map(([lx, ly]) => P(lerp(lx, x + 0.5, 0.6 * k), lerp(ly, y + 0.5, 0.6 * k), z));
        ctx.strokeStyle = "#4a4a52"; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(...q) : ctx.moveTo(...q))); ctx.closePath(); ctx.stroke();
      }
      box(x + 0.25, y + 0.25, top, 0.5, 0.5, 3, "#c9a54a");
      const blink = Math.floor(t * 1.5) % 2 === 0;
      const [bx2, by2] = P(x + 0.5, y + 0.5, top + 8);
      ctx.fillStyle = blink ? "#ff4a3a" : "#6a2a24"; ctx.fillRect(Math.round(bx2) - 1, Math.round(by2) - 1, 3, 3);
      if (blink && isNight(m)) lights.push({ x: bx2, y: by2, r: 12, c: "255,80,60", a: 0.8 });
      ctx.fillStyle = "#2e2e34"; ctx.fillRect(Math.round(bx2), Math.round(by2) + 2, 1, 6);
    }
  }

  function drawTram(m) {
    const x = tram.x - 0.8, y = 14.18;
    ctx.fillStyle = "rgba(0,0,0,0.25)"; poly(ctx, [P(x, y), P(x + 1.6, y), P(x + 1.6, y + 0.64), P(x, y + 0.64)], "rgba(0,0,0,0.25)");
    box(x, y, 2, 1.6, 0.64, 13, "#2f5a4a");
    box(x - 0.05, y - 0.05, 15, 1.7, 0.74, 2, "#c9a54a");
    for (let a = 0.25; a < 1.6; a += 0.38) {
      const lit = isNight(m);
      poly(ctx, [P(x + a, y + 0.64, 7), P(x + a + 0.22, y + 0.64, 7), P(x + a + 0.22, y + 0.64, 12), P(x + a, y + 0.64, 12)], lit ? "#ffd27a" : "#9ab8c4", OUTLINE);
      if (lit) { const [lx, ly] = P(x + a + 0.1, y + 0.64, 10); lights.push({ x: lx, y: ly, r: 10, c: "255,200,110", a: 0.5 }); }
    }
    const sx = tram.dir > 0 ? x + 1.3 : x + 0.1;
    box(sx, y + 0.2, 17, 0.22, 0.22, 7, "#3a3a3f");
    for (const wx of [x + 0.3, x + 1.3]) { const [a, b] = P(wx, y + 0.64, 2); ctx.fillStyle = "#2a2a2e"; ctx.beginPath(); ctx.arc(a, b, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#c9a54a"; ctx.fillRect(Math.round(a) - 0.5, Math.round(b) - 0.5, 1, 1); }
    if (isNight(m)) { const [hx, hy] = P(tram.dir > 0 ? x + 1.6 : x, y + 0.32, 6); lights.push({ x: hx, y: hy, r: 26, c: "255,230,170", a: 0.9 }); }
  }

  function drawPerson(p) {
    const [fx, fy] = P(p.x, p.y);
    const x = Math.round(fx), y = Math.round(fy);
    const L = p.look, walking = p.path && p.path.length;
    const ph = walking ? Math.floor(p.step) % 2 : 0;
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillRect(x - 3, y - 1, 7, 2);
    // legs
    ctx.fillStyle = "#2a2220";
    ctx.fillRect(x - 2, y - 4 - (ph ? 1 : 0), 2, 4 - (ph ? 0 : 0));
    ctx.fillRect(x + 1, y - 4 - (ph ? 0 : walking ? 1 : 0), 2, 4);
    // coat
    ctx.fillStyle = L.coat; ctx.fillRect(x - 3, y - 11, 7, 7);
    ctx.fillStyle = shade(L.coat, 0.7); ctx.fillRect(x + (p.face > 0 ? 2 : -3), y - 11, 2, 7);
    ctx.fillStyle = L.trim; ctx.fillRect(x, y - 11, 1, 6);
    // arms
    ctx.fillStyle = shade(L.coat, 0.85);
    const sw = walking ? (ph ? 1 : -1) : 0;
    ctx.fillRect(x - 4, y - 10 + sw, 1, 4); ctx.fillRect(x + 4, y - 10 - sw, 1, 4);
    // head
    ctx.fillStyle = L.skin; ctx.fillRect(x - 2, y - 15, 5, 4);
    ctx.fillStyle = L.hair; ctx.fillRect(x - 2, y - 16, 5, 1); ctx.fillRect(p.face > 0 ? x - 2 : x + 2, y - 15, 1, 2);
    if (L.beard) { ctx.fillStyle = L.hair; ctx.fillRect(x - 2, y - 12, 5, 1); }
    ctx.fillStyle = "#1a1210"; ctx.fillRect(p.face > 0 ? x + 1 : x - 1, y - 14, 1, 1);
    // hats
    if (L.hat === "tophat") { ctx.fillStyle = "#1a1a1e"; ctx.fillRect(x - 3, y - 17, 7, 1); ctx.fillRect(x - 2, y - 21, 5, 4); ctx.fillStyle = L.trim; ctx.fillRect(x - 2, y - 18, 5, 1); }
    if (L.hat === "goggles") { ctx.fillStyle = L.hair; ctx.fillRect(x - 2, y - 17, 5, 2); ctx.fillStyle = "#c9a54a"; ctx.fillRect(x - 2, y - 16, 5, 1); ctx.fillStyle = "#7ad0e0"; ctx.fillRect(x - 1, y - 16, 1, 1); ctx.fillRect(x + 1, y - 16, 1, 1); }
    if (L.hat === "chef") { ctx.fillStyle = "#ffffff"; ctx.fillRect(x - 2, y - 20, 5, 4); ctx.fillRect(x - 3, y - 21, 7, 2); }
    if (L.hat === "cap") { ctx.fillStyle = "#3a3a3f"; ctx.fillRect(x - 2, y - 17, 5, 2); ctx.fillRect(p.face > 0 ? x + 2 : x - 4, y - 16, 3, 1); }
    if (L.hat === "bonnet") { ctx.fillStyle = "#e8d8b8"; ctx.fillRect(x - 3, y - 17, 7, 2); ctx.fillRect(x - 3, y - 15, 1, 3); ctx.fillRect(x + 3, y - 15, 1, 3); }
    // carried things
    const hx = p.face > 0 ? x + 4 : x - 6;
    if (p.carry === "coal") { ctx.fillStyle = "#6b4a2a"; ctx.fillRect(hx, y - 8, 3, 4); ctx.fillStyle = "#1e1e22"; ctx.fillRect(hx, y - 9, 3, 1); }
    if (p.carry === "bread") { ctx.fillStyle = "#c98a3a"; ctx.fillRect(hx, y - 8, 4, 3); ctx.fillStyle = "#e8c890"; ctx.fillRect(hx + 1, y - 8, 2, 1); }
    if (p.carry === "letter") { ctx.fillStyle = "#f3e6c8"; ctx.fillRect(hx, y - 8, 3, 2); }
    if (p.carry === "sack") { ctx.fillStyle = "#a89070"; ctx.fillRect(hx, y - 10, 4, 5); }
    if (p.carry === "pole") { ctx.fillStyle = "#6b4a2a"; ctx.fillRect(hx + 1, y - 24, 1, 18); ctx.fillStyle = "#ffb040"; ctx.fillRect(hx, y - 25, 3, 2); if (isNight(state.min % 1440)) lights.push({ x: hx + 1, y: y - 24, r: 10, c: "255,180,80", a: 0.8 }); }
    p.screen = [x, y - 10];
  }

  function drawAirship(a, t) {
    const [x, y] = P(...a.pos);
    const bob = a.docked ? Math.sin(t * 1.2) * 1.2 : Math.sin(t * 2) * 0.8;
    const cx = Math.round(x - 14), cy = Math.round(y - 18 + bob);
    // envelope
    ctx.fillStyle = "#8a5a3a"; ctx.beginPath(); ctx.ellipse(cx, cy, 30, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#a8724a"; ctx.beginPath(); ctx.ellipse(cx - 2, cy - 3, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(40,24,12,0.6)"; for (const k of [-16, -6, 4, 14]) { ctx.beginPath(); ctx.moveTo(cx + k, cy - 10); ctx.quadraticCurveTo(cx + k + 3, cy, cx + k, cy + 10); ctx.stroke(); }
    ctx.fillStyle = "#c9a54a"; ctx.fillRect(cx - 30, cy - 1, 60, 2);
    // fins
    poly(ctx, [[cx - 28, cy], [cx - 38, cy - 9], [cx - 34, cy]], "#6b4a2a"); poly(ctx, [[cx - 28, cy], [cx - 38, cy + 8], [cx - 34, cy]], "#5a3a22");
    // gondola
    ctx.strokeStyle = "#2a2a2e"; for (const k of [-8, 8]) { ctx.beginPath(); ctx.moveTo(cx + k, cy + 9); ctx.lineTo(cx + k * 0.8, cy + 15); ctx.stroke(); }
    ctx.fillStyle = "#4a3324"; ctx.fillRect(cx - 11, cy + 15, 22, 6); ctx.fillStyle = "#c9a54a"; ctx.fillRect(cx - 11, cy + 15, 22, 1);
    const night = isNight(state.min % 1440);
    ctx.fillStyle = night ? "#ffd27a" : "#9ab8c4"; for (let k = -8; k <= 6; k += 5) ctx.fillRect(cx + k, cy + 17, 2, 2);
    if (night) lights.push({ x: cx, y: cy + 18, r: 18, c: "255,200,110", a: 0.6 });
    // propeller
    const pr = Math.abs(Math.sin(t * 25)) * 5;
    ctx.fillStyle = "#3a3a3f"; ctx.fillRect(cx + 11, cy + 17, 3, 1); ctx.fillStyle = "#c9a54a"; ctx.fillRect(cx + 14, cy + 17 - pr, 1, pr * 2 + 1);
    if (Math.random() < 0.15) particles.push({ x: cx - 8, y: cy + 14, vx: -6, vy: -3, r: 1.5, life: 0, max: 1.6, color: "#cfcac0" });
  }

  // ---------------------------------------------------------------- frame
  function render(t) {
    const m = state.min % 1440;
    lights.length = 0;
    ctx.clearRect(0, 0, BW, BH);
    ctx.drawImage(ground, 0, 0);
    const ship = airship(m);
    if (ship.vis) { const [sx, sy] = P(ship.pos[0] - 1, ship.pos[1] + 1); ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.ellipse(sx, sy, 26, 9, 0, 0, Math.PI * 2); ctx.fill(); }

    // depth-sorted scene
    const items = [];
    for (const b of buildings) items.push({ x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.d, h: b.h + (b.roof.h || 0) + 100, draw: () => drawBuilding(b, m, t) });
    for (const p of props) items.push({ x0: p.x + 0.1, y0: p.y + 0.1, x1: p.x + 0.9, y1: p.y + 0.9, h: p.kind === "mast" ? 80 : 40, draw: () => drawProp(p, m, t) });
    for (const p of people) if (!p.inside) items.push({ x0: p.x - 0.15, y0: p.y - 0.15, x1: p.x + 0.15, y1: p.y + 0.15, h: 24, draw: () => drawPerson(p) });
    items.push({ x0: tram.x - 0.8, y0: 14.18, x1: tram.x + 0.8, y1: 14.82, h: 30, draw: () => drawTram(m) });
    for (const it of items) {
      const l = P(it.x0, it.y1)[0], r = P(it.x1, it.y0)[0], b = P(it.x1, it.y1)[1], top = P(it.x0, it.y0, it.h)[1];
      it.sb = [l, top, r, b];
    }
    const behind = (a, b) => {
      if (a.x1 <= b.x0) return true; if (b.x1 <= a.x0) return false;
      if (a.y1 <= b.y0) return true; if (b.y1 <= a.y0) return false;
      return a.x0 + a.y0 < b.x0 + b.y0;
    };
    const n = items.length, deps = items.map(() => []);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const A = items[i].sb, Bb = items[j].sb;
      if (A[2] < Bb[0] || Bb[2] < A[0] || A[3] < Bb[1] || Bb[3] < A[1]) continue;
      if (behind(items[i], items[j])) deps[j].push(i); else deps[i].push(j);
    }
    const seen = new Uint8Array(n);
    const visit = (i) => { if (seen[i]) return; seen[i] = 1; for (const k of deps[i]) visit(k); items[i].draw(); };
    items.map((it, i) => [it.x0 + it.y0, i]).sort((a, b) => a[0] - b[0]).forEach(([, i]) => visit(i));

    // particles
    for (const q of particles) {
      const k = q.life / q.max;
      ctx.globalAlpha = (1 - k) * 0.85;
      ctx.fillStyle = q.color;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r * (1 + k * 1.5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (ship.vis) drawAirship(ship, t);

    // night: darken, then cut holes for lights and add a warm glow
    const [alpha, tint] = sample(LIGHT, m);
    if (alpha > 0.01) {
      const d = dark.getContext("2d");
      d.globalCompositeOperation = "source-over";
      d.clearRect(0, 0, BW, BH);
      d.fillStyle = tint; d.globalAlpha = alpha; d.fillRect(0, 0, BW, BH); d.globalAlpha = 1;
      d.globalCompositeOperation = "destination-out";
      for (const L of lights) {
        const g = d.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
        g.addColorStop(0, `rgba(0,0,0,${0.9 * L.a})`); g.addColorStop(1, "rgba(0,0,0,0)");
        d.fillStyle = g; d.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
      }
      ctx.globalCompositeOperation = "source-atop";
      ctx.drawImage(dark, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      const strength = alpha / 0.66;
      for (const L of lights) {
        const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r * 0.7);
        g.addColorStop(0, `rgba(${L.c},${0.35 * L.a * strength})`); g.addColorStop(1, `rgba(${L.c},0)`);
        ctx.fillStyle = g; ctx.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
      }
      ctx.globalCompositeOperation = "source-over";
    }
  }

  // ---------------------------------------------------------------- camera & screen
  const cam = { x: P(N / 2, N / 2)[0], y: P(N / 2, N / 2, 30)[1], zoom: 2, tx: null, ty: null };
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    view.width = Math.round(W * DPR); view.height = Math.round(H * DPR);
    const fit = Math.min(W / (BW - 60), H / (BH - 80));
    cam.zoom = clamp(Math.round(fit * 1.2 * 2) / 2, 1, 6);
  }
  const toScreen = (bx, by) => [(bx - cam.x) * cam.zoom + W / 2, (by - cam.y) * cam.zoom + H / 2];
  const toBuf = (sx, sy) => [(sx - W / 2) / cam.zoom + cam.x, (sy - H / 2) / cam.zoom + cam.y];

  function present(now) {
    const m = state.min % 1440;
    const [top, bottom] = sample(SKY, m);
    const g = vctx.createLinearGradient(0, 0, 0, view.height);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    vctx.setTransform(1, 0, 0, 1, 0, 0);
    vctx.fillStyle = g; vctx.fillRect(0, 0, view.width, view.height);
    vctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (isNight(m)) {
      vctx.fillStyle = "rgba(255,250,230,0.7)";
      for (let i = 0; i < 70; i++) { const sx = hash(i, 1) * W, sy = hash(1, i) * H * 0.6; if (Math.sin(now / 700 + i) > -0.6) vctx.fillRect(Math.round(sx), Math.round(sy), 1, 1); }
    }
    vctx.imageSmoothingEnabled = false;
    const [ox, oy] = toScreen(0, 0);
    vctx.drawImage(buf, ox, oy, BW * cam.zoom, BH * cam.zoom);

    // bubbles and labels in screen space
    vctx.textBaseline = "middle";
    const drawBubble = (sx, sy, text, opts = {}) => {
      vctx.font = `${opts.size || 14}px "IM Fell English", Georgia, serif`;
      const w = vctx.measureText(text).width + 16, h = (opts.size || 14) + 12;
      const x = Math.round(sx - w / 2), y = Math.round(sy - h - 8);
      vctx.globalAlpha = opts.alpha ?? 1;
      vctx.fillStyle = opts.bg || "#f3e6c8"; vctx.strokeStyle = opts.edge || "#6b4a22"; vctx.lineWidth = 1.5;
      vctx.beginPath(); vctx.roundRect(x, y, w, h, 6); vctx.fill(); vctx.stroke();
      vctx.beginPath(); vctx.moveTo(sx - 5, y + h); vctx.lineTo(sx, y + h + 7); vctx.lineTo(sx + 5, y + h); vctx.closePath(); vctx.fill();
      vctx.beginPath(); vctx.moveTo(sx - 5, y + h); vctx.lineTo(sx, y + h + 7); vctx.lineTo(sx + 5, y + h); vctx.stroke();
      vctx.fillStyle = opts.fg || "#241708"; vctx.fillText(text, x + 8, y + h / 2 + 1);
      vctx.globalAlpha = 1;
    };
    for (const p of people) {
      if (p.inside || !p.screen) continue;
      const [sx, sy] = toScreen(p.screen[0], p.screen[1] - 10);
      const hovered = state.hoverId === p.id || state.selId === p.id;
      if (p.bubble && now - p.bubble.t < 3200) drawBubble(sx, sy, p.bubble.text, { alpha: Math.min(1, (3200 - (now - p.bubble.t)) / 400) });
      else if (hovered) drawBubble(sx, sy, p.name, { bg: "#2a1f17", fg: "#f3e6c8", edge: "#d9a441" });
      if (state.selId === p.id) { const [fx, fy] = toScreen(...P(p.x, p.y)); vctx.strokeStyle = "#d9a441"; vctx.lineWidth = 2; vctx.beginPath(); vctx.ellipse(fx, fy, 6 * cam.zoom, 3 * cam.zoom, 0, 0, Math.PI * 2); vctx.stroke(); }
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i], age = now - f.t;
      if (age > f.dur) { floaters.splice(i, 1); continue; }
      const [sx, sy] = toScreen(f.x, f.y - age / 120);
      drawBubble(sx, sy, f.text, { size: f.boom ? 20 : 14, bg: f.boom ? "#ffd27a" : "#f3e6c8", alpha: Math.min(1, (f.dur - age) / 500) });
    }
  }

  // ---------------------------------------------------------------- simulation loop
  let last = performance.now();
  function tick(now) {
    const realDt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const dt = realDt * MIN_PER_SEC * state.speed; // game minutes
    state.min += dt;
    const m = state.min % 1440;
    // hourly bell
    const hour = Math.floor(state.min / 60);
    if (hour !== state.lastHour) {
      if (state.lastHour >= 0 && state.speed > 0) { const c = byId.clock; const [bx, by] = P(c.x + c.w / 2, c.y + c.d, c.h + 6); floaters.push({ x: bx, y: by, text: `♪ Bong × ${((hour % 12) || 12)}`, t: now, dur: 2200 }); }
      state.lastHour = hour;
    }
    if (dt > 0) {
      // substeps keep walking smooth at high speed
      const steps = Math.max(1, Math.ceil(dt / 0.5));
      for (let k = 0; k < steps; k++) { for (const p of people) updatePerson(p, dt / steps); updateTram(dt / steps); }
      state.stoke = Math.max(0, state.stoke - dt * 0.08);
      for (const b of buildings) b.occ = 0;
      for (const p of people) if (p.inside && byId[p.inside]) byId[p.inside].occ++;
      // chimney smoke
      for (const b of buildings) for (const c of b.chimneys) {
        const rate = c.big ? 1.2 + state.stoke * 4 : b.occ > 0 || (b.id === "tavern" && state.tavernOpen) ? 0.5 : 0.06;
        if (Math.random() < rate * realDt * 4 * Math.max(1, state.speed / 2)) puff(c, 1, c.big ? "#bdb6aa" : "#d8d4cc", c.big ? 1.4 : 1);
      }
      if (Math.random() < realDt * 0.6) puff({ x: 7.5, y: 6.5, z: 0 }, 1, "#e8e4dc", 0.5); // street grate
    }
    // particles update in real time
    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.life += realDt; if (q.life > q.max) { particles.splice(i, 1); continue; }
      q.x += q.vx * realDt; q.y += q.vy * realDt;
      if (q.drag) { q.vx *= 0.94; q.vy = q.vy * 0.94 - 4 * realDt; }
    }
    if (particles.length > 900) particles.splice(0, particles.length - 900);
    // follow camera
    if (state.followId) {
      const p = people.find((q) => q.id === state.followId);
      const [tx, ty] = p.inside ? P(...placeTile(p.inside).map((v) => v + 0.5)) : P(p.x, p.y, 16);
      cam.x = lerp(cam.x, tx, 0.08); cam.y = lerp(cam.y, ty, 0.08);
    }
    render(now / 1000);
    present(now);
    updateUI(m);
    requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------------- UI
  const $ = (id) => document.getElementById(id);
  const list = $("folkList");
  list.innerHTML = people.map((p) => `<div class="person" data-id="${p.id}"><span class="swatch" style="background:${p.look.coat}"></span><div><div class="nm">${p.name}</div><div class="act" id="act-${p.id}"></div></div></div>`).join("");
  list.addEventListener("click", (e) => { const el = e.target.closest(".person"); if (el) select(el.dataset.id); });
  $("folkToggle").addEventListener("click", () => $("folk").classList.toggle("open"));
  function activity(p) {
    if (p.inside === "airship") return airship(state.min % 1440).vis ? "Aboard the airship" : "Away on the airship";
    if (p.inside) return `Inside ${placeName(p.inside)}`;
    if (p.path && p.path.length) return `Walking to ${p.going}`;
    return p.now || p.doing;
  }
  function select(id) {
    state.selId = id; state.followId = id;
    $("card").classList.add("show");
    $("folk").classList.remove("open");
    const p = people.find((q) => q.id === id);
    $("cName").textContent = p.name;
    $("cRole").textContent = p.role;
    $("cSched").innerHTML = p.sched.map((s, i) => `<li data-i="${i}"><span>${fmt(s.at)}</span><span>${s.label}</span></li>`).join("");
    document.querySelectorAll(".person").forEach((el) => el.classList.toggle("sel", el.dataset.id === id));
  }
  $("cClose").addEventListener("click", () => { state.selId = state.followId = null; $("card").classList.remove("show"); document.querySelectorAll(".person").forEach((el) => el.classList.remove("sel")); });
  let lastUi = 0;
  function updateUI(m) {
    const now = performance.now();
    if (now - lastUi < 150) return;
    lastUi = now;
    $("time").textContent = fmt(m);
    $("day").textContent = `Day ${Math.floor(state.min / 1440) + 1}`;
    for (const p of people) $(`act-${p.id}`).textContent = activity(p);
    if (state.selId) {
      const p = people.find((q) => q.id === state.selId);
      $("cNow").textContent = activity(p);
      document.querySelectorAll("#cSched li").forEach((li) => li.classList.toggle("cur", Number(li.dataset.i) === p.entry));
    }
  }
  $("speeds").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.speed = Number(b.dataset.s);
    document.querySelectorAll("#speeds button").forEach((x) => x.classList.toggle("on", x === b));
  });
  const zoomBy = (f, sx = W / 2, sy = H / 2) => {
    const [bx, by] = toBuf(sx, sy);
    cam.zoom = clamp(cam.zoom * f, 1, 8);
    const [nx, ny] = toBuf(sx, sy);
    cam.x += bx - nx; cam.y += by - ny;
  };
  $("zIn").addEventListener("click", () => zoomBy(1.25));
  $("zOut").addEventListener("click", () => zoomBy(0.8));
  view.addEventListener("wheel", (e) => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.12 : 0.89, e.clientX, e.clientY); }, { passive: false });

  // drag to pan, pinch to zoom, click to select
  const pointers = new Map();
  let drag = null, pinch = null;
  view.addEventListener("pointerdown", (e) => {
    view.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: cam.zoom }; drag = null; }
  });
  view.addEventListener("pointermove", (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      zoomBy((pinch.z * d / pinch.d) / cam.zoom, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      return;
    }
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; view.classList.add("dragging"); state.followId = null; }
      if (drag.moved) { cam.x = drag.cx - dx / cam.zoom; cam.y = drag.cy - dy / cam.zoom; }
      return;
    }
    const hit = pick(e.clientX, e.clientY);
    state.hoverId = hit ? hit.id : null;
    view.style.cursor = hit ? "pointer" : "";
  });
  const end = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && !drag.moved && e.type === "pointerup") { const hit = pick(e.clientX, e.clientY); if (hit) select(hit.id); }
    if (pointers.size === 0) { drag = null; view.classList.remove("dragging"); }
  };
  view.addEventListener("pointerup", end);
  view.addEventListener("pointercancel", end);
  function pick(sx, sy) {
    let best = null, bd = 1e9;
    for (const p of people) {
      if (p.inside || !p.screen) continue;
      const [px, py] = toScreen(p.screen[0], p.screen[1]);
      const d = Math.hypot(px - sx, py - sy);
      if (d < Math.max(18, 9 * cam.zoom) && d < bd) { best = p; bd = d; }
    }
    return best;
  }

  addEventListener("resize", resize);
  resize();
  drawGround();
  // lamps start lit if the page opens at night
  const m0 = state.min % 1440;
  if (m0 > 1140 || m0 < 330) lamps.forEach((l) => (l.lit = true));
  // a little starting life: smoke in the air already
  for (let i = 0; i < 60; i++) for (const b of buildings) for (const c of b.chimneys) if (c.big || Math.random() < 0.1) { puff(c, 1); }
  // test hook: window.__town.set(minutes) jumps the clock
  window.__town = { state, people, lamps, set(min) { state.min = min; for (const p of people) { p.entry = -1; } }, buildings };
  requestAnimationFrame(tick);
})();
