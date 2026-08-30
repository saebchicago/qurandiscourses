(function () {
  "use strict";

  // Shared featured-rotation + skim reflection.
  // Communal default: one surah per UTC day, one verse per UTC hour.
  // Spot-checks were reading as frozen because those windows are long
  // and the static fallback is always al-Fatihah. Each visit in this
  // tab advances a local preview offset so a refresh is visibly live,
  // without changing what a first-time reader in another browser sees.
  // Reflections write to the same localStorage key as assets/notes.js
  // (qd_notes) and never leave the browser.

  var NOTES_KEY = "qd_notes";
  var VISIT_KEY = "qd_feat_visit";
  var PROMPTS = [
    { id: "pivot", label: "Where does it turn?", seed: "The discourse seems to turn when " },
    { id: "address", label: "Who is addressed?", seed: "The hearer being addressed here is " },
    { id: "repeat", label: "What keeps returning?", seed: "What keeps returning in this passage is " },
  ];

  function daysSinceEpoch() {
    return Math.floor(Date.now() / 86400000);
  }
  function dailySurahNum() {
    return 1 + (daysSinceEpoch() % 114);
  }
  function hoursSinceEpoch() {
    return Math.floor(Date.now() / 3600000);
  }
  function visitOffset() {
    var n = 0;
    try {
      n = parseInt(sessionStorage.getItem(VISIT_KEY) || "0", 10) || 0;
      n += 1;
      sessionStorage.setItem(VISIT_KEY, String(n));
    } catch (e) {
      n = 1;
    }
    return Math.max(0, n - 1);
  }
  function esc(v) {
    return window.qdEsc ? window.qdEsc(String(v)) : String(v);
  }
  function surahById(n) {
    return (
      (window.SURAHS || []).find(function (x) {
        return x.id === n;
      }) || null
    );
  }
  function loadNotes() {
    try {
      return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }
  function saveNotes(notes) {
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    } catch (e) {}
  }
  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }
  function utcStamp(d) {
    return (
      d.getUTCFullYear() +
      "-" +
      pad(d.getUTCMonth() + 1) +
      "-" +
      pad(d.getUTCDate()) +
      " " +
      pad(d.getUTCHours()) +
      ":" +
      pad(d.getUTCMinutes()) +
      " UTC"
    );
  }
  function msUntilNextMidnight() {
    var d = new Date();
    return (
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1) -
      d.getTime()
    );
  }
  function msUntilNextHour() {
    return 3600000 - (Date.now() % 3600000);
  }
  function hoursMinutes(ms) {
    var h = Math.floor(ms / 3600000);
    var m = Math.floor((ms % 3600000) / 60000);
    if (h <= 0) return m + "m";
    return h + "h " + pad(m) + "m";
  }
  function ensureButton(id, label, after) {
    var el = document.getElementById(id);
    if (el) return el;
    if (!after || !after.parentNode) return null;
    el = document.createElement("button");
    el.type = "button";
    el.id = id;
    el.className = "button secondary";
    el.textContent = label;
    el.style.marginInlineStart = "0.4rem";
    after.parentNode.insertBefore(el, after.nextSibling);
    return el;
  }

  var sessionVisit = visitOffset();

  window.qdFeatured = {
    daysSinceEpoch: daysSinceEpoch,
    dailySurahNum: dailySurahNum,
    hoursSinceEpoch: hoursSinceEpoch,
    sessionVisit: sessionVisit,
  };

  function rotateHero() {
    var btn = document.querySelector(".hero-primary");
    if (!btn) return;
    var options = [
      {
        href: "/exercise?id=asr-outline",
        text: "Outline al-'Asr",
      },
      {
        href: "/exercise-roots?s=112",
        text: "Spot the roots in al-Ikhlas",
      },
      {
        href: "/replay?s=" + dailySurahNum(),
        text: "Replay today",
      },
      {
        href: "/exercise?id=ikhlas-outline",
        text: "Outline al-Ikhlas",
      },
      {
        href: "/exercise-roots?s=109",
        text: "Spot the roots in al-Kafirun",
      },
      {
        href: "/exercise-roots?s=" + dailySurahNum(),
        text: "Spot today's roots",
      },
      {
        href: "/read?s=" + dailySurahNum() + "&a=1",
        text: "Read today from verse 1",
      },
    ];
    var pick = options[(hoursSinceEpoch() + sessionVisit) % options.length];
    btn.href = pick.href;
    btn.textContent = pick.text;
  }

  function rotateAskChips() {
    var row = document.querySelector(".ask-chips");
    if (!row) return;
    var su = surahById(dailySurahNum());
    if (!su) return;
    var chips = [
      { fill: su.translit.replace(/^al-/, ""), label: su.translit },
      { fill: su.id + ":1", label: su.id + ":1" },
      { fill: "r-h-m", label: "r-h-m" },
      { fill: "mercy", label: "mercy" },
    ];
    var buttons = row.querySelectorAll(".chip");
    chips.forEach(function (c, i) {
      if (!buttons[i]) return;
      buttons[i].setAttribute("data-fill", c.fill);
      buttons[i].textContent = c.label;
    });
  }

  function enhanceDailyCard() {
    var section = document.getElementById("dailySection");
    if (!section || !window.SURAHS || !window.SURAHS.length) return;

    var when = document.getElementById("dailyWhen");
    var intro = document.getElementById("dailyIntro");
    var meta = document.getElementById("dailyMeta");
    var wrap = document.getElementById("dailyVerseWrap");
    var verseAr = document.getElementById("dailyVerseAr");
    var verseLabel = document.getElementById("dailyVerseLabel");
    var nextVerseBtn = document.getElementById("dailyNextVerse");
    var nextSurahBtn = ensureButton(
      "dailyNextSurah",
      "Another surah",
      nextVerseBtn,
    );
    var reflect = document.getElementById("reflectBox");
    if (!meta || !wrap || !verseAr || !verseLabel) return;

    var communalNum = dailySurahNum();
    var surahShift = 0;
    var verseShift = sessionVisit;
    var morph = null;
    var morphSurah = 0;
    var su = surahById(communalNum);
    if (!su) return;

    function currentSurahNum() {
      return 1 + ((daysSinceEpoch() + surahShift) % 114);
    }
    function currentVerse() {
      return 1 + ((hoursSinceEpoch() + verseShift) % su.verseCount);
    }
    function isPreview() {
      return surahShift !== 0 || verseShift !== 0;
    }

    function applyLinks() {
      var replayLink = document.getElementById("dailyReplayLink");
      if (replayLink) replayLink.href = "/replay?s=" + su.id;
      var readLink = document.getElementById("dailyReadLink");
      if (readLink) readLink.href = "/read?s=" + su.id + "&a=1-" + su.verseCount;
      var dossierLink = document.getElementById("dailyDossierLink");
      if (dossierLink) dossierLink.href = "/dossier?s=" + su.id;
    }

    function paintIntro() {
      if (!intro) return;
      intro.innerHTML =
        "<strong>" +
        su.id +
        " · " +
        esc(su.translit) +
        "</strong> <span class=\"ar notranslate\" translate=\"no\" lang=\"ar\" dir=\"rtl\">" +
        esc(su.ar) +
        "</span>";
    }

    function paintWhen() {
      if (when) {
        when.textContent = su.id + ":" + currentVerse();
      }
      meta.textContent = "";
    }

    function paintVerse() {
      var v = currentVerse();
      verseLabel.innerHTML =
        "<a href=\"/read?s=" +
        su.id +
        "&a=" +
        v +
        "\">" +
        su.id +
        ":" +
        v +
        "</a>";
      wrap.hidden = false;
      if (morph && morphSurah === su.id && morph[String(v)]) {
        verseAr.textContent = morph[String(v)]
          .map(function (w) {
            return w.ar;
          })
          .join(" ");
      } else {
        verseAr.textContent = "";
      }
      if (reflect) reflect.setAttribute("data-reflect-ref", su.id + ":" + v);
      if (window.qdMountReflect) window.qdMountReflect(reflect);
      if (nextVerseBtn) {
        nextVerseBtn.textContent = "Another verse";
      }
      if (nextSurahBtn) {
        nextSurahBtn.textContent = "Another surah";
      }
    }

    function loadMorph() {
      var id = su.id;
      fetch("data/morphology/" + id + ".json")
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (data) {
          if (su.id !== id) return;
          morph = data;
          morphSurah = id;
          paintVerse();
        })
        .catch(function () {
          paintVerse();
        });
    }

    function adoptSurah() {
      su = surahById(currentSurahNum());
      if (!su) return;
      morph = null;
      morphSurah = 0;
      applyLinks();
      paintIntro();
      paintWhen();
      paintVerse();
      loadMorph();
    }

    if (nextVerseBtn) {
      nextVerseBtn.addEventListener("click", function () {
        verseShift += 1;
        paintWhen();
        paintVerse();
      });
    }
    if (nextSurahBtn) {
      nextSurahBtn.addEventListener("click", function () {
        surahShift += 1;
        verseShift = 0;
        adoptSurah();
      });
    }

    applyLinks();
    paintIntro();
    paintWhen();
    paintVerse();
    loadMorph();
    setInterval(paintWhen, 30000);
  }

  function mountReflect(box) {
    if (!box) return;
    var ref = box.getAttribute("data-reflect-ref") || "";
    if (!ref) {
      box.innerHTML = "";
      return;
    }
    if (box.getAttribute("data-reflect-mounted") === ref) {
      return;
    }
    box.setAttribute("data-reflect-mounted", ref);
    var notes = loadNotes();
    var existing = notes[ref] ? notes[ref].text : "";
    box.innerHTML =
      '<div style="margin-top:0.75rem">' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.35rem;margin:0 0 0.45rem" id="reflectPrompts"></div>' +
      '<label class="visually-hidden" for="reflectArea">Note on ' +
      esc(ref) +
      "</label>" +
      '<textarea id="reflectArea" rows="2" style="width:100%;padding:0.55rem 0.65rem;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font:inherit;font-size:0.92rem;resize:vertical" placeholder="What just turned?">' +
      esc(existing) +
      "</textarea>" +
      '<p id="reflectStatus" style="font-size:0.78rem;color:var(--muted);margin:0.3rem 0 0" aria-live="polite">' +
      (existing ? "Saved." : "") +
      "</p>" +
      "</div>";

    var area = box.querySelector("#reflectArea");
    var status = box.querySelector("#reflectStatus");
    var promptRow = box.querySelector("#reflectPrompts");
    var timer = null;
    PROMPTS.forEach(function (p) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "button secondary";
      b.style.minHeight = "36px";
      b.style.fontSize = "0.82rem";
      b.textContent = p.label;
      b.addEventListener("click", function () {
        if (!area) return;
        if (!area.value.trim()) area.value = p.seed;
        area.focus();
        area.dispatchEvent(new Event("input"));
      });
      promptRow.appendChild(b);
    });
    if (area) {
      area.addEventListener("input", function () {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () {
          var all = loadNotes();
          var text = area.value;
          var liveRef = box.getAttribute("data-reflect-ref") || ref;
          if (text.trim()) {
            all[liveRef] = { text: text, updated: new Date().toISOString() };
          } else {
            delete all[liveRef];
          }
          saveNotes(all);
          if (status)
            status.textContent = text.trim() ? "Saved." : "";
        }, 350);
      });
    }
  }
  window.qdMountReflect = mountReflect;

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(function () {
    rotateHero();
    rotateAskChips();
    enhanceDailyCard();
    document.querySelectorAll("#reflectBox[data-reflect-ref]").forEach(mountReflect);
  });
})();
