/* Shared language-label and script-class lookups for translation
   editions, used by read.html, compare.html, and assets/trans-picker.js.
   Previously LANG_LABELS and the script-class map each lived inline
   inside read.html -- one rebuilt on every translation-picker click, the
   other rebuilt inside the per-verse render loop -- with no second copy
   for Compare at all, which is why Compare could not label or script a
   translation correctly. One shared, load-once copy here instead.

   scripts/check-editions.mjs parses QD_LANG_LABELS out of this file by
   regex to verify every registered edition's language has a label;
   update scripts/check-editions.mjs's regex if this declaration's shape
   changes. */
(function () {
  "use strict";

  const QD_LANG_LABELS = {
    en: "English",
    ur: "Urdu",
    bn: "Bengali",
    ms: "Malay",
    id: "Indonesian",
    fr: "French",
    es: "Spanish",
    tr: "Turkish",
    bs: "Bosnian",
    zh: "Chinese",
    ja: "Japanese",
    ko: "Korean",
    ru: "Russian",
    fa: "Persian",
    de: "German",
    hi: "Hindi",
    sw: "Swahili",
    ha: "Hausa",
    so: "Somali",
    uz: "Uzbek",
    az: "Azerbaijani",
    ps: "Pashto",
    ku: "Kurdish",
  };

  // Script-specific font classes. Urdu gets Nastaliq, Bengali gets Noto
  // Serif Bengali — both self-hosted, each with its own line-height.
  // Chinese, Japanese, and Korean get the reader's own system CJK face:
  // a subsetted CJK webfont still runs to megabytes, which is not a
  // trade this site makes for text every device can already render.
  // Latin-script editions (including Turkish and Bosnian, whose
  // diacritics live in the bundled latin-ext subsets) need nothing.
  const SCRIPT_CLASS = {
    ur: " nastaliq",
    bn: " bengali",
    hi: " devanagari",
    fa: " arabic-script",
    ps: " arabic-script",
    ku: " arabic-script",
    zh: " cjk",
    ja: " cjk",
    ko: " cjk",
  };

  // ── safeKey: the client↔data-file contract ────────────────────────
  // Encodes a Buckwalter root into the filename the site fetches its
  // per-root data from (data/root-analytics/{safeKey}.json and five
  // sibling directories). Get it wrong and the reader silently receives
  // a DIFFERENT root's statistics, or a 404 — the F1 failure class this
  // site already shipped a fix and a checker for.
  //
  // It used to exist in seven independent browser copies: roots.html,
  // themes.html, dossier.html, words.html, compare.html (twice, the
  // second renamed safeKeyS only to dodge a collision between two inline
  // blocks in the same file), and assets/embed.js. The header of
  // scripts/lib/safe-key.mjs listed all seven and justified them "by
  // necessity, no modules in browser inline JS" — which stopped being
  // true when this very file shipped, a plain non-module IIFE loaded on
  // every page. scripts/check-safe-key.mjs now asserts this
  // implementation and the generators' one agree on a fixed vector, so
  // the next drift fails CI instead of waiting for an audit.
  //
  // Uppercase Buckwalter letters → 'u'+letter; * (ذ) → 'dh'; $ (ش) → 'sh'.
  function safeKey(bw) {
    var out = "";
    for (var i = 0; i < bw.length; i++) {
      var c = bw[i];
      if (c === "*") out += "dh";
      else if (c === "$") out += "sh";
      else if (c >= "A" && c <= "Z") out += "u" + c;
      else out += c;
    }
    return out;
  }

  window.QD_LANG_LABELS = QD_LANG_LABELS;
  window.qdScriptClass = function (lang) {
    return SCRIPT_CLASS[lang] || "";
  };
  window.qdSafeKey = safeKey;
})();
