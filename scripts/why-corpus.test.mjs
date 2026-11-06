// why-corpus.test.mjs — the figures quoted in How it works, "Why a corpus".
//   node scripts/why-corpus.test.mjs
// The section states a few counts in prose. Each must equal the generated
// data it comes from, so a recount cannot leave the prose behind.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const html = read("how-it-works.html");
const start = html.indexOf('id="why-corpus"');
assert.ok(start > 0, "why-corpus section missing");
const section = html.slice(start, html.indexOf('id="depth-levels"'));
const text = section.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

const nums = JSON.parse(read("data/numbers.json"));
const top = nums.topRoots[0];
assert.equal(top.latin, "a-l-h");
assert.ok(text.includes(`${top.count.toLocaleString("en-US")} times among the corpus's ${nums.totals.tokens.toLocaleString("en-US")} words`), "root count or token total differs from data/numbers.json");

const v = JSON.parse(read("data/prayers/prayers.json")).vocative;
assert.ok(text.includes(`${v.tokens} times in ${v.verses} verses of ${v.surahs} surahs`), "rabbana figures differ from data/prayers/prayers.json");

assert.match(html, /<script src="assets\/cite-badge\.js" defer><\/script>/, "how-it-works.html cites sources, so it must load cite-badge.js or the badges do nothing");
assert.match(read("about.html"), /\/how-it-works#why-corpus/, "About must link to the section");
console.log("why-corpus.test: OK (figures match the generated data).");
