// home-trust.test.mjs — the home page's "Tested against noise" table.
//   node scripts/home-trust.test.mjs
// Its script must use only ids that exist once on the page, read only fields
// the calibration report really has, and the page must carry no inline script.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const html = read("index.html");
const js = read("assets/home-trust.js");

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
assert.equal(new Set(ids).size, ids.length, "duplicate ids on index.html");
for (const m of js.matchAll(/getElementById\("([A-Za-z]+)"\)/g)) assert.ok(ids.includes(m[1]), `home-trust.js uses missing #${m[1]}`);
assert.match(html, /<script src="assets\/home-trust\.js" defer><\/script>/);

const report = JSON.parse(read("data/calibration/report.json"));
assert.ok(report.tests.length >= 6);
for (const t of report.tests) {
  for (const k of ["method", "realFindings", "nullFindings"]) assert.ok(typeof t[k] === "string" && t[k], `${t.id}.${k}`);
}
assert.ok(!html.includes("Page-visit counts only"), "stale analytics wording on the home page");
console.log(`home-trust.test: OK (${report.tests.length} methods; ids unique; wording current).`);
