// input-digest.mjs — a fingerprint of a generator's inputs.
//
// Two generators (compute-surah-distance, build-formulaic-templates) take
// 15-35 s because they run hundreds of seeded shuffles. Re-running them on
// every CI pass only proves the output matches the inputs, so each stores a
// digest of its inputs (data files, the script, the libraries it imports) in
// its own output. `--check` then compares digests (milliseconds) and the
// full recompute runs weekly (.github/workflows/recompute.yml) or on demand
// with `--check --full`.
//
// A digest cannot catch a hand-edit of the output, so the output also stores
// `outputDigest`, the digest of its result rows, which --check recomputes.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

function filesUnder(path) {
  if (statSync(path).isDirectory()) {
    return readdirSync(path)
      .sort()
      .flatMap((f) => filesUnder(join(path, f)));
  }
  return [path];
}

// paths: absolute files or directories. Order-independent; each file
// contributes its path relative to root and its bytes.
export function inputDigest(root, paths) {
  const h = createHash("sha256");
  // Paths are hashed with "/" and line endings as LF, so a Windows checkout
  // with autocrlf computes the same digest as Linux CI.
  const all = paths.flatMap(filesUnder).map((p) => p.slice(root.length + 1).split(sep).join("/")).sort();
  for (const rel of all) {
    h.update(rel + "\0");
    h.update(readFileSync(join(root, rel)).toString("latin1").replace(/\r\n/g, "\n"), "latin1");
    h.update("\0");
  }
  return h.digest("hex");
}

// Digest of a whole generated document except its two digest fields, so an
// edit to any other field (parameters, method text, rows) is detected.
export function bodyDigest(doc) {
  const { inputDigest, outputDigest, ...body } = doc;
  return jsonDigest(body);
}

export function jsonDigest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
