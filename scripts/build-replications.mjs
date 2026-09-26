#!/usr/bin/env node
//
// build-replications.mjs — published figures, reproduced from this
// site's own data, as cards on validation.html.
//
//   node scripts/build-replications.mjs           # write
//   node scripts/build-replications.mjs --check   # exit 1 if stale
//
// Reads data/replications.json. Each card quotes a source exactly (the
// quote was copied from scripts/fetch-evidence.mjs's CI output, which
// --verify re-checks against the live page), states the figure the
// source gives, and computes ours here from the bundled corpus — no
// figure on our side is typed by hand. A card whose figure does not
// match renders as a mismatch; it is never hidden.
//
// Writes validation.html's static:replications region.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readJson } from "./lib/io.mjs";
import { ROOT, esc, n0, badge, replaceRegion } from "./lib/page-shell.mjs";

const CHECK = process.argv.includes("--check");
const { cards } = readJson("data/replications.json");
const sources = new Map(readJson("data/sources.json").sources.map((s) => [s.id, s]));

function surahList(spec) {
  const out = [];
  for (const part of spec.split(",")) {
    const [a, b] = part.split("-").map(Number);
    for (let s = a; s <= (b || a); s++) out.push(s);
  }
  return out;
}

const wordsIn = new Map();
function words(s) {
  if (!wordsIn.has(s)) {
    const m = readJson(`data/morphology/${s}.json`);
    wordsIn.set(s, Object.keys(m).filter((k) => /^\d+$/.test(k)).reduce((t, k) => t + m[k].length, 0));
  }
  return wordsIn.get(s);
}

const COMPUTE = {
  words: ({ surahs }) => surahList(surahs).reduce((t, s) => t + words(s), 0),
};

const html = cards
  .map((c) => {
    if (!sources.has(c.source)) throw new Error(`${c.id}: source ${c.source} not in data/sources.json`);
    if (!COMPUTE[c.ours.kind]) throw new Error(`${c.id}: unknown computation ${c.ours.kind}`);
    const ours = COMPUTE[c.ours.kind](c.ours);
    const match = ours === c.stated;
    const src = sources.get(c.source);
    const mark = match
      ? `<span class="badge ok" data-source-ids="${c.source}" aria-label="Reproduced" tabindex="0" title="Reproduced · our figure equals the source's">●</span>`
      : `<span class="badge nuanced" data-source-ids="${c.source}" aria-label="Differs" tabindex="0" title="Differs · our figure does not equal the source's">~</span>`;
    return `          <div class="verify-example replication" id="rep-${c.id}">
            <h3 id="rep-${c.id}-title">${mark} ${esc(c.title)}</h3>
            <blockquote class="claim">
              <p>“${esc(c.quote)}”${c.quote2 ? ` … “${esc(c.quote2)}”` : ""}</p>
              <footer class="t-annotation">${esc(src.author)}, <cite>${esc(src.name)}</cite>${src.edition ? `, ${esc(src.edition)}` : ""}: <a href="${esc(c.url)}" rel="noopener">${esc(c.url.replace(/^https?:\/\//, ""))}</a>, read ${c.fetched} (SHA-256 ${c.sha256.slice(0, 12)}…)</footer>
            </blockquote>
            <p><strong>Stated:</strong> ${n0(c.stated)} · <strong>Here:</strong> ${n0(ours)} · <strong>${match ? "Reproduced" : "Differs"}</strong></p>
            <p class="trace"><strong>Check it yourself.</strong> ${c.check}${c.note ? ` ${esc(c.note)}` : ""}</p>
          </div>`;
  })
  .join("\n");

const file = join(ROOT, "validation.html");
const before = readFileSync(file, "utf8");
const after = replaceRegion(before, "replications", html, "validation.html");
if (CHECK) {
  if (before !== after) {
    console.error("build-replications --check: FAIL — validation.html is stale.\n  Run: node scripts/build-replications.mjs");
    process.exit(1);
  }
  console.log(`build-replications --check: OK (${cards.length} cards)`);
} else {
  writeFileSync(file, after);
  console.log(`build-replications: ${cards.length} cards; validation.html ${before === after ? "unchanged" : "updated"}.`);
}
