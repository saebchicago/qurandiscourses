// Independent check of scripts/lib/association-by-period.mjs: recount a sample
// of pairs straight from the token files and compare.
//   node scripts/association-by-period.test.mjs
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { associationByPeriod, PERIODS } from "./lib/association-by-period.mjs";
import { cells, logOddsRatio } from "./lib/association-measures.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const fail = (m) => { failures++; console.error("FAIL " + m); };

const r = associationByPeriod(ROOT);
const chron = JSON.parse(readFileSync(join(ROOT, "data/chronology.json"), "utf8"));

// pairs in the published table
const pairsCsv = readFileSync(join(ROOT, "data/exports/association-pairs.csv"), "utf8").trim().split("\n").length - 1;
if (r.rows.length !== pairsCsv) fail(`rows ${r.rows.length} != association-pairs ${pairsCsv}`);

// recount from morphology: for each surah, the set of roots per verse
const verseRoots = []; // { period, roots:Set }
for (let s = 1; s <= 114; s++) {
  const m = JSON.parse(readFileSync(join(ROOT, `data/morphology/${s}.json`), "utf8"));
  for (const v of Object.values(m)) verseRoots.push({ period: chron[s].period, roots: new Set(v.filter((w) => w.root).map((w) => w.root)) });
}
const periodN = Object.fromEntries(PERIODS.map((p) => [p, verseRoots.filter((x) => x.period === p).length]));
for (const p of PERIODS) if (periodN[p] !== r.periodVerses[p]) fail(`period verses ${p}: ${periodN[p]} vs ${r.periodVerses[p]}`);

const sample = r.rows.filter((_, i) => i % 400 === 0);
for (const row of sample) {
  for (const p of PERIODS) {
    let a = 0, b = 0, both = 0;
    for (const v of verseRoots) {
      if (v.period !== p) continue;
      const ha = v.roots.has(row.rootA), hb = v.roots.has(row.rootB);
      if (ha) a++;
      if (hb) b++;
      if (ha && hb) both++;
    }
    if (row[`shared_${p}`] !== both) fail(`${row.rootA}/${row.rootB} ${p}: shared ${row[`shared_${p}`]} vs recount ${both}`);
    if (a > 0 && b > 0) {
      const l = logOddsRatio(cells(both, a, b, periodN[p]));
      if (Math.abs(row[`logOddsRatio_${p}`] - Math.round(l.lor * 1000) / 1000) > 1e-9) fail(`${row.rootA}/${row.rootB} ${p}: lor`);
    } else if (row[`logOddsRatio_${p}`] !== null) fail(`${row.rootA}/${row.rootB} ${p}: lor should be null`);
  }
}
if (sample.length < 10) fail("sample too small");
// BH q is never below p, and a Q of 0 gives p 1
for (const row of r.rows) {
  if (row.heterogeneityP != null && row.heterogeneityBhQ < row.heterogeneityP - 1e-12) fail(`q < p for ${row.rootA}/${row.rootB}`);
}
if (failures) { console.error(`association-by-period.test: ${failures} failure(s)`); process.exit(1); }
console.log(`association-by-period.test: OK (${sample.length} pairs recounted from the token files).`);
