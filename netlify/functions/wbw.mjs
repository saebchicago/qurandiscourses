// wbw.mjs — server-side proxy for Quran Foundation's word-by-word data.
//
// WHY. Quran Foundation's Content API (Quran.com's successor to the
// unauthenticated api.quran.com/api/v4 route) takes OAuth2
// client-credentials: a client id and secret are exchanged for a one-hour
// access token, and every request carries x-auth-token and x-client-id.
// A static page cannot hold a secret, so the browser calls this same-origin
// function and the credentials stay in Netlify environment variables.
//
// CONFIGURATION (Netlify environment variables; never in the repository):
//   QF_CLIENT_ID, QF_CLIENT_SECRET   issued by Quran Foundation (request access)
//   QF_OAUTH_TOKEN_URL               token endpoint of the chosen environment
//   QF_CONTENT_BASE_URL              Content API base of the SAME environment
// Tokens are environment-specific (prelive vs production), so the token and
// content hosts are both required, never defaulted: a mismatch authenticates
// and then 401s. With any of the four missing the function answers 503
// {"error":"not_configured"} and the page falls back (assets/wordbw.js).
//
// NOT GUESSED: neither URL has a default, because the official docs
// could not be read from the session that wrote this. Take it from
// https://api-docs.quran.foundation/docs/quickstart and confirm on prelive.
//
// SCOPE. One read-only request shape: verses by chapter, English, word
// fields. The reply is reduced to the fields the page uses; anything that
// does not match the expected shape is a 502, never passed through.
// Caching: the terms cap Quran Foundation content at one week; replies are
// marked cacheable for one hour.

const PER_PAGE = 50;
const TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 3;
const MAX_RETRY_WAIT_MS = 4000;
const VERSE_KEY = /^\d{1,3}:\d{1,3}$/;

let tokenCache = null; // { token, expires }

const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra },
  });

export function parseQuery(url) {
  const q = new URL(url).searchParams;
  const chapter = Number(q.get("chapter"));
  const page = Number(q.get("page") || 1);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 114) return null;
  if (!Number.isInteger(page) || page < 1 || page > 20) return null;
  return { chapter, page };
}

// Keeps only what assets/wordbw.js and vocabulary.js read. Returns null
// when the payload is not the expected shape.
export function validatePayload(raw) {
  if (!raw || !Array.isArray(raw.verses) || !raw.verses.length) return null;
  const verses = [];
  for (const v of raw.verses) {
    if (!v || typeof v.verse_key !== "string" || !VERSE_KEY.test(v.verse_key) || !Array.isArray(v.words)) return null;
    const words = [];
    for (const w of v.words) {
      if (!w || typeof w.char_type_name !== "string") return null;
      const text = w.text_uthmani == null ? "" : w.text_uthmani;
      const en = w.translation && w.translation.text;
      if (typeof text !== "string" || (en != null && typeof en !== "string")) return null;
      words.push({ char_type_name: w.char_type_name, text_uthmani: text, translation: { text: en || "" } });
    }
    verses.push({ verse_key: v.verse_key, words });
  }
  return { verses };
}

async function withRetry(doFetch, sleep) {
  let last;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await doFetch();
      if (res.status !== 429 && res.status < 500) return res;
      last = res;
      const ra = Number(res.headers.get("retry-after"));
      const wait = Math.min(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 500 * attempt, MAX_RETRY_WAIT_MS);
      if (attempt < MAX_ATTEMPTS) await sleep(wait);
    } catch (e) {
      last = e;
      if (attempt < MAX_ATTEMPTS) await sleep(500 * attempt);
    }
  }
  if (last instanceof Error) throw last;
  return last;
}

async function getToken(env, f, sleep, now) {
  if (tokenCache && tokenCache.expires - 60000 > now()) return tokenCache.token;
  const basic = Buffer.from(`${env.QF_CLIENT_ID}:${env.QF_CLIENT_SECRET}`).toString("base64");
  const res = await withRetry(
    () =>
      f(env.QF_OAUTH_TOKEN_URL, {
        method: "POST",
        headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials&scope=content",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
    sleep,
  );
  if (!res.ok) throw new Error(`token HTTP ${res.status}`);
  const body = await res.json();
  if (!body || typeof body.access_token !== "string" || !(body.expires_in > 0)) throw new Error("token response malformed");
  tokenCache = { token: body.access_token, expires: now() + body.expires_in * 1000 };
  return tokenCache.token;
}

export function resetTokenCache() {
  tokenCache = null;
}

export async function handle(req, { env = process.env, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now } = {}) {
  if (req.method !== "GET") return json(405, { error: "method_not_allowed" }, { allow: "GET" });
  const query = parseQuery(req.url);
  if (!query) return json(400, { error: "bad_request" });
  if (!env.QF_CLIENT_ID || !env.QF_CLIENT_SECRET || !env.QF_OAUTH_TOKEN_URL || !env.QF_CONTENT_BASE_URL)
    return json(503, { error: "not_configured" }, { "cache-control": "no-store" });
  const base = env.QF_CONTENT_BASE_URL.replace(/\/$/, "");
  const url = `${base}/verses/by_chapter/${query.chapter}?language=en&words=true&word_fields=text_uthmani&per_page=${PER_PAGE}&page=${query.page}`;
  try {
    const call = async () => {
      const token = await getToken(env, fetchImpl, sleep, now);
      return withRetry(
        () =>
          fetchImpl(url, {
            headers: { "x-auth-token": token, "x-client-id": env.QF_CLIENT_ID, accept: "application/json" },
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }),
        sleep,
      );
    };
    let res = await call();
    // A token revoked before its recorded expiry: drop it and retry once.
    if (res.status === 401 || res.status === 403) {
      resetTokenCache();
      res = await call();
    }
    if (!res.ok) return json(502, { error: "upstream_status", status: res.status }, { "cache-control": "no-store" });
    const payload = validatePayload(await res.json());
    if (!payload) return json(502, { error: "upstream_shape" }, { "cache-control": "no-store" });
    return json(200, payload, { "cache-control": "public, max-age=3600" });
  } catch (e) {
    // Never echo upstream text or credentials; the cause class is enough.
    return json(502, { error: "upstream_unreachable" }, { "cache-control": "no-store" });
  }
}

export default (req) => handle(req);
export const config = { path: "/api/wbw" };
