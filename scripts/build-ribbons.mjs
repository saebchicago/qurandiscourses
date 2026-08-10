// build-ribbons.mjs — precomputes the distance-ribbon geometry for every
// claim in data/provenance/claims.json into data/provenance/ribbons.json.
//
//   node scripts/build-ribbons.mjs            write
//   node scripts/build-ribbons.mjs --check    fail if stale
//
// WHY OFFLINE. The site's standing rule is that no browser script
// computes layout: every coordinate that reaches the DOM is a literal.
// A ribbon is four stops on a fixed axis, so its geometry depends only
// on which distances a claim's sources occupy — knowable at build time.
// This emits x positions, the marked stop, and the span segment, so the
// renderer only interpolates strings.
//
// WHAT THE RIBBON SHOWS. A claim is marked at the LOWEST distance among
// its sources, because that is the closest documented approach to Dr.
// Khan's own words. When its sources span several distances the span is
// drawn as a lighter segment from lowest to highest, so a reader can
// see both the best evidence and its spread. A claim with no sources
// (status pending) gets no mark at all.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data/provenance/ribbons.json");
const CHECK = process.argv.includes("--check");

// Fixed canvas. Chosen once, here, and never recomputed anywhere else.
const W = 260;
const H = 34;
const X0 = 18; // centre of stop 0
const STEP = 68; // distance between stop centres → stop 3 at x=222
const AXIS_Y = 12;
const R_STOP = 3.5;
const R_MARK = 6;

const STOPS = [0, 1, 2, 3].map((d) => ({ d, x: X0 + d * STEP }));

const LABELS = {
  0: "Dr. Khan's own words",
  1: "Quoted verbatim by a scholar",
  2: "A scholar's description",
  3: "General-audience restatement",
};

const sources = JSON.parse(readFileSync(join(ROOT, "data/provenance/sources.json"), "utf8"));
const claims = JSON.parse(readFileSync(join(ROOT, "data/provenance/claims.json"), "utf8"));
const distanceOf = new Map(sources.map((s) => [s.id, s.provenance_distance]));

const ribbons = {};
for (const c of claims) {
  const ds = (c.sources || []).map((id) => distanceOf.get(id)).filter((d) => Number.isInteger(d));
  const unique = [...new Set(ds)].sort((a, b) => a - b);
  const lowest = unique.length ? unique[0] : null;
  const highest = unique.length ? unique[unique.length - 1] : null;

  ribbons[c.id] = {
    width: W,
    height: H,
    axisY: AXIS_Y,
    stopRadius: R_STOP,
    markRadius: R_MARK,
    stops: STOPS,
    marked: lowest,
    span:
      lowest !== null && highest !== null && highest > lowest
        ? { x1: X0 + lowest * STEP, x2: X0 + highest * STEP }
        : null,
    // Text, not colour. This string is the aria-label and the table
    // caption, so the ribbon is never the only carrier of its meaning.
    ariaLabel:
      lowest === null
        ? "No source recorded, so no provenance distance is marked."
        : highest > lowest
          ? `Provenance distance ${lowest}: ${LABELS[lowest]}. Sources span distance ${lowest} to ${highest}.`
          : `Provenance distance ${lowest}: ${LABELS[lowest]}.`,
    // Per-source rows for the table fallback.
    rows: (c.sources || []).map((id) => ({ id, distance: distanceOf.get(id) ?? null })),
  };
}

const payload =
  JSON.stringify(
    {
      _generated: "scripts/build-ribbons.mjs",
      _method:
        "Fixed 260x34 canvas, four stops at x = 18 + 68d. A claim is marked at the lowest " +
        "distance among its sources; a span segment is emitted when its sources occupy more " +
        "than one distance. All coordinates are literals; nothing is computed in the browser.",
      labels: LABELS,
      ribbons,
    },
    null,
    2,
  ) + "\n";

if (CHECK) {
  let current = "";
  try {
    current = readFileSync(OUT, "utf8");
  } catch {
    /* missing counts as stale */
  }
  if (current !== payload) {
    console.error(
      "build-ribbons --check: FAIL — data/provenance/ribbons.json is stale.\n" +
        "  Run: node scripts/build-ribbons.mjs",
    );
    process.exit(1);
  }
  console.log(`build-ribbons --check: OK (${Object.keys(ribbons).length} ribbons current).`);
} else {
  writeFileSync(OUT, payload);
  const marked = Object.values(ribbons).filter((r) => r.marked !== null).length;
  console.log(
    `build-ribbons: ${Object.keys(ribbons).length} ribbons written ` +
      `(${marked} marked, ${Object.keys(ribbons).length - marked} unmarked for want of a source).`,
  );
}
