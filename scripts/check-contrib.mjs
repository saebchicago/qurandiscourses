// check-contrib.mjs — guard for the contribution pipeline's joints.
//
// The pipeline is deliberately made of loose parts (issue templates,
// a worksheet, a footer form, a URL builder in assets/issue-url.js),
// and each joint can rot silently: a renamed issue template leaves the
// worksheet's submit button opening a blank form, a footer missing the
// hidden form-name field makes Netlify drop its submissions on the
// floor with a 200. This checker holds the joints together.
//
// Asserts:
//   1. community health files exist (CODE_OF_CONDUCT, SECURITY,
//      CONTRIBUTING, PR template) and the three issue templates parse
//      with name + labels front matter
//   2. every template name referenced from JS or HTML exists on disk
//   3. every footer page carries exactly one correction form with the
//      netlify attributes, matching hidden form-name, honeypot field,
//      and the required message field; pages without footers carry none
//   4. the issue-url builder's repo slug matches the repo named in
//      CITATION.cff, so the two cannot drift apart
//
// Run: node scripts/check-contrib.mjs   (exit 1 on any failure)

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const failures = [];

// 1. Health files + template front matter.
for (const f of [
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  ".github/pull_request_template.md",
]) {
  if (!existsSync(join(ROOT, f))) failures.push(`missing ${f}`);
}
const templateDir = ".github/ISSUE_TEMPLATE";
const templates = readdirSync(join(ROOT, templateDir)).filter((f) => f.endsWith(".md"));
if (!templates.length) failures.push("no issue templates");
for (const t of templates) {
  const src = read(join(templateDir, t));
  if (!/^---\n(?:[\s\S]*?\n)?name:\s*\S/.test(src) || !/\nlabels:\s*\S/.test(src))
    failures.push(`${templateDir}/${t}: front matter needs name and labels`);
}

// 2. Every referenced template exists. References look like
// template=<name>.md in URLs or the qdIssueUrl({template: "..."}) call.
const referencing = [
  ...readdirSync(ROOT).filter((f) => f.endsWith(".html")),
  ...readdirSync(join(ROOT, "assets")).filter((f) => f.endsWith(".js")).map((f) => `assets/${f}`),
];
for (const file of referencing) {
  const src = read(file);
  for (const m of src.matchAll(/template[=:]\s*"?([a-z0-9-]+\.md)/g)) {
    if (!templates.includes(m[1]))
      failures.push(`${file}: references missing issue template ${m[1]}`);
  }
}

// 3. The footer form, on every footer page, whole.
const pages = readdirSync(ROOT).filter((f) => f.endsWith(".html"));
for (const p of pages) {
  const html = read(p);
  const hasFooter = html.includes('<footer class="site">');
  const forms = (html.match(/name="correction"/g) || []).length;
  if (!hasFooter) {
    if (forms) failures.push(`${p}: correction form on a page with no footer`);
    continue;
  }
  if (forms !== 1) {
    failures.push(`${p}: ${forms} correction forms (want exactly 1)`);
    continue;
  }
  for (const [needle, why] of [
    ['data-netlify="true"', "netlify detection attribute"],
    ['netlify-honeypot="bot-field"', "honeypot declaration"],
    ['name="bot-field"', "honeypot field"],
    ['<input type="hidden" name="form-name" value="correction" />', "hidden form-name (AJAX submissions are dropped without it)"],
    ['name="message" required', "required message field"],
    ["assets/feedback.js", "enhancement script"],
  ]) {
    if (!html.includes(needle)) failures.push(`${p}: form missing ${why}`);
  }
}

// 4. One repo slug. issue-url.js is the runtime authority; CITATION.cff
// is what the world reads. They must agree.
const jsRepo = (read("assets/issue-url.js").match(/REPO = "([^"]+)"/) || [])[1];
const cffRepo = (read("CITATION.cff").match(/repository-code:\s*"([^"]+)"/) || [])[1];
if (!jsRepo || jsRepo !== cffRepo)
  failures.push(`repo slug drift: issue-url.js says "${jsRepo}", CITATION.cff says "${cffRepo}"`);

if (failures.length) {
  console.error("check-contrib: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(
  `check-contrib: OK (${templates.length} issue templates, correction form on all footer pages, one repo slug).`,
);
