import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";

const read = (p) => readFileSync(p, "utf8");
const write = (p, text) => writeFileSync(p, text);
const replaceOnce = (text, needle, replacement, label) => {
  if (!text.includes(needle)) throw new Error(`Missing patch anchor: ${label}`);
  return text.replace(needle, replacement);
};
const escapeHtml = (v) => String(v)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const NEW_NAV = `    <nav class="primary" aria-label="Primary">
      <ul class="nav-groups">
        <li class="nav-group" data-group="read">
          <details class="nav-details" name="nav-group">
            <summary class="nav-group-btn">Read</summary>
            <ul class="nav-menu">
              <li><a href="/read">Read</a></li>
              <li><a href="/navigate">Navigate</a></li>
              <li><a href="/#dailySection">Today's discourse</a></li>
              <li><a href="/paths">Study paths</a></li>
            </ul>
          </details>
        </li>
        <li class="nav-group" data-group="explore">
          <details class="nav-details" name="nav-group">
            <summary class="nav-group-btn">Explore</summary>
            <ul class="nav-menu">
              <li class="nav-menu-label" aria-hidden="true">Study</li>
              <li><a href="/dossier">Dossier</a></li>
              <li><a href="/themes">Themes</a></li>
              <li><a href="/compare">Compare</a></li>
              <li><a href="/replay">Replay</a></li>
              <li><a href="/exercises">Exercises</a></li>
              <li class="nav-menu-label" aria-hidden="true">Analyze</li>
              <li><a href="/roots">Roots</a></li>
              <li><a href="/words">Words</a></li>
              <li><a href="/patterns">Patterns</a></li>
              <li><a href="/formulas">Formulas</a></li>
              <li><a href="/numbers">Numbers</a></li>
            </ul>
          </details>
        </li>
        <li class="nav-group" data-group="learn">
          <details class="nav-details" name="nav-group">
            <summary class="nav-group-btn">Learn</summary>
            <ul class="nav-menu">
              <li><a href="/how-to-use">How to use</a></li>
              <li><a href="/how-it-works">How it works</a></li>
              <li><a href="/glossary">Glossary</a></li>
              <li><a href="/search">Search</a></li>
              <li><a href="/watch">Watch</a></li>
            </ul>
          </details>
        </li>
        <li class="nav-group" data-group="verify">
          <details class="nav-details" name="nav-group">
            <summary class="nav-group-btn">Verify</summary>
            <ul class="nav-menu">
              <li><a href="/sources">Sources</a></li>
              <li><a href="/validation">Validation</a></li>
              <li><a href="/datasets">Datasets</a></li>
              <li><a href="/coverage">Coverage</a></li>
              <li><a href="/export">Export</a></li>
              <li><a href="/changelog">Changelog</a></li>
              <li><a href="/contribute">Contribute</a></li>
              <li><a href="/open-questions">Open questions</a></li>
            </ul>
          </details>
        </li>
      </ul>
    </nav>`;

// 1) Reduce top-level information architecture from five mental models to four.
for (const file of readdirSync(".").filter((f) => f.endsWith(".html"))) {
  let html = read(file);
  const navRe = /    <nav class="primary" aria-label="Primary">[\s\S]*?    <\/nav>/;
  if (navRe.test(html)) {
    html = html.replace(navRe, NEW_NAV);
    write(file, html);
  }
}
let navJs = read("assets/nav.js").replace("five <details> groups", "four <details> groups");
write("assets/nav.js", navJs);

// 2) Make the reader's controls visually secondary to scripture.
let readHtml = read("read.html");
readHtml = replaceOnce(
  readHtml,
  '        <div class="card">\n          <div\n            style="\n              display: flex;\n              gap: 0.8rem;',
  '        <div class="card reader-controls-card">\n          <div\n            style="\n              display: flex;\n              gap: 0.8rem;',
  "reader controls card",
);
if (!readHtml.includes('assets/notes-portability.js')) {
  readHtml = replaceOnce(
    readHtml,
    '    <script src="assets/notebook.js" defer></script>',
    '    <script src="assets/notebook.js" defer></script>\n    <script src="assets/notes-portability.js" defer></script>',
    "notes portability script",
  );
}
write("read.html", readHtml);

// 3) Give Themes a useful no-JS/loading state instead of a blank spinner.
const themeData = JSON.parse(read("data/themes.json"));
const themeCards = themeData.themes.map((t) => {
  const roots = (t.roots || []).slice(0, 3).map((r) =>
    `<span class="theme-static-root"><span class="ar notranslate" translate="no" lang="ar" dir="rtl">${escapeHtml(r.arabic)}</span> ${escapeHtml(r.latin)}</span>`,
  ).join(" · ");
  return `<article class="card theme-static-card" id="theme-${escapeHtml(t.slug)}"><h3>${escapeHtml(t.title)}</h3><p class="caption-note">${roots}</p><p><a href="/search?q=${encodeURIComponent(t.title)}">Search passages and evidence <span aria-hidden="true">→</span></a></p></article>`;
}).join("\n          ");
let themesHtml = read("themes.html");
themesHtml = themesHtml.replace(
  /<div id="themeSections">\s*<p>Loading themes[^<]*<\/p>\s*<\/div>/,
  `<div id="themeSections" class="theme-static-grid">\n          ${themeCards}\n        </div>`,
);
write("themes.html", themesHtml);

// 4) Add a compact local-only study dashboard to the home page.
let index = read("index.html");
if (!index.includes('id="myStudy"')) {
  const studySection = `      <section id="myStudy" class="workflow-section" aria-labelledby="my-study-title">
        <div class="section-heading study-heading">
          <div>
            <h2 id="my-study-title">My study</h2>
            <p class="caption-note">Your reading position, path progress, exercises, and notes stay on this device. No account or tracking.</p>
          </div>
          <a href="/about#privacy" class="t-annotation">How local storage works</a>
        </div>
        <div class="study-dashboard" aria-live="polite">
          <a class="study-metric" id="studyLastRead" href="/read"><strong>Reading</strong><span>Start a passage</span></a>
          <a class="study-metric" id="studyPaths" href="/paths"><strong>Study paths</strong><span>Choose a path</span></a>
          <a class="study-metric" id="studyExercises" href="/exercises"><strong>Exercises</strong><span>Practice the method</span></a>
          <a class="study-metric" id="studyNotes" href="/read"><strong>Notes</strong><span>Saved only in this browser</span></a>
        </div>
      </section>

`;
  index = replaceOnce(index, '      <section id="dailySection"', studySection + '      <section id="dailySection"', "home study dashboard");
  index = replaceOnce(index, '    <script src="assets/case-studies.js" defer></script>', '    <script src="assets/case-studies.js" defer></script>\n    <script src="assets/study-dashboard.js" defer></script>', "study dashboard script");
}
write("index.html", index);

// 5) Add search result facets without changing the local-only search engine.
let searchHtml = read("search.html");
if (!searchHtml.includes('id="searchFilters"')) {
  searchHtml = replaceOnce(
    searchHtml,
    '        <div id="searchStatus" role="status" aria-live="polite"></div>',
    '        <div id="searchStatus" role="status" aria-live="polite"></div>\n        <div id="searchFilters" class="search-filter-bar" aria-label="Filter search results" hidden></div>',
    "search filters host",
  );
  searchHtml = replaceOnce(
    searchHtml,
    '    <script src="assets/search.js" defer></script>',
    '    <script src="assets/search.js" defer></script>\n    <script src="assets/search-filters.js" defer></script>',
    "search filters script",
  );
}
write("search.html", searchHtml);

// 6) Put researcher/educator reuse paths on the page that already owns evidence methodology.
let validation = read("validation.html");
if (!validation.includes('id="research-teaching"')) {
  const research = `      <section id="research-teaching" class="workflow-section ruled" aria-labelledby="research-teaching-title">
        <div class="section-heading">
          <div>
            <h2 id="research-teaching-title">Research &amp; teaching</h2>
            <p class="lede">Use the evidence without turning this site into an authority it does not claim to be.</p>
          </div>
        </div>
        <div class="research-teaching-grid">
          <article class="card"><h3>Inspect &amp; cite</h3><p>Follow claim badges to named sources, then cite the versioned site or underlying source.</p><p><a href="/sources">Sources</a> · <a href="/about#cite">Citation guidance</a></p></article>
          <article class="card"><h3>Reproduce</h3><p>Download generated tables, inspect counting rules, and reproduce the deterministic data pipeline.</p><p><a href="/datasets">Datasets</a> · <a href="/export">Export</a> · <a href="/coverage">Coverage</a></p></article>
          <article class="card"><h3>Teach</h3><p>Use study paths and exercises to teach a method of close reading while keeping interpretation distinct from computed evidence.</p><p><a href="/paths">Study paths</a> · <a href="/exercises">Exercises</a></p></article>
          <article class="card"><h3>Review</h3><p>Check a claim, method, source, or framing and submit evidence or a reproducible discrepancy.</p><p><a href="/contribute">Contribute</a> · <a href="/open-questions">Open questions</a></p></article>
        </div>
      </section>
`;
  validation = replaceOnce(validation, '    </main>', research + '    </main>', "research and teaching section");
}
write("validation.html", validation);

// 7) Shared visual polish. Keep the existing palette and editorial identity.
let css = read("assets/style.css");
const marker = "/* Product-excellence pass: progressive disclosure and continuity */";
if (!css.includes(marker)) {
  css += `\n\n${marker}\n.nav-menu-label {\n  margin: 0.35rem 0 0.15rem;\n  padding: 0.25rem 0.85rem 0.2rem;\n  color: var(--muted);\n  font-size: 0.72rem;\n  font-weight: 700;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n  border-top: 1px solid var(--line);\n}\n.nav-menu-label:first-child { border-top: 0; margin-top: 0; }\n.nav-group[data-group="explore"] .nav-menu { min-width: 15rem; }\n.reader-controls-card {\n  background: color-mix(in srgb, var(--card) 72%, var(--bg));\n  box-shadow: none;\n  border-color: color-mix(in srgb, var(--line) 70%, transparent);\n}\n.reader-controls-card .caption-note { max-width: 74ch; }\n.study-heading { display: flex; justify-content: space-between; align-items: end; gap: 1rem; flex-wrap: wrap; }\n.study-heading h2 { margin-bottom: 0.25rem; }\n.study-dashboard {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: 0.75rem;\n}\n.study-metric {\n  display: flex;\n  min-height: 7.25rem;\n  flex-direction: column;\n  justify-content: space-between;\n  gap: 0.75rem;\n  padding: 1rem;\n  color: var(--ink);\n  text-decoration: none;\n  border: 1px solid var(--line);\n  border-radius: 10px;\n  background: var(--card);\n}\n.study-metric:hover { transform: translateY(-1px); border-color: var(--accent); }\n.study-metric span { color: var(--muted); font-size: 0.88rem; line-height: 1.45; }\n.search-filter-bar { display: flex; gap: 0.45rem; flex-wrap: wrap; margin: 0.8rem 0 1rem; }\n.search-filter { min-height: 38px; padding: 0.35rem 0.7rem; border: 1px solid var(--line); border-radius: 999px; background: var(--card); color: var(--ink); font: inherit; font-size: 0.84rem; cursor: pointer; }\n.search-filter[aria-pressed="true"] { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }\n.search-hits mark { background: transparent; color: inherit; text-decoration: underline; text-decoration-thickness: 0.16em; text-decoration-color: var(--accent); text-underline-offset: 0.12em; }\n.theme-static-grid, .research-teaching-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }\n.theme-static-card h3, .research-teaching-grid h3 { margin-top: 0; }\n.theme-static-root { white-space: nowrap; }\n.notes-backup-card { margin-top: 1rem; }\n.notes-backup-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }\n.ar { line-height: 1.85; text-rendering: optimizeLegibility; }\n.ar.xl { line-height: 2.05; }\n@media (max-width: 760px) {\n  .study-dashboard, .theme-static-grid, .research-teaching-grid { grid-template-columns: 1fr; }\n  .study-metric { min-height: 5.8rem; }\n  .reader-controls-card { padding: 0.9rem; }\n}\n`;
}
write("assets/style.css", css);

// 8) Local-only study dashboard logic.
write("assets/study-dashboard.js", `(function () {\n  "use strict";\n  function safeJson(key, fallback) {\n    try { return JSON.parse(localStorage.getItem(key) || "") || fallback; } catch (e) { return fallback; }\n  }\n  function ready(fn) { document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn) : fn(); }\n  ready(function () {\n    var state = safeJson("qd_state", {});\n    var progress = state.progress || {};\n    var notes = safeJson("qd_notes", {});\n    var last = progress.lastRead;\n    var readEl = document.getElementById("studyLastRead");\n    var pathsEl = document.getElementById("studyPaths");\n    var exEl = document.getElementById("studyExercises");\n    var notesEl = document.getElementById("studyNotes");\n    if (readEl && last && last.s && last.a) {\n      readEl.href = "/read?s=" + encodeURIComponent(last.s) + "&a=" + encodeURIComponent(last.a);\n      readEl.querySelector("span").textContent = "Resume Surah " + last.s + ", verse " + last.a;\n    }\n    var pathCount = Object.keys(progress.paths || {}).length;\n    if (pathsEl) pathsEl.querySelector("span").textContent = pathCount ? pathCount + (pathCount === 1 ? " path in progress" : " paths in progress") : "Choose a guided path";\n    var exercises = progress.exercises || {};\n    var exIds = Object.keys(exercises);\n    var attempts = exIds.reduce(function (n, id) { return n + Number(exercises[id].attempts || 1); }, 0);\n    if (exEl) exEl.querySelector("span").textContent = exIds.length ? exIds.length + " tried · " + attempts + " total attempt" + (attempts === 1 ? "" : "s") : "Practice the method";\n    var noteRefs = Object.keys(notes);\n    if (notesEl) {\n      notesEl.querySelector("span").textContent = noteRefs.length ? noteRefs.length + (noteRefs.length === 1 ? " saved note" : " saved notes") + " · export a backup from Read" : "Saved only in this browser";\n      if (noteRefs.length) {\n        var ref = noteRefs.sort(function (a, b) { return String(notes[b].updated || "").localeCompare(String(notes[a].updated || "")); })[0];\n        var parts = ref.split(":");\n        if (parts.length === 2) notesEl.href = "/read?s=" + encodeURIComponent(parts[0]) + "&a=" + encodeURIComponent(parts[1]);\n      }\n    }\n  });\n})();\n`);

// 9) Search facets + safe DOM highlighting.
write("assets/search-filters.js", `(function () {\n  "use strict";\n  var host, results, busy = false;\n  function qTerms() {\n    return (new URLSearchParams(location.search).get("q") || "").trim().split(/\\s+/).filter(function (x) { return x.length > 1; }).slice(0, 6);\n  }\n  function highlight(el, terms) {\n    if (!el || !terms.length || el.querySelector("mark")) return;\n    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);\n    var nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);\n    nodes.forEach(function (node) {\n      var text = node.nodeValue; var lower = text.toLowerCase(); var hit = null;\n      terms.forEach(function (t) { var i = lower.indexOf(t.toLowerCase()); if (i >= 0 && (!hit || i < hit.i)) hit = { i: i, t: text.slice(i, i + t.length) }; });\n      if (!hit) return;\n      var frag = document.createDocumentFragment();\n      frag.appendChild(document.createTextNode(text.slice(0, hit.i)));\n      var mark = document.createElement("mark"); mark.textContent = hit.t; frag.appendChild(mark);\n      frag.appendChild(document.createTextNode(text.slice(hit.i + hit.t.length))); node.parentNode.replaceChild(frag, node);\n    });\n  }\n  function apply(kind) {\n    var heads = Array.prototype.slice.call(results.querySelectorAll("h3.search-group"));\n    heads.forEach(function (h) {\n      var key = h.textContent.trim().toLowerCase();\n      var show = !kind || key === kind; h.hidden = !show;\n      if (h.nextElementSibling) h.nextElementSibling.hidden = !show;\n    });\n    host.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String((b.dataset.kind || "") === kind)); });\n  }\n  function rebuild() {\n    if (busy) return; busy = true;\n    var heads = Array.prototype.slice.call(results.querySelectorAll("h3.search-group"));\n    if (!heads.length) { host.hidden = true; host.innerHTML = ""; busy = false; return; }\n    var current = new URLSearchParams(location.search).get("type") || "";\n    var buttons = [{ key: "", label: "All" }].concat(heads.map(function (h) { return { key: h.textContent.trim().toLowerCase(), label: h.textContent.trim() }; }));\n    host.innerHTML = ""; buttons.forEach(function (item) {\n      var b = document.createElement("button"); b.type = "button"; b.className = "search-filter"; b.dataset.kind = item.key; b.textContent = item.label;\n      b.addEventListener("click", function () {\n        var url = new URL(location.href); if (item.key) url.searchParams.set("type", item.key); else url.searchParams.delete("type"); history.replaceState(null, "", url); apply(item.key);\n      }); host.appendChild(b);\n    });\n    host.hidden = false; apply(buttons.some(function (b) { return b.key === current; }) ? current : "");\n    var terms = qTerms(); results.querySelectorAll(".search-hits a, .search-snippet").forEach(function (el) { highlight(el, terms); });\n    busy = false;\n  }\n  function ready(fn) { document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn) : fn(); }\n  ready(function () {\n    host = document.getElementById("searchFilters"); results = document.getElementById("searchResults"); if (!host || !results) return;\n    new MutationObserver(function () { setTimeout(rebuild, 0); }).observe(results, { childList: true }); rebuild();\n  });\n})();\n`);

// 10) Lossless local notes backup/import; Markdown export remains in notes.js.
write("assets/notes-portability.js", `(function () {\n  "use strict"; var KEY = "qd_notes";\n  function ready(fn) { document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", fn) : fn(); }\n  function load() { try { var x = JSON.parse(localStorage.getItem(KEY) || "{}"); return x && typeof x === "object" && !Array.isArray(x) ? x : {}; } catch (e) { return {}; } }\n  function valid(notes) {\n    var out = {}; Object.keys(notes || {}).forEach(function (ref) {\n      if (!/^\\d{1,3}:\\d+(?:-\\d+)?$/.test(ref)) return; var n = notes[ref];\n      if (!n || typeof n.text !== "string") return; out[ref] = { text: n.text, updated: typeof n.updated === "string" ? n.updated : new Date().toISOString() };\n    }); return out;\n  }\n  function toast(msg) { if (window.qdToast) window.qdToast(msg); else window.alert(msg); }\n  function exportBackup() {\n    var payload = { format: "divine-discourses-notes", version: 1, exportedAt: new Date().toISOString(), notes: load() };\n    var blob = new Blob([JSON.stringify(payload, null, 2) + "\\n"], { type: "application/json" }); var a = document.createElement("a");\n    a.href = URL.createObjectURL(blob); a.download = "divine-discourses-notes.json"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);\n  }\n  function importBackup(file) {\n    var reader = new FileReader(); reader.onload = function () {\n      try {\n        var parsed = JSON.parse(String(reader.result || "{}")); var incoming = valid(parsed.notes || parsed); var refs = Object.keys(incoming);\n        if (!refs.length) throw new Error("No valid notes found"); var existing = load(); var conflicts = refs.filter(function (r) { return existing[r]; }).length;\n        var ok = window.confirm("Import " + refs.length + " note" + (refs.length === 1 ? "" : "s") + (conflicts ? " and replace " + conflicts + " matching note" + (conflicts === 1 ? "" : "s") : "") + "? Existing notes at other references stay unchanged.");\n        if (!ok) return; Object.keys(incoming).forEach(function (r) { existing[r] = incoming[r]; }); localStorage.setItem(KEY, JSON.stringify(existing)); toast("Notes imported. Reloading the reader."); location.reload();\n      } catch (e) { toast("Could not import that notes backup."); }\n    }; reader.readAsText(file);\n  }\n  ready(function () {\n    var mount = document.getElementById("notesSection"); if (!mount || document.getElementById("notesBackupCard")) return;\n    var card = document.createElement("div"); card.className = "card notes-backup-card"; card.id = "notesBackupCard";\n    card.innerHTML = '<h3 style="margin-top:0">Notes backup</h3><p class="caption-note">Notes do not sync. Export a lossless JSON backup before clearing browser data or changing devices; importing merges by verse reference.</p><div class="notes-backup-actions"><button type="button" class="button secondary" id="notesBackupExport">Export backup</button><label class="button secondary" for="notesBackupImport">Import backup</label><input id="notesBackupImport" type="file" accept="application/json,.json" hidden /></div>';\n    mount.insertAdjacentElement("afterend", card); document.getElementById("notesBackupExport").addEventListener("click", exportBackup);\n    document.getElementById("notesBackupImport").addEventListener("change", function (e) { var f = e.target.files && e.target.files[0]; if (f) importBackup(f); e.target.value = ""; });\n  });\n})();\n`);

// 11) Zero-dependency performance budgets: guard against accidental payload explosions without Lighthouse CI cost.
write("scripts/check-performance-budgets.mjs", `import { readFileSync, statSync } from "node:fs";\nconst KB = 1024; const failures = [];\nconst size = (p) => statSync(p).size;\nconst pageAssets = (page) => {\n  const html = readFileSync(page, "utf8"); const files = new Set();\n  for (const m of html.matchAll(/<(?:script)[^>]+src="(assets\\/[^\"]+\\.js)"/g)) files.add(m[1]);\n  for (const m of html.matchAll(/<link[^>]+href="(assets\\/[^\"]+\\.css)"[^>]*>/g)) files.add(m[1]);\n  return [...files];\n};\nconst limits = { "assets/style.css": 180 * KB, "assets/app.js": 180 * KB, "assets/search.js": 70 * KB };\nfor (const [p, max] of Object.entries(limits)) if (size(p) > max) failures.push(p + " " + Math.ceil(size(p)/KB) + "KB > " + Math.ceil(max/KB) + "KB");\nfor (const [page, max] of [["index.html", 550*KB], ["read.html", 950*KB], ["search.html", 550*KB]]) {\n  const assets = pageAssets(page); const total = assets.reduce((n,p) => n + size(p), 0);\n  if (total > max) failures.push(page + " shell assets " + Math.ceil(total/KB) + "KB > " + Math.ceil(max/KB) + "KB");\n  if (size(page) > 320*KB) failures.push(page + " HTML " + Math.ceil(size(page)/KB) + "KB > 320KB");\n  console.log(page + ": " + Math.ceil(total/KB) + "KB referenced JS/CSS across " + assets.length + " files");\n}\nif (failures.length) { console.error("Performance budgets: FAIL\\n- " + failures.join("\\n- ")); process.exit(1); }\nconsole.log("Performance budgets: OK (uncompressed guardrails; no external requests or paid tooling).");\n`);

// 12) Critical user-journey smoke test reuses the Playwright install the existing audit already pays for.
write("scripts/verify-journeys.mjs", `import { fileURLToPath } from "node:url"; import { dirname, join } from "node:path";\nimport { resolveChromium, launchOptions } from "./lib/playwright.mjs"; import { startStaticServer } from "./lib/static-server.mjs";\nconst ROOT = join(dirname(fileURLToPath(import.meta.url)), ".."); const chromium = await resolveChromium("verify-journeys");\nconst { server, base } = await startStaticServer(ROOT); const browser = await chromium.launch(launchOptions()); const failures = [];\nconst check = (ok, name) => { console.log((ok ? "PASS" : "FAIL") + " journey · " + name); if (!ok) failures.push(name); };\ntry {\n  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });\n  await ctx.addInitScript(() => { localStorage.setItem("qd_state", JSON.stringify({ progress: { lastRead: { s: 103, a: "1-3" }, paths: { coherence: { steps: { 0: true } } }, exercises: { "asr-outline": { attempts: 2 } } } })); localStorage.setItem("qd_notes", JSON.stringify({ "103:1-3": { text: "Structure note", updated: "2026-08-26T00:00:00.000Z" } })); });\n  const page = await ctx.newPage();\n  await page.goto(base + "/"); check(await page.locator("nav.primary .nav-group").count() === 4, "four clear top-level navigation groups");\n  check((await page.locator("#studyLastRead span").textContent()).includes("Surah 103"), "local study dashboard resumes reading");\n  check((await page.locator("#studyNotes span").textContent()).includes("1 saved note"), "local study dashboard surfaces notes");\n  await page.goto(base + "/search?q=mercy"); await page.waitForFunction(() => document.querySelectorAll("#searchResults .search-group").length > 0);\n  check(await page.locator("#searchFilters .search-filter").count() > 1, "search exposes result-type facets");\n  await page.locator("#searchFilters .search-filter").nth(1).click(); check(await page.locator("#searchFilters .search-filter[aria-pressed='true']").count() === 1, "search facet state is explicit");\n  await page.goto(base + "/read"); check(await page.locator(".reader-controls-card").count() === 1, "reader control hierarchy is applied");\n  check(await page.locator("#notesBackupCard").count() === 1, "notes backup/import is discoverable");\n  await page.goto(base + "/validation#research-teaching"); check(await page.locator("#research-teaching .card").count() === 4, "research and teaching reuse paths are present");\n  await ctx.close();\n  const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } }); const nojsPage = await nojs.newPage(); await nojsPage.goto(base + "/themes");\n  check(await nojsPage.locator("#themeSections .theme-static-card").count() > 0, "themes remain useful without JavaScript"); await nojs.close();\n} catch (e) { failures.push("harness: " + e.message); console.error(e); } finally { await browser.close(); await new Promise((r) => server.close(r)); }\nif (failures.length) { console.error("Critical journeys: FAIL\\n- " + failures.join("\\n- ")); process.exit(1); } console.log("Critical journeys: OK");\n`);

// 13) Document the genuinely human checks instead of pretending automation proves them.
mkdirSync("docs", { recursive: true });
write("docs/experience-qa.md", `# Experience QA sign-off\n\nAutomated checks are necessary but not sufficient for a Qur'an reading interface. Complete this checklist for major visual releases. It intentionally requires no analytics or paid monitoring.\n\n## Assistive technology\n- [ ] VoiceOver/Safari: landmarks, nav menus, search filters, reader controls, source badges, notes backup.\n- [ ] NVDA/Firefox or Chrome: same critical journeys.\n- [ ] Keyboard only: visible focus, logical order, Escape behavior, no traps.\n- [ ] 200% and 400% zoom: no clipped text or horizontal page scroll.\n\n## Arabic and mixed-direction text\n- [ ] Long Arabic verses with diacritics do not clip vertically.\n- [ ] Arabic/English punctuation and verse references read in the intended order.\n- [ ] Parallel translations remain visually distinguishable at phone widths.\n\n## Mobile and media\n- [ ] iPhone-class 390px viewport: reader, nav, search, themes, dossier, validation.\n- [ ] Android-class narrow viewport: same journeys.\n- [ ] Audio play/pause/reciter change works and failure state remains understandable.\n- [ ] Light, dark, and each palette preserve hierarchy and focus visibility.\n\n## Production-only\n- [ ] Submit a correction on the deployed site and confirm it is captured in Netlify Forms.\n- [ ] Verify security/cache headers on the production URL.\n- [ ] Test one online → offline → online reader journey after service-worker activation.\n\nRun the automated companion before sign-off:\n\n```sh\nnode scripts/check-performance-budgets.mjs\nnode scripts/verify-site.mjs --shots\nnode scripts/verify-journeys.mjs\n```\n`);

// 14) Wire cheap budgets before browser setup; journey checks reuse the one browser audit.
let audit = read(".github/workflows/audit.yml");
if (!audit.includes("check-performance-budgets.mjs")) {
  audit = replaceOnce(audit, "          node scripts/check-content.mjs\n", "          node scripts/check-content.mjs\n          node scripts/check-performance-budgets.mjs\n", "performance check in audit");
}
if (!audit.includes("verify-journeys.mjs")) {
  audit = replaceOnce(audit, "          node scripts/verify-site.mjs\n", "          node scripts/verify-site.mjs\n          node scripts/verify-journeys.mjs\n", "journey check in audit");
}
write(".github/workflows/audit.yml", audit);

console.log("Product-excellence patches applied.");
