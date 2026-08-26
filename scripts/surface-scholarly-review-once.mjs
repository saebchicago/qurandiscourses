import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";

const page = "contribute.html";
const workflow = ".github/workflows/surface-scholarly-review-once.yml";
const self = "scripts/surface-scholarly-review-once.mjs";

const oldText = `          confirmation or a discrepancy are equally valuable, filed as a
          correction issue with your working shown.
`;
const newText = `          confirmation or a discrepancy are equally valuable. For a focused
          review of a claim, method, source, or framing, open a
          <a
            href="https://github.com/saebchicago/qurandiscourses/issues/new?template=scholarly-review.md"
            rel="noopener"
            >scholarly-review issue</a
          >
          and show your evidence and working. Use a correction issue when
          you already know a specific published claim is wrong.
`;

const current = readFileSync(page, "utf8");
if (!current.includes(oldText)) {
  throw new Error("Expected Review and verify text not found; refusing broad replacement");
}
writeFileSync(page, current.replace(oldText, newText));

for (const script of [
  "scripts/build-llms.mjs",
  "scripts/build-search-index.mjs",
  "scripts/build-ask-routes.mjs",
  "scripts/build-related.mjs",
  "scripts/build-provenance.mjs",
  "scripts/build-sw-manifest.mjs",
]) {
  execFileSync("node", [script], { stdio: "inherit" });
}

unlinkSync(workflow);
unlinkSync(self);
