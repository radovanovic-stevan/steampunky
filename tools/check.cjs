// Loads the town in headless Chromium, runs window.__town.check(), fast-forwards a full day
// watching for errors, and saves screenshots. Usage: node tools/check.cjs [screenshot dir]
const http = require("http"), fs = require("fs"), path = require("path"), { execSync } = require("child_process");
let playwright;
try { playwright = require("playwright"); } catch { playwright = require(path.join(execSync("npm root -g").toString().trim(), "playwright")); }

const root = path.join(__dirname, ".."), out = process.argv[2] || path.join(root, "shots");
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "/index.html"));
  fs.readFile(f, (err, data) => { if (err) { res.writeHead(404); res.end(); } else { res.writeHead(200, { "content-type": types[path.extname(f)] || "text/plain" }); res.end(data); } });
});

(async () => {
  await new Promise((r) => server.listen(0, r));
  const url = `http://localhost:${server.address().port}/`;
  const opts = fs.existsSync("/opt/pw-browsers/chromium") ? { executablePath: "/opt/pw-browsers/chromium" } : {};
  let browser;
  try { browser = await playwright.chromium.launch(opts); } catch { browser = await playwright.chromium.launch(); }
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts\.g/.test(m.text())) errors.push(m.text()); });
  page.on("requestfailed", (r) => { if (!/fonts\.g/.test(r.url())) errors.push(`failed to load ${r.url()}`); });
  await page.goto(url);
  await page.waitForFunction(() => window.__town);
  const problems = await page.evaluate(() => window.__town.check());
  const entries = await page.evaluate(() => fetch("changelog.json").then((r) => r.json()));
  if (!Array.isArray(entries) || !entries.every((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.text === "string" && e.text)) problems.push("changelog.json is malformed");

  // run a whole day at high speed and make sure nobody gets stuck
  await page.evaluate(() => { window.__town.set(5 * 60); window.__town.state.speed = 60; });
  const seen = {};
  for (let i = 0; i < 24; i++) {
    await page.waitForTimeout(500);
    const pos = await page.evaluate(() => window.__town.people.map((p) => [p.id, p.x.toFixed(1), p.y.toFixed(1), p.inside || ""].join()));
    pos.forEach((k) => (seen[k.split(",")[0]] = (seen[k.split(",")[0]] || new Set()).add(k)));
  }
  for (const id in seen) if (seen[id].size < 2) problems.push(`${id} never moved during a full day`);

  fs.mkdirSync(out, { recursive: true });
  await page.evaluate(() => (window.__town.state.speed = 1));
  for (const [name, min] of [["morning", 8 * 60 + 30], ["noon", 13 * 60 + 10], ["dusk", 19 * 60 + 10], ["night", 22 * 60]]) {
    await page.evaluate((m) => window.__town.set(m), min);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(out, `${name}.png`) });
  }
  await page.click("#logToggle");
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(out, "changelog.png") });

  await browser.close(); server.close();
  const all = [...problems, ...errors];
  console.log(all.length ? "PROBLEMS:\n- " + all.join("\n- ") : "OK: no problems");
  console.log(`screenshots in ${out}`);
  process.exit(all.length ? 1 : 0);
})();
