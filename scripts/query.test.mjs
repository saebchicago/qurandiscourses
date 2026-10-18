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
vm.runInNewContext(readFileSync(join(ROOT, "assets/query-core.js"), "utf8"), Object.assign(sandbox, { globalThis: sandbox }));
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
