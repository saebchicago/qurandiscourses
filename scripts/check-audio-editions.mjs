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
// Each entry now registers the bitrate directory the CDN serves it from,
// so this check holds every reciter to ITS OWN path rather than to one
// constant that happened to be right for two of five.
const reciters = [
  ...recitersMatch[1].matchAll(/id:\s*"([^"]+)"[^}]*?bitrate:\s*(\d+)/g),
].map((m) => ({ id: m[1], bitrate: Number(m[2]) }));
const idsOnly = [...recitersMatch[1].matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
if (!idsOnly.length) {
  console.error("check-audio-editions: FAIL — parsed zero reciter IDs (parser broken?)");
  process.exit(2);
}
// A reciter without a bitrate would fall back to 128 at runtime and
// could be silent with nothing reporting it — the exact bug this whole
// registry exists to prevent. Catch it here, offline, before the network
// half runs.
const missing = idsOnly.filter((id) => !reciters.some((r) => r.id === id));
if (missing.length) {
  console.error(
    `check-audio-editions: FAIL — these RECITERS entries have no bitrate: ${missing.join(", ")}.\n` +
      "  Every reciter must register the bitrate directory cdn.islamic.network serves it from;\n" +
      "  without one the player falls back to 128 and plays nothing if that is the wrong path.",
  );
  process.exit(1);
}

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
  `Reciters registered in assets/app.js (${reciters.length}), each against its OWN registered bitrate:`,
);
for (const { id, bitrate } of reciters) {
  const atRegistered = await probe(clip(id, bitrate, PROBE_AYAH));
  if (atRegistered.ok) {
    console.log(`  OK   ${id} @ ${bitrate}kbps · ${atRegistered.status} ${atRegistered.type}`);
    continue;
  }
  // Wrong path, or gone? The two need completely different fixes, so the
  // message has to say which.
  const elsewhere = await servedAt(id);
  if (elsewhere) {
    failures.push(
      `reciter "${id}": registered at ${bitrate}kbps but that answered ${atRegistered.status || atRegistered.error}; the CDN serves it at ${elsewhere.bitrate}kbps. Update this reciter's bitrate in assets/app.js's RECITERS — until then it plays nothing anywhere on the site.`,
    );
    console.log(`  FAIL ${id} · registered ${bitrate}kbps, actually served at ${elsewhere.bitrate}kbps`);
  } else {
    failures.push(
      `reciter "${id}": no bitrate directory (${BITRATES.join(", ")}) serves it — ${atRegistered.status || atRegistered.error} at its registered ${bitrate}kbps. The CDN no longer carries this edition; a reader who picks it gets silence, so retire it from RECITERS.`,
    );
    console.log(`  FAIL ${id} · absent at every probed bitrate`);
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

// ── Which TRANSLATION the English recording reads ─────────────────────
// The API registry names the reader (Ibrahim Walk) but not the text he
// reads, and Listen mode pairs his audio with whatever translation the
// reader has selected — so a mismatch between the spoken and written
// English is possible and the panel says so. Closing that gap needs
// evidence of which translation the recording IS. Two probes, reported
// and never asserted:
//
//   1. everyayah.com is a separate, independently hosted site that
//      also serves per-ayah recitation audio, with directory names
//      that state reciter and translation. Whether it is
//      cdn.islamic.network's actual source is NOT established here and
//      this script does not assert it — a size mismatch (checked next)
//      would itself be evidence against a clean mirror relationship
//      for this edition. If the directory below exists, its name is
//      used only as ITS OWN label for what that recording reads.
//   2. If that file and the CDN's en.walk file for the same ayah have
//      the same byte length, they are very likely the same recording.
//
// A maintainer who sees both hold has evidence to pair en.walk with a
// specific translation edition on /read. Neither probe writes anything.
const WALK_EVERYAYAH =
  "https://everyayah.com/data/English/Sahih_Intnl_Ibrahim_Walk_192kbps/001001.mp3";
const WALK_CDN = clip("en.walk", 192, PROBE_AYAH);
async function sizeOf(url) {
  try {
    const r = await fetch(url, {
      headers: { range: "bytes=0-0" },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const range = r.headers.get("content-range") || "";
    const total = /\/(\d+)$/.exec(range)?.[1] || r.headers.get("content-length");
    if (r.body && typeof r.body.cancel === "function") await r.body.cancel();
    return { status: r.status, size: total ? Number(total) : null, type: r.headers.get("content-type") || "" };
  } catch (e) {
    return { status: 0, size: null, type: "", error: e.message };
  }
}
{
  const up = await sizeOf(WALK_EVERYAYAH);
  const cdn = await sizeOf(WALK_CDN);
  console.log("\nTranslation read by the en.walk recording — evidence, not a claim:");
  console.log(`  everyayah ${WALK_EVERYAYAH}\n    → ${up.status || up.error} ${up.type} ${up.size ?? "?"} bytes`);
  console.log(`  cdn      ${WALK_CDN}\n    → ${cdn.status || cdn.error} ${cdn.type} ${cdn.size ?? "?"} bytes`);
  const upOk = (up.status === 206 || up.status === 200) && /audio/.test(up.type);
  if (!upOk) {
    notes.push(
      "everyayah.com does not serve the directory this check guessed for the Walk recording, so nothing here says which translation it reads. Establish that by ear (play 1:1 on /read with English audio on and compare it with each English translation) before pairing en.walk with any text edition.",
    );
  } else if (up.size && cdn.size && up.size === cdn.size) {
    notes.push(
      `everyayah.com serves the Walk recording under a directory it names "Sahih_Intnl_Ibrahim_Walk_192kbps", and that file is byte-for-byte the same LENGTH as cdn.islamic.network's en.walk clip for the same ayah (${up.size} bytes). That is evidence — from everyayah.com's own labelling plus a size match, not from any established provenance link between the two sites, and not from listening — that en.walk reads Saheeh International (en.sahih on this site). Confirm by ear once, then pair them.`,
    );
  } else {
    notes.push(
      `everyayah.com serves a directory it names "Sahih_Intnl_Ibrahim_Walk_192kbps" (${up.size ?? "?"} bytes for 1:1) but cdn.islamic.network's en.walk clip for the same ayah is ${cdn.size ?? "?"} bytes. everyayah.com's label says Saheeh International; the size mismatch means the CDN's file may be a different encode, a different recording, or simply a file that everyayah.com never mirrored from this CDN in the first place. Confirm by ear before pairing.`,
    );
  }
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
