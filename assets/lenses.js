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
  //     ring: { [surah]: { pairs: [{aFrom,aTo,bFrom,bTo,label}], center, notes, updated } } }
  // Answers are keyed by question id so a reordered registry never loses
  // or misassigns a saved answer.

  var KEY = "qd_lenses_v1";
  var KHAN_FIRST_SURAH = 85;
  var mount = null;
  var currentSurah = null;
  var lensesCache = null;
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

  function amudBodyHtml(lens, entry) {
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
  // field can never clobber another field's not-yet-flushed edit.
  function persist() {
    var lens = activeLens();
    if (!lens || currentSurah == null) return;
    var all = loadAll();

    if (lens.kind === "blank-worksheet") {
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
        all[lens.id][currentSurah] = { answers: answers, updated: new Date().toISOString() };
      } else {
        delete all[lens.id][currentSurah];
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
        all[lens.id][currentSurah] = entry;
      } else {
        delete all[lens.id][currentSurah];
      }
    }

    saveAll(all);
    var status = document.getElementById("lensStatus");
    if (status) status.textContent = "Saved.";
  }

  function debouncedPersist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
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

    var body = "";
    if (lens.kind === "data-backed") body = khanBodyHtml(currentSurah);
    else if (lens.kind === "blank-worksheet") body = amudBodyHtml(lens, entry);
    else if (lens.kind === "empty-overlay") body = ringBodyHtml();

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
  }

  function wireEvents(lens) {
    mount.querySelectorAll("[data-lens-id]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var all = loadAll();
        all.active = btn.dataset.lensId;
        saveAll(all);
        render();
      });
    });

    if (lens.kind === "blank-worksheet") {
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
      currentSurah = e.detail.s;
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
        if (Number.isInteger(s) && s >= 1 && s <= 114) {
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
