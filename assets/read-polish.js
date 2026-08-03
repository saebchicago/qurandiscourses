/* Reading polish for the Read page.

   Six independent enhancements, each guarded so one failing cannot
   take the others down, and none of them owning any state the page
   already owns:

     1. Text size, with a separate larger-Arabic step
     2. One verse of audio at a time, with a visible stop state
     3. Per-verse actions: copy reference, copy text, dossier, corpus
     4. A slim sticky context header with Change and prev/next
     5. Keyboard: left/right for prev/next verse, "/" to search
     6. Error recovery: a way out of a failed fetch

   Verses are rendered by read.html's own script, so this observes the
   container rather than hooking into it. Prev/next and retry work by
   clicking the page's existing buttons: this file never fetches, never
   rewrites the URL, and never touches load().

   Preferences live in window.qdState, the single qd_state object, so
   "Clear preferences" still clears everything in one action. */
(function () {
  "use strict";

  var esc = function (v) {
    return window.qdEsc ? window.qdEsc(v) : String(v == null ? "" : v);
  };

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(function () {
    var container = document.getElementById("verseContainer");
    var surahInput = document.getElementById("surahInput");
    var ayahInput = document.getElementById("ayahInput");
    var prevBtn = document.getElementById("prevBtn");
    var nextBtn = document.getElementById("nextBtn");
    if (!container) return;

    // Read the state object on every access rather than capturing it
    // once: app.js populates it from storage in its own DOMContentLoaded
    // handler, so a reference taken here can be a state whose saved
    // fields have not been merged yet. Capturing it made a stored text
    // size silently fail to apply on load.
    function S() {
      return window.qdState;
    }
    function save() {
      if (window.qdSaveState) window.qdSaveState();
    }

    function surahById(id) {
      return (window.SURAHS || []).find(function (s) {
        return s.id === Number(id);
      });
    }

    // ── 1. Text size ────────────────────────────────────────────────
    // Scales the reading column only. The nav, settings, and page
    // chrome keep their sizes, so a large step cannot push the layout
    // off a narrow screen.
    var STEPS = [0.9, 1, 1.15, 1.3, 1.5];
    function readScale() {
      var st = S();
      var v = st && st.reading && st.reading.textScale;
      return STEPS.indexOf(v) !== -1 ? v : 1;
    }
    function readArabicBoost() {
      var st = S();
      return !!(st && st.reading && st.reading.arabicBoost);
    }
    function applyScale() {
      var root = document.documentElement;
      root.style.setProperty("--read-scale", String(readScale()));
      root.style.setProperty("--read-ar-scale", readArabicBoost() ? "1.25" : "1");
    }
    function setScale(next, boost) {
      var st = S();
      if (!st) return;
      if (!st.reading) st.reading = {};
      if (next != null) st.reading.textScale = next;
      if (boost != null) st.reading.arabicBoost = boost;
      save();
      applyScale();
      paintSizeButtons();
    }

    var sizeBar = null;
    function paintSizeButtons() {
      if (!sizeBar) return;
      var i = STEPS.indexOf(readScale());
      sizeBar.querySelector('[data-size="down"]').disabled = i <= 0;
      sizeBar.querySelector('[data-size="up"]').disabled = i >= STEPS.length - 1;
      var ar = sizeBar.querySelector('[data-size="arabic"]');
      ar.setAttribute("aria-pressed", readArabicBoost() ? "true" : "false");
    }

    function buildSizeBar() {
      var host = document.getElementById("pickerEntry") || container.parentNode;
      if (!host) return;
      sizeBar = document.createElement("div");
      sizeBar.className = "read-size";
      sizeBar.setAttribute("role", "group");
      sizeBar.setAttribute("aria-label", "Text size");
      sizeBar.innerHTML =
        '<span class="read-size-label t-annotation">Text size</span>' +
        '<button type="button" class="btn-utility" data-size="down" aria-label="Smaller text">A&minus;</button>' +
        '<button type="button" class="btn-utility" data-size="up" aria-label="Larger text">A+</button>' +
        '<button type="button" class="btn-utility" data-size="arabic" aria-pressed="false">Larger Arabic</button>';
      sizeBar.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("[data-size]");
        if (!b) return;
        var which = b.getAttribute("data-size");
        var i = STEPS.indexOf(readScale());
        if (which === "down") setScale(STEPS[Math.max(0, i - 1)], null);
        if (which === "up") setScale(STEPS[Math.min(STEPS.length - 1, i + 1)], null);
        if (which === "arabic") setScale(null, !readArabicBoost());
      });
      host.appendChild(sizeBar);
      paintSizeButtons();
    }
    applyScale();
    buildSizeBar();
    // app.js merges saved preferences in its own DOMContentLoaded
    // handler, whose order relative to this one is not guaranteed.
    // Re-apply once the current task drains so a stored size always
    // takes effect on load, not only after the next click.
    setTimeout(function () {
      applyScale();
      paintSizeButtons();
    }, 0);

    // ── 2. One verse of audio at a time ─────────────────────────────
    // The page renders a plain <audio controls> per verse, so several
    // could play over each other. Pausing the others on play is the
    // whole fix; the browser's own controls remain the stop state, and
    // the playing verse is marked so it is findable on a long page.
    container.addEventListener(
      "play",
      function (e) {
        var el = e.target;
        if (!el || el.tagName !== "AUDIO") return;
        container.querySelectorAll("audio").forEach(function (other) {
          if (other !== el && !other.paused) other.pause();
        });
        container.querySelectorAll(".verse.is-playing").forEach(function (v) {
          v.classList.remove("is-playing");
        });
        var verse = el.closest(".verse");
        if (verse) verse.classList.add("is-playing");
      },
      true,
    );
    container.addEventListener(
      "pause",
      function (e) {
        var verse = e.target.closest && e.target.closest(".verse");
        if (verse) verse.classList.remove("is-playing");
      },
      true,
    );

    // ── 3. Per-verse actions ────────────────────────────────────────
    function verseText(verse) {
      var ar = verse.querySelector(".ar.xl");
      var out = [];
      if (ar) out.push(ar.textContent.trim());
      verse.querySelectorAll(".translation").forEach(function (tr) {
        var label = tr.querySelector(".label");
        var text = tr.querySelector(".text");
        if (!text) return;
        out.push(
          text.textContent.trim() +
            (label ? " (" + label.textContent.trim() + ")" : ""),
        );
      });
      return out.join("\n");
    }

    function addActions(verse) {
      if (verse.querySelector(".verse-actions")) return;
      var ayah = verse.getAttribute("data-ayah");
      var s = parseInt(surahInput && surahInput.value, 10);
      if (!(s >= 1 && s <= 114) || !ayah) return;
      var ref = s + ":" + ayah;

      var row = document.createElement("p");
      row.className = "verse-actions";
      row.innerHTML =
        '<button type="button" class="btn-utility" data-act="ref">Copy reference</button>' +
        '<button type="button" class="btn-utility" data-act="text">Copy text</button>' +
        '<a class="btn-utility" href="/dossier?s=' + s + '">Open in Dossier</a>' +
        // Verse-level only: chapter and verse params, never a root-level
        // corpus link (the Buckwalter mapping for those is unresolved).
        '<a class="btn-utility" href="https://corpus.quran.com/wordbyword.jsp?chapter=' +
        s + '&verse=' + ayah + '" target="_blank" rel="noopener">View at corpus.quran.com</a>';

      row.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("[data-act]");
        if (!b || !window.qdCopyText) return;
        var act = b.getAttribute("data-act");
        var su = surahById(s);
        if (act === "ref") {
          window.qdCopyText(
            (su ? su.translit + " " : "") + ref,
            function (ok) {
              if (window.qdToast) window.qdToast(ok ? "Reference copied" : "Could not copy");
            },
          );
        } else {
          // Attribution rides along: the reference and the translation
          // name, so a pasted quotation says where it came from.
          var body = verseText(verse);
          window.qdCopyText(
            body + "\n" + (su ? su.translit + " " : "") + ref,
            function (ok) {
              if (window.qdToast) window.qdToast(ok ? "Text copied" : "Could not copy");
            },
          );
        }
      });
      verse.appendChild(row);
    }

    // ── 4. Sticky context header ────────────────────────────────────
    var ctxBar = null;
    function buildContext() {
      if (ctxBar) return;
      ctxBar = document.createElement("div");
      ctxBar.className = "read-context";
      ctxBar.hidden = true;
      ctxBar.innerHTML =
        '<span class="read-context-ref"></span>' +
        '<span class="read-context-actions">' +
        '<button type="button" class="btn-utility" data-ctx="change">Change</button>' +
        '<button type="button" class="btn-utility" data-ctx="prev" aria-label="Previous verse">&lsaquo;</button>' +
        '<button type="button" class="btn-utility" data-ctx="next" aria-label="Next verse">&rsaquo;</button>' +
        "</span>";
      ctxBar.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest("[data-ctx]");
        if (!b) return;
        var which = b.getAttribute("data-ctx");
        if (which === "change") {
          var open = document.getElementById("openPicker");
          if (open) open.click();
        }
        if (which === "prev" && prevBtn) prevBtn.click();
        if (which === "next" && nextBtn) nextBtn.click();
      });
      container.parentNode.insertBefore(ctxBar, container);
    }

    function paintContext() {
      if (!ctxBar) return;
      var s = parseInt(surahInput && surahInput.value, 10);
      var verses = container.querySelectorAll(".verse");
      if (!(s >= 1 && s <= 114) || !verses.length) {
        ctxBar.hidden = true;
        return;
      }
      var su = surahById(s);
      var first = verses[0].getAttribute("data-ayah");
      var last = verses[verses.length - 1].getAttribute("data-ayah");
      var ref = s + ":" + (first === last ? first : first + "-" + last);
      ctxBar.querySelector(".read-context-ref").textContent =
        (su ? su.translit + ", " : "") + ref;
      // Prev at surah 1 verse 1 and next at 114's end are the page's own
      // to decide; mirror whatever it has done with its buttons.
      ctxBar.querySelector('[data-ctx="prev"]').disabled = !!(
        prevBtn && prevBtn.disabled
      );
      ctxBar.querySelector('[data-ctx="next"]').disabled = !!(
        nextBtn && nextBtn.disabled
      );
      ctxBar.hidden = false;
    }
    buildContext();

    // ── 6. Error recovery ───────────────────────────────────────────
    function addRecovery() {
      var retry = document.getElementById("retryLoad");
      if (!retry || retry.parentNode.querySelector(".read-recover")) return;
      var a = document.createElement("a");
      a.className = "button secondary btn-secondary read-recover";
      a.href = "/read?s=1&a=1-7";
      a.textContent = "Read al-Fatihah";
      retry.parentNode.appendChild(a);
    }

    // One observer drives everything that depends on rendered verses.
    new MutationObserver(function () {
      container.querySelectorAll(".verse").forEach(addActions);
      paintContext();
      addRecovery();
    }).observe(container, { childList: true, subtree: true });

    container.querySelectorAll(".verse").forEach(addActions);
    paintContext();
    addRecovery();

    // ── 5. Keyboard ─────────────────────────────────────────────────
    document.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var el = document.activeElement;
      var typing =
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable);
      if (typing) return;
      // A dialog owns the keyboard while it is open.
      if (document.querySelector(".qd-picker")) return;

      if (e.key === "/") {
        // The Ask box sits inside the welcome card, which read.html
        // replaces when a passage loads, so fall back to the surah
        // field: whichever search the page is currently showing.
        var ask = document.getElementById("ask-input");
        var target =
          ask && ask.offsetParent !== null ? ask : surahInput;
        if (target) {
          e.preventDefault();
          target.focus();
          if (target.select) target.select();
        }
        return;
      }
      if (e.key === "ArrowLeft" && prevBtn && !prevBtn.disabled) {
        e.preventDefault();
        prevBtn.click();
      } else if (e.key === "ArrowRight" && nextBtn && !nextBtn.disabled) {
        e.preventDefault();
        nextBtn.click();
      }
    });
  });
})();
