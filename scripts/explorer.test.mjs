// Checks for assets/explorer-core.js, the table explorer's pure logic.
//   node --test scripts/explorer.test.mjs
// The parser must read all 23 published tables back to exactly the row and
// column counts the schema states; otherwise the explorer would disagree
// with the files it is showing.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const X = createRequire(import.meta.url)(join(ROOT, "assets", "explorer-core.js"));
const schema = JSON.parse(readFileSync(join(ROOT, "data", "exports", "schema.json"), "utf8"));

test("every published table parses to the schema's rows and columns", () => {
  const names = Object.keys(schema.tables);
  assert.ok(names.length >= 23);
  for (const name of names) {
    const meta = schema.tables[name];
    const text = readFileSync(join(ROOT, "data", "exports", name + ".csv"), "utf8");
    const t = X.load(text, meta.fields);
    assert.equal(t.rows.length, meta.rowCount, name + " rows");
    assert.deepEqual(t.header, meta.fields.map((f) => f.name), name + " header");
    for (const r of t.rows) assert.equal(r.length, t.header.length, name + " row width");
    // Numeric columns hold numbers or null, never text.
    t.types.forEach((ty, i) => {
      if (ty === "integer" || ty === "number") {
        for (const r of t.rows) assert.ok(r[i] === null || typeof r[i] === "number", name + "." + t.header[i]);
      }
    });
  }
});

test("the CSV writer round-trips through the parser, including quotes, commas and newlines", () => {
  const header = ["a", "b"];
  const rows = [["x,y", 'say "hi"'], ["line\nbreak", ""], ["بسم", "1"]];
  const back = X.parseCsv(X.toCsv(header, rows));
  assert.deepEqual(back, [header, ...rows.map((r) => r.map(String))]);
  assert.deepEqual(X.parseCsv("﻿a,b\r\n1,2\r\n"), [["a", "b"], ["1", "2"]]);
});

const T = X.load("name,n,r\nalpha,3,0.5\nbeta,10,\ngamma,7,2.5\nرَبّ,1,1\n", [
  { name: "name", type: "string" }, { name: "n", type: "integer" }, { name: "r", type: "number" },
]);

test("filters: text folds case and vowel marks; numbers read >=, <, =, ranges", () => {
  assert.equal(X.filterRows(T, { name: "ALPH" }).rows.length, 1);
  assert.equal(X.filterRows(T, { name: "رب" }).rows.length, 1, "plain letters match a pointed word");
  assert.equal(X.filterRows(T, { n: ">=7" }).rows.length, 2);
  assert.equal(X.filterRows(T, { n: "3..10" }).rows.length, 3);
  assert.equal(X.filterRows(T, { n: "=1" }).rows.length, 1);
  assert.equal(X.filterRows(T, { r: "<1" }).rows.length, 1, "a row with no value never matches");
  const bad = X.filterRows(T, { n: "lots" });
  assert.deepEqual(bad.bad, ["n"]);
  assert.equal(bad.rows.length, 4, "an unreadable filter is ignored, not applied");
});

test("sort is typed and stable, with missing values last either way", () => {
  assert.deepEqual(X.sortRows(T, T.rows, "n", "asc").map((r) => r[1]), [1, 3, 7, 10]);
  assert.deepEqual(X.sortRows(T, T.rows, "n", "desc").map((r) => r[1]), [10, 7, 3, 1]);
  assert.equal(X.sortRows(T, T.rows, "r", "asc").slice(-1)[0][2], null);
  assert.equal(X.sortRows(T, T.rows, "r", "desc").slice(-1)[0][2], null);
});

test("summary and histogram come from the rows given", () => {
  const s = X.summarize(T, T.rows, "n");
  assert.equal(s.min, 1); assert.equal(s.max, 10); assert.equal(s.median, 5); assert.equal(s.mean, 5.25);
  assert.equal(X.summarize(T, T.rows, "r").missing, 1);
  const h = X.histogram(T, T.rows, "n");
  assert.equal(h.reduce((a, b) => a + b.count, 0), 4);
  const wide = X.load("v\n" + Array.from({ length: 100 }, (_, i) => i).join("\n") + "\n", [{ name: "v", type: "integer" }]);
  const hw = X.histogram(wide, wide.rows, "v", 10);
  assert.equal(hw.length, 10);
  assert.equal(hw.reduce((a, b) => a + b.count, 0), 100);
});

test("pages and URL state round-trip", () => {
  const rows = Array.from({ length: 120 }, (_, i) => [i]);
  const p = X.pageOf(rows, 3);
  assert.equal(p.pages, 3); assert.equal(p.rows.length, 20);
  assert.equal(X.pageOf(rows, 99).page, 3);
  const st = { table: "keyness-period", sort: "g2", dir: "desc", filters: { period: "medinan", count: ">=5" }, page: 2 };
  assert.deepEqual(X.parseState(X.serializeState(st)), st);
  assert.deepEqual(X.parseState(""), { table: "", sort: "", dir: "asc", filters: {}, page: 1 });
});
