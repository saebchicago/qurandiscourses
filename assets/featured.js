(function () {
  "use strict";

  // Shared featured-rotation + skim reflection.
  // The communal surah still changes once at midnight UTC for everyone.
  // A verse inside that surah rotates each UTC hour, and "Show another
  // verse" lets a spot-check prove the picker is alive without waiting.
  // The hero CTA also ticks hourly so the first screen is not frozen
  // on a day whose daily pick happens to be the static fallback.
  // Reflections write to the same localStorage key as assets/notes.js
  // (qd_notes) and never leave the browser.

  var NOTES_KEY = "qd_notes";
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
  function hoursMinutes(ms) {
    var h = Math.floor(ms / 3600000);
    var m = Math.floor((ms % 3600000) / 60000);
    if (h <= 0) return m + "m";
    return h + "h " + pad(m) + "m";
  }

  window.qdFeatured = {
    daysSinceEpoch: daysSinceEpoch,
    dailySurahNum: dailySurahNum,
    hoursSinceEpoch: hoursSinceEpoch,
  };

  function rotateHero() {
    var btn = document.querySelector(".hero-primary");
    if (!btn) return;
    var options = [
      {
        href: "/exercise?id=asr-outline",
        text: "Outline your first surah — al-'Asr, 3 verses",
      },
      {
        href: "/exercise-roots?s=112",
        text: "Spot the roots in al-Ikhlas — 4 verses",
      },
      {
        href: "/replay?s=" + dailySurahNum(),
        text: "Replay today's surah",
      },
      {
        href: "/exercise?id=ikhlas-outline",
        text: "Outline al-Ikhlas — 4 verses",
      },
      {
        href: "/exercise-roots?s=109",
        text: "Spot the roots in al-Kafirun",
      },
    ];
    var pick = options[hoursSinceEpoch() % options.length];
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
    var su = surahById(dailySurahNum());
    if (!su) return;

    var replayLink = document.getElementById("dailyReplayLink");
    if (replayLink) replayLink.href = "/replay?s=" + su.id;
    var readLink = document.getElementById("dailyReadLink");
    if (readLink) readLink.href = "/read?s=" + su.id + "&a=1-" + su.verseCount;
    var dossierLink = document.getElementById("dailyDossierLink");
    if (dossierLink) dossierLink.href = "/dossier?s=" + su.id;

    var intro = document.getElementById("dailyIntro");
    var meta = document.getElementById("dailyMeta");
    var wrap = document.getElementById("dailyVerseWrap");
    var verseAr = document.getElementById("dailyVerseAr");
    var verseLabel = document.getElementById("dailyVerseLabel");
    var nextBtn = document.getElementById("dailyNextVerse");
    var reflect = document.getElementById("reflectBox");
    if (!meta || !wrap || !verseAr || !verseLabel) return;

    if (intro) {
      intro.innerHTML =
        "<strong>Surah " +
        su.id +
        " · " +
        esc(su.translit) +
        "</strong> (<span class=\"ar notranslate\" translate=\"no\" lang=\"ar\" dir=\"rtl\">" +
        esc(su.ar) +
        "</span>) — “" +
        esc(su.en) +
        "”, " +
        su.verseCount +
        " verses, " +
        (su.cls === "m" ? "Meccan" : "Medinan") +
        ".";
    }

    var verseShift = 0;
    var morph = null;

    function currentVerse() {
      return 1 + ((hoursSinceEpoch() + verseShift) % su.verseCount);
    }

    function paintMeta() {
      var now = new Date();
      meta.textContent =
        "Live pick · " +
        utcStamp(now) +
        " · surah " +
        su.id +
        " of 114 · next surah in " +
        hoursMinutes(msUntilNextMidnight()) +
        ". Same surah for every reader; the verse below changes each hour.";
    }

    function paintVerse() {
      var v = currentVerse();
      verseLabel.innerHTML =
        "This hour’s verse · <a href=\"/read?s=" +
        su.id +
        "&a=" +
        v +
        "\">" +
        su.id +
        ":" +
        v +
        "</a>";
      wrap.hidden = false;
      if (morph && morph[String(v)]) {
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
    }

    paintMeta();
    setInterval(paintMeta, 30000);

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        verseShift += 1;
        paintVerse();
        nextBtn.textContent =
          verseShift % su.verseCount === 0
            ? "Show another verse"
            : "Show another verse (" + currentVerse() + " of " + su.verseCount + ")";
      });
    }

    fetch("data/morphology/" + su.id + ".json")
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        morph = data;
        paintVerse();
      })
      .catch(function () {
        paintVerse();
      });
  }

  function mountReflect(box) {
    if (!box) return;
    var ref = box.getAttribute("data-reflect-ref") || "";
    if (!ref) {
      box.innerHTML = "";
      return;
    }
    var notes = loadNotes();
    var existing = notes[ref] ? notes[ref].text : "";
    box.innerHTML =
      '<div class="card" style="margin-top:0.9rem;padding:0.85rem 1rem">' +
      '<p style="margin:0 0 0.45rem;font-size:0.92rem;font-weight:600">Notice something?</p>' +
      '<p class="caption-note" style="margin:0 0 0.45rem">One line, kept on this device. Not a commentary the site is making.</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.35rem;margin:0 0 0.45rem" id="reflectPrompts"></div>' +
      '<label class="visually-hidden" for="reflectArea">Quick reflection on ' +
      esc(ref) +
      "</label>" +
      '<textarea id="reflectArea" rows="2" style="width:100%;padding:0.55rem 0.65rem;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--ink);font:inherit;font-size:0.92rem;resize:vertical" placeholder="A turn in the discourse, a word that keeps returning, who is being addressed…">' +
      esc(existing) +
      "</textarea>" +
      '<p id="reflectStatus" style="font-size:0.78rem;color:var(--muted);margin:0.3rem 0 0" aria-live="polite">' +
      (existing ? "Saved on this device." : "") +
      "</p>" +
      '<p class="caption-note" style="margin:0.45rem 0 0"><a href="/read?s=' +
      esc(ref.split(":")[0]) +
      "&a=" +
      esc(ref.split(":")[1] || "1") +
      '#notesSection">Open the full notes panel</a></p>' +
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
          if (text.trim()) {
            all[ref] = { text: text, updated: new Date().toISOString() };
          } else {
            delete all[ref];
          }
          saveNotes(all);
          if (status)
            status.textContent = text.trim() ? "Saved on this device." : "";
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
