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

  window.QD_LANG_LABELS = QD_LANG_LABELS;
  window.qdScriptClass = function (lang) {
    return SCRIPT_CLASS[lang] || "";
  };
})();
