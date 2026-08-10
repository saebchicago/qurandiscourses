// build-works.mjs — renders the Works page's bibliography from
// data/provenance/sources.json into the GENERATED:works region of
// works.html.
//
//   node scripts/build-works.mjs            rewrite the region
//   node scripts/build-works.mjs --check    fail if the region is stale
//
// WHY BUILD TIME RATHER THAN A RUNTIME FETCH. Both patterns exist in
// this repo. A bibliography is the wrong place for the fetch pattern:
// the records never change between deploys, and a reader with
// JavaScript off would get an empty page where the site's most basic
// scholarly record should be. Generating into a marker region is the
// same shape as build-static-fallbacks.mjs and build-sw-manifest.mjs,
// keeps the page readable with no JS at all, and still means nothing is
// hardcoded: change a title in the JSON, re-run, and the page changes.
//
// Two strings are load-bearing and deliberate. A null `pages` renders
// "not recorded" and a null `isbn` renders "unresolved" — not an
// em-dash, not a blank cell. Two of the three books have no resolvable
// ISBN, and the page says so in words rather than leaving a gap a
// reader could mistake for an oversight.
//
// `notes` is emitted byte-for-byte, escaped for HTML but not reflowed,
// re-punctuated or summarized.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = join(ROOT, "works.html");
const OPEN = "<!-- GENERATED:works (scripts/build-works.mjs) — do not edit;\n           regenerate with: node scripts/build-works.mjs -->";
const CLOSE = "<!-- /GENERATED:works -->";
const CHECK = process.argv.includes("--check");

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const sources = JSON.parse(
  readFileSync(join(ROOT, "data/provenance/sources.json"), "utf8"),
);

// khan-text only, oldest first. The class filter is the selection rule:
// this page is Dr. Khan's own published books, not everything about him.
const books = sources
  .filter((s) => s.class === "khan-text")
  .sort((a, b) => (a.year || 0) - (b.year || 0));

if (!books.length) {
  console.error("build-works: FAIL — no khan-text sources found.");
  process.exit(1);
}

const STATUS_LABEL = { verified: "Verified", nuanced: "Nuanced", pending: "Pending" };

const entries = books
  .map((b) => {
    const imprint = [b.container, b.year].filter(Boolean).map(esc).join(", ");
    const pages = b.pages === null ? "not recorded" : esc(b.pages);
    const isbn = b.isbn === null ? "unresolved" : esc(b.isbn);
    const notes = b.notes
      ? `
          <details class="method-detail">
            <summary>Record notes</summary>
            <p>${esc(b.notes)}</p>
          </details>`
      : "";
    return `
        <li class="work" id="work-${esc(b.id)}">
          <h3 class="work-title">${esc(b.title)}</h3>
          <p class="work-imprint">${esc(b.author)}${imprint ? " · " + imprint : ""}</p>
          <dl class="work-fields">
            <dt>Pages</dt><dd>${pages}</dd>
            <dt>ISBN</dt><dd>${isbn}</dd>
            <dt>Record status</dt><dd>${esc(STATUS_LABEL[b.status] || b.status)}</dd>
          </dl>${notes}
        </li>`;
  })
  .join("\n");

const block = `${OPEN}
      <ol class="works-list">${entries}
      </ol>
      ${CLOSE}`;

const html = readFileSync(PAGE, "utf8");
const start = html.indexOf(OPEN);
const end = html.indexOf(CLOSE);
if (start === -1 || end === -1) {
  console.error("build-works: FAIL — GENERATED:works markers not found in works.html.");
  process.exit(1);
}
const updated = html.slice(0, start) + block + html.slice(end + CLOSE.length);

if (CHECK) {
  if (updated !== html) {
    console.error(
      "build-works --check: FAIL — works.html is stale.\n" +
        "  Run: node scripts/build-works.mjs",
    );
    process.exit(1);
  }
  console.log(`build-works --check: OK (${books.length} books current).`);
} else {
  writeFileSync(PAGE, updated);
  console.log(
    `build-works: ${books.length} books written ` +
      `(${books.filter((b) => b.isbn === null).length} with an unresolved ISBN).`,
  );
}
