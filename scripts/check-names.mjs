// check-names.mjs — integrity guard for the proper-noun name registry
// (data/name-mentions.json, computed by build-name-mentions.mjs, and
// data/names.json, the hand-kept editorial display map the history lens
// renders). The computed file's freshness against the morphology is the
// generator's own --check; this checker guards the two files' internal
// consistency and their join — an editorial label pointing at a lemma
// the corpus doesn't have would silently render nothing, and a computed
// entry whose counts don't sum would misreport distribution behind a
// Verified badge.
//
// Asserts:
//   - name-mentions: _source resolves in data/sources.json; every lemma
//     has a nonempty ar, total >= 1, surahCount >= 1; bySurah keys are
//     "1".."114"; sum(bySurah) === total; |bySurah| === surahCount
//   - names.json: every key exists in name-mentions' lemmas (editorial
//     is a subset of computed — the join invariant); every entry has a
//     nonempty latin
//
// Run: node scripts/check-names.mjs   (exit 1 on any failure)

import { readJson } from "./lib/io.mjs";

const mentions = readJson("data/name-mentions.json");
const names = readJson("data/names.json").names || {};
const sourceIds = new Set((readJson("data/sources.json").sources || []).map((s) => s.id));

const failures = [];

if (!mentions._source || !sourceIds.has(mentions._source)) {
  failures.push(`name-mentions: _source ${JSON.stringify(mentions._source)} not found in data/sources.json`);
}

const lemmas = mentions.lemmas || {};
for (const [lemma, e] of Object.entries(lemmas)) {
  const label = `name-mentions ${lemma}`;
  if (!e.ar) failures.push(`${label}: missing ar`);
  if (!Number.isInteger(e.total) || e.total < 1) failures.push(`${label}: total must be >= 1`);
  if (!Number.isInteger(e.surahCount) || e.surahCount < 1) failures.push(`${label}: surahCount must be >= 1`);
  const bySurah = e.bySurah || {};
  let sum = 0;
  for (const [s, n] of Object.entries(bySurah)) {
    const sn = Number(s);
    if (!Number.isInteger(sn) || sn < 1 || sn > 114) failures.push(`${label}: bySurah key ${s} out of range 1-114`);
    if (!Number.isInteger(n) || n < 1) failures.push(`${label}: bySurah[${s}] must be >= 1`);
    sum += n;
  }
  if (sum !== e.total) failures.push(`${label}: sum(bySurah)=${sum} != total=${e.total}`);
  if (Object.keys(bySurah).length !== e.surahCount) {
    failures.push(`${label}: |bySurah|=${Object.keys(bySurah).length} != surahCount=${e.surahCount}`);
  }
}

for (const [lemma, entry] of Object.entries(names)) {
  if (!(lemma in lemmas)) {
    failures.push(`names.json ${lemma}: no such PN lemma in data/name-mentions.json — editorial labels must be a subset of the computed set`);
  }
  if (!entry.latin) failures.push(`names.json ${lemma}: missing latin`);
}

if (failures.length) {
  console.error("check-names: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(
  `check-names: OK (${Object.keys(lemmas).length} computed lemmas, ${Object.keys(names).length} editorial labels, counts consistent)`,
);
