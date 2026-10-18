#!/usr/bin/env node
//
// build-formulaic-templates.mjs: one-slot templates ("a _ c") that recur
// more often than word order alone would produce, tested against a
// length-matched null with Benjamini-Hochberg control.
//
//   node scripts/build-formulaic-templates.mjs           # rewrite
//   node scripts/build-formulaic-templates.mjs --check   # fast: input digest + stored-systems digest
//   node scripts/build-formulaic-templates.mjs --check --full   # recompute everything (~15 s)
//
// Source: Leeds Quranic Arabic Corpus v0.4 (GPL), data/morphology/. Tokens
// are diacritic-stripped surface forms (the same stream as
// data/formulas-surface.json); a template never crosses a verse boundary.
//
// A candidate is a pair of forms at distance two with at least 3 windows
// and at least 2 different words in the slot (a template with one filler
// is a fixed phrase, already on the Formulas page). Each candidate's
// support is compared with its expectation under a within-verse shuffle
// (scripts/lib/templates.mjs) and the p-values are BH-adjusted over all
// candidates. The same pipeline then runs on 100 shuffled copies of the
// text (seed 20261018); how many "systems" it finds there is the measured
// false-positive behavior of the method, published beside the result.
//
// This records where a pattern recurs, not why. Whether a template is a
// formula in the oral-formulaic sense is a scholarly judgment this site
// does not make (Bannister 2014 is the literature).
//
// Deterministic: fixed seed, no dates. Output: data/formulaic-templates.json

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { stripDiacritics } from "./lib/arabic.mjs";
import { mulberry32, shuffle } from "./lib/permute.mjs";
import { analyze } from "./lib/templates.mjs";
import { inputDigest, bodyDigest } from "./lib/input-digest.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "formulaic-templates.json");
const CHECK = process.argv.includes("--check");
const FULL = process.argv.includes("--full");
const INPUTS = [
  join(ROOT, "data", "morphology"),
  join(ROOT, "scripts", "build-formulaic-templates.mjs"),
  join(ROOT, "scripts", "lib", "templates.mjs"),
  join(ROOT, "scripts", "lib", "permute.mjs"),
  join(ROOT, "scripts", "lib", "arabic.mjs"),
];
const SEED = 20261018;
const SHUFFLES = 100;
const ALPHA = 0.05;
const MIN_SUPPORT = 3;
const MIN_FILLERS = 2;
const FILLERS_SHOWN = 8;

const DIGEST = inputDigest(ROOT, INPUTS);
if (CHECK && !FULL) {
  if (!existsSync(OUT)) {
    console.error("build-formulaic-templates --check: FAIL — data/formulaic-templates.json is missing.\n  Run: node scripts/build-formulaic-templates.mjs");
    process.exit(1);
  }
  const stored = JSON.parse(readFileSync(OUT, "utf8"));
  if (stored.inputDigest !== DIGEST) {
    console.error("build-formulaic-templates --check: FAIL — the morphology, script or libraries changed since the output was written.\n  Run: node scripts/build-formulaic-templates.mjs");
    process.exit(1);
  }
  if (stored.outputDigest !== bodyDigest(stored)) {
    console.error("build-formulaic-templates --check: FAIL — the stored file does not match its outputDigest (hand-edited?).\n  Run: node scripts/build-formulaic-templates.mjs");
    process.exit(1);
  }
  console.log(`build-formulaic-templates --check: OK (${stored.systems.length} systems; inputs unchanged; the full recompute is --check --full, run weekly).`);
  process.exit(0);
}

const ids = new Map();
const forms = [];
const verses = [];
for (let s = 1; s <= 114; s++) {
  const m = JSON.parse(readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"));
  for (const v of Object.keys(m).map(Number).sort((a, b) => a - b)) {
    verses.push({
      s, v,
      t: m[v].map((w) => {
        const k = stripDiacritics(w.ar);
        if (!ids.has(k)) { ids.set(k, ids.size); forms.push(k); }
        return ids.get(k);
      }),
    });
  }
}
const nTypes = ids.size;
const totalTokens = verses.reduce((n, x) => n + x.t.length, 0);
const opts = { minSupport: MIN_SUPPORT, minFillers: MIN_FILLERS, alpha: ALPHA };

const real = analyze(verses, nTypes, opts);

const rnd = mulberry32(SEED);
const nullRuns = [];
for (let r = 0; r < SHUFFLES; r++) {
  const sh = verses.map((x) => ({ s: x.s, v: x.v, t: shuffle(x.t.slice(), rnd) }));
  const a = analyze(sh, nTypes, opts);
  nullRuns.push({ candidates: a.candidates.length, significant: a.significant.length, covered: a.coveredTokens });
}
const stat = (xs) => ({ mean: Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100, max: Math.max(...xs) });
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
const sci = (x) => (x === 0 ? 0 : Number(x.toPrecision(3)));

const systems = real.significant
  .slice()
  .sort((x, y) => x.q - y.q || y.k - x.k || x.a - y.a || x.c - y.c)
  .map((c) => ({
    template: `${forms[c.a]} _ ${forms[c.c]}`,
    before: forms[c.a],
    after: forms[c.c],
    support: c.k,
    expected: round(c.expected, 3),
    fillers: c.fill.size,
    topFillers: [...c.fill.entries()].sort((x, y) => y[1] - x[1] || x[0] - y[0]).slice(0, FILLERS_SHOWN).map(([id, n]) => [forms[id], n]),
    p: sci(c.p),
    q: sci(c.q),
    refs: c.refs,
  }));

const body = {
  _comment:
    "GENERATED by scripts/build-formulaic-templates.mjs. One-slot templates (a _ c) that recur more than a within-verse shuffle predicts, with BH control. Records where a pattern recurs, not why; whether it is a formula in the oral-formulaic sense is a scholarly judgment this site does not make.",
  source: "Leeds Quranic Arabic Corpus v0.4 (GPL), diacritic-stripped surface forms, within a verse",
  method: {
    template: "forms a and c at distance two in one verse, any word between them",
    candidate: `support >= ${MIN_SUPPORT} windows and >= ${MIN_FILLERS} different words in the slot`,
    null: "shuffle the words inside every verse (verse lengths and word multisets kept, order destroyed); expected support is the exact mean over shuffles",
    p: "Poisson upper tail of the support at that expectation",
    q: `Benjamini-Hochberg over all candidates; a system is a candidate with q <= ${ALPHA}`,
    nullRuns: `${SHUFFLES} shuffled copies, mulberry32 seed ${SEED}, same candidate rule and BH step`,
  },
  observed: {
    tokens: totalTokens,
    candidates: real.candidates.length,
    systems: real.significant.length,
    coveredTokens: real.coveredTokens,
    coveredShare: round(real.coveredTokens / totalTokens, 4),
  },
  null: {
    shuffles: SHUFFLES,
    candidates: stat(nullRuns.map((r) => r.candidates)),
    systems: stat(nullRuns.map((r) => r.significant)),
    shufflesWithAnySystem: nullRuns.filter((r) => r.significant > 0).length,
    coveredTokens: stat(nullRuns.map((r) => r.covered)),
  },
  systems,
};
const out = { inputDigest: DIGEST, outputDigest: bodyDigest(body), ...body };
const text = JSON.stringify(out) + "\n";

if (CHECK) {
  if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== text) {
    console.error("build-formulaic-templates --check: FAIL — data/formulaic-templates.json is stale.\n  Run: node scripts/build-formulaic-templates.mjs");
    process.exit(1);
  }
  console.log(`build-formulaic-templates --check: OK (${systems.length} systems).`);
} else {
  writeFileSync(OUT, text);
  console.log(
    `build-formulaic-templates: ${systems.length} systems of ${real.candidates.length} candidates; covers ${real.coveredTokens} of ${totalTokens} tokens. ` +
    `Null (${SHUFFLES} shuffles): systems mean ${out.null.systems.mean}, max ${out.null.systems.max}; covered mean ${out.null.coveredTokens.mean}.`,
  );
}
