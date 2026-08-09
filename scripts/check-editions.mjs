// check-editions.mjs — liveness/identity checker for every translation
// edition ID registered in assets/app.js's TRANSLATIONS array. alquran.cloud
// does not error on an invalid edition ID; it silently substitutes a
// default edition (Arabic quran-simple) instead, which is exactly how the
// "en.haleem" bug shipped Arabic text mislabeled as an English translation
// for as long as that dead ID was registered (see CHANGES.md). This makes
// that failure mode visible before a reader finds it, the same way
// check-source-links.mjs does for citation URLs.
//
// It also checks the `lang` field registered beside each ID against the
// language the API itself reports. That field is not decoration: read.html
// picks the script font from it (Nastaliq for ur, Noto Serif Bengali for
// bn, the system CJK stack for zh/ja/ko) and the API's own direction and
// language land in the rendered lang/dir attributes. A mistyped lang would
// render a real translation in the wrong face and announce it to screen
// readers as the wrong language — visible to nobody running English.
//
// A checker, not a generator: writes nothing, so the determinism rule does
// not apply. Needs real outbound network to api.alquran.cloud — sandboxed
// sessions with an allowlisting proxy will see spurious failures; run it
// from an unrestricted machine, or dispatch the "Site audit" workflow
// (its external-evidence job runs this on a GitHub runner).
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
const entries = [...arrayMatch[1].matchAll(/id:\s*"([^"]+)"[^}]*?lang:\s*"([^"]+)"/g)].map(
  (m) => ({ id: m[1], lang: m[2] }),
);
const ids = entries.map((e) => e.id);
if (!ids.length) {
  console.error("check-editions: FAIL — parsed zero edition IDs (parser broken?)");
  process.exit(2);
}
const langOf = new Map(entries.map((e) => [e.id, e.lang]));

// Offline half, run before the network so it reports even from a
// sandbox: every language in TRANSLATIONS needs a display name in
// assets/lang-labels.js's QD_LANG_LABELS, or the translation picker
// groups that edition under a bare code ("ko") instead of "Korean".
const langLabelsJs = readFileSync(join(ROOT, "assets", "lang-labels.js"), "utf8");
const labelsMatch = langLabelsJs.match(/const QD_LANG_LABELS = \{([\s\S]*?)\};/);
if (!labelsMatch) {
  console.error("check-editions: FAIL — could not locate QD_LANG_LABELS in assets/lang-labels.js");
  process.exit(2);
}
const labelled = new Set([...labelsMatch[1].matchAll(/(\w+):/g)].map((m) => m[1]));
const unlabelled = [...new Set(entries.map((e) => e.lang))].filter((l) => !labelled.has(l));
if (unlabelled.length) {
  console.error(
    `check-editions: FAIL — no LANG_LABELS entry in read.html for: ${unlabelled.join(", ")}`,
  );
  process.exit(1);
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
  const edition = (data[i] && data[i].edition) || {};
  const returned = edition.identifier;
  const identityOk = returned === requested;
  // The API's own language code is authoritative; ours must match it.
  const wantLang = langOf.get(requested);
  const langOk = !wantLang || !identityOk || edition.language === wantLang;
  const ok = identityOk && langOk;
  if (!ok) fails++;
  const detail = !identityOk
    ? ` — API returned "${returned}" instead (silent substitution: this edition ID is likely dead and must be removed from assets/app.js's TRANSLATIONS array)`
    : !langOk
      ? ` — app.js registers lang "${wantLang}" but the API reports "${edition.language}" (fixing app.js is the fix: this drives the script font and the rendered lang attribute)`
      : ` · ${edition.language || "?"} · ${edition.englishName || edition.name || ""}`;
  console.log(`${ok ? "OK  " : "FAIL"} ${requested}${detail}`);
}

console.log(
  `\ncheck-editions: ${editions.length} editions — ${editions.length - fails} OK, ${fails} FAIL`,
);
process.exit(fails ? 1 : 0);
