// association-by-period.mjs: does a root pair's association hold across the
// four revelation periods, or does it belong to one?
//
// For every pair in the association-pairs table (each root's top 25 partners
// by LLR, at least 5 shared verses overall), the verse-level 2x2 is rebuilt
// inside each period (N = that period's verse count; a root "occurs" in a
// verse if any token carries it) and the log odds ratio with its Wald 95%
// interval is computed per period. Cochran's Q across the periods that have
// both roots tests whether the estimates are consistent with one common
// association; Q is referred to chi-square with (periods - 1) degrees of
// freedom and the p-values are BH-adjusted over all pairs.
//
// Source: data/root-analytics/*.json (each root's verses, from Leeds v0.4),
// data/chronology.json (Noldeke-Bell periods, one scheme among several) and
// data/exports/association-pairs.csv for the pair list. Counts are checked:
// the four period joint counts must sum to the published sharedVerses. Run by
// build-exports.mjs after the association-pairs table is written.
//
// Deterministic, no randomness.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cells, logOddsRatio, cochranQ } from "./association-measures.mjs";
import { chiSquareUpperTail, bhAdjust } from "./stats.mjs";
import { safeKey } from "./safe-key.mjs";

export const PERIODS = ["meccan-early", "meccan-middle", "meccan-late", "medinan"];
const ALPHA = 0.05;

/**
 * Rebuild every association-pairs pair inside each revelation period.
 * root: the repository root. Returns { rows, periodVerses, summary }.
 */
export function associationByPeriod(ROOT, { periodOfRef = null } = {}) {
  const chron = JSON.parse(readFileSync(join(ROOT, "data", "chronology.json"), "utf8"));
  // periodOfRef("s:v") overrides the chronology: the calibration passes verse
  // labels drawn at random (scripts/build-calibration.mjs).
  const periodOf = periodOfRef || ((ref) => chron[Number(ref.split(":")[0])].period);
  const periodVerses = Object.fromEntries(PERIODS.map((p) => [p, 0]));
  for (let s = 1; s <= 114; s++) {
    const m = JSON.parse(readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"));
    for (const v of Object.keys(m)) periodVerses[periodOf(`${s}:${v}`)]++;
  }

  // pair list: association-pairs.csv, columns rootA, rootASafeKey, rootALatin, rootB, ...
  const csv = readFileSync(join(ROOT, "data", "exports", "association-pairs.csv"), "utf8").trim().split("\n");
  const head = csv[0].split(",");
  const col = Object.fromEntries(head.map((h, i) => [h, i]));
  const pairs = csv.slice(1).map((l) => {
    const c = l.split(",");
    return { a: c[col.rootA], b: c[col.rootB], shared: Number(c[col.sharedVerses]) };
  });

  const cache = new Map();
  function versesByPeriod(bw) {
    if (!cache.has(bw)) {
      const d = JSON.parse(readFileSync(join(ROOT, "data", "root-analytics", `${safeKey(bw)}.json`), "utf8"));
      const per = Object.fromEntries(PERIODS.map((p) => [p, new Set()]));
      for (const ref of d.verses) per[periodOf(ref)].add(ref);
      cache.set(bw, per);
    }
    return cache.get(bw);
  }

  const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
  const rows = pairs.map((pr) => {
    const A = versesByPeriod(pr.a);
    const B = versesByPeriod(pr.b);
    const row = { rootA: pr.a, rootASafeKey: safeKey(pr.a), rootB: pr.b, rootBSafeKey: safeKey(pr.b) };
    const est = [];
    let sharedSum = 0;
    const joint = {};
    for (const p of PERIODS) {
      let k11 = 0;
      for (const x of A[p]) if (B[p].has(x)) k11++;
      sharedSum += k11;
      joint[p] = k11;
      row[`shared_${p}`] = k11;
    }
    for (const p of PERIODS) {
      if (A[p].size > 0 && B[p].size > 0) {
        const l = logOddsRatio(cells(joint[p], A[p].size, B[p].size, periodVerses[p]));
        row[`logOddsRatio_${p}`] = round(l.lor, 3);
        row[`lo95_${p}`] = round(l.lo, 3);
        row[`hi95_${p}`] = round(l.hi, 3);
        est.push({ lor: l.lor, se: (l.hi - l.lor) / 1.96 });
      } else {
        row[`logOddsRatio_${p}`] = null;
        row[`lo95_${p}`] = null;
        row[`hi95_${p}`] = null;
      }
    }
    if (sharedSum !== pr.shared) throw new Error(`${pr.a}/${pr.b}: period joint counts sum to ${sharedSum}, published sharedVerses ${pr.shared}. STOPPING.`);
    row.periodsCompared = est.length;
    if (est.length >= 2) {
      const c = cochranQ(est);
      row.heterogeneityQ = round(c.q, 3);
      row._p = chiSquareUpperTail(c.q, c.df);
    } else {
      row.heterogeneityQ = null;
      row._p = null;
    }
    return row;
  });
  const tested = rows.filter((r) => r._p != null);
  const q = bhAdjust(tested.map((r) => r._p));
  tested.forEach((r, i) => { r._q = q[i]; });
  for (const r of rows) {
    r.heterogeneityP = r._p == null ? null : Number(r._p.toPrecision(3));
    r.heterogeneityBhQ = r._p == null ? null : Number(r._q.toPrecision(3));
    delete r._p;
    delete r._q;
  }
  rows.sort((a, b) => (a.heterogeneityBhQ ?? 2) - (b.heterogeneityBhQ ?? 2) || a.rootA.localeCompare(b.rootA) || a.rootB.localeCompare(b.rootB));


  const heterogeneous = rows.filter((r) => r.heterogeneityBhQ != null && r.heterogeneityBhQ <= ALPHA).length;
  return { rows, periodVerses, summary: { pairs: rows.length, tested: tested.length, heterogeneousBH: heterogeneous, alpha: ALPHA } };
}
