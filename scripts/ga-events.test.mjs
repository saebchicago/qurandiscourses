// ga-events.test.mjs — assets/ga-init.js sends nothing when analytics are off,
// and when on sends only the fixed events with fixed, link-derived values.
// Run: node scripts/ga-events.test.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(ROOT, "assets", "ga-init.js"), "utf8");

function run({ gpc = false, optOut = false, inApp = false } = {}) {
  const listeners = [];
  const appended = [];
  const window = {
    dataLayer: undefined,
    Capacitor: inApp ? { isNativePlatform: () => true } : undefined,
  };
  const ctx = {
    window,
    navigator: { globalPrivacyControl: gpc },
    localStorage: { getItem: (k) => (k === "dd_analytics_off" && optOut ? "1" : null) },
    location: { origin: "https://divinediscourses.org", pathname: "/export" },
    document: {
      referrer: "https://example.org/a?q=secret#frag",
      head: { appendChild: (t) => appended.push(t) },
      documentElement: { appendChild: (t) => appended.push(t) },
      createElement: () => ({}),
      addEventListener: (type, fn) => listeners.push([type, fn]),
    },
    URL,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  // The script defines gtag and reads window.dataLayer; point both at ctx.
  ctx.window.dataLayer = ctx.dataLayer = [];
  vm.runInContext(src, ctx);
  const dl = ctx.dataLayer;
  const click = (href) => {
    const a = { getAttribute: () => href };
    const target = { closest: (sel) => (sel === "a[href]" ? a : null) };
    listeners.filter(([t]) => t === "click").forEach(([, fn]) => fn({ target }));
  };
  const events = () => dl.map((x) => Array.from(x)).filter((x) => x[0] === "event");
  return { ctx, dl, click, events, listeners, appended };
}

// Off in every way: no tag, no listener, ddEvent is a no-op.
for (const o of [{ gpc: true }, { optOut: true }, { inApp: true }]) {
  const r = run(o);
  assert.equal(r.appended.length, 0, "no tag loaded when off " + JSON.stringify(o));
  assert.equal(r.listeners.length, 0, "no click listener when off");
  r.ctx.window.ddEvent("dataset_download", { table: "x", format: "csv" });
  assert.equal(r.events().length, 0, "ddEvent sends nothing when off");
}

// On: page view plus fixed download events, with nothing else attached.
const on = run();
assert.equal(on.appended.length, 1);
assert.deepEqual(on.events().map((e) => e[1]), ["page_view"]);
on.click("data/exports/keyness-period.csv");
on.click("/data/exports/prayers-vocative.json");
on.click("data/exports/divinediscourses-data-v1.7.1.tar.gz");
on.click("data/exports/schema.json"); // a table-shaped name: counted as a table, by name only
on.click("/read?s=2&a=1"); // not a download
on.click("https://example.org/data/exports/x.csv.evil/");
// The script runs in its own vm context, so compare plain copies.
const dl = JSON.parse(JSON.stringify(on.events().filter((e) => e[1] === "dataset_download").map((e) => e[2])));
assert.deepEqual(dl, [
  { table: "keyness-period", format: "csv" },
  { table: "prayers-vocative", format: "json" },
  { table: "archive", format: "tar.gz" },
  { table: "schema", format: "json" },
]);
// Only the allowlisted event names, and only the declared keys.
on.ctx.window.ddEvent("not_allowed", { a: 1 });
assert.ok(!on.events().some((e) => e[1] === "not_allowed"));
for (const p of dl) assert.deepEqual(Object.keys(p).sort(), ["format", "table"]);
// The page view address carries no query or fragment.
const pv = JSON.parse(JSON.stringify(on.events()[0][2]));
assert.equal(pv.page_location, "https://divinediscourses.org/export");
assert.equal(pv.page_referrer, "https://example.org/a");

console.log("ga-events.test: OK (off paths silent; 4 download events; allowlist enforced).");
