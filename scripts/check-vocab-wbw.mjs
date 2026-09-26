#!/usr/bin/env node
//
// check-vocab-wbw.mjs — does the Quran.com word-by-word source line up
// with the core-vocabulary examples?
//
// vocabulary.html's practice cards show, for each lemma, the Quran.com
// word-by-word English for its most common form at its first occurrence
// (data/vocabulary.json `at` = surah:verse:word, word numbered as in the
// Leeds corpus). The page only shows a meaning when the Arabic Quran.com
// serves at that position matches ours after normAr(); this script runs
// the same comparison for every lemma, so the share of cards that can
// show a meaning is measured rather than assumed.
//
// The endpoint and normAr() are parsed out of assets/vocabulary.js, so
// this check cannot drift from what the page does.
//
// A checker, not a generator: writes nothing. Needs outbound network to
// api.quran.com (runs in audit.yml's external-evidence job).
//
// Exit 1 when fewer than MIN_SHARE of the lemmas match: that would mean
// the page mostly shows "no meaning", and the feature should be revisited.
//
// Run:  node scripts/check-vocab-wbw.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib/page-shell.mjs";

const MIN_SHARE = 0.9;
const js = readFileSync(join(ROOT, "assets/vocabulary.js"), "utf8");
const api = /var API = "([^"]+)"/.exec(js);
const perPage = /var PER_PAGE = (\d+)/.exec(js);
const query = /"(\?language=[^"]+per_page=)"/.exec(js);
const normSrc = /function normAr\(s\) \{[\s\S]*?\n {2}\}/.exec(js);
if (!api || !perPage || !query || !normSrc) {
  console.error("check-vocab-wbw: FAIL — could not parse API / PER_PAGE / query / normAr out of assets/vocabulary.js");
  process.exit(2);
}
const normAr = new Function(`${normSrc[0]}; return normAr;`)();
const PER = +perPage[1];

const data = JSON.parse(readFileSync(join(ROOT, "data/vocabulary.json"), "utf8"));
const col = Object.fromEntries(data.columns.map((c, i) => [c, i]));
const items = data.lemmas.map((r) => {
  const [s, a, w] = r[col.at].split(":").map(Number);
  return { rank: r[col.rank], form: r[col.form], s, a, w };
});

const cache = new Map();
async function page(s, p) {
  const key = `${s}:${p}`;
  if (!cache.has(key)) {
    const url = `${api[1]}${s}${query[1]}${PER}&page=${p}`;
    cache.set(
      key,
      (async () => {
        for (let attempt = 1; ; attempt++) {
          try {
            const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
          } catch (e) {
            if (attempt >= 3) throw new Error(`${url}: ${e.message}`);
            await new Promise((r) => setTimeout(r, 1000 * attempt));
          }
        }
      })(),
    );
  }
  return cache.get(key);
}

let ok = 0;
const bad = [];
for (const it of items) {
  let words = [];
  try {
    const json = await page(it.s, Math.ceil(it.a / PER));
    const v = (json.verses || []).find((x) => x.verse_key === `${it.s}:${it.a}`);
    words = ((v && v.words) || []).filter((w) => w.char_type_name === "word");
  } catch (e) {
    console.error(`check-vocab-wbw: FAIL — ${e.message}`);
    process.exit(2);
  }
  const w = words[it.w - 1];
  const en = w && w.translation && w.translation.text;
  if (w && en && normAr(w.text_uthmani || w.text) === normAr(it.form)) ok++;
  else bad.push(`#${it.rank} ${it.s}:${it.a}:${it.w} ours ${it.form} · theirs ${w ? w.text_uthmani || w.text : "(none)"}${en ? "" : " · no English"}`);
}

const share = ok / items.length;
console.log(`check-vocab-wbw: ${ok} of ${items.length} lemmas match (${(100 * share).toFixed(1)}%), ${cache.size} API pages fetched.`);
for (const b of bad.slice(0, 40)) console.log(`  mismatch ${b}`);
if (bad.length > 40) console.log(`  … ${bad.length - 40} more`);
if (share < MIN_SHARE) {
  console.error(`check-vocab-wbw: FAIL — under ${MIN_SHARE * 100}% of practice cards could show a meaning.`);
  process.exit(1);
}
