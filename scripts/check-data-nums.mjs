// check-data-nums.mjs — integrity guard for data-num="dot.path" bindings.
//
// assets/app.js's initDataNums() walks every [data-num] element, resolves
// its dot-path against data/numbers.json, and overwrites the static
// fallback text with the live value — but only when the path resolves to
// a number. A typo'd path, a renamed field, or a stale fallback number
// left behind after data/numbers.json regenerates all fail silently in
// the browser: the old static text just stays put, exactly the "display
// drift" data-num exists to prevent (see maintainer-guide.md §1).
//
// Asserts, for every data-num="path" found in the root HTML pages:
//   1. the path resolves to a number in data/numbers.json
//   2. the element's static fallback text matches that number under the
//      same formatting initDataNums() applies (toLocaleString for
//      integers, toFixed(1) otherwise) — so a page can never silently
//      drift from the generated data it claims to bind to
//
// Run: node scripts/check-data-nums.mjs   (exit 1 on any failure)

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const numbers = JSON.parse(readFileSync(join(ROOT, "data", "numbers.json"), "utf8"));

const format = (v) =>
  Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(1);

const resolve = (path) => {
  let v = numbers;
  for (const part of path.split(".")) {
    if (v == null) return undefined;
    v = v[part];
  }
  return v;
};

const pages = readdirSync(ROOT).filter((f) => f.endsWith(".html"));
const failures = [];
const PATTERN = /data-num="([^"]+)"[^>]*>([^<]*)</g;

for (const page of pages) {
  const html = readFileSync(join(ROOT, page), "utf8");
  for (const match of html.matchAll(PATTERN)) {
    const [, path, text] = match;
    const label = `${page}: data-num="${path}"`;
    const value = resolve(path);
    if (typeof value !== "number") {
      failures.push(`${label} does not resolve to a number in data/numbers.json`);
      continue;
    }
    const expected = format(value);
    const actual = text.trim();
    if (actual !== expected) {
      failures.push(`${label}: static text "${actual}" does not match live value "${expected}" (${value})`);
    }
  }
}

if (failures.length) {
  console.error("check-data-nums: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`check-data-nums: OK (${pages.length} pages scanned)`);
