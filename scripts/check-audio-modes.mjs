// check-audio-modes.mjs — deterministic state-machine guard for the shared
// audio engine. Browser E2E deliberately blocks the external audio CDN, so
// it cannot exercise the English-only path. This loads the engine with tiny
// media/browser stubs and asserts the sequencing contract without network or
// audio decoding.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(ROOT, "assets", "audio-engine.js"), "utf8");
const failures = [];
const fail = (msg) => failures.push(msg);
const eq = (actual, expected, label) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    fail(`${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
};

class FakeAudio {
  constructor() {
    this.attrs = {};
    this.listeners = {};
    this.playbackRate = 1;
    this.ended = false;
    this.currentTime = 0;
  }
  addEventListener(name, fn) {
    (this.listeners[name] = this.listeners[name] || []).push(fn);
  }
  removeEventListener(name, fn) {
    this.listeners[name] = (this.listeners[name] || []).filter((x) => x !== fn);
  }
  getAttribute(name) {
    return this.attrs[name] || null;
  }
  setAttribute(name, value) {
    this.attrs[name] = String(value);
  }
  removeAttribute(name) {
    delete this.attrs[name];
  }
  set src(value) {
    this.attrs.src = value;
  }
  get src() {
    return this.attrs.src || "";
  }
  load() {}
  pause() {}
  play() {
    return Promise.resolve();
  }
}

const store = new Map([
  ["qd_listen_en_v1", JSON.stringify({ edition: "en.walk", bitrate: 192 })],
]);
const window = {
  qdState: { reciter: "ar.husary" },
  qdReciters: [{ id: "ar.husary", name: "Husary" }],
  qdReciteUrl: (id, n) => `https://example.test/${id}/${n}.mp3`,
};
const context = {
  window,
  navigator: {},
  Audio: FakeAudio,
  sessionStorage: {
    getItem: (k) => store.get(k) || null,
    setItem: (k, v) => store.set(k, v),
  },
  Promise,
  setTimeout,
  clearTimeout,
  isFinite,
};
vm.runInNewContext(source, context, { filename: "assets/audio-engine.js" });

const engine = window.qdAudioEngine.create();
await new Promise((resolve) => setImmediate(resolve));
if (!engine.english || engine.english.edition !== "en.walk")
  fail("cached English edition was not attached to the engine");

engine.setItems([
  { arNumber: 1, surah: 1, ayah: 1 },
  { arNumber: 2, surah: 1, ayah: 2 },
]);

engine.setMode("en");
eq(engine.state().mode, "en", "English-only mode selected");
engine.point(0);
eq(engine.state().leg, "en", "English-only starts on English");
eq(engine.nextStep(0, "en"), { idx: 1, leg: "en" }, "English-only advances English-to-English");
eq(engine.nextStep(1, "en"), null, "English-only ends after final English verse");

engine.setRepeat(true);
engine.idx = 0;
engine.leg = "en";
engine.advance();
eq({ idx: engine.idx, leg: engine.leg }, { idx: 0, leg: "en" }, "English-only repeat holds the verse and language");
engine.setRepeat(false);

engine.setMode("ar-en");
engine.point(0);
eq(engine.nextStep(0, "ar"), { idx: 0, leg: "en" }, "Alternating mode hands Arabic to English on the same verse");
eq(engine.nextStep(0, "en"), { idx: 1, leg: "ar" }, "Alternating mode advances English to next Arabic verse");

engine.setMode("ar");
engine.point(0);
eq(engine.nextStep(0, "ar"), { idx: 1, leg: "ar" }, "Arabic-only advances Arabic-to-Arabic");

// Changing mode while playing must change the current verse in place,
// never skip forward. This also guards the old English->Arabic skip bug.
engine.idx = 0;
engine.leg = "en";
engine.mode = "ar-en";
engine.playing = true;
engine.setMode("ar");
eq({ idx: engine.idx, leg: engine.leg }, { idx: 0, leg: "ar" }, "mode switch to Arabic stays on current verse");
engine.setMode("en");
eq({ idx: engine.idx, leg: engine.leg }, { idx: 0, leg: "en" }, "mode switch to English stays on current verse");

engine.destroy();

if (failures.length) {
  console.error("check-audio-modes: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("check-audio-modes: OK (Arabic, English, and Arabic+English sequencing + in-place switching).");
