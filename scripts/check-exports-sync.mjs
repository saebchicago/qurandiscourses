// check-exports-sync.mjs — data/exports/schema.json is the data hub's
// single source of truth, and every surface built on it must agree.
//
//   node scripts/check-exports-sync.mjs
//
// WHY THIS EXISTS. The published tables are the site's most citable
// output, and their accuracy rests on two different guarantees that
// were each only half-covered.
//
// The first is REPRODUCIBILITY: the committed tables must be what the
// committed inputs produce. check-generated-freshness.mjs (#108) gives
// that, by re-running build-exports.mjs and comparing. But it can only
// prove the tables are what the generator produces — if the generator
// dropped or invented rows, a stale-free run would still pass.
//
// The second is CORRESPONDENCE: the tables must agree with the sources
// they claim to derive from, and every surface describing them must
// agree with the tables. Part 9 §D3 recorded that "data/exports/* is
// cross-validated against nothing", and that gap was still open.
//
// It had already produced a live defect. export.html's lede says
// "Fourteen precomputed tables" and the page offered THIRTEEN download
// cards: `dispersion` (1,642 rows, the newest analytic) reached
// schema.json, datapackage.json, croissant.json, the JSON-LD Dataset
// graph and the citable archive — every one of them generated — but
// never reached the hand-written card grid. Search engines were told
// the dataset was at /export; a reader could not download it there.
//
// So the rule this file enforces is: the schema declares the tables,
// and the files, the page, the prose and the corpus must all match it.
//
// A checker, not a generator: writes nothing.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXPORTS = join(ROOT, "data", "exports");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const json = (rel) => JSON.parse(read(rel));

const failures = [];
const unchecked = [];
const fail = (rule, detail) => failures.push({ rule, detail });
const n = (x) => x.toLocaleString("en-US");

const schema = json("data/exports/schema.json");
const tableNames = Object.keys(schema.tables);
const rows = {};
const csvHeader = {};

// ── 1. Declared tables, and only those, exist on disk ────────────────
const META = new Set([
  "schema.json", "datapackage.json", "croissant.json",
  "DATA-DICTIONARY.md", "CITATION-datasets.txt", "RELEASES.json",
]);
const declared = new Set(tableNames.flatMap((t) => [`${t}.csv`, `${t}.json`]));
for (const f of readdirSync(EXPORTS)) {
  if (META.has(f) || f.endsWith(".tar.gz") || declared.has(f)) continue;
  fail("files", `data/exports/${f} is not declared in schema.json`);
}

for (const name of tableNames) {
  const spec = schema.tables[name];
  const fields = (spec.fields || []).map((f) => f.name);
  const csvRel = `data/exports/${name}.csv`;
  const jsonRel = `data/exports/${name}.json`;
  if (!existsSync(join(ROOT, csvRel)) || !existsSync(join(ROOT, jsonRel))) {
    fail("files", `${name} is declared in schema.json but its .csv/.json is missing`);
    continue;
  }
  // ── 2. Shape: header, keys and row counts agree with the schema ────
  const lines = read(csvRel).trimEnd().split("\n");
  csvHeader[name] = lines[0];
  if (lines[0] !== fields.join(","))
    fail("shape", `${name}.csv header is "${lines[0]}", schema declares "${fields.join(",")}"`);
  const data = json(jsonRel);
  rows[name] = data.length;
  if (lines.length - 1 !== data.length)
    fail("shape", `${name}: ${lines.length - 1} CSV rows vs ${data.length} JSON rows`);
  if (data.length) {
    const keys = Object.keys(data[0]);
    if (JSON.stringify(keys) !== JSON.stringify(fields))
      fail("shape", `${name}.json keys ${JSON.stringify(keys)} != schema fields ${JSON.stringify(fields)}`);
  }
}

// ── 3. export.html offers exactly the declared tables ────────────────
// The card grid is hand-written where everything else about a table is
// generated, so this is the join that has actually drifted.
const exportPage = read("export.html");
const carded = [...exportPage.matchAll(/data\/exports\/([a-z-]+)\.csv" download/g)].map((m) => m[1]);
for (const name of tableNames)
  if (!carded.includes(name))
    fail("page", `${name} is a published table with no download card on export.html`);
for (const c of new Set(carded))
  if (!tableNames.includes(c))
    fail("page", `export.html offers a download card for "${c}", which schema.json does not declare`);

// Each card states its own row count next to the link.
for (const name of tableNames) {
  const at = exportPage.indexOf(`data/exports/${name}.csv" download`);
  if (at === -1) continue;
  const near = exportPage.slice(at, at + 400);
  const stated = /&gt;|>([\d,]+) rows</.exec(near);
  if (!stated || !stated[1]) {
    fail("page", `${name}'s card on export.html states no row count`);
    continue;
  }
  const said = Number(stated[1].replace(/,/g, ""));
  if (said !== rows[name])
    fail("page", `${name}'s card says ${n(said)} rows; the table has ${n(rows[name])}`);
}

// ── 4. The table count in prose ──────────────────────────────────────
const WORDS = ["zero","one","two","three","four","five","six","seven","eight","nine","ten",
  "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen","twenty"];
const word = WORDS[tableNames.length] || null;
for (const [rel, text] of [["export.html", exportPage], ["datasets.html", read("datasets.html")]]) {
  for (const m of text.matchAll(/(\w+) (?:precomputed )?tables\b/gi)) {
    const said = m[1].toLowerCase();
    const asNum = /^\d+$/.test(said) ? Number(said) : WORDS.indexOf(said);
    if (asNum === -1) continue; // "the tables", "all tables" — not a count
    if (asNum !== tableNames.length)
      fail("prose", `${rel} says "${m[0]}"; schema.json declares ${tableNames.length}`);
  }
}
if (!word) unchecked.push(`no number-word for ${tableNames.length}; prose checked for the numeral only`);

// ── 5. Counts inside the schema's own descriptions ───────────────────
// These strings are literals in build-exports.mjs, and they propagate
// into datapackage.json, croissant.json and both pages' JSON-LD, so one
// stale figure reaches five machine-readable surfaces at once.
for (const name of tableNames) {
  const desc = schema.tables[name].description || "";
  const data = json(`data/exports/${name}.json`);
  const distinct = (col) =>
    data.length && col in data[0] ? new Set(data.map((r) => r[col])).size : null;
  for (const m of desc.matchAll(/([\d,]+) (rows|roots|surahs)\b/g)) {
    const said = Number(m[1].replace(/,/g, ""));
    const actual =
      m[2] === "rows" ? rows[name]
      : m[2] === "roots" ? distinct("root") ?? distinct("rootBuckwalter")
      : distinct("surah");
    if (actual === null || actual === undefined) {
      unchecked.push(`${name}: "${m[0]}" — no matching column in the table`);
      continue;
    }
    if (said !== actual)
      fail("description", `${name}: description says "${m[0]}", the table has ${n(actual)}`);
  }
}

// ── 6. Correspondence with the sources, recomputed here ──────────────
// Deliberately NOT by calling build-exports.mjs: re-running the
// generator can only prove it is deterministic. These recompute the
// same quantities independently, so a generator that lost rows fails.
const rootsSummary = json("data/roots-summary.json");
const rootBw = Object.keys(rootsSummary);

{
  const rf = json("data/exports/root-frequencies.json");
  const bad = [];
  for (const r of rf) {
    const s = rootsSummary[r.root];
    if (!s) { bad.push(`${r.root} is not in roots-summary.json`); continue; }
    if (s.totalCount !== r.totalCount)
      bad.push(`${r.root}: count ${r.totalCount} vs roots-summary ${s.totalCount}`);
    else if (s.rootLatin !== r.rootLatin || s.rootArabic !== r.arabic)
      bad.push(`${r.root}: transliteration disagrees with roots-summary`);
  }
  if (rf.length !== rootBw.length)
    bad.push(`${rf.length} rows for ${rootBw.length} roots`);
  for (const d of bad.slice(0, 5)) fail("sources", `root-frequencies: ${d}`);
  if (bad.length > 5) fail("sources", `root-frequencies: ... and ${bad.length - 5} more`);
}

{
  const vl = json("data/exports/verse-lengths.json");
  const byRef = new Map(vl.map((r) => [`${r.surah}:${r.verse}`, r.tokens]));
  let verses = 0, tokens = 0, wrong = 0, firstWrong = null;
  for (let s = 1; s <= 114; s++) {
    const m = json(`data/morphology/${s}.json`);
    for (const [v, words] of Object.entries(m)) {
      verses++; tokens += words.length;
      if (byRef.get(`${s}:${v}`) !== words.length) {
        wrong++; firstWrong ||= `${s}:${v}`;
      }
    }
  }
  if (vl.length !== verses)
    fail("sources", `verse-lengths: ${n(vl.length)} rows for ${n(verses)} verses in data/morphology/`);
  if (wrong)
    fail("sources", `verse-lengths: ${wrong} verse(s) disagree with data/morphology/, first ${firstWrong}`);
  // The corpus totals the generators hardcode, measured rather than trusted.
  for (const [label, actual, expected] of [
    ["TOTAL_VERSES", verses, 6236],
    ["TOTAL_TOKENS", tokens, 77429],
    ["TOTAL_ROOTS", rootBw.length, 1642],
  ]) {
    if (actual !== expected)
      fail(
        "corpus",
        `${label} is hardcoded as ${n(expected)} in build-exports.mjs and its siblings, ` +
          `but data/ now holds ${n(actual)}. Normalized frequencies are computed from that ` +
          "constant, so every published rate would be silently wrong.",
      );
  }
}

// Per-root file families must cover exactly the published root set.
{
  const keys = new Set(json("data/exports/root-frequencies.json").map((r) => r.safeKey));
  for (const dir of ["association", "centrality", "dispersion"]) {
    const files = readdirSync(join(ROOT, "data", dir))
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -5));
    const perRoot = files.filter((f) => keys.has(f));
    if (perRoot.length !== keys.size)
      fail("sources", `data/${dir}/: ${n(perRoot.length)} per-root files for ${n(keys.size)} published roots`);
  }
  for (const t of ["centrality", "dispersion"])
    if (rows[t] !== keys.size)
      fail("sources", `${t}: ${n(rows[t])} rows for ${n(keys.size)} published roots`);
}

// Tables whose whole content comes from one committed file.
const SINGLE_SOURCE = [
  ["structure-tests", "data/structure-tests.json", (d) => d.perSurah.length],
  ["formulaic-density", "data/formulaic-density.json", (d) => d.perSurah.length],
  ["discursive-pivots", "data/discursive-pivots.json", (d) => d.occurrences.length],
  ["rhyme-summary", "data/rhyme-summary.json", (d) => Object.keys(d.surahs).length],
];
for (const [table, src, count] of SINGLE_SOURCE) {
  let actual;
  try { actual = count(json(src)); }
  catch { fail("sources", `${table}: could not read its source ${src} in the expected shape`); continue; }
  if (rows[table] !== actual)
    fail("sources", `${table}: ${n(rows[table])} rows vs ${n(actual)} in ${src}`);
}
{
  let sections = 0;
  for (let s = 1; s <= 114; s++) sections += (json(`data/structure/${s}.json`).sections || []).length;
  if (rows.structure !== sections)
    fail("sources", `structure: ${n(rows.structure)} rows vs ${n(sections)} sections in data/structure/`);
}
{
  const streams = ["data/formulas-root.json", "data/formulas-surface.json"]
    .map((p) => { const d = json(p); return (d.formulas || d.ngrams || []).length; });
  const total = streams[0] + streams[1];
  if (rows.formulas !== total)
    fail("sources", `formulas: ${n(rows.formulas)} rows vs ${n(streams[0])} root + ${n(streams[1])} surface = ${n(total)}`);
}

// ── Report ───────────────────────────────────────────────────────────
// Named, never silently dropped: a report that quietly skipped a figure
// would read as "everything checked".
if (unchecked.length) {
  console.log(`check-exports-sync: ${unchecked.length} figure(s) not checkable against a column:`);
  for (const u of unchecked) console.log(`  - ${u}`);
}

if (failures.length) {
  console.error("check-exports-sync: FAIL");
  for (const f of failures) console.error(`  [${f.rule}] ${f.detail}`);
  console.error(
    `\n  ${failures.length} disagreement(s) in the published data hub.\n` +
      "  data/exports/schema.json declares what is published; the files, the\n" +
      "  download page, the prose and the corpus must all match it.",
  );
  process.exit(1);
}

console.log(
  `check-exports-sync: OK (${tableNames.length} tables, ` +
    `${n(Object.values(rows).reduce((a, b) => a + b, 0))} published rows, ` +
    "each cross-validated against its source).",
);
