// prayers.test.mjs — checks data/prayers/prayers.json against an independent
// recount of the morphology, and prayers.html against the data and its script.
// Run: node scripts/prayers.test.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const data = JSON.parse(read("data/prayers/prayers.json"));

// Independent recount: surface form only (no lemma field), accusative vowel
// read off the ba, then the same two context exclusions written out by hand.
const tally = { vocative: [], nominative: 0, genitive: 0, excluded: [] };
for (let s = 1; s <= 114; s++) {
  const m = JSON.parse(read(`data/morphology/${s}.json`));
  for (const [a, ws] of Object.entries(m)) {
    ws.forEach((w, i) => {
      const bare = w.ar.replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, "").replace(/\u0671/g, "\u0627");
      if (!/^[\u0648\u0641\u0628\u0644\u0643]?\u0631\u0628\u0646[\u0627\u0622]$/.test(bare)) return;
      if (w.lemma !== "rab~") return;
      const marks = /\u0631[\u064b-\u065f\u0670]*\u0628([\u064b-\u065f\u0670]*)/.exec(w.ar)[1];
      if (marks.includes("ُ")) return void tally.nominative++;
      if (marks.includes("ِ")) return void tally.genitive++;
      const prev = i ? ws[i - 1].lemma : "";
      if (prev === "<in~" || prev === "ra'aA") return void tally.excluded.push(`${s}:${a}`);
      tally.vocative.push(`${s}:${a}:${w.w}`);
    });
  }
}
assert.equal(data.vocative.tokens, tally.vocative.length);
assert.deepEqual(data.vocative.entries.map((e) => `${e.s}:${e.a}:${e.w}`), tally.vocative);
assert.equal(data.vocative.nominativeForms, tally.nominative);
assert.equal(data.vocative.genitiveForms, tally.genitive);
assert.deepEqual(data.vocative.excluded.map((e) => `${e.s}:${e.a}`), tally.excluded);
assert.deepEqual(tally.excluded, ["25:21", "35:34"]);
assert.equal(data.vocative.verses, new Set(tally.vocative.map((x) => x.split(":").slice(0, 2).join(":"))).size);
assert.equal(
  Object.values(data.vocative.byPeriod).reduce((a, b) => a + b, 0),
  data.vocative.tokens,
);
assert.equal(Object.values(data.vocative.versesByPeriod).reduce((a, b) => a + b, 0), data.vocative.verses);
assert.equal(data.vocative.nextWord.reduce((a, x) => a + x.n, 0), data.vocative.tokens);

// Remembrance roots: recount from the root field.
for (const root of Object.keys(data.remembrance)) {
  let tokens = 0;
  const verses = new Set();
  for (let s = 1; s <= 114; s++) {
    const m = JSON.parse(read(`data/morphology/${s}.json`));
    for (const [a, ws] of Object.entries(m)) {
      const n = ws.filter((w) => w.root === root).length;
      if (n) { tokens += n; verses.add(`${s}:${a}`); }
    }
  }
  assert.equal(data.remembrance[root].tokens, tokens, root);
  assert.equal(data.remembrance[root].verses, verses.size, root);
  assert.equal(data.remembrance[root].lemmas.reduce((a, l) => a + l.n, 0), tokens, root);
}

// The page: static fallbacks equal the data, ids are unique and every id the
// script uses exists.
const html = read("prayers.html");
const textOf = (id) => new RegExp(`id="${id}"[^>]*>([^<]*)<`).exec(html)?.[1].trim();
assert.equal(textOf("pTokens"), String(data.vocative.tokens));
assert.equal(textOf("pVerses"), String(data.vocative.verses));
assert.equal(textOf("pSurahs"), String(data.vocative.surahs));
assert.equal(textOf("pNom"), String(data.vocative.nominativeForms));
assert.equal(textOf("pGen"), String(data.vocative.genitiveForms));
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
assert.equal(new Set(ids).size, ids.length, "duplicate ids in prayers.html");
const js = read("assets/prayers.js");
for (const m of js.matchAll(/\$\("([A-Za-z]+)"\)/g)) assert.ok(ids.includes(m[1]), `prayers.js uses missing #${m[1]}`);
assert.match(html, /<script src="assets\/prayers\.js">/);
assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>(?!\s*<\/script>)/.test(html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, "")), "inline script");

console.log(`prayers.test: OK (${data.vocative.tokens} vocative tokens in ${data.vocative.verses} verses; ${Object.keys(data.remembrance).length} roots recounted).`);
