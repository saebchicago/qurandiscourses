// Checks for assets/query-core.js, the query builder's pure logic.
//   node --test scripts/query.test.mjs
// The builder's counts must equal numbers published elsewhere on the site,
// otherwise it is a second, disagreeing source of truth.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { safeKey } from "./lib/safe-key.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = { URLSearchParams };
Object.assign(sandbox, { globalThis: sandbox });
vm.runInNewContext(readFileSync(join(ROOT, "assets/kwic.js"), "utf8"), sandbox);
vm.runInNewContext(readFileSync(join(ROOT, "assets/query-core.js"), "utf8"), sandbox);
const Q = sandbox.qdQueryCore;
const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
const chron = readJson("data/chronology.json");
const morph = {};
const load = (scan) => { for (const s of scan) if (!morph[s]) morph[s] = readJson(`data/morphology/${s}.json`); };
const exec = (search) => {
  const f = Q.parse(search);
  const scan = Q.surahsToScan(f, chron);
  load(scan);
  return Q.run(morph, scan, f);
};

test("parse drops junk and orders; serialize is canonical", () => {
  const f = Q.parse("pos=V,N,N,zz9&from=300&to=5&root= rHm &period=nope&x=1");
  assert.equal(f.pos.join(","), "N,V");
  assert.equal(f.from, null);
  assert.equal(f.to, 5);
  assert.equal(f.root, "rHm");
  assert.equal(f.period, "");
  assert.equal(Q.serialize(Q.parse("to=9&root=rHm&from=2")), "root=rHm&from=2&to=9");
  assert.equal(Q.serialize(Q.parse(Q.serialize(f))), Q.serialize(f));
  assert.equal(Q.parse("from=9&to=2").from, 2);
  assert.ok(Q.isEmpty(Q.parse("")));
  assert.equal(Q.parse("pos=V&pos=N").pos.join(","), "N,V");
  assert.ok(!Q.hasAnchor(Q.parse("from=1&period=medinan")));
  assert.ok(Q.hasAnchor(Q.parse("pos=V")));
});

test("a root query equals the published total for that root", () => {
  for (const bw of ["rHm", "Alh", "qwl", "gfr"]) {
    const published = readJson(`data/root-analytics/${safeKey(bw)}.json`);
    const r = exec(`root=${bw}`);
    assert.equal(r.total, Number(published.totalOccurrences), bw);
    assert.equal(r.bySurah.reduce((a, b) => a + b.n, 0), r.total);
  }
});

test("every root in roots-list: query total equals totalCount", () => {
  const list = readJson("data/roots-list.json");
  for (let s = 1; s <= 114; s++) load([s]);
  const bad = [];
  for (const [bw, e] of Object.entries(list)) {
    const f = Q.parse(`root=${encodeURIComponent(bw)}`);
    const r = Q.run(morph, Q.surahsToScan(f, chron), f);
    if (r.total !== e.totalCount) bad.push(`${bw}: ${r.total} vs ${e.totalCount}`);
  }
  assert.deepEqual(bad, []);
});

test("period filter equals the sum of the published period counts", () => {
  const list = readJson("data/roots-list.json");
  for (let s = 1; s <= 114; s++) load([s]);
  for (const per of Q.PERIODS) {
    const f = Q.parse(`root=rHm&period=${per}`);
    const r = Q.run(morph, Q.surahsToScan(f, chron), f);
    assert.equal(r.total, list.rHm.byChronology[per], per);
  }
});

test("filters combine with AND; surah range and POS narrow the result", () => {
  const all = exec("root=Alh");
  const rng = exec("root=Alh&from=2&to=3");
  assert.ok(rng.total < all.total && rng.total > 0);
  assert.ok(rng.bySurah.every((x) => x.s >= 2 && x.s <= 3));
  const verbs = exec("root=qwl&pos=V");
  const nouns = exec("root=qwl&pos=N");
  const both = exec("root=qwl&pos=N,V");
  assert.equal(verbs.total + nouns.total, both.total);
  assert.equal(exec("root=rHm&lemma=nonexistent").total, 0);
});

test("context stays inside the verse and the CSV round-trips the row count", () => {
  const r = exec("root=Alh&from=112&to=112");
  for (const row of r.rows) assert.ok(row.before.length <= Q.WINDOW && row.after.length <= Q.WINDOW);
  const lines = Q.csv(r).trim().split("\n");
  assert.equal(lines.length, r.total + 1);
  assert.equal(lines[0], "surah,verse,word,before,keyword,after,root,lemma,pos");
});

test("Arabic lemma matching reproduces every published Arabic lemma (all 1,642 roots' top lemmas)", () => {
  const list = readJson("data/roots-list.json");
  for (let s = 1; s <= 114; s++) load([s]);
  const byRoot = new Map();
  for (let s = 1; s <= 114; s++) for (const v of Object.values(morph[s])) for (const w of v) {
    if (!w.root) continue;
    let set = byRoot.get(w.root); if (!set) byRoot.set(w.root, (set = new Set()));
    set.add(Q.tokenLemmaLetters(w.lemma));
  }
  const bad = [];
  let checked = 0;
  for (const [bw, e] of Object.entries(list)) for (const l of e.topLemmas || []) {
    checked++;
    if (!byRoot.get(bw).has(Q.lemmaLetters(l.lemmaArabic))) bad.push(`${bw}: ${l.lemmaArabic}`);
  }
  assert.ok(checked > 1000, `checked ${checked}`);
  assert.deepEqual(bad, []);
});

test("lemma by Arabic letters and form filters select the same tokens as their Buckwalter / surface equivalents", () => {
  const a = exec("lemma=qaAla");
  const b = exec("lemma=" + encodeURIComponent(Q.bwToArabic("qaAla")));
  assert.ok(a.total > 1000);
  assert.ok(b.total >= a.total, "the letters match is at least as wide as the exact Buckwalter match");
  assert.ok(b.rows.every((r) => Q.tokenLemmaLetters(r.lemma) === Q.lemmaLetters(Q.bwToArabic("qaAla"))));
  const f1 = exec("form=" + encodeURIComponent("\u0642\u0627\u0644"));
  const f2 = exec("form=" + encodeURIComponent("\u0642\u064e\u0627\u0644\u064e"));
  assert.ok(f1.total > 100);
  assert.equal(f1.total, f2.total);
  assert.ok(f1.rows.every((r) => Q.fold(r.key) === "\u0642\u0627\u0644"));
});

test("query.html has no duplicate ids, and every id query.js looks up exists once", () => {
  const html = readFileSync(join(ROOT, "query.html"), "utf8");
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = ids.filter((x, i) => ids.indexOf(x) !== i);
  assert.deepEqual(dupes, []);
  const js = readFileSync(join(ROOT, "assets/query.js"), "utf8");
  const wanted = new Set([...js.matchAll(/\$\("([A-Za-z]+)"\)/g)].map((m) => m[1]));
  const missing = [...wanted].filter((id) => !ids.includes(id));
  assert.deepEqual(missing, []);
});
