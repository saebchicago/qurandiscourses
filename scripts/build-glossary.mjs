// build-glossary.mjs — one glossary, two surfaces.
//
//   node scripts/build-glossary.mjs           # rewrite
//   node scripts/build-glossary.mjs --check   # exit 1 if either drifted
//
// data/glossary.json is the registry. From it this writes:
//
//   assets/glossary.js    the window.GLOSSARY map between GENERATED
//                         markers (the tooltip wrapper code around it
//                         stays hand-written)
//   glossary.html         the definition list between static:glossary
//                         markers, every term carrying its anchor id
//
// The two had already drifted when this was introduced: 31 tooltip
// terms vs 27 page entries, with the statistical vocabulary (llr, pmi,
// keyness...) defined on hover but absent from the one page a reader
// would search. A term now exists in both places or neither, and
// --check in CI keeps it that way. Deterministic; zero dependencies.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");
const { terms } = JSON.parse(readFileSync(join(ROOT, "data/glossary.json"), "utf8"));

const failures = [];
const ids = new Set();
for (const t of terms) {
  if (ids.has(t.id)) failures.push(`duplicate id ${t.id}`);
  ids.add(t.id);
  if (!t.matchKeys?.length) failures.push(`${t.id}: no matchKeys`);
  if (!t.def) failures.push(`${t.id}: no def`);
  if (!t.ddHtml) failures.push(`${t.id}: no ddHtml`);
  // No em-dash check here: several definitions were migrated verbatim
  // from pre-existing page copy that carries them, and the copy-edit
  // rules freeze that text. New entries are caught in PR diff review.
}
if (failures.length) {
  console.error("build-glossary: registry invalid");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}

// ── assets/glossary.js: the GLOSSARY map between markers ─────────────
// Longest-first matching is the wrapper's job; here order is by id for
// a stable diff. Aliases (extra matchKeys) repeat the same definition
// under each key, which is what the wrapper's flat lookup expects.
const jsEsc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const jsLines = [];
for (const t of terms) {
  for (const key of t.matchKeys) {
    jsLines.push(`  ${JSON.stringify(key)}: "${jsEsc(t.def)}",`);
  }
}
const jsRegion =
  `window.GLOSSARY = {\n${jsLines.join("\n")}\n};`;

// ── glossary.html: the definition list between markers ───────────────
const esc = (v) =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const dlRows = terms
  .map((t) => {
    const dd = t.ddHtml.trimEnd();
    return (
      `            <dt id="${t.id}">${t.labelHtml.includes("<") ? "\n              " + t.labelHtml + "\n            " : t.labelHtml}</dt>\n` +
      `            <dd>\n${dd.startsWith(" ") ? dd : "              " + esc(dd)}\n            </dd>\n`
    );
  })
  .join("\n");

// ── apply through markers ────────────────────────────────────────────
function inject(file, open, close, body) {
  const abs = join(ROOT, file);
  const before = readFileSync(abs, "utf8");
  const i = before.indexOf(open);
  const j = before.indexOf(close);
  if (i === -1 || j === -1 || j < i)
    throw new Error(`${file}: missing ${open} .. ${close} markers`);
  const after =
    before.slice(0, i + open.length) + "\n" + body + "\n" + before.slice(j);
  return { abs, before, after };
}

const targets = [
  inject(
    "assets/glossary.js",
    "/* GENERATED:glossary (build-glossary.mjs) */",
    "/* /GENERATED:glossary */",
    jsRegion,
  ),
  inject(
    "glossary.html",
    "<!-- static:glossary -->",
    "            <!-- /static:glossary -->",
    dlRows,
  ),
];

const stale = targets.filter((t) => t.after !== t.before);
if (CHECK) {
  if (stale.length) {
    console.error(
      `build-glossary --check: FAIL — stale: ${stale
        .map((t) => t.abs.slice(ROOT.length + 1))
        .join(", ")}\n  Run: node scripts/build-glossary.mjs`,
    );
    process.exit(1);
  }
  console.log(
    `build-glossary --check: OK (${terms.length} terms, ${jsLines.length} match keys, both surfaces current).`,
  );
} else {
  for (const t of stale) writeFileSync(t.abs, t.after);
  console.log(
    `build-glossary: ${terms.length} terms -> glossary.js + glossary.html (${stale.length} file(s) changed).`,
  );
}
