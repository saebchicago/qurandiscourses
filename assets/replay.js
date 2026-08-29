(function () {
  "use strict";

  // Guided replay engine (replay.html). Plays the recitation one verse
  // at a time through a SINGLE persistent Audio element (its user-gesture
  // unlock survives verse transitions — required on iOS), keeping the
  // current verse emphasized and lighting recurring-root words
  // progressively. Where data/exercises.json carries a transcribed Khan
  // outline for the surah, the section heading appears at each pivot.
  //
  // Everything shown is computed or transcribed — recurrence from the
  // bundled Leeds morphology, outline verbatim from exercises.json; the
  // page never characterizes what a verse means. If audio can't play
  // (offline, CDN blocked, or an autoplay rejection), the transport
  // drops to manual stepping and the highlighting still works.
  //
  // URL contract (whitelisted): ?s= surah 1..114 (must exist in
  // window.SURAHS), optional ?v= start verse clamped to verseCount.

  var surah = null; // canonical entry from window.SURAHS
  var morph = null; // data/morphology/{s}.json
  var arabicByAyah = {}; // ayah -> display text (API or morphology)
  var recurring = {}; // root -> {count, positions}
  var familyClass = {}; // root -> rg-K class for the top families
  var outline = null; // exercises.json outline entry or null
  var idx = 1; // current verse (1-based)
  var playing = false;
  var manualMode = false;
  var audio = null;

  var reduce = false;
  try {
    reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  // ── helpers ─────────────────────────────────────────────────────
  function $(id) {
    return document.getElementById(id);
  }

  function globalAyah(s, a) {
    // Cumulative verse count over the canonical dataset — no API needed.
    var total = 0;
    for (var i = 0; i < window.SURAHS.length && window.SURAHS[i].id < s; i++) {
      total += window.SURAHS[i].verseCount;
    }
    return total + a;
  }

  function computeRecurring(morphData) {
    // Same logic as read.html: roots attested >= 2x in this surah.
    var rootPos = {};
    Object.keys(morphData).forEach(function (ayah) {
      morphData[ayah].forEach(function (word) {
        if (!word.root) return;
        (rootPos[word.root] = rootPos[word.root] || []).push({
          a: parseInt(ayah, 10),
          w: word.w,
        });
      });
    });
    var out = {};
    Object.keys(rootPos).forEach(function (root) {
      if (rootPos[root].length >= 2)
        out[root] = { count: rootPos[root].length, positions: rootPos[root] };
    });
    return out;
  }

  function buildVerseHtml(ayah) {
    // Index-align display tokens to morphology words (read.html's
    // accepted heuristic; exact by construction on the morphology path).
    var text = arabicByAyah[ayah] || "";
    var words = morph[String(ayah)] || [];
    return text
      .split(/\s+/)
      .map(function (tok, i) {
        var w = words[i];
        if (!tok || !w || !w.root || !recurring[w.root]) return tok;
        var cls = familyClass[w.root] ? " " + familyClass[w.root] : "";
        return (
          '<span class="recurring-word' +
          cls +
          '" data-root="' +
          w.root +
          '" data-ayah="' +
          ayah +
          '">' +
          tok +
          "</span>"
        );
      })
      .join(" ");
  }

  // ── rendering ───────────────────────────────────────────────────
  function renderStack() {
    var stack = $("verseStack");
    var html = "";
    for (var a = 1; a <= surah.verseCount; a++) {
      html +=
        '<div class="card replay-verse" id="rv-' +
        a +
        '" style="margin:0 0 0.8rem">' +
        '<p style="margin:0 0 0.4rem;font-size:0.85rem;color:var(--accent);font-weight:600;font-variant-numeric:tabular-nums">' +
        surah.id +
        ":" +
        a +
        "</p>" +
        '<p class="ar xl notranslate" translate="no" lang="ar" dir="rtl" style="margin:0;font-size:1.7rem;line-height:2">' +
        buildVerseHtml(a) +
        "</p>" +
        "</div>";
    }
    stack.innerHTML = html;
  }

  function currentOutlineItem() {
    if (!outline) return null;
    var item = null;
    outline.outline.forEach(function (o) {
      if (o.startVerse <= idx) item = o;
    });
    return item;
  }

  function activate() {
    for (var a = 1; a <= surah.verseCount; a++) {
      var el = $("rv-" + a);
      if (!el) continue;
      el.classList.toggle("replay-active", a === idx);
      el.classList.toggle("replay-done", a < idx);
      // Progressive lighting: recurring words stay dim until reached.
      el.querySelectorAll(".recurring-word").forEach(function (w) {
        w.style.background = a <= idx ? "" : "transparent";
      });
    }
    var active = $("rv-" + idx);
    if (active)
      active.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "center",
      });

    var banner = $("outlineBanner");
    var item = currentOutlineItem();
    if (item) {
      banner.hidden = false;
      banner.innerHTML =
        "<h3>" + qdEsc(item.heading) + "</h3><p>" + qdEsc(item.note) + "</p>";
    } else {
      banner.hidden = true;
    }

    $("posLabel").textContent = "Verse " + idx + " of " + surah.verseCount;
    $("replayLive").textContent =
      "Verse " +
      surah.id +
      ":" +
      idx +
      (item ? ". Section: " + item.heading.replace(/<[^>]+>/g, "") : "");
  }

  // ── audio ───────────────────────────────────────────────────────
  function srcFor(a) {
    return (
      "https://cdn.islamic.network/quran/audio/128/" +
      (window.qdState && qdState.reciter ? qdState.reciter : "ar.husary") +
      "/" +
      globalAyah(surah.id, a) +
      ".mp3"
    );
  }

  function enterManualMode() {
    if (manualMode) return;
    manualMode = true;
    playing = false;
    $("audioNote").hidden = false;
    $("btnPlay").hidden = true;
  }

  function playCurrent() {
    if (manualMode) return;
    audio.src = srcFor(idx);
    var p = audio.play();
    if (p && p.catch) {
      p.then(function () {
        playing = true;
        $("btnPlay").textContent = "❚❚ Pause";
      }).catch(function () {
        enterManualMode();
      });
    }
  }

  function togglePlay() {
    if (manualMode) return;
    if (playing) {
      audio.pause();
      playing = false;
      $("btnPlay").textContent = "▶ Play";
    } else {
      playCurrent();
    }
  }

  function step(delta) {
    var next = Math.min(Math.max(idx + delta, 1), surah.verseCount);
    if (next === idx) {
      if (delta > 0 && idx === surah.verseCount) finish();
      return;
    }
    idx = next;
    activate();
    if (playing) playCurrent();
  }

  function finish() {
    playing = false;
    if (audio) audio.pause();
    $("btnPlay").textContent = "▶ Replay from start";
    $("btnPlay").dataset.restart = "1";
    if (window.qdSaveLastRead)
      window.qdSaveLastRead(surah.id, "1-" + surah.verseCount);
  }

  // ── reciter picker (read.html's modal pattern, simplified) ──────
  function reciterLabel() {
    var r = (window.qdReciters || []).find(function (x) {
      return x.id === qdState.reciter;
    });
    return r ? r.name : "";
  }

  function openReciterModal() {
    var modal = document.createElement("div");
    modal.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:1200";
    var opts = (window.qdReciters || [])
      .map(function (r) {
        return (
          '<button type="button" data-rec="' +
          r.id +
          '" style="display:block;width:100%;text-align:left;padding:0.7rem 1rem;border:0;background:' +
          (r.id === qdState.reciter ? "var(--bg)" : "var(--card)") +
          ';color:var(--ink);cursor:pointer;font:inherit">' +
          r.name +
          "</button>"
        );
      })
      .join("");
    modal.innerHTML =
      '<div style="background:var(--card);border-radius:8px;max-width:340px;width:90%;overflow:hidden;border:1px solid var(--line)">' +
      '<div style="padding:0.8rem 1rem;border-bottom:2px solid var(--accent);font-weight:600">Choose reciter</div>' +
      opts +
      "</div>";
    document.body.appendChild(modal);
    modal.addEventListener("click", function (e) {
      var b = e.target.closest("[data-rec]");
      if (b) {
        qdState.reciter = b.getAttribute("data-rec");
        if (window.qdSaveState) window.qdSaveState();
        $("reciterName").textContent = reciterLabel();
        if (playing) playCurrent();
      }
      modal.remove();
    });
  }

  // ── boot ────────────────────────────────────────────────────────
  function loadSurah(s) {
    surah = window.SURAHS.find(function (e) {
      return e.id === s;
    });
    idx = 1;
    manualMode = false;
    playing = false;
    $("audioNote").hidden = true;
    $("btnPlay").hidden = false;
    $("btnPlay").textContent = "▶ Play";
    delete $("btnPlay").dataset.restart;
    history.replaceState(null, "", "?s=" + surah.id);
    $("replayTitle").textContent =
      "Replay: " + surah.translit + " (" + surah.id + ")";
    document.title =
      "Replay " + surah.translit + " · Divine Discourses";
    $("verseStack").innerHTML = '<p style="color:var(--muted)">Loading…</p>';

    var morphP = fetch("data/morphology/" + surah.id + ".json").then(
      function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      },
    );
    var exP = fetch("data/exercises.json")
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .catch(function () {
        return null;
      });
    var apiP = window.qdFetchSurah
      ? window.qdFetchSurah(surah.id).catch(function () {
          return null;
        })
      : Promise.resolve(null);

    Promise.all([morphP, exP, apiP])
      .then(function (res) {
        morph = res[0];
        var exercises = res[1];
        var api = res[2];

        outline =
          (exercises &&
            exercises.exercises.find(function (e) {
              return e.type === "outline" && e.surah === surah.id;
            })) ||
          null;
        $("outlineProv").hidden = !outline;
        if (outline) {
          // Each outline names its own source (khan-exercise-2013 for most
          // surahs, khan-introduction-2011 for the six worked examples) —
          // never hardcode one book here, exercise.html reads the same two
          // fields per-entry for exactly this reason.
          if (outline.sourceIds) {
            $("outlineProvBadge").setAttribute(
              "data-source-ids",
              outline.sourceIds,
            );
          }
          $("outlineProvText").innerHTML = outline.provenanceHtml || "";
        }

        arabicByAyah = {};
        var offline = true;
        if (api && api[0] && api[0].ayahs) {
          offline = false;
          api[0].ayahs.forEach(function (ay) {
            arabicByAyah[ay.numberInSurah] = qdEsc(ay.text);
          });
        }
        if (offline) {
          Object.keys(morph).forEach(function (a) {
            arabicByAyah[a] = qdEsc(
              morph[a]
                .map(function (w) {
                  return w.ar;
                })
                .join(" "),
            );
          });
        }

        recurring = computeRecurring(morph);
        familyClass = {};
        Object.keys(recurring)
          .sort(function (a, b) {
            return recurring[b].count - recurring[a].count;
          })
          .forEach(function (root, i) {
            familyClass[root] = "rg-" + (i % 4);
          });

        renderStack();
        $("transport").hidden = false;
        var startV = parseInt(
          new URLSearchParams(location.search).get("v") || "1",
          10,
        );
        idx = Math.min(Math.max(isNaN(startV) ? 1 : startV, 1), surah.verseCount);
        activate();
        if (offline) {
          var note = document.createElement("p");
          note.className = "caption-note";
          note.textContent =
            "Offline view: Arabic text reassembled from the word-units bundled with this site (Leeds Quranic Arabic Corpus).";
          $("verseStack").prepend(note);
        }
      })
      .catch(function () {
        $("verseStack").innerHTML =
          '<p style="color:var(--muted)">Could not load the surah data. Please reload.</p>';
      });
  }

  function init() {
    if (!window.SURAHS || !window.SURAHS.length) return;

    // Surah picker
    var sel = $("surahSelect");
    window.SURAHS.forEach(function (e) {
      var o = document.createElement("option");
      o.value = e.id;
      o.textContent = e.id + ". " + e.translit;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      if (audio) audio.pause();
      loadSurah(parseInt(sel.value, 10));
    });

    // Whitelisted ?s=
    var s = parseInt(new URLSearchParams(location.search).get("s") || "103", 10);
    if (
      isNaN(s) ||
      !window.SURAHS.some(function (e) {
        return e.id === s;
      })
    )
      s = 103;
    sel.value = s;

    // One persistent Audio element: the gesture unlock from the Play
    // click must survive verse transitions (iOS).
    audio = new Audio();
    audio.preload = "none";
    audio.addEventListener("ended", function () {
      if (idx < surah.verseCount) {
        idx++;
        activate();
        // Synchronous src+play in the ended handler keeps iOS unlocked.
        audio.src = srcFor(idx);
        audio.play().catch(enterManualMode);
      } else {
        finish();
      }
    });
    audio.addEventListener("error", enterManualMode);

    $("btnPlay").addEventListener("click", function () {
      if (this.dataset.restart) {
        delete this.dataset.restart;
        idx = 1;
        activate();
      }
      togglePlay();
    });
    $("btnPrev").addEventListener("click", function () {
      step(-1);
    });
    $("btnNext").addEventListener("click", function () {
      step(1);
    });
    $("btnRestart").addEventListener("click", function () {
      idx = 1;
      activate();
      if (playing) playCurrent();
    });
    $("reciterBtn").addEventListener("click", openReciterModal);
    $("reciterName").textContent = reciterLabel();

    document.addEventListener("keydown", function (e) {
      if (e.target.matches("input,select,textarea")) return;
      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "Escape") {
        if (playing) {
          audio.pause();
          playing = false;
          $("btnPlay").textContent = "▶ Play";
          $("btnPlay").focus();
        }
      }
    });

    loadSurah(s);
  }

  if (document.readyState === "complete") {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
