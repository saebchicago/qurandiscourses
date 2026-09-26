/* Reading polish for the Read page.

   Six independent enhancements, each guarded so one failing cannot
   take the others down, and none of them owning any state the page
   already owns:

     1. Text size, with a separate larger-Arabic step
     2. Reading state: fold the setup controls once a passage is shown
     3. Per-verse actions behind one "more" button: copy reference,
        copy text, reflect, dossier, corpus
     4. A slim sticky context header: the passage, its translations,
        Options, Change and prev/next
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

    var actionSeq = 0;
    function addActions(verse) {
      if (verse.querySelector(".verse-actions")) return;
      var ayah = verse.getAttribute("data-ayah");
      // The verse's own surah, not the form's: in a juz the form holds
      // the juz's first surah, so "Copy reference" on an al-Kahf verse
      // in juz 15 used to copy a surah-17 reference.
      var s = parseInt(
        verse.getAttribute("data-surah") || (surahInput && surahInput.value),
        10,
      );
      if (!(s >= 1 && s <= 114) || !ayah) return;
      var ref = s + ":" + ayah;

      // Four utility links on every verse were 154px of a 912px card,
      // repeated 286 times on al-Baqarah. They stay one tap away behind
      // a single button in the verse's header row.
      var row = document.createElement("p");
      row.className = "verse-actions";
      row.id = "va-" + ++actionSeq;
      row.hidden = true;
      row.innerHTML =
        '<button type="button" class="btn-utility" data-act="ref">Copy reference</button>' +
        '<button type="button" class="btn-utility" data-act="text">Copy text</button>' +
        '<button type="button" class="btn-utility" data-act="reflect">Reflect</button>' +
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
        if (act === "reflect") {
          document.dispatchEvent(
            new CustomEvent("qd:note-verse", {
              detail: { s: s, a: Number(ayah), focus: true },
            }),
          );
          return;
        }
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
      var meta = verse.querySelector(".meta");
      if (meta && !meta.querySelector(".verse-more-btn")) {
        var more = document.createElement("button");
        more.type = "button";
        more.className = "verse-more-btn";
        more.textContent = "⋯";
        more.setAttribute("aria-expanded", "false");
        more.setAttribute("aria-controls", row.id);
        more.setAttribute("aria-label", "More for " + ref + ": copy, reflect, dossier");
        more.addEventListener("click", function () {
          row.hidden = !row.hidden;
          more.setAttribute("aria-expanded", String(!row.hidden));
        });
        meta.appendChild(more);
      }
    }

    // ── 4. Sticky context header ────────────────────────────────────
    var ctxBar = null;
    function buildContext() {
      if (ctxBar) return;
      ctxBar = document.createElement("div");
      ctxBar.className = "read-context";
      ctxBar.hidden = true;
      ctxBar.innerHTML =
        // The passage's name IS the way to change it, the convention of
        // every reader app: tap the title, get the chooser. That saves a
        // separate "Change" button in a bar that has to fit 375px.
        '<button type="button" class="read-context-ref" data-ctx="change" aria-label="Change passage"></button>' +
        // The one translations control for the passage. It was repeated
        // at the head of every verse; .trans-open-btn keeps the picker's
        // focus-restore contract, and this bar survives the re-render
        // that a translation change triggers, so focus has a home.
        '<button type="button" class="read-context-trans trans-open-btn" data-ctx="translations"></button>' +
        '<span class="read-context-actions">' +
        '<button type="button" class="btn-utility" data-ctx="options" aria-expanded="false" aria-controls="readSetup">Options</button>' +
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
        if (which === "options") {
          setupOpen = !setupOpen;
          paintSetup();
          if (setupOpen) {
            var setup = document.getElementById("readSetup");
            if (setup) setup.scrollIntoView({ block: "start" });
          }
        }
        if (which === "translations" && window.qdOpenTransPicker) {
          window.qdOpenTransPicker(b);
        }
        if (which === "prev" && prevBtn) prevBtn.click();
        if (which === "next" && nextBtn) nextBtn.click();
      });
      container.parentNode.insertBefore(ctxBar, container);
    }

    // Reading state. With a passage on screen, the controls that choose
    // and set one up fold behind "Options" in the context bar, and the
    // site nav stops being sticky, so the text gets the screen. Folded
    // only by script: without it #readSetup is the whole interface.
    var setupOpen = false;
    function paintSetup() {
      var setup = document.getElementById("readSetup");
      var reading = !!container.querySelector(".verse");
      document.documentElement.classList.toggle("qd-reading", reading);
      if (setup) setup.hidden = reading && !setupOpen;
      if (ctxBar) {
        var opt = ctxBar.querySelector('[data-ctx="options"]');
        if (opt) opt.setAttribute("aria-expanded", String(!!setup && !setup.hidden));
      }
    }

    function paintContext() {
      if (!ctxBar) return;
      var verses = container.querySelectorAll(".verse");
      var s = parseInt(
        (verses[0] && verses[0].getAttribute("data-surah")) ||
          (surahInput && surahInput.value),
        10,
      );
      if (!(s >= 1 && s <= 114) || !verses.length) {
        ctxBar.hidden = true;
        return;
      }
      var su = surahById(s);
      var first = verses[0].getAttribute("data-ayah");
      var lastEl = verses[verses.length - 1];
      var last = lastEl.getAttribute("data-ayah");
      var lastS = parseInt(lastEl.getAttribute("data-surah"), 10) || s;
      var ref;
      if (lastS !== s) {
        // A juz, or any passage crossing a surah boundary.
        var lsu = surahById(lastS);
        ref = s + ":" + first + " to " + (lsu ? lsu.translit + " " : "") + lastS + ":" + last;
      } else {
        ref = s + ":" + (first === last ? first : first + "-" + last);
      }
      var refEl = ctxBar.querySelector(".read-context-ref");
      refEl.textContent = (su ? su.translit + ", " : "") + ref + " ▾";
      refEl.setAttribute("aria-label", "Change passage (now " + (su ? su.translit + ", " : "") + ref + ")");
      var transEl = ctxBar.querySelector(".read-context-trans");
      if (transEl) {
        transEl.textContent = window.qdTransPickerSummary
          ? window.qdTransPickerSummary()
          : "";
      }
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
    // A DIFFERENT passage folds Options again: the reader asked for
    // text, and the text is what should be on screen. A re-render of the
    // same passage (a translation or depth change made from inside
    // Options) leaves it as the reader left it.
    var lastSig = "";
    function onRender() {
      var verses = container.querySelectorAll(".verse");
      verses.forEach(addActions);
      var sig = verses.length
        ? verses[0].getAttribute("data-ar-number") + "+" + verses.length
        : "";
      if (sig && sig !== lastSig) setupOpen = false;
      lastSig = sig;
      paintContext();
      paintSetup();
      addRecovery();
    }
    new MutationObserver(onRender).observe(container, { childList: true, subtree: true });
    onRender();

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
