// check-videos.mjs — guard for the video registry (data/videos.json /
// watch.html). The site's anti-slop covenant is enforced mechanically
// where it can be: a video cannot be 'published' without its file, its
// poster, AND a real captions track on disk. Run after editing the
// registry or adding media; part of the pre-ship checklist.
//
// Asserts:
//   1. every entry has id/title/durationSec/src/poster/captions/
//      scriptPath/summary and a status of planned|published
//   2. every scriptPath exists (a planned video must already have its
//      recording script)
//   3. published entries: src, poster, captions files exist; captions
//      file starts with "WEBVTT"
//   4. src/poster/captions live under assets/video/
//
// Run: node scripts/check-videos.mjs   (exit 1 on any failure)

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(
  readFileSync(join(ROOT, "data", "videos.json"), "utf8"),
);

const failures = [];
const REQUIRED = [
  "id",
  "title",
  "durationSec",
  "src",
  "poster",
  "captions",
  "scriptPath",
  "summary",
  "status",
];

for (const v of registry.videos) {
  const label = v.id || "(no id)";
  for (const f of REQUIRED) {
    if (v[f] === undefined || v[f] === "")
      failures.push(`${label}: missing field ${f}`);
  }
  if (!["planned", "published"].includes(v.status))
    failures.push(`${label}: status "${v.status}" not planned|published`);
  for (const f of ["src", "poster", "captions"]) {
    if (v[f] && !v[f].startsWith("assets/video/"))
      failures.push(`${label}: ${f} must live under assets/video/`);
  }
  if (v.scriptPath && !existsSync(join(ROOT, v.scriptPath)))
    failures.push(`${label}: scriptPath ${v.scriptPath} does not exist`);
  if (v.status === "published") {
    for (const f of ["src", "poster", "captions"]) {
      if (!existsSync(join(ROOT, v[f])))
        failures.push(`${label}: published but ${f} file ${v[f]} missing`);
    }
    if (existsSync(join(ROOT, v.captions))) {
      const vtt = readFileSync(join(ROOT, v.captions), "utf8");
      if (!vtt.trimStart().startsWith("WEBVTT"))
        failures.push(`${label}: captions file is not WEBVTT`);
      else if (vtt.trim().length < 40)
        failures.push(`${label}: captions file looks empty`);
    }
  }
}

if (failures.length) {
  console.error("check-videos: FAIL");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(
  `check-videos: OK (${registry.videos.length} entries, ${registry.videos.filter((v) => v.status === "published").length} published)`,
);
