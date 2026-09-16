// check-audio-editions.mjs — liveness for the audio the Read page plays.
//
// Two different things depend on this and neither fails loudly on its
// own:
//
//   1. The five reciter IDs in assets/app.js's RECITERS array are
//      interpolated straight into a cdn.islamic.network URL. A dead ID
//      does not error anywhere in the page — the <audio> element simply
//      never plays, which looks like a slow network rather than a
//      registration that rotted. This is the audio twin of
//      check-editions.mjs, which catches the same class of rot in the
//      TRANSLATIONS array.
//
//   2. Listen mode (assets/listen.js) plays an ENGLISH translation-audio
//      leg after each verse's Arabic. That edition is not hard-coded as a
//      known source; the player discovers it at runtime. This check is
//      the evidence side of that, and it separates two questions the
//      registration conflates:
//
//        identity      what the API's own edition registry says an
//                      English audio edition IS. Its first run answered
//                      this: en.walk is "Ibrahim Walk", language en,
//                      type=versebyverse. That is evidence, from a
//                      primary source, and /sources may use it.
//        availability  whether cdn.islamic.network actually serves that
//                      edition's per-ayah files. Its first run said no,
//                      at either bitrate it then probed. An edition can
//                      be registered and not served.
//        license       neither of the above establishes this, and this
//                      script cannot. It stays unstated until the rights
//                      holder states it.
//
// Registering a reciter name or a license on the strength of this
// script's OUTPUT is the intended path, and only for the part the output
// actually covers. Registering one without it is exactly the "never
// guess" the maintainer guide forbids.
//
// A checker, not a generator: writes nothing. Needs real outbound
// network to api.alquran.cloud and cdn.islamic.network — a sandboxed
// session behind an allowlisting proxy will see spurious failures, so
// run it from an unrestricted machine or let the "Site audit" workflow's
// external-evidence job run it on a GitHub runner.
//
// Run:  node scripts/check-audio-editions.mjs   (exit 1 on failure)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TIMEOUT = 20000;
// The verse every probe asks for. 1 is al-Fatihah:1, present in every
// edition that exists at all.
const PROBE_AYAH = 1;

const failures = [];
const notes = [];

// ── The reciters read.html actually offers ────────────────────────────
const appJs = readFileSync(join(ROOT, "assets", "app.js"), "utf8");
const recitersMatch = appJs.match(/const RECITERS = (\[[\s\S]*?\n {2}\]);/);
if (!recitersMatch) {
  console.error(
    "check-audio-editions: FAIL — could not locate RECITERS array in assets/app.js",
  );
  process.exit(2);
}
const reciters = [...recitersMatch[1].matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
if (!reciters.length) {
  console.error("check-audio-editions: FAIL — parsed zero reciter IDs (parser broken?)");
  process.exit(2);
}

// The bitrate directory read.html and listen.js both interpolate. Kept
// here as a literal on purpose: if the page's path changes, this check
// should be edited in the same commit.
const AR_BITRATE = 128;
// The CDN publishes an edition under one or more bitrate directories and
// there is no registry saying which. 128 is what the site interpolates;
// the rest are probed so a "missing" reciter can be told apart from one
// that is simply served somewhere else.
const BITRATES = [128, 64, 192, 32];
const clip = (edition, bitrate, n) =>
  `https://cdn.islamic.network/quran/audio/${bitrate}/${edition}/${n}.mp3`;

// A ranged GET, not a HEAD. An object store can answer HEAD 403 on an
// object it will happily GET, so a HEAD-only probe can report a live
// reciter as dead. Range keeps it to the first byte either way.
async function probe(url) {
  try {
    const r = await fetch(url, {
      headers: { range: "bytes=0-0" },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const type = r.headers.get("content-type") || "";
    // 206 for a served range, 200 if the CDN ignores the header.
    const ok = (r.status === 206 || r.status === 200) && /audio/.test(type);
    if (r.body && typeof r.body.cancel === "function") await r.body.cancel();
    return { ok, status: r.status, type };
  } catch (e) {
    return { ok: false, status: 0, type: "", error: e.message };
  }
}

// The first bitrate directory that actually serves this edition.
async function servedAt(edition) {
  for (const bitrate of BITRATES) {
    const r = await probe(clip(edition, bitrate, PROBE_AYAH));
    if (r.ok) return { bitrate, status: r.status, type: r.type };
  }
  return null;
}

console.log(
  `Reciters registered in assets/app.js (${reciters.length}), against ${AR_BITRATE}kbps — the directory read.html and listen.js interpolate:`,
);
for (const id of reciters) {
  const at128 = await probe(clip(id, AR_BITRATE, PROBE_AYAH));
  if (at128.ok) {
    console.log(`  OK   ${id} · ${at128.status} ${at128.type}`);
    continue;
  }
  // Not at 128. Distinguish "this reciter is gone" from "this reciter
  // lives at another bitrate and the page is asking for the wrong path" —
  // the two need completely different fixes.
  const elsewhere = await servedAt(id);
  if (elsewhere) {
    failures.push(
      `reciter "${id}": not served at ${AR_BITRATE}kbps (${at128.status || at128.error}) but IS served at ${elsewhere.bitrate}kbps. The page builds a ${AR_BITRATE}kbps URL for every reciter, so this one plays nothing. Fix the path, not the registration.`,
    );
    console.log(`  FAIL ${id} · ${at128.status} at ${AR_BITRATE}kbps, served at ${elsewhere.bitrate}kbps`);
  } else {
    failures.push(
      `reciter "${id}": no bitrate directory (${BITRATES.join(", ")}) serves it — ${at128.status || at128.error} at ${AR_BITRATE}kbps. Registered in RECITERS but the CDN does not carry it; a reader who picks it gets silence.`,
    );
    console.log(`  FAIL ${id} · ${at128.status}, absent at every probed bitrate`);
  }
}

// ── What the API says the English audio editions are ──────────────────
// Reported, never asserted. The point is to put a real response in front
// of a maintainer, not to encode an expectation this project has not yet
// earned the right to hold.
let audioEditions = null;
try {
  const r = await fetch("https://api.alquran.cloud/v1/edition?format=audio", {
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!r.ok) {
    failures.push(`edition list: HTTP ${r.status} from api.alquran.cloud`);
  } else {
    audioEditions = (await r.json()).data || [];
  }
} catch (e) {
  failures.push(`edition list: network error reaching api.alquran.cloud (${e.message})`);
  console.error("If this is a sandboxed/proxied environment, re-run from an unrestricted machine.");
}

if (audioEditions) {
  const english = audioEditions.filter((e) => (e.language || "").toLowerCase() === "en");
  console.log(
    `\nAudio editions the API reports: ${audioEditions.length} total, ${english.length} in English.`,
  );
  if (!english.length) {
    notes.push(
      "The API reports NO English audio edition. Listen mode's runtime probe will find none, the Arabic+English toggle will not render, and Arabic-only listening is unaffected.",
    );
  }
  for (const e of english) {
    console.log(
      `  ${e.identifier} · ${e.language} · ${e.englishName || e.name || "?"} · type=${e.type || "?"}`,
    );
  }
  // Listen mode plays ONE verse at a time, so only a verse-by-verse
  // edition can drive its English leg; a surah-by-surah recording is a
  // single file per surah and cannot be sequenced against a verse.
  const perVerse = english.filter((e) => (e.type || "") === "versebyverse");
  console.log(
    `\nEnglish editions usable by Listen mode (type=versebyverse): ${perVerse.length || "none"}`,
  );
  for (const e of perVerse) {
    const at = await servedAt(e.identifier);
    console.log(
      `  ${at ? `SERVES @ ${at.bitrate}kbps` : "absent at every probed bitrate"}  ${e.identifier} · ${e.englishName || e.name}`,
    );
    notes.push(
      at
        ? `${e.identifier} is registered by the API as "${e.englishName || e.name}" (${e.language}, verse-by-verse) AND served at ${at.bitrate}kbps. Listen mode's English leg will work. /sources may name the reciter on this evidence; the LICENSE is still not established by any of it, so do not state one until the rights holder does.`
        : `${e.identifier} is registered by the API as "${e.englishName || e.name}" (${e.language}, verse-by-verse) but NO probed bitrate directory (${BITRATES.join(", ")}) serves it. The identity is evidenced; the availability is not. Listen mode's runtime probe will fail and it will offer Arabic only — which is the designed behaviour, not a regression.`,
    );
  }
  const surahOnly = english.filter((e) => (e.type || "") !== "versebyverse");
  if (surahOnly.length)
    notes.push(
      `${surahOnly.length} further English audio edition(s) exist but are surah-by-surah (${surahOnly.map((e) => e.identifier).join(", ")}). One file per surah cannot be sequenced verse by verse, so Listen mode cannot use them whatever the CDN serves.`,
    );
}

if (notes.length) {
  console.log("\nNotes for a maintainer:");
  for (const n of notes) console.log("  - " + n);
}

if (failures.length) {
  console.error("\ncheck-audio-editions: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("\ncheck-audio-editions: OK");
