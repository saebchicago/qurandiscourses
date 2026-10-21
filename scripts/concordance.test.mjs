// Checks for assets/concordance.js, the Roots explorer's word-in-context view.
//   node --test scripts/concordance.test.mjs
//
// The concordance builds its lines in the browser from data/morphology/ and
// the verse lists in data/root-analytics/. These tests load the same module
// and assert that, fully loaded, it yields exactly each root's published
// occurrence count, and that context never crosses a verse boundary.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = { window: {}, document: { readyState: "complete", getElementById: () => null } };
vm.runInNewContext(readFileSync(join(ROOT, "assets/kwic.js"), "utf8"), sandbox);
vm.runInNewContext(readFileSync(join(ROOT, "assets/concordance.js"), "utf8"), sandbox);
const { _linesForVerse: linesForVerse, WINDOW } = sandbox.window.qdConcordance;

const morph = {};
for (let s = 1; s <= 114; s++) morph[s] = JSON.parse(readFileSync(join(ROOT, `data/morphology/${s}.json`), "utf8"));

test("every root: concordance lines equal the published occurrence count", () => {
  const files = readdirSync(join(ROOT, "data/root-analytics")).filter((f) => f.endsWith(".json"));
  assert.ok(files.length > 1000);
  const mismatches = [];
  for (const f of files) {
    const d = JSON.parse(readFileSync(join(ROOT, "data/root-analytics", f), "utf8"));
    let n = 0;
    for (const ref of d.verses) {
      const [s, v] = ref.split(":");
      n += linesForVerse(morph[s][v] || [], d.bw, +s, +v).length;
    }
    if (n !== Number(d.totalOccurrences)) mismatches.push(`${d.bw}: ${n} lines vs ${d.totalOccurrences}`);
  }
  assert.deepEqual(mismatches, []);
});

test("context is capped at WINDOW words and stays inside the verse", () => {
  // 2:255 is long; take its first rooted word and its last.
  const words = morph[2]["255"];
  const lines = words.filter((w) => w.root).flatMap((w) => linesForVerse(words, w.root, 2, 255));
  for (const l of lines) {
    assert.ok(l.before.length <= WINDOW && l.after.length <= WINDOW);
    const i = words.findIndex((w) => w.w === l.w);
    assert.deepEqual(l.before, words.slice(Math.max(0, i - WINDOW), i).map((w) => w.ar));
    assert.deepEqual(l.after, words.slice(i + 1, i + 1 + WINDOW).map((w) => w.ar));
  }
  assert.equal(linesForVerse(words, words[0].root, 2, 255)[0].before.length, 0);
});
