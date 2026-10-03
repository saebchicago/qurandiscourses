#!/usr/bin/env node
//
// check-word-timings-state.mjs — is word highlighting enabled only where
// the evidence says it fits?
//
// Offline. Reads data/recitation/word-timings-report.json and the
// data/recitation/words/ tree and fails when they disagree:
//   - every reciter in `bundled` has a candidate with pass: true, and a
//     words/<reciter>/ directory holding 114 surah files;
//   - every directory under words/ is listed in `bundled`;
//   - a candidate with pass: true has all four verdicts true.
// Passing proves the shipped state matches the report, not that timings
// align with the audio: that is what scripts/build-word-timings.mjs
// measures on a networked runner. With nothing bundled the check passes
// and word highlighting stays unavailable.
//
// Run: node scripts/check-word-timings-state.mjs

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./lib/page-shell.mjs";

const report = JSON.parse(readFileSync(join(ROOT, "data/recitation/word-timings-report.json"), "utf8"));
const wordsDir = join(ROOT, "data/recitation/words");
const bundled = Array.isArray(report.bundled) ? report.bundled : null;
const problems = [];
if (!bundled) problems.push("report.bundled is not an array");
else {
  for (const c of report.candidates || []) {
    const v = c.verdict || {};
    const all = v.coverage === true && v.agreement === true && v.speedOk === true && v.onsetOk === true;
    if (c.pass === true && !all) problems.push(`${c.reciter}: pass is true but a verdict is not`);
  }
  for (const r of bundled) {
    if (!(report.candidates || []).some((c) => c.reciter === r && c.pass === true))
      problems.push(`${r}: bundled without a passing candidate`);
    const dir = join(wordsDir, r);
    const n = existsSync(dir) ? readdirSync(dir).filter((f) => /^\d+\.json$/.test(f)).length : 0;
    if (n !== 114) problems.push(`${r}: ${n} surah timing files, expected 114`);
  }
  const onDisk = existsSync(wordsDir) ? readdirSync(wordsDir) : [];
  for (const d of onDisk) if (!bundled.includes(d)) problems.push(`${d}: timings on disk but not in report.bundled`);
}
if (problems.length) {
  console.error("check-word-timings-state: FAIL\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(
  `check-word-timings-state: OK (${bundled.length ? "highlighting enabled for " + bundled.join(", ") : "nothing bundled; highlighting unavailable"}).`,
);
