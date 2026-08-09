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
//   navcurrent exactly one primary-nav link (or zero, on a page the
//             nav doesn't list) carries aria-current="page", and it is
//             the page actually open — checked against cleanPath, not
//             against nav.js's own logic
//   badges    §6.4 every data-source-ids value exists in
//             data/sources.json (hard fail), and the first badge on
//             each page opens by mouse AND Enter/Space, closes on
//             Escape
//   badgeretry a data/sources.json fetch failing on the first click
//             surfaces a toast, not silence; a retry once the network
//             recovers still opens the popover (sources.html)
//   pathribbon every study-path step's rendered Previous/Next hrefs
//             carry the step's real query params, checked against
//             data/paths.json independently of path-ribbon.js's own
//             concatenation logic
//   feedback  the footer correction form's fetch-failure fallback
//             surfaces zero page errors (index.html)
//   refretry  a data/roots-list.json fetch failing on the first root
//             popover open recovers a real count on the next open,
//             rather than staying blank forever (numbers.html)
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
//   a11y      hand-rolled WCAG 2.2 AA subset on the rendered DOM of
//             every page: exactly one h1 + an h2 page title (embed
//             surfaces exempt), img alt, a programmatic label on every
//             form control, no focusable content inside
//             aria-hidden="true"; heading-level skips are warnings
//             (stat-grid h4/h5 templates are the house pattern). Plus
//             a11y-contrast: every text token in every style.css
//             palette x mode block >= 4.5:1 on --bg and --card,
//             computed from the stylesheet so palette edits fail CI
//   askcorpus a fixed corpus of ~40 queries driven through the real
//             router (window.parseAsk) and, where it routes to
//             /search, the real matcher (window.qdSearch) over the
//             shipped index. Two invariants: every query containing a
//             letter or digit produces a route, and no /search route
//             comes back with zero hits. Named expectations pin
//             "juz 5", "surah 36", the theme words, and the
//             chapter-name/concept collisions ("light", "pilgrimage")
//             that must open the grouped search rather than guess
//   manifest  manifest.webmanifest's icons/screenshots exist at their
//             declared pixel sizes and every shortcut url is in scope,
//             resolves to a page, and (with a fragment) to a real id —
//             the install surface no page renders, so nothing else
//             would notice it rotting
//
// Still manual (§6.7 and friends): mixed Arabic/English reading order,
// high zoom, dark-mode visual review, focus-ring
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
import { cleanPath, canonicalUrl, NO_CANONICAL } from "./lib/site.mjs";

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
const SITEMAP_EXEMPT = new Set(["embed.html", "exercise-asr.html", "404.html"]);
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

// ── Structured data (JSON-LD) ───────────────────────────────────────
// build-jsonld --check proves the blocks match the generator; this
// proves what the generator produced is what a consumer needs: valid
// JSON, schema.org context, and a WebPage node whose @id is the page's
// own canonical URL. A malformed block fails silently in every crawler,
// which is exactly the kind of rot that needs a loud check.
if (runCheck("jsonld") && !PAGE_FILTER) {
  const problems = [];
  let count = 0;
  for (const p of pages) {
    if (NO_CANONICAL.has(p)) continue;
    const html = readFileSync(join(ROOT, p), "utf8");
    const m = html.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n\s*<\/script>/);
    if (!m) {
      problems.push(`${p}: no ld+json block`);
      continue;
    }
    count++;
    try {
      const doc = JSON.parse(m[1]);
      if (doc["@context"] !== "https://schema.org") throw new Error("bad @context");
      const webPage = (doc["@graph"] || []).find((n) => n["@type"] === "WebPage");
      if (!webPage) throw new Error("no WebPage node");
      if (webPage["@id"] !== canonicalUrl(p))
        throw new Error(`WebPage @id ${webPage["@id"]} != canonical ${canonicalUrl(p)}`);
    } catch (e) {
      problems.push(`${p}: ${e.message}`);
    }
  }
  report(
    "jsonld", "(all)", problems.length === 0,
    problems.length ? problems.slice(0, 3).join("; ") : `${count} pages parse with canonical WebPage nodes`,
  );
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

  // assets/nav.js's aria-current="page" marking: exactly one nav link
  // (or zero, on a page absent from the nav) should carry it, and it
  // must be the page actually open. Deliberately does not reimplement
  // nav.js's own path-normalizing logic — it uses cleanPath (the same
  // helper the sitemap/canonical checks trust) as independent ground
  // truth, so a shared bug in both places can't pass silently.
  if (runCheck("navcurrent")) {
    const hasNav = await page.evaluate(() => !!document.querySelector("nav.primary"));
    if (hasNav) {
      const expected = cleanPath(pageFile);
      const marked = await page.evaluate(() =>
        [...document.querySelectorAll("nav.primary .nav-menu a[aria-current='page']")].map((a) =>
          (a.getAttribute("href") || "").split("#")[0].toLowerCase(),
        ),
      );
      if (marked.length > 1) {
        report("navcurrent", pageFile, false, `${marked.length} links carry aria-current="page": ${marked.join(", ")}`);
      } else if (marked.length === 1) {
        report(
          "navcurrent",
          pageFile,
          marked[0] === expected,
          marked[0] === expected
            ? `aria-current correctly marks ${expected}`
            : `aria-current marks ${marked[0]}, expected ${expected}`,
        );
      } else {
        const navHrefs = await page.evaluate(() =>
          [...document.querySelectorAll("nav.primary .nav-menu a")].map((a) =>
            (a.getAttribute("href") || "").split("#")[0].toLowerCase(),
          ),
        );
        const shouldMatch = navHrefs.includes(expected);
        report(
          "navcurrent",
          pageFile,
          !shouldMatch,
          shouldMatch
            ? `no link marked aria-current="page" but ${expected} exists in nav`
            : `no nav entry for ${expected}; correctly unmarked`,
        );
      }
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

  // Hand-rolled WCAG subset on the RENDERED DOM (the pages are
  // JS-composed, so only a browser sees the real markup). Deliberately
  // no vendored checker: the no-dependency invariant covers the test
  // harness's fixtures too. Heading-level skips are warning-level —
  // stat-grid h4/h5 blocks inside JS templates are the house pattern.
  if (runCheck("a11y")) {
    // embed.html and exercise-asr.html are chromeless embed/iframe
    // surfaces with no site header, so the document-outline rules
    // (one h1, an h2 page title) do not apply to them; every other
    // assertion still does.
    const CHROMELESS = new Set(["embed.html", "exercise-asr.html"]);
    const a = await page.evaluate((skipOutline) => {
      const problems = [];
      const warns = [];
      const h1s = document.querySelectorAll("h1").length;
      if (!skipOutline && h1s !== 1) problems.push(`${h1s} h1 elements (want exactly 1)`);
      const imgs = [...document.querySelectorAll("img")].filter(
        (img) => !(img.getAttribute("alt") || "").trim() && img.getAttribute("role") !== "presentation",
      );
      if (imgs.length) problems.push(`${imgs.length} img without alt`);
      // Programmatic labels: label[for], a wrapping label, aria-label,
      // aria-labelledby, or title. Hidden inputs and buttons with text
      // content need none.
      for (const el of document.querySelectorAll("input, select, textarea")) {
        if (el.type === "hidden" || el.closest("[hidden]")) continue;
        const labeled =
          el.getAttribute("aria-label") ||
          el.getAttribute("aria-labelledby") ||
          el.getAttribute("title") ||
          el.closest("label") ||
          (el.id && document.querySelector(`label[for="${el.id}"]`));
        if (!labeled)
          problems.push(`unlabeled ${el.tagName.toLowerCase()}#${el.id || "(no id)"} name=${el.name || "-"}`);
      }
      // Focusable content inside aria-hidden (WCAG 4.1.2): reachable by
      // tab but invisible to assistive tech.
      for (const hidden of document.querySelectorAll('[aria-hidden="true"]')) {
        for (const f of hidden.querySelectorAll("a[href], button, input, select, textarea, [tabindex]")) {
          if (f.getAttribute("tabindex") === "-1" || f.disabled || f.type === "hidden") continue;
          problems.push(`focusable ${f.tagName.toLowerCase()} inside aria-hidden`);
        }
      }
      // Heading order (warn only).
      let prev = 0;
      for (const h of document.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
        const lvl = +h.tagName[1];
        if (prev && lvl > prev + 1)
          warns.push(`h${prev} -> h${lvl} skip at "${(h.textContent || "").trim().slice(0, 40)}"`);
        prev = lvl;
      }
      return { problems, warns: warns.slice(0, 3) };
    }, CHROMELESS.has(pageFile));
    if (!CHROMELESS.has(pageFile)) {
      const h2s = await page.locator("h2").count();
      if (!h2s) a.problems.push("no h2 (page title heading missing)");
    }
    report(
      "a11y", pageFile, a.problems.length === 0,
      a.problems.length ? a.problems.slice(0, 4).join(" | ") : "h1/labels/aria-hidden/alt clean",
    );
    for (const w of a.warns) report("a11y-headings", pageFile, false, w, true);
  }

  if (runCheck("console")) {
    report("console", pageFile, errors.length === 0, errors.length ? errors.slice(0, 3).join(" | ") : "clean (API blocked)");
  }
  await page.close();
}
await ctx.close();

// ── Color-token contrast (computed once from assets/style.css) ──────
// The six palette x mode token blocks must keep every text token at
// WCAG AA 4.5:1 against both --bg and --card. Parsed from the
// stylesheet, not the DOM, so a palette edit fails CI before a human
// ever squints at it. Non-text tokens (--accent-soft, --chart-*) are
// out of scope by design.
if (runCheck("a11y") && !PAGE_FILTER) {
  const css = readFileSync(join(ROOT, "assets/style.css"), "utf8");
  const lum = (hex) => {
    const c = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => {
      const v = parseInt(c.slice(i, i + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  // Selector -> token map for each block that (re)defines --bg.
  const blocks = [];
  const blockRe = /(:root[^{]*|@media[^{]+\{\s*:root[^{]*)\{([^}]+)\}/g;
  for (const m of css.matchAll(blockRe)) {
    const tokens = {};
    for (const t of m[2].matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) tokens[t[1]] = t[2];
    if (tokens.bg && tokens.ink) blocks.push({ sel: m[1].trim().slice(0, 60), tokens });
  }
  const TEXT_TOKENS = ["ink", "muted", "link", "ok", "pending", "nuanced"];
  const failuresC = [];
  for (const { sel, tokens } of blocks) {
    for (const name of TEXT_TOKENS) {
      if (!tokens[name]) continue;
      for (const bgName of ["bg", "card"]) {
        if (!tokens[bgName]) continue;
        const r = ratio(tokens[name], tokens[bgName]);
        if (r < 4.5)
          failuresC.push(`${sel}: --${name} on --${bgName} = ${r.toFixed(2)}:1 (< 4.5)`);
      }
    }
  }
  report(
    "a11y-contrast", "assets/style.css", failuresC.length === 0,
    failuresC.length
      ? failuresC.slice(0, 4).join(" | ")
      : `${blocks.length} token blocks x ${TEXT_TOKENS.length} text tokens all >= 4.5:1 on bg and card`,
  );
}

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

// ── read.html: the root-detail panel opens the root you clicked ─────
// This shipped resolving the clicked word's Buckwalter root against
// roots-index.json (keyed by canonical Latin) with a substring match.
// Digraphs collapse under that comparison, so 76 of 1642 roots opened a
// DIFFERENT root's Arabic, frequency, occurrences and derived forms --
// under the green Verified badge. Nothing caught it because no check had
// ever clicked one of these buttons.
//
// Surah 114:4 is the sharpest case available in a short surah: the word
// is from kh-n-s (خ ن س, "to withdraw"), and the old matcher resolved it
// to k-h-n (ك ه ن, "soothsayer"). The assertion is on the Arabic the
// panel renders, not just the title, because the title and the body read
// from different places and only the body carries the statistics.
if (runCheck("rootdetail") && (!PAGE_FILTER || PAGE_FILTER === "read.html") && !LIVE) {
  const rctx = await newContext({ apiMode: "stub" });
  const page = await rctx.newPage();
  const errors = [];
  attachConsoleCollector(page, errors);
  // The word table needs morphology (study depth or deeper), and it lives
  // inside <details class="xref-panel">, which only renders open at
  // encyclopedic. Both conditions are met by asking for encyclopedic.
  await page.addInitScript(() => {
    try {
      const s = JSON.parse(localStorage.getItem("qd_state") || "{}");
      s.seen = true;
      s.depth = "encyclopedic";
      localStorage.setItem("qd_state", JSON.stringify(s));
    } catch (e) {}
  });
  await page.goto(`${BASE}/read.html?s=114&a=1-5`, { waitUntil: "load" });
  const btn = 'button.root-detail-btn[data-root="xns"]';
  await page.waitForSelector(btn, { timeout: 15000 }).catch(() => {});
  const found = await page.locator(btn).count();
  if (!found) {
    report("read-rootdetail", "read.html", false, "no root-detail button for kh-n-s at 114:4 -- word table did not render");
  } else {
    const label = await page.locator(btn).first().textContent();
    await page.locator(btn).first().click();
    // The settings panel is also role="dialog", so match the root modal by
    // its aria-label prefix. A wrong root still produces "Root: ...", so
    // this narrowing cannot mask the regression it is here to catch.
    await page
      .waitForSelector('[role="dialog"][aria-label^="Root:"]', { timeout: 5000 })
      .catch(() => {});
    const shown = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"][aria-label^="Root:"]');
      if (!d)
        return {
          title: [...document.querySelectorAll('[role="dialog"]')]
            .map((x) => x.getAttribute("aria-label"))
            .join(", ") || "(no dialog)",
          arabic: "",
        };
      return {
        title: d.getAttribute("aria-label") || "",
        arabic: (d.querySelector(".ar") || {}).textContent?.trim() || "",
      };
    });
    // خ ن س is kh-n-s; ك ه ن is k-h-n, what the substring matcher returned.
    const ok =
      !!shown &&
      (label || "").trim() === "kh-n-s" &&
      shown.title === "Root: kh-n-s" &&
      shown.arabic === "خ ن س";
    report(
      "read-rootdetail",
      "read.html",
      ok,
      shown
        ? `button="${(label || "").trim()}" title="${shown.title}" arabic="${shown.arabic}" (want kh-n-s / خ ن س)`
        : "clicking the root opened no dialog",
    );
  }
  report("read-rootdetail-console", "read.html", errors.length === 0, errors.slice(0, 3).join(" | ") || "clean");
  await rctx.close();
}

// ── read.html: translation picker (assets/trans-picker.js) ──────────
// Search, apply as one batched commit (not per-checkbox), Escape closes
// and restores focus, and a change made inside the dialog without
// confirming must not silently persist.
if (runCheck("transpicker") && (!PAGE_FILTER || PAGE_FILTER === "read.html") && !LIVE) {
  const tctx = await newContext({ apiMode: "stub" });
  const page = await tctx.newPage();
  const errors = [];
  attachConsoleCollector(page, errors);
  await page.goto(`${BASE}/read.html?s=103&a=1-3`, { waitUntil: "load" });
  await page.waitForSelector(".trans-open-btn", { timeout: 15000 }).catch(() => {});
  // read.html's own deep-link ("hasParams") path renders twice on a
  // fresh load -- once from app.js's unconditional qd:depth-changed
  // dispatch on DOMContentLoaded, again from its documented "load +
  // 200ms" idle fallback -- and the second pass replaces the verse
  // markup, which would detach a trigger clicked in that window before
  // this check ever touches it. Pre-existing on main, independent of
  // the picker; settling past it here tests the picker in the steady
  // state a reader actually interacts in, not that unrelated race.
  await page.waitForTimeout(500);
  const trigger = page.locator(".trans-open-btn").first();
  const before = await trigger.textContent().catch(() => null);
  await trigger.click();
  await page.waitForSelector(".qd-picker-overlay .qd-list-row", { timeout: 5000 }).catch(() => {});
  const totalRows = await page.locator(".qd-picker-overlay .qd-list-row").count();
  await page.fill(".qd-picker-q", "asad");
  await page.waitForTimeout(150);
  const filteredRows = await page.locator(".qd-picker-overlay .qd-list-row").count();
  await page.fill(".qd-picker-q", "");
  await page.waitForTimeout(150);
  // Check a box, then abandon via Escape (not confirm) -- this must not
  // persist, the same contract every other unsaved-edit dialog on the
  // site honors.
  await page.locator('.qd-picker-overlay [data-item="en.asad"]').check();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  const overlayGoneOnEscape = (await page.locator(".qd-picker-overlay").count()) === 0;
  const focusRestored = await page.evaluate(
    () => document.activeElement && document.activeElement.classList.contains("trans-open-btn"),
  );
  const abandonedState = await page.evaluate(() =>
    (JSON.parse(localStorage.getItem("qd_state") || "{}").translations || []).includes("en.asad"),
  );
  report(
    "read-transpicker-search",
    "read.html",
    totalRows > 0 && filteredRows > 0 && filteredRows < totalRows,
    `${totalRows} rows unfiltered, ${filteredRows} rows for "asad"`,
  );
  report(
    "read-transpicker-escape",
    "read.html",
    overlayGoneOnEscape && focusRestored && !abandonedState,
    `overlayGone=${overlayGoneOnEscape} focusRestored=${focusRestored} abandonedEditPersisted=${abandonedState} (want false)`,
  );
  // Reopen and actually apply -- one batched commit, not a reload per
  // checkbox: the button label, the qd_state, and the URL's ?t= must
  // all reflect the FULL new set after a single confirm.
  await trigger.click();
  await page.waitForSelector(".qd-picker-overlay .qd-list-row", { timeout: 5000 }).catch(() => {});
  await page.locator('.qd-picker-overlay [data-item="en.asad"]').check();
  await page.click(".qd-picker-confirm");
  await page.waitForTimeout(400);
  const after = await trigger.textContent().catch(() => null);
  const appliedState = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("qd_state") || "{}").translations || [],
  );
  const url = new URL(page.url());
  const tParam = (url.searchParams.get("t") || "").split(",");
  const ok =
    before !== after &&
    appliedState.includes("en.asad") &&
    tParam.includes("en.asad");
  report(
    "read-transpicker-apply",
    "read.html",
    ok,
    `before="${(before || "").trim()}" after="${(after || "").trim()}" qd_state=${JSON.stringify(appliedState)} ?t=${tParam.join(",")}`,
  );
  report("read-transpicker-console", "read.html", errors.length === 0, errors.slice(0, 3).join(" | ") || "clean");
  await tctx.close();
}

// ── read.html: ?t= URL parameter selects translations on load ───────
if (runCheck("transurl") && (!PAGE_FILTER || PAGE_FILTER === "read.html") && !LIVE) {
  const uctx = await newContext({ apiMode: "stub" });
  const page = await uctx.newPage();
  const errors = [];
  attachConsoleCollector(page, errors);
  await page.goto(`${BASE}/read.html?s=103&a=1-3&t=en.pickthall`, { waitUntil: "load" });
  await page.waitForSelector(".verse .translation .text", { timeout: 15000 }).catch(() => {});
  const state = await page.evaluate(() => ({
    verses: document.querySelectorAll(".verse").length,
    // One translation per verse, not one for the whole page -- surah
    // 103 has 3 verses, so 3 total .translation divs is correct as long
    // as each verse carries exactly one.
    perVerseCounts: [...document.querySelectorAll(".verse")].map(
      (v) => v.querySelectorAll(".translation").length,
    ),
    label: (document.querySelector(".trans-open-btn") || {}).textContent || "",
    saved: JSON.parse(localStorage.getItem("qd_state") || "{}").translations || [],
  }));
  const ok =
    state.verses > 0 &&
    state.perVerseCounts.every((n) => n === 1) &&
    /Pickthall/.test(state.label) &&
    state.saved.length === 1 &&
    state.saved[0] === "en.pickthall";
  report(
    "read-transurl",
    "read.html",
    ok,
    `?t=en.pickthall -> per-verse translation counts ${JSON.stringify(state.perVerseCounts)} (want all 1), button="${state.label.trim()}", saved=${JSON.stringify(state.saved)}`,
  );
  report("read-transurl-console", "read.html", errors.length === 0, errors.slice(0, 3).join(" | ") || "clean");
  await uctx.close();
}

// ── compare.html: renders every selected translation, not just one ──
// fetchPassageText/render used to keep only the first non-mismatched
// edition; this drives two saved translations through an actual
// ?mode=passages deep link and checks all four resulting blocks (2
// passages x 2 translations) render, each with its own translator
// credit and dir/lang/script-class, at both a narrow and a wide
// viewport (the narrow one also catching a reintroduced overflow).
if (runCheck("comparetrans") && (!PAGE_FILTER || PAGE_FILTER === "compare.html") && !LIVE) {
  for (const width of [375, 1280]) {
    const cctx = await newContext({ apiMode: "stub" });
    const page = await cctx.newPage();
    const errors = [];
    attachConsoleCollector(page, errors);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/compare.html?mode=passages&p1=1:1-3&p2=1:4-7`, {
      waitUntil: "load",
    });
    await page.waitForSelector(".cmp-trans", { timeout: 15000 }).catch(() => {});
    const state = await page.evaluate(() => ({
      blocks: document.querySelectorAll(".cmp-trans").length,
      credited: [...document.querySelectorAll(".cmp-trans p")].every((p) =>
        p.textContent.trim().length > 0,
      ),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    const ok = state.blocks === 4 && state.credited && !state.overflow;
    report(
      "compare-translations",
      `compare.html@${width}`,
      ok,
      `${state.blocks} .cmp-trans blocks (want 4), credited=${state.credited}, overflow=${state.overflow}`,
    );
    report(
      `compare-translations-console`,
      `compare.html@${width}`,
      errors.length === 0,
      errors.slice(0, 3).join(" | ") || "clean",
    );
    await cctx.close();
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

// ── cite-badge.js: a failed sources.json fetch must not stay broken ─
// Regression test for the silent-permanent-failure bug: the first
// data/sources.json request fails, so the click must surface a toast
// rather than doing nothing; the SECOND click, with the network now
// fine, must still open the popover — proving the failure wasn't
// cached forever the way it used to be.
if (runCheck("badgeretry") && (!PAGE_FILTER || PAGE_FILTER === "sources.html")) {
  const bctx = await newContext();
  const page = await bctx.newPage();
  let failedOnce = false;
  await page.route("**/data/sources.json", (route) => {
    if (!failedOnce) {
      failedOnce = true;
      return route.fulfill({ status: 500, body: "error" });
    }
    return route.continue();
  });
  await page.goto(`${BASE}/sources.html`, { waitUntil: "load" });
  const badge = page.locator(".badge[data-source-ids]:visible").first();
  if ((await badge.count()) > 0) {
    await badge.click();
    const toastShown = await page
      .locator(".qd-toast.show")
      .waitFor({ state: "visible", timeout: 3000 })
      .then(() => true, () => false);
    const popoverAfterFailure = (await page.locator(".cite-popover").count()) > 0;
    await badge.click();
    const popoverAfterRetry = await page
      .locator(".cite-popover")
      .waitFor({ state: "visible", timeout: 3000 })
      .then(() => true, () => false);
    const ok = toastShown && !popoverAfterFailure && popoverAfterRetry;
    report(
      "badge-retry", "sources.html", ok,
      ok ? "fetch failure shows a toast; retry on the next click opens the popover"
         : `toast=${toastShown} popoverAfterFailure=${popoverAfterFailure} popoverAfterRetry=${popoverAfterRetry}`,
    );
  } else {
    report("badge-retry", "sources.html", false, "no visible cited badge on sources.html to test");
  }
  await bctx.close();
}

// ── path-ribbon.js: Previous/Next hrefs carry the step's real query ─
// Regression test for the dropped-query-param bug: renders every step
// of every path and compares the ribbon's ACTUAL Previous/Next hrefs
// against a value computed independently from data/paths.json (never
// by importing path-ribbon.js, which is a private IIFE) — so a future
// bug in how the two fields get concatenated would be caught even
// though check-paths.mjs's static check already guarantees the JSON
// itself can't drift from the authored html. Steps whose ADJACENT step
// has page: null are skipped: that step's real href depends on
// whatever page it happens to render on, a distinct, out-of-scope
// defect from the one this fix addresses (noted in the PR).
if (runCheck("pathribbon") && !PAGE_FILTER) {
  const pathsReg = JSON.parse(readFileSync(join(ROOT, "data/paths.json"), "utf8")).paths;
  const fileForClean = (p) => (p === "/" ? "index.html" : p.replace(/^\//, "") + ".html");
  const expectedHref = (step, pathId, stepNum) =>
    step.page +
    "?" +
    (step.query ? step.query + "&" : "") +
    "path=" +
    encodeURIComponent(pathId) +
    "&step=" +
    stepNum;

  const rctx2 = await newContext();
  for (const p of pathsReg) {
    for (const [i, step] of p.steps.entries()) {
      const n = i + 1;
      if (!step.page) continue; // this step's own page renders it in-place; not visitable in isolation
      const page = await rctx2.newPage();
      await page.goto(`${BASE}/${fileForClean(step.page)}?path=${p.id}&step=${n}`, {
        waitUntil: "load",
      });

      const prevStep = n > 1 ? p.steps[n - 2] : null;
      if (prevStep && prevStep.page) {
        const expected = expectedHref(prevStep, p.id, n - 1);
        const actual = await page
          .locator(".path-ribbon-nav a", { hasText: "Previous" })
          .getAttribute("href")
          .catch(() => null);
        report(
          "pathribbon", `${p.id} step ${n} (prev)`, actual === expected,
          actual === expected ? `matches ${expected}` : `got ${actual}, want ${expected}`,
        );
      }

      const nextStep = n < p.steps.length ? p.steps[n] : null;
      if (nextStep && nextStep.page) {
        const expected = expectedHref(nextStep, p.id, n + 1);
        const actual = await page
          .locator("#pathRibbonNext")
          .getAttribute("href")
          .catch(() => null);
        report(
          "pathribbon", `${p.id} step ${n} (next)`, actual === expected,
          actual === expected ? `matches ${expected}` : `got ${actual}, want ${expected}`,
        );
      }

      await page.close();
    }
  }
  await rctx2.close();
}

// ── assets/feedback.js: a fetch failure must not crash the handler ──
// Regression test for a strict-mode arguments.callee crash inside the
// .catch() fallback: the throw made the WHOLE fallback (native form
// submission, re-enabling the button) unreachable, and — since nothing
// downstream catches it — surfaces as an unhandled promise rejection,
// which Playwright reports as a pageerror. Forcing the first POST to
// fail and asserting zero pageerrors is a direct test of the fix,
// independent of whatever the native-submission navigation does next.
if (runCheck("feedback") && (!PAGE_FILTER || PAGE_FILTER === "index.html")) {
  const fctx = await newContext();
  const page = await fctx.newPage();
  // pageerror only, not the generic console collector: forcing a 500
  // deliberately logs a browser-level "resource failed to load" console
  // message that is expected noise here, not a bug. An uncaught
  // exception or unhandled promise rejection (what the real defect
  // produced) surfaces as pageerror regardless.
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let postCount = 0;
  await page.route("**/", (route) => {
    if (route.request().method() === "POST") {
      postCount++;
      if (postCount === 1) return route.fulfill({ status: 500, body: "error" });
    }
    return route.continue();
  });
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  await page.locator("details.footer-feedback summary").click();
  await page.locator('form.feedback-form textarea[name="message"]').fill("test correction");
  await page
    .locator('form.feedback-form button[type="submit"]')
    .click()
    .catch(() => {}); // the native-submission fallback navigates away; a resulting navigation error is not what this check tests
  await page.waitForTimeout(500);
  report(
    "feedback", "index.html", errors.length === 0,
    errors.length === 0 ? "fetch failure handled without a page error" : `page error(s): ${errors.join(" | ")}`,
  );
  await fctx.close();
}

// ── assets/refs.js: a failed roots-list fetch must not stay broken ──
// Regression test for the permanent-null-cache bug: the first
// data/roots-list.json request fails, so the popover's occurrence
// count should show nothing rather than crash; the SECOND popover
// open, with the network now fine, must show a real count — proving
// the failure wasn't cached forever.
if (runCheck("refretry") && (!PAGE_FILTER || PAGE_FILTER === "numbers.html")) {
  const rrctx = await newContext();
  const page = await rrctx.newPage();
  let failedOnce = false;
  await page.route("**/data/roots-list.json", (route) => {
    if (!failedOnce) {
      failedOnce = true;
      return route.fulfill({ status: 500, body: "error" });
    }
    return route.continue();
  });
  await page.goto(`${BASE}/numbers.html`, { waitUntil: "load" });
  const ref = page.locator(".qd-ref[data-kind='root']").first();
  if ((await ref.count()) > 0) {
    await ref.click();
    await page.waitForTimeout(400);
    const countAfterFailure = await page
      .locator(".qd-ref-count")
      .first()
      .textContent()
      .catch(() => "");
    await ref.click(); // close
    await ref.click(); // reopen — retry
    await page.waitForTimeout(400);
    const countAfterRetry = await page
      .locator(".qd-ref-count")
      .first()
      .textContent()
      .catch(() => "");
    const ok = /×/.test(countAfterRetry || "");
    report(
      "refretry", "numbers.html", ok,
      ok
        ? `after failure="${(countAfterFailure || "").trim()}", after retry="${(countAfterRetry || "").trim()}"`
        : `retry never recovered a count: after failure="${(countAfterFailure || "").trim()}", after retry="${(countAfterRetry || "").trim()}"`,
    );
  } else {
    report("refretry", "numbers.html", false, "no .qd-ref[data-kind='root'] found on numbers.html to test");
  }
  await rrctx.close();
}

// ── Claim permalinks ────────────────────────────────────────────────
// Every claim in data/claims.json must be addressable as
// /validation#<claim-id>: the articles are JS-rendered, so only a
// browser check can prove the anchors exist. One deep-link journey also
// proves the fragment scrolls to its target after the async render.
if (runCheck("claims") && (!PAGE_FILTER || PAGE_FILTER === "validation.html")) {
  const ledger = JSON.parse(readFileSync(join(ROOT, "data/claims.json"), "utf8")).claims;
  const cctx = await newContext();
  const page = await cctx.newPage();
  const probe = ledger[ledger.length - 1].id;
  await page.goto(`${BASE}/validation.html#${probe}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".verify-example", { timeout: 10000 });
  const state = await page.evaluate(
    (ids) => ({
      missing: ids.filter((id) => !document.getElementById(id)),
      anchors: document.querySelectorAll(".verify-example .claim-anchor").length,
      targetVisible: (() => {
        const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.top >= -1 && r.top < window.innerHeight;
      })(),
    }),
    ledger.map((c) => c.id),
  );
  const ok = !state.missing.length && state.anchors === ledger.length && state.targetVisible;
  report(
    "claims", "validation.html", ok,
    ok
      ? `${ledger.length} claim ids addressable, deep link scrolls to its target`
      : `missing=[${state.missing}] anchors=${state.anchors}/${ledger.length} targetVisible=${state.targetVisible}`,
  );
  await cctx.close();
}

// ── Related-content panels ──────────────────────────────────────────
// build-related --check proves data/related.json matches its inputs;
// this proves the panels actually render from it: the dossier's
// See-also card lists sibling surahs, and a theme card grows its
// Related-themes line after the async theme render — both paths only
// a browser can exercise.
if (runCheck("related") && (!PAGE_FILTER || PAGE_FILTER === "dossier.html")) {
  const rctx = await newContext();
  const page = await rctx.newPage();
  await page.goto(`${BASE}/dossier.html?s=2`, { waitUntil: "networkidle" });
  let links = 0;
  try {
    await page.waitForSelector("#relatedHost .related-list li a", { timeout: 10000 });
    links = await page.locator('#relatedHost a[href^="/dossier?s="]').count();
  } catch {
    links = 0;
  }
  report(
    "related", "dossier.html?s=2", links >= 2,
    `${links} sibling-surah links in the See-also panel (want >= 2)`,
  );
  await rctx.close();
}
// Computed section structure panel: a multi-section surah must render
// its section links and per-test results; a one-section surah must
// render the "no shift cleared" branch, not collapse to nothing. Both
// paths are Encyclopedic-depth content (the panel sits alongside the
// existing pivot/rhetorical/symmetry evidence), so depth is set before
// the async render fires.
if (runCheck("structurepanel") && (!PAGE_FILTER || PAGE_FILTER === "dossier.html")) {
  const sctx = await newContext();
  const spage = await sctx.newPage();
  await spage.addInitScript(() => {
    try {
      const s = JSON.parse(localStorage.getItem("qd_state") || "{}");
      s.seen = true;
      s.depth = "encyclopedic";
      localStorage.setItem("qd_state", JSON.stringify(s));
    } catch (e) {}
  });
  await spage.goto(`${BASE}/dossier.html?s=2`, { waitUntil: "networkidle" });
  const multi = await spage.evaluate(() => {
    const t = document.getElementById("secStructure")?.innerText || "";
    return {
      hasHeading: t.includes("Computed section structure"),
      hasSectionLink: !!document.querySelector('#secStructure a[href^="/read?s=2&a="]'),
      mentionsCorrection: t.includes("false-discovery correction"),
    };
  });
  report(
    "structurepanel-multi", "dossier.html?s=2",
    multi.hasHeading && multi.hasSectionLink && multi.mentionsCorrection,
    `heading=${multi.hasHeading} sectionLink=${multi.hasSectionLink} correctionText=${multi.mentionsCorrection}`,
  );
  await spage.goto(`${BASE}/dossier.html?s=103`, { waitUntil: "networkidle" });
  const single = await spage.evaluate(() => {
    const t = document.getElementById("secStructure")?.innerText || "";
    return {
      hasHeading: t.includes("Computed section structure"),
      saysOneSection: t.includes("no shift cleared this surah's own threshold"),
    };
  });
  report(
    "structurepanel-single", "dossier.html?s=103",
    single.hasHeading && single.saysOneSection,
    `heading=${single.hasHeading} noSignalBranch=${single.saysOneSection}`,
  );
  await sctx.close();
}
if (runCheck("related") && (!PAGE_FILTER || PAGE_FILTER === "themes.html")) {
  const rctx = await newContext();
  const page = await rctx.newPage();
  await page.goto(`${BASE}/themes.html#forgiveness`, { waitUntil: "networkidle" });
  let ok = false;
  try {
    await page.waitForSelector("#forgiveness .related-themes a", { timeout: 10000 });
    ok = (await page.locator("#forgiveness .related-themes a").count()) >= 1;
  } catch {
    ok = false;
  }
  report(
    "related", "themes.html#forgiveness", ok,
    ok ? "Related-themes line renders on the theme card" : "no .related-themes links rendered",
  );
  await rctx.close();
}

// ── Service worker: precache + offline shell ────────────────────────
// The one check that RUNS the service worker. Every other context
// blocks SWs (see newContext) so apiMode routing stays deterministic;
// this one gets its own context with SWs allowed, per the maintainer
// guide's rule. Proves the three things only a browser can: install
// precached the shell (a page never visited is already cached under
// its clean path), a cold offline navigation still renders plus shows
// the indicator, and no cache ever holds a cross-origin entry (the
// never-intercept rule's observable consequence).
if (runCheck("sw") && !PAGE_FILTER) {
  const sctx = await browser.newContext(); // serviceWorkers allowed, deliberately
  if (!LIVE) await sctx.route(BLOCKED_HOSTS, (route) => route.abort());
  await sctx.addInitScript(() => {
    try {
      localStorage.setItem("qd_state", JSON.stringify({ seen: true }));
    } catch (e) {}
  });
  const page = await sctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  let controlled = false;
  try {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, {
      timeout: 15000,
    });
    controlled = true;
  } catch {
    controlled = false;
  }
  if (!controlled) {
    report("sw", "register", false, "service worker never took control of the page");
  } else {
    // Give the install-time seeding a beat to finish writing.
    await page.waitForTimeout(500);
    const pre = await page.evaluate(async () => {
      const names = await caches.keys();
      let readCached = false;
      let sourcesCached = false;
      const crossOrigin = [];
      for (const n of names) {
        const c = await caches.open(n);
        for (const req of await c.keys()) {
          const u = new URL(req.url);
          if (u.origin !== location.origin) crossOrigin.push(req.url);
          if (u.pathname === "/read") readCached = true;
          if (u.pathname === "/data/sources.json") sourcesCached = true;
        }
      }
      return { caches: names.length, readCached, sourcesCached, crossOrigin: crossOrigin.length };
    });
    report(
      "sw", "precache", pre.readCached && pre.crossOrigin === 0,
      `${pre.caches} caches; /read precached before any visit=${pre.readCached}; cross-origin entries=${pre.crossOrigin} (want 0)`,
    );
    // data/sources.json backs every citation badge on 24 of 32 pages —
    // if it's ever dropped from PRECACHE_DATA, an offline visitor's
    // badges fail the same silent way a network error used to.
    report(
      "sw", "precache-sources", pre.sourcesCached,
      `/data/sources.json precached before any visit=${pre.sourcesCached}`,
    );

    await sctx.setOffline(true);
    let h2 = 0;
    let banner = false;
    try {
      await page.goto(`${BASE}/navigate`, { waitUntil: "load", timeout: 15000 });
      h2 = await page.locator("h2").count();
      await page.waitForSelector(".offline-banner", { timeout: 5000 });
      banner = await page.locator(".offline-banner").isVisible();
    } catch {
      /* reported below */
    }
    report(
      "sw", "offline-shell", h2 > 0 && banner,
      `offline navigation to a never-visited page: h2 rendered=${h2 > 0}, offline indicator=${banner}`,
    );
    await sctx.setOffline(false);
  }
  await sctx.close();
}

// ── Ask + search acceptance corpus ───────────────────────────────────
// The gate for "typing a word gets you somewhere useful". A fixed
// corpus is run through the REAL router (window.parseAsk) and, when it
// routes to /search, through the REAL matcher (window.qdSearch) over
// the shipped index — no re-implementation of either, so this cannot
// pass against a copy that has drifted.
//
// Two invariants hold for every entry that contains a letter or digit:
// it produces a route, and if that route is /search the index answers
// with at least one hit. Nothing is allowed to dead-end. Individual
// expectations pin the behavior readers actually asked for: "juz 5"
// lands on the verse juz 5 begins at, "surah 36" opens surah 36, and
// a word that is both a chapter name and a concept ("light",
// "pilgrimage") opens the grouped search showing both rather than
// silently picking one.
if (runCheck("askcorpus") && !PAGE_FILTER) {
  const CORPUS = [
    // Unambiguous references. A VERSE reference names a place and opens
    // that place; a CHAPTER reference names the chapter and opens all of
    // it, which is why these carry a range and 2:255 does not.
    { q: "2:255", route: "/read?s=2&a=255" },
    { q: "١:١", route: "/read?s=1&a=1" },
    { q: "surah 36", route: "/read?s=36&a=1-83" },
    { q: "chapter 2", route: "/read?s=2&a=1-286" },
    { q: "36", route: "/read?s=36&a=1-83" },
    { q: "juz 5", route: "/read?j=5" },
    { q: "para 3", route: "/read?j=3" },
    { q: "sipara 30", route: "/read?j=30" },
    // Surah names, Latin and Arabic, exact and one edit away
    { q: "Baqarah", route: "/read?s=2&a=1-286" },
    { q: "al-Kahf", route: "/read?s=18&a=1-110" },
    { q: "Yasin", route: "/read?s=36&a=1-83" },
    { q: "الفاتحة", route: "/read?s=1&a=1-7" },
    { q: "سورة يس", route: "/read?s=36&a=1-83" },
    { q: "bakarah", route: "/read?s=2&a=1-286" },
    { q: "cow", route: "/read?s=2&a=1-286" },
    { q: "hypocrites", route: "/read?s=63&a=1-11" },
    // Roots
    { q: "r-h-m", route: "/roots?q=r-h-m" },
    { q: "k-t-b", route: "/roots?q=k-t-b" },
    { q: "رحم", type: "root" },
    // Concepts that are themes
    { q: "forgiveness", route: "/themes#forgiveness" },
    { q: "patience", route: "/themes#patience" },
    { q: "justice", route: "/themes#justice" },
    { q: "knowledge", route: "/themes#knowledge" },
    { q: "gratitude", route: "/themes#gratitude" },
    { q: "covenant", route: "/themes#covenant" },
    { q: "charity", route: "/themes#charity" },
    // Destinations
    { q: "changelog", route: "/changelog" },
    { q: "export", route: "/export" },
    { q: "nazm", route: "/glossary#nazm" },
    { q: "hapax", route: "/glossary#hapax" },
    { q: "juz", route: "/glossary#juz" },
    // Chapter/concept collisions: both, not a guess
    { q: "light", kinds: ["surah", "theme", "root"] },
    { q: "pilgrimage", kinds: ["surah", "theme"] },
    { q: "repentance", kinds: ["surah"] },
    // The owner's reported error, and free prose
    { q: "mercy & forgiveness", minHits: 1 },
    { q: "mercy", kinds: ["root"] },
    { q: "creation", kinds: ["root"] },
    // Not minHits: a bare count passed while the ONE page that explains
    // ring composition was being filtered out of its own topic query.
    // Name the page that must answer.
    { q: "what is ring composition?", minHits: 1, mustInclude: "/patterns" },
    { q: "how do I compare translations", minHits: 1 },
    // Out of range: a message, never a route
    { q: "115", reason: "range" },
    { q: "surah 200", reason: "range" },
    { q: "juz 31", reason: "range" },
  ];
  const actx = await newContext();
  const page = await actx.newPage();
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  // index.html carries the router (ask.js + surahs.js + ask-routes.js);
  // the matcher and its index are pulled in here so both halves are
  // the shipped files, exercised in one page.
  await page.addScriptTag({ url: "/assets/search.js" });
  const out = await page.evaluate(async (corpus) => {
    const index = await (await fetch("/data/search-index.json")).json();
    return corpus.map((c) => {
      const r = window.parseAsk(c.q) || {};
      let hits = null;
      let urls = null;
      if (r.route && r.route.indexOf("/search?q=") === 0) {
        const term = decodeURIComponent(r.route.slice("/search?q=".length));
        const found = window.qdSearch.search(index, term).hits;
        hits = found.map((h) => h.doc.k);
        urls = found.map((h) => h.doc.u);
      }
      return { q: c.q, route: r.route || null, type: r.type || null, reason: r.reason || null, hits, urls };
    });
  }, CORPUS);
  await actx.close();

  const problems = [];
  for (let i = 0; i < CORPUS.length; i++) {
    const want = CORPUS[i];
    const got = out[i];
    const at = JSON.stringify(want.q);
    if (want.reason) {
      if (got.route || got.reason !== want.reason)
        problems.push(`${at}: wanted no route (${want.reason}), got ${got.route || got.reason}`);
      continue;
    }
    if (!got.route) {
      problems.push(`${at}: DEAD END — no route (${got.reason})`);
      continue;
    }
    if (want.route && got.route !== want.route)
      problems.push(`${at}: wanted ${want.route}, got ${got.route}`);
    if (want.type && got.type !== want.type)
      problems.push(`${at}: wanted type ${want.type}, got ${got.type}`);
    if (want.kinds || want.minHits != null) {
      if (!got.hits) {
        problems.push(`${at}: expected the grouped search, got ${got.route}`);
        continue;
      }
      if (!got.hits.length) problems.push(`${at}: DEAD END — /search returns 0 hits`);
      for (const k of want.kinds || [])
        if (!got.hits.includes(k)) problems.push(`${at}: no ${k} among ${got.hits.length} hits`);
      if (want.minHits != null && got.hits.length < want.minHits)
        problems.push(`${at}: ${got.hits.length} hits, wanted >= ${want.minHits}`);
      if (want.mustInclude && !(got.urls || []).some((u) => u.split("#")[0] === want.mustInclude))
        problems.push(
          `${at}: results do not include ${want.mustInclude} (got ${(got.urls || []).slice(0, 4).join(", ") || "nothing"})`,
        );
    }
    // Universal: a /search route must never come back empty.
    if (got.hits && !got.hits.length && !want.kinds && want.minHits == null)
      problems.push(`${at}: DEAD END — /search returns 0 hits`);
  }
  report(
    "askcorpus", "index.html + /search", problems.length === 0,
    problems.length
      ? `${problems.length} of ${CORPUS.length}: ${problems.slice(0, 4).join(" | ")}`
      : `${CORPUS.length} queries route correctly, zero dead ends, zero unrecognized`,
  );
}

// ── Passage panel: the verse bounds a reader cannot know ────────────
// The gate for "name a chapter, get its real size and any part of it".
// Everything here is asserted on the RENDERED page, because the whole
// point is a control that only exists after JS composes qdRange with
// window.SURAHS: a unit test of either half would prove nothing.
if (runCheck("passage") && !PAGE_FILTER) {
  // al-Saffat: long enough to trigger the long-passage note, short
  // enough that nobody would guess 182.
  const SURAH = 37;
  const COUNT = 182;

  const pctx = await newContext();
  const page = await pctx.newPage();
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });

  // 1. Typing a chapter answers with its size instead of silently
  //    opening verse 1.
  await page.fill("#ask-input", "saffat");
  await page.click("#ask-go");
  await page.waitForSelector("#ask-passage .passage-panel", { timeout: 5000 });
  const typed = await page.evaluate(() => {
    const p = document.querySelector("#ask-passage .passage-panel");
    const read = p.querySelector(".passage-read");
    const to = p.querySelector('input[id$="To"]');
    const from = p.querySelector('input[id$="From"]');
    return {
      meta: p.querySelector(".passage-meta").textContent,
      label: read.textContent.trim(),
      href: read.getAttribute("href"),
      toMax: to && to.max,
      toValue: to && to.value,
      fromValue: from && from.value,
      note: !p.querySelector(".passage-note").hidden,
      onPage: location.pathname,
    };
  });
  const wantHref = `/read?s=${SURAH}&a=1-${COUNT}`;
  report(
    "passage", "index.html · named chapter",
    typed.onPage === "/index.html" &&
      typed.meta.includes(`${COUNT} verses`) &&
      typed.toMax === String(COUNT) &&
      typed.toValue === String(COUNT) &&
      typed.fromValue === "1" &&
      typed.href === wantHref &&
      typed.label === `Read all ${COUNT} verses` &&
      typed.note === true,
    `"saffat" -> ${typed.meta.trim()}; To max=${typed.toMax} value=${typed.toValue}; ` +
      `button "${typed.label}" -> ${typed.href} (want ${wantHref}); long-passage note=${typed.note}`,
  );

  // 2. The range drives the button: narrowing it must change both the
  //    label and the destination, or the second box is decoration.
  await page.fill('#ask-passage input[id$="To"]', "20");
  await page.dispatchEvent('#ask-passage input[id$="To"]', "blur");
  const narrowed = await page.evaluate(() => {
    const read = document.querySelector("#ask-passage .passage-read");
    return {
      label: read.textContent.trim(),
      href: read.getAttribute("href"),
      note: !document.querySelector("#ask-passage .passage-note").hidden,
    };
  });
  report(
    "passage", "index.html · range drives the button",
    narrowed.href === `/read?s=${SURAH}&a=1-20` &&
      narrowed.label === `Read ${SURAH}:1-20` &&
      narrowed.note === false,
    `To=20 -> "${narrowed.label}" -> ${narrowed.href}; long-passage note cleared=${!narrowed.note}`,
  );

  // 3. Out-of-bounds is impossible, not merely discouraged: the clamp
  //    is the reason a reader never needs to know the last verse.
  await page.fill('#ask-passage input[id$="To"]', "9999");
  await page.dispatchEvent('#ask-passage input[id$="To"]', "blur");
  const clamped = await page.evaluate(
    () => document.querySelector('#ask-passage input[id$="To"]').value,
  );
  report(
    "passage", "index.html · clamped to the real bound",
    clamped === String(COUNT),
    `To=9999 clamps to ${clamped} (want ${COUNT})`,
  );

  // 4. NO REGRESSION: a complete reference is not a chapter-level ask
  //    and must still go straight to the text.
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  await page.fill("#ask-input", "2:255");
  await Promise.all([
    page.waitForURL(/\/read/, { timeout: 5000 }).catch(() => {}),
    page.click("#ask-go"),
  ]);
  const verseUrl = page.url();
  report(
    "passage", "index.html · complete reference still jumps",
    /\/read\?s=2&a=255/.test(verseUrl),
    `"2:255" -> ${verseUrl.replace(BASE, "")}`,
  );

  // 5. The toggle: a reader who knows no names at all can still get
  //    to a passage without typing.
  await page.goto(`${BASE}/index.html`, { waitUntil: "load" });
  const toggle = await page.evaluate(() => {
    const m = document.getElementById("askMode");
    return { present: Boolean(m), hidden: m ? m.hidden : true };
  });
  if (toggle.present && !toggle.hidden) {
    await page.click('#askMode [data-mode="passage"]');
    await page.waitForSelector("#ask-passage .passage-panel", { timeout: 5000 });
  }
  const passageMode = await page.evaluate(() => ({
    rowHidden: document.getElementById("askRow").hidden,
    inputs: document.querySelectorAll("#ask-passage .qd-range-input").length,
    browse: Boolean(document.querySelector("#ask-passage .passage-browse")),
  }));
  report(
    "passage", "index.html · passage mode",
    toggle.present && !toggle.hidden && passageMode.rowHidden &&
      passageMode.inputs === 2 && passageMode.browse,
    `toggle shown=${toggle.present && !toggle.hidden}; typed row hidden=${passageMode.rowHidden}; ` +
      `${passageMode.inputs} verse inputs (want 2); browse-all button=${passageMode.browse}`,
  );
  await pctx.close();

  // 6. /search answers the same question above its results.
  const sctx = await newContext();
  const spage = await sctx.newPage();
  await spage.goto(`${BASE}/search.html?q=${SURAH}`, { waitUntil: "networkidle" });
  let sPanel = { ok: false, detail: "no panel" };
  try {
    await spage.waitForSelector("#searchPassage .passage-panel", { timeout: 8000 });
    sPanel = await spage.evaluate(() => {
      const p = document.querySelector("#searchPassage .passage-panel");
      return {
        ok: true,
        meta: p.querySelector(".passage-meta").textContent,
        href: p.querySelector(".passage-read").getAttribute("href"),
      };
    });
  } catch {}
  report(
    "passage", "search.html?q=37",
    sPanel.ok && sPanel.meta.includes(`${COUNT} verses`) && sPanel.href === wantHref,
    sPanel.ok ? `${sPanel.meta.trim()} -> ${sPanel.href}` : sPanel.detail,
  );
  await sctx.close();

  // 7. Navigate: the Verses column is the way in, not just a number.
  const nctx = await newContext();
  const npage = await nctx.newPage();
  await npage.goto(`${BASE}/navigate.html`, { waitUntil: "networkidle" });
  let nav = { buttons: 0, opened: false, prefilled: null };
  try {
    await npage.waitForSelector("#surahTable .verse-count-btn", { timeout: 8000 });
    nav.buttons = await npage.locator("#surahTable .verse-count-btn").count();
    await npage.click(`#surahTable .verse-count-btn[data-verses="${SURAH}"]`);
    await npage.waitForSelector(".qd-picker-overlay", { timeout: 5000 });
    nav.opened = true;
    await npage.click(`.qd-picker-overlay .qd-surah[data-surah="${SURAH}"]`);
    await npage.waitForSelector(".qd-picker-overlay .qd-range-input", { timeout: 5000 });
    nav.prefilled = await npage.evaluate(
      () => document.querySelector('.qd-picker-overlay input[id$="To"]').value,
    );
  } catch {}
  report(
    "passage", "navigate.html · verse counts open the picker",
    nav.buttons === 114 && nav.opened && nav.prefilled === String(COUNT),
    `${nav.buttons} verse-count buttons (want 114); picker opened=${nav.opened}; ` +
      `range prefilled to ${nav.prefilled} (want ${COUNT})`,
  );
  await nctx.close();
}

// ── Navigate: the list must be the page ─────────────────────────────
// This page is titled "Browse all 114 surahs" and used to open with
// ~985px of juz grid, filters and method prose before the first row,
// with the profile panel rendering below all 114 rows so opening one
// from the top smooth-scrolled ~4,900px to the footer.
if (runCheck("navigate") && !PAGE_FILTER) {
  const nctx = await newContext();
  const page = await nctx.newPage();
  await page.goto(`${BASE}/navigate.html`, { waitUntil: "networkidle" });
  await page.waitForSelector("#surahBody tr", { timeout: 8000 });

  const reach = await page.evaluate(() => {
    const first = document.querySelector("#surahBody tr");
    return {
      firstRowTop: Math.round(first.getBoundingClientRect().top + window.scrollY),
      viewport: window.innerHeight,
      count: document.getElementById("surahCount").textContent.trim(),
      meaning: first.querySelector(".surah-en") ? first.querySelector(".surah-en").textContent.trim() : null,
      rows: document.querySelectorAll("#surahBody tr").length,
    };
  });
  report(
    "navigate", "navigate.html · the list is the page",
    reach.firstRowTop < reach.viewport * 1.5 && reach.rows === 114 &&
      reach.meaning === "The Opening" && /114/.test(reach.count),
    `first row at ${reach.firstRowTop}px (viewport ${reach.viewport}); ${reach.rows} rows; ` +
      `meaning column="${reach.meaning}"; count="${reach.count}"`,
  );

  // The profile panel opens next to the row that asked for it.
  await page.evaluate(() => document.documentElement.setAttribute("data-depth", "study"));
  await page.click('#surahBody tr:first-child .profile-toggle');
  await page.waitForSelector("#surahProfileRow", { timeout: 8000 });
  const near = await page.evaluate(() => {
    const btn = document.querySelector('#surahBody tr:first-child .profile-toggle');
    const panel = document.getElementById("surahProfileRow");
    return {
      gap: Math.round(panel.getBoundingClientRect().top - btn.getBoundingClientRect().bottom),
      insideTable: Boolean(panel.closest("#surahTable")),
    };
  });
  report(
    "navigate", "navigate.html · profile opens at its row",
    near.insideTable && Math.abs(near.gap) < 200,
    `panel is ${near.gap}px from its button and ${near.insideTable ? "inside" : "OUTSIDE"} the table`,
  );

  // Searching by English meaning: the page's own filter used to match
  // only the id prefix and the transliteration.
  await page.fill("#searchBox", "cow");
  await page.waitForTimeout(300);
  const byMeaning = await page.evaluate(() => ({
    rows: document.querySelectorAll("#surahBody tr").length,
    first: document.querySelector("#surahBody tr a") ? document.querySelector("#surahBody tr a").textContent.trim() : null,
    count: document.getElementById("surahCount").textContent.trim(),
  }));
  report(
    "navigate", "navigate.html · search by English meaning",
    byMeaning.first === "al-Baqarah" && /Showing/.test(byMeaning.count),
    `"cow" -> ${byMeaning.rows} row(s), first "${byMeaning.first}", count "${byMeaning.count}"`,
  );

  // The juz grid links to whole juz, and sits below the list.
  const juz = await page.evaluate(() => {
    const cells = [...document.querySelectorAll(".juz-cell")];
    const table = document.getElementById("surahTable");
    return {
      n: cells.length,
      allWhole: cells.every((c) => /\/read\?j=\d{1,2}$/.test(c.getAttribute("href"))),
      belowTable: cells.length
        ? cells[0].getBoundingClientRect().top + window.scrollY >
          table.getBoundingClientRect().top + window.scrollY
        : false,
    };
  });
  report(
    "navigate", "navigate.html · juz grid",
    juz.n === 30 && juz.allWhole && juz.belowTable,
    `${juz.n} cells; all link to /read?j=N: ${juz.allWhole}; below the table: ${juz.belowTable}`,
  );
  await nctx.close();
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
