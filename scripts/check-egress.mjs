// check-egress.mjs — can this machine reach the three third-party hosts
// the site depends on at runtime?
//
//   node scripts/check-egress.mjs            advisory: prints, exits 0
//   node scripts/check-egress.mjs --strict   exits 1 if any host fails
//
// WHY THIS EXISTS. Several of this repo's checkers say "needs real
// outbound network" and simply fail in a sandboxed session, where the
// failure looks identical to the third party being down. Agent sessions
// and locked-down laptops kept rediscovering that by hand, one confusing
// 403 at a time, and the answer ("these three hosts, and here is what
// each one is for") lived only in a chat transcript.
//
// Each host is probed at a path that carries a RECOGNISABLE payload, not
// at its root: a proxy denial and a service outage both answer a root
// request with a bare status code, so a status alone cannot tell them
// apart. A response whose shape matches is proof the host was reached;
// anything else is reported verbatim and left uninterpreted.
//
// A checker, not a generator: writes nothing.

// Node's built-in fetch ignores HTTPS_PROXY unless this is set (Node
// >= 22.21). Harmless where no proxy is configured.
process.env.NODE_USE_ENV_PROXY = "1";

const STRICT = process.argv.includes("--strict");
const TIMEOUT_MS = 20000;

const HOSTS = [
  {
    host: "api.alquran.cloud",
    why: "verse text and translations for every /read, /compare and /replay passage, and the whole-juz endpoint",
    url: "https://api.alquran.cloud/v1/surah/1/editions/quran-uthmani",
    ok: async (r) => {
      if (!r.ok) return `HTTP ${r.status}`;
      const j = await r.json();
      return j && j.code === 200 && j.data && j.data.ayahs && j.data.ayahs.length === 7
        ? true
        : "answered, but not the al-Fatihah shape the Read page parses";
    },
  },
  {
    host: "cdn.islamic.network",
    why: "the recitation audio Listen mode streams, one clip per verse",
    url: "https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3",
    ok: async (r) => {
      if (!r.ok) return `HTTP ${r.status}`;
      const type = r.headers.get("content-type") || "";
      const bytes = (await r.arrayBuffer()).byteLength;
      return /audio/i.test(type) && bytes > 1000
        ? true
        : `answered ${bytes} bytes of "${type}", not an audio clip`;
    },
  },
  {
    host: "everyayah.com",
    why: "not used at runtime; probed because /sources cites it as a separate recitation archive and its own terms page is the evidence for what that citation may claim",
    url: "https://everyayah.com/data/timings_files/000_disclaimer.txt",
    ok: async (r) => {
      if (!r.ok) return `HTTP ${r.status}`;
      const text = await r.text();
      return text.trim().length > 0 ? true : "answered empty";
    },
  },
];

let failed = 0;
for (const h of HOSTS) {
  let verdict;
  try {
    const res = await fetch(h.url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    verdict = await h.ok(res);
  } catch (e) {
    verdict = (e.cause ? String(e.cause) : e.message).slice(0, 120);
  }
  if (verdict === true) {
    console.log(`REACHABLE    ${h.host}`);
  } else {
    failed++;
    console.log(`UNREACHABLE  ${h.host} — ${verdict}`);
    console.log(`             needed for: ${h.why}`);
    console.log(`             probed: ${h.url}`);
  }
}

if (!failed) {
  console.log(`check-egress: OK (${HOSTS.length}/${HOSTS.length} hosts reachable)`);
  process.exit(0);
}

console.log(
  `\ncheck-egress: ${failed} of ${HOSTS.length} host(s) could not be reached.\n` +
    "This says nothing about WHY. On a sandboxed machine or an agent session\n" +
    "the usual cause is an egress policy that does not list these hosts; the\n" +
    "checkers that need them (check-editions, check-audio-editions,\n" +
    "check-juz-endpoint, check-source-links) cannot produce evidence here.\n" +
    "The Site audit workflow's external-evidence job runs them with open\n" +
    "egress, and its log is the record.",
);
process.exit(STRICT ? 1 : 0);
