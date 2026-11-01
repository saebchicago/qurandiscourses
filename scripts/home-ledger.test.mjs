// home-ledger.test.mjs — the home page's "claim ledger, counted" panel.
//   node scripts/home-ledger.test.mjs
// The panel must use only ids that exist once on the page, know every label
// value the ledger uses (so a new value fails here instead of being dropped
// from the bars), and count every claim exactly once per dimension.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const html = read("index.html");
const js = read("assets/home-ledger.js");
const L = createRequire(import.meta.url)(join(ROOT, "assets", "home-ledger.js"));

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
assert.equal(new Set(ids).size, ids.length, "duplicate ids on index.html");
for (const m of js.matchAll(/getElementById\("([A-Za-z]+)"\)/g)) assert.ok(ids.includes(m[1]), `home-ledger.js uses missing #${m[1]}`);
assert.match(html, /<script src="assets\/home-ledger\.js" defer><\/script>/);

const claims = JSON.parse(read("data/claims.json")).claims;
assert.ok(claims.length > 0);
const groups = L.tally(claims);
assert.equal(groups.length, 4);
for (const g of groups) {
  assert.deepEqual(g.unknown, [], `ledger uses ${g.key} values the panel does not name: ${g.unknown}`);
  const sum = Object.values(g.counts).reduce((a, b) => a + b, 0);
  assert.equal(sum, claims.length, `${g.key} counts must cover every claim once`);
}
// The panel's value lists must match the checker's allowed sets, so a value
// the checker accepts but the panel lacks cannot appear unnoticed later.
const checker = read("scripts/check-claims.mjs");
for (const g of L.GROUPS) {
  const m = checker.match(new RegExp(`${g.key}: new Set\\(\\[([^\\]]*)\\]\\)`));
  assert.ok(m, `${g.key} not found in check-claims.mjs`);
  const allowed = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]).sort();
  assert.deepEqual(g.values.map((v) => v[0]).sort(), allowed, `${g.key} values differ from check-claims.mjs`);
}
console.log(`home-ledger.test: OK (${claims.length} claims, 4 dimensions, every label named).`);
