// check-lenses.mjs — integrity guard for the Reading Lenses registry
// (data/lenses.json, rendered by assets/lenses.js on read/dossier/replay).
// A lens is a published coherence method rendered as UI scaffolding, and
// the registry's whole value is its honesty: what is transcribed, what is
// a blank worksheet, what is an empty overlay. Nothing else at build time
// checks that the khan-outline lens's advertised surah list still matches
// the outlines actually transcribed in data/exercises.json — a surah
// added to (or renamed in) the exercise registry without this file
// following would silently advertise coverage that isn't there, or hide
// coverage that is.
//
// Asserts:
//   - unique ids; name, kind, methodHtml, coverage.statementHtml present;
//     kind is one of data-backed | blank-worksheet | empty-overlay
//   - every token of every sourceIds resolves in data/sources.json
//   - the khan-outline lens's coverage.surahs set-equals the surahs of
//     type=outline entries in data/exercises.json (the honesty invariant)
//   - data-backed lenses carry coverage.surahs; other kinds must NOT
//     (no phantom per-surah availability)
//   - blank-worksheet lenses carry >= 3 questions, each with a unique id
//     and a prompt (reader answers are stored keyed by question id, so a
//     duplicate id would silently merge two answers)
//   - every internal href in methodHtml / statementHtml resolves: the
//     page exists on disk and a #fragment names a real id in that page
//   - the spelled-out outline counts in the khan lens's statementHtml and
//     in index.html's #lensesSection match coverage.surahs.length — the
//     prose stays as honest as the machine-readable list
//
// Run: node scripts/check-lenses.mjs   (exit 1 on any failure)

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readJson } from "./lib/io.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const lenses = readJson("data/lenses.json").lenses || [];
const sourceIds = new Set((readJson("data/sources.json").sources || []).map((s) => s.id));
const outlineSurahs = new Set(
  (readJson("data/exercises.json").exercises || [])
    .filter((e) => e.type === "outline")
    .map((e) => Number(e.surah)),
);

const KINDS = new Set(["data-backed", "blank-worksheet", "empty-overlay", "context-panel"]);
// Kinds whose lens carries reader-answered questions. blank-worksheet is
// nothing but its questions; context-panel renders read-only bundled
// reference data above the same kind of worksheet. Both require >= 3.
const QUESTION_KINDS = new Set(["blank-worksheet", "context-panel"]);
const HREF_RE = /href="([^"]+)"/g;

const failures = [];

function checkHtmlHrefs(label, html) {
  for (const match of String(html || "").matchAll(HREF_RE)) {
    const href = match[1];
    if (/^https?:\/\//.test(href)) continue;
    const [pageAndQuery, fragment] = href.split("#");
    const page = pageAndQuery.split("?")[0];
    if (!page) continue; // same-page fragment
    const file = join(ROOT, page);
    if (!existsSync(file)) {
      failures.push(`${label}: page ${page} does not exist`);
      continue;
    }
    if (fragment && !readFileSync(file, "utf8").includes(`id="${fragment}"`)) {
      failures.push(`${label}: ${page}#${fragment} — no element with that id`);
    }
  }
}

const seenIds = new Set();
for (const lens of lenses) {
  const label = lens.id || "<missing id>";
  if (!lens.id) failures.push("a lens is missing its id");
  else if (seenIds.has(lens.id)) failures.push(`${label}: duplicate lens id`);
  seenIds.add(lens.id);

  for (const key of ["name", "kind", "methodHtml"]) {
    if (!lens[key]) failures.push(`${label}: missing ${key}`);
  }
  if (lens.kind && !KINDS.has(lens.kind)) {
    failures.push(`${label}: unknown kind ${JSON.stringify(lens.kind)}`);
  }
  if (!lens.coverage || !lens.coverage.statementHtml) {
    failures.push(`${label}: missing coverage.statementHtml — every lens states its coverage honestly`);
  }

  for (const token of String(lens.sourceIds || "").split(/\s+/).filter(Boolean)) {
    if (!sourceIds.has(token)) {
      failures.push(`${label}: sourceIds token ${token} not found in data/sources.json`);
    }
  }
  if (!lens.sourceIds) failures.push(`${label}: missing sourceIds`);

  if (lens.kind === "data-backed") {
    const surahs = lens.coverage && lens.coverage.surahs;
    if (!Array.isArray(surahs) || !surahs.length) {
      failures.push(`${label}: data-backed lens must list coverage.surahs`);
    }
  } else if (lens.coverage && "surahs" in lens.coverage) {
    failures.push(`${label}: ${lens.kind} lens must not carry coverage.surahs — it has no per-surah data`);
  }

  if (QUESTION_KINDS.has(lens.kind)) {
    const qs = lens.questions || [];
    if (qs.length < 3) failures.push(`${label}: ${lens.kind} lens needs at least 3 questions`);
    const qIds = new Set();
    for (const [i, q] of qs.entries()) {
      if (!q.id) failures.push(`${label} question ${i + 1}: missing id`);
      else if (qIds.has(q.id)) failures.push(`${label} question ${i + 1}: duplicate id ${q.id}`);
      qIds.add(q.id);
      if (!q.prompt) failures.push(`${label} question ${i + 1}: missing prompt`);
    }
  } else if ("questions" in lens) {
    failures.push(`${label}: questions is set but kind is ${lens.kind} — only ${[...QUESTION_KINDS].join("/")} lenses carry questions`);
  }

  checkHtmlHrefs(`${label} methodHtml`, lens.methodHtml);
  if (lens.coverage) checkHtmlHrefs(`${label} coverage`, lens.coverage.statementHtml);
}

// The honesty invariant: the khan-outline lens advertises exactly the
// surahs whose outlines are transcribed, no more and no fewer.
const khan = lenses.find((l) => l.id === "khan-outline");
if (!khan) {
  failures.push("khan-outline lens missing — the data-backed lens the registry exists to keep honest");
} else {
  const advertised = new Set((khan.coverage && khan.coverage.surahs ? khan.coverage.surahs : []).map(Number));
  for (const s of advertised) {
    if (!outlineSurahs.has(s)) {
      failures.push(`khan-outline: advertises surah ${s} but data/exercises.json has no transcribed outline for it`);
    }
  }
  for (const s of outlineSurahs) {
    if (!advertised.has(s)) {
      failures.push(`khan-outline: surah ${s} has a transcribed outline but is missing from coverage.surahs`);
    }
  }
}

// Prose-count invariant: the khan lens's coverage statement and the
// homepage's lenses section both spell out how many outlines are
// transcribed. The set-equality above keeps the machine-readable list
// honest; these two checks keep the words honest. They are deliberately
// brittle: rewording either sentence must move the checker in the same
// commit — that is the sync bell, not an accident.
const WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, twentyone: 21, twentytwo: 22, twentythree: 23,
  twentyfour: 24, twentyfive: 25, twentysix: 26, twentyseven: 27,
  twentyeight: 28, twentynine: 29, thirty: 30,
};
function numberOf(token) {
  if (/^\d+$/.test(token)) return Number(token);
  return WORDS[token.toLowerCase().replace(/-/g, "")] ?? null;
}

if (khan && khan.coverage && khan.coverage.surahs) {
  const transcribed = khan.coverage.surahs.length;

  const stmt = String(khan.coverage.statementHtml || "");
  const mStmt = stmt.match(/^(\S+)\s+surahs?\s+ha(?:ve|s)\s+transcribed/i);
  if (!mStmt) {
    failures.push(
      "khan-outline: statementHtml no longer opens with \"<count> surahs have transcribed…\" — reword this checker in the same commit so the prose count stays guarded",
    );
  } else if (numberOf(mStmt[1]) !== transcribed) {
    failures.push(
      `khan-outline: statementHtml says "${mStmt[1]}" but coverage.surahs has ${transcribed} — update the prose`,
    );
  }

  const indexHtml = readFileSync(join(ROOT, "index.html"), "utf8");
  const sectionStart = indexHtml.indexOf('id="lensesSection"');
  const section =
    sectionStart === -1
      ? ""
      : indexHtml.slice(sectionStart, indexHtml.indexOf("</section>", sectionStart));
  const mIndex = section.match(/(\S+)\s+of Khan(?:'|’)s published outlines/i);
  if (!mIndex) {
    failures.push(
      "index.html #lensesSection: the \"<count> of Khan's published outlines\" sentence is gone — reword this checker in the same commit so the prose count stays guarded",
    );
  } else if (numberOf(mIndex[1]) !== transcribed) {
    failures.push(
      `index.html #lensesSection says "${mIndex[1]}" of Khan's published outlines but coverage.surahs has ${transcribed} — update the prose`,
    );
  }
}

if (failures.length) {
  console.error("check-lenses: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(
  `check-lenses: OK (${lenses.length} lenses; khan-outline coverage matches ${outlineSurahs.size} transcribed outlines)`,
);
