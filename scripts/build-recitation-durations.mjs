#!/usr/bin/env node
//
// build-recitation-durations.mjs — measure how long each verse's
// recitation lasts, for every reciter /read offers, from the audio files
// /read actually plays.
//
//   node scripts/build-recitation-durations.mjs
//
// WHAT IT MEASURES. The reciters and the URL pattern come from
// assets/app.js (RECITERS and qdReciteUrl), the one place /read builds a
// recitation URL, so the measurements are of the same files a reader
// hears. For each of the 6,236 verses and each reciter it fetches only
// the first 16 KB of the MP3 (an HTTP Range request) and reads the
// duration from the file's own header:
//   - a Xing/Info or VBRI header, when present, gives the exact frame
//     count: duration = frames x samples per frame / sample rate;
//   - otherwise the file is constant-bitrate and
//     duration = audio bytes x 8 / bitrate, audio bytes being the total
//     size (from Content-Range) less the leading ID3v2 tag.
// No audio is kept or redistributed; only the numbers are written.
//
// LIMITS, stated in the output's _method: a duration is a reciter's
// performance, not a property of the text; the CBR estimate ignores a
// trailing ID3v1 tag (128 bytes, under 20 ms at 64 kbps); and verse-1
// files may or may not carry the basmala, which is not separated here.
//
// NEEDS THE NETWORK (cdn.islamic.network). .github/workflows/
// recitation-durations.yml runs it on GitHub's runners and commits
// data/recitation/durations.json. check-generated-freshness lists it as
// excluded, like the other network generators. The offline summary is
// scripts/build-recitation-pace.mjs.
//
// Refuses to write a partial result: every verse for every reciter must
// be measured, or nothing is written.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computedDate } from "./lib/computed-date.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "data", "recitation");
const OUT = join(OUT_DIR, "durations.json");
const TOTAL_AYAHS = 6236;
const CONCURRENCY = 24;
const HEAD_BYTES = 16384;

// ── Reciters and URL pattern, read from assets/app.js ────────────────
const app = readFileSync(join(ROOT, "assets", "app.js"), "utf8");
const block = /const RECITERS = \[([\s\S]*?)\];/.exec(app);
if (!block) throw new Error("RECITERS not found in assets/app.js");
const RECITERS = [...block[1].matchAll(/\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*bitrate:\s*(\d+)\s*\}/g)].map(
  (m) => ({ id: m[1], name: m[2], bitrate: Number(m[3]) }),
);
if (!RECITERS.length) throw new Error("no reciters parsed from assets/app.js");
const base = /"(https:\/\/cdn\.islamic\.network\/quran\/audio\/)"\s*\+\s*bitrate/.exec(app);
if (!base) throw new Error("qdReciteUrl's URL pattern not found in assets/app.js");
const urlFor = (r, n) => `${base[1]}${r.bitrate}/${r.id}/${n}.mp3`;

// ── MP3 header parsing ───────────────────────────────────────────────
const BITRATES = {
  // [versionKey][layer] -> kbps by index
  1: { 3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384], 1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448] },
  2: { 3: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160], 1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256] },
};
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

function id3Size(buf) {
  if (buf.length >= 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    const size = (buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9];
    const footer = buf[5] & 0x10 ? 10 : 0;
    return 10 + size + footer;
  }
  return 0;
}

function parseFrame(buf, off) {
  for (let i = off; i + 4 <= buf.length; i++) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) continue;
    const ver = (buf[i + 1] >> 3) & 3; // 3 = MPEG1, 2 = MPEG2, 0 = MPEG2.5
    const layerBits = (buf[i + 1] >> 1) & 3; // 1 = III, 2 = II, 3 = I
    const brIdx = (buf[i + 2] >> 4) & 15;
    const srIdx = (buf[i + 2] >> 2) & 3;
    if (ver === 1 || layerBits === 0 || brIdx === 0 || brIdx === 15 || srIdx === 3) continue;
    const layer = 4 - layerBits; // 1, 2, 3
    const table = BITRATES[ver === 3 ? 1 : 2][layer];
    const kbps = table[brIdx];
    const sampleRate = RATES[ver][srIdx];
    const mono = ((buf[i + 3] >> 6) & 3) === 3;
    const samples = layer === 1 ? 384 : layer === 2 ? 1152 : ver === 3 ? 1152 : 576;
    // A lone 0xFFE bit pattern can occur inside tag data. Accept a header
    // only if the next frame starts exactly where this one ends and agrees
    // on version, layer and sample rate (or the buffer ends first).
    const pad = (buf[i + 2] >> 1) & 1;
    const len =
      layer === 1
        ? (Math.floor((12000 * kbps) / sampleRate) + pad) * 4
        : Math.floor(((layer === 3 && ver !== 3 ? 72000 : 144000) * kbps) / sampleRate) + pad;
    const j = i + len;
    if (len < 24) continue;
    if (j + 4 <= buf.length) {
      const nextOk =
        buf[j] === 0xff &&
        (buf[j + 1] & 0xe0) === 0xe0 &&
        ((buf[j + 1] >> 3) & 3) === ver &&
        ((buf[j + 1] >> 1) & 3) === layerBits &&
        ((buf[j + 2] >> 2) & 3) === srIdx;
      if (!nextOk) continue;
    }
    return { at: i, ver, layer, kbps, sampleRate, mono, samples };
  }
  return null;
}

// Frame count from a Xing/Info header (in the first frame's side-info
// slot) or a VBRI header (fixed offset 32 after the frame header).
function frameCount(buf, f) {
  const side = f.ver === 3 ? (f.mono ? 17 : 32) : f.mono ? 9 : 17;
  const x = f.at + 4 + side;
  const tag = buf.toString("latin1", x, x + 4);
  if ((tag === "Xing" || tag === "Info") && buf.length >= x + 12) {
    const flags = buf.readUInt32BE(x + 4);
    if (flags & 1) return { frames: buf.readUInt32BE(x + 8), kind: tag };
  }
  const v = f.at + 4 + 32;
  if (buf.toString("latin1", v, v + 4) === "VBRI" && buf.length >= v + 18)
    return { frames: buf.readUInt32BE(v + 14), kind: "VBRI" };
  return null;
}

async function fetchRange(url, from, to) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Range: `bytes=${from}-${to}`, "User-Agent": "divinediscourses.org build-recitation-durations" },
        signal: AbortSignal.timeout(30000),
      });
      if (res.status !== 206 && res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      let total = null;
      const cr = res.headers.get("content-range");
      if (cr && /\/(\d+)$/.test(cr)) total = Number(/\/(\d+)$/.exec(cr)[1]);
      else if (res.status === 200) total = Number(res.headers.get("content-length")) || buf.length;
      return { buf, total };
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw new Error(`${url}: ${lastErr && lastErr.message}`);
}

async function measure(url) {
  let { buf, total } = await fetchRange(url, 0, HEAD_BYTES - 1);
  if (!total) throw new Error(`${url}: no total size`);
  let audioStart = id3Size(buf);
  let head = buf;
  let offset = 0;
  if (audioStart + 4096 > buf.length) {
    // A large ID3 tag (cover art): read from where the audio begins.
    ({ buf: head } = await fetchRange(url, audioStart, audioStart + 8191));
    offset = audioStart;
  }
  const f = parseFrame(head, offset === 0 ? audioStart : 0);
  if (!f) throw new Error(`${url}: no MPEG frame found`);
  const fc = frameCount(head, f);
  if (fc) return { ms: Math.round((fc.frames * f.samples * 1000) / f.sampleRate), kind: fc.kind, kbps: f.kbps, total };
  const audioBytes = total - (offset === 0 ? f.at : audioStart + f.at);
  return { ms: Math.round((audioBytes * 8) / f.kbps), kind: "CBR", kbps: f.kbps, total };
}

async function pool(items, fn) {
  const out = new Array(items.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
      if (++done % 1000 === 0) console.log(`  ${done}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out;
}

async function main() {
  const durations = {};
  const measuredBy = {};
  for (const r of RECITERS) {
    console.log(`Measuring ${r.id} (${r.bitrate} kbps directory)…`);
    const ns = Array.from({ length: TOTAL_AYAHS }, (_, i) => i + 1);
    const failures = [];
    const res = await pool(ns, async (n) => {
      try {
        return await measure(urlFor(r, n));
      } catch (e) {
        failures.push(e.message);
        return null;
      }
    });
    if (failures.length) {
      console.error(`${r.id}: ${failures.length} verses could not be measured, e.g.:`);
      for (const f of failures.slice(0, 5)) console.error(`  ${f}`);
      console.error("Nothing written: a partial set would publish gaps as data.");
      process.exit(1);
    }
    const bad = res.map((m, i) => ({ m, n: i + 1 })).filter(({ m }) => m.ms < 300 || m.ms > 20 * 60 * 1000);
    if (bad.length) {
      console.error(`${r.id}: ${bad.length} implausible durations, e.g. ${bad.slice(0, 5).map((b) => `${b.n}=${b.m.ms}ms`).join(", ")}`);
      process.exit(1);
    }
    // Report, for a person to read: files whose first frame's bitrate is
    // not the directory's, and verses whose pace is far from this
    // reciter's own median (seconds per byte of the file, which does not
    // depend on the header parse).
    const odd = res.map((m, i) => ({ m, n: i + 1 })).filter(({ m }) => m.kbps !== r.bitrate);
    if (odd.length)
      console.log(`  ${odd.length} files whose frame bitrate differs from ${r.bitrate}: ` +
        odd.slice(0, 12).map(({ m, n }) => `${n} (${m.kind} ${m.kbps} kbps, ${m.ms} ms, ${m.total} B)`).join("; "));
    const msPerByte = res.map((m) => m.ms / m.total);
    const med = [...msPerByte].sort((a, b) => a - b)[msPerByte.length >> 1];
    const far = msPerByte.map((x, i) => ({ x, n: i + 1 })).filter(({ x }) => x > med * 1.5 || x < med / 1.5);
    if (far.length)
      console.log(`  ${far.length} files whose ms per byte is more than 1.5x off this reciter's median: ` +
        far.slice(0, 12).map(({ x, n }) => `${n} (${res[n - 1].kind} ${res[n - 1].kbps} kbps, ${res[n - 1].ms} ms)`).join("; "));
    durations[r.id] = res.map((m) => m.ms);
    const kinds = {};
    const rates = {};
    for (const m of res) {
      kinds[m.kind] = (kinds[m.kind] || 0) + 1;
      rates[m.kbps] = (rates[m.kbps] || 0) + 1;
    }
    measuredBy[r.id] = { headers: kinds, frameBitrates: rates };
    const hours = durations[r.id].reduce((a, b) => a + b, 0) / 3.6e6;
    console.log(`  ${r.id}: ${hours.toFixed(2)} h in total; headers ${JSON.stringify(kinds)}; bitrates ${JSON.stringify(rates)}`);
  }

  const sha256 = createHash("sha256").update(JSON.stringify(durations)).digest("hex");
  const prior = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
  const out = {
    _computed: prior && prior.sha256 === sha256 ? prior._computed : computedDate(),
    _method:
      "Duration of each verse's recitation, in milliseconds, read from the MP3 header of the file /read plays " +
      "(assets/app.js qdReciteUrl, cdn.islamic.network): exact frame count from a Xing/Info or VBRI header when " +
      "present, otherwise audio bytes x 8 / bitrate (constant bitrate). Only the first 16 KB of each file was " +
      "fetched. A duration measures a reciter's performance, not the text. Verse-1 files may include the basmala; " +
      "it is not separated. The CBR estimate ignores a trailing ID3v1 tag (128 bytes).",
    _source: "cdn.islamic.network per-verse recitation files (Islamic Network); durations measured, no audio redistributed.",
    reciters: RECITERS.map((r) => ({ ...r, url: urlFor(r, "{ayah}"), measuredBy: measuredBy[r.id] })),
    sha256,
    // durations[reciterId][globalAyah - 1] = milliseconds
    durations,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  const lines = Object.entries(durations).map(([id, arr]) => `  ${JSON.stringify(id)}: ${JSON.stringify(arr)}`);
  const head = JSON.stringify({ ...out, durations: undefined }, null, 1).replace(/\n}$/, "");
  writeFileSync(OUT, `${head},\n "durations": {\n${lines.join(",\n")}\n }\n}\n`);
  console.log(`Wrote data/recitation/durations.json (${RECITERS.length} reciters x ${TOTAL_AYAHS} verses).`);
}

main().catch((e) => {
  console.error(`build-recitation-durations: ${e.message}`);
  process.exit(1);
});
