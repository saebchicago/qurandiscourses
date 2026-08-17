// build-og-images.mjs — per-entity social cards and PWA install
// screenshots.
//
// NOT PART OF THE DETERMINISTIC PIPELINE. Every other generator in
// scripts/ obeys the "run it twice, `git diff` must be empty" rule;
// this one cannot, because PNG encoding and font rasterization are not
// byte-stable across machines or Chromium versions. It follows the
// posture the maintainer guide already documents for
// assets/og/site-og.png and the PWA icons: an owner-run step, captured
// deliberately, reviewed by eye, committed. Do NOT wire it into CI
// expecting stable output.
//
// What it writes:
//   assets/og/surah/<n>.png       114, from assets/og/entity-template.html
//   assets/og/theme/<slug>.png     33, same template
//   assets/screenshots/home-narrow.png   720x1280  (manifest install UI)
//   assets/screenshots/home-wide.png    1280x720   (manifest install UI)
//
// The card copy is built from the same committed JSON that
// build-share-pages.mjs reads, so a card and its share page can never
// describe the same entity differently. build-share-pages picks up a
// card automatically when the file exists and falls back to the
// site-wide card when it does not, so running this is optional for
// anyone cloning the repository.
//
// Stale files (a renamed theme slug) are pruned, exactly as
// build-share-pages.mjs prunes stale share pages.
//
// Run:  node scripts/build-og-images.mjs
//       [--only=surah|theme|screenshots]   one set instead of all
//       [--limit=N]                        first N of each set (spot work)

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  statSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveChromium, launchOptions } from "./lib/playwright.mjs";
import { startStaticServer } from "./lib/static-server.mjs";
import { ordinal } from "./lib/ordinal.mjs";
import { readJson } from "./lib/io.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const ONLY = (args.find((a) => a.startsWith("--only=")) || "").replace(
  "--only=",
  "",
);
const LIMIT = parseInt(
  (args.find((a) => a.startsWith("--limit=")) || "").replace("--limit=", ""),
  10,
);
const wants = (set) => !ONLY || ONLY === set;
if (ONLY && !["surah", "theme", "screenshots"].includes(ONLY)) {
  console.error("build-og-images: --only must be surah, theme, or screenshots");
  process.exit(2);
}

const names = readJson("data/surah-names.json");
const profiles = readJson("data/surah-profiles.json").surahs;
const chronology = readJson("data/chronology.json");
const themes = readJson("data/themes.json").themes;

// ── Card copy ───────────────────────────────────────────────────────
const cards = [];
if (wants("surah")) {
  for (let n = 1; n <= 114; n++) {
    const k = String(n);
    const c = chronology[k];
    const nm = names[k];
    const p = profiles[k];
    // chronology periods are meccan-early/middle/late and medinan; the
    // card shows the coarse class, matching build-share-pages.mjs.
    const cls = c.period === "medinan" ? "Medinan" : "Meccan";
    cards.push({
      file: `assets/og/surah/${n}.png`,
      kicker: `Surah ${n}`,
      arabic: nm.ar,
      title: nm.translit,
      sub: `${p.verseCount} verse${p.verseCount === 1 ? "" : "s"} · ${cls} · ${ordinal(c.revelationOrder)} in the Cairo 1924 order`,
    });
  }
}
if (wants("theme")) {
  for (const t of themes.slice().sort((a, b) => a.slug.localeCompare(b.slug))) {
    cards.push({
      file: `assets/og/theme/${t.slug}.png`,
      kicker: "Theme",
      arabic: "",
      title: t.title,
      sub: `Root families ${t.roots.map((r) => r.latin).join(" · ")}`,
    });
  }
}

const chromium = await resolveChromium("build-og-images");
const { server, base } = await startStaticServer(ROOT);
const browser = await chromium.launch(launchOptions());

let written = 0;
let bytes = 0;

// ── Cards ───────────────────────────────────────────────────────────
if (cards.length) {
  for (const dir of ["assets/og/surah", "assets/og/theme"]) {
    mkdirSync(join(ROOT, dir), { recursive: true });
  }
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto(`${base}/assets/og/entity-template.html`);
  // The bundled Amiri must be rasterized before the first capture, or
  // the earliest cards render their Arabic in a fallback face.
  await page.evaluate(() => document.fonts.ready);

  const todo = LIMIT > 0 ? cards.slice(0, LIMIT) : cards;
  for (const card of todo) {
    await page.evaluate((c) => {
      document.getElementById("kicker").textContent = c.kicker;
      document.getElementById("arabic").textContent = c.arabic;
      const title = document.getElementById("title");
      title.textContent = c.title;
      // Step the headline down rather than letting a long name wrap
      // into the frame ("Truthfulness and falsehood", "al-Muddaththir").
      title.className =
        c.title.length > 22 ? "longer" : c.title.length > 14 ? "long" : "";
      document.getElementById("sub").textContent = c.sub;
    }, card);
    await page.screenshot({ path: join(ROOT, card.file) });
    written++;
    bytes += statSync(join(ROOT, card.file)).size;
  }
  await page.close();
}

// ── PWA install screenshots ─────────────────────────────────────────
if (wants("screenshots")) {
  mkdirSync(join(ROOT, "assets/screenshots"), { recursive: true });
  const shots = [
    { file: "assets/screenshots/home-narrow.png", width: 720, height: 1280 },
    { file: "assets/screenshots/home-wide.png", width: 1280, height: 720 },
  ];
  for (const shot of shots) {
    const ctx = await browser.newContext({
      viewport: { width: shot.width, height: shot.height },
      deviceScaleFactor: 1,
      serviceWorkers: "block",
    });
    // Seed the "seen" flag the way verify-site does, so the first-visit
    // banner is not what the install dialog advertises.
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem("qd_state", JSON.stringify({ seen: true }));
      } catch (e) {}
    });
    // The home page's daily passage needs no network, but the API is
    // unreachable in some environments; abort rather than hang.
    await ctx.route(/api\.alquran\.cloud|cdn\.islamic\.network|api\.quran\.com/, (r) =>
      r.abort(),
    );
    const page = await ctx.newPage();
    await page.goto(`${base}/index.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(ROOT, shot.file) });
    written++;
    bytes += statSync(join(ROOT, shot.file)).size;
    await ctx.close();
  }
}

await browser.close();
server.close();

// ── Prune ───────────────────────────────────────────────────────────
// Only prune a set this run actually rebuilt in full: a --limit or
// --only run must not delete the cards it was never asked to write.
let pruned = 0;
if (!(LIMIT > 0)) {
  const keep = new Set(cards.map((c) => c.file));
  for (const [set, dir] of [
    ["surah", "assets/og/surah"],
    ["theme", "assets/og/theme"],
  ]) {
    if (!wants(set)) continue;
    let entries;
    try {
      entries = readdirSync(join(ROOT, dir));
    } catch (e) {
      continue;
    }
    for (const f of entries) {
      const rel = `${dir}/${f}`;
      if (!keep.has(rel)) {
        unlinkSync(join(ROOT, rel));
        pruned++;
      }
    }
  }
}

console.log(
  `OG images: ${written} written (${pruned} stale pruned), ${(bytes / 1024 / 1024).toFixed(2)} MB total`,
);
