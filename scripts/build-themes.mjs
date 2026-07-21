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
      dbr: "to consider, ponder",
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
  {
    slug: "gratitude",
    title: "Gratitude",
    roots: {
      $kr: "to give thanks, gratitude",
    },
  },
  {
    slug: "guidance",
    title: "Guidance and light",
    roots: {
      hdy: "to guide; guidance",
      nwr: "light",
    },
  },
  {
    slug: "fear-hope",
    title: "Fear and hope",
    roots: {
      xwf: "to fear",
      rjw: "to hope, expect",
    },
  },
  {
    slug: "truthfulness",
    title: "Truthfulness and falsehood",
    roots: {
      Sdq: "truth, sincerity",
      "k*b": "to lie, falsehood",
    },
  },
  {
    slug: "charity",
    title: "Charity and giving",
    roots: {
      nfq: "to spend, give",
      zkw: "to purify; alms",
    },
  },
  {
    slug: "death",
    title: "Death and mortality",
    roots: {
      mwt: "death",
    },
  },
  {
    slug: "paradise",
    title: "Paradise",
    roots: {
      jnn: "garden, paradise",
    },
  },
  {
    slug: "hellfire",
    title: "Hellfire and consequence",
    roots: {
      sEr: "blazing fire",
      Sly: "to burn, roast",
    },
  },
  {
    slug: "wisdom",
    title: "Wisdom",
    roots: {
      Hkm: "judgment, wisdom",
    },
  },
  {
    slug: "pilgrimage",
    title: "Pilgrimage",
    roots: {
      Hjj: "pilgrimage, argument",
    },
  },
  {
    slug: "fasting",
    title: "Fasting",
    roots: {
      Swm: "fasting",
    },
  },
  {
    slug: "anger",
    title: "Anger and restraint",
    roots: {
      gDb: "anger",
      kZm: "to restrain, suppress anger",
    },
  },
  {
    slug: "love",
    title: "Love",
    roots: {
      Hbb: "to love",
    },
  },
  {
    slug: "trust",
    title: "Trust in God",
    roots: {
      wkl: "to trust, rely upon",
    },
  },
  {
    slug: "arrogance",
    title: "Arrogance and humility",
    roots: {
      kbr: "arrogance, greatness",
      "x$E": "to humble oneself",
    },
  },
  {
    slug: "brotherhood",
    title: "Brotherhood and community",
    roots: {
      Axw: "brother, kinship",
      jmE: "to gather, community",
      "$wr": "to consult",
    },
  },
  {
    slug: "sincerity",
    title: "Sincerity",
    roots: {
      xlS: "to purify, be sincere",
      nSH: "sincere advice, counsel",
    },
  },
  {
    slug: "tyranny",
    title: "Tyranny and transgression",
    roots: {
      Tgy: "to transgress, tyrannize",
      bgy: "to transgress, wrong",
    },
  },
  {
    slug: "covenant",
    title: "Covenant and fulfillment",
    roots: {
      Ehd: "covenant, promise",
      wfy: "to fulfill, be loyal",
    },
  },
  {
    slug: "striving",
    title: "Effort and striving",
    roots: {
      jhd: "to strive, exert effort",
    },
  },
  {
    slug: "certainty",
    title: "Certainty and doubt",
    roots: {
      yqn: "certainty",
      ryb: "doubt, suspicion",
    },
  },
  {
    slug: "joy-sorrow",
    title: "Joy and sorrow",
    roots: {
      frH: "joy, delight",
      Hzn: "grief, sorrow",
    },
  },
  {
    slug: "blessing",
    title: "Blessing",
    roots: {
      nEm: "blessing, favor",
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

// Per-surah normalization denominator (Leeds token counts).
const profiles = JSON.parse(
  readFileSync(join(ROOT, "data", "surah-profiles.json"), "utf8"),
).surahs;

const TOP_SURAHS = 8;
const MIN_SURAH_TOKENS = 2; // a lone mention is not "clustering"

const out = { _generated: "build-themes.mjs", themes: [] };
// surah -> [{slug, title, perThousand}] — the reverse index the dossier
// fetches (data/theme-surah-index.json), so it never needs the full
// themes.json or 33 root-analytics files at runtime.
const surahThemes = {};
for (let s = 1; s <= 114; s++) surahThemes[String(s)] = [];
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
  // Where the theme's vocabulary clusters: theme-root tokens summed per
  // surah, normalized per 1,000 surah tokens so long surahs don't win on
  // sheer length. Mechanical counting of an editorially-grouped root
  // family — clustering is counted, not interpreted.
  const bySurah = {};
  for (const [key, counts] of Object.entries(verseRoots)) {
    const s = Number(key.split(":")[0]);
    for (const r of roots) {
      if (counts[r]) bySurah[s] = (bySurah[s] || 0) + counts[r];
    }
  }
  const topSurahs = Object.entries(bySurah)
    .map(([s, tokens]) => ({
      s: Number(s),
      tokens,
      perThousand:
        Math.round((tokens / profiles[s].tokenCount) * 1000 * 10) / 10,
    }))
    .filter((x) => x.tokens >= MIN_SURAH_TOKENS)
    .sort(
      (a, b) => b.perThousand - a.perThousand || b.tokens - a.tokens || a.s - b.s,
    )
    .slice(0, TOP_SURAHS);
  for (const x of topSurahs) {
    surahThemes[String(x.s)].push({
      slug: theme.slug,
      title: theme.title,
      perThousand: x.perThousand,
    });
  }

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
    topSurahs,
    verseCoverage: Object.entries(verseRoots).filter(([, c]) =>
      roots.some((r) => c[r]),
    ).length,
  });
}

writeFileSync(
  join(ROOT, "data", "themes.json"),
  JSON.stringify(out, null, 1) + "\n",
);

// Reverse index: each surah's themes ranked by density. Only surahs that
// made a theme's topSurahs appear with entries — the rest stay [] so a
// consumer can distinguish "no clustering" from "file missing".
for (const list of Object.values(surahThemes)) {
  list.sort((a, b) => b.perThousand - a.perThousand || a.slug.localeCompare(b.slug));
}
writeFileSync(
  join(ROOT, "data", "theme-surah-index.json"),
  JSON.stringify({
    _generated: "build-themes.mjs",
    _method:
      "Reverse of themes.json's topSurahs: for each surah, the themes " +
      "whose root-family vocabulary clusters in it, ranked by density " +
      "(theme-root tokens per 1,000 surah tokens, Leeds counts; " +
      `minimum ${MIN_SURAH_TOKENS} tokens; a theme lists at most its ` +
      `top ${TOP_SURAHS} surahs, so absence here means the surah is ` +
      "not among that theme's densest, not that the vocabulary is " +
      "absent). Root-to-theme grouping is editorial (see themes.html); " +
      "the counting is mechanical — clustering is counted, not " +
      "interpreted.",
    surahs: surahThemes,
  }) + "\n",
);
for (const t of out.themes) {
  console.log(
    `${t.slug}: ${t.roots.length} roots, ${t.verseCoverage} verses touched, top: ${t.passages
      .slice(0, 3)
      .map((p) => `${p.s}:${p.a}(${p.distinctRoots}r/${p.tokens}t)`)
      .join(" ")}`,
  );
}
