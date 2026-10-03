// review-credit.mjs : reviewer credit and the public corrections log.
//
// Two committed registries, both shipped as empty arrays:
//   data/reviewers.json    { name, credentials, affiliation|null, scope,
//                            review_date, consent_to_name: true, sameAs[] }
//   data/corrections.json  { date, page, summary, source, reported_by_credit|null }
//
// While reviewers.json is empty nothing is rendered and no schema is
// emitted: every function here returns "" or [] / undefined, so a page's
// bytes do not change. A reviewer entry is a named person, so an entry
// without consent_to_name === true is rejected outright rather than
// skipped. `scope` is a clean path ("/surah/1"), a prefix ending in "*"
// ("/surah/*"), or an array of those.
//
// The same helpers serve the root pages (build-review-pages.mjs,
// build-jsonld.mjs) and the generated families (lib/page-shell.mjs), so
// the two cannot disagree.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const REVIEWED_OPEN = "<!-- reviewed-by (build-review-pages.mjs) -->";
export const REVIEWED_CLOSE = "<!-- /reviewed-by -->";

const esc = (v) =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function loadJson(rel) {
  return JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
}

const isStr = (v) => typeof v === "string" && v.trim() !== "";
const isDate = (v) => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function validateReviewers(list) {
  if (!Array.isArray(list)) throw new Error("data/reviewers.json must be an array");
  list.forEach((r, i) => {
    const at = `data/reviewers.json[${i}]`;
    for (const k of ["name", "credentials"]) if (!isStr(r[k])) throw new Error(`${at}.${k} is required`);
    if (r.affiliation !== null && !isStr(r.affiliation)) throw new Error(`${at}.affiliation must be a string or null`);
    const scopes = Array.isArray(r.scope) ? r.scope : [r.scope];
    if (!scopes.length || !scopes.every((s) => isStr(s) && s.startsWith("/"))) {
      throw new Error(`${at}.scope must be a clean path, a "/prefix*", or an array of those`);
    }
    if (!isDate(r.review_date)) throw new Error(`${at}.review_date must be YYYY-MM-DD`);
    if (r.consent_to_name !== true) throw new Error(`${at}.consent_to_name must be true: no consent, no named credit`);
    if (!Array.isArray(r.sameAs) || !r.sameAs.every((u) => /^https:\/\//.test(u))) {
      throw new Error(`${at}.sameAs must be an array of https URLs`);
    }
  });
  return list;
}

export function validateCorrections(list) {
  if (!Array.isArray(list)) throw new Error("data/corrections.json must be an array");
  list.forEach((c, i) => {
    const at = `data/corrections.json[${i}]`;
    if (!isDate(c.date)) throw new Error(`${at}.date must be YYYY-MM-DD`);
    for (const k of ["page", "summary", "source"]) if (!isStr(c[k])) throw new Error(`${at}.${k} is required`);
    if (c.reported_by_credit !== null && !isStr(c.reported_by_credit)) {
      throw new Error(`${at}.reported_by_credit must be a string or null`);
    }
  });
  return list;
}

export const loadReviewers = () => validateReviewers(loadJson("data/reviewers.json"));
export const loadCorrections = () => validateCorrections(loadJson("data/corrections.json"));

// Reviewers whose scope covers a clean path such as "/surah/1".
export function reviewersFor(reviewers, path) {
  return reviewers.filter((r) =>
    (Array.isArray(r.scope) ? r.scope : [r.scope]).some((s) =>
      s.endsWith("*") ? path.startsWith(s.slice(0, -1)) : s === path,
    ),
  );
}

// The visible "Reviewed by" line. Empty string when nobody is in scope.
export function renderReviewedBy(reviewers) {
  if (!reviewers.length) return "";
  const items = reviewers.map((r) => {
    const detail = [r.credentials, r.affiliation].filter(Boolean).join(", ");
    return `${esc(r.name)} (${esc(detail)}), ${esc(r.review_date)}`;
  });
  return (
    `${REVIEWED_OPEN}\n` +
    `        <p class="reviewed-by t-annotation">Reviewed by ${items.join("; ")}. ` +
    `Credit does not imply endorsement. <a href="/review#independence">About reviews</a></p>\n` +
    `        ${REVIEWED_CLOSE}`
  );
}

// schema.org contributor Person nodes. Empty array when nobody is in scope.
export function contributorNodes(reviewers) {
  return reviewers.map((r) => ({
    "@type": "Person",
    name: r.name,
    jobTitle: r.credentials,
    ...(r.affiliation ? { affiliation: { "@type": "Organization", name: r.affiliation } } : {}),
    ...(r.sameAs.length ? { sameAs: r.sameAs } : {}),
  }));
}

// Adds `contributor` to a WebPage node only when there is something to add.
export function withContributors(webPage, reviewers) {
  const nodes = contributorNodes(reviewers);
  return nodes.length ? { ...webPage, contributor: nodes } : webPage;
}

// Insert (or strip) the reviewed-by block just before </main>.
export function applyReviewedBy(html, block) {
  const re = new RegExp(`\\s*${REVIEWED_OPEN.replace(/[()]/g, "\\$&")}[\\s\\S]*?${REVIEWED_CLOSE}`);
  const stripped = html.replace(re, "");
  if (!block) return stripped;
  return stripped.replace(/(\s*)<\/main>/, `\n        ${block}$1</main>`);
}

export function renderCorrectionsList(corrections) {
  if (!corrections.length) {
    return `<p class="corrections-empty">No corrections published yet. Report an issue on any page and we'll log every change here with the date and what changed.</p>`;
  }
  const rows = [...corrections]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((c) => {
      const credit = c.reported_by_credit ? `<br /><span class="t-annotation">Reported by ${esc(c.reported_by_credit)}</span>` : "";
      return (
        `<li class="correction"><time datetime="${esc(c.date)}">${esc(c.date)}</time> ` +
        `<a href="${esc(c.page)}">${esc(c.page)}</a>: ${esc(c.summary)}` +
        `<br /><span class="t-annotation">Source: ${esc(c.source)}</span>${credit}</li>`
      );
    })
    .join("\n          ");
  return `<ul class="corrections-list">\n          ${rows}\n        </ul>`;
}
