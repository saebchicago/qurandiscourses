// check-wbw-credit.mjs — credit checker for the runtime word-by-word
// meanings on the Read page (assets/wordbw.js).
//
// The repo's standing rule is that nothing is cited from memory. The
// `qcf-wbw-en` entry in data/sources.json currently credits the
// Quran.com Foundation, with a note saying an individual translator
// credit replaces that IF the endpoint names one — a claim written
// from the API's documented behavior, not from a live response,
// because the sandbox that added the feature could not reach
// api.quran.com. This script closes that gap: run it once from an
// unrestricted machine and it says whether the recorded credit matches
// what the endpoint actually serves.
//
// DISCOVERY, NOT ASSERTION. The response shape for word-level
// attribution could not be verified when this was written, so the
// script prints what it finds and marks anything speculative
// "candidate (unverified)". It never claims a field exists. Read its
// output; do not read a passing exit code as proof of a credit.
//
// A checker, not a generator: writes nothing, so the determinism rule
// does not apply. Needs real outbound network to api.quran.com —
// sandboxed sessions with an allowlisting proxy will see spurious
// failures; run it from an unrestricted machine.
//
// Verdicts:
//   OK             a discovered credit matches sources.json      exit 0
//   REVIEW         nothing conclusive found — read the payload    exit 0
//   ACTION NEEDED  a different credit is served                   exit 1
//
// Ambiguity deliberately does not fail: only a contradiction does, so
// the weekly scheduled job stays quiet unless something really changed.
//
// Run:  node scripts/check-wbw-credit.mjs [--json] [--surah N]

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computedDate } from "./lib/computed-date.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const DUMP_JSON = args.includes("--json");
const surahArg = args.indexOf("--surah");
const SURAH = surahArg >= 0 ? parseInt(args[surahArg + 1], 10) : 103;
if (!(SURAH >= 1 && SURAH <= 114)) {
  console.error("check-wbw-credit: --surah must be 1-114");
  process.exit(2);
}

// ── The request, parsed out of the module that makes it ─────────────
// Hard-coding the URL here would let this check drift from what the
// site actually asks for; check-editions.mjs parses assets/app.js for
// the same reason.
const wordbw = readFileSync(join(ROOT, "assets", "wordbw.js"), "utf8");
const apiMatch = wordbw.match(/var API = "([^"]+)"/);
const perPageMatch = wordbw.match(/var PER_PAGE = (\d+)/);
const queryMatch = wordbw.match(/"(\?language=[^"]+)"/);
if (!apiMatch || !perPageMatch || !queryMatch) {
  console.error(
    "check-wbw-credit: FAIL — could not parse the endpoint out of " +
      "assets/wordbw.js (API / PER_PAGE / query template). The module " +
      "changed shape; update this parser so the check cannot drift from " +
      "what the site requests.",
  );
  process.exit(2);
}
const API = apiMatch[1];
const PER_PAGE = perPageMatch[1];
// The query lives in wordbw.js as a concatenation:
//   "?language=en&words=true&word_fields=text_uthmani&per_page=" +
//   PER_PAGE + "&page=" + page
const QUERY = queryMatch[1] + PER_PAGE + "&page=1";
const verseUrl = `${API}${SURAH}${QUERY}`;

console.log(`Endpoint (parsed from assets/wordbw.js):\n  ${verseUrl}\n`);

async function getJson(url, timeout = 20000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
  return { status: res.status, ok: res.ok, body: res.ok ? await res.json() : null };
}

// ── 1. The request the site actually makes ──────────────────────────
let verseResp;
try {
  verseResp = await getJson(verseUrl);
} catch (e) {
  console.error(
    `check-wbw-credit: FAIL — network error reaching api.quran.com: ${e.message}`,
  );
  console.error(
    "If this is a sandboxed/proxied environment, re-run from an unrestricted machine.",
  );
  process.exit(2);
}
if (!verseResp.ok) {
  console.error(`check-wbw-credit: FAIL — HTTP ${verseResp.status} from api.quran.com`);
  process.exit(2);
}

const verses = (verseResp.body && verseResp.body.verses) || [];
if (!verses.length) {
  console.error(
    "check-wbw-credit: FAIL — the response carried no verses[]. Either the " +
      "endpoint changed shape (assets/wordbw.js would be rendering nothing) " +
      "or the surah number is wrong.",
  );
  process.exit(2);
}
console.log(`Received ${verses.length} verses.\n`);

if (DUMP_JSON) {
  console.log("── Raw first verse ─────────────────────────────────");
  console.log(JSON.stringify(verses[0], null, 2));
  console.log("");
}

const firstWord = (verses[0].words || []).find((w) => w && w.char_type_name === "word");
console.log("── First word entry, as served ─────────────────────");
console.log(JSON.stringify(firstWord ?? null, null, 2));
console.log("");

// Every key anywhere under verses[].words[] whose name could carry an
// attribution, with one sample value each. This is the evidence to
// read — it is deliberately broad rather than targeted at a field path
// this script cannot verify exists. Breadth is safe here because this
// list is only PRINTED; the credit comparison below draws from a much
// narrower set (see ATTRIBUTION_KEY).
const CREDIT_KEY = /translat|author|resource|language|name|copyright|source/i;
const found = new Map(); // dotted key path -> sample value
function walk(node, path) {
  if (node === null || typeof node !== "object") {
    if (CREDIT_KEY.test(path) && !found.has(path)) found.set(path, node);
    return;
  }
  if (Array.isArray(node)) {
    if (node.length) walk(node[0], `${path}[]`);
    return;
  }
  for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
}
for (const v of verses) for (const w of v.words || []) walk(w, "words[]");

console.log("── Attribution-shaped fields under words[] ─────────");
if (found.size === 0) {
  console.log("  (none)");
} else {
  for (const [k, v] of [...found].sort()) {
    console.log(`  ${k} = ${JSON.stringify(v)}`);
  }
}
console.log("");

// ── 2. Candidate metadata endpoints ─────────────────────────────────
// Unverified: these are plausible v4 resource endpoints, probed so the
// owner sees what exists rather than being sent to read docs. A 404 is
// information, never a failure.
const origin = new URL(API).origin;
const CANDIDATES = [
  `${origin}/api/v4/resources/translations`,
  `${origin}/api/v4/resources/languages`,
];
console.log("── Candidate metadata endpoints (unverified) ───────");
const candidateHits = [];
for (const url of CANDIDATES) {
  let r;
  try {
    r = await getJson(url);
  } catch (e) {
    console.log(`  ${url}\n    → error: ${e.message}`);
    continue;
  }
  console.log(`  ${url}\n    → HTTP ${r.status}`);
  if (!r.ok) continue;
  // Anything that mentions word-by-word in any string field.
  const text = JSON.stringify(r.body);
  const matches = text.match(/"[^"]*word[ _-]?by[ _-]?word[^"]*"/gi) || [];
  if (matches.length) {
    const uniq = [...new Set(matches)].slice(0, 10);
    console.log(`    → mentions word-by-word: ${uniq.join(", ")}`);
    candidateHits.push(...uniq.map((m) => m.replace(/^"|"$/g, "")));
  } else {
    console.log("    → no word-by-word mention");
  }
}
console.log("");

// ── 3. Compare against the recorded credit ──────────────────────────
const sources = JSON.parse(readFileSync(join(ROOT, "data", "sources.json"), "utf8"));
const entry = (sources.sources || []).find((s) => s.id === "qcf-wbw-en");
if (!entry) {
  console.error(
    "check-wbw-credit: FAIL — no qcf-wbw-en entry in data/sources.json. The " +
      "Read page renders a badge pointing at that id; it must exist.",
  );
  process.exit(2);
}
const recorded = String(entry.author || "");
console.log(`Recorded credit (data/sources.json → qcf-wbw-en.author):\n  ${recorded}\n`);

// Which of the printed fields may be READ AS A CREDIT. Far narrower
// than the discovery regex above, and for a concrete reason: the gloss
// itself lives at words[].translation.text, so a broad rule reads the
// English meaning of the first word ("By the time") as an authorship
// claim and cries wolf on every run. Content fields and language
// labels are excluded by key, not by guessing at their values.
const CONTENT_LEAF = /^(text|text_uthmani|text_imlaei|text_indopak|text_simple)$/i;
const LABEL_LEAF = /^(language_name|language|char_type_name)$/i;
const ATTRIBUTION_KEY = /(author|translator|copyright|resource|source|name)/i;
const isCreditKey = (path) => {
  const leaf = path.split(".").pop().replace(/\[\]$/, "");
  if (CONTENT_LEAF.test(leaf) || LABEL_LEAF.test(leaf)) return false;
  return ATTRIBUTION_KEY.test(leaf);
};

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const served = [
  ...[...found].filter(([k]) => isCreditKey(k)).map(([, v]) => v),
  ...candidateHits,
]
  .filter((v) => typeof v === "string" && v.trim().length > 3)
  .filter((v) => !/^(en|ar|english|arabic|word|text|true|false)$/i.test(v.trim()))
  .map((v) => v.trim());

const uniqueServed = [...new Set(served)];
const matched = uniqueServed.filter((v) => {
  const a = norm(v);
  const b = norm(recorded);
  return a && b && (a.includes(b) || b.includes(a));
});

// A served string only contradicts the record if it reads like a
// credit — a personal or organizational name — rather than a language
// label or a translation title.
const NAME_SHAPED =
  /(foundation|institute|project|press|university|trust|society|academy|publisher|\bdr\.?\b|\bms\.?\b|\bmr\.?\b|shaikh|khan|khatri|translated by|compiled by)/i;
const contradicting = uniqueServed.filter(
  (v) => !matched.includes(v) && NAME_SHAPED.test(v),
);

if (matched.length) {
  console.log("check-wbw-credit: OK — the endpoint serves a credit matching");
  console.log(`  the recorded one: ${matched.map((m) => JSON.stringify(m)).join(", ")}`);
  console.log("  Nothing to change.");
  process.exit(0);
}

if (contradicting.length) {
  console.log("check-wbw-credit: ACTION NEEDED — the endpoint names a credit");
  console.log("  that does not match what data/sources.json records.\n");
  console.log(`  Served:   ${contradicting.map((c) => JSON.stringify(c)).join(", ")}`);
  console.log(`  Recorded: ${JSON.stringify(recorded)}\n`);
  console.log("  Apply, replacing <credit> with the served name verbatim:\n");
  console.log(
    JSON.stringify(
      { ...entry, author: "<credit>", accessed: computedDate() },
      null,
      2,
    )
      .split("\n")
      .map((l) => "    " + l)
      .join("\n"),
  );
  console.log("");
  console.log("  Then mirror the author in sources.html's bibliography line and run");
  console.log("  node scripts/check-claims.mjs && node scripts/check-source-links.mjs");
  process.exit(1);
}

console.log("check-wbw-credit: REVIEW — nothing conclusive.");
console.log(
  "  The endpoint exposed no attribution-shaped credit this script could\n" +
    "  match or contradict. Read the first word entry printed above:\n" +
    "    · no translator named anywhere → the Foundation credit stands, and\n" +
    "      the note already on the qcf-wbw-en entry is the honest phrasing;\n" +
    "    · a translator named in a field this script did not surface → record\n" +
    "      it as the author, set accessed to " + computedDate() + ", and mirror\n" +
    "      it in sources.html.",
);
process.exit(0);
