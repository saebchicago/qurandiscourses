// build-root-refs-index.mjs — deterministic, zero-dependency generator
// for the per-page lookup tables in assets/root-refs/, the small
// whitelists that let refs.js turn root mentions in page prose
// (e.g. "r-ḥ-m") into live popovers WITHOUT downloading the 1.9 MB
// roots-summary.json just to detect them.
//
// WHY PER PAGE. This used to emit ONE table, assets/root-refs.js:
// 1,944 entries, 128,998 bytes, shipped to 10 pages. Driven in a
// browser, those 10 pages wrap 25 distinct tokens between them — 1.3%
// of the table — and five of them wrap nothing at all. about.html, a
// page of prose, was paying 126 KB of lookup table for zero wraps.
// Each page now gets only the tokens its own markup could match: 38
// entries across 7 tables, 5,560 bytes in total.
//
// WHY A PERMISSIVE SCAN IS CORRECT. The table is a WHITELIST: refs.js
// wraps a token only if it resolves here, and applies its own DOM skip
// rules (translate="no", data-norefs, already-wrapped nodes, #main
// only) at runtime regardless. So over-including a token costs a few
// bytes and changes nothing, while under-including one silently drops
// a popover. Everything here is therefore biased toward including
// more: the whole file is scanned, not just #main, inline script
// bodies are scanned as text (an inline script that writes prose runs
// before DOMContentLoaded, so refs.js does see what it produced), and
// none of refs.js's skip rules are replicated.
//
// Two key spaces, unchanged:
//   exact       lowercased rootLatin as written on the site, diacritics
//               kept ("ṣ-b-r") — always unambiguous
//   normalized  ask.js-style ASCII fold ("s-b-r") — indexed ONLY when
//               exactly one root normalizes to it (141 of 1,642 roots
//               collide after folding, e.g. ṣ-l-w vs s-l-w; wrapping an
//               ambiguous plain-ASCII token would guess, so refs.js
//               simply leaves those unwrapped unless written with
//               diacritics)
//
// Run: node scripts/build-root-refs-index.mjs
// Determinism check: run twice, `git diff` must be empty.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { safeKey } from "./lib/safe-key.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const summary = JSON.parse(
  readFileSync(join(ROOT, "data", "roots-summary.json"), "utf8"),
);

// Pages that carried the feature and deliberately no longer do, because
// the scan below finds nothing in their markup to wrap. Declared rather
// than inferred, and then CHECKED both ways: a page listed here that
// gains a root mention fails this generator, which is the only thing
// standing between "we removed a script from a page with nothing to
// wrap" and "a popover silently stopped appearing".
//
// Only pages with a STATICALLY empty scan are listed. paths.html and
// validation.html also render zero .qd-ref spans in a browser, but they
// do contain root mentions — refs.js wraps them and a later
// JSON-driven render replaces the container. Dropping the scripts there
// would rest on an argument about that ordering rather than on the
// whitelist being empty, so they keep their (sub-1 KB) tables.
const OPTED_OUT = {
  "about.html": "no root mention anywhere in its markup",
  "exercises.html": "no root mention anywhere in its markup",
  "sources.html": "no root mention anywhere in its markup",
};

// Mirrors normalize() in assets/ask.js — keep in sync.
function normalize(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[‘’'`]/g, "")
    .replace(/[ʿʾ]/g, "")
    .replace(/[āáà]/g, "a")
    .replace(/[īíì]/g, "i")
    .replace(/[ūúù]/g, "u")
    .replace(/[ḥ]/g, "h")
    .replace(/[ṣ]/g, "s")
    .replace(/[ḍ]/g, "d")
    .replace(/[ṭ]/g, "t")
    .replace(/[ẓ]/g, "z");
}

// ── The full table, exactly as before ────────────────────────────────
const exact = {};
const normCounts = {};
const normEntry = {};

for (const bw of Object.keys(summary).sort()) {
  const r = summary[bw];
  const entry = { k: safeKey(bw), a: r.rootArabic, l: r.rootLatin, bw };
  exact[r.rootLatin.toLowerCase()] = entry;
  const n = normalize(r.rootLatin);
  // Folding ʿ/' can produce malformed keys with empty segments — never
  // index those.
  if (/(^-|--|-$)/.test(n)) continue;
  normCounts[n] = (normCounts[n] || 0) + 1;
  normEntry[n] = entry;
}

const merged = { ...exact };
let ambiguous = 0;
for (const n of Object.keys(normEntry).sort()) {
  if (normCounts[n] > 1) {
    ambiguous++;
    continue; // plain-ASCII form is ambiguous: leave unwrapped
  }
  if (!merged[n]) merged[n] = normEntry[n];
}

// ── Which tokens could a page match? ─────────────────────────────────
// The candidate pattern is refs.js's ROOT_TOKEN, made global. Keeping
// the two in sync matters in one direction only: this one must be at
// least as permissive as refs.js's.
const ROOT_TOKEN =
  /(^|[^A-Za-zʿʾĀ-ỿ-])((?:[a-zʿʾḥṣḍṭẓāīū'‘’]{1,2})(?:[-.](?:[a-zʿʾḥṣḍṭẓāīū'‘’]{1,2})){2,3})(?![A-Za-zĀ-ỿ-])/g;

// Markup to text. Tags go, their contents stay — including <script>
// bodies, deliberately (see the header). Numeric entities are decoded;
// named ones become a space, which can only split a candidate token,
// never invent one.
function toText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&[a-zA-Z][a-zA-Z0-9]*;/g, " ");
}

// The keys refs.js could reach for this token, in its own lookup order.
function keysFor(token) {
  const t = token.toLowerCase().replace(/\./g, "-");
  const keys = [];
  if (merged[t]) keys.push(t);
  const n = normalize(t);
  if (n !== t && merged[n]) keys.push(n);
  return keys;
}

function tokensIn(html) {
  const text = toText(html);
  const found = new Set();
  for (const m of text.matchAll(ROOT_TOKEN)) for (const k of keysFor(m[2])) found.add(k);
  return found;
}

// ── Emit one table per page that loads refs.js ───────────────────────
const pages = readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
const OUT_DIR = join(ROOT, "assets", "root-refs");

const wired = [];
const problems = [];
for (const file of pages) {
  const html = readFileSync(join(ROOT, file), "utf8");
  const loadsRefs = html.includes('src="assets/refs.js"');
  const optedOut = Object.prototype.hasOwnProperty.call(OPTED_OUT, file);

  if (loadsRefs && optedOut) {
    problems.push(
      `${file} is listed as opted out (${OPTED_OUT[file]}) but still loads assets/refs.js.`,
    );
    continue;
  }
  if (!loadsRefs && !optedOut) continue; // never had the feature

  const tokens = [...tokensIn(html)].sort();
  const page = file.replace(/\.html$/, "");
  // A page loading refs.js with SOMEONE ELSE's table (a mistyped src)
  // would ship a whitelist that silently wraps the wrong set. The tag
  // is checked, not assumed.
  if (loadsRefs && !html.includes(`src="assets/root-refs/${page}.js"`)) {
    problems.push(
      `${file} loads assets/refs.js but not its own table. It needs\n` +
        `      <script src="assets/root-refs/${page}.js" defer></script>\n` +
        "      before that line.",
    );
    continue;
  }
  if (optedOut) {
    if (tokens.length) {
      problems.push(
        `${file} is listed as opted out (${OPTED_OUT[file]}) but its markup now ` +
          `contains root mention(s): ${tokens.join(", ")}. Either re-add\n` +
          `      <script src="assets/root-refs/${file.replace(/\.html$/, "")}.js" defer></script>\n` +
          `      <script src="assets/refs.js" defer></script>\n` +
          "      to the page and drop it from OPTED_OUT, or the mention will not be wrapped.",
      );
    }
    continue;
  }
  wired.push({ page, tokens });
}

if (problems.length) {
  console.error("build-root-refs-index: FAIL");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

// The directory is rebuilt from scratch so a page that stops loading
// refs.js cannot leave an orphan table behind.
if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

let bytes = 0;
for (const { page, tokens } of wired) {
  const lines = tokens.map((key) => {
    const e = merged[key];
    return `  ${JSON.stringify(key)}: { k: ${JSON.stringify(e.k)}, a: ${JSON.stringify(e.a)}, l: ${JSON.stringify(e.l)}, bw: ${JSON.stringify(e.bw)} },`;
  });
  const out = `// GENERATED by scripts/build-root-refs-index.mjs — do not edit.
// Lookup for assets/refs.js on ${page}.html ONLY: token (lowercased,
// exact-diacritic or unambiguous ASCII-folded root Latin) -> { k: safeKey,
// a: Arabic, l: display Latin, bw: Buckwalter }. Holds the tokens this
// page's own markup could match, nothing else; ambiguous folded forms
// are deliberately absent — see the generator header.
window.ROOT_REFS = {
${lines.join("\n")}
};
`;
  writeFileSync(join(OUT_DIR, `${page}.js`), out);
  bytes += Buffer.byteLength(out);
}

console.log(
  `root-refs: ${wired.length} page tables, ${wired.reduce((n, w) => n + w.tokens.length, 0)} entries, ` +
    `${bytes} bytes total (full table: ${Object.keys(merged).length} keys, ${ambiguous} ambiguous folded forms skipped).`,
);
