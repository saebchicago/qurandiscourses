(function () {
  "use strict";

  // Discovery worksheet: a blank, reader-authored structural-hypothesis form,
  // one per surah. This is NOT a site claim and never carries a ●/○/~
  // verification badge — it is the reader's own proposed theme, sectional
  // divisions, and supporting evidence, saved only in this browser.
  //
  // Distinct from assets/notebook.js (bookmarks) and assets/notes.js
  // (free-text per-verse notes): this is the one place on the site meant to
  // hold a reader's own attempt at outlining a whole surah, the way Khan's
  // published outlines do for the last thirty — an honest gap-closer that
  // never pretends to be Khan's outline, or a site-verified conclusion.
  //
  // Storage: localStorage key "qd_discovery_v1", keyed by surah number.
  // Mounts on any page with a #discoveryWorksheetSection element and
  // follows the qd:verse-loaded event from app.js (uses only e.detail.s).

  var KEY = "qd_discovery_v1";
  var KHAN_FIRST_SURAH = 85;
  var mount = null;
  var currentSurah = null;
  var exercisesCache = null;
  var saveTimer = null;

  function esc(v) {
    return window.qdEsc ? window.qdEsc(v) : String(v == null ? "" : v);
  }

  function loadAll() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch (e) {
      return {};
    }
  }
  function saveAll(all) {
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch (e) {
      // Private-browsing mode or quota exceeded: the form still works for
      // this page view, it just won't persist across reloads.
    }
  }

  function emptyEntry() {
    return { theme: "", sections: [], evidence: "", crossRefs: "", confidence: "draft" };
  }

  function outlineExerciseFor(surah) {
    if (!exercisesCache) return null;
    var found = null;
    exercisesCache.forEach(function (ex) {
      if (ex.type === "outline" && Number(ex.surah) === Number(surah)) found = ex;
    });
    return found;
  }

  function khanNoteHtml(surah) {
    var ex = outlineExerciseFor(surah);
    if (ex) {
      return (
        '<p class="ws-khan-note">Khan published an outline for this surah — it’s already ' +
        'transcribed as an exercise. <a href="exercise.html?id=' +
        encodeURIComponent(ex.id) +
        '">Propose your own there first</a>, then compare against his reading. This worksheet ' +
        "is a separate, freer space for your own notes.</p>"
      );
    }
    if (Number(surah) >= KHAN_FIRST_SURAH) {
      return (
        '<p class="ws-khan-note">Khan wrote a published outline for this surah in <em>An Exercise ' +
        "in Understanding the Qur'an</em> (2013); it hasn’t been transcribed onto this site yet. " +
        "Your worksheet below is entirely your own reading, not a substitute for his.</p>"
      );
    }
    return (
      '<p class="ws-khan-note">Khan’s 2013 book covers only surahs 85–114, so no published ' +
      "outline exists for this surah from that tradition. This is genuinely open territory — your " +
      "worksheet below is your own independent reading.</p>"
    );
  }

  function render() {
    if (!mount || currentSurah == null) return;
    var all = loadAll();
    var entry = all[currentSurah] || emptyEntry();

    var html =
      '<div class="card discovery-worksheet" style="margin-top:1.5rem">' +
      '<h3 style="display:flex;align-items:baseline;gap:0.6rem;flex-wrap:wrap">Discovery worksheet' +
      '<span style="font-size:0.78rem;font-weight:400;color:var(--muted)">your own reading, saved in this browser only — never sent anywhere, never a site claim</span></h3>' +
      khanNoteHtml(currentSurah) +
      '<label for="wsTheme">Proposed central theme</label>' +
      '<input id="wsTheme" type="text" value="' +
      esc(entry.theme) +
      '" placeholder="What is this surah, as a whole, about?" />' +
      '<label style="margin-top:0.7rem;display:block">Sectional divisions</label>' +
      '<div id="wsSections"></div>' +
      '<button type="button" class="button secondary" id="wsAddSection">+ Add a section</button>' +
      '<label for="wsEvidence" style="margin-top:0.9rem;display:block">Supporting evidence</label>' +
      '<textarea id="wsEvidence" rows="3" placeholder="Which recurring roots, word frequencies, or boundary markers (see Patterns) support these divisions? Cite what you looked at.">' +
      esc(entry.evidence) +
      "</textarea>" +
      '<label for="wsCrossRefs" style="margin-top:0.7rem;display:block">Cross-references</label>' +
      '<textarea id="wsCrossRefs" rows="2" placeholder="Related verses elsewhere in the Qur’an (see Mishkat cross-references on this surah’s verses).">' +
      esc(entry.crossRefs) +
      "</textarea>" +
      '<label for="wsConfidence" style="margin-top:0.7rem;display:block">Your own confidence <span style="font-weight:400;color:var(--muted)">(your rating, not a site verification label)</span></label>' +
      '<select id="wsConfidence">' +
      ["draft", "tentative", "confident"]
        .map(function (v) {
          var label = v === "draft" ? "Draft — just exploring" : v === "tentative" ? "Tentative — fairly sure" : "Confident — checked against the text carefully";
          return (
            '<option value="' + v + '"' + (entry.confidence === v ? " selected" : "") + ">" + label + "</option>"
          );
        })
        .join("") +
      "</select>" +
      '<p id="wsStatus" style="font-size:0.78rem;color:var(--muted);margin:0.5rem 0 0" aria-live="polite"></p>' +
      '<div class="share-row" style="margin-bottom:0">' +
      '<button type="button" class="button secondary share-btn" id="wsExport">Export all worksheets as Markdown</button>' +
      '<button type="button" class="button secondary share-btn" id="wsClear">Clear this surah’s worksheet</button>' +
      "</div>" +
      "</div>";

    mount.innerHTML = html;
    renderSections(entry.sections || []);
    wireEvents(entry);
  }

  function renderSections(sections) {
    var wrap = document.getElementById("wsSections");
    if (!wrap) return;
    wrap.innerHTML = "";
    sections.forEach(function (sec, i) {
      var row = document.createElement("div");
      row.className = "ws-section-row";

      var label = document.createElement("input");
      label.type = "text";
      label.placeholder = "Section label (e.g. \"opening address\")";
      label.value = sec.label || "";
      label.dataset.field = "label";
      label.dataset.index = String(i);

      var start = document.createElement("input");
      start.type = "number";
      start.min = "1";
      start.placeholder = "from ayah";
      start.value = sec.start || "";
      start.dataset.field = "start";
      start.dataset.index = String(i);

      var end = document.createElement("input");
      end.type = "number";
      end.min = "1";
      end.placeholder = "to ayah";
      end.value = sec.end || "";
      end.dataset.field = "end";
      end.dataset.index = String(i);

      var del = document.createElement("button");
      del.type = "button";
      del.className = "ws-section-remove";
      del.textContent = "×";
      del.setAttribute("aria-label", "Remove this section");
      del.dataset.index = String(i);

      row.appendChild(label);
      row.appendChild(start);
      row.appendChild(end);
      row.appendChild(del);
      wrap.appendChild(row);
    });
  }

  function collectSections() {
    var wrap = document.getElementById("wsSections");
    if (!wrap) return [];
    var rows = wrap.querySelectorAll(".ws-section-row");
    var sections = [];
    rows.forEach(function (row) {
      var label = row.querySelector('[data-field="label"]').value;
      var start = row.querySelector('[data-field="start"]').value;
      var end = row.querySelector('[data-field="end"]').value;
      sections.push({ label: label, start: start, end: end });
    });
    return sections;
  }

  // Always reads the live DOM for every field, so a debounced save for one
  // field can never clobber another field's not-yet-flushed edit (a shared
  // timer + partial patches would race and silently drop data).
  function formSnapshot() {
    var themeEl = document.getElementById("wsTheme");
    var evEl = document.getElementById("wsEvidence");
    var crEl = document.getElementById("wsCrossRefs");
    var confEl = document.getElementById("wsConfidence");
    return {
      theme: themeEl ? themeEl.value : "",
      sections: collectSections(),
      evidence: evEl ? evEl.value : "",
      crossRefs: crEl ? crEl.value : "",
      confidence: confEl ? confEl.value : "draft",
    };
  }

  function persist() {
    var all = loadAll();
    var entry = formSnapshot();
    var isEmpty =
      !entry.theme && !entry.evidence && !entry.crossRefs && (!entry.sections || !entry.sections.length);
    if (isEmpty) {
      delete all[currentSurah];
    } else {
      entry.updated = new Date().toISOString();
      all[currentSurah] = entry;
    }
    saveAll(all);
    var status = document.getElementById("wsStatus");
    if (status) status.textContent = isEmpty ? "" : "Saved.";
    return entry;
  }

  function debouncedPersist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
  }

  function wireEvents() {
    var themeEl = document.getElementById("wsTheme");
    if (themeEl) themeEl.addEventListener("input", debouncedPersist);
    var evEl = document.getElementById("wsEvidence");
    if (evEl) evEl.addEventListener("input", debouncedPersist);
    var crEl = document.getElementById("wsCrossRefs");
    if (crEl) crEl.addEventListener("input", debouncedPersist);
    var confEl = document.getElementById("wsConfidence");
    if (confEl) confEl.addEventListener("change", persist);
    var addBtn = document.getElementById("wsAddSection");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        var sections = collectSections();
        sections.push({ label: "", start: "", end: "" });
        renderSections(sections);
        wireSectionRows();
        persist();
      });
    }
    var exportBtn = document.getElementById("wsExport");
    if (exportBtn) exportBtn.addEventListener("click", exportMarkdown);
    var clearBtn = document.getElementById("wsClear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (!window.confirm("Clear this surah's worksheet? This cannot be undone.")) return;
        var all = loadAll();
        delete all[currentSurah];
        saveAll(all);
        render();
        if (window.qdToast) window.qdToast("Worksheet cleared");
      });
    }
    wireSectionRows();
  }

  function wireSectionRows() {
    var wrap = document.getElementById("wsSections");
    if (!wrap) return;
    wrap.querySelectorAll("input").forEach(function (input) {
      input.addEventListener("input", debouncedPersist);
    });
    wrap.querySelectorAll(".ws-section-remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var sections = collectSections();
        sections.splice(Number(btn.dataset.index), 1);
        renderSections(sections);
        wireSectionRows();
        persist();
      });
    });
  }

  function exportMarkdown() {
    var all = loadAll();
    var surahs = Object.keys(all).sort(function (a, b) {
      return Number(a) - Number(b);
    });
    var lines = [
      "# My Qur'an discovery worksheets",
      "",
      "Exported from Divine Discourses. These are my own proposed readings, not " +
        "site-verified claims and not Khan's published outlines.",
      "",
    ];
    surahs.forEach(function (s) {
      var e = all[s];
      lines.push("## Surah " + s);
      lines.push("");
      if (e.theme) lines.push("**Theme:** " + e.theme);
      if (e.sections && e.sections.length) {
        lines.push("");
        lines.push("**Sections:**");
        e.sections.forEach(function (sec) {
          lines.push("- " + (sec.label || "(untitled)") + " (" + (sec.start || "?") + "–" + (sec.end || "?") + ")");
        });
      }
      if (e.evidence) {
        lines.push("");
        lines.push("**Evidence:** " + e.evidence);
      }
      if (e.crossRefs) {
        lines.push("");
        lines.push("**Cross-references:** " + e.crossRefs);
      }
      lines.push("");
      lines.push("**My confidence:** " + (e.confidence || "draft"));
      lines.push("");
    });
    var blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "quran-discovery-worksheets.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 1000);
  }

  function init() {
    mount = document.getElementById("discoveryWorksheetSection");
    if (!mount) return;
    fetch("data/exercises.json")
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (d) {
        exercisesCache = d && d.exercises ? d.exercises : [];
        if (currentSurah != null) render();
      })
      .catch(function () {
        exercisesCache = [];
      });
    document.addEventListener("qd:verse-loaded", function (e) {
      currentSurah = e.detail.s;
      render();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
