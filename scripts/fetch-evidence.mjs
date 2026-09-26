#!/usr/bin/env node
//
// fetch-evidence.mjs — print, verbatim, the lines of a source that state
// a finding, so the site can quote it exactly and not from memory.
//
//   node scripts/fetch-evidence.mjs [--id <page id>]
//
// Reads data/evidence/fetch-list.json. For each page: fetches it (PDFs
// through pdftotext), reduces it to text lines, and prints every line
// matching one of its patterns, with the URL, the date, and the SHA-256
// of the bytes fetched, so a quote taken from the log names exactly
// what it was read from. Runs in audit.yml's external-evidence job,
// where the network is open; sandboxed sessions cannot reach these
// hosts.
//
// Nothing fetched is written to the repository: third-party text is
// read from the job log, and only what the site then quotes (with its
// citation) is committed, by hand, in a claim record.
//
// A reporter, not a check: exits 0 unless the list itself is malformed.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ROOT } from "./lib/page-shell.mjs";

const MAX_LINES = 25;
const only = process.argv.includes("--id") ? process.argv[process.argv.indexOf("--id") + 1] : null;
const list = JSON.parse(readFileSync(join(ROOT, "data/evidence/fetch-list.json"), "utf8"));
if (!Array.isArray(list.pages)) {
  console.error("fetch-evidence: data/evidence/fetch-list.json has no pages[]");
  process.exit(2);
}

const decode = (s) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));

const tmp = mkdtempSync(join(tmpdir(), "evidence-"));
for (const p of list.pages) {
  if (only && p.id !== only) continue;
  console.log(`\n=== ${p.id} · ${p.url}`);
  let buf;
  try {
    const res = await fetch(p.url, { headers: { "User-Agent": "divinediscourses-evidence" }, redirect: "follow", signal: AbortSignal.timeout(60000) });
    console.log(`    HTTP ${res.status} · final URL ${res.url} · fetched ${new Date().toISOString()}`);
    if (!res.ok) continue;
    buf = Buffer.from(await res.arrayBuffer());
  } catch (e) {
    console.log(`    fetch failed: ${e.message}`);
    continue;
  }
  console.log(`    sha256 ${createHash("sha256").update(buf).digest("hex")} · ${buf.length} bytes`);
  let text;
  if (p.pdf) {
    const f = join(tmp, `${p.id}.pdf`);
    writeFileSync(f, buf);
    try {
      text = execFileSync("pdftotext", ["-layout", f, "-"], { maxBuffer: 64 * 1024 * 1024 }).toString("utf8");
    } catch (e) {
      console.log(`    pdftotext failed: ${e.message}`);
      continue;
    }
  } else {
    text = decode(
      buf
        .toString("utf8")
        .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<(br|p|div|li|tr|h\d)\b[^>]*>/gi, "\n")
        .replace(/<[^>]+>/g, " "),
    );
  }
  const lines = text.split(/\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const res = p.patterns.map((s) => new RegExp(s, "i"));
  let shown = 0;
  lines.forEach((l, i) => {
    if (shown >= MAX_LINES || !res.some((r) => r.test(l))) return;
    shown++;
    console.log(`    [line ${i + 1}] ${l.slice(0, 400)}`);
  });
  if (!shown) console.log("    no line matched");
}
rmSync(tmp, { recursive: true, force: true });
