// build-datapack.mjs — standard packaging around the export tables.
//
//   node scripts/build-datapack.mjs           # rewrite
//   node scripts/build-datapack.mjs --check   # exit 1 if stale
//
// build-exports.mjs computes the tables and their bespoke schema.json;
// this script wraps them in the containers the outside world already
// knows how to open, without recomputing anything:
//
//   data/exports/datapackage.json      Frictionless Data package: one
//                                      resource per CSV, field schemas
//                                      mapped from schema.json
//   data/exports/croissant.json       Croissant (ML-community) JSON-LD
//                                      describing the same tables
//   data/exports/CITATION-datasets.txt plain-text citation sidecar so a
//                                      downloaded table never travels
//                                      without its provenance
//   data/exports/divinediscourses-data-v<version>.tar.gz
//                                      one archive of all of the above
//                                      plus the tables, for a citation
//                                      to pin. Named by version; when
//                                      the version bumps a NEW archive
//                                      appears and the old one stays,
//                                      which is the snapshot promise.
//
// The archive is deterministic byte-for-byte: hand-rolled ustar
// (sorted entries, uid/gid 0, fixed mode) with every mtime set to the
// release date from data/version.json, gzipped with zlib defaults
// (Node writes no timestamp into the gzip header). Same inputs, same
// bytes, so --check can compare archives, and a re-run cannot silently
// replace what a paper cited. Zero dependencies.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { SITE } from "./lib/site.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data/exports");
const CHECK = process.argv.includes("--check");

const { version, released } = JSON.parse(readFileSync(join(ROOT, "data/version.json"), "utf8"));
const schema = JSON.parse(readFileSync(join(OUT, "schema.json"), "utf8"));
const tables = Object.keys(schema.tables).sort();

const FR_TYPES = { integer: "integer", number: "number", string: "string", float: "number" };

// ── datapackage.json (Frictionless) ──────────────────────────────────
const datapackage = {
  name: "divinediscourses-exports",
  title: "Divine Discourses public export tables",
  version,
  created: released,
  homepage: `${SITE}/export`,
  licenses: [
    {
      name: "GPL-3.0-or-later",
      title: "GNU General Public License",
      path: "https://www.gnu.org/licenses/gpl-3.0.html",
    },
  ],
  sources: [
    {
      title: "The Quranic Arabic Corpus, version 0.4 (Kais Dukes, University of Leeds)",
      path: "https://corpus.quran.com",
    },
  ],
  contributors: [{ title: "Divine Discourses project", path: `${SITE}/about` }],
  resources: tables.map((name) => {
    const t = schema.tables[name];
    return {
      name,
      title: `Divine Discourses: ${name}`,
      description: t.description,
      path: `${name}.csv`,
      format: "csv",
      mediatype: "text/csv",
      encoding: "utf-8",
      schema: {
        fields: t.fields.map((f) => ({
          name: f.name,
          type: FR_TYPES[f.type] || "string",
          description: f.description + (f.unit ? ` Unit: ${f.unit}.` : ""),
        })),
      },
    };
  }),
};

// ── croissant.json (ML-community dataset JSON-LD) ────────────────────
const croissant = {
  "@context": {
    "@vocab": "https://schema.org/",
    cr: "http://mlcommons.org/croissant/",
    fileObject: "cr:fileObject",
    recordSet: "cr:recordSet",
    field: "cr:field",
    dataType: "cr:dataType",
    source: "cr:source",
    extract: "cr:extract",
    fileProperty: "cr:fileProperty",
  },
  "@type": "Dataset",
  "@id": `${SITE}/export`,
  conformsTo: "http://mlcommons.org/croissant/1.0",
  name: "divinediscourses-exports",
  description:
    "Computed tables from the Divine Discourses Qur'an study platform: root frequencies, root-pair association statistics, per-surah statistics, and verse lengths, derived from the Leeds Quranic Arabic Corpus v0.4.",
  url: `${SITE}/export`,
  version,
  datePublished: released,
  license: "https://www.gnu.org/licenses/gpl-3.0.html",
  citeAs: `Divine Discourses project. Divine Discourses, version ${version}. ${released.slice(0, 4)}. ${SITE}.`,
  creator: { "@type": "Organization", name: "Divine Discourses project", url: `${SITE}/about` },
  distribution: tables.map((name) => ({
    "@type": "cr:FileObject",
    "@id": `${name}.csv`,
    name: `${name}.csv`,
    contentUrl: `${SITE}/data/exports/${name}.csv`,
    encodingFormat: "text/csv",
  })),
  recordSet: tables.map((name) => ({
    "@type": "cr:RecordSet",
    "@id": name,
    name,
    description: schema.tables[name].description,
    field: schema.tables[name].fields.map((f) => ({
      "@type": "cr:Field",
      "@id": `${name}/${f.name}`,
      name: f.name,
      description: f.description,
      dataType: f.type === "integer" ? "sc:Integer" : f.type === "number" || f.type === "float" ? "sc:Float" : "sc:Text",
      source: {
        fileObject: { "@id": `${name}.csv` },
        extract: { column: f.name },
      },
    })),
  })),
};

// ── CITATION-datasets.txt ────────────────────────────────────────────
const citationTxt = `Citation for the Divine Discourses export tables
=================================================

These tables travel with their provenance. If you use them, cite:

  Divine Discourses project. Divine Discourses, version ${version}.
  ${released.slice(0, 4)}. ${SITE}. Released ${released}.

and the corpus they derive from:

  Dukes, Kais. The Quranic Arabic Corpus, version 0.4. Language
  Research Group, University of Leeds, 2009-2017.
  https://corpus.quran.com. GNU GPL.

License: the data content of these tables inherits the GPL from the
Leeds morphology. Field definitions, counting rules, and verification
notes: schema.json and DATA-DICTIONARY.md in this archive, or
${SITE}/export. Chronology-based fields follow the Cairo 1924 order
(see schema.json's _chronologySource). BibTeX for the site, every
table, and every cited source: data/citations.bib in the repository.
`;

// ── deterministic tar.gz ─────────────────────────────────────────────
function tarEntry(name, buf, mtime) {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, "utf8");
  header.write("0000644\0", 100, 8);
  header.write("0000000\0", 108, 8);
  header.write("0000000\0", 116, 8);
  header.write(buf.length.toString(8).padStart(11, "0") + "\0", 124, 12);
  header.write(Math.floor(mtime).toString(8).padStart(11, "0") + "\0", 136, 12);
  header.fill(" ", 148, 156); // checksum placeholder
  header.write("0", 156, 1); // regular file
  header.write("ustar", 257, 5);
  header.write("00", 263, 2);
  let sum = 0;
  for (const b of header) sum += b;
  header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
  const pad = (512 - (buf.length % 512)) % 512;
  return Buffer.concat([header, buf, Buffer.alloc(pad)]);
}

function buildArchive(files, mtime) {
  const parts = files.map(([name, buf]) => tarEntry(name, buf, mtime));
  parts.push(Buffer.alloc(1024)); // end-of-archive
  return gzipSync(Buffer.concat(parts), { level: 9 });
}

// ── write everything ─────────────────────────────────────────────────
const textOutputs = [
  ["datapackage.json", JSON.stringify(datapackage, null, 1) + "\n"],
  ["croissant.json", JSON.stringify(croissant, null, 1) + "\n"],
  ["CITATION-datasets.txt", citationTxt],
];

const stale = [];
for (const [rel, text] of textOutputs) {
  const abs = join(OUT, rel);
  let current = null;
  try {
    current = readFileSync(abs, "utf8");
  } catch {}
  if (current !== text) stale.push(`data/exports/${rel}`);
  if (!CHECK) writeFileSync(abs, text);
}

// Archive contents: sorted, self-contained.
const mtime = Date.parse(released + "T00:00:00Z") / 1000;
const inArchive = [
  ...textOutputs.map(([rel, text]) => [rel, Buffer.from(text)]),
  ["DATA-DICTIONARY.md", readFileSync(join(OUT, "DATA-DICTIONARY.md"))],
  ["schema.json", readFileSync(join(OUT, "schema.json"))],
  ...tables.flatMap((name) => [
    [`${name}.csv`, readFileSync(join(OUT, `${name}.csv`))],
    [`${name}.json`, readFileSync(join(OUT, `${name}.json`))],
  ]),
].sort((a, b) => (a[0] < b[0] ? -1 : 1));

const archiveName = `divinediscourses-data-v${version}.tar.gz`;
const archive = buildArchive(inArchive, mtime);
const archiveAbs = join(OUT, archiveName);
const digest = createHash("sha256").update(archive).digest("hex");

// ── the published-archive ledger ─────────────────────────────────────
// Without this, "a new release adds a new archive rather than replacing
// this one" was prose with nothing behind it, and the --check above was
// actively working against it: it compared the archive named by the
// CURRENT version against the CURRENT tables, so every table added
// without a version bump made CI demand that the released bytes be
// overwritten. v1.1.0 was rewritten five times that way, ending up with
// ten tables it never published. The ledger makes a published digest a
// fact the build has to respect.
const ledgerAbs = join(OUT, "RELEASES.json");
const ledger = JSON.parse(readFileSync(ledgerAbs, "utf8"));
const published = ledger.releases.find((r) => r.version === version);

// Every published archive, not just the current version's. Checking only
// the current one would leave the older archives — the ones most likely
// to already be cited — completely unguarded, which is the gap that let
// v1.1.0 drift in the first place. A digest mismatch here is a damaged
// or edited release, so it is a hard failure in both modes: rewriting
// the file would defeat the point of recording it.
const tampered = [];
for (const r of ledger.releases) {
  const abs = join(OUT, `divinediscourses-data-v${r.version}.tar.gz`);
  if (!existsSync(abs)) {
    tampered.push(`v${r.version}: missing`);
    continue;
  }
  const onDisk = createHash("sha256").update(readFileSync(abs)).digest("hex");
  if (onDisk !== r.sha256) {
    tampered.push(`v${r.version}: ${onDisk.slice(0, 12)}… != recorded ${r.sha256.slice(0, 12)}…`);
  }
}
if (tampered.length) {
  console.error(
    `build-datapack: FAIL — published archive(s) no longer match ` +
      `data/exports/RELEASES.json:\n  ${tampered.join("\n  ")}\n` +
      `  These bytes are what a citation to that version names. Restore them ` +
      `from git history rather than re-recording the digest.`,
  );
  process.exit(1);
}

if (published && published.sha256 !== digest) {
  // Not "stale" — the opposite. The tables have moved on from what this
  // version published, which is a release event, not a regeneration.
  console.error(
    `build-datapack: FAIL — data/exports/${archiveName} was published with ` +
      `${published.tables} tables (sha256 ${published.sha256.slice(0, 12)}…, ${published.bytes} bytes) ` +
      `and the current tables (${tables.length}) would produce ${digest.slice(0, 12)}…\n` +
      `  A published archive is immutable: export.html tells readers that citing ` +
      `v${version} names those exact bytes.\n` +
      `  Bump "version" in data/version.json and re-run; a new archive will be ` +
      `written alongside this one and recorded in data/exports/RELEASES.json.`,
  );
  process.exit(1);
}

const archiveCurrent = existsSync(archiveAbs) ? readFileSync(archiveAbs) : null;
if (published) {
  // Already published and matching: the only legitimate action is to
  // restore the file if it has gone missing or been damaged. Its bytes
  // are pinned by the ledger, so this can never introduce a change.
  const onDiskOk =
    archiveCurrent &&
    createHash("sha256").update(archiveCurrent).digest("hex") === published.sha256;
  if (!onDiskOk) {
    if (CHECK) stale.push(`data/exports/${archiveName} (does not match RELEASES.json)`);
    else writeFileSync(archiveAbs, archive);
  }
} else {
  // A version nobody has published yet: this run defines it.
  if (!archiveCurrent || !archiveCurrent.equals(archive))
    stale.push(`data/exports/${archiveName}`);
  if (!CHECK) {
    writeFileSync(archiveAbs, archive);
    ledger.releases.unshift({
      version,
      released,
      tables: tables.length,
      bytes: archive.length,
      sha256: digest,
    });
    writeFileSync(ledgerAbs, JSON.stringify(ledger, null, 1) + "\n");
  } else {
    stale.push("data/exports/RELEASES.json (no entry for v" + version + ")");
  }
}

if (CHECK) {
  if (stale.length) {
    console.error(
      `build-datapack --check: FAIL — stale: ${stale.join(", ")}\n  Run: node scripts/build-datapack.mjs`,
    );
    process.exit(1);
  }
  console.log(
    `build-datapack --check: OK (datapackage + croissant + citation + ${archiveName} current; ` +
      `${ledger.releases.length} published archive(s) intact).`,
  );
} else {
  const kb = Math.round(archive.length / 1024);
  console.log(
    `build-datapack: ${tables.length} tables -> datapackage.json, croissant.json, CITATION-datasets.txt, ${archiveName} (~${kb}KB).`,
  );
}
