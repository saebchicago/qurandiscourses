import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseTanzil, hashText, checkBundledText, main, fetchFailureDetail } from "./build-quran-text.mjs";

const inventory = JSON.parse(readFileSync(new URL("../data/quran-text/index.json", import.meta.url))).surahs;
function fixture() {
  // Synthetic placeholders with the reviewed verse numbering, never published.
  const lines = inventory.flatMap((surah) => Array.from(
    { length: surah.numberOfAyahs }, (_, i) => `${surah.number}|${i + 1}|آيةۛ`,
  ));
  const raw = lines.join("\n") + "\n# Synthetic test notice\n";
  const tz = parseTanzil(raw);
  return { raw, tz, prior: { surahs: inventory, sha256: hashText(tz) } };
}

test("check mode validates Tanzil without calling the metadata service or writing text", async () => {
  const { raw, prior } = fixture();
  const out = mkdtempSync(join(tmpdir(), "quran-check-"));
  const before = JSON.stringify(prior);
  writeFileSync(join(out, "index.json"), before);
  const calls = [];
  try {
    await main({ check: true, out, fetchData: async (url, as) => {
      calls.push({ url, as });
      assert.match(url, /^https:\/\/tanzil\.net\//);
      assert.equal(as, "text");
      return raw;
    } });
    assert.equal(calls.length, 1);
    assert.deepEqual(readdirSync(out), ["index.json"]);
    assert.equal(readFileSync(join(out, "index.json"), "utf8"), before);
  } finally { rmSync(out, { recursive: true }); }
});

test("byte-level text and copyright notice changes still fail", () => {
  const { tz, prior } = fixture();
  tz.verses.set("2:2", "آية");
  assert.throws(() => checkBundledText(tz, prior), /file changed/);
  const fresh = fixture();
  fresh.tz.notice.push("# Changed notice");
  assert.throws(() => checkBundledText(fresh.tz, fresh.prior), /file changed/);
});

test("missing or extra verse references fail before a hash can bless them", () => {
  const { tz, prior } = fixture();
  tz.verses.delete("2:2");
  tz.verses.set("999:1", "آيةۛ");
  const matchingHash = { ...prior, sha256: hashText(tz) };
  assert.throws(() => checkBundledText(tz, matchingHash), /numbering differs/);
  const extra = fixture();
  extra.tz.verses.set("999:1", "آيةۛ");
  assert.throws(() => checkBundledText(extra.tz, { ...extra.prior, sha256: hashText(extra.tz) }), /verse count/);
});

test("missing or invalid committed inventory fails closed", () => {
  const { tz, prior } = fixture();
  assert.throws(() => checkBundledText(tz, null), /not been built/);
  assert.throws(() => checkBundledText(tz, { ...prior, surahs: [] }), /inventory/);
  assert.throws(() => checkBundledText(tz, {
    ...prior, surahs: prior.surahs.map((s, i) => i === 0 ? { ...s, number: 0 } : s),
  }), /numbering/);
});

test("duplicate upstream references cannot silently overwrite earlier text", () => {
  assert.throws(() => parseTanzil("1|1|one\n1|1|two\n"), /duplicate Tanzil verse/);
});

test("network causes are visible and cyclic error causes do not hang", () => {
  const cause = Object.assign(new Error("connect timed out"), { code: "UND_ERR_CONNECT_TIMEOUT" });
  const error = new TypeError("fetch failed", { cause });
  assert.match(fetchFailureDetail(error), /UND_ERR_CONNECT_TIMEOUT: connect timed out/);
  cause.cause = error;
  assert.equal(fetchFailureDetail(error).split(" <- ").length, 2);
});
