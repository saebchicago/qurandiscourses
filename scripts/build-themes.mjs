// build-themes.mjs - deterministic, zero-dependency generator for
// data/themes.json, the data behind themes.html (theme gateways).
//
// For each theme, defined below as a set of triliteral roots whose core
// dictionary senses relate to the theme, this script scans the bundled
// Leeds morphology (data/morphology/{1..114}.json) and ranks verses by
// (a) how many distinct theme roots they contain and (b) how many theme
// root tokens they carry. The top passages become the theme's computed
// "destinations". The root-to-theme grouping is editorial and lexical;
// the counts and passages are mechanical.
//
// Run: node scripts/build-themes.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const THEMES = [
  {
    slug: "forgiveness",
    title: "Forgiveness",
    roots: {
      gfr: "to forgive, cover over",
      Efw: "to pardon, efface",
      twb: "to turn back, repent",
      SfH: "to overlook, forgive",
    },
  },
  {
    slug: "marriage",
    title: "Marriage and spouses",
    roots: {
      zwj: "spouse, pair",
      nkH: "to marry",
      Tlq: "to divorce, release",
    },
  },
  {
    slug: "children",
    title: "Children and family",
    roots: {
      wld: "to give birth; child",
      bny: "to build; son, children",
      ytm: "orphan",
      "*rr": "offspring, progeny",
    },
  },
  {
    slug: "trade",
    title: "Trade and wealth",
    roots: {
      byE: "to sell, trade",
      tjr: "commerce",
      rbw: "to increase; usury",
      kyl: "to measure",
      wzn: "to weigh",
      mwl: "wealth, property",
    },
  },
  {
    slug: "peace",
    title: "Peace and reconciliation",
    roots: {
      slm: "peace, safety, submission",
      SlH: "to set right, reconcile",
    },
  },
  {
    slug: "patience",
    title: "Patience and trial",
    roots: {
      Sbr: "patience, steadfastness",
      blw: "to test, try",
      ysr: "ease",
      Esr: "hardship",
    },
  },
  {
    slug: "justice",
    title: "Justice",
    roots: {
      Edl: "justice, fairness",
      qsT: "equity",
      Zlm: "wrongdoing, injustice",
    },
  },
  {
    slug: "healing",
    title: "Illness and healing",
    roots: {
      $fy: "to heal",
      mrD: "illness, disease",
    },
  },
  {
    slug: "knowledge",
    title: "Knowledge and reflection",
    roots: {
      Elm: "to know",
      fkr: "to reflect",
      Eql: "to reason",
      dbr: "to consider; tadabbur",
    },
  },
  {
    slug: "prayer",
    title: "Prayer and remembrance",
    roots: {
      Slw: "prayer",
      "*kr": "to remember, mention",
      sbH: "to glorify",
      dEw: "to call, supplicate",
    },
  },
];

const MAX_PASSAGES = 12;

const summary = JSON.parse(
  readFileSync(join(ROOT, "data", "roots-summary.json"), "utf8"),
);
const byBW = {};
for (const r of Object.values(summary)) byBW[r.rootBuckwalter] = r;

// verse -> root -> token count, for every root used by any theme
const wanted = new Set(THEMES.flatMap((t) => Object.keys(t.roots)));
for (const r of wanted) {
  if (!byBW[r]) {
    console.error(`FATAL: root ${r} not found in roots-summary.json`);
    process.exit(1);
  }
}

const verseRoots = {}; // "s:a" -> { bwRoot: tokenCount }
for (let s = 1; s <= 114; s++) {
  const morph = JSON.parse(
    readFileSync(join(ROOT, "data", "morphology", `${s}.json`), "utf8"),
  );
  for (const [a, tokens] of Object.entries(morph)) {
    for (const t of tokens) {
      if (t.root && wanted.has(t.root)) {
        const key = `${s}:${a}`;
        verseRoots[key] = verseRoots[key] || {};
        verseRoots[key][t.root] = (verseRoots[key][t.root] || 0) + 1;
      }
    }
  }
}

function verseSort(a, b) {
  const [as, aa] = a.split(":").map(Number);
  const [bs, ba] = b.split(":").map(Number);
  return as - bs || aa - ba;
}

const out = { _generated: "build-themes.mjs", themes: [] };
for (const theme of THEMES) {
  const roots = Object.keys(theme.roots);
  const scored = [];
  for (const [key, counts] of Object.entries(verseRoots)) {
    const present = roots.filter((r) => counts[r]);
    if (present.length === 0) continue;
    const tokens = present.reduce((n, r) => n + counts[r], 0);
    // Passages must show the theme's vocabulary working, not a lone
    // mention: require 2+ distinct roots, or 2+ tokens of one root.
    if (present.length < 2 && tokens < 2) continue;
    scored.push({ key, distinct: present.length, tokens, present });
  }
  scored.sort(
    (a, b) =>
      b.distinct - a.distinct ||
      b.tokens - a.tokens ||
      verseSort(a.key, b.key),
  );
  const passages = scored.slice(0, MAX_PASSAGES).map((p) => {
    const [s, a] = p.key.split(":").map(Number);
    return {
      s,
      a,
      distinctRoots: p.distinct,
      tokens: p.tokens,
      roots: p.present.map((r) => byBW[r].rootLatin),
    };
  });
  out.themes.push({
    slug: theme.slug,
    title: theme.title,
    roots: roots.map((r) => ({
      bw: r,
      latin: byBW[r].rootLatin,
      arabic: byBW[r].rootArabic,
      gloss: theme.roots[r],
      count: byBW[r].totalCount,
    })),
    passages,
    verseCoverage: Object.entries(verseRoots).filter(([, c]) =>
      roots.some((r) => c[r]),
    ).length,
  });
}

writeFileSync(
  join(ROOT, "data", "themes.json"),
  JSON.stringify(out, null, 1) + "\n",
);
for (const t of out.themes) {
  console.log(
    `${t.slug}: ${t.roots.length} roots, ${t.verseCoverage} verses touched, top: ${t.passages
      .slice(0, 3)
      .map((p) => `${p.s}:${p.a}(${p.distinctRoots}r/${p.tokens}t)`)
      .join(" ")}`,
  );
}
