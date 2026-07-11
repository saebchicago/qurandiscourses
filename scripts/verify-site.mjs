// verify-site.mjs — the automated form of the maintainer guide's §6
// "Verify before shipping" checklist, which every release previously
// walked by hand in a browser. One zero-npm-dependency script: it
// serves the repo itself (node:http), drives Chromium through the
// globally installed Playwright, and fails loudly. Playwright is a
// dev-machine tool, NOT a site or data-pipeline dependency — nothing
// this script needs ever ships.
//
// Checks (§6 numbering):
//   sitemap   every root *.html is in sitemap.xml and vice versa
//             (allowlist: embed.html, exercise-asr.html — deliberately
//             unlisted), enforcing the §4 "add a page" recipe
//   overflow  §6.1 zero horizontal overflow at 375px and 1280px
//   console   §6.2 zero console/page errors on every page — run with
//             api.alquran.cloud + cdn.islamic.network ABORTED, so the
//             offline degradation path is what's tested by default
//   links     §6.3 every internal href/src answers 200 from the local
//             server; unknown #fragments are warnings
//   badges    §6.4 every data-source-ids value exists in
//             data/sources.json (hard fail), and the first badge on
//             each page opens by mouse AND Enter/Space, closes on
//             Escape
//   keyboard  §6.5 hamburger at 375px, dropdown menus at 1280px,
//             settings gear, Escape behavior (nav is identical on all
//             pages — check-nav-sync.mjs guards that — so interaction
//             runs on index.html and read.html only); focus-ring
//             presence is proxy-checked via computed outline/box-shadow
//             (warning level — visual appearance stays a human check)
//   palette   §6.6 every palette × light/dark actually changes the
//             body background (on index.html)
//   read      read.html specifics: with the API blocked, a previously
//             unvisited verse must degrade to the offline Arabic
//             fallback with a Try-again button; with the API stubbed
//             (fixtures in alquran.cloud v1 shape), verses render — and
//             a hostile payload planted in a fixture translation must
//             come out inert, making the §5 qdEsc invariant a permanent
//             regression test instead of a one-time audit
//   firstvisit index.html with empty storage shows the first-visit
//             flow without breaking overflow
//
// Still manual (§6.7 and friends): dark-mode visual review, focus-ring
// aesthetics, audio playback, the netlify.toml §6.10 header checks on a
// real deploy preview. --shots writes palette×theme screenshots of
// index.html to help the visual review.
//
// Run:  node scripts/verify-site.mjs
//       [--page=read.html] [--only=overflow,links,...] [--json]
//       [--live]   real network instead of abort/stub (nondeterministic)
//       [--shots]  dump palette×theme screenshots to /tmp
// Exit: 0 all checks pass · 1 failures · 2 harness problem.

import { createServer } from "node:http";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const LIVE = args.includes("--live");
const JSON_OUT = args.includes("--json");
const SHOTS = args.includes("--shots");
const ONLY = (args.find((a) => a.startsWith("--only=")) || "")
  .replace("--only=", "")
  .split(",")
  .filter(Boolean);
const PAGE_FILTER = (args.find((a) => a.startsWith("--page=")) || "").replace(
  "--page=",
  "",
);
const runCheck = (name) => !ONLY.length || ONLY.includes(name);

// ── Playwright resolution (global install, no package.json) ─────────
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync("/opt/pw-browsers")) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "/opt/pw-browsers";
}
let chromium;
for (const spec of [
  process.env.QD_PLAYWRIGHT,
  "playwright",
  "/opt/node22/lib/node_modules/playwright/index.mjs",
].filter(Boolean)) {
  try {
    ({ chromium } = await import(spec));
    break;
  } catch (e) {}
}
if (!chromium) {
  console.error(
    "verify-site: cannot import playwright. Install it globally " +
      "(npm i -g playwright && npx playwright install chromium) or point " +
      "QD_PLAYWRIGHT at its index.mjs.",
  );
  process.exit(2);
}

// ── Results ─────────────────────────────────────────────────────────
const results = [];
function report(check, page, ok, detail, warn = false) {
  results.push({ check, page, ok, warn, detail });
  if (!JSON_OUT) {
    const tag = ok ? "PASS" : warn ? "WARN" : "FAIL";
    console.log(`${tag}  ${page} · ${check}${detail ? " · " + detail : ""}`);
  }
}

// ── Page set + sitemap sync ─────────────────────────────────────────
const SITEMAP_EXEMPT = new Set(["embed.html", "exercise-asr.html"]);
const pages = readdirSync(ROOT)
  .filter((f) => f.endsWith(".html"))
  .sort();
const sitemapLocs = new Set(
  [...readFileSync(join(ROOT, "sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].replace(/^https?:\/\/[^/]+\/?/, ""))
    .map((p) => p || "index.html"),
);
if (runCheck("sitemap") && !PAGE_FILTER) {
  for (const p of pages) {
    if (!sitemapLocs.has(p) && !SITEMAP_EXEMPT.has(p)) {
      report("sitemap", p, false, "root page missing from sitemap.xml");
    }
    if (sitemapLocs.has(p) && SITEMAP_EXEMPT.has(p)) {
      report("sitemap", p, false, "exempt page unexpectedly IS in sitemap.xml");
    }
  }
  for (const loc of sitemapLocs) {
    if (!pages.includes(loc)) {
      report("sitemap", loc, false, "sitemap entry has no file on disk");
    }
  }
  if (!results.some((r) => r.check === "sitemap")) {
    report("sitemap", "(all)", true, `${pages.length} pages ⇄ ${sitemapLocs.size} sitemap entries`);
  }
}

const testPages = PAGE_FILTER ? pages.filter((p) => p === PAGE_FILTER) : pages;
if (!testPages.length) {
  console.error(`verify-site: no page matches --page=${PAGE_FILTER}`);
  process.exit(2);
}

// ── Static server ───────────────────────────────────────────────────
const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".mjs": "text/javascript", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".xml": "application/xml", ".txt": "text/plain", ".woff2": "font/woff2",
  ".mp3": "audio/mpeg", ".mp4": "video/mp4", ".vtt": "text/vtt", ".ico": "image/x-icon",
};
const server = createServer((req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT)) throw new Error("traversal");
    const body = readFileSync(file);
    res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch (e) {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// ── Fixtures (alquran.cloud v1 shapes) with a hostile payload ───────
const XSS = '<img src=x onerror="window.__xss=1">hostile';
const mkEdition = (id, en) => ({ identifier: id, englishName: en, name: en, language: id.startsWith("en") ? "en" : "ar" });
function fixtureFor(url) {
  const single = url.match(/\/v1\/ayah\/(\d+):(\d+)\/editions\/(.+)$/);
  const surah = url.match(/\/v1\/surah\/(\d+)\/editions\/(.+)$/);
  if (single) {
    const eds = decodeURIComponent(single[3]).split(",");
    return {
      code: 200, status: "OK",
      data: eds.map((ed) => ({
        edition: mkEdition(ed, ed === "quran-uthmani" ? "Uthmani" : "Fixture Translation"),
        text: ed === "quran-uthmani" ? "نَصٌّ تَجْرِيبِيٌّ" : `FIXTURE ${XSS}`,
        number: 1,
        surah: { englishName: "Al-Faatiha", englishNameTranslation: "The Opening" },
      })),
    };
  }
  if (surah) {
    const n = parseInt(surah[1], 10);
    const eds = decodeURIComponent(surah[2]).split(",");
    const ayahs = (t) =>
      Array.from({ length: 5 }, (_, i) => ({ numberInSurah: i + 1, number: i + 1, text: t }));
    return {
      code: 200, status: "OK",
      data: eds.map((ed) => ({
        edition: mkEdition(ed, ed === "quran-uthmani" ? "Uthmani" : "Fixture Translation"),
        englishName: `Surah ${n}`, englishNameTranslation: "Fixture",
        ayahs: ayahs(ed === "quran-uthmani" ? "نَصٌّ تَجْرِيبِيٌّ" : `FIXTURE ${XSS}`),
      })),
    };
  }
  return null;
}

// ── Browser plumbing ────────────────────────────────────────────────
const browser = await chromium.launch(
  existsSync("/opt/pw-browsers/chromium")
    ? { executablePath: "/opt/pw-browsers/chromium" }
    : {},
);
const BLOCKED_HOSTS = /api\.alquran\.cloud|cdn\.islamic\.network/;

async function newContext({ apiMode = "abort", seenState = true } = {}) {
  const ctx = await browser.newContext();
  if (!LIVE) {
    await ctx.route(BLOCKED_HOSTS, (route) => {
      if (apiMode === "stub") {
        const fx = fixtureFor(route.request().url());
        if (fx) return route.fulfill({ contentType: "application/json", body: JSON.stringify(fx) });
      }
      return route.abort();
    });
  }
  if (seenState) {
    await ctx.addInitScript(() => {
      try {
        if (!localStorage.getItem("qd_state")) {
          localStorage.setItem("qd_state", JSON.stringify({ seen: true }));
        }
      } catch (e) {}
    });
  }
  return ctx;
}

function attachConsoleCollector(page, errors) {
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const src = ((m.location() || {}).url || "") + " " + m.text();
    if (!LIVE && BLOCKED_HOSTS.test(src)) return; // deliberately blocked
    errors.push(src.trim().slice(0, 200));
  });
}

const sourcesIds = new Set(
  (JSON.parse(readFileSync(join(ROOT, "data", "sources.json"), "utf8")).sources || []).map((s) => s.id),
);

// ── Main per-page sweep ─────────────────────────────────────────────
const VIEWPORTS = [
  { name: "375px", width: 375, height: 812 },
  { name: "1280px", width: 1280, height: 800 },
];
const KEYBOARD_PAGES = new Set(["index.html", "read.html"]);
const linkStatus = new Map(); // resolved URL -> status (crawl cache)

const ctx = await newContext();
for (const pageFile of testPages) {
  const errors = [];
  const page = await ctx.newPage();
  attachConsoleCollector(page, errors);

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    if (vp === VIEWPORTS[0]) {
      await page.goto(`${BASE}/${pageFile}`, { waitUntil: "load", timeout: 20000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(250);
    } else {
      await page.waitForTimeout(150);
    }
    if (runCheck("overflow")) {
      let ok = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      if (!ok) {
        await page.waitForTimeout(500); // fonts/layout settle retry
        ok = await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        );
      }
      const widths = await page.evaluate(
        () => `${document.documentElement.scrollWidth}>${document.documentElement.clientWidth}`,
      );
      report("overflow", pageFile, ok, ok ? vp.name : `${vp.name} ${widths}`);
    }
  }

  // Internal link/src crawl (viewport-independent).
  if (runCheck("links")) {
    const { hrefs, fragments } = await page.evaluate(() => {
      const sel = "a[href], link[href], script[src], img[src], source[src], audio[src], video[src], iframe[src]";
      const hrefs = new Set();
      const fragments = new Set();
      for (const el of document.querySelectorAll(sel)) {
        const raw = el.getAttribute("href") ?? el.getAttribute("src");
        if (!raw || raw.startsWith("mailto:") || raw.startsWith("data:")) continue;
        // Bare href="#" is the deliberate JS-driven-link pattern here
        // (continue-reading card, compare.html preset pairs) — only
        // named fragments must resolve.
        if (raw.startsWith("#")) { if (raw.length > 1) fragments.add(raw.slice(1)); continue; }
        if (/^https?:\/\//.test(raw) && !raw.startsWith(location.origin)) continue;
        if (raw.includes("${")) continue; // template literal inside inline script
        hrefs.add(new URL(raw, location.href).href.split("#")[0]);
      }
      return { hrefs: [...hrefs], fragments: [...fragments] };
    });
    let bad = 0;
    for (const url of hrefs) {
      if (!linkStatus.has(url)) {
        try {
          const r = await fetch(url);
          linkStatus.set(url, r.status);
          if (r.body) await r.body.cancel();
        } catch (e) {
          linkStatus.set(url, 0);
        }
      }
      if (linkStatus.get(url) !== 200) {
        bad++;
        report("links", pageFile, false, `${linkStatus.get(url)} ${url.replace(BASE, "")}`);
      }
    }
    if (!bad) report("links", pageFile, true, `${hrefs.length} internal targets OK`);
    for (const frag of fragments) {
      const exists = await page.evaluate((f) => !!document.getElementById(f), frag);
      if (!exists) report("fragments", pageFile, false, `#${frag} has no element`, true);
    }
  }

  // Badge registry integrity + interaction.
  if (runCheck("badges")) {
    const ids = await page.evaluate(() =>
      [...document.querySelectorAll("[data-source-ids]")].flatMap((el) =>
        el.getAttribute("data-source-ids").split(/\s+/).filter(Boolean),
      ),
    );
    const unknown = [...new Set(ids.filter((id) => !sourcesIds.has(id)))];
    if (unknown.length) {
      report("badges", pageFile, false, `unknown source id(s): ${unknown.join(", ")}`);
    } else if (ids.length) {
      report("badges", pageFile, true, `${ids.length} source-id references valid`);
    }
    // A Verified dot that names no source is unfalsifiable — every
    // visible .badge.ok must carry data-source-ids, except explicit
    // legend/demo chrome marked data-legend. Hidden badges (runtime-
    // populated provenance shells) are exempt until shown.
    const naked = await page.evaluate(() =>
      [...document.querySelectorAll(".badge.ok")]
        .filter((el) => el.offsetParent !== null)
        .filter((el) => !el.hasAttribute("data-source-ids") && !el.hasAttribute("data-legend"))
        .map((el) => (el.parentElement?.textContent || "").trim().slice(0, 60)),
    );
    if (naked.length) {
      report("badge-ids", pageFile, false, `${naked.length} Verified badge(s) without data-source-ids: "${naked[0]}…"`);
    }
    // handleBadgeClick awaits a sources.json fetch, so the popover
    // appears asynchronously — poll rather than sample.
    const popShown = () =>
      page.locator(".cite-popover")
        .waitFor({ state: "visible", timeout: 3000 })
        .then(() => true, () => false);
    const popGone = () =>
      page.locator(".cite-popover")
        .waitFor({ state: "detached", timeout: 3000 })
        .then(() => true, () => false);
    const badge = page.locator(".badge[data-source-ids]").first();
    if ((await badge.count()) > 0 && (await badge.isVisible())) {
      await badge.click();
      const openByMouse = await popShown();
      await page.keyboard.press("Escape");
      const closedByEsc = await popGone();
      await badge.focus();
      await page.keyboard.press("Enter");
      const openByEnter = await popShown();
      await page.keyboard.press("Escape");
      await popGone();
      await badge.focus();
      await page.keyboard.press(" ");
      const openBySpace = await popShown();
      await page.keyboard.press("Escape");
      await popGone();
      const ok = openByMouse && closedByEsc && openByEnter && openBySpace;
      report(
        "badge-popover", pageFile, ok,
        ok ? "opens by mouse/Enter/Space, Escape closes"
           : `mouse=${openByMouse} esc=${closedByEsc} enter=${openByEnter} space=${openBySpace}`,
      );
    }
  }

  // Keyboard interaction (nav is nav-sync-guaranteed identical; two pages).
  if (runCheck("keyboard") && KEYBOARD_PAGES.has(pageFile)) {
    // Desktop dropdowns.
    await page.setViewportSize({ width: 1280, height: 800 });
    const grpBtn = page.locator(".nav-group-btn").first();
    if ((await grpBtn.count()) > 0) {
      await grpBtn.focus();
      await page.keyboard.press("Enter");
      const opened = (await grpBtn.getAttribute("aria-expanded")) === "true";
      await page.keyboard.press("Escape");
      const closed = (await grpBtn.getAttribute("aria-expanded")) === "false";
      report("keyboard", pageFile, opened && closed, `dropdown Enter/Escape (open=${opened} close=${closed})`);
      const ring = await grpBtn.evaluate((el) => {
        el.focus();
        const cs = getComputedStyle(el);
        return cs.outlineStyle !== "none" || cs.boxShadow !== "none";
      });
      if (!ring) report("focus-ring", pageFile, false, ".nav-group-btn has no outline/box-shadow when focused", true);
    }
    // Settings gear.
    const gear = page.locator("#gearBtn");
    if ((await gear.count()) > 0) {
      await gear.click();
      const openedGear = (await gear.getAttribute("aria-expanded")) === "true";
      await page.keyboard.press("Escape");
      const closedGear = (await gear.getAttribute("aria-expanded")) === "false";
      report("keyboard", pageFile, openedGear && closedGear, `settings gear open/Escape (open=${openedGear} close=${closedGear})`);
    }
    // Mobile hamburger.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(150);
    const burger = page.locator(".nav-toggle");
    if ((await burger.count()) > 0 && (await burger.isVisible())) {
      await burger.click();
      const openedB = (await burger.getAttribute("aria-expanded")) === "true";
      await page.keyboard.press("Escape");
      const closedB = (await burger.getAttribute("aria-expanded")) === "false";
      report("keyboard", pageFile, openedB && closedB, `hamburger open/Escape (open=${openedB} close=${closedB})`);
    } else {
      report("keyboard", pageFile, false, "hamburger not visible at 375px");
    }
  }

  if (runCheck("console")) {
    report("console", pageFile, errors.length === 0, errors.length ? errors.slice(0, 3).join(" | ") : "clean (API blocked)");
  }
  await page.close();
}
await ctx.close();

// ── Palette × theme (index.html) ────────────────────────────────────
if (runCheck("palette") && (!PAGE_FILTER || PAGE_FILTER === "index.html")) {
  const pctx = await newContext();
  const page = await pctx.newPage();
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  const palettes = await page.evaluate(() =>
    [...document.querySelectorAll("#setPalette option")].map((o) => o.value),
  );
  if (!palettes.length) {
    report("palette", "index.html", false, "#setPalette select not found or empty");
  }
  const bgs = new Map();
  for (const pal of palettes) {
    for (const theme of ["light", "dark"]) {
      const bg = await page.evaluate(
        ([p, t]) => {
          document.documentElement.setAttribute("data-palette", p);
          document.documentElement.setAttribute("data-theme", t);
          return getComputedStyle(document.body).backgroundColor;
        },
        [pal, theme],
      );
      bgs.set(`${pal}/${theme}`, bg);
      if (SHOTS) {
        await page.screenshot({ path: `/tmp/qd-shot-${pal}-${theme}.png`, fullPage: false });
      }
    }
    const differs = bgs.get(`${pal}/light`) !== bgs.get(`${pal}/dark`);
    report("palette", "index.html", differs, `${pal}: light ${bgs.get(`${pal}/light`)} vs dark ${bgs.get(`${pal}/dark`)}`);
  }
  const lightBgs = new Set(palettes.map((p) => bgs.get(`${p}/light`)));
  if (palettes.length > 1 && lightBgs.size === 1) {
    report("palette", "index.html", false, "all palettes share one light background (select broken?)", true);
  }
  await pctx.close();
}

// ── read.html: offline fallback + stubbed render + XSS regression ───
if (runCheck("read") && (!PAGE_FILTER || PAGE_FILTER === "read.html") && !LIVE) {
  {
    const rctx = await newContext({ apiMode: "abort" });
    const page = await rctx.newPage();
    const errors = [];
    attachConsoleCollector(page, errors);
    await page.goto(`${BASE}/read.html?s=103&a=1-3`, { waitUntil: "load" });
    await page.waitForFunction(
      () =>
        document.querySelector("#verseContainer #retryLoad") ||
        /Offline view/.test(document.getElementById("verseContainer").innerText),
      null,
      { timeout: 15000 },
    ).catch(() => {});
    const state = await page.evaluate(() => ({
      retry: !!document.querySelector("#verseContainer #retryLoad"),
      offlineNote: /Offline view/.test(document.getElementById("verseContainer").innerText),
      arCards: document.querySelectorAll("#verseContainer .ar").length,
    }));
    const ok = (state.retry || state.offlineNote) && state.arCards >= 1;
    report("read-offline", "read.html", ok, `retry=${state.retry} offlineNote=${state.offlineNote} arabicCards=${state.arCards}`);
    report("read-offline-console", "read.html", errors.length === 0, errors.slice(0, 3).join(" | ") || "clean");
    await rctx.close();
  }
  {
    const rctx = await newContext({ apiMode: "stub" });
    const page = await rctx.newPage();
    const errors = [];
    attachConsoleCollector(page, errors);
    await page.goto(`${BASE}/read.html?s=103&a=1-3`, { waitUntil: "load" });
    await page.waitForSelector(".verse .translation .text", { timeout: 15000 }).catch(() => {});
    const state = await page.evaluate(() => ({
      verses: document.querySelectorAll(".verse").length,
      xss: window.__xss,
      hostileVisible: (document.querySelector(".verse .translation .text") || {}).textContent?.includes("hostile"),
      injectedImg: !!document.querySelector('.verse .translation img[src="x"]'),
    }));
    report("read-stubbed", "read.html", state.verses === 3, `${state.verses} verses rendered from stubbed API`);
    const inert = state.xss === undefined && !state.injectedImg && state.hostileVisible === true;
    report("read-xss", "read.html", inert, `__xss=${state.xss} injectedImg=${state.injectedImg} payloadShownAsText=${state.hostileVisible}`);
    report("read-stubbed-console", "read.html", errors.length === 0, errors.slice(0, 3).join(" | ") || "clean");
    await rctx.close();
  }
}

// ── First visit (empty storage) ─────────────────────────────────────
if (runCheck("firstvisit") && (!PAGE_FILTER || PAGE_FILTER === "index.html")) {
  const fctx = await newContext({ seenState: false });
  const page = await fctx.newPage();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  await page.waitForTimeout(500);
  const overflowOk = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  report("firstvisit", "index.html", overflowOk, "no overflow with first-visit UI at 375px");
  await fctx.close();
}

// ── Summary ─────────────────────────────────────────────────────────
await browser.close();
server.close();
const fails = results.filter((r) => !r.ok && !r.warn);
const warns = results.filter((r) => !r.ok && r.warn);
if (JSON_OUT) {
  console.log(JSON.stringify({ fails: fails.length, warns: warns.length, results }, null, 1));
} else {
  console.log(
    `\nverify-site: ${results.length} checks — ${results.length - fails.length - warns.length} pass, ${warns.length} warn, ${fails.length} fail`,
  );
}
process.exit(fails.length ? 1 : 0);
