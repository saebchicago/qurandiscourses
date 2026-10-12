#!/usr/bin/env node
//
// fetch-evidence.mjs — print, verbatim, the lines of a source that state
// a finding, so the site can quote it exactly and not from memory.
//
//   node scripts/fetch-evidence.mjs [--id <page id>]
//   node scripts/fetch-evidence.mjs --verify   # every quote in data/replications.json
//                                              # still appears at its URL
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
// Options per page: `context` (lines printed around each match, default
// 0) and `head` (the first N lines, for a document's title page).
//
// A reporter, not a check: exits 0 unless the list itself is malformed.
// With --verify it is a check: exit 1 when a quoted passage is no longer
// found on its page (whitespace and markup normalized).

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

async function fetchText(url, pdf) {
  const res = await fetch(url, { headers: { "User-Agent": "divinediscourses-evidence" }, redirect: "follow", signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (pdf) {
    const f = join(tmp, "doc.pdf");
    writeFileSync(f, buf);
    return { buf, text: execFileSync("pdftotext", ["-layout", f, "-"], { maxBuffer: 64 * 1024 * 1024 }).toString("utf8") };
  }
  return {
    buf,
    text: decode(
      buf
        .toString("utf8")
        .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<(br|p|div|li|tr|h\d)\b[^>]*>/gi, "\n")
        .replace(/<[^>]+>/g, " "),
    ),
  };
}

if (process.argv.includes("--verify")) {
  // Every card ends in exactly one of three states, and the summary names
  // all three. A source that could not be fetched, or a PDF this machine
  // cannot read, is "not checked": it is never folded into a pass.
  //   verified     every quote found at the URL
  //   failed       a quote is gone (exit 1: the site's citation needs work)
  //   not checked  the URL did not answer, or no PDF reader is installed
  // A missing pdftotext is this machine's problem, not the source's, so it
  // also exits 1: the job that runs this installs poppler-utils first.
  const { cards } = JSON.parse(readFileSync(join(ROOT, "data/replications.json"), "utf8"));
  const flat = (t) => t.replace(/\s+/g, " ").trim();
  const verified = [];
  const failed = [];
  const unchecked = [];
  let noParser = false;
  for (const c of cards) {
    const pdf = /\.pdf$|\/pdf\//.test(c.url);
    let text;
    try {
      text = flat((await fetchText(c.url, pdf)).text);
    } catch (e) {
      const missingTool = pdf && e.code === "ENOENT";
      if (missingTool) noParser = true;
      const why = missingTool ? "pdftotext is not installed (poppler-utils)" : e.message;
      unchecked.push(c.id);
      console.log(`NOT CHECKED ${c.id}: ${c.url} (${why})`);
      if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Evidence not checked::${c.id}: ${why}`);
      continue;
    }
    let cardOk = true;
    for (const q of [c.quote, c.quote2].filter(Boolean)) {
      const ok = text.includes(flat(q));
      if (!ok) cardOk = false;
      console.log(`${ok ? "OK  " : "GONE"} ${c.id}: "${q.slice(0, 70)}${q.length > 70 ? "…" : ""}"`);
    }
    (cardOk ? verified : failed).push(c.id);
  }
  rmSync(tmp, { recursive: true, force: true });
  const summary = `${verified.length} verified, ${failed.length} failed, ${unchecked.length} not checked (of ${cards.length} cards)`;
  if (failed.length) {
    console.error(`fetch-evidence --verify: FAIL — ${summary}. A quote is no longer found at its URL: re-read the page and update data/replications.json.`);
    process.exit(1);
  }
  if (noParser) {
    console.error(`fetch-evidence --verify: FAIL — ${summary}. Install poppler-utils (pdftotext) so PDF sources can be read.`);
    process.exit(1);
  }
  if (unchecked.length) {
    console.log(`fetch-evidence --verify: INCOMPLETE — ${summary}. Unreachable sources are not counted as verified.`);
    process.exit(0);
  }
  console.log(`fetch-evidence --verify: OK — ${summary}`);
  process.exit(0);
}

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
  // pdftotext separates pages with a form feed; keep each line's PDF page
  // (the page's position in the file, which may differ from the number
  // printed on it) so a quote can be cited to its page.
  const lines = [];
  const pageOf = [];
  text.split("\f").forEach((pg, pi) => {
    for (const raw of pg.split(/\n/)) {
      const l = raw.replace(/\s+/g, " ").trim();
      if (!l) continue;
      lines.push(l);
      pageOf.push(pi + 1);
    }
  });
  const res = p.patterns.map((s) => new RegExp(s, "i"));
  const ctx = p.context || 0;
  for (let i = 0; i < Math.min(p.head || 0, lines.length); i++) console.log(`    [head ${i + 1}] ${lines[i].slice(0, 400)}`);
  let shown = 0;
  let last = -1;
  lines.forEach((l, i) => {
    if (shown >= MAX_LINES || !res.some((r) => r.test(l))) return;
    shown++;
    for (let j = Math.max(last + 1, i - ctx); j <= Math.min(lines.length - 1, i + ctx); j++) {
      console.log(`    [line ${j + 1}${p.pdf ? `, pdf p. ${pageOf[j]}` : ""}]${j === i ? "*" : " "} ${lines[j].slice(0, 400)}`);
      last = j;
    }
  });
  if (!shown) console.log("    no line matched");
}
rmSync(tmp, { recursive: true, force: true });
