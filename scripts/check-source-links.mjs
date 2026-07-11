// check-source-links.mjs — liveness checker for every external URL the
// site cites or links: the `url` fields in data/sources.json plus all
// http(s) hrefs in the root *.html pages. A citation that 404s is a
// credibility bug (guide backlog: "external citation-link liveness
// checking"); this makes rot visible before a reader finds it.
//
// A checker, not a generator: writes nothing, so the determinism rule
// does not apply. Needs real outbound network — sandboxed sessions with
// an allowlisting proxy will see spurious failures; run it from an
// unrestricted machine.
//
// Verdicts: 2xx/3xx OK · 401/403/405/429 WARN (usually bot-shielding,
// check by hand) · 404/410, persistent 5xx, network failure FAIL.
// Exit 0 = no FAILs · 1 = FAILs (or WARNs with --strict) · 2 = harness.
//
// Run:  node scripts/check-source-links.mjs [--strict] [--curl] [--timeout ms]
//   --curl  shell out to curl per URL instead of fetch (curl honors
//           HTTPS_PROXY natively; Node needs NODE_USE_ENV_PROXY=1,
//           which this script re-execs itself to set when a proxy
//           environment is detected).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const STRICT = args.includes("--strict");
const USE_CURL = args.includes("--curl");
const TIMEOUT = args.includes("--timeout")
  ? parseInt(args[args.indexOf("--timeout") + 1], 10)
  : 15000;
const UA =
  "Mozilla/5.0 (compatible; qurandiscourses-linkcheck; +https://qurandiscourse.netlify.app)";

// Node's fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY=1 (the
// bundled EnvHttpProxyAgent). Re-exec once with it set so proxied
// environments work without npm dependencies.
if (
  !USE_CURL &&
  (process.env.HTTPS_PROXY || process.env.https_proxy) &&
  !process.env.NODE_USE_ENV_PROXY
) {
  const env = { ...process.env, NODE_USE_ENV_PROXY: "1" };
  if (!env.NODE_EXTRA_CA_CERTS && existsSync("/root/.ccr/ca-bundle.crt")) {
    env.NODE_EXTRA_CA_CERTS = "/root/.ccr/ca-bundle.crt";
  }
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), ...args], {
    env,
    stdio: "inherit",
  });
  process.exit(r.status === null ? 2 : r.status);
}

// ── Collect URLs ────────────────────────────────────────────────────
const referencedBy = new Map(); // url -> Set(files)
function addUrl(url, file) {
  if (!referencedBy.has(url)) referencedBy.set(url, new Set());
  referencedBy.get(url).add(file);
}

const sources =
  JSON.parse(readFileSync(join(ROOT, "data", "sources.json"), "utf8")).sources ||
  [];
for (const s of sources) {
  if (s && typeof s.url === "string" && /^https?:\/\//.test(s.url)) {
    addUrl(s.url, `sources.json#${s.id}`);
  }
}

const SELF_ORIGIN = "https://qurandiscourse.netlify.app";
const pages = readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort();
for (const f of pages) {
  const html = readFileSync(join(ROOT, f), "utf8");
  for (const m of html.matchAll(/href="(https?:\/\/[^"]+)"/g)) {
    // Skip hrefs assembled by page scripts (template literals matched
    // inside inline <script> code) and the site's own canonical/OG
    // self-references — neither is an external citation.
    if (m[1].includes("${") || m[1].startsWith(SELF_ORIGIN)) continue;
    addUrl(m[1], f);
  }
}

const urls = [...referencedBy.keys()].sort();
if (!urls.length) {
  console.error("check-source-links: FAIL — no external URLs found (parser broken?)");
  process.exit(2);
}

// sources.json → sources.html integrity (warning-level): every cited
// source's URL should appear in the bibliography page.
const sourcesHtml = readFileSync(join(ROOT, "sources.html"), "utf8");
const bibliographyGaps = sources
  .filter((s) => s && s.url && !sourcesHtml.includes(s.url))
  .map((s) => `${s.id} (${s.url})`);

// ── Probe ───────────────────────────────────────────────────────────
function verdictOf(status) {
  if (status >= 200 && status < 400) return "OK";
  if ([401, 403, 405, 429].includes(status)) return "WARN";
  return "FAIL";
}

async function probeFetch(url) {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: { "User-Agent": UA, Accept: "*/*" },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  res.body?.cancel();
  return { status: res.status, finalUrl: res.url };
}

async function probeCurl(url) {
  const r = spawnSync(
    "curl",
    [
      "-sS", "-o", "/dev/null", "-L", "--max-time", String(Math.ceil(TIMEOUT / 1000)),
      "-A", UA, "-w", "%{http_code} %{url_effective}", url,
    ],
    { encoding: "utf8" },
  );
  const m = (r.stdout || "").match(/^(\d{3}) (.*)$/);
  if (!m || m[1] === "000") throw new Error((r.stderr || "curl failed").trim());
  return { status: parseInt(m[1], 10), finalUrl: m[2] };
}

const probe = USE_CURL ? probeCurl : probeFetch;

async function check(url) {
  for (let attempt = 0; ; attempt++) {
    try {
      const { status, finalUrl } = await probe(url);
      if (status >= 500 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      return { url, status, finalUrl, verdict: verdictOf(status) };
    } catch (e) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      return { url, status: 0, finalUrl: url, verdict: "FAIL", error: String(e.cause?.message || e.message) };
    }
  }
}

// Concurrency 4, one in flight per host (politeness).
const byHost = new Map();
for (const url of urls) {
  const host = new URL(url).host;
  if (!byHost.has(host)) byHost.set(host, []);
  byHost.get(host).push(url);
}
const hostQueues = [...byHost.values()];
const results = [];
async function worker() {
  while (hostQueues.length) {
    const queue = hostQueues.shift();
    for (const url of queue) results.push(await check(url));
  }
}
await Promise.all(Array.from({ length: Math.min(4, hostQueues.length) }, worker));
results.sort((a, b) => a.url.localeCompare(b.url));

// ── Report ──────────────────────────────────────────────────────────
for (const r of results) {
  const refs = [...referencedBy.get(r.url)].sort().join(", ");
  const status = r.status || "ERR";
  const note =
    r.error ? ` (${r.error})`
    : r.verdict === "WARN" ? " (likely bot-shielding — check manually)"
    : r.finalUrl && r.finalUrl.replace(/\/$/, "") !== r.url.replace(/\/$/, "")
      ? ` → ${r.finalUrl}`
      : "";
  console.log(`${String(status).padStart(4)} ${r.verdict.padEnd(4)} ${r.url}${note}`);
  console.log(`            referenced by: ${refs}`);
}
for (const gap of bibliographyGaps) {
  console.log(`WARN sources.json url missing from sources.html: ${gap}`);
}

const fails = results.filter((r) => r.verdict === "FAIL");
const warns = results.filter((r) => r.verdict === "WARN");
console.log(
  `\ncheck-source-links: ${urls.length} URLs — ${results.length - fails.length - warns.length} OK, ${warns.length} WARN, ${fails.length} FAIL` +
    (bibliographyGaps.length ? `, ${bibliographyGaps.length} bibliography gap(s)` : ""),
);
if (fails.length || (STRICT && (warns.length || bibliographyGaps.length))) {
  process.exit(1);
}
console.log("check-source-links: OK");
