// smoke-deployed.mjs — a read-only check of a DEPLOYED site: production or
// a Netlify preview. Every other check in this repo serves the working
// tree locally; this one asks the real host what it actually does, so a
// difference between netlify.toml's intent and the deployment shows up.
//
//   node scripts/smoke-deployed.mjs                          # production
//   node scripts/smoke-deployed.mjs https://deploy-preview-170--<site>.netlify.app
//   node scripts/smoke-deployed.mjs http://localhost:8000 --local
//
// GET/HEAD requests only. Never submits a form, never writes anything.
// Each check prints PASS, FAIL or SKIP (SKIP = not applicable to this
// target, or the host could not be reached: never counted as a pass);
// INFO lines report a state without judging it.
// Exit 1 on any FAIL, 2 when the target could not be reached at all.
//
// --local  for scripts/serve.mjs, which serves files but does not apply
//          netlify.toml: header, redirect and host checks are SKIPped.
//
// Checks: canonical host and the .com/http redirects (production only);
// .html -> clean-URL 301; unknown URL -> 404; robots.txt names the
// sitemap; a sample of sitemap URLs answer 200, are not noindex, and
// carry a matching canonical; a share stub is noindex and outside the
// sitemap; representative pages' title, description, exactly one h1 (in
// <main> on the surah/juz/root pages) and
// parseable JSON-LD; the bundled Arabic and Tanzil notice in delivered
// HTML; the /* security headers; the word-by-word proxy's state.
// Not covered (needs a browser): translation-failure rendering, which
// scripts/verify-site.mjs asserts against the local tree.

const args = process.argv.slice(2);
const LOCAL = args.includes("--local");
const BASE = (args.find((a) => !a.startsWith("--")) || "https://divinediscourses.org").replace(/\/$/, "");
const PROD = BASE === "https://divinediscourses.org";
const TIMEOUT = 20000;

let fails = 0;
let passes = 0;
const out = (kind, name, detail) => {
  if (kind === "FAIL") fails++;
  if (kind === "PASS") passes++;
  console.log(`${kind.padEnd(4)} ${name}${detail ? " · " + detail : ""}`);
};
const check = (name, ok, detail) => out(ok ? "PASS" : "FAIL", name, detail);

async function get(url, opts = {}) {
  return fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT), ...opts });
}
async function text(url) {
  const r = await get(url);
  return { r, body: r.status === 200 ? await r.text() : "" };
}
const meta = (h, re) => (re.exec(h) || [])[1] || null;

// ── reachability ─────────────────────────────────────────────────────
try {
  await get(BASE + "/");
} catch (e) {
  console.log(`SKIP everything · ${BASE} unreachable (${e.cause?.code || e.message})`);
  process.exit(2);
}

// ── hosts and redirects (production config only) ─────────────────────
if (PROD && !LOCAL) {
  for (const [from, to] of [
    ["http://divinediscourses.org/read", "https://divinediscourses.org/read"],
    ["https://divinediscourses.com/read", "https://divinediscourses.org/read"],
    ["https://www.divinediscourses.com/read", "https://divinediscourses.org/read"],
  ]) {
    try {
      const r = await get(from);
      const loc = r.headers.get("location") || "";
      check(`redirect ${from}`, r.status === 301 && loc.replace(/\/$/, "") === to, `${r.status} -> ${loc || "(none)"}`);
    } catch (e) {
      out("SKIP", `redirect ${from}`, `unreachable (${e.cause?.code || e.message})`);
    }
  }
}
if (!LOCAL) {
  const r = await get(BASE + "/read.html");
  check("clean URL: /read.html is a 301 to /read", r.status === 301 && /\/read$/.test(r.headers.get("location") || ""), `${r.status} -> ${r.headers.get("location")}`);
} else out("SKIP", "clean-URL redirect", "--local");

{
  const r = await get(BASE + "/this-page-does-not-exist-" + Date.now());
  check("unknown URL answers 404", r.status === 404, String(r.status));
}

// ── preview indexing (any non-production, non-local target) ──────────
// A preview or branch deploy should not be indexed. Its canonicals point
// at production either way; this reports what the host actually sends.
if (!PROD && !LOCAL) {
  const r = await get(BASE + "/");
  const xrt = r.headers.get("x-robots-tag") || "";
  console.log(`INFO preview indexing · X-Robots-Tag on / is ${xrt ? `"${xrt}"` : "absent"}${/noindex/.test(xrt) ? "" : " (canonicals still name production)"}`);
}

// ── robots and sitemap ───────────────────────────────────────────────
const robots = await text(BASE + "/robots.txt");
check("robots.txt is 200 and names the sitemap", robots.r.status === 200 && /Sitemap:\s*https:\/\/divinediscourses\.org\/sitemap\.xml/.test(robots.body), String(robots.r.status));
check("robots.txt does not disallow the site", !/^Disallow:\s*\/\s*$/m.test(robots.body));
const sm = await text(BASE + "/sitemap.xml");
const locs = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
check("sitemap.xml lists pages", sm.r.status === 200 && locs.length > 100, `${locs.length} URLs`);
if (!locs.every((u) => u.startsWith("https://divinediscourses.org/"))) check("sitemap URLs all on the canonical host", false);

// A deterministic sample spread across the families.
const sample = [...new Set([
  "https://divinediscourses.org/",
  ...["/read", "/about", "/themes", "/sources", "/validation"].map((p) => "https://divinediscourses.org" + p),
  ...["/surah/", "/juz/", "/root/"].map((p) => locs.find((u) => u.includes(p))),
  ...locs.filter((_, i) => i % Math.max(1, Math.floor(locs.length / 8)) === 0),
].filter(Boolean))];
for (const u of sample) {
  const path = u.replace("https://divinediscourses.org", "") || "/";
  const { r, body } = await text(BASE + path);
  const robotsMeta = meta(body, /<meta name="robots" content="([^"]+)"/) || "";
  const xrt = r.headers.get("x-robots-tag") || "";
  const canon = meta(body, /<link\s+rel="canonical"\s+href="([^"]+)"/);
  const h1InMain = ((/<main\b[\s\S]*?<\/main>/.exec(body) || [""])[0].match(/<h1\b/g) || []).length;
  const ldOk = [...body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].every((m) => {
    try { JSON.parse(m[1]); return true; } catch { return false; }
  });
  const problems = [];
  if (r.status !== 200) problems.push(`status ${r.status}`);
  if (/noindex/.test(robotsMeta + " " + xrt)) problems.push("noindex");
  if (canon !== u) problems.push(`canonical ${canon}`);
  if (!meta(body, /<title>([^<]+)<\/title>/)) problems.push("no title");
  if (!/<meta\s+name="description"\s+content="[^"]{30,}"/.test(body)) problems.push("no description");
  const h1All = (body.match(/<h1\b/g) || []).length;
  if (h1All !== 1) problems.push(`${h1All} h1 elements`);
  // Generated reference pages carry their own title as the h1.
  if (/^\/(surah|juz|root)\//.test(path) && h1InMain !== 1) problems.push("title is not the h1 in <main>");
  if (!ldOk) problems.push("JSON-LD does not parse");
  if (!LOCAL && r.status === 200 && !/text\/html/.test(r.headers.get("content-type") || "")) problems.push(`content-type ${r.headers.get("content-type")}`);
  check(`page ${path}`, !problems.length, problems.join(", ") || "200, indexable, canonical, title, description, one h1, JSON-LD");
}

// ── share stubs stay out of the index ────────────────────────────────
{
  const { r, body } = await text(BASE + "/s/surah/1");
  const noindex = /noindex/.test((meta(body, /<meta name="robots" content="([^"]+)"/) || "") + " " + (r.headers.get("x-robots-tag") || ""));
  check("share stub /s/surah/1 is noindex and not in the sitemap", r.status === 200 && noindex && !locs.some((u) => u.includes("/s/")), `${r.status}, noindex=${noindex}`);
}

// ── text integrity in delivered HTML ─────────────────────────────────
{
  const { body } = await text(BASE + "/surah/1");
  check("surah page ships the Arabic and the Tanzil notice in its HTML", /بِسْمِ/.test(body) && /Tanzil Quran Text/.test(body) && /CHANGING IT IS NOT ALLOWED/.test(body));
}

// ── security headers ─────────────────────────────────────────────────
if (!LOCAL) {
  const r = await get(BASE + "/");
  const h = (k) => r.headers.get(k) || "";
  check("CSP present on /", /default-src 'self'/.test(h("content-security-policy")) && /frame-ancestors 'none'/.test(h("content-security-policy")));
  check("nosniff on /", h("x-content-type-options") === "nosniff");
  check("Referrer-Policy on /", h("referrer-policy") === "strict-origin-when-cross-origin");
  check("HSTS on /", /max-age=\d+/.test(h("strict-transport-security")));
} else out("SKIP", "security headers", "--local");

// ── word-by-word proxy (informational state, never a pass by itself) ──
if (!LOCAL) {
  try {
    const r = await get(BASE + "/api/wbw?chapter=1&page=1");
    const body = await r.text();
    if (r.status === 200) {
      let ok = false;
      try { ok = Array.isArray(JSON.parse(body).verses); } catch {}
      check("word-by-word proxy answers with verses", ok, "200");
    } else if (r.status === 503 && /not_configured/.test(body)) {
      out("SKIP", "word-by-word proxy", "deployed but not configured (503 not_configured): credentials not set");
    } else {
      check("word-by-word proxy", false, `status ${r.status}`);
    }
  } catch (e) {
    out("SKIP", "word-by-word proxy", `unreachable (${e.message})`);
  }
} else out("SKIP", "word-by-word proxy", "--local (Netlify Functions are not served)");

console.log(`smoke-deployed ${BASE}: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
