// build-provenance.mjs — renders claim marks, source cards, distance
// ribbons and the page provenance summary into GENERATED:provenance
// marker regions.
//
//   node scripts/build-provenance.mjs            rewrite
//   node scripts/build-provenance.mjs --check    fail if stale
//
// WHY EVERYTHING IS RENDERED HERE. Two standing rules meet in this file.
// The first is that no browser script computes layout, so every SVG
// coordinate must already be a literal — they come from
// data/provenance/ribbons.json, which build-ribbons.mjs precomputes.
// The second is that all source information must be reachable with
// JavaScript disabled. Rendering the cards as real <details> at build
// time satisfies both at once and leaves assets/provenance.js with
// nothing to do but improve behaviour that already works: closing other
// cards, handling Escape, and keeping aria-expanded honest.
//
// The page summary counts are computed here, from the claims actually
// marked on the page. They are never written by hand, and changing a
// claim's status in the registry moves them.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const sources = JSON.parse(readFileSync(join(ROOT, "data/provenance/sources.json"), "utf8"));
const claims = JSON.parse(readFileSync(join(ROOT, "data/provenance/claims.json"), "utf8"));
const ribbonData = JSON.parse(readFileSync(join(ROOT, "data/provenance/ribbons.json"), "utf8"));
const byId = new Map(sources.map((s) => [s.id, s]));
const claimById = new Map(claims.map((c) => [c.id, c]));
const LABELS = ribbonData.labels;

// The open-questions register is generated wholly from the claim
// registry: adding a pending claim must make it appear here with no code
// change. Selection is by STATUS and by unresolved conflict, never by a
// hand-kept list, which is what makes that true.
//
// Ordering is by kind then id so two builds are byte-identical.
const byKindThenId = (a, b) =>
  a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind.localeCompare(b.kind);

const pendingClaims = claims.filter((c) => c.status === "pending").sort(byKindThenId);
const conflictedClaims = claims
  .filter(
    (c) =>
      c.conflict && (c.conflict.resolution === null || c.conflict.resolution === "unresolved"),
  )
  .sort(byKindThenId);

const STATUS_WORD = { verified: "Verified", nuanced: "Nuanced", pending: "Pending" };

// The line that stops "distance 2" being read as "less true". Stated
// under every ribbon, always visible, never inside a <details>.
const DISCLAIMER =
  "Distance describes how many steps separate this statement from Dr. Khan's own " +
  "words. It is a record of documentation, not an assessment of accuracy.";

// A reader-facing short label. Two sources have title: null on purpose
// (their byte-frozen titles need the PDF cover page), so falling back to
// the raw kebab-case id would put a database key in front of a reader.
// Fall back to the container and year, which are known.
function sourceLabel(s, id) {
  if (!s) return id;
  if (s.title) return s.title;
  const bits = [s.author, s.container, s.year].filter(Boolean);
  return bits.length ? bits.join(", ") : id;
}

function citation(s) {
  const bits = [];
  if (s.author) bits.push(esc(s.author));
  if (s.title) bits.push(`<cite>${esc(s.title)}</cite>`);
  if (s.container) bits.push(esc(s.container));
  if (s.volume) bits.push(`vol. ${esc(s.volume)}`);
  if (s.issue) bits.push(`no. ${esc(s.issue)}`);
  if (s.year) bits.push(esc(s.year));
  if (s.pages) bits.push(`pp. ${esc(s.pages)}`);
  let line = bits.join(", ");
  // A url is a link ONLY when it is known to resolve. An unconfirmed or
  // paywalled address is still worth recording, but presenting it as a
  // working link would assert something we have not checked.
  if (s.url) {
    line +=
      s.url_status === "resolves"
        ? ` — <a href="${esc(s.url)}">${esc(s.url)}</a>`
        : ` — ${esc(s.url)} (${esc(s.url_status || "unverified")})`;
  }
  return `${line} <span class="src-dist">distance ${s.provenance_distance}</span>`;
}

function ribbon(id) {
  const r = ribbonData.ribbons[id];
  const stops = r.stops
    .map(
      (s) =>
        `<circle cx="${s.x}" cy="${r.axisY}" r="${r.stopRadius}" class="rib-stop" />` +
        `<text x="${s.x}" y="${r.height - 6}" class="rib-num">${s.d}</text>`,
    )
    .join("");
  const span = r.span
    ? `<line x1="${r.span.x1}" y1="${r.axisY}" x2="${r.span.x2}" y2="${r.axisY}" class="rib-span" />`
    : "";
  const mark =
    r.marked === null
      ? ""
      : `<circle cx="${r.stops[r.marked].x}" cy="${r.axisY}" r="${r.markRadius}" class="rib-mark" />`;
  const rows = r.rows.length
    ? r.rows
        .map((row) => {
          const s = byId.get(row.id);
          return `<tr><td>${esc(sourceLabel(s, row.id))}</td><td>${row.distance}</td><td>${esc(LABELS[row.distance] || "")}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="3">No source recorded.</td></tr>`;

  return `
            <figure class="ribbon">
              <svg viewBox="0 0 ${r.width} ${r.height}" width="${r.width}" height="${r.height}"
                   role="img" aria-label="${esc(r.ariaLabel)}" focusable="false">
                <line x1="${r.stops[0].x}" y1="${r.axisY}" x2="${r.stops[3].x}" y2="${r.axisY}" class="rib-axis" />
                ${span}${stops}${mark}
              </svg>
              <figcaption class="ribbon-note">${esc(DISCLAIMER)}</figcaption>
              <details class="method-note ribbon-table">
                <summary>This ribbon as a table</summary>
                <table class="data">
                  <caption>${esc(r.ariaLabel)}</caption>
                  <thead><tr><th scope="col">Source</th><th scope="col">Distance</th><th scope="col">Meaning</th></tr></thead>
                  <tbody>${rows}</tbody>
                </table>
              </details>
            </figure>`;
}

function conflictBlock(c) {
  if (!c.conflict) return "";
  const rows = c.conflict.positions
    .map((p) => {
      const who = p.sources.length
        ? p.sources.map((id) => esc(sourceLabel(byId.get(id), id))).join("; ")
        : "no registered source";
      return `<li><strong>${esc(p.value)}</strong> — ${who}</li>`;
    })
    .join("");
  const res =
    c.conflict.resolution === null || c.conflict.resolution === "unresolved"
      ? "Unresolved."
      : esc(c.conflict.resolution);
  return `
            <div class="conflict">
              <h4>Sources differ</h4>
              <p class="conflict-field">Field: ${esc(c.conflict.field)}</p>
              <ul>${rows}</ul>
              <p class="conflict-res">${res}</p>
            </div>`;
}

function card(c) {
  const srcs = c.sources.length
    ? `<ul class="src-list">${c.sources
        .map((id) => `<li>${citation(byId.get(id) || { id, provenance_distance: "?" })}</li>`)
        .join("")}</ul>`
    : "";
  const pending =
    c.status === "pending"
      ? `<p class="pending-note">No source recorded. This statement is listed as an open question.</p>`
      : "";
  const quote = c.quote
    ? `<figure class="claim-quote"><blockquote>${esc(c.quote.text)}</blockquote>
              <figcaption>${esc(sourceLabel(byId.get(c.quote.source), c.quote.source))}${
                c.quote.locator ? ", " + esc(c.quote.locator) : ""
              }</figcaption></figure>`
    : "";
  return `
          <details class="claim-card" id="src-${esc(c.id)}">
            <summary>Where this comes from</summary>
            <p class="claim-statement">${esc(c.statement)}</p>
            <p class="claim-status">Status: ${esc(STATUS_WORD[c.status])}</p>${ribbon(c.id)}${srcs}${conflictBlock(c)}${quote}${pending}
          </details>`;
}

function mark(c) {
  return `<span class="claim is-${esc(c.status)}" data-claim="${esc(c.id)}"><span class="sr-only">${esc(
    STATUS_WORD[c.status],
  )} claim: </span>${esc(c.statement)}</span>`;
}

function summary(ids) {
  const cs = ids.map((id) => claimById.get(id));
  const by = (k) => {
    const m = new Map();
    for (const c of cs) m.set(c[k], (m.get(c[k]) || 0) + 1);
    return [...m.entries()].sort().map(([v, n]) => `${STATUS_WORD[v] || v} ${n}`).join(", ");
  };
  const lowest = cs.map((c) => ribbonData.ribbons[c.id].marked);
  const dist = [...new Set(lowest)]
    .sort((a, b) => (a === null ? 1 : b === null ? -1 : a - b))
    .map((d) => (d === null ? `none ${lowest.filter((x) => x === null).length}` : `${d} — ${lowest.filter((x) => x === d).length}`))
    .join(", ");
  const conflicted = cs.filter(
    (c) => c.conflict && (c.conflict.resolution === null || c.conflict.resolution === "unresolved"),
  ).length;
  const defs = [0, 1, 2, 3].map((d) => `<li><strong>${d}</strong> — ${esc(LABELS[d])}</li>`).join("");
  return `
        <section class="prov-summary" aria-labelledby="prov-summary-h">
          <h3 id="prov-summary-h">Provenance on this page</h3>
          <p>This page makes ${cs.length} statements drawn from the source registry.
            Counts are computed from the registry at build time.</p>
          <ul class="prov-counts">
            <li>By status: ${esc(by("status"))}</li>
            <li>By lowest provenance distance: ${esc(dist)}</li>
            <li>Carrying an unresolved conflict: ${conflicted}</li>
          </ul>
          <details class="method-note">
            <summary>How distance is assigned</summary>
            <ul>${defs}</ul>
            <p>${esc(DISCLAIMER)}</p>
          </details>
        </section>`;
}

function entry(c, extra) {
  return `
        <div class="claim-block">
          <p>${mark(c)}</p>${extra}${card(c)}
        </div>`;
}

const section1 = pendingClaims
  .map((c) =>
    entry(
      c,
      `
          <p class="pending-note">No source recorded.</p>
          <p class="resolution-note"><strong>What would settle it:</strong> ${esc(
            c.resolution_note,
          )}</p>`,
    ),
  )
  .join("\n");

const section2 = conflictedClaims.map((c) => entry(c, "")).join("\n");

const shown = [...pendingClaims, ...conflictedClaims];

const block = `${"<!-- GENERATED:provenance (scripts/build-provenance.mjs) — do not edit;\n           regenerate with: node scripts/build-provenance.mjs -->"}
      <section aria-labelledby="oq-untraced-h">
        <h3 id="oq-untraced-h">Untraced statements</h3>
        <p class="section-note">${pendingClaims.length} statements that could not be traced to a
          stated source. Untraced is not disproven; each is listed with the evidence
          that would settle it.</p>${section1}
      </section>

      <section aria-labelledby="oq-conflict-h">
        <h3 id="oq-conflict-h">Conflicting records</h3>
        <p class="section-note">${conflictedClaims.length} statements where the sources disagree
          and the disagreement is not resolved.</p>${section2}
      </section>
${summary(shown.map((c) => c.id))}
      <!-- /GENERATED:provenance -->`;

const PAGE = join(ROOT, "open-questions.html");
const html = readFileSync(PAGE, "utf8");
const OPEN = "<!-- GENERATED:provenance (scripts/build-provenance.mjs) — do not edit;\n           regenerate with: node scripts/build-provenance.mjs -->";
const CLOSE = "<!-- /GENERATED:provenance -->";
const start = html.indexOf(OPEN);
const end = html.indexOf(CLOSE);
if (start === -1 || end === -1) {
  console.error("build-provenance: FAIL — markers not found in open-questions.html.");
  process.exit(1);
}
const updated = html.slice(0, start) + block + html.slice(end + CLOSE.length);

if (CHECK) {
  if (updated !== html) {
    console.error(
      "build-provenance --check: FAIL — open-questions.html is stale.\n" +
        "  Run: node scripts/build-provenance.mjs",
    );
    process.exit(1);
  }
  console.log(
    `build-provenance --check: OK (${pendingClaims.length} untraced, ${conflictedClaims.length} conflicting).`,
  );
} else {
  writeFileSync(PAGE, updated);
  console.log(
    `build-provenance: ${pendingClaims.length} untraced + ${conflictedClaims.length} conflicting = ${shown.length} marks.`,
  );
}
