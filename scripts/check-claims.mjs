// check-claims.mjs — integrity guard for the canonical worked-claim ledger.
// This does not decide whether a claim is true. It enforces that every worked
// example declares what kind of claim it is, which sources support it, what
// was reproduced, its limitations, and whether AI originated the content.

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readJson } from "./lib/io.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ledger = readJson("data/claims.json");
const caseStudies = readJson("data/case-studies.json").caseStudies || [];
const sourceIds = new Set((readJson("data/sources.json").sources || []).map((s) => s.id));
const failures = [];

const allowed = {
  claimType: new Set(["computed-statistic", "method-comparison", "scholarly-attribution", "transcription", "editorial-interpretation"]),
  sourceCheck: new Set(["unchecked", "locator-checked", "source-checked"]),
  reproduction: new Set(["not-applicable", "not-reproduced", "reproduced", "independently-reproduced"]),
  agreement: new Set(["corroborated", "source-dependent", "method-dependent", "classification-dependent", "contested"]),
  interpretation: new Set(["none", "attributed-scholarship", "editorial", "reader-hypothesis"]),
  aiInvolvement: new Set(["none", "research-discovery", "language-editing"]),
};

if (ledger.schemaVersion !== 1) failures.push("data/claims.json: unsupported or missing schemaVersion");
const claims = ledger.claims || [];
const byId = new Map();
for (const claim of claims) {
  const label = claim.id || "<missing id>";
  if (!claim.id || !/^claim\.[a-z0-9.-]+\.v\d+$/.test(claim.id)) failures.push(`${label}: invalid stable id`);
  if (byId.has(claim.id)) failures.push(`${label}: duplicate id`);
  byId.set(claim.id, claim);
  for (const [field, values] of Object.entries(allowed)) {
    if (!values.has(claim[field])) failures.push(`${label}: invalid or missing ${field}`);
  }
  if (!Array.isArray(claim.sourceIds) || !claim.sourceIds.length) failures.push(`${label}: sourceIds must be a non-empty array`);
  for (const id of claim.sourceIds || []) if (!sourceIds.has(id)) failures.push(`${label}: unknown source id ${id}`);
  if (!Array.isArray(claim.limitations) || !claim.limitations.length) failures.push(`${label}: at least one limitation is required`);
  const computed = ["computed-statistic", "method-comparison"].includes(claim.claimType);
  if (computed && claim.reproduction.includes("reproduced")) {
    if (!claim.derivation?.script || !claim.derivation?.output || !claim.derivation?.method) failures.push(`${label}: reproduced computation needs script, output, and method`);
    if (claim.derivation?.script && !existsSync(join(ROOT, claim.derivation.script))) failures.push(`${label}: derivation script does not exist`);
    if (claim.derivation?.output && !existsSync(join(ROOT, claim.derivation.output))) failures.push(`${label}: derivation output does not exist`);
  }
  if (claim.interpretation === "editorial" && claim.reproduction !== "not-applicable") failures.push(`${label}: editorial interpretation cannot be marked reproduced`);
  if (["editorial", "reader-hypothesis"].includes(claim.interpretation) && claim.aiInvolvement !== "none") failures.push(`${label}: AI-assisted interpretive content is not publishable`);
}

for (const example of caseStudies) {
  if (!example.claimId) failures.push(`case study ${example.id}: missing claimId`);
  const claim = byId.get(example.claimId);
  if (!claim) continue;
  const legacySources = (example.sourceIds || "").split(/\s+/).filter(Boolean).sort();
  const canonicalSources = [...claim.sourceIds].sort();
  if (legacySources.join(" ") !== canonicalSources.join(" ")) failures.push(`case study ${example.id}: sourceIds differ from ${example.claimId}`);
}

const referenced = new Set(caseStudies.map((x) => x.claimId));
for (const claim of claims) if (!referenced.has(claim.id)) failures.push(`${claim.id}: not referenced by a worked case study`);

if (failures.length) {
  console.error("check-claims: FAIL");
  for (const failure of failures) console.error("  - " + failure);
  process.exit(1);
}
console.log(`check-claims: OK (${claims.length} canonical claims; ${caseStudies.length} worked examples)`);
