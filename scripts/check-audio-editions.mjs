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
//      leg after each verse's Arabic. That edition is deliberately not
//      hard-coded as a known source: this project has never confirmed
//      its identifier, reciter or license against the API from a machine
//      with real outbound network, so the player discovers it at runtime
//      and /sources carries it as ○ Pending. This check is how that
//      Pending becomes Verified: it prints what the API actually reports
//      for every English audio edition, so a maintainer can read the
//      identifier, englishName and language off a real response and
//      write the citation from that, rather than from a guess.
//
// Registering an English reciter name or a license on the strength of
// this script's OUTPUT is the intended path. Registering one without it
// is exactly the "never guess" the maintainer guide forbids.
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
const clip = (edition, bitrate, n) =>
  `https://cdn.islamic.network/quran/audio/${bitrate}/${edition}/${n}.mp3`;

async function head(url) {
  try {
    const r = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(TIMEOUT),
    });
    return { ok: r.ok, status: r.status, type: r.headers.get("content-type") };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  }
}

console.log(`Reciters registered in assets/app.js (${reciters.length}):`);
for (const id of reciters) {
  const url = clip(id, AR_BITRATE, PROBE_AYAH);
  const r = await head(url);
  const ok = r.ok && (r.type || "").includes("audio");
  if (!ok)
    failures.push(
      `reciter "${id}": ${url} answered ${r.status || r.error} (content-type ${r.type || "none"}) — this ID is registered in RECITERS but the CDN does not serve it`,
    );
  console.log(`  ${ok ? "OK  " : "FAIL"} ${id} · ${r.status} ${r.type || ""}`);
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
  // listen.js probes these at runtime; print whether the CDN agrees, so
  // the two halves can be compared in one place.
  const candidates = [
    ["en.walk", 128],
    ["en.walk", 64],
  ];
  console.log("\nListen mode's runtime candidates, against the CDN:");
  for (const [edition, bitrate] of candidates) {
    const url = clip(edition, bitrate, PROBE_AYAH);
    const r = await head(url);
    const serves = r.ok && (r.type || "").includes("audio");
    console.log(`  ${serves ? "SERVES  " : "absent  "} ${edition} @ ${bitrate}kbps · ${r.status} ${r.type || ""}`);
    if (serves) {
      const listed = audioEditions.find((e) => e.identifier === edition);
      notes.push(
        listed
          ? `${edition} is served at ${bitrate}kbps and the API lists it as "${listed.englishName || listed.name}" (${listed.language}). /sources can move from ○ Pending to a real citation — write it from THIS output, and confirm the license with the rights holder before naming one.`
          : `${edition} is served at ${bitrate}kbps but the API's edition list does not name it. Do not cite what the registry does not carry; leave /sources at ○ Pending.`,
      );
    }
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
