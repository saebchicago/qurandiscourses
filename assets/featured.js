(function () {
  "use strict";

  var NOTES_KEY = "qd_notes";
  var VISIT_KEY = "qd_feat_visit";
  var PROMPTS = [
    { id: "pivot", label: "Where does it turn?", seed: "The discourse seems to turn when " },
    { id: "address", label: "Who is addressed?", seed: "The hearer being addressed here is " },
    { id: "repeat", label: "What keeps returning?", seed: "What keeps returning in this passage is " },
  ];

  // Short enough to be one address on the first screen.
  var HERO = [
    { s: 103, act: "outline", href: "/exercise?id=asr-outline", doText: "Outline it" },
    { s: 112, act: "outline", href: "/exercise?id=ikhlas-outline", doText: "Outline it" },
    { s: 108, act: "roots", href: "/exercise-roots?s=108", doText: "Spot the roots" },
    { s: 110, act: "roots", href: "/exercise-roots?s=110", doText: "Spot the roots" },
    { s: 112, act: "roots", href: "/exercise-roots?s=112", doText: "Spot the roots" },
    { s: 109, act: "roots", href: "/exercise-roots?s=109", doText: "Spot the roots" },
    { s: 97, act: "roots", href: "/exercise-roots?s=97", doText: "Spot the roots" },
    { s: 106, act: "roots", href: "/exercise-roots?s=106", doText: "Spot the roots" },
    { s: 105, act: "roots", href: "/exercise-roots?s=105", doText: "Spot the roots" },
    { s: 1, act: "read", href: "/read?s=1&a=1-7", doText: "Read it" },
    { s: 114, act: "roots", href: "/exercise-roots?s=114", doText: "Spot the roots" },
    { s: 103, act: "roots", href: "/exercise-roots?s=103", doText: "Spot the roots" },
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
  function hide(el) {
    if (el) el.hidden = true;
  }

  var sessionVisit = visitOffset();
  var heroShift = sessionVisit;
  window.qdFeatured = {
    dailySurahNum: dailySurahNum,
    hoursSinceEpoch: hoursSinceEpoch,
    sessionVisit: sessionVisit,
  };

  function currentHero() {
    return HERO[(hoursSinceEpoch() + heroShift) % HERO.length];
  }

  function verseLine(id, v, words) {
    var ar = words
      ? words
          .map(function (w) {
            return w.ar;
          })
          .join(" ")
      : "";
    return (
      '<p class="ar notranslate" translate="no" lang="ar" dir="rtl" style="margin:0.15rem 0;font-size:1.45rem;line-height:1.9">' +
      (ar ? esc(ar) : "") +
      ' <a href="/read?s=' +
      id +
      "&a=" +
      v +
      '" style="font-size:0.72rem;opacity:0.55;margin-inline-start:0.35rem">' +
      id +
      ":" +
      v +
      "</a></p>"
    );
  }

  function rotateHero() {
    var hero = document.querySelector(".landing-hero");
    var btn = document.querySelector(".hero-primary");
    var secondary = document.querySelector(".hero-actions .btn-secondary, .hero-actions a.secondary");
    var title = document.getElementById("hero-title");
    if (!hero || !btn) return;

    var mount = document.getElementById("heroDisc");
    if (!mount) {
      mount = document.createElement("div");
      mount.id = "heroDisc";
      mount.style.margin = "0.4rem 0 1rem";
      if (title && title.parentNode) title.parentNode.insertBefore(mount, title.nextSibling);
      else hero.insertBefore(mount, hero.firstChild);
    }

    hide(document.querySelector(".hero-lede"));
    var tert = document.querySelector(".hero-tertiary");
    if (tert) tert.innerHTML = '<a href="/how-to-use">How to use</a>';

    var another = document.getElementById("heroAnother");
    if (!another && secondary) {
      another = document.createElement("button");
      another.type = "button";
      another.id = "heroAnother";
      another.className = "button secondary";
      another.textContent = "Another surah";
      secondary.parentNode.insertBefore(another, secondary.nextSibling);
      another.addEventListener("click", function () {
        heroShift += 1;
        paint();
      });
    }

    var morphCache = {};

    function paint() {
      var pick = currentHero();
      var su = surahById(pick.s);
      if (!su) return;
      if (title) {
        title.style.fontSize = "1.35rem";
        title.innerHTML =
          su.id +
          " \u00b7 " +
          esc(su.translit) +
          ' <span class="ar notranslate" translate="no" lang="ar" dir="rtl">' +
          esc(su.ar) +
          "</span>";
      }
      btn.href = pick.href;
      btn.textContent = pick.doText;
      if (secondary) {
        secondary.href = "/replay?s=" + su.id;
        secondary.textContent = "Replay";
      }

      function draw(morph) {
        var html = "";
        var n = su.verseCount;
        var i;
        for (i = 1; i <= n; i++) {
          html += verseLine(su.id, i, morph && morph[String(i)]);
        }
        mount.innerHTML = html;
      }

      if (morphCache[su.id]) {
        draw(morphCache[su.id]);
        return;
      }
      draw(null);
      fetch("data/morphology/" + su.id + ".json")
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (data) {
          if (currentHero().s !== su.id) return;
          morphCache[su.id] = data;
          draw(data);
        })
        .catch(function () {
          draw(null);
        });
    }

    paint();
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

  function quietHome() {
    var tag = document.querySelector("header.site .tag");
    if (tag) tag.textContent = "One surah at a time";
    hide(document.querySelector(".tag-khitab"));
    hide(document.querySelector(".hero-lede"));
    hide(document.querySelector(".ask-help"));
    var askLabel = document.getElementById("ask-label");
    if (askLabel) askLabel.textContent = "Open a passage";
    document.querySelectorAll(".workflow-desc").forEach(hide);
    hide(document.getElementById("welcomeBanner"));
    var lenses = document.getElementById("lensesSection");
    if (lenses) {
      var heading = lenses.querySelector("h2");
      if (heading) heading.textContent = "Try a lens";
      var lps = lenses.querySelectorAll("p");
      if (lps[0]) {
        lps[0].innerHTML =
          '<a href="/read?s=103&a=1-3">Open al-\'Asr</a> and mark its turns. <a href="/how-to-use">How to use</a> holds the method.';
      }
      if (lps[1]) hide(lps[1]);
    }
    var beginH = document.querySelector("#beginSection h2");
    if (beginH) beginH.textContent = "Begin";
    var intro = document.getElementById("dailyIntro");
    var wrap = document.getElementById("dailyVerseWrap");
    var reflect = document.getElementById("reflectBox");
    if (intro && wrap && intro.parentNode) {
      intro.parentNode.insertBefore(wrap, intro.nextSibling);
      if (reflect) intro.parentNode.insertBefore(reflect, wrap.nextSibling);
    }
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
    var nextSurahBtn = ensureButton("dailyNextSurah", "Another surah", nextVerseBtn);
    var reflect = document.getElementById("reflectBox");
    if (!meta || !wrap || !verseAr || !verseLabel) return;
    var surahShift = 0;
    var verseShift = sessionVisit;
    var morph = null;
    var morphSurah = 0;
    var su = surahById(dailySurahNum());
    if (!su) return;
    function currentSurahNum() {
      return 1 + ((daysSinceEpoch() + surahShift) % 114);
    }
    function currentVerse() {
      return 1 + ((hoursSinceEpoch() + verseShift) % su.verseCount);
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
        " \u00b7 " +
        esc(su.translit) +
        "</strong> <span class=\"ar notranslate\" translate=\"no\" lang=\"ar\" dir=\"rtl\">" +
        esc(su.ar) +
        "</span>";
    }
    function paintWhen() {
      if (when) when.textContent = su.id + ":" + currentVerse();
      if (meta) meta.textContent = "";
    }
    function paintVerse() {
      var v = currentVerse();
      verseLabel.innerHTML =
        "<a href=\"/read?s=" + su.id + "&a=" + v + "\">" + su.id + ":" + v + "</a>";
      wrap.hidden = false;
      if (morph && morphSurah === su.id && morph[String(v)]) {
        verseAr.textContent = morph[String(v)].map(function (w) { return w.ar; }).join(" ");
      }
      if (reflect) reflect.setAttribute("data-reflect-ref", su.id + ":" + v);
      if (window.qdMountReflect) window.qdMountReflect(reflect);
      if (nextVerseBtn) nextVerseBtn.textContent = "Another verse";
      if (nextSurahBtn) nextSurahBtn.textContent = "Another surah";
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
  }

  function mountReflect(box) {
    if (!box) return;
    var ref = box.getAttribute("data-reflect-ref") || "";
    if (!ref) {
      box.innerHTML = "";
      return;
    }
    if (box.getAttribute("data-reflect-mounted") === ref) return;
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
      "</p></div>";
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
          if (status) status.textContent = text.trim() ? "Saved." : "";
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
    quietHome();
    rotateHero();
    rotateAskChips();
    enhanceDailyCard();
    document.querySelectorAll("#reflectBox[data-reflect-ref]").forEach(mountReflect);
  });
})();
