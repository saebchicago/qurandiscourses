// build-related.mjs — the "See also" join behind assets/related.js.
//
//   node scripts/build-related.mjs           # rewrite data/related.json
//   node scripts/build-related.mjs --check   # exit 1 if stale
//
// Two lookups, both joins over data the site already publishes — no new
// mathematics, no new counts:
//
//   surahs: for each surah with at least one entry in
//   data/theme-surah-index.json, the surahs whose theme profiles
//   overlap it most. A pair's affinity is the sum, over the themes
//   they share, of the SMALLER of the two densities (per-1,000-word
//   figures straight from the index): a theme binds two surahs only
//   as strongly as its weaker presence. Top 4 partners, plus the
//   shared theme slugs so the panel can say why.
//
//   themes: for each of the 33 themes, the themes whose root families
//   co-occur with its own inside the same verses. Root families are
//   editorially disjoint (no root belongs to two themes), so the
//   bridge is data/cooccurrence/<root>.json: every co-occurrence
//   between a root of theme A and a root of theme B adds its verse
//   count to the pair's affinity. Top 3 partners, plus the strongest
//   single root pair so the panel can name the bridge.
//
// Ties break by id (surah number, then slug) so output is stable.
// Deterministic: run twice, `git diff` is empty. The per-1,000
// densities are mechanical counts over an editorial root grouping;
// the "~ Nuanced" badge the consuming panels carry says so.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { safeKey } from "./lib/safe-key.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));

const themes = read("data/themes.json").themes;
const themeIndex = read("data/theme-surah-index.json").surahs;

// ── surah siblings ────────────────────────────────────────────────────
const SIBLING_LIMIT = 4;
const surahs = {};
const profiles = Object.entries(themeIndex)
  .filter(([, ts]) => ts.length)
  .map(([s, ts]) => [Number(s), new Map(ts.map((t) => [t.slug, t.perThousand]))]);

for (const [s, mine] of profiles) {
  const partners = [];
  for (const [o, theirs] of profiles) {
    if (o === s) continue;
    const shared = [...mine.keys()].filter((slug) => theirs.has(slug));
    if (!shared.length) continue;
    const score = shared.reduce(
      (sum, slug) => sum + Math.min(mine.get(slug), theirs.get(slug)),
      0,
    );
    partners.push({ s: o, score: Math.round(score * 100) / 100, shared });
  }
  partners.sort((a, b) => b.score - a.score || a.s - b.s);
  if (partners.length)
    surahs[String(s)] = partners.slice(0, SIBLING_LIMIT);
}

// ── theme neighbors ───────────────────────────────────────────────────
// ownerOf maps a Buckwalter root key to the one theme carrying it;
// build-themes guarantees the families are disjoint, and the check
// below fails loudly if that ever stops being true.
const NEAR_LIMIT = 3;
const ownerOf = new Map();
const titleOf = new Map();
const latinOf = new Map();
for (const t of themes) {
  titleOf.set(t.slug, t.title);
  for (const r of t.roots) {
    if (ownerOf.has(r.bw))
      throw new Error(
        `root ${r.bw} belongs to both ${ownerOf.get(r.bw)} and ${t.slug} — the disjoint-families assumption is broken`,
      );
    ownerOf.set(r.bw, t.slug);
    latinOf.set(r.bw, r.latin);
  }
}

const themeNear = {};
for (const t of themes) {
  // slug -> { score, best: {a, b, count} }
  const acc = new Map();
  for (const r of t.roots) {
    const co = read(`data/cooccurrence/${safeKey(r.bw)}.json`);
    for (const c of co.coRoots) {
      const other = ownerOf.get(c.root);
      if (!other || other === t.slug) continue;
      const cur = acc.get(other) || { score: 0, best: null };
      cur.score += c.count;
      if (
        !cur.best ||
        c.count > cur.best.count ||
        (c.count === cur.best.count &&
          `${r.latin}|${c.rootLatin}` < `${cur.best.a}|${cur.best.b}`)
      )
        cur.best = { a: r.latin, b: c.rootLatin, count: c.count };
      acc.set(other, cur);
    }
  }
  const near = [...acc.entries()]
    .sort((x, y) => y[1].score - x[1].score || (x[0] < y[0] ? -1 : 1))
    .slice(0, NEAR_LIMIT)
    .map(([slug, v]) => ({
      slug,
      title: titleOf.get(slug),
      score: v.score,
      via: { a: v.best.a, b: v.best.b, count: v.best.count },
    }));
  if (near.length) themeNear[t.slug] = near;
}

// ── emit ──────────────────────────────────────────────────────────────
const out = {
  _generated:
    "scripts/build-related.mjs — regenerate with: node scripts/build-related.mjs",
  _method:
    "Joins over published data, no new counts. surahs: partners ranked by " +
    "the sum over shared themes of the smaller per-1,000-word density " +
    "(data/theme-surah-index.json), top 4, ties by surah number. themes: " +
    "partners ranked by total verse-level co-occurrence between the two " +
    "root families (data/cooccurrence/*.json, Leeds counts), top 3, ties " +
    "by slug; via names the strongest single root pair. Root-to-theme " +
    "grouping is editorial (themes.html); the counting is mechanical.",
  titles: Object.fromEntries(themes.map((t) => [t.slug, t.title])),
  surahs,
  themes: themeNear,
};

const rel = "data/related.json";
const next = JSON.stringify(out, null, 2) + "\n";
let prev = null;
try {
  prev = readFileSync(join(ROOT, rel), "utf8");
} catch {
  prev = null;
}

if (CHECK) {
  if (prev !== next) {
    console.error("build-related --check: FAIL");
    console.error(`  - ${rel} is stale. Run: node scripts/build-related.mjs`);
    process.exit(1);
  }
  console.log(
    `build-related --check: OK (${Object.keys(surahs).length} surahs, ${Object.keys(themeNear).length} themes current)`,
  );
} else {
  if (prev !== next) writeFileSync(join(ROOT, rel), next);
  console.log(
    `build-related: ${Object.keys(surahs).length} surahs with siblings, ${Object.keys(themeNear).length} themes with neighbors${prev === next ? " (no change)" : ""}.`,
  );
}
