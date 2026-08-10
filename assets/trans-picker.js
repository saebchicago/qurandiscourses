/* Wires the shared list-picker (assets/picker.js's qdPicker.openList) to
   the site's translation-editions registry (window.qdTranslations, from
   assets/app.js). One dialog, opened from either a per-verse button on
   Read or the gear panel's Translations row -- both call
   window.qdOpenTransPicker(trigger), and both get a search box, a
   translations-first "Selected" group, and per-language groups instead
   of the old un-searchable, un-batched checkbox list.

   Deliberately an adapter, not a rewrite: this file owns no dialog
   markup of its own (that lives in picker.js, reused so a translation
   dialog and a surah dialog cannot visually drift), and it never
   fetches or renders a verse -- it only reads/writes
   window.qdState.translations and dispatches qd:translations-changed,
   which every listener (read.html) already reacts to. */
(function () {
  "use strict";

  function langLabel(code) {
    return (window.QD_LANG_LABELS && window.QD_LANG_LABELS[code]) || code;
  }

  function editions() {
    return window.qdTranslations || [];
  }

  function buildItems() {
    return editions().map(function (t) {
      const lang = t.lang || "en";
      const label = langLabel(lang);
      return {
        id: t.id,
        primary: t.name,
        secondary: label,
        group: lang,
        searchText: t.name + " " + label + " " + t.id,
      };
    });
  }

  // Alphabetical by display label, not registration order, so the
  // dialog reads the way a reader would scan it rather than the order
  // languages happened to be added to assets/app.js over time.
  function buildGroups() {
    const seen = {};
    const langs = [];
    editions().forEach(function (t) {
      const lang = t.lang || "en";
      if (!seen[lang]) {
        seen[lang] = true;
        langs.push(lang);
      }
    });
    langs.sort(function (a, b) {
      return langLabel(a).localeCompare(langLabel(b));
    });
    return langs.map(function (lang) {
      return { key: lang, label: langLabel(lang) };
    });
  }

  // assets/picker.js is 28KB and holds two dialogs: the surah picker and
  // the generic list picker this file uses. Six pages host the surah
  // picker and load it eagerly; on the other 25 the ONLY way into
  // picker.js is the gear panel's Translations row, so it is loaded on
  // that first click instead of on every page load. Same lazy pattern as
  // compare.html's ensureRootsList().
  var pickerP = null;
  function ensurePicker() {
    if (window.qdPicker) return Promise.resolve(window.qdPicker);
    if (!pickerP) {
      pickerP = new Promise(function (resolve, reject) {
        // A failed <script> element is inert: it will never fire load or
        // error again. Removing it as part of clearing the memo is what
        // makes the retry a real retry -- leaving it behind meant the
        // next click appended nothing, waited on a dead element, and the
        // picker stayed unavailable until a full page reload. There is
        // deliberately no "adopt an existing tag" branch for the same
        // reason: pickerP is the only thing that tracks an in-flight
        // load, and any tag still in the document without it is a
        // failed one.
        var el = document.createElement("script");
        el.src = "assets/picker.js";
        el.setAttribute("data-qd-picker", "");
        el.onload = function () {
          resolve(window.qdPicker);
        };
        el.onerror = function () {
          el.remove();
          pickerP = null;
          reject(new Error("picker.js failed to load"));
        };
        var stale = document.querySelector("script[data-qd-picker]");
        if (stale) stale.remove();
        document.head.appendChild(el);
      });
    }
    return pickerP;
  }

  function open(trigger) {
    if (!window.qdState) return;
    if (!window.qdPicker) {
      ensurePicker()
        .then(function () {
          open(trigger);
        })
        .catch(function () {
          if (window.qdToast) window.qdToast("Could not open the translation picker.");
        });
      return;
    }
    window.qdPicker.openList({
      title: "Choose translations",
      searchPlaceholder: "Search by translator, language, or edition",
      confirmLabel: "Apply",
      emptyText: "No translation matches that.",
      items: buildItems(),
      groups: buildGroups(),
      selected: (window.qdState.translations || []).slice(),
      multi: true,
      minSelected: 1,
      trigger: trigger,
      onConfirm: function (ids) {
        if (!ids.length) return; // belt-and-suspenders; minSelected already guards this
        window.qdState.translations = ids;
        if (window.qdSaveState) window.qdSaveState();
        document.dispatchEvent(new CustomEvent("qd:translations-changed"));
      },
    });
  }

  // A short, real label for the current selection -- "Saheeh
  // International" for one, "Saheeh International + 2 more" for
  // several -- used by both the per-verse button and the gear panel row
  // so neither ever again just says a bare count.
  function summaryLabel() {
    const ids = (window.qdState && window.qdState.translations) || [];
    if (!ids.length) return "Choose translations";
    const byId = {};
    editions().forEach(function (t) {
      byId[t.id] = t;
    });
    const names = ids.map(function (id) {
      return (byId[id] && byId[id].name) || id;
    });
    if (names.length === 1) return names[0];
    return names[0] + " + " + (names.length - 1) + " more";
  }

  window.qdOpenTransPicker = open;
  window.qdTransPickerSummary = summaryLabel;
})();
