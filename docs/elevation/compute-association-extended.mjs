#!/usr/bin/env node
//
// compute-association-extended.mjs — SKELETON for a new generator, written
// to be dropped into scripts/ unchanged once adopted (imports below are
// relative to docs/elevation/; change "../../scripts/lib" to "./lib").
//
// What it adds. scripts/compute-association-stats.mjs publishes three
// verse-level root-pair measures (PMI, Dice, Dunning G2). The collocation
// literature disagrees about which is best, and the site's convention
// (see compute-dispersion.mjs) is to show the method-dependence rather than
// pick one. This adds four more measures over the SAME 2x2 tables:
//
//   logDice   14 + log2( 2*k11 / (fA + fB) )            Rychly 2008
//             bounded above by 14, independent of corpus size N
//   tScore    (k11 - E11) / sqrt(k11)                    standard t-score
//   logOR     ln( (k11+.5)(k22+.5) / ((k12+.5)(k21+.5)) )   Haldane-Anscombe
//             with a Wald 95% interval half-width 1.96*sqrt(sum(1/(cell+.5)))
//   deltaP    P(B|A) - P(B|not A)  and  P(A|B) - P(A|not B)   (asymmetric)
//
// The 2x2 is exactly the existing one: N = TOTAL_VERSES, a root "occurs" in
// a verse if any token carries it, cells k11/k12/k21/k22 over verses.
//
// Determinism. No dates, no randomness, no network. Pairs and partners are
// sorted by (measure desc, then root key asc) so ties cannot reorder.
// Running twice must give byte-identical output; the self-test below and
// the verification in docs/ELEVATION-PLAN.md both check that.
//
// Usage (from the repo root):
//   node docs/elevation/compute-association-extended.mjs --root qwl --top 25
//   node docs/elevation/compute-association-extended.mjs --root qwl --check
//
// --check recomputes the shared measures (k11, PMI, Dice, G2) for the
// root's published partners and fails if any disagrees with
// data/association/<safeKey>.json beyond that file's own rounding.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { TOTAL_VERSES, TOTAL_TOKENS } from "../../scripts/lib/corpus.mjs";
import { safeKey } from "../../scripts/lib/safe-key.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? dflt : argv[i + 1];
};
const MIN_SHARED_VERSES = 5; // same threshold as the published table

// ── measures ─────────────────────────────────────────────────────────
// Every function takes the four 2x2 cells and returns a plain number.

export const cells = (k11, fA, fB, N) => ({
  k11,
  k12: fA - k11,
  k21: fB - k11,
  k22: N - fA - fB + k11,
});

export const pmi = ({ k11, k12, k21 }, N) => Math.log2((k11 * N) / ((k11 + k12) * (k11 + k21)));
export const dice = ({ k11, k12, k21 }) => (2 * k11) / (2 * k11 + k12 + k21);
const xlogx = (o, e) => (o === 0 ? 0 : o * Math.log(o / e));
export function g2({ k11, k12, k21, k22 }) {
  const n = k11 + k12 + k21 + k22;
  const r1 = k11 + k12, r2 = k21 + k22, c1 = k11 + k21, c2 = k12 + k22;
  return 2 * (xlogx(k11, (r1 * c1) / n) + xlogx(k12, (r1 * c2) / n) + xlogx(k21, (r2 * c1) / n) + xlogx(k22, (r2 * c2) / n));
}
export const logDice = ({ k11, k12, k21 }) => 14 + Math.log2((2 * k11) / (2 * k11 + k12 + k21));
export function tScore({ k11, k12, k21, k22 }) {
  const n = k11 + k12 + k21 + k22;
  const e11 = ((k11 + k12) * (k11 + k21)) / n;
  return (k11 - e11) / Math.sqrt(k11);
}
export function logOddsRatio({ k11, k12, k21, k22 }) {
  const [a, b, c, d] = [k11 + 0.5, k12 + 0.5, k21 + 0.5, k22 + 0.5];
  const lor = Math.log((a * d) / (b * c));
  const half = 1.96 * Math.sqrt(1 / a + 1 / b + 1 / c + 1 / d);
  return { lor, lo: lor - half, hi: lor + half };
}
export function deltaP({ k11, k12, k21, k22 }) {
  // P(B|A) - P(B|not A); and the reverse direction.
  return {
    bGivenA: k11 / (k11 + k12) - k21 / (k21 + k22),
    aGivenB: k11 / (k11 + k21) - k12 / (k12 + k22),
  };
}

// ── embedded unit test (hand-computed, same 2x2 as the published script) ──
// k11=10 k12=5 k21=5 k22=10, N=30 (fA = fB = 15):
//   logDice = 14 + log2(20/30)                    = 13.41503749927884
//   tScore  = (10 - 7.5)/sqrt(10)                 = 0.7905694150420949
//   deltaP  = 10/15 - 5/15                        = 1/3 (both directions)
//   logOR   = ln((10.5*10.5)/(5.5*5.5))           = 1.2933...
{
  const c = cells(10, 15, 15, 30);
  const eps = 1e-9;
  const check = (name, got, want) => {
    if (Math.abs(got - want) > eps) throw new Error(`self-test ${name}: got ${got}, want ${want}`);
  };
  check("logDice", logDice(c), 14 + Math.log2(20 / 30));
  check("tScore", tScore(c), 2.5 / Math.sqrt(10));
  check("deltaP.bGivenA", deltaP(c).bGivenA, 1 / 3);
  check("deltaP.aGivenB", deltaP(c).aGivenB, 1 / 3);
  check("logOR", logOddsRatio(c).lor, Math.log((10.5 * 10.5) / (5.5 * 5.5)));
  // Closed form from compute-association-stats.mjs: G2 = 2*(2*10*ln(4/3) + 2*5*ln(2/3)).
  check("g2", g2(c), 2 * (2 * 10 * Math.log(4 / 3) + 2 * 5 * Math.log(2 / 3)));
}

// ── corpus scan: verse -> set of roots (identical rule to the published script) ──
function scan() {
  const verseRoots = new Map();
  let tokens = 0;
  for (let s = 1; s <= 114; s++) {
    const morph = JSON.parse(readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"));
    for (const [v, words] of Object.entries(morph)) {
      for (const w of words) {
        tokens++;
        if (!w.root) continue;
        const ref = `${s}:${v}`;
        if (!verseRoots.has(ref)) verseRoots.set(ref, new Set());
        verseRoots.get(ref).add(w.root);
      }
    }
  }
  if (tokens !== TOTAL_TOKENS) throw new Error(`baseline: scanned ${tokens} tokens, expected ${TOTAL_TOKENS}`);
  const verseCount = new Map(); // root -> verses attesting it
  for (const set of verseRoots.values()) for (const r of set) verseCount.set(r, (verseCount.get(r) || 0) + 1);
  return { verseRoots, verseCount };
}

export function partnersFor(rootBw, { verseRoots, verseCount }, top) {
  const fA = verseCount.get(rootBw);
  if (!fA) throw new Error(`unknown root ${rootBw}`);
  const shared = new Map();
  for (const set of verseRoots.values()) {
    if (!set.has(rootBw)) continue;
    for (const r of set) if (r !== rootBw) shared.set(r, (shared.get(r) || 0) + 1);
  }
  const rows = [];
  for (const [r, k11] of shared) {
    if (k11 < MIN_SHARED_VERSES) continue;
    const fB = verseCount.get(r);
    const c = cells(k11, fA, fB, TOTAL_VERSES);
    const { lor, lo, hi } = logOddsRatio(c);
    const dp = deltaP(c);
    rows.push({
      root: r, safeKey: safeKey(r), k11, fA, fB,
      pmi: pmi(c, TOTAL_VERSES), dice: dice(c), llr: g2(c),
      logDice: logDice(c), tScore: tScore(c),
      logOddsRatio: lor, logOddsRatioLo: lo, logOddsRatioHi: hi,
      deltaP_bGivenA: dp.bGivenA, deltaP_aGivenB: dp.aGivenB,
    });
  }
  rows.sort((x, y) => y.llr - x.llr || (x.root < y.root ? -1 : 1));
  return rows.slice(0, top);
}

// ── main ─────────────────────────────────────────────────────────────
const rootBw = arg("root", "qwl");
const top = Number(arg("top", "25"));
const corpus = scan();
const rows = partnersFor(rootBw, corpus, top);

if (argv.includes("--check")) {
  const published = JSON.parse(readFileSync(join(ROOT, "data", "association", `${safeKey(rootBw)}.json`), "utf8"));
  let worst = { k11: 0, pmi: 0, dice: 0, llr: 0 };
  const byRoot = new Map(rows.map((r) => [r.root, r]));
  let compared = 0;
  for (const p of published.partners) {
    const mine = byRoot.get(p.root);
    if (!mine) throw new Error(`published partner ${p.root} missing from recomputation`);
    compared++;
    worst.k11 = Math.max(worst.k11, Math.abs(mine.k11 - p.k11));
    worst.pmi = Math.max(worst.pmi, Math.abs(mine.pmi - p.pmi));
    worst.dice = Math.max(worst.dice, Math.abs(mine.dice - p.dice));
    worst.llr = Math.max(worst.llr, Math.abs(mine.llr - p.llr));
  }
  // The published file rounds PMI/LLR to 2 places and Dice to 3.
  const ok = worst.k11 === 0 && worst.pmi <= 0.005 + 1e-9 && worst.dice <= 0.0005 + 1e-9 && worst.llr <= 0.005 + 1e-9;
  console.log(JSON.stringify({ root: rootBw, partnersCompared: compared, worstAbsDiff: worst, ok }));
  process.exit(ok ? 0 : 1);
}

const round = (x) => Math.round(x * 1e6) / 1e6;
const out = rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "number" && !Number.isInteger(v) ? round(v) : v])));
process.stdout.write(JSON.stringify({ root: rootBw, N: TOTAL_VERSES, minSharedVerses: MIN_SHARED_VERSES, partners: out }, null, 1) + "\n");
