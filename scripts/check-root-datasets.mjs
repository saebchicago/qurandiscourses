// check-root-datasets.mjs — the 1642 roots must be the same 1642 roots
// everywhere, and the Buckwalter/Latin correspondence must be exact.
//
// Seven datasets describe the same root set in three different key spaces:
//
//   data/roots-summary.json   keyed by Buckwalter          ("smw", "rHm")
//   data/roots-list.json      keyed by Buckwalter
//   data/roots-index.json     keyed by canonical Latin     ("s-m-w", "r-ḥ-m")
//   data/root-analytics/      one file per root, safeKey(bw).json
//   data/cooccurrence/        ditto
//   data/association/  network/  centrality/  dispersion/   ditto (+ methods sidecars)
//
// Nothing checked that they agree, and something silently didn't. read.html
// bridged Buckwalter to the Latin keys by substring matching, which collapses
// the digraphs (kh, gh, sh, th, dh): "h-j-r" matched "sh-j-r", "kh-w-n"
// matched "h-w-n". Seventy-six of 1642 roots rendered a DIFFERENT root's
// Arabic, frequency, occurrences and derived forms — under the green
// Verified badge, which is the one thing this site's provenance apparatus
// exists to make impossible.
//
// The correspondence is not inferred here: roots-summary.json carries both
// `rootBuckwalter` and `rootLatin` per entry, so it is the authority, and
// every other dataset is checked against it.
//
// Run: node scripts/check-root-datasets.mjs   (exit 1 on any drift)

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { safeKey } from "./lib/safe-key.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
const failures = [];
// Cap the noise: a wholesale regeneration mistake would otherwise print
// thousands of identical lines and bury the first useful one.
const MAX_PER_RULE = 8;
function fail(rule, msgs) {
  const shown = msgs.slice(0, MAX_PER_RULE);
  for (const m of shown) failures.push(`${rule}: ${m}`);
  if (msgs.length > shown.length)
    failures.push(`${rule}: ...and ${msgs.length - shown.length} more`);
}

// roots-summary.json is the authority for the Buckwalter <-> Latin pairing.
const summary = read("data/roots-summary.json");
const bwKeys = Object.keys(summary);
const EXPECTED = bwKeys.length;

const bad = [];
for (const bw of bwKeys) {
  const e = summary[bw];
  if (e.rootBuckwalter !== bw)
    bad.push(`key "${bw}" holds rootBuckwalter "${e.rootBuckwalter}"`);
  if (typeof e.rootLatin !== "string" || !e.rootLatin)
    bad.push(`"${bw}" has no rootLatin`);
}
fail("roots-summary self-consistency", bad);

const latinOf = new Map(bwKeys.map((bw) => [bw, summary[bw].rootLatin]));

// A collision in the Latin space would make roots-index ambiguous no matter
// how carefully it is keyed, so the mapping must be injective.
const byLatin = new Map();
const dupes = [];
for (const [bw, latin] of latinOf) {
  if (byLatin.has(latin))
    dupes.push(`"${latin}" is the Latin form of both "${byLatin.get(latin)}" and "${bw}"`);
  else byLatin.set(latin, bw);
}
fail("rootLatin uniqueness", dupes);

// roots-list.json: same Buckwalter keys, same Latin for each.
const list = read("data/roots-list.json");
const listKeys = Object.keys(list);
if (listKeys.length !== EXPECTED)
  failures.push(
    `roots-list.json: ${listKeys.length} roots, roots-summary.json has ${EXPECTED}`,
  );
const listBad = [];
for (const bw of bwKeys) {
  const e = list[bw];
  if (!e) {
    listBad.push(`"${bw}" missing`);
    continue;
  }
  if (e.rootLatin !== latinOf.get(bw))
    listBad.push(
      `"${bw}" rootLatin "${e.rootLatin}", roots-summary says "${latinOf.get(bw)}"`,
    );
}
fail("roots-list vs roots-summary", listBad);

// roots-index.json: keyed by canonical Latin. This is the pairing read.html
// depends on, and the one that was broken.
const index = read("data/roots-index.json");
const indexKeys = Object.keys(index);
if (indexKeys.length !== EXPECTED)
  failures.push(
    `roots-index.json: ${indexKeys.length} roots, roots-summary.json has ${EXPECTED}`,
  );
const missing = [];
for (const bw of bwKeys) {
  const latin = latinOf.get(bw);
  if (!Object.prototype.hasOwnProperty.call(index, latin))
    missing.push(`no roots-index entry for "${latin}" (Buckwalter "${bw}")`);
}
fail("roots-index keyed by rootLatin", missing);

const extra = indexKeys.filter((k) => !byLatin.has(k));
fail(
  "roots-index has no unknown keys",
  extra.map((k) => `"${k}" is not any root's rootLatin`),
);

// Per-root directories: exactly one safeKey(bw).json per root, no orphans.
// Sidecars are listed explicitly rather than pattern-matched, so a stray
// file cannot hide behind a loose rule. Keep in sync with the generators:
// compute-association-stats (methods, keyness-top), compute-network-layout
// (methods, heatmap), compute-centrality (methods), compute-dispersion
// (methods).
const PER_ROOT_DIRS = {
  "data/root-analytics": [],
  "data/cooccurrence": [],
  "data/association": ["methods.json", "keyness-top.json"],
  "data/network": ["methods.json", "heatmap.json"],
  "data/centrality": ["methods.json"],
  "data/dispersion": ["methods.json"],
};
for (const [dir, sidecars] of Object.entries(PER_ROOT_DIRS)) {
  const present = new Set(
    readdirSync(join(ROOT, dir))
      .filter((f) => f.endsWith(".json") && !sidecars.includes(f))
      .map((f) => f.slice(0, -5)),
  );
  const want = new Set(bwKeys.map(safeKey));
  const absent = [...want].filter((k) => !present.has(k));
  const orphan = [...present].filter((k) => !want.has(k));
  fail(
    `${dir} file per root`,
    absent.map((k) => `no ${k}.json`),
  );
  fail(
    `${dir} no orphan files`,
    orphan.map((k) => `${k}.json matches no root`),
  );
}

// safeKey must stay injective too, or two roots would share one filename and
// one would silently overwrite the other at generation time.
const bySafe = new Map();
const safeDupes = [];
for (const bw of bwKeys) {
  const k = safeKey(bw);
  if (bySafe.has(k)) safeDupes.push(`"${k}.json" is safeKey of both "${bySafe.get(k)}" and "${bw}"`);
  else bySafe.set(k, bw);
}
fail("safeKey uniqueness", safeDupes);

// The bridge that actually broke: read.html turns a word's Buckwalter root
// (data/morphology/*.json `root`) into a roots-index key with its own inline
// BW_TO_DISPLAY map. That map is a third copy of the transliteration rules,
// unreachable from any generator, so it is compared here against the corpus
// it has to serve. Buckwalter is case-significant — H/S/D/Z/E/$/* are the
// emphatics and ayn/shin/dhal — which is exactly what the old substring
// matcher destroyed by lowercasing.
const readHtml = readFileSync(join(ROOT, "read.html"), "utf8");
const mapSrc = readHtml.match(/const BW_TO_DISPLAY\s*=\s*(\{[\s\S]*?\});/);
if (!mapSrc) {
  failures.push("read.html: BW_TO_DISPLAY not found — the root-detail bridge cannot be verified");
} else {
  // Read the pairs directly rather than converting to JSON: the keys
  // include quoted punctuation (">", "<", "|", "&", "}", "'"), and a
  // blanket quote swap would corrupt the apostrophe entry.
  const map = {};
  for (const m of mapSrc[1].matchAll(
    /(?:"((?:[^"\\]|\\.)*)"|([A-Za-z$*_]))\s*:\s*"((?:[^"\\]|\\.)*)"/g,
  )) {
    map[m[1] !== undefined ? m[1] : m[2]] = m[3];
  }
  if (Object.keys(map).length < 20) {
    failures.push(
      `read.html: BW_TO_DISPLAY parsed to only ${Object.keys(map).length} entries — the literal's shape changed`,
    );
  } else {
    const toDisplay = (bw) => [...bw].map((c) => map[c] || c).join("-");
    // Every root the reader can actually click must resolve.
    const corpusRoots = new Set();
    for (let s = 1; s <= 114; s++) {
      const mo = JSON.parse(readFileSync(join(ROOT, `data/morphology/${s}.json`), "utf8"));
      for (const verse of Object.values(mo))
        for (const w of verse) if (w.root) corpusRoots.add(w.root);
    }
    const unresolvable = [...corpusRoots].filter(
      (bw) => !Object.prototype.hasOwnProperty.call(index, toDisplay(bw)),
    );
    fail(
      "read.html BW_TO_DISPLAY resolves every corpus root",
      unresolvable.map((bw) => `"${bw}" -> "${toDisplay(bw)}", which is not a roots-index key`),
    );
    // And it must agree with roots-summary, not merely land somewhere.
    const disagree = [];
    for (const bw of corpusRoots) {
      const want = latinOf.get(bw);
      if (want && toDisplay(bw) !== want)
        disagree.push(`"${bw}" -> "${toDisplay(bw)}", roots-summary says "${want}"`);
    }
    fail("read.html BW_TO_DISPLAY agrees with roots-summary", disagree);
  }
}

if (failures.length) {
  console.error("check-root-datasets: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(
  `check-root-datasets: OK (${EXPECTED} roots consistent across roots-summary, roots-list, roots-index and ${Object.keys(PER_ROOT_DIRS).length} per-root directories).`,
);
