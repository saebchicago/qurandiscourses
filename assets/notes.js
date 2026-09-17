(function () {
  "use strict";

  // Reflection notes: the reader's own observations, attached to a verse
  // reference on the Read page. Khan's method ends in the reader's own
  // record — "the site only ordered the evidence" — so this gives that
  // record a home without the site asserting anything.
  //
  // Storage: localStorage key "qd_notes" (NOT qd_state), deliberately
  // separate so "Clear preferences" cannot destroy a reader's notes.
  // Notes never leave the browser; export writes a Markdown file to the
  // reader's own disk. Mounts on any page with a #notesSection element
  // and follows the qd:verse-loaded event from app.js.

  var KEY = "qd_notes";

  function loadNotes() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch (e) {
      return {};
    }
  }
  function saveNotes(notes) {
    try {
      localStorage.setItem(KEY, JSON.stringify(notes));
    } catch (e) {}
  }

  var mount = null;
  var currentRef = null;
  var saveTimer = null;
  var pendingSave = null;

  function refLabel(ref) {
    return ref.replace("|", ":");
  }

  // A note save is debounced, but the verse reference must not be. Keep
  // the pending write bound to the textarea/ref that produced it and flush
  // it before any action changes currentRef or replaces the note DOM.
  function flushPendingSave() {
    if (!pendingSave) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    var save = pendingSave;
    pendingSave = null;
    save();
  }

  function render() {
    if (!mount) return;
    var notes = loadNotes();
    var refs = Object.keys(notes).sort(function (a, b) {
      return (notes[b].updated || "").localeCompare(notes[a].updated || "");
    });
    var current = currentRef && notes[currentRef];

    // Collapsed at Simple depth (just reading), open at Study and
    // Encyclopedic (working). The reader can always open it manually.
    var depth = (window.qdState && window.qdState.depth) || "simple";
    var html =
      '<div class="card" style="margin-top:1.5rem">' +
      '<details class="xref-panel" style="margin-top:0;padding-top:0;border-top:0"' +
      (depth === "simple" ? "" : " open") +
      ">" +
      "<summary>My notes" +
      ' <span style="font-size:0.78rem;font-weight:400;color:var(--muted)">saved on this device only — never sent anywhere</span></summary>' +
      '<p class="caption-note">Export notes before clearing browser data or changing devices. Notes do not sync. <a href="/about#privacy">How storage works</a></p>';

    if (currentRef) {
      html +=
        '<label for="noteArea" style="font-size:0.9rem;font-weight:600">On ' +
        refLabel(currentRef) +
        "</label>" +
        '<textarea id="noteArea" rows="4" style="width:100%;margin:0.4rem 0 0.2rem;padding:0.6rem;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font:inherit;font-size:0.92rem;resize:vertical" placeholder="What do you notice? Where does the discourse pivot; which roots recur; what does this passage assume its hearer knows?">' +
        (current ? escapeHtml(current.text) : "") +
        "</textarea>" +
        '<p id="noteStatus" style="font-size:0.78rem;color:var(--muted);margin:0.15rem 0 0.6rem" aria-live="polite"></p>';
    } else {
      html +=
        '<p style="font-size:0.9rem;color:var(--muted)">Load a verse above to attach a note to it.</p>';
    }

    var others = refs.filter(function (r) {
      return r !== currentRef;
    });
    if (others.length) {
      html +=
        '<details class="xref-panel" style="margin-top:0.4rem">' +
        "<summary>All notes (" +
        refs.length +
        ")</summary><ul style=\"list-style:none;padding:0;margin:0.6rem 0 0\">" +
        others
          .map(function (r) {
            var preview = (notes[r].text || "").slice(0, 90);
            return (
              '<li style="margin:0.45rem 0;font-size:0.88rem"><a href="/read?s=' +
              r.split(":")[0] +
              "&a=" +
              encodeURIComponent(r.split(":")[1]) +
              '">' +
              refLabel(r) +
              "</a> — " +
              escapeHtml(preview) +
              (notes[r].text.length > 90 ? "…" : "") +
              "</li>"
            );
          })
          .join("") +
        "</ul></details>";
    }

    if (refs.length || currentRef) {
      html +=
        '<div class="share-row" style="margin-bottom:0">' +
        (refs.length
          ? '<button type="button" class="button secondary share-btn" id="notesExport">Export all as Markdown</button>'
          : "") +
        (currentRef && current
          ? '<button type="button" class="button secondary share-btn" id="noteDelete">Delete this note</button>'
          : "") +
        (refs.length
          ? '<button type="button" class="button secondary share-btn" id="notesDeleteAll">Delete all notes</button>'
          : "") +
        "</div>";
    }
    html += "</details></div>";
    mount.innerHTML = html;

    var area = document.getElementById("noteArea");
    if (area) {
      area.addEventListener("input", function () {
        if (saveTimer) clearTimeout(saveTimer);
        var ref = currentRef;
        var persist = function () {
          var all = loadNotes();
          var text = area.value;
          if (text.trim()) {
            all[ref] = {
              text: text,
              updated: new Date().toISOString(),
            };
          } else {
            delete all[ref];
          }
          saveNotes(all);
          // Do not paint a status into a different verse's freshly-rendered
          // note card if this write was flushed during navigation.
          if (currentRef === ref) {
            var status = document.getElementById("noteStatus");
            if (status) status.textContent = text.trim() ? "Saved." : "";
          }
        };
        pendingSave = persist;
        saveTimer = setTimeout(function () {
          saveTimer = null;
          if (pendingSave === persist) pendingSave = null;
          persist();
        }, 400);
      });
    }
    var exp = document.getElementById("notesExport");
    if (exp)
      exp.addEventListener("click", function () {
        flushPendingSave();
        exportMarkdown();
      });
    var deleteAll = document.getElementById("notesDeleteAll");
    if (deleteAll)
      deleteAll.addEventListener("click", function () {
        if (!window.confirm("Delete every study note saved in this browser? This cannot be undone.")) return;
        flushPendingSave();
        try {
          localStorage.removeItem(KEY);
        } catch (e) {}
        render();
        if (window.qdToast) window.qdToast("All notes deleted");
      });
    var del = document.getElementById("noteDelete");
    if (del)
      del.addEventListener("click", function () {
        flushPendingSave();
        var all = loadNotes();
        delete all[currentRef];
        saveNotes(all);
        render();
        if (window.qdToast) window.qdToast("Note deleted");
      });
  }

  function escapeHtml(v) {
    return window.qdEsc ? window.qdEsc(v) : v;
  }

  function exportMarkdown() {
    var notes = loadNotes();
    var refs = Object.keys(notes).sort(function (a, b) {
      var pa = a.split(":"), pb = b.split(":");
      return (
        Number(pa[0]) - Number(pb[0]) ||
        parseInt(pa[1], 10) - parseInt(pb[1], 10)
      );
    });
    var lines = [
      "# My Qur'an study notes",
      "",
      "Exported from Divine Discourses (notes are stored only in your own browser).",
      "",
    ];
    refs.forEach(function (r) {
      lines.push("## " + refLabel(r));
      lines.push("");
      lines.push(notes[r].text.trim());
      lines.push("");
    });
    var blob = new Blob([lines.join("\n")], {
      type: "text/markdown;charset=utf-8",
    });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "quran-study-notes.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 1000);
  }

  function focusNoteFor(ref, focus) {
    flushPendingSave();
    currentRef = ref;
    render();
    var details = mount.querySelector("details");
    if (details) details.open = true;
    try {
      mount.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch (err) {
      mount.scrollIntoView();
    }
    var area = document.getElementById("noteArea");
    if (focus && area) {
      try {
        area.focus({ preventScroll: true });
      } catch (e) {
        area.focus();
      }
    }
  }

  function init() {
    mount = document.getElementById("notesSection");
    if (!mount) return;
    document.addEventListener("qd:verse-loaded", function (e) {
      if (!e.detail) return;
      flushPendingSave();
      currentRef = e.detail.s + ":" + e.detail.a;
      render();
    });
    document.addEventListener("qd:note-verse", function (e) {
      if (!e.detail) return;
      document.documentElement.removeAttribute("data-focus");
      var focusButton = document.getElementById("focusToggleBtn");
      if (focusButton) focusButton.setAttribute("aria-pressed", "false");
      focusNoteFor(e.detail.s + ":" + e.detail.a, e.detail.focus !== false);
    });
    // The card's default open/closed state follows depth. Flush first so a
    // depth change cannot replace a textarea while its save still points
    // at mutable currentRef.
    document.addEventListener("qd:depth-changed", function () {
      flushPendingSave();
      render();
    });
    window.addEventListener("beforeunload", flushPendingSave);
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
