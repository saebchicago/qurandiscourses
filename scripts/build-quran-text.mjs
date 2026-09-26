#!/usr/bin/env node
//
// build-quran-text.mjs — bundle the Arabic text of the Qur'an with the
// site, so /read renders the Arabic without a network call and keeps
// rendering it when the text service is down.
//
//   node scripts/build-quran-text.mjs          # fetch, verify, write
//   node scripts/build-quran-text.mjs --check  # fetch, verify, compare only
//
// WHY TWO SOURCES. The reader has always shown alquran.cloud's
// `quran-uthmani` edition, which that service states is Tanzil's Uthmani
// text. Bundling alquran.cloud's copy keeps every verse byte-identical to
// what readers already see (same shape, same juz/page/ruku fields), but
// the license belongs to Tanzil, whose terms allow verbatim copies only
// and require its copyright notice in every copy. So the script also
// downloads Tanzil's own file and refuses to write anything unless every
// one of the 6,236 verses matches it. The only difference it tolerates is
// the one alquran.cloud is known to make: verse 1 of each surah other
// than 1 and 9 carries the basmala in front. That prefix must itself be
// Tanzil's own 1:1 text, so the bundled text is still Tanzil's words
// with nothing changed. Tanzil's notice is copied verbatim from the file
// it serves into data/quran-text/index.json.
//
// NEEDS THE NETWORK (api.alquran.cloud, tanzil.net). Some development
// environments block both; .github/workflows/quran-text.yml runs this on
// GitHub's runners and commits the result. check-generated-freshness
// lists it as excluded for the same reason as build-surah-meta.
//
// Deterministic: the output depends only on the fetched text. The
// `_computed` stamp is kept from the committed index while the text hash
// is unchanged, so a rerun that finds nothing new writes nothing new.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computedDate } from "./lib/computed-date.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "quran-text");
const CHECK = process.argv.includes("--check");

const ALQURAN_URL = "https://api.alquran.cloud/v1/quran/quran-uthmani";
const TANZIL_BASE = "https://tanzil.net/pub/download/index.php";
// Tanzil's download form toggles four marks. Which ones alquran.cloud's
// copy carries is not documented, so each combination is tried in turn
// (most likely first) until one matches every verse. The winning
// combination is recorded in the index.
const TANZIL_OPTION_SETS = [];
for (const marks of [true, false])
  for (const sajdah of [true, false])
    for (const rub of [true, false])
      for (const alef of [true, false]) TANZIL_OPTION_SETS.push({ marks, sajdah, rub, alef });

const EXPECTED_SURAHS = 114;
const EXPECTED_AYAHS = 6236;

async function get(url, as) {
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "divinediscourses.org build-quran-text" },
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return as === "json" ? await res.json() : await res.text();
    } catch (e) {
      lastErr = e;
      console.log(`  attempt ${attempt} failed for ${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  throw new Error(`could not fetch ${url}: ${lastErr && lastErr.message}`);
}

function tanzilUrl(o) {
  const q = new URLSearchParams({
    marks: String(o.marks),
    sajdah: String(o.sajdah),
    rub: String(o.rub),
    alef: String(o.alef),
    quranType: "uthmani",
    outType: "txt-2",
    agree: "true",
  });
  return `${TANZIL_BASE}?${q}`;
}

// txt-2 is "surah|ayah|text" per line, then a block of "#" comment lines
// carrying the copyright notice.
function parseTanzil(raw) {
  const text = raw.replace(/^﻿/, "");
  const verses = new Map();
  const notice = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("#")) {
      notice.push(line);
      continue;
    }
    if (!line.trim()) continue;
    const m = /^(\d+)\|(\d+)\|(.*)$/.exec(line);
    if (!m) throw new Error(`unexpected Tanzil line: ${line.slice(0, 80)}`);
    verses.set(`${m[1]}:${m[2]}`, m[3]);
  }
  return { verses, notice };
}

function compare(api, tz) {
  const basmala = tz.verses.get("1:1");
  let exact = 0;
  let prefixed = 0;
  const mismatches = [];
  for (const s of api.surahs) {
    for (const a of s.ayahs) {
      const ref = `${s.number}:${a.numberInSurah}`;
      const want = tz.verses.get(ref);
      const got = a.text;
      if (want === undefined) {
        mismatches.push({ ref, why: "absent from Tanzil" });
      } else if (got === want) {
        exact++;
      } else if (
        a.numberInSurah === 1 &&
        s.number !== 1 &&
        s.number !== 9 &&
        basmala &&
        got.startsWith(basmala) &&
        got.slice(basmala.length).trim() === want
      ) {
        prefixed++;
      } else {
        mismatches.push({ ref, got: got.slice(0, 60), want: want.slice(0, 60) });
      }
    }
  }
  return { exact, prefixed, mismatches, tanzilVerses: tz.verses.size };
}

function hashText(api) {
  const h = createHash("sha256");
  for (const s of api.surahs) for (const a of s.ayahs) h.update(`${s.number}|${a.numberInSurah}|${a.text}\n`);
  return h.digest("hex");
}

// One verse per line: a text correction upstream shows up as a one-line
// diff instead of a rewritten file.
function surahFile(s, edition) {
  const head = {
    number: s.number,
    name: s.name,
    englishName: s.englishName,
    englishNameTranslation: s.englishNameTranslation,
    revelationType: s.revelationType,
    numberOfAyahs: s.ayahs.length,
  };
  const lines = s.ayahs.map((a) =>
    JSON.stringify({
      number: a.number,
      text: a.text,
      numberInSurah: a.numberInSurah,
      juz: a.juz,
      manzil: a.manzil,
      page: a.page,
      ruku: a.ruku,
      hizbQuarter: a.hizbQuarter,
      sajda: a.sajda,
    }),
  );
  const headJson = JSON.stringify(head).slice(0, -1);
  return `${headJson},"edition":${JSON.stringify(edition)},"ayahs":[\n${lines.join(",\n")}\n]}\n`;
}

async function main() {
  console.log(`Fetching ${ALQURAN_URL}`);
  const apiJson = await get(ALQURAN_URL, "json");
  const api = apiJson && apiJson.data;
  if (!api || !Array.isArray(api.surahs)) throw new Error("alquran.cloud: no surahs in response");
  if (!api.edition || api.edition.identifier !== "quran-uthmani")
    throw new Error(`alquran.cloud returned edition ${api.edition && api.edition.identifier}, not quran-uthmani`);
  const ayahCount = api.surahs.reduce((n, s) => n + s.ayahs.length, 0);
  if (api.surahs.length !== EXPECTED_SURAHS || ayahCount !== EXPECTED_AYAHS)
    throw new Error(`alquran.cloud: ${api.surahs.length} surahs / ${ayahCount} verses, expected 114 / 6236`);
  api.surahs.forEach((s, i) => {
    if (s.number !== i + 1) throw new Error(`alquran.cloud: surah ${i + 1} is numbered ${s.number}`);
    s.ayahs.forEach((a, j) => {
      if (a.numberInSurah !== j + 1) throw new Error(`alquran.cloud: ${s.number}:${j + 1} numbered ${a.numberInSurah}`);
    });
  });

  let match = null;
  const tried = [];
  for (const opts of TANZIL_OPTION_SETS) {
    const url = tanzilUrl(opts);
    console.log(`Fetching ${url}`);
    const tz = parseTanzil(await get(url, "text"));
    const result = compare(api, tz);
    tried.push({ opts, exact: result.exact, prefixed: result.prefixed, mismatched: result.mismatches.length });
    console.log(
      `  Tanzil verses ${result.tanzilVerses}; exact ${result.exact}, basmala-prefixed ${result.prefixed}, mismatched ${result.mismatches.length}`,
    );
    if (result.tanzilVerses === EXPECTED_AYAHS && result.mismatches.length === 0) {
      match = { opts, url, tz, result };
      break;
    }
    for (const m of result.mismatches.slice(0, 3)) console.log(`    e.g. ${JSON.stringify(m)}`);
  }
  if (!match) {
    console.error("\nNo Tanzil option set matches alquran.cloud's quran-uthmani verse for verse.");
    console.error("Nothing written: bundling a text that differs from Tanzil's would break its no-modification term.");
    console.table(tried.map((t) => ({ ...t.opts, exact: t.exact, prefixed: t.prefixed, mismatched: t.mismatched })));
    process.exit(1);
  }
  if (!match.tz.notice.length) {
    console.error("Tanzil's file carried no copyright notice; refusing to bundle without it.");
    process.exit(1);
  }

  const sha256 = hashText(api);
  const indexPath = join(OUT, "index.json");
  const prior = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : null;

  if (CHECK) {
    if (!prior) {
      console.error("check: data/quran-text/ has not been built yet.");
      process.exit(1);
    }
    if (prior.sha256 !== sha256) {
      console.error(`check: upstream text changed (committed ${prior.sha256}, now ${sha256}). Rerun without --check.`);
      process.exit(1);
    }
    console.log(`check: OK, bundled text matches upstream (${sha256}).`);
    return;
  }

  const index = {
    _computed: prior && prior.sha256 === sha256 ? prior._computed : computedDate(),
    _method:
      "alquran.cloud's quran-uthmani edition (stated by that service to be Tanzil's Uthmani text), " +
      "accepted only after every verse matched Tanzil's own download; the one tolerated difference is the " +
      "basmala (Tanzil's 1:1 text) placed before verse 1 of each surah other than 1 and 9.",
    sources: {
      text: { name: "Tanzil Quran Text (Uthmani)", url: "https://tanzil.net", download: match.url, options: match.opts },
      served: { name: "alquran.cloud", url: ALQURAN_URL, edition: api.edition },
    },
    license: "Creative Commons Attribution 3.0; verbatim copies only, changing the text is not allowed (Tanzil terms of use).",
    notice: match.tz.notice,
    verification: {
      surahs: api.surahs.length,
      verses: ayahCount,
      exact: match.result.exact,
      basmalaPrefixed: match.result.prefixed,
      mismatched: 0,
    },
    sha256,
    surahs: api.surahs.map((s) => ({ number: s.number, numberOfAyahs: s.ayahs.length })),
  };

  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(OUT)) if (/^\d+\.json$/.test(f)) rmSync(join(OUT, f));
  for (const s of api.surahs) writeFileSync(join(OUT, `${s.number}.json`), surahFile(s, api.edition));
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
  console.log(
    `Wrote data/quran-text/: ${api.surahs.length} surahs, ${ayahCount} verses ` +
      `(${match.result.exact} exact, ${match.result.prefixed} with the basmala prefix), sha256 ${sha256}.`,
  );
}

main().catch((e) => {
  console.error(`build-quran-text: ${e.message}`);
  process.exit(1);
});
