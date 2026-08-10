// validate-evidence.mjs — structural gate for the provenance registry.
//
//   node scripts/validate-evidence.mjs
//
// WHAT THIS GUARDS. data/provenance/sources.json and
// data/provenance/claims.json record what is known about Dr. Irfan Ahmad
// Khan's life and work, and how far each statement sits from his own
// words. The registry's value is entirely in its discipline: a claim
// with no source, a source id that resolves to nothing, or a filled-in
// field that was never actually seen would each turn a provenance
// record into an assertion. This exits non-zero on any of them.
//
// WHY A SEPARATE REGISTRY. data/sources.json and data/claims.json
// already exist and hold the site's computed-analysis apparatus (36
// sources, 22 claims, each bonded 1:1 to a worked example in
// data/case-studies.json by check-claims.mjs, and reachable from 176
// data-source-ids badges across 20 pages). That schema is built for
// reproducible computation: derivation, reproduction, limitations.
// Biographical and bibliographic claims about a person do not have a
// derivation and cannot carry a worked example, so they are kept in
// their own files under data/provenance/ with their own schema and
// their own validator. Neither registry reads the other.
//
// Precedent: check-claims.mjs does the same job for the computed
// registry; this is its sibling, not its replacement.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCES_PATH = "data/provenance/sources.json";
const CLAIMS_PATH = "data/provenance/claims.json";

const failures = [];
const fail = (file, id, rule) => failures.push({ file, id, rule });

function readJson(rel) {
  try {
    return JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
  } catch (e) {
    console.error(`validate-evidence: FAIL — ${rel} did not parse: ${e.message}`);
    process.exit(1);
  }
}

const sources = readJson(SOURCES_PATH);
const claims = readJson(CLAIMS_PATH);

if (!Array.isArray(sources)) {
  console.error(`validate-evidence: FAIL — ${SOURCES_PATH} must be an array.`);
  process.exit(1);
}
if (!Array.isArray(claims)) {
  console.error(`validate-evidence: FAIL — ${CLAIMS_PATH} must be an array.`);
  process.exit(1);
}

// ── Schema definitions ───────────────────────────────────────────────
const SOURCE_KEYS = [
  "id", "class", "provenance_distance", "author", "title", "container",
  "volume", "issue", "year", "pages", "isbn", "url", "url_status",
  "accessed", "status", "notes",
];
const CLAIM_KEYS = ["id", "statement", "kind", "status", "sources", "conflict", "quote"];
// Present on some claims, absent on others, governed by rule 11 below
// rather than by the blanket "every key must be present" of rule 2.
const OPTIONAL_CLAIM_KEYS = ["resolution_note"];

const CLASSES = [
  "khan-text", "khan-correspondence", "khan-recording", "azmat-scholarship",
  "third-party-scholarship", "press", "retail-catalog", "corpus",
];
const KINDS = ["biographical", "bibliographic", "institutional", "methodological", "structural"];
const STATUSES = ["verified", "nuanced", "pending"];
const URL_STATUSES = ["resolves", "unconfirmed", "paywalled"];

// ── Rule 1: duplicate ids, within each file ──────────────────────────
for (const [file, rows] of [[SOURCES_PATH, sources], [CLAIMS_PATH, claims]]) {
  const seen = new Set();
  for (const row of rows) {
    const id = row && row.id;
    if (seen.has(id)) fail(file, id, "rule 1: duplicate id");
    seen.add(id);
  }
}

const sourceIds = new Set(sources.map((s) => s && s.id));

// ── Rules 2-5, 10: source records ────────────────────────────────────
for (const s of sources) {
  const id = (s && s.id) || "(no id)";

  // rule 2: exact key set, no more and no less
  for (const k of SOURCE_KEYS) {
    if (!(k in s)) fail(SOURCES_PATH, id, `rule 2: missing key "${k}"`);
  }
  for (const k of Object.keys(s)) {
    if (!SOURCE_KEYS.includes(k)) fail(SOURCES_PATH, id, `rule 2: key "${k}" is not in the schema`);
  }

  // rule 3
  if (!CLASSES.includes(s.class)) {
    fail(SOURCES_PATH, id, `rule 3: class "${s.class}" is not one of ${CLASSES.join(", ")}`);
  }

  // rule 4
  if (!Number.isInteger(s.provenance_distance) || s.provenance_distance < 0 || s.provenance_distance > 3) {
    fail(SOURCES_PATH, id, `rule 4: provenance_distance ${JSON.stringify(s.provenance_distance)} is not an integer 0-3`);
  }

  // rule 5
  if (!STATUSES.includes(s.status)) {
    fail(SOURCES_PATH, id, `rule 5: status "${s.status}" is not one of ${STATUSES.join(", ")}`);
  }

  // rule 10
  if (s.url !== null && s.url !== undefined && s.url_status === null) {
    fail(SOURCES_PATH, id, "rule 10: url is set but url_status is null");
  }
  if (s.url_status !== null && !URL_STATUSES.includes(s.url_status)) {
    fail(SOURCES_PATH, id, `rule 10: url_status "${s.url_status}" is not one of ${URL_STATUSES.join(", ")}`);
  }
}

// ── Rules 2, 5-9: claim records ──────────────────────────────────────
for (const c of claims) {
  const id = (c && c.id) || "(no id)";

  for (const k of CLAIM_KEYS) {
    if (!(k in c)) fail(CLAIMS_PATH, id, `rule 2: missing key "${k}"`);
  }
  for (const k of Object.keys(c)) {
    if (!CLAIM_KEYS.includes(k) && !OPTIONAL_CLAIM_KEYS.includes(k)) {
      fail(CLAIMS_PATH, id, `rule 2: key "${k}" is not in the schema`);
    }
  }

  // rule 11: a pending claim must say what evidence would settle it, and
  // a claim that is NOT pending must not carry such a note. The second
  // half matters as much as the first: a resolution note on a verified
  // claim would imply the question is still open when it is not.
  const hasNote =
    typeof c.resolution_note === "string" && c.resolution_note.trim().length > 0;
  if (c.status === "pending" && !hasNote) {
    fail(CLAIMS_PATH, id, "rule 11: status \"pending\" with no resolution_note");
  }
  if (c.status !== "pending" && "resolution_note" in c) {
    fail(
      CLAIMS_PATH,
      id,
      `rule 11: status "${c.status}" carries a resolution_note, which belongs only on pending claims`,
    );
  }

  if (!KINDS.includes(c.kind)) {
    fail(CLAIMS_PATH, id, `rule 2: kind "${c.kind}" is not one of ${KINDS.join(", ")}`);
  }
  if (!STATUSES.includes(c.status)) {
    fail(CLAIMS_PATH, id, `rule 5: status "${c.status}" is not one of ${STATUSES.join(", ")}`);
  }

  // rule 6: a claim that asserts something must say who says it
  if (!Array.isArray(c.sources)) {
    fail(CLAIMS_PATH, id, "rule 6: sources must be an array");
  } else {
    if (c.status !== "pending" && c.sources.length === 0) {
      fail(CLAIMS_PATH, id, `rule 6: status "${c.status}" with an empty sources array`);
    }
    // rule 7
    for (const sid of c.sources) {
      if (!sourceIds.has(sid)) fail(CLAIMS_PATH, id, `rule 7: sources entry "${sid}" resolves to no source`);
    }
  }

  // rule 8
  if (c.quote !== null && c.quote !== undefined) {
    if (typeof c.quote.text !== "string" || !c.quote.text.length) {
      fail(CLAIMS_PATH, id, "rule 8: quote.text must be a non-empty string");
    }
    if (!sourceIds.has(c.quote.source)) {
      fail(CLAIMS_PATH, id, `rule 8: quote.source "${c.quote.source}" resolves to no source`);
    }
  }

  // rule 9. An empty sources array inside a conflict position is legal:
  // it denotes a position held by a source not yet registered, which is
  // exactly the kind of thing this registry exists to record honestly.
  if (c.conflict !== null && c.conflict !== undefined) {
    if (!Array.isArray(c.conflict.positions)) {
      fail(CLAIMS_PATH, id, "rule 9: conflict.positions must be an array");
    } else {
      for (const pos of c.conflict.positions) {
        if (!Array.isArray(pos.sources)) {
          fail(CLAIMS_PATH, id, `rule 9: conflict position "${pos.value}" has no sources array`);
          continue;
        }
        for (const sid of pos.sources) {
          if (!sourceIds.has(sid)) {
            fail(CLAIMS_PATH, id, `rule 9: conflict position "${pos.value}" cites "${sid}", which resolves to no source`);
          }
        }
      }
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────
if (failures.length) {
  console.error("validate-evidence: FAIL");
  for (const f of failures) console.error(`  ${f.file} → ${f.id}\n    ${f.rule}`);
  console.error(`\n  ${failures.length} problem(s).`);
  process.exit(1);
}

// Every figure below is counted from the files just read. None is
// carried from documentation or from a previous run.
const tally = (rows, key) => {
  const out = new Map();
  for (const r of rows) out.set(r[key], (out.get(r[key]) || 0) + 1);
  return [...out.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
};
const line = (pairs) => pairs.map(([k, n]) => `${k} ${n}`).join(", ");

const conflicted = claims.filter((c) => c.conflict !== null && c.conflict !== undefined);
const unresolved = conflicted.filter(
  (c) => c.conflict.resolution === null || c.conflict.resolution === "unresolved",
);
const pending = claims.filter((c) => c.status === "pending");
const quoted = claims.filter((c) => c.quote !== null && c.quote !== undefined);

console.log("validate-evidence: OK");
console.log(`  sources ${sources.length} — by class: ${line(tally(sources, "class"))}`);
console.log(`  sources by status: ${line(tally(sources, "status"))}`);
console.log(`  sources by provenance distance: ${line(tally(sources, "provenance_distance"))}`);
console.log(`  claims ${claims.length} — by kind: ${line(tally(claims, "kind"))}`);
console.log(`  claims by status: ${line(tally(claims, "status"))}`);
console.log(`  claims carrying a conflict: ${conflicted.length} (${unresolved.length} unresolved)`);
console.log(`  claims carrying a byte-frozen quote: ${quoted.length}`);
console.log(`  open questions (status pending): ${pending.length}`);
