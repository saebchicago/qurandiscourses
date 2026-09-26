#!/usr/bin/env node
//
// build-word-timings.mjs — word-level timings for recitation highlighting,
// taken from quran-align (github.com/cpfair/quran-align) and kept only
// for reciters whose timings demonstrably fit the audio files Read plays.
//
//   node scripts/build-word-timings.mjs     # needs network; run by
//                                           # .github/workflows/word-timings.yml
//
// quran-align publishes, per recording, the start and end of every word
// of every verse: {surah, ayah, segments: [[word_start, word_end, start_ms,
// end_ms], ...]}. Its recordings are the everyayah.com files. Read plays
// the cdn.islamic.network files, and whether a given reciter there is the
// same recording, cut the same way, is exactly what cannot be assumed.
// So this script measures it, against data/recitation/durations.json
// (each verse's measured length in the file Read plays).
//
// PASS CRITERIA, fixed before any data was seen, for each candidate:
//   1. coverage   timings for at least 99% of the 6,236 verses
//   2. fit        at least 98% of covered verses have
//                   -150 ms <= (our file's length - last word's end) <= 3,000 ms
//                 (the last word cannot end much after the file does, and
//                 trailing silence is short)
//   3. agreement  Pearson r >= 0.99 between our verse lengths and the last
//                 word's end, across covered verses
// A candidate that fails any of the three is reported and not bundled.
//
// Writes:
//   data/recitation/word-timings-report.json   always: every release asset
//       seen, every candidate's figures and verdict, the word-index
//       conventions observed, and the licence text as fetched
//   data/recitation/words/<reciter>/<surah>.json   passing reciters only:
//       { "<ayah>": [[word_start, word_end, start_ms, end_ms], ...] },
//       segments exactly as published, not reinterpreted
//
// Nothing is wired into the page until the report has been read: which
// word numbering quran-align uses relative to our Tanzil text is recorded
// here as observed, not assumed.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "./lib/page-shell.mjs";

const REPO = "cpfair/quran-align";
const PREFERRED_TAG = "release-2016-11-24";
const CANDIDATES = {
  "ar.husary": /husary(?!.*mujawwad)/i,
  "ar.minshawi": /minshaw[iy](?!.*mujawwad)/i,
  "ar.abdulbasitmurattal": /abdul_?basit.*murattal/i,
  "ar.abdurrahmaansudais": /sudais/i,
  "ar.saoodshuraym": /shuraym|shuraim/i,
};
const CRIT = { coverage: 0.99, fit: 0.98, fitLo: -150, fitHi: 3000, r: 0.99 };

const headers = { "User-Agent": "divinediscourses-word-timings", Accept: "application/vnd.github+json" };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function get(url, as = "json") {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: as === "json" ? headers : { "User-Agent": headers["User-Agent"] }, redirect: "follow", signal: AbortSignal.timeout(120000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return as === "json" ? await res.json() : as === "text" ? await res.text() : Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt >= 3) throw new Error(`${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

// ── Our side ─────────────────────────────────────────────────────────
const durations = JSON.parse(readFileSync(join(ROOT, "data/recitation/durations.json"), "utf8"));
const verseIndex = []; // mushaf order: [surah, ayah]
const wordCounts = new Map(); // "s:a" -> { all, noMarks }
const MARK_ONLY = /^[ۖ-ۭ۞۩؀-؅]+$/;
for (let s = 1; s <= 114; s++) {
  const t = JSON.parse(readFileSync(join(ROOT, `data/quran-text/${s}.json`), "utf8"));
  for (const a of t.ayahs) {
    verseIndex.push([s, a.numberInSurah]);
    const toks = a.text.split(/\s+/).filter(Boolean);
    wordCounts.set(`${s}:${a.numberInSurah}`, { all: toks.length, noMarks: toks.filter((w) => !MARK_ONLY.test(w)).length });
  }
}
if (verseIndex.length !== 6236) throw new Error(`expected 6,236 verses, found ${verseIndex.length}`);

// ── Their side ───────────────────────────────────────────────────────
const releases = await get(`https://api.github.com/repos/${REPO}/releases?per_page=50`);
const release = releases.find((r) => r.tag_name === PREFERRED_TAG) || releases[0];
if (!release) throw new Error("no releases found");
const assets = release.assets.map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url }));
console.log(`Release ${release.tag_name}: ${assets.length} assets`);
for (const a of assets) console.log(`  ${a.name} (${a.size} bytes)`);

// Both, as fetched: the repository's LICENSE may cover the code only,
// and the README may state separate terms for the data.
const licence = {};
for (const path of ["LICENSE", "README.md"]) {
  try {
    const text = await get(`https://raw.githubusercontent.com/${REPO}/master/${path}`, "text");
    licence[path] = path === "README.md" ? (text.match(/[^\n]*(licen[cs]e|CC[- ]BY|Creative Commons|attribution)[^\n]*/gi) || []).slice(0, 8) : text.slice(0, 600);
  } catch (e) {
    licence[path] = `not fetched: ${e.message}`;
  }
}

const work = mkdtempSync(join(tmpdir(), "qalign-"));
function readAsset(buf, name) {
  const out = [];
  if (/\.zip$/i.test(name)) {
    const zip = join(work, name);
    writeFileSync(zip, buf);
    const dir = join(work, name + ".d");
    mkdirSync(dir, { recursive: true });
    execFileSync("unzip", ["-q", "-o", zip, "-d", dir]);
    const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
    for (const f of walk(dir)) if (/\.json$/i.test(f)) out.push({ file: f.slice(dir.length + 1), data: JSON.parse(readFileSync(f, "utf8")) });
  } else if (/\.json$/i.test(name)) {
    out.push({ file: name, data: JSON.parse(buf.toString("utf8")) });
  }
  return out;
}

function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}
const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

const report = {
  _computed: new Date().toISOString().slice(0, 10),
  _source: `github.com/${REPO}, release ${release.tag_name}`,
  _method: "Each candidate's last-word end time per verse compared with data/recitation/durations.json; pass criteria in scripts/build-word-timings.mjs, fixed before the data was seen.",
  criteria: CRIT,
  licence,
  assets: assets.map(({ name, size }) => ({ name, size })),
  candidates: [],
};

// A release may ship one archive per recording or one archive holding
// them all, so candidates are matched on the file names inside.
const assetFiles = new Map();
for (const asset of assets) {
  try {
    assetFiles.set(asset.name, readAsset(await get(asset.url, "buffer"), asset.name));
  } catch (e) {
    report.candidates.push({ asset: asset.name, error: e.message });
  }
}
report.files = [...assetFiles].flatMap(([a, fs]) => fs.map((f) => `${a}/${f.file}`));
for (const [reciter, re] of Object.entries(CANDIDATES)) {
  const ours = durations.durations[reciter];
  if (!ours) continue;
  for (const [assetName, files] of assetFiles) {
    const asset = { name: assetName };
    for (const { file, data } of files.filter((f) => re.test(f.file.split("/").pop()))) {
      const rows = Array.isArray(data) ? data : Object.values(data);
      const byKey = new Map();
      for (const r of rows) if (r && r.surah && r.ayah && Array.isArray(r.segments)) byKey.set(`${r.surah}:${r.ayah}`, r.segments);
      const xs = [], ys = [], diffs = [];
      let minIdx = Infinity, eqAll = 0, eqNoMarks = 0, eqAllPlus1 = 0;
      verseIndex.forEach(([s, a], i) => {
        const seg = byKey.get(`${s}:${a}`);
        if (!seg || !seg.length) return;
        const lastEnd = Math.max(...seg.map((g) => g[3]));
        xs.push(ours[i]);
        ys.push(lastEnd);
        diffs.push(ours[i] - lastEnd);
        const maxEnd = Math.max(...seg.map((g) => g[1]));
        minIdx = Math.min(minIdx, ...seg.map((g) => g[0]));
        const wc = wordCounts.get(`${s}:${a}`);
        if (maxEnd === wc.all) eqAll++;
        if (maxEnd === wc.noMarks) eqNoMarks++;
        if (maxEnd === wc.all + 1) eqAllPlus1++;
      });
      const covered = xs.length;
      const fitShare = covered ? diffs.filter((d) => d >= CRIT.fitLo && d <= CRIT.fitHi).length / covered : 0;
      const r = covered > 2 ? pearson(xs, ys) : 0;
      const verdict = {
        coverage: covered / 6236 >= CRIT.coverage,
        fit: fitShare >= CRIT.fit,
        agreement: r >= CRIT.r,
      };
      const pass = verdict.coverage && verdict.fit && verdict.agreement;
      const entry = {
        reciter,
        asset: asset.name,
        file,
        verses: covered,
        coverage: +(covered / 6236).toFixed(4),
        fitShare: +fitShare.toFixed(4),
        r: +r.toFixed(5),
        diffMs: covered ? { p5: pct(diffs, 0.05), median: pct(diffs, 0.5), p95: pct(diffs, 0.95), min: Math.min(...diffs), max: Math.max(...diffs) } : null,
        wordIndex: {
          smallestStart: minIdx === Infinity ? null : minIdx,
          versesWhereLastEndEqualsTanzilWords: eqAll,
          versesWhereLastEndEqualsTanzilWordsWithoutPauseMarks: eqNoMarks,
          versesWhereLastEndEqualsTanzilWordsPlusOne: eqAllPlus1,
        },
        verdict,
        pass,
      };
      report.candidates.push(entry);
      console.log(`${pass ? "PASS" : "FAIL"} ${reciter} ← ${asset.name}/${file}: ${covered} verses, fit ${(100 * fitShare).toFixed(1)}%, r ${r.toFixed(4)}, diff median ${entry.diffMs && entry.diffMs.median} ms`);
    }
  }
}
console.log(`Files in the release: ${report.files.join(", ")}`);

// Bundle the best passing file per reciter (highest fit share).
const outDir = join(ROOT, "data/recitation/words");
if (existsSync(outDir)) rmSync(outDir, { recursive: true });
const best = new Map();
for (const c of report.candidates) if (c.pass && (!best.has(c.reciter) || c.fitShare > best.get(c.reciter).fitShare)) best.set(c.reciter, c);
for (const [reciter, c] of best) {
  const { data } = assetFiles.get(c.asset).find((f) => f.file === c.file);
  const rows = Array.isArray(data) ? data : Object.values(data);
  const bySurah = new Map();
  for (const r of rows) {
    if (!r || !r.surah || !Array.isArray(r.segments)) continue;
    if (!bySurah.has(r.surah)) bySurah.set(r.surah, {});
    bySurah.get(r.surah)[r.ayah] = r.segments;
  }
  mkdirSync(join(outDir, reciter), { recursive: true });
  for (const [s, obj] of bySurah) writeFileSync(join(outDir, reciter, `${s}.json`), JSON.stringify(obj) + "\n");
  c.bundled = true;
}
report.bundled = [...best.keys()];
writeFileSync(join(ROOT, "data/recitation/word-timings-report.json"), JSON.stringify(report, null, 1) + "\n");
rmSync(work, { recursive: true, force: true });
console.log(`Bundled: ${report.bundled.length ? report.bundled.join(", ") : "none"}. Report: data/recitation/word-timings-report.json`);
