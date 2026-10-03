import test from "node:test";
import assert from "node:assert/strict";
import { handle, parseQuery, validatePayload, resetTokenCache } from "./wbw.mjs";

const ENV = { QF_CLIENT_ID: "id", QF_CLIENT_SECRET: "sekret", QF_OAUTH_TOKEN_URL: "https://auth.example/oauth2/token" };
const req = (q = "chapter=1&page=1", method = "GET") => new Request(`https://x.test/api/wbw?${q}`, { method });
const verse = { verse_key: "1:1", words: [{ char_type_name: "word", text_uthmani: "بِسْمِ", translation: { text: "In (the) name" }, extra: 1 }], id: 9 };
const ok = (b, h = {}) => new Response(JSON.stringify(b), { status: 200, headers: h });
const sleep = async () => {};
const router = (log, content) => async (url, init) => {
  log.push({ url: String(url), init });
  return String(url).includes("oauth2") ? ok({ access_token: "tok", expires_in: 3600 }) : content(url, init);
};

test("query bounds", () => {
  assert.deepEqual(parseQuery("https://x/api/wbw?chapter=114&page=2"), { chapter: 114, page: 2 });
  for (const q of ["chapter=0", "chapter=115", "chapter=1&page=0", "chapter=1&page=21", "chapter=a", "chapter=1.5", ""])
    assert.equal(parseQuery(`https://x/api/wbw?${q}`), null, q);
});

test("unconfigured answers 503 without calling out", async () => {
  let called = false;
  const r = await handle(req(), { env: {}, fetchImpl: async () => ((called = true), ok({})), sleep });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, "not_configured");
  assert.equal(called, false);
});

test("non-GET and bad query are refused", async () => {
  assert.equal((await handle(req("chapter=1", "POST"), { env: ENV, sleep })).status, 405);
  assert.equal((await handle(req("chapter=999"), { env: ENV, sleep })).status, 400);
});

test("sends the credentialed contract, reduces the payload, never leaks the secret", async () => {
  resetTokenCache();
  const log = [];
  const r = await handle(req("chapter=1&page=1"), { env: ENV, sleep, fetchImpl: router(log, () => ok({ verses: [verse] })) });
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.deepEqual(Object.keys(body.verses[0]), ["verse_key", "words"]);
  assert.deepEqual(Object.keys(body.verses[0].words[0]), ["char_type_name", "text_uthmani", "translation"]);
  const call = log.find((c) => !c.url.includes("oauth2"));
  assert.match(call.url, /^https:\/\/apis\.quran\.foundation\/content\/api\/v4\/verses\/by_chapter\/1\?language=en&words=true/);
  assert.equal(call.init.headers["x-auth-token"], "tok");
  assert.equal(call.init.headers["x-client-id"], "id");
  assert.ok(!JSON.stringify(body).includes("sekret"));
  assert.match(r.headers.get("cache-control"), /max-age=3600/);
});

test("token is reused until near expiry", async () => {
  resetTokenCache();
  const log = [];
  const f = router(log, () => ok({ verses: [verse] }));
  await handle(req(), { env: ENV, sleep, fetchImpl: f });
  await handle(req(), { env: ENV, sleep, fetchImpl: f });
  assert.equal(log.filter((c) => c.url.includes("oauth2")).length, 1);
});

test("retries 429 then succeeds; gives up after three attempts as 502", async () => {
  resetTokenCache();
  let n = 0;
  const flaky = router([], () => (++n < 3 ? new Response("", { status: 429, headers: { "retry-after": "1" } }) : ok({ verses: [verse] })));
  assert.equal((await handle(req(), { env: ENV, sleep, fetchImpl: flaky })).status, 200);
  assert.equal(n, 3);
  n = 0;
  const down = router([], () => (n++, new Response("", { status: 503 })));
  const r = await handle(req(), { env: ENV, sleep, fetchImpl: down });
  assert.equal(r.status, 502);
  assert.equal(n, 3);
});

test("schema drift is a 502, not passed through", async () => {
  resetTokenCache();
  for (const bad of [{}, { verses: [] }, { verses: [{ verse_key: "x", words: [] }] }, { verses: [{ verse_key: "1:1", words: [{}] }] }]) {
    const r = await handle(req(), { env: ENV, sleep, fetchImpl: router([], () => ok(bad)) });
    assert.equal(r.status, 502, JSON.stringify(bad));
    assert.equal((await r.json()).error, "upstream_shape");
  }
  assert.equal(validatePayload(null), null);
});

test("a rejected token is dropped so the next call re-authenticates", async () => {
  resetTokenCache();
  const log = [];
  const f = router(log, () => new Response("", { status: 401 }));
  assert.equal((await handle(req(), { env: ENV, sleep, fetchImpl: f })).status, 502);
  await handle(req(), { env: ENV, sleep, fetchImpl: f });
  assert.equal(log.filter((c) => c.url.includes("oauth2")).length, 2);
});
