// check-notice.mjs — licensing-inventory drift guard. Every top-level
// entry under data/ must be mentioned by name in NOTICE.md, so a new
// dataset cannot ship without its license standing being declared.
//
// This exists because three consecutive releases added five data
// directories (association/, network/, centrality/, coverage/,
// exports/) without touching NOTICE.md — the file that LICENSE and the
// export/datasets pages all point to as the authoritative breakdown.
// A checker makes that class of drift impossible to miss.
//
// Rule: a directory data/<name>/ must appear in NOTICE.md as `<name>/`;
// a file data/<name>.json must appear as `<name>.json`. Mention is a
// plain substring test — NOTICE.md prose decides WHAT the standing is,
// this checker only enforces THAT a standing is stated.
//
// Run: node scripts/check-notice.mjs   (exit 1 on any unmentioned entry)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const notice = readFileSync(join(ROOT, "NOTICE.md"), "utf8");

const missing = [];
for (const entry of readdirSync(join(ROOT, "data")).sort()) {
  const isDir = statSync(join(ROOT, "data", entry)).isDirectory();
  const needle = isDir ? `${entry}/` : entry;
  if (!notice.includes(needle)) {
    missing.push(`data/${entry} (expected "${needle}" in NOTICE.md)`);
  }
}

if (missing.length) {
  console.error("check-notice: FAIL — data/ entries with no NOTICE.md mention:");
  for (const m of missing) console.error("  - " + m);
  console.error(
    "Add each entry to the appropriate NOTICE.md section (site-authored " +
      "MIT list, GPL-inheritance list, or its own section) before shipping.",
  );
  process.exit(1);
}
console.log(
  `check-notice: OK (every top-level data/ entry is mentioned in NOTICE.md)`,
);
