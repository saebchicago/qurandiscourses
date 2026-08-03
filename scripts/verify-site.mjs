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
//   keyboard  §6.5 nav groups at 375px (no hamburger: the details
//             groups stay visible), dropdown menus at 1280px,
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
//   manifest  manifest.webmanifest's icons/screenshots exist at their
//             declared pixel sizes and every shortcut url is in scope,
//             resolves to a page, and (with a fragment) to a real id —
//             the install surface no page renders, so nothing else
//             would notice it rotting
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

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveChromium, launchOptions } from "./lib/playwright.mjs";
import { startStaticServer } from "./lib/static-server.mjs";
import { cleanPath } from "./lib/site.mjs";

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
const chromium = await resolveChromium("verify-site");

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
// The sitemap lists clean paths (/read), not filenames, so both sides
// are compared in that form. cleanPath is the same function that wrote
// them (scripts/lib/site.mjs).
const sitemapLocs = new Set(
  [...readFileSync(join(ROOT, "sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].replace(/^https?:\/\/[^/]+/, ""),
  ),
);
if (runCheck("sitemap") && !PAGE_FILTER) {
  const pathOf = new Map(pages.map((p) => [cleanPath(p), p]));
  for (const p of pages) {
    const loc = cleanPath(p);
    if (!sitemapLocs.has(loc) && !SITEMAP_EXEMPT.has(p)) {
      report("sitemap", p, false, `root page missing from sitemap.xml (${loc})`);
    }
    if (sitemapLocs.has(loc) && SITEMAP_EXEMPT.has(p)) {
      report("sitemap", p, false, "exempt page unexpectedly IS in sitemap.xml");
    }
  }
  for (const loc of sitemapLocs) {
    if (!pathOf.has(loc)) {
      report("sitemap", loc, false, "sitemap entry has no file on disk");
    }
  }
  if (!results.some((r) => r.check === "sitemap")) {
    report("sitemap", "(all)", true, `${pages.length} pages ⇄ ${sitemapLocs.size} sitemap entries`);
  }
}

// ── Web app manifest ────────────────────────────────────────────────
// The install surface is the one part of the site no page renders, so
// nothing else would notice a shortcut pointing at a deleted page, a
// screenshot whose declared size stopped matching the file, or an icon
// that never shipped — all of which silently degrade or reject the
// install prompt rather than erroring.
if (runCheck("manifest") && !PAGE_FILTER) {
  const M = "manifest.webmanifest";
  let man;
  try {
    man = JSON.parse(readFileSync(join(ROOT, M), "utf8"));
  } catch (e) {
    report("manifest", M, false, `unparseable: ${e.message}`);
    man = null;
  }
  if (man) {
    // PNG dimensions from the IHDR chunk: 8-byte signature, 4-byte
    // length, 4-byte type, then width and height as big-endian uint32.
    const pngSize = (rel) => {
      const buf = readFileSync(join(ROOT, rel));
      if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
      return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
    };
    const images = [
      ...(man.icons || []).map((i) => ({ ...i, kind: "icon" })),
      ...(man.screenshots || []).map((s) => ({ ...s, kind: "screenshot" })),
    ];
    for (const img of images) {
      if (!existsSync(join(ROOT, img.src))) {
        report("manifest", M, false, `${img.kind} src has no file: ${img.src}`);
        continue;
      }
      const real = pngSize(img.src);
      if (img.sizes && real && img.sizes !== real) {
        report(
          "manifest",
          M,
          false,
          `${img.kind} ${img.src} declares sizes="${img.sizes}" but the file is ${real}`,
        );
      }
    }
    const scope = man.scope || "/";
    for (const sc of man.shortcuts || []) {
      const url = sc.url || "";
      if (!url.startsWith(scope)) {
        report("manifest", M, false, `shortcut "${sc.name}" url ${url} is outside scope ${scope}`);
        continue;
      }
      // Shortcuts name clean paths (/read), the address the site serves;
      // the file behind one is that path plus .html. See
      // scripts/lib/site.mjs.
      const path = url.replace(/[#?].*$/, "").replace(/^\//, "");
      const file = !path ? "index.html" : path.endsWith(".html") ? path : path + ".html";
      if (!existsSync(join(ROOT, file))) {
        report("manifest", M, false, `shortcut "${sc.name}" points at a missing page: ${file}`);
      }
      // A fragment in a shortcut url must resolve, or the shortcut
      // silently lands at the top of the page instead of the section.
      const frag = (url.match(/#([^?]+)$/) || [])[1];
      if (frag && !readFileSync(join(ROOT, file), "utf8").includes(`id="${frag}"`)) {
        report("manifest", M, false, `shortcut "${sc.name}" fragment #${frag} has no id in ${file}`);
      }
    }
    if (!results.some((r) => r.check === "manifest")) {
      report(
        "manifest",
        M,
        true,
        `${images.length} images resolve at declared sizes, ${(man.shortcuts || []).length} shortcuts in scope`,
      );
    }
  }
}

const testPages = PAGE_FILTER ? pages.filter((p) => p === PAGE_FILTER) : pages;
if (!testPages.length) {
  console.error(`verify-site: no page matches --page=${PAGE_FILTER}`);
  process.exit(2);
}

// ── Static server ───────────────────────────────────────────────────
const { server, base: BASE } = await startStaticServer(ROOT);

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
  // Quran.com v4 word-by-word shape (assets/wordbw.js). Includes an
  // "end" pseudo-word (the ayah-number ornament) so the renderer's
  // char_type_name filter is exercised, and a hostile translation
  // string so the escaping path is regression-tested like every other
  // external text on the site.
  const wbw = url.match(/\/api\/v4\/verses\/by_chapter\/(\d+)\?/);
  if (wbw) {
    const n = parseInt(wbw[1], 10);
    return {
      verses: Array.from({ length: 3 }, (_, i) => ({
        verse_key: `${n}:${i + 1}`,
        words: [
          {
            char_type_name: "word",
            text_uthmani: "كَلِمَة",
            translation: { text: `FIXTURE ${XSS}` },
          },
          {
            char_type_name: "word",
            text_uthmani: "أُخْرَى",
            translation: { text: "another" },
          },
          { char_type_name: "end", text_uthmani: `${i + 1}` },
        ],
      })),
      pagination: { total_pages: 1 },
    };
  }
  return null;
}

// ── Browser plumbing ────────────────────────────────────────────────
const browser = await chromium.launch(launchOptions());
const BLOCKED_HOSTS = /api\.alquran\.cloud|cdn\.islamic\.network|api\.quran\.com/;

async function newContext({ apiMode = "abort", seenState = true } = {}) {
  // Blocked, not just ignored: sw.js (introduced alongside this option)
  // would otherwise intercept fetches in every check below, silently
  // bypassing the apiMode abort/stub routing and the offline-regression
  // test's assumptions about what a fresh page load actually does.
  const ctx = await browser.newContext({ serviceWorkers: "block" });
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
    const url = (m.location() || {}).url || "";
    // Match only the resource URL, not the message text — a future
    // console.error() that happens to mention "api.alquran.cloud" in
    // its own text (e.g. a parse-failure message) must still fail the
    // build; only errors FROM the deliberately blocked hosts are exempt.
    if (!LIVE && BLOCKED_HOSTS.test(url)) return;
    errors.push((url + " " + m.text()).trim().slice(0, 200));
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
// Pages whose citation popover is exercised by a targeted check further
// down rather than by the generic per-page sweep, because their badges
// only render after an interaction or a deep link.
const DEDICATED_POPOVER_CHECK = new Set(["compare.html"]);
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
    // The first VISIBLE cited badge, not simply the first in DOM order:
    // a page whose first badge sits inside a closed disclosure, a depth
    // gate, or a panel that appears only after a selection would
    // otherwise skip this regression entirely.
    const badge = page.locator(".badge[data-source-ids]:visible").first();
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
    } else if (
      (await page.locator(".badge[data-source-ids]").count()) > 0 &&
      !DEDICATED_POPOVER_CHECK.has(pageFile)
    ) {
      // The page cites sources but none of its badges is visible in
      // this state, so the interaction above cannot run. Say so rather
      // than skipping silently: an untested popover reads like a
      // passing one in the summary line. Pages listed in
      // DEDICATED_POPOVER_CHECK are exempt because a targeted check
      // below exercises them in a state where badges do render.
      report(
        "badge-popover", pageFile, false,
        "no source badge visible in the default state; popover interaction untested on this page",
        true,
      );
    }
  }

  // Keyboard interaction (nav is nav-sync-guaranteed identical; two pages).
  if (runCheck("keyboard") && KEYBOARD_PAGES.has(pageFile)) {
    // Desktop dropdowns. The groups are <details>, so "open" is the
    // element's own state, not an aria-expanded attribute the script
    // maintains: the browser exposes the expanded semantics.
    await page.setViewportSize({ width: 1280, height: 800 });
    const grpBtn = page.locator(".nav-group-btn").first();
    if ((await grpBtn.count()) > 0) {
      const grpDetails = page.locator(".nav-details").first();
      await grpBtn.focus();
      await page.keyboard.press("Enter");
      const opened = await grpDetails.evaluate((d) => d.open);
      await page.keyboard.press("Escape");
      const closed = !(await grpDetails.evaluate((d) => d.open));
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
    // Mobile: every group stays reachable at 375px with no hamburger
    // to press. The nav used to hide .nav-groups at this width and
    // rely on a toggle injected at runtime, which left a JS-off
    // visitor with no navigation at all; this asserts the replacement.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(150);
    const summaries = page.locator("nav.primary .nav-group-btn");
    const total = await summaries.count();
    let visible = 0;
    for (let i = 0; i < total; i++) {
      if (await summaries.nth(i).isVisible()) visible++;
    }
    if (visible === total && total > 0) {
      const firstDetails = page.locator(".nav-details").first();
      await summaries.first().click();
      const openedM = await firstDetails.evaluate((d) => d.open);
      await page.keyboard.press("Escape");
      const closedM = !(await firstDetails.evaluate((d) => d.open));
      report("keyboard", pageFile, openedM && closedM, `375px groups all visible (${visible}/${total}), open/Escape (open=${openedM} close=${closedM})`);
    } else {
      report("keyboard", pageFile, false, `only ${visible}/${total} nav groups visible at 375px`);
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
  {
    // Word-by-word meanings (assets/wordbw.js): renders at the default
    // Simple depth, escapes the API's text like every other external
    // string, and drops the "end" ayah-marker pseudo-word.
    const rctx = await newContext({ apiMode: "stub" });
    const page = await rctx.newPage();
    const errors = [];
    attachConsoleCollector(page, errors);
    await page.goto(`${BASE}/read.html?s=103&a=1-3`, { waitUntil: "load" });
    await page.waitForSelector(".wbw-strip .wbw-en", { timeout: 15000 }).catch(() => {});
    const state = await page.evaluate(() => {
      const strips = [...document.querySelectorAll(".wbw-strip")];
      const shown = strips.filter((el) => el.offsetParent !== null);
      const words = [...document.querySelectorAll(".wbw-strip .wbw-word")];
      return {
        depth: document.documentElement.getAttribute("data-depth"),
        shown: shown.length,
        words: words.length,
        endMarker: words.some((w) => /^\d+$/.test(w.textContent.trim())),
        xss: window.__xss,
        injectedImg: !!document.querySelector('.wbw-strip img[src="x"]'),
        payloadAsText: (document.querySelector(".wbw-en") || {}).textContent?.includes("hostile"),
        cite: !!document.querySelector('.wbw-strip .badge[data-source-ids="qcf-wbw-en"]'),
      };
    });
    const ok =
      state.depth === "simple" &&
      state.shown === 3 &&
      state.words === 6 &&
      !state.endMarker &&
      state.cite;
    report("read-wbw", "read.html", ok, `depth=${state.depth} strips=${state.shown} words=${state.words} endMarkerRendered=${state.endMarker} cited=${state.cite}`);
    const inert = state.xss === undefined && !state.injectedImg && state.payloadAsText === true;
    report("read-wbw-xss", "read.html", inert, `__xss=${state.xss} injectedImg=${state.injectedImg} payloadShownAsText=${state.payloadAsText}`);
    report("read-wbw-console", "read.html", errors.length === 0, errors.slice(0, 3).join(" | ") || "clean");
    await rctx.close();
  }
}

// ── compare.html: citation popover in a populated state ─────────────
// The page renders no provenance until a comparison runs, so the
// per-page sweep above finds no visible badge and reports that the
// popover is untested. Drive it with its own ?roots= deep link and
// run the interaction there, so this page is covered like the rest.
if (runCheck("comparepopover") && (!PAGE_FILTER || PAGE_FILTER === "compare.html")) {
  const cctx = await newContext();
  const page = await cctx.newPage();
  const errors = [];
  attachConsoleCollector(page, errors);
  await page.goto(`${BASE}/compare.html?roots=rHm,gfr`, { waitUntil: "load" });
  await page
    .locator(".badge[data-source-ids]:visible")
    .first()
    .waitFor({ state: "visible", timeout: 15000 })
    .catch(() => {});
  const badge = page.locator(".badge[data-source-ids]:visible").first();
  if ((await badge.count()) > 0) {
    const popShown = () =>
      page.locator(".cite-popover").waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false);
    const popGone = () =>
      page.locator(".cite-popover").waitFor({ state: "detached", timeout: 3000 }).then(() => true, () => false);
    await badge.click();
    const openByMouse = await popShown();
    await page.keyboard.press("Escape");
    const closedByEsc = await popGone();
    await badge.focus();
    await page.keyboard.press("Enter");
    const openByEnter = await popShown();
    await page.keyboard.press("Escape");
    await popGone();
    const ok = openByMouse && closedByEsc && openByEnter;
    report(
      "compare-popover", "compare.html", ok,
      ok ? "opens by mouse/Enter, Escape closes (via ?roots= deep link)"
         : `mouse=${openByMouse} esc=${closedByEsc} enter=${openByEnter}`,
    );
  } else {
    report("compare-popover", "compare.html", false, "?roots= deep link rendered no cited badge");
  }
  await cctx.close();
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
