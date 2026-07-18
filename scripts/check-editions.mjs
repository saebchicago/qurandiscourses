// check-editions.mjs — liveness/identity checker for every translation
// edition ID registered in assets/app.js's TRANSLATIONS array. alquran.cloud
// does not error on an invalid edition ID; it silently substitutes a
// default edition (Arabic quran-simple) instead, which is exactly how the
// "en.haleem" bug shipped Arabic text mislabeled as an English translation
// for as long as that dead ID was registered (see CHANGES.md). This makes
// that failure mode visible before a reader finds it, the same way
// check-source-links.mjs does for citation URLs.
//
// A checker, not a generator: writes nothing, so the determinism rule does
// not apply. Needs real outbound network to api.alquran.cloud — sandboxed
// sessions with an allowlisting proxy will see spurious failures; run it
// from an unrestricted machine.
//
// Run:  node scripts/check-editions.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const appJs = readFileSync(join(ROOT, "assets", "app.js"), "utf8");

// TRANSLATIONS is a plain literal array in app.js; extract entries without
// executing the file (it assumes a browser global scope it doesn't have
// here).
const arrayMatch = appJs.match(/const TRANSLATIONS = (\[[\s\S]*?\n {2}\]);/);
if (!arrayMatch) {
  console.error("check-editions: FAIL — could not locate TRANSLATIONS array in assets/app.js");
  process.exit(2);
}
const ids = [...arrayMatch[1].matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]);
if (!ids.length) {
  console.error("check-editions: FAIL — parsed zero edition IDs (parser broken?)");
  process.exit(2);
}

const editions = ["quran-uthmani", ...ids];
const url = `https://api.alquran.cloud/v1/ayah/1:2/editions/${editions.join(",")}`;

let res;
try {
  res = await fetch(url, { signal: AbortSignal.timeout(20000) });
} catch (e) {
  console.error(`check-editions: FAIL — network error reaching api.alquran.cloud: ${e.message}`);
  console.error("If this is a sandboxed/proxied environment, re-run from an unrestricted machine.");
  process.exit(2);
}
if (!res.ok) {
  console.error(`check-editions: FAIL — HTTP ${res.status} from api.alquran.cloud`);
  process.exit(2);
}
const json = await res.json();
const data = json.data || [];

let fails = 0;
for (let i = 0; i < editions.length; i++) {
  const requested = editions[i];
  const returned = data[i] && data[i].edition && data[i].edition.identifier;
  const ok = returned === requested;
  if (!ok) fails++;
  console.log(
    `${ok ? "OK  " : "FAIL"} ${requested}${ok ? "" : ` — API returned "${returned}" instead (silent substitution: this edition ID is likely dead and must be removed from assets/app.js's TRANSLATIONS array)`}`,
  );
}

console.log(
  `\ncheck-editions: ${editions.length} editions — ${editions.length - fails} OK, ${fails} FAIL`,
);
process.exit(fails ? 1 : 0);
