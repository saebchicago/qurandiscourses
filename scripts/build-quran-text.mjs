#!/usr/bin/env node
//
// build-quran-text.mjs — bundle the Arabic text of the Qur'an with the
// site, so /read renders the Arabic without a network call and keeps
// rendering it when the text service is down.
//
//   node scripts/build-quran-text.mjs          # fetch, verify, write
//   node scripts/build-quran-text.mjs --check  # fetch, compare only
//
// THE TEXT COMES FROM TANZIL, VERBATIM. Tanzil's terms allow verbatim
// copies only and require its copyright notice in every copy, so each
// verse is written exactly as Tanzil's own Uthmani download carries it
// (a leading byte-order mark aside, which is file encoding, not text),
// and the notice is copied from that file into data/quran-text/index.json.
//
// WHY NOT alquran.cloud's COPY. /read showed alquran.cloud's
// `quran-uthmani` edition, which that service attributes to Tanzil. The
// first run of this script on GitHub's runners (2026-09-26) found it
// matches Tanzil's current download in only 2,619 of 6,236 verses. The
// differences are marks, not words: alquran.cloud writes the small low
// meem (U+06ED) and small high meem (U+06E2) about 4,700 and 1,900 times
// where Tanzil's file does not, a standalone hamza (U+0621) where Tanzil
// has hamza above on a tatweel (U+0640 U+0654) 277 times, and the small
// yeh (U+06E6) 38 times. Which Tanzil release (if any) that copy is was
// not established, so the license holder's own file is used instead, and
// the comparison is recorded in the index rather than hidden.
//
// alquran.cloud still supplies what is not text: surah names, and each
// verse's juz, manzil, page, ruku, hizb-quarter and sajda fields, in the
// same shape the reader already consumes. Its surah and verse counts must
// agree with Tanzil's exactly or nothing is written.
//
// NEEDS THE NETWORK (api.alquran.cloud, tanzil.net). Some development
// environments block both; .github/workflows/quran-text.yml runs this on
// GitHub's runners and commits the result. check-generated-freshness
// lists it as excluded for the same reason as build-surah-meta.
//
// Deterministic: the output depends only on the fetched files. The
// `_computed` stamp is kept from the committed index while the content
// hash is unchanged, so a rerun that finds nothing new writes nothing new.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computedDate } from "./lib/computed-date.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data", "quran-text");
const CHECK = process.argv.includes("--check");

const ALQURAN_URL = "https://api.alquran.cloud/v1/quran/quran-uthmani";
// Tanzil's download form. The mark options (marks, sajdah, rub, alef) were
// tried in all 16 combinations on the first run and every one returned the
// same file, so none are sent.
const TANZIL_URL = "https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true";

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

// What differs between the two copies, by code point, summed over every
// differing verse (a multiset difference per verse). Recorded, decides
// nothing.
function compareCopies(api, tz) {
  const bump = (m, k, n) => m.set(k, (m.get(k) || 0) + n);
  const count = (t) => {
    const m = new Map();
    for (const ch of t) bump(m, ch, 1);
    return m;
  };
  const moreInServed = new Map();
  const moreInTanzil = new Map();
  let identical = 0;
  let differing = 0;
  for (const s of api.surahs)
    for (const a of s.ayahs) {
      const served = a.text.replace(/^﻿/, "");
      const tanzil = tz.verses.get(`${s.number}:${a.numberInSurah}`);
      if (served === tanzil) {
        identical++;
        continue;
      }
      differing++;
      const cs = count(served);
      const ct = count(tanzil);
      for (const [ch, n] of cs) if (n > (ct.get(ch) || 0)) bump(moreInServed, ch, n - (ct.get(ch) || 0));
      for (const [ch, n] of ct) if (n > (cs.get(ch) || 0)) bump(moreInTanzil, ch, n - (cs.get(ch) || 0));
    }
  const list = (m) =>
    [...m]
      .sort((x, y) => y[1] - x[1] || x[0].codePointAt(0) - y[0].codePointAt(0))
      .map(([ch, n]) => ({ codePoint: "U+" + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0"), count: n }));
  return { identical, differing, moreInServedCopy: list(moreInServed), moreInTanzil: list(moreInTanzil) };
}

function hashText(tz) {
  const h = createHash("sha256");
  for (const [ref, text] of tz.verses) h.update(`${ref}|${text}\n`);
  for (const line of tz.notice) h.update(line + "\n");
  return h.digest("hex");
}

// One verse per line: a text correction upstream shows up as a one-line
// diff instead of a rewritten file.
function surahFile(s, tz, edition) {
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
      text: tz.verses.get(`${s.number}:${a.numberInSurah}`),
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
  console.log(`Fetching ${TANZIL_URL}`);
  const tz = parseTanzil(await get(TANZIL_URL, "text"));
  if (tz.verses.size !== EXPECTED_AYAHS) throw new Error(`Tanzil: ${tz.verses.size} verses, expected 6236`);
  if (!tz.notice.length) throw new Error("Tanzil's file carried no copyright notice; refusing to bundle without it");
  for (const [ref, text] of tz.verses) if (!text.trim()) throw new Error(`Tanzil: ${ref} is empty`);

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
      if (!tz.verses.has(`${s.number}:${a.numberInSurah}`))
        throw new Error(`verse ${s.number}:${a.numberInSurah} is in alquran.cloud's numbering but not Tanzil's`);
    });
  });

  const comparison = compareCopies(api, tz);
  console.log(
    `alquran.cloud's copy vs Tanzil's file: ${comparison.identical} identical, ${comparison.differing} differing verses`,
  );

  const sha256 = hashText(tz);
  const indexPath = join(OUT, "index.json");
  const prior = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, "utf8")) : null;

  if (CHECK) {
    if (!prior) {
      console.error("check: data/quran-text/ has not been built yet.");
      process.exit(1);
    }
    if (prior.sha256 !== sha256) {
      console.error(`check: Tanzil's file changed (committed ${prior.sha256}, now ${sha256}). Rerun without --check.`);
      process.exit(1);
    }
    console.log(`check: OK, bundled text matches Tanzil's current file (${sha256}).`);
    return;
  }

  const edition = {
    identifier: "quran-uthmani",
    language: "ar",
    name: api.edition.name,
    englishName: "Tanzil Uthmani",
    format: "text",
    type: "quran",
    direction: "rtl",
  };
  const index = {
    _computed: prior && prior.sha256 === sha256 ? prior._computed : computedDate(),
    _method:
      "Verse text copied verbatim from Tanzil's Uthmani download (txt-2), leading byte-order mark removed. " +
      "Surah names and each verse's juz, manzil, page, ruku, hizb-quarter and sajda fields from alquran.cloud's " +
      "quran-uthmani edition, whose surah and verse numbering matched Tanzil's exactly.",
    sources: {
      text: { name: "Tanzil Quran Text (Uthmani)", url: "https://tanzil.net", download: TANZIL_URL },
      structure: { name: "alquran.cloud", url: ALQURAN_URL },
    },
    license:
      "Creative Commons Attribution 3.0; verbatim copies only, changing the text is not allowed (Tanzil terms of use).",
    notice: tz.notice,
    // The copy /read used to fetch, measured against the file bundled
    // here. Kept so the change is visible, not silent.
    servedCopyComparison: comparison,
    sha256,
    surahs: api.surahs.map((s) => ({ number: s.number, numberOfAyahs: s.ayahs.length })),
  };

  mkdirSync(OUT, { recursive: true });
  for (const f of readdirSync(OUT)) if (/^\d+\.json$/.test(f)) rmSync(join(OUT, f));
  for (const s of api.surahs) writeFileSync(join(OUT, `${s.number}.json`), surahFile(s, tz, edition));
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n");
  console.log(`Wrote data/quran-text/: ${api.surahs.length} surahs, ${ayahCount} verses, sha256 ${sha256}.`);
}

main().catch((e) => {
  console.error(`build-quran-text: ${e.message}`);
  process.exit(1);
});
