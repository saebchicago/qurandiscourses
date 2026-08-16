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
// check by hand) · no response before the deadline SLOW · 404/410,
// persistent 5xx, DNS/connection failure FAIL.
//
// SLOW is deliberately not FAIL. A host that answers slowly is not link
// rot, and reporting it as rot teaches maintainers to ignore the
// checker: ghamidi.org timed out in 2 of 6 observed runs while the same
// URL passed minutes either side. --strict still fails on SLOW.
//
// Exit 0 = no FAILs · 1 = FAILs (or WARN/SLOW with --strict) · 2 = harness.
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
  "Mozilla/5.0 (compatible; qurandiscourses-linkcheck; +https://divinediscourses.org)";

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

const SELF_ORIGIN = "https://divinediscourses.org";
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

async function probeFetch(url, budget) {
  const res = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: { "User-Agent": UA, Accept: "*/*" },
    signal: AbortSignal.timeout(budget),
  });
  res.body?.cancel();
  return { status: res.status, finalUrl: res.url };
}

async function probeCurl(url, budget) {
  const r = spawnSync(
    "curl",
    [
      "-sS", "-o", "/dev/null", "-L", "--max-time", String(Math.ceil(budget / 1000)),
      "-A", UA, "-w", "%{http_code} %{url_effective}", url,
    ],
    { encoding: "utf8" },
  );
  const m = (r.stdout || "").match(/^(\d{3}) (.*)$/);
  if (!m || m[1] === "000") {
    const err = new Error((r.stderr || "curl failed").trim());
    // curl exit 28 is "operation timed out". Tag it so check() can tell
    // a slow host from a refused connection, which curl reports as 7.
    if (r.status === 28) err.qdTimeout = true;
    throw err;
  }
  return { status: parseInt(m[1], 10), finalUrl: m[2] };
}

const probe = USE_CURL ? probeCurl : probeFetch;

// Node's fetch surfaces an AbortSignal.timeout as a TimeoutError, but
// undici wraps it, so walk the cause chain. Depth-capped because a cause
// chain is not guaranteed acyclic.
//
// Deliberately NOT matching AbortError: undici reuses that name for a
// refused proxy tunnel ("Proxy response (403) !== 200 when HTTP
// Tunneling"), which arrives in a few hundred milliseconds and is a real
// failure, not slowness. Matching it labelled every proxy-blocked host
// SLOW in testing — the opposite of the honesty this change is for.
function isTimeout(e) {
  for (let x = e, depth = 0; x && depth < 8; x = x.cause, depth++) {
    if (x.qdTimeout || x.name === "TimeoutError") return true;
  }
  return false;
}

async function check(url) {
  let timedOut = null;
  for (let attempt = 0; ; attempt++) {
    // The retry gets double the budget rather than a second identical
    // too-short window. Repeating the same deadline against a slow host
    // just buys the same answer twice.
    const budget = attempt === 0 ? TIMEOUT : TIMEOUT * 2;
    const started = Date.now();
    try {
      const { status, finalUrl } = await probe(url, budget);
      if (status >= 500 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      return { url, status, finalUrl, verdict: verdictOf(status) };
    } catch (e) {
      // Only the final attempt decides the verdict: a first-try timeout
      // followed by a genuine connection refusal is a refusal.
      // Second gate, on the clock rather than the error name: a failure
      // that arrives well inside the budget did not run out of time,
      // whatever it calls itself. Without this the reported message
      // ("no response within 30000 ms (gave up after 329 ms)") would
      // contradict itself, which is how the AbortError mismatch above
      // was caught.
      const elapsed = Date.now() - started;
      timedOut = isTimeout(e) && elapsed >= budget * 0.9 ? { budget, elapsed } : null;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      if (timedOut) {
        return {
          url,
          status: 0,
          finalUrl: url,
          verdict: "SLOW",
          error: `no response within ${timedOut.budget} ms (gave up after ${timedOut.elapsed} ms)`,
        };
      }
      return { url, status: 0, finalUrl: url, verdict: "FAIL", error: String(e.cause?.message || e.message) };
    }
  }
}

// Concurrency 4, one in flight per host (politeness). A single
// malformed URL must not crash the whole run — group unparsable ones
// under a synthetic bucket so they still surface as a FAIL each.
const byHost = new Map();
for (const url of urls) {
  let host;
  try {
    host = new URL(url).host;
  } catch (e) {
    host = "(unparsable)";
  }
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
const slows = results.filter((r) => r.verdict === "SLOW");
const ok = results.length - fails.length - warns.length - slows.length;
console.log(
  `\ncheck-source-links: ${urls.length} URLs — ${ok} OK, ${warns.length} WARN, ${slows.length} SLOW, ${fails.length} FAIL` +
    (bibliographyGaps.length ? `, ${bibliographyGaps.length} bibliography gap(s)` : ""),
);
if (fails.length || (STRICT && (warns.length || slows.length || bibliographyGaps.length))) {
  process.exit(1);
}
console.log("check-source-links: OK");
