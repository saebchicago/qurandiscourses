// build-api-index.mjs — a machine-readable front door to the published data.
//
//   node scripts/build-api-index.mjs           # rewrite
//   node scripts/build-api-index.mjs --check   # exit 1 if stale
//
// WHY THIS EXISTS. The export tables, their schema and the versioned
// archives are already static files. What a script or notebook could not
// do was discover them: it had to scrape export.html or hard-code file
// names. This writes two static documents that describe what is there,
// with no server and nothing new to host:
//
//   api/v1/index.json    every table (description, row count, CSV/JSON
//                        URL, byte size, sha256), every published archive
//                        from RELEASES.json, and pointers to the schema,
//                        Frictionless and Croissant descriptors, sources
//                        and claims registries
//   api/v1/openapi.json  OpenAPI 3.1 description of the same GET paths
//
// The data files stay where they are (data/exports/); the index points at
// them. A digest per file lets a consumer verify a download and notice a
// change without comparing bytes. Read-only, public data: netlify.toml
// serves /api/* and /data/exports/* with Access-Control-Allow-Origin: *.
//
// Determinism: no generation date (the release date from data/version.json
// is the only date), tables in schema order, archives in RELEASES order.
// Run after build-exports.mjs and build-datapack.mjs; --check fails when
// any table's bytes or the release ledger moved without a rerun.

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "./lib/site.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "api", "v1");
const CHECK = process.argv.includes("--check");

const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
const { version, released } = readJson("data/version.json");
const schema = readJson("data/exports/schema.json");
const releases = readJson("data/exports/RELEASES.json").releases;

function fileEntry(rel) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) throw new Error(`${rel} is missing. Run build-exports.mjs first. STOPPING.`);
  const bytes = readFileSync(abs);
  return {
    url: `${SITE}/${rel}`,
    bytes: statSync(abs).size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

const tableNames = Object.keys(schema.tables);
const index = {
  api: "v1",
  description:
    "Index of the Divine Discourses export tables: static files, read-only, no key. " +
    "Every number regenerates from the public repository's data and scripts.",
  version,
  released,
  license: {
    name: "GPL-3.0-or-later",
    url: "https://www.gnu.org/licenses/gpl-3.0.html",
    note: "The tables derive from the Leeds Quranic Arabic Corpus v0.4 (GPL). Keep data/exports/NOTICE-LEEDS.txt with any copy.",
  },
  citation: `${SITE}/about#cite`,
  openapi: `${SITE}/api/v1/openapi.json`,
  descriptors: {
    schema: `${SITE}/data/exports/schema.json`,
    dataDictionary: `${SITE}/data/exports/DATA-DICTIONARY.md`,
    frictionless: `${SITE}/data/exports/datapackage.json`,
    croissant: `${SITE}/data/exports/croissant.json`,
    corpusNotice: `${SITE}/data/exports/NOTICE-LEEDS.txt`,
    sources: `${SITE}/data/sources.json`,
    claims: `${SITE}/data/claims.json`,
  },
  tables: tableNames.map((name) => {
    const t = schema.tables[name];
    return {
      name,
      description: t.description,
      rowCount: t.rowCount,
      verification: t.verification,
      csv: fileEntry(`data/exports/${name}.csv`),
      json: fileEntry(`data/exports/${name}.json`),
    };
  }),
  archives: releases.map((r) => ({
    version: r.version,
    released: r.released,
    tables: r.tables,
    url: `${SITE}/data/exports/divinediscourses-data-v${r.version}.tar.gz`,
    bytes: r.bytes,
    sha256: r.sha256,
  })),
};

if (!index.archives.some((a) => a.version === version)) {
  throw new Error(`RELEASES.json has no entry for v${version}. Run build-datapack.mjs. STOPPING.`);
}

const openapi = {
  openapi: "3.1.0",
  info: {
    title: "Divine Discourses data",
    version,
    description:
      "Static, read-only files. There is no query interface: fetch a table whole and filter it locally. " +
      "Field definitions for every table are in /data/exports/schema.json.",
    license: { name: "GPL-3.0-or-later", url: "https://www.gnu.org/licenses/gpl-3.0.html" },
  },
  servers: [{ url: SITE }],
  paths: {
    "/api/v1/index.json": {
      get: {
        summary: "Index of tables, archives and descriptors, with a sha256 for every file",
        responses: { 200: { description: "Index", content: { "application/json": {} } } },
      },
    },
    "/data/exports/{table}.json": {
      get: {
        summary: "One export table as a JSON array of row objects",
        parameters: [{ name: "table", in: "path", required: true, schema: { type: "string", enum: tableNames } }],
        responses: { 200: { description: "Rows", content: { "application/json": {} } } },
      },
    },
    "/data/exports/{table}.csv": {
      get: {
        summary: "The same table as CSV with a header row",
        parameters: [{ name: "table", in: "path", required: true, schema: { type: "string", enum: tableNames } }],
        responses: { 200: { description: "Rows", content: { "text/csv": {} } } },
      },
    },
    "/data/exports/schema.json": {
      get: {
        summary: "Field names, types, units, counting rules and verification for every table",
        responses: { 200: { description: "Schema", content: { "application/json": {} } } },
      },
    },
    "/data/exports/divinediscourses-data-v{version}.tar.gz": {
      get: {
        summary: "A published archive. Its bytes never change; a new release adds a new archive",
        parameters: [
          { name: "version", in: "path", required: true, schema: { type: "string", enum: releases.map((r) => r.version) } },
        ],
        responses: { 200: { description: "Archive", content: { "application/gzip": {} } } },
      },
    },
  },
};

const outputs = [
  ["index.json", JSON.stringify(index, null, 1) + "\n"],
  ["openapi.json", JSON.stringify(openapi, null, 1) + "\n"],
];

if (CHECK) {
  const stale = outputs.filter(([f, text]) => {
    const p = join(OUT, f);
    return !existsSync(p) || readFileSync(p, "utf8") !== text;
  });
  if (stale.length) {
    console.error(`build-api-index --check: FAIL — stale: ${stale.map(([f]) => `api/v1/${f}`).join(", ")}`);
    console.error("  Run: node scripts/build-api-index.mjs");
    process.exit(1);
  }
  console.log(`build-api-index --check: OK (${tableNames.length} tables, ${releases.length} archives, v${version}).`);
} else {
  mkdirSync(OUT, { recursive: true });
  for (const [f, text] of outputs) writeFileSync(join(OUT, f), text);
  console.log(`build-api-index: wrote api/v1/index.json and api/v1/openapi.json (${tableNames.length} tables, v${version}).`);
}
