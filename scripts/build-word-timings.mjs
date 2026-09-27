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
// (each verse's measured length in the file Read plays) and, for the
// reciters that clear that first check, against the audio itself.
//
// ── METHODOLOGY, v2 (this file) ──────────────────────────────────────
// v1 (shipped 2026-09-26) gated on one proxy: whether the verse's last
// word ended within -150..+3,000 ms of the file's own end ("fit"). That
// conflates two different things a candidate could get wrong — the
// WORDS LANDING IN THE WRONG PLACE, and the RECORDING JUST HAVING MORE
// TRAILING SILENCE than everyayah's copy — and only the first one
// matters for highlighting. Rerunning it on real data (2026-09-26)
// confirmed the conflation: Husary failed on "fit" (84.6%) with a
// diff distribution that is one-sided and large (min -20 ms, median
// +1,732 ms, p95 +3,993 ms) — the sign and shape of trailing silence,
// not of misaligned words, and a correlation (r=0.9985) as strong as
// the reciters that passed. "fit" is retained below and reported
// (`fitShare`, under `legacyFit`) for continuity, but no longer gates.
//
// v2 replaces it with two direct tests, thresholds fixed in this
// comment BEFORE this version ran against any reciter's data:
//
//   SPEED FIT. If a candidate's recording runs at a different relative
//   speed than the one everyayah's timings were made for, the gap
//   between "our" verse length and quran-align's last-word end grows
//   with verse length — a straight line, not noise. Computed for free
//   from data already fetched for the v1 check: linear regression of
//   diffMs (ours - theirs) against ourMs (our measured verse length),
//   across every covered verse. SPEED_SLOPE_MAX = 0.001 (0.1% relative
//   speed): calibrated from the corpus's own verse-length distribution,
//   not from any candidate's result — data/recitation/durations.json's
//   longest verse (2:282, ~260 s) would drift about 260 ms at that
//   slope, its median verse (~20 s) about 20 ms.
//
//   ONSET FIT. Whether the FIRST word actually starts where quran-align
//   says it does, measured directly against the audio Read plays (not
//   inferred from file length). For a fixed, deterministic sample of
//   verses per reciter (every ayah after a surah's first, plus surah 1's
//   ayah 1 — later ayahs are sampled to sidestep the basmala, which
//   verse-1 audio may include but Tanzil's ayah-1 text and quran-align's
//   word count do not; see build-recitation-durations.mjs), the audio's
//   own first non-silent moment (ffmpeg silencedetect, -30dB / 100ms —
//   ffmpeg defaults for speech-with-recording-noise, chosen for the
//   detector rather than tuned to any reciter) is compared with
//   quran-align's start_ms for word_start=0. ONSET_TOLERANCE_MS = 150:
//   the commonly cited just-noticeable audio lead/lag in AV-sync
//   literature is roughly 100-125 ms; 150 ms is that figure with margin
//   for MP3 encoding and silence-detector noise, not tuned to a result.
//   Pass: at least ONSET_MIN_SAMPLE measurable verses and at least
//   ONSET_MATCH_SHARE of them within tolerance.
//
// A candidate passes v2 when coverage and agreement (kept from v1, as
// basic sanity that the file is the right recording at all) AND speed
// fit AND onset fit all hold. Every threshold above was fixed before
// this version was run against Husary's or anyone else's data; the
// change was made because v1's single criterion was shown to measure
// the wrong thing, not because any reciter's result was unwelcome. This
// paragraph and the numbers above do not change based on what a rerun
// finds — a further change needs the same discipline: name the flaw,
// fix it for every candidate, before looking at who it moves.
//
// Writes:
//   data/recitation/word-timings-report.json   always: every release asset
//       seen, every candidate's v1 and v2 figures and verdicts, the
//       word-index conventions observed, and the licence text as fetched
//   data/recitation/words/<reciter>/<surah>.json   passing reciters only:
//       { "<ayah>": [[word_start, word_end, start_ms, end_ms], ...] },
//       segments exactly as published, not reinterpreted
//
// Nothing is wired into the page until the report has been read: which
// word numbering quran-align uses relative to our Tanzil text is recorded
// here as observed, not assumed.

import { execFileSync, spawnSync } from "node:child_process";
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

// v1 criteria: coverage and agreement still gate (below); fit is kept
// only as a reported, non-gating figure (legacyFit). See the file
// header for why fit was dropped as a gate.
const CRIT_V1 = { coverage: 0.99, fit: 0.98, fitLo: -150, fitHi: 3000, r: 0.99 };
// v2 additions, fixed before this version ran (see file header).
const CRIT_V2 = {
  speedSlopeMax: 0.001,
  onsetToleranceMs: 150,
  onsetMinSample: 50,
  onsetMatchShare: 0.95,
  onsetSampleTarget: 100,
};

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

async function pool(items, concurrency, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}

// ── Reciters and URL pattern, read from assets/app.js (the one place a
// recitation URL is built), same approach as
// build-recitation-durations.mjs — so onset audio is fetched from
// exactly the files Read plays. ──────────────────────────────────────
const app = readFileSync(join(ROOT, "assets", "app.js"), "utf8");
const recitersBlock = /const RECITERS = \[([\s\S]*?)\];/.exec(app);
if (!recitersBlock) throw new Error("RECITERS not found in assets/app.js");
const RECITERS = new Map(
  [...recitersBlock[1].matchAll(/\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*bitrate:\s*(\d+)\s*\}/g)].map((m) => [
    m[1],
    { name: m[2], bitrate: Number(m[3]) },
  ]),
);
const urlBase = /"(https:\/\/cdn\.islamic\.network\/quran\/audio\/)"\s*\+\s*bitrate/.exec(app);
if (!urlBase) throw new Error("qdReciteUrl's URL pattern not found in assets/app.js");
const audioUrlFor = (reciter, globalAyah) => `${urlBase[1]}${RECITERS.get(reciter).bitrate}/${reciter}/${globalAyah}.mp3`;

// ── Our side ─────────────────────────────────────────────────────────
const durations = JSON.parse(readFileSync(join(ROOT, "data/recitation/durations.json"), "utf8"));
const verseIndex = []; // mushaf order: [surah, ayah]; index i is global ayah i+1
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
// Verses eligible for the onset sample: not a surah's first ayah, except
// al-Fatihah's (which IS the basmala, so there is no preceding one to
// confuse the audio's start with).
const onsetEligible = verseIndex.map((v, i) => ({ s: v[0], a: v[1], globalAyah: i + 1 })).filter((v) => v.a > 1 || v.s === 1);

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
const unreadable = [];
function readAsset(buf, name) {
  const out = [];
  if (/\.zip$/i.test(name)) {
    const zip = join(work, name);
    writeFileSync(zip, buf);
    const dir = join(work, name + ".d");
    mkdirSync(dir, { recursive: true });
    execFileSync("unzip", ["-q", "-o", zip, "-d", dir]);
    const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
    for (const f of walk(dir)) {
      if (!/\.json$/i.test(f)) continue;
      const file = f.slice(dir.length + 1);
      // One unreadable file must not hide the rest of the archive.
      try {
        out.push({ file, data: JSON.parse(readFileSync(f, "utf8")) });
      } catch (e) {
        unreadable.push({ file: `${name}/${file}`, error: e.message.slice(0, 120) });
      }
    }
  } else if (/\.json$/i.test(name)) {
    out.push({ file: name, data: JSON.parse(buf.toString("utf8")) });
  }
  return out;
}

function linreg(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return { slope: sxx ? sxy / sxx : 0, intercept: my - (sxx ? sxy / sxx : 0) * mx, r: sxy / Math.sqrt(sxx * syy) };
}
const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};

const report = {
  _computed: new Date().toISOString().slice(0, 10),
  _source: `github.com/${REPO}, release ${release.tag_name}`,
  _method:
    "v2: coverage and agreement (last-word-end vs our measured verse length, both from data/recitation/durations.json) gate as in v1; " +
    "speed fit (regression of that gap against verse length) and onset fit (the audio's own first non-silent moment, via ffmpeg, " +
    "against quran-align's first-word start) replace v1's single fit-window proxy. All thresholds fixed in scripts/build-word-timings.mjs " +
    "before this version ran; see that file's header for the full methodology and why it changed.",
  criteriaVersion: 2,
  criteria: { ...CRIT_V1, ...CRIT_V2 },
  previousCriteria: { version: 1, criteria: CRIT_V1, note: "fit (the -150..3,000 ms window) no longer gates; kept below as legacyFit for continuity." },
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
report.unreadable = unreadable;
for (const u of unreadable) console.log(`Unreadable: ${u.file} (${u.error})`);

// byKey per (reciter, asset, file), kept in memory (not written) so the
// onset step below can re-use it for whichever file is best per reciter,
// without re-parsing the archive.
const byKeyCache = new Map(); // "reciter\u0000asset\u0000file" -> Map("s:a" -> segments)

for (const [reciter, re] of Object.entries(CANDIDATES)) {
  const ours = durations.durations[reciter];
  if (!ours) continue;
  for (const [assetName, files] of assetFiles) {
    const asset = { name: assetName };
    for (const { file, data } of files.filter((f) => re.test(f.file.split("/").pop()))) {
      const rows = Array.isArray(data) ? data : Object.values(data);
      const byKey = new Map();
      for (const r of rows) if (r && r.surah && r.ayah && Array.isArray(r.segments)) byKey.set(`${r.surah}:${r.ayah}`, r.segments);
      byKeyCache.set(`${reciter}\u0000${asset.name}\u0000${file}`, byKey);
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
      const fitShare = covered ? diffs.filter((d) => d >= CRIT_V1.fitLo && d <= CRIT_V1.fitHi).length / covered : 0;
      const { slope, r } = covered > 2 ? linreg(xs, diffs) : { slope: 0, r: 0 };
      const { r: agreement } = covered > 2 ? linreg(xs, ys) : { r: 0 };
      const verdict = {
        coverage: covered / 6236 >= CRIT_V1.coverage,
        agreement: agreement >= CRIT_V1.r,
        speedOk: Math.abs(slope) <= CRIT_V2.speedSlopeMax,
        // onsetOk is filled in after the audio-based step below; a
        // candidate that never reaches that step (fails coverage or
        // agreement first) stays false, not undefined-treated-as-pass.
        onsetOk: false,
      };
      const entry = {
        reciter,
        asset: asset.name,
        file,
        verses: covered,
        coverage: +(covered / 6236).toFixed(4),
        r: +agreement.toFixed(5),
        legacyFit: { fitShare: +fitShare.toFixed(4), pass_v1: fitShare >= CRIT_V1.fit },
        speedFit: { slopeMsPerMs: +slope.toFixed(6), r: +r.toFixed(4) },
        diffMs: covered ? { p5: pct(diffs, 0.05), median: pct(diffs, 0.5), p95: pct(diffs, 0.95), min: Math.min(...diffs), max: Math.max(...diffs) } : null,
        wordIndex: {
          smallestStart: minIdx === Infinity ? null : minIdx,
          versesWhereLastEndEqualsTanzilWords: eqAll,
          versesWhereLastEndEqualsTanzilWordsWithoutPauseMarks: eqNoMarks,
          versesWhereLastEndEqualsTanzilWordsPlusOne: eqAllPlus1,
        },
        verdict,
        pass: false, // finalized after the onset step
      };
      report.candidates.push(entry);
      console.log(
        `${reciter} ← ${asset.name}/${file}: ${covered} verses, coverage ${(100 * entry.coverage).toFixed(1)}%, r ${agreement.toFixed(4)}, ` +
          `speed slope ${slope.toFixed(6)} ms/ms (legacy fit ${(100 * fitShare).toFixed(1)}%)`,
      );
    }
  }
}
console.log(`Files in the release: ${report.files.join(", ")}`);

// ── Onset fit: only for the best-by-legacy-fit file per reciter among
// those that already pass coverage and agreement — an expensive,
// audio-fetching step, so it runs once per reciter, not once per file. ─
const onsetCandidates = new Map(); // reciter -> entry
for (const c of report.candidates) {
  if (!c.reciter || !c.verdict || !c.verdict.coverage || !c.verdict.agreement) continue;
  const prev = onsetCandidates.get(c.reciter);
  if (!prev || c.legacyFit.fitShare > prev.legacyFit.fitShare) onsetCandidates.set(c.reciter, c);
}

// ffmpeg's silencedetect writes its markers to stderr and exits 0 on a
// normal decode regardless of what it found, so the marker must be
// parsed from stderr on success too — not inferred from whether the
// process threw. SILENCE_ARGS is the detector's own setting (noise
// floor and minimum duration), fixed once here and never adjusted per
// reciter or per result.
const SILENCE_ARGS = ["-af", "silencedetect=noise=-30dB:d=0.1", "-f", "null", "-"];
function parseFirstSilenceEnd(output) {
  const m = /silence_end:\s*([\d.]+)/.exec(output);
  return m ? Math.round(parseFloat(m[1]) * 1000) : null;
}

// Fatal, run once before any candidate is touched: proves ffmpeg is
// present and this parsing actually detects a known onset, so a broken
// detector fails loudly instead of quietly reporting "onset 0 ms" (a
// false pass) for every verse.
function selfTestSilenceDetector() {
  const f = join(work, "selftest.wav");
  const rate = 8000;
  const silenceMs = 620;
  const toneMs = 400;
  const n = Math.round((rate * (silenceMs + toneMs)) / 1000);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  const silenceSamples = Math.round((rate * silenceMs) / 1000);
  for (let i = 0; i < n; i++) {
    const v = i < silenceSamples ? 0 : Math.round(8000 * Math.sin((2 * Math.PI * 440 * (i - silenceSamples)) / rate));
    buf.writeInt16LE(v, 44 + i * 2);
  }
  writeFileSync(f, buf);
  const res = spawnSync("ffmpeg", ["-i", f, ...SILENCE_ARGS], { encoding: "utf8" });
  rmSync(f, { force: true });
  if (res.error) throw new Error(`ffmpeg is not available: ${res.error.message}`);
  const onset = parseFirstSilenceEnd(`${res.stdout || ""}${res.stderr || ""}`);
  if (onset === null || Math.abs(onset - silenceMs) > 60)
    throw new Error(`onset self-test failed: expected ~${silenceMs} ms, got ${onset} ms. Detector output:\n${res.stderr}`);
  console.log(`Onset detector self-test OK (expected ~${silenceMs} ms, measured ${onset} ms).`);
}

async function fetchAudio(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "divinediscourses-word-timings" }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

// Returns the onset in ms, or throws (a per-verse "skip", caught by the
// pool worker below) if the file could not be decoded — never silently
// treats a decode failure as "starts at 0 ms".
async function silenceOnsetMs(url) {
  const buf = await fetchAudio(url);
  const f = join(work, `onset-${process.hrtime.bigint()}.mp3`);
  writeFileSync(f, buf);
  try {
    const res = spawnSync("ffmpeg", ["-i", f, ...SILENCE_ARGS], { encoding: "utf8" });
    if (res.error) throw new Error(`ffmpeg spawn failed: ${res.error.message}`);
    if (res.status !== 0) throw new Error(`ffmpeg exited ${res.status}: ${(res.stderr || "").slice(-200)}`);
    const onset = parseFirstSilenceEnd(`${res.stdout || ""}${res.stderr || ""}`);
    return onset === null ? 0 : onset; // no leading silence found: starts immediately
  } finally {
    rmSync(f, { force: true });
  }
}

if (onsetCandidates.size) selfTestSilenceDetector();
for (const [reciter, entry] of onsetCandidates) {
  const byKey = byKeyCache.get(`${reciter}\u0000${entry.asset}\u0000${entry.file}`);
  const covered = onsetEligible.filter((v) => byKey.has(`${v.s}:${v.a}`));
  const step = Math.max(1, Math.floor(covered.length / CRIT_V2.onsetSampleTarget));
  const sample = covered.filter((_, i) => i % step === 0).slice(0, CRIT_V2.onsetSampleTarget);
  console.log(`Onset fit: ${reciter} — sampling ${sample.length} of ${covered.length} eligible verses`);
  const results = await pool(sample, 8, async (v) => {
    const seg = byKey.get(`${v.s}:${v.a}`);
    const firstWord = seg.filter((g) => g[0] === 0);
    if (!firstWord.length) return { skip: "no word_start=0 segment" };
    const theirsMs = Math.min(...firstWord.map((g) => g[2]));
    try {
      const oursMs = await silenceOnsetMs(audioUrlFor(reciter, v.globalAyah));
      if (oursMs === null) return { skip: "onset not detected" };
      return { s: v.s, a: v.a, diff: oursMs - theirsMs };
    } catch (e) {
      return { skip: e.message.slice(0, 80) };
    }
  });
  const diffs = results.filter((r) => "diff" in r).map((r) => r.diff);
  const skipped = results.filter((r) => r.skip);
  const matched = diffs.filter((d) => Math.abs(d) <= CRIT_V2.onsetToleranceMs).length;
  const share = diffs.length ? matched / diffs.length : 0;
  entry.onsetFit = {
    sampled: sample.length,
    measured: diffs.length,
    skipped: skipped.length,
    skipReasons: [...new Set(skipped.map((r) => r.skip))].slice(0, 5),
    matched,
    matchShare: +share.toFixed(4),
    toleranceMs: CRIT_V2.onsetToleranceMs,
    diffMs: diffs.length ? { p5: pct(diffs, 0.05), median: pct(diffs, 0.5), p95: pct(diffs, 0.95) } : null,
  };
  entry.verdict.onsetOk = diffs.length >= CRIT_V2.onsetMinSample && share >= CRIT_V2.onsetMatchShare;
  entry.pass = entry.verdict.coverage && entry.verdict.agreement && entry.verdict.speedOk && entry.verdict.onsetOk;
  console.log(
    `${entry.pass ? "PASS" : "FAIL"} ${reciter} v2: coverage ${entry.verdict.coverage}, agreement ${entry.verdict.agreement}, ` +
      `speed ${entry.verdict.speedOk} (slope ${entry.speedFit.slopeMsPerMs}), onset ${entry.verdict.onsetOk} ` +
      `(${matched}/${diffs.length} within ${CRIT_V2.onsetToleranceMs}ms, ${skipped.length} skipped)`,
  );
}
// Any candidate never reached by the onset step (failed coverage or
// agreement) is already pass: false from its initialization above.

// Bundle the best passing file per reciter (highest onset match share
// among passing candidates, legacy fit as the tiebreak).
const outDir = join(ROOT, "data/recitation/words");
if (existsSync(outDir)) rmSync(outDir, { recursive: true });
const best = new Map();
for (const c of report.candidates) {
  if (!c.pass) continue;
  const prev = best.get(c.reciter);
  if (!prev || (c.onsetFit?.matchShare ?? 0) > (prev.onsetFit?.matchShare ?? 0)) best.set(c.reciter, c);
}
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
