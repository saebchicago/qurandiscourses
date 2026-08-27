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

const KINDS = new Set(["data-backed", "blank-worksheet", "empty-overlay"]);
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

  if (lens.kind === "blank-worksheet") {
    const qs = lens.questions || [];
    if (qs.length < 3) failures.push(`${label}: blank-worksheet lens needs at least 3 questions`);
    const qIds = new Set();
    for (const [i, q] of qs.entries()) {
      if (!q.id) failures.push(`${label} question ${i + 1}: missing id`);
      else if (qIds.has(q.id)) failures.push(`${label} question ${i + 1}: duplicate id ${q.id}`);
      qIds.add(q.id);
      if (!q.prompt) failures.push(`${label} question ${i + 1}: missing prompt`);
    }
  } else if ("questions" in lens) {
    failures.push(`${label}: questions is set but kind is ${lens.kind} — only blank-worksheet lenses carry questions`);
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

if (failures.length) {
  console.error("check-lenses: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(
  `check-lenses: OK (${lenses.length} lenses; khan-outline coverage matches ${outlineSurahs.size} transcribed outlines)`,
);
