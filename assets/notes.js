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

  function refLabel(ref) {
    return ref.replace("|", ":");
  }

  function render() {
    if (!mount) return;
    var notes = loadNotes();
    var refs = Object.keys(notes).sort(function (a, b) {
      return (notes[b].updated || "").localeCompare(notes[a].updated || "");
    });
    var current = currentRef && notes[currentRef];

    var html =
      '<div class="card" style="margin-top:1.5rem">' +
      '<h3 style="display:flex;align-items:baseline;gap:0.6rem;flex-wrap:wrap">My notes' +
      '<span style="font-size:0.78rem;font-weight:400;color:var(--muted)">saved in this browser only — never sent anywhere</span></h3>';

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
        '<details style="margin-top:0.4rem"><summary style="cursor:pointer;font-size:0.9rem">All notes (' +
        refs.length +
        ")</summary><ul style=\"list-style:none;padding:0;margin:0.6rem 0 0\">" +
        others
          .map(function (r) {
            var preview = (notes[r].text || "").slice(0, 90);
            return (
              '<li style="margin:0.45rem 0;font-size:0.88rem"><a href="read.html?s=' +
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
        "</div>";
    }
    html += "</div>";
    mount.innerHTML = html;

    var area = document.getElementById("noteArea");
    if (area) {
      area.addEventListener("input", function () {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
          var all = loadNotes();
          var text = area.value;
          if (text.trim()) {
            all[currentRef] = {
              text: text,
              updated: new Date().toISOString(),
            };
          } else {
            delete all[currentRef];
          }
          saveNotes(all);
          var status = document.getElementById("noteStatus");
          if (status) status.textContent = text.trim() ? "Saved." : "";
        }, 400);
      });
    }
    var exp = document.getElementById("notesExport");
    if (exp) exp.addEventListener("click", exportMarkdown);
    var del = document.getElementById("noteDelete");
    if (del)
      del.addEventListener("click", function () {
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

  function init() {
    mount = document.getElementById("notesSection");
    if (!mount) return;
    document.addEventListener("qd:verse-loaded", function (e) {
      currentRef = e.detail.s + ":" + e.detail.a;
      render();
    });
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
