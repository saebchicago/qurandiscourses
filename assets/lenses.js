(function () {
  "use strict";

  // Reading lenses: published coherence methods rendered as UI scaffolding,
  // driven by the data/lenses.json registry (checked by check-lenses.mjs).
  // The site describes each method — site-authored prose labeled ~ Nuanced
  // with its sources — and gives the reader a place to APPLY it. It never
  // asserts what a verse means, never fills in a reader's answer, and a
  // reader's answers never carry a ●/○/~ verification badge, exactly like
  // assets/discovery-worksheet.js (the free-form sibling of the ʿamūd
  // worksheet here; the two cross-link rather than duplicate).
  //
  // Distinct from index.html's daily-card "lens", which is a rotating
  // corpus statistic — these are reading lenses, a registry of methods.
  //
  // Mounts on any page with a #lensSection element (read.html,
  // dossier.html, replay.html). Surah comes from qd:verse-loaded when
  // app.js dispatches it (read), from ?s= otherwise (dossier, replay),
  // and from #surahSelect changes on replay, which re-point ?s= without
  // navigation.
  //
  // Storage: localStorage key "qd_lenses_v1" —
  //   { active, amud: { [surah]: { answers: { [questionId]: text }, updated } },
  //     history: { [surah]: { answers: { [questionId]: text }, updated } },
  //     ring: { [surah]: { pairs: [{aFrom,aTo,bFrom,bTo,label}], center, notes, updated } } }
  // Any question-bearing lens persists under its own id with the same
  // answers shape. Answers are keyed by question id so a reordered
  // registry never loses or misassigns a saved answer.

  var KEY = "qd_lenses_v1";
  var KHAN_FIRST_SURAH = 85;
  var mount = null;
  var currentSurah = null;
  var renderedSurah = null; // the surah the current DOM belongs to
  var lensesCache = null;
  var exercisesCache = null;
  var saveTimer = null;
  var statusTimer = null;

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

  function activeLens() {
    if (!lensesCache || !lensesCache.length) return null;
    var wanted = loadAll().active;
    var found = null;
    lensesCache.forEach(function (l) {
      if (l.id === wanted) found = l;
    });
    return found || lensesCache[0];
  }

  function outlineExerciseFor(surah) {
    if (!exercisesCache) return null;
    var found = null;
    exercisesCache.forEach(function (ex) {
      if (ex.type === "outline" && Number(ex.surah) === Number(surah)) found = ex;
    });
    return found;
  }

  function methodBadgeHtml(lens) {
    return (
      '<span class="badge nuanced" data-source-ids="' +
      esc(lens.sourceIds) +
      '" aria-label="Nuanced" tabindex="0" title="Nuanced · site-authored description of a published method">~</span> '
    );
  }

  // ── per-kind bodies ──────────────────────────────────────────────────

  function khanBodyHtml(surah) {
    var ex = outlineExerciseFor(surah);
    if (ex) {
      return (
        '<p class="lens-availability">Khan’s outline for this surah is transcribed. ' +
        '<a href="/exercise?id=' +
        encodeURIComponent(ex.id) +
        '">Propose your own structure first, then compare against his</a>.</p>'
      );
    }
    if (Number(surah) >= KHAN_FIRST_SURAH) {
      return (
        '<p class="lens-availability">Khan published an outline for this surah in his 2013 volume; ' +
        'it is not yet transcribed here — see <a href="/coverage#wanted-outlines">wanted transcriptions</a>. ' +
        "Until a human transcribes it page by page, this lens has nothing to show for this surah.</p>"
      );
    }
    return (
      '<p class="lens-availability">No published Khan outline exists for this surah — his outline volumes ' +
      "cover surahs 85–114 only. The site asserts no structure it cannot cite; try the ʿamūd " +
      "worksheet lens for your own reading.</p>"
    );
  }

  // The label + textarea loop every question-bearing lens shares (the
  // ʿamūd and history worksheets). Answers are the reader's own and are
  // never rendered with a ●/○/~ badge.
  function questionsHtml(lens, entry) {
    var answers = (entry && entry.answers) || {};
    var html = "";
    (lens.questions || []).forEach(function (q) {
      html +=
        '<label class="lens-q" for="lensQ-' +
        esc(q.id) +
        '">' +
        esc(q.prompt) +
        "</label>" +
        '<textarea id="lensQ-' +
        esc(q.id) +
        '" rows="2" data-qid="' +
        esc(q.id) +
        '">' +
        esc(answers[q.id] || "") +
        "</textarea>";
    });
    return html;
  }

  function amudBodyHtml(lens, entry) {
    // Cross-link to the free-form sibling: the discovery worksheet is on
    // read.html only, so link the in-page section there and the Read page
    // from dossier/replay.
    var wsHref = document.getElementById("discoveryWorksheetSection")
      ? "#discoveryWorksheetSection"
      : "/read?s=" + encodeURIComponent(currentSurah || "") + "#discoveryWorksheetSection";
    return (
      '<p class="lens-availability">Prefer free-form? The <a href="' +
      wsHref +
      '">discovery worksheet</a> collects your own sectioning with evidence; this lens asks the ʿamūd method’s questions specifically.</p>' +
      questionsHtml(lens, entry)
    );
  }

  // ── history lens (kind: context-panel) ──────────────────────────────

  // Lazily fetched on first activation: the conventional chronology and
  // the computed proper-noun index plus its editorial display labels.
  // null = not requested yet; "loading"; "failed"; or {chron, mentions,
  // names} once resolved.
  var historyData = null;

  var PERIOD_LABELS = {
    "meccan-early": "Meccan (early period)",
    "meccan-middle": "Meccan (middle period)",
    "meccan-late": "Meccan (late period)",
    medinan: "Medinan",
  };

  function ordinal(n) {
    var rem10 = n % 10;
    var rem100 = n % 100;
    if (rem10 === 1 && rem100 !== 11) return n + "st";
    if (rem10 === 2 && rem100 !== 12) return n + "nd";
    if (rem10 === 3 && rem100 !== 13) return n + "rd";
    return n + "th";
  }

  function nuancedBadge(ids, title) {
    return (
      '<span class="badge nuanced" data-source-ids="' +
      esc(ids) +
      '" aria-label="Nuanced" tabindex="0" title="' +
      esc(title) +
      '">~</span> '
    );
  }

  function okBadge(ids, title) {
    return (
      '<span class="badge ok" data-source-ids="' +
      esc(ids) +
      '" aria-label="Verified" tabindex="0" title="' +
      esc(title) +
      '">●</span> '
    );
  }

  function loadHistoryData() {
    if (historyData) return;
    historyData = "loading";
    Promise.all([
      fetch("data/chronology.json").then(function (r) {
        return r.ok ? r.json() : Promise.reject();
      }),
      fetch("data/name-mentions.json").then(function (r) {
        return r.ok ? r.json() : Promise.reject();
      }),
      fetch("data/names.json").then(function (r) {
        return r.ok ? r.json() : Promise.reject();
      }),
    ])
      .then(function (results) {
        historyData = {
          chron: results[0] || {},
          mentions: (results[1] && results[1].lemmas) || {},
          names: (results[2] && results[2].names) || {},
        };
        var lens = activeLens();
        if (lens && lens.id === "history" && currentSurah != null) render();
      })
      .catch(function () {
        // Offline with the data uncached: the worksheet still works;
        // the computed panels quietly say they could not load.
        historyData = "failed";
        var lens = activeLens();
        if (lens && lens.id === "history" && currentSurah != null) render();
      });
  }

  function historyWhenHtml(surah) {
    var c = historyData.chron[String(surah)];
    if (!c) return "";
    return (
      '<p class="lens-availability">' +
      nuancedBadge(
        "cairo-1924 noldeke-schwally-1909 watt-bell-1970",
        "Nuanced · Cairo 1924 revelation order; Nöldeke–Bell periods",
      ) +
      "Conventionally the <strong>" +
      ordinal(Number(c.revelationOrder)) +
      "</strong> of 114 in the Egyptian Standard revelation order — <strong>" +
      esc(PERIOD_LABELS[c.period] || c.period) +
      "</strong> in the Nöldeke–Bell classification. " +
      nuancedBadge(
        "sadeghi-goudarzi-2012",
        "Nuanced · manuscript evidence complicates precise sequencing",
      ) +
      "Order and period are a reading convention, not a documented record; " +
      "early-manuscript evidence complicates any precise sequencing.</p>"
    );
  }

  function historyWhoHtml(surah) {
    var rows = [];
    Object.keys(historyData.mentions).forEach(function (lemma) {
      var e = historyData.mentions[lemma];
      var count = e.bySurah[String(surah)];
      if (count) rows.push({ lemma: lemma, ar: e.ar, count: count });
    });
    rows.sort(function (a, b) {
      return b.count - a.count || (a.lemma < b.lemma ? -1 : 1);
    });

    var html = '<h4 class="lens-q">Proper names in this surah</h4>';
    if (!rows.length) {
      return (
        html +
        '<p class="lens-availability">' +
        okBadge("leeds-corpus-v0.4", "Verified · computed from the corpus's proper-noun tags") +
        "No proper names occur in this surah. Absence of a name is never " +
        "absence of a story — Surah 105 tells the Elephant narrative " +
        "without naming anyone.</p>"
      );
    }
    html += '<ul class="lens-name-list">';
    rows.forEach(function (row) {
      var label = historyData.names[row.lemma];
      var display;
      if (label) {
        display =
          esc(label.latin) + (label.en ? " (" + esc(label.en) + ")" : "");
      } else {
        // Unmapped lemma: the Arabic surface form, never bare Buckwalter
        // (which stays in the title attribute for the curious).
        display =
          '<span class="ar notranslate" translate="no" lang="ar" dir="rtl" title="' +
          esc(row.lemma) +
          '">' +
          esc(row.ar) +
          "</span>";
      }
      html +=
        "<li>" + display + " <span class=\"lens-name-count\">×" + row.count + "</span></li>";
    });
    html += "</ul>";
    html +=
      '<p class="caption-note">' +
      okBadge("leeds-corpus-v0.4", "Verified · computed from the corpus's proper-noun tags") +
      "Counts computed from the corpus's proper-noun tags — persons, places, " +
      "the divine name and eschatological names alike, so the divine name " +
      "dominates most lists, which is itself a distribution fact. " +
      nuancedBadge("leeds-corpus-v0.4", "Nuanced · editorial working labels, not dictionary quotations") +
      "Romanized labels are editorial working labels. Distribution does not " +
      "establish meaning, and a name's absence is never a story's absence.</p>";
    return html;
  }

  function historyBodyHtml(lens, entry) {
    var html = "";
    if (historyData === null) loadHistoryData();
    if (historyData === "loading" || historyData === null) {
      html += '<p class="lens-availability">Loading historical context…</p>';
    } else if (historyData === "failed") {
      html +=
        '<p class="lens-availability">The chronology and name data could not ' +
        "be loaded (offline?). The worksheet below still works.</p>";
    } else {
      html += historyWhenHtml(currentSurah) + historyWhoHtml(currentSurah);
    }
    html += '<h4 class="lens-q">Sirah worksheet — your own reading</h4>';
    html += questionsHtml(lens, entry);
    return html;
  }

  function ringBodyHtml() {
    // Rows are rendered separately (renderRingRows) so add/remove can
    // rebuild them without re-rendering the whole card.
    return (
      '<div id="lensRingRows"></div>' +
      '<button type="button" class="button secondary" id="lensRingAdd">+ Add a member pair</button>' +
      '<label class="lens-q" for="lensRingCenter">Proposed centre</label>' +
      '<input id="lensRingCenter" type="text" placeholder="e.g. ayah 5, or a range" />' +
      '<label class="lens-q" for="lensRingNotes">Notes on the correspondences</label>' +
      '<textarea id="lensRingNotes" rows="2" placeholder="What repeated wording or theme pairs each member with its mirror?"></textarea>'
    );
  }

  function renderRingRows(pairs) {
    var wrap = document.getElementById("lensRingRows");
    if (!wrap) return;
    wrap.innerHTML = "";
    pairs.forEach(function (pair, i) {
      var row = document.createElement("div");
      row.className = "lens-ring-row";

      var fields = [
        { field: "label", type: "text", placeholder: "pair label (e.g. A / A′)", value: pair.label },
        { field: "aFrom", type: "number", placeholder: "A from", value: pair.aFrom },
        { field: "aTo", type: "number", placeholder: "A to", value: pair.aTo },
        { field: "bFrom", type: "number", placeholder: "A′ from", value: pair.bFrom },
        { field: "bTo", type: "number", placeholder: "A′ to", value: pair.bTo },
      ];
      fields.forEach(function (f) {
        var input = document.createElement("input");
        input.type = f.type;
        if (f.type === "number") input.min = "1";
        input.placeholder = f.placeholder;
        input.setAttribute("aria-label", f.placeholder);
        input.value = f.value == null ? "" : f.value;
        input.dataset.field = f.field;
        input.dataset.index = String(i);
        row.appendChild(input);
      });

      var del = document.createElement("button");
      del.type = "button";
      del.className = "ws-section-remove";
      del.textContent = "×";
      del.setAttribute("aria-label", "Remove this member pair");
      del.dataset.index = String(i);
      row.appendChild(del);
      wrap.appendChild(row);
    });
  }

  function collectRingPairs() {
    var wrap = document.getElementById("lensRingRows");
    if (!wrap) return [];
    var pairs = [];
    wrap.querySelectorAll(".lens-ring-row").forEach(function (row) {
      var pair = {};
      row.querySelectorAll("input").forEach(function (input) {
        pair[input.dataset.field] = input.value;
      });
      pairs.push(pair);
    });
    return pairs;
  }

  // ── persistence ──────────────────────────────────────────────────────

  // Always reads the live DOM for every field, so a debounced save for one
  // field can never clobber another field's not-yet-flushed edit. Saves
  // under renderedSurah — the surah the DOM was rendered for — so a flush
  // that runs just after currentSurah moved on can never misfile answers.
  function persist() {
    var lens = activeLens();
    var forSurah = renderedSurah != null ? renderedSurah : currentSurah;
    if (!lens || forSurah == null) return;
    var all = loadAll();

    if (Array.isArray(lens.questions)) {
      var answers = {};
      var any = false;
      document.querySelectorAll("#lensBody textarea[data-qid]").forEach(function (t) {
        if (t.value) {
          answers[t.dataset.qid] = t.value;
          any = true;
        }
      });
      if (!all[lens.id]) all[lens.id] = {};
      if (any) {
        all[lens.id][forSurah] = { answers: answers, updated: new Date().toISOString() };
      } else {
        delete all[lens.id][forSurah];
      }
    } else if (lens.kind === "empty-overlay") {
      var centerEl = document.getElementById("lensRingCenter");
      var notesEl = document.getElementById("lensRingNotes");
      var pairs = collectRingPairs().filter(function (p) {
        return p.label || p.aFrom || p.aTo || p.bFrom || p.bTo;
      });
      var entry = {
        pairs: pairs,
        center: centerEl ? centerEl.value : "",
        notes: notesEl ? notesEl.value : "",
      };
      if (!all[lens.id]) all[lens.id] = {};
      if (entry.pairs.length || entry.center || entry.notes) {
        entry.updated = new Date().toISOString();
        all[lens.id][forSurah] = entry;
      } else {
        delete all[lens.id][forSurah];
      }
    }

    saveAll(all);
    var status = document.getElementById("lensStatus");
    if (status) {
      status.textContent = "Saved.";
      if (statusTimer) clearTimeout(statusTimer);
      statusTimer = setTimeout(function () {
        // Only clear our own message — never a different one that a
        // future code path may have put here in the meantime.
        if (status.textContent === "Saved.") status.textContent = "";
      }, 3000);
    }
  }

  function debouncedPersist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
  }

  // A re-render replaces the form wholesale, so any debounced edit still
  // waiting on its timer must be written out first or it is silently
  // lost (read.html re-fires qd:verse-loaded whenever translations or
  // verses finish loading).
  function flushPending() {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    persist();
  }

  // ── rendering ────────────────────────────────────────────────────────

  function render() {
    if (!mount || currentSurah == null || !lensesCache || !lensesCache.length) return;
    var lens = activeLens();
    var all = loadAll();
    var entry = (all[lens.id] || {})[currentSurah];

    var tabs = lensesCache
      .map(function (l) {
        var on = l.id === lens.id;
        return (
          '<button type="button" class="qd-chip' +
          (on ? " is-on" : "") +
          '" data-lens-id="' +
          esc(l.id) +
          '" aria-pressed="' +
          (on ? "true" : "false") +
          '">' +
          esc(l.name) +
          "</button>"
        );
      })
      .join("");

    // Body dispatch is by lens id — each lens owns its body function (a
    // new registry entry needs one added here). Kind is the validation
    // contract (check-lenses.mjs), not the render key: two lenses of the
    // same kind can render very differently.
    var body = "";
    if (lens.id === "khan-outline") body = khanBodyHtml(currentSurah);
    else if (lens.id === "amud") body = amudBodyHtml(lens, entry);
    else if (lens.id === "ring") body = ringBodyHtml();
    else if (lens.id === "history") body = historyBodyHtml(lens, entry);
    else if (Array.isArray(lens.questions)) body = questionsHtml(lens, entry);

    var html =
      // study-only: like the discovery worksheet, method scaffolding is
      // not part of the Simple "just read" layer; the html[data-depth]
      // CSS convention shows it again at Study or Encyclopedic depth.
      '<div class="card reading-lenses study-only">' +
      '<h3 style="display:flex;align-items:baseline;gap:0.6rem;flex-wrap:wrap">Reading lenses' +
      '<span style="font-size:0.78rem;font-weight:400;color:var(--muted)">published methods as scaffolding — your answers stay in this browser</span></h3>' +
      '<div class="lens-tabs" role="group" aria-label="Choose a reading lens">' +
      tabs +
      "</div>" +
      '<p class="lens-method">' +
      methodBadgeHtml(lens) +
      lens.methodHtml +
      "</p>" +
      '<div id="lensBody">' +
      body +
      "</div>" +
      '<p id="lensStatus" style="font-size:0.78rem;color:var(--muted);margin:0.5rem 0 0" aria-live="polite"></p>' +
      '<div class="share-row" style="margin-bottom:0">' +
      '<button type="button" class="button secondary share-btn" id="lensExport">Export all lens work as Markdown</button>' +
      '<button type="button" class="button secondary share-btn" id="lensClear">Clear this surah’s entries for this lens</button>' +
      "</div>" +
      '<p class="lens-coverage caption-note">' +
      ((lens.coverage && lens.coverage.statementHtml) || "") +
      "</p>" +
      "</div>";

    mount.innerHTML = html;

    if (lens.kind === "empty-overlay") {
      renderRingRows((entry && entry.pairs) || []);
      var centerEl = document.getElementById("lensRingCenter");
      if (centerEl && entry) centerEl.value = entry.center || "";
      var notesEl = document.getElementById("lensRingNotes");
      if (notesEl && entry) notesEl.value = entry.notes || "";
    }

    wireEvents(lens);
    if (window.qdCiteEnhance) window.qdCiteEnhance(mount);
    renderedSurah = currentSurah;
  }

  function wireEvents(lens) {
    mount.querySelectorAll("[data-lens-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        flushPending();
        var all = loadAll();
        all.active = btn.dataset.lensId;
        saveAll(all);
        render();
        // render() replaced the focused chip — put keyboard focus back on
        // the newly selected one instead of dropping to document start.
        var again = mount.querySelector('[data-lens-id="' + btn.dataset.lensId + '"]');
        if (again) again.focus();
      });
    });

    var exportBtn = document.getElementById("lensExport");
    if (exportBtn) exportBtn.addEventListener("click", exportMarkdown);
    var clearBtn = document.getElementById("lensClear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (!window.confirm("Clear this surah's entries for this lens? This cannot be undone.")) return;
        flushPending();
        var all = loadAll();
        if (all[lens.id]) delete all[lens.id][currentSurah];
        saveAll(all);
        render();
        if (window.qdToast) window.qdToast("Lens entries cleared");
      });
    }

    if (Array.isArray(lens.questions)) {
      mount.querySelectorAll("#lensBody textarea[data-qid]").forEach(function (t) {
        t.addEventListener("input", debouncedPersist);
      });
    }

    if (lens.kind === "empty-overlay") {
      wireRingRows();
      var addBtn = document.getElementById("lensRingAdd");
      if (addBtn) {
        addBtn.addEventListener("click", function () {
          var pairs = collectRingPairs();
          pairs.push({ label: "", aFrom: "", aTo: "", bFrom: "", bTo: "" });
          renderRingRows(pairs);
          wireRingRows();
          persist();
        });
      }
      var centerEl = document.getElementById("lensRingCenter");
      if (centerEl) centerEl.addEventListener("input", debouncedPersist);
      var notesEl = document.getElementById("lensRingNotes");
      if (notesEl) notesEl.addEventListener("input", debouncedPersist);
    }
  }

  function wireRingRows() {
    var wrap = document.getElementById("lensRingRows");
    if (!wrap) return;
    wrap.querySelectorAll("input").forEach(function (input) {
      input.addEventListener("input", debouncedPersist);
    });
    wrap.querySelectorAll(".ws-section-remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var pairs = collectRingPairs();
        pairs.splice(Number(btn.dataset.index), 1);
        renderRingRows(pairs);
        wireRingRows();
        persist();
      });
    });
  }

  // ── export ───────────────────────────────────────────────────────────

  // All reader lens work, every lens and every surah, in one Markdown
  // document — same posture as the discovery worksheet's export: this is
  // the reader's own reading, never a site claim.
  function buildLensMarkdown() {
    var all = loadAll();
    var lines = [
      "# My reading-lens notes",
      "",
      "Exported from Divine Discourses. These are my own readings through " +
        "published methods — not site-verified claims and not any scholar's " +
        "published analysis.",
      "",
    ];
    (lensesCache || []).forEach(function (lens) {
      var perSurah = all[lens.id];
      if (!perSurah) return;
      var surahs = Object.keys(perSurah).sort(function (a, b) {
        return Number(a) - Number(b);
      });
      if (!surahs.length) return;
      lines.push("## " + lens.name);
      lines.push("");
      surahs.forEach(function (s) {
        var e = perSurah[s];
        lines.push("### Surah " + s);
        lines.push("");
        if (e.answers) {
          (lens.questions || []).forEach(function (q) {
            if (e.answers[q.id]) {
              lines.push("**" + q.prompt + "**");
              lines.push("");
              lines.push(e.answers[q.id]);
              lines.push("");
            }
          });
        }
        if (e.pairs && e.pairs.length) {
          lines.push("**Candidate ring members:**");
          e.pairs.forEach(function (p) {
            lines.push(
              "- " +
                (p.label || "(unlabeled)") +
                ": " +
                (p.aFrom || "?") +
                "–" +
                (p.aTo || "?") +
                " ↔ " +
                (p.bFrom || "?") +
                "–" +
                (p.bTo || "?"),
            );
          });
          lines.push("");
        }
        if (e.center) {
          lines.push("**Proposed centre:** " + e.center);
          lines.push("");
        }
        if (e.notes) {
          lines.push("**Notes:** " + e.notes);
          lines.push("");
        }
        if (e.updated) {
          lines.push("_Last saved: " + e.updated + "_");
          lines.push("");
        }
      });
    });
    return lines.join("\n");
  }

  function exportMarkdown() {
    var blob = new Blob([buildLensMarkdown()], { type: "text/markdown;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "quran-reading-lenses.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 1000);
  }

  // ── boot ─────────────────────────────────────────────────────────────

  function surahFromUrl() {
    var s = Number(new URLSearchParams(window.location.search).get("s"));
    return Number.isInteger(s) && s >= 1 && s <= 114 ? s : null;
  }

  function init() {
    mount = document.getElementById("lensSection");
    if (!mount) return;

    Promise.all([
      fetch("data/lenses.json").then(function (r) {
        return r.ok ? r.json() : null;
      }),
      fetch("data/exercises.json").then(function (r) {
        return r.ok ? r.json() : null;
      }),
    ])
      .then(function (results) {
        lensesCache = results[0] && results[0].lenses ? results[0].lenses : [];
        exercisesCache = results[1] && results[1].exercises ? results[1].exercises : [];
        if (currentSurah != null) render();
      })
      .catch(function () {
        // Offline with nothing cached: render nothing rather than a
        // broken card — same fail-soft posture as discovery-worksheet.
        lensesCache = [];
        exercisesCache = [];
      });

    // read.html: app.js dispatches qd:verse-loaded with the loaded surah.
    document.addEventListener("qd:verse-loaded", function (e) {
      var s = e.detail.s;
      // Same surah and the card is already up: leave the DOM alone — a
      // re-render here would drop focus and any not-yet-flushed typing.
      if (s === currentSurah && mount && mount.firstChild) return;
      flushPending();
      currentSurah = s;
      render();
    });

    // dossier.html / replay.html: the surah lives in ?s= and there is no
    // qd:verse-loaded. On replay the select re-points ?s= via
    // replaceState without navigation, so follow its change events too.
    currentSurah = surahFromUrl();
    var select = document.getElementById("surahSelect");
    if (select) {
      if (currentSurah == null) currentSurah = 103; // replay.js's default
      select.addEventListener("change", function () {
        var s = Number(select.value);
        if (Number.isInteger(s) && s >= 1 && s <= 114 && s !== currentSurah) {
          flushPending();
          currentSurah = s;
          render();
        }
      });
    }
    if (currentSurah != null && lensesCache) render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
