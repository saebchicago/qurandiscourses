// review-credit.test.mjs : reviewer credit renders nothing until a
// reviewer has consented to be named.
//
//   node --test scripts/review-credit.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyReviewedBy,
  contributorNodes,
  loadReviewers,
  renderCorrectionsList,
  renderReviewedBy,
  reviewersFor,
  validateReviewers,
  withContributors,
} from "./lib/review-credit.mjs";
import { renderPage } from "./lib/page-shell.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLE = {
  name: "Test Reviewer",
  credentials: "Test credentials",
  affiliation: null,
  scope: "/surah/*",
  review_date: "2026-01-01",
  consent_to_name: true,
  sameAs: [],
};

test("shipped data/reviewers.json is an empty array", () => {
  assert.deepEqual(loadReviewers(), []);
});

test("empty reviewers render no UI and no schema", () => {
  const none = reviewersFor([], "/surah/1");
  assert.deepEqual(none, []);
  assert.equal(renderReviewedBy(none), "");
  assert.deepEqual(contributorNodes(none), []);
  const page = { "@type": "WebPage", name: "x" };
  assert.equal(withContributors(page, none), page);
  assert.equal(applyReviewedBy("<main>a</main>", ""), "<main>a</main>");
});

test("a generated page is identical with and without the (empty) registry", () => {
  const html = renderPage({
    title: "t",
    description: "d",
    url: "https://divinediscourses.org/surah/1",
    og: "https://divinediscourses.org/assets/og/site-og.png",
    jsonld: { "@context": "https://schema.org", "@graph": [{ "@type": "WebPage", name: "t" }] },
    main: "<p>x</p>",
    mainClass: "c",
  });
  assert.ok(!html.includes("reviewed-by"));
  assert.ok(!html.includes("contributor"));
});

test("no built page carries reviewer UI or schema while the registry is empty", () => {
  const files = [
    ...readdirSync(ROOT).filter((f) => f.endsWith(".html")),
    ...["surah", "juz", "root"].flatMap((d) => readdirSync(join(ROOT, d)).map((f) => `${d}/${f}`)),
  ];
  for (const f of files) {
    const html = readFileSync(join(ROOT, f), "utf8");
    assert.ok(!html.includes("reviewed-by (build-review-pages"), `${f} has a reviewed-by block`);
    assert.ok(!html.includes('"contributor"'), `${f} has contributor schema`);
  }
});

test("a consenting, in-scope reviewer renders a line and a contributor Person", () => {
  const list = validateReviewers([SAMPLE]);
  assert.equal(reviewersFor(list, "/surah/1").length, 1);
  assert.equal(reviewersFor(list, "/juz/1").length, 0);
  assert.match(renderReviewedBy(list), /Reviewed by Test Reviewer/);
  const [p] = contributorNodes(list);
  assert.equal(p["@type"], "Person");
  assert.equal(p.name, "Test Reviewer");
  const html = applyReviewedBy("<main>\n  x\n</main>", renderReviewedBy(list));
  assert.match(html, /reviewed-by/);
  assert.equal(applyReviewedBy(html, ""), "<main>\n  x\n</main>");
});

test("a reviewer without consent_to_name is rejected, not skipped", () => {
  assert.throws(() => validateReviewers([{ ...SAMPLE, consent_to_name: false }]), /consent_to_name/);
  assert.throws(() => validateReviewers([{ ...SAMPLE, consent_to_name: undefined }]), /consent_to_name/);
});

test("corrections: empty state text, then entries newest first", () => {
  assert.match(
    renderCorrectionsList([]),
    /No corrections published yet\. Report an issue on any page and we'll log every change here with the date and what changed\./,
  );
  const out = renderCorrectionsList([
    { date: "2026-01-01", page: "/a", summary: "old", source: "s", reported_by_credit: null },
    { date: "2026-02-01", page: "/b", summary: "new", source: "s", reported_by_credit: "Named Person" },
  ]);
  assert.ok(out.indexOf("new") < out.indexOf("old"));
  assert.match(out, /Reported by Named Person/);
});
