// io.mjs — reading a repo file, under a name that says which one you get.
//
// WHY THIS EXISTS. `read()` meant two opposite things in this directory.
// Nine scripts defined it as "parse the JSON and give me the object"
// (build-jsonld, build-citations, check-ask, …); five defined it as
// "give me the raw string" (build-llms, check-citation, …); six more
// used a third name, `readJson`, for the first behaviour. Three names,
// two behaviours, twenty scripts.
//
// Nothing was broken by it, and that is the point: the failure mode is a
// line copied from one generator into another, which keeps working right
// up until it doesn't. `read("data/sources.json").sources` is correct in
// build-jsonld.mjs and reads a property off a string in build-llms.mjs.
// No checker can see that, because both files are internally consistent.
//
// So the names here are deliberately not `read`. Neither one can be
// mistaken for the other at a glance, and neither matches the old
// ambiguous name, so a stale copy-paste fails loudly at import instead
// of quietly at runtime.
//
// Paths are repo-relative ("data/numbers.json"), which is what all
// twenty call sites already passed to their local helper.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The file's contents, as a UTF-8 string. */
export const readText = (rel) => readFileSync(join(ROOT, rel), "utf8");

/** The file's contents, parsed as JSON. */
export const readJson = (rel) => JSON.parse(readText(rel));
