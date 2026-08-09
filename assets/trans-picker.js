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

  function open(trigger) {
    if (!window.qdPicker || !window.qdState) return;
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
