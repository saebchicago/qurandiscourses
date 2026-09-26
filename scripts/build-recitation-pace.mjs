#!/usr/bin/env node
//
// build-recitation-pace.mjs — summarize the measured recitation durations
// into listening times and pace, per reciter.
//
//   node scripts/build-recitation-pace.mjs
//
// Reads data/recitation/durations.json (measured by the network-only
// scripts/build-recitation-durations.mjs), the morphology (word-units per
// verse), data/chronology.json (periods) and data/juz.json (juz
// boundaries). Writes data/recitation/pace.json:
//   reciters[]: total listening time, median seconds per verse, and
//     word-units per minute overall and per period;
//   surahSeconds[reciterId][surah - 1] and juzSeconds[reciterId][juz - 1]:
//     listening time per surah and per juz.
// and data/recitation/verse-seconds/{reciterId}.json: each verse's
// duration in seconds (one decimal), indexed by global verse number - 1,
// which the listening sheet on /read fetches for the chosen reciter when
// it opens, to show how long the passage takes.
//
// Pace is word-units (Leeds tokens) per minute of recitation. It describes
// how a reciter performs, in one recording style, not a property of the
// text; the _method says so, and so does every page that shows it.
// Deterministic; offline.

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computedDate } from "./lib/computed-date.mjs";
import { TOTAL_VERSES } from "./lib/corpus.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = join(ROOT, "data");
const read = (p) => JSON.parse(readFileSync(join(DATA, p), "utf8"));

const PERIODS = ["meccan-early", "meccan-middle", "meccan-late", "medinan"];

const dur = read("recitation/durations.json");
const chronology = read("chronology.json");
const juz = read("juz.json").juz;

// Verse table in global order: surah, verse, word-units, period.
const verses = [];
for (let s = 1; s <= 114; s++) {
  const morph = read(`morphology/${s}.json`);
  const ns = Object.keys(morph).map(Number).sort((a, b) => a - b);
  for (const v of ns) verses.push({ s, v, tokens: morph[String(v)].length, period: chronology[String(s)].period });
}
if (verses.length !== TOTAL_VERSES) throw new Error(`${verses.length} verses in morphology, expected ${TOTAL_VERSES}`);

const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
const median = (arr) => {
  const a = [...arr].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const inJuz = (j, s, v) =>
  (s > j.startSurah || (s === j.startSurah && v >= j.startAyah)) &&
  (s < j.endSurah || (s === j.endSurah && v <= j.endAyah));

const reciters = [];
const surahSeconds = {};
const juzSeconds = {};
for (const r of dur.reciters) {
  const ms = dur.durations[r.id];
  if (!ms || ms.length !== TOTAL_VERSES) throw new Error(`${r.id}: ${ms && ms.length} durations, expected ${TOTAL_VERSES}`);
  const totalMs = ms.reduce((a, b) => a + b, 0);
  const tokens = verses.reduce((a, x) => a + x.tokens, 0);
  const byPeriod = {};
  for (const p of PERIODS) {
    let t = 0;
    let m = 0;
    verses.forEach((x, i) => {
      if (x.period === p) {
        t += x.tokens;
        m += ms[i];
      }
    });
    byPeriod[p] = round(t / (m / 60000), 1);
  }
  reciters.push({
    id: r.id,
    name: r.name,
    totalSeconds: Math.round(totalMs / 1000),
    medianVerseSeconds: round(median(ms) / 1000, 1),
    wordUnitsPerMinute: round(tokens / (totalMs / 60000), 1),
    wordUnitsPerMinuteByPeriod: byPeriod,
  });
  const ss = new Array(114).fill(0);
  verses.forEach((x, i) => (ss[x.s - 1] += ms[i]));
  surahSeconds[r.id] = ss.map((x) => Math.round(x / 1000));
  juzSeconds[r.id] = juz.map((j) => {
    let t = 0;
    verses.forEach((x, i) => {
      if (inJuz(j, x.s, x.v)) t += ms[i];
    });
    return Math.round(t / 1000);
  });
}

const out = {
  _generated: "scripts/build-recitation-pace.mjs",
  _computed: computedDate(),
  _method:
    "From data/recitation/durations.json (each verse's recitation length, measured from the audio file /read plays). " +
    "Listening time = sum of verse durations. Pace = word-units (Leeds tokens) per minute of recitation, overall and " +
    "per Cairo 1924 period. A reciter's pace describes that recording's performance, not the text.",
  _source: dur._source,
  reciters,
  surahSeconds,
  juzSeconds,
};
writeFileSync(join(DATA, "recitation", "pace.json"), JSON.stringify(out) + "\n");
const VS = join(DATA, "recitation", "verse-seconds");
mkdirSync(VS, { recursive: true });
for (const f of readdirSync(VS)) rmSync(join(VS, f));
for (const r of dur.reciters)
  writeFileSync(join(VS, `${r.id}.json`), JSON.stringify(dur.durations[r.id].map((ms) => round(ms / 1000, 1))) + "\n");
console.log(
  `build-recitation-pace: ${reciters.length} reciters -> data/recitation/pace.json (` +
    reciters.map((r) => `${r.id} ${(r.totalSeconds / 3600).toFixed(1)} h, ${r.wordUnitsPerMinute}/min`).join("; ") +
    ")",
);
