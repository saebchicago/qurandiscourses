// Deterministic client-side router for the Ask box.
// Pattern-matching only — no external calls, nothing composes answers.

(function () {
  const SURAHS = window.SURAHS || [];

  // Routing tables live in data/ask-routes.json, generated into
  // assets/ask-routes.js (window.QD_ASK_ROUTES) so there is no fetch
  // race on the page's most-used control. check-ask.mjs proves every
  // target resolves; missing tables degrade to no routing rather than
  // an error.
  const ROUTES = window.QD_ASK_ROUTES || {
    themes: {},
    pages: {},
    glossary: {},
    juz: [],
  };
  const JUZ = ROUTES.juz || [];

  // Naming a chapter means the chapter, not its first line. Every route
  // that resolves to a surah hands back the whole thing; read.html
  // already fetches the entire surah for any multi-verse range, so this
  // costs nothing it was not already paying. Falls back to verse 1 only
  // if the surah dataset has not loaded.
  function wholeSurah(id) {
    const meta = SURAHS.find((x) => x.id === Number(id));
    return meta
      ? `/read?s=${id}&a=1-${meta.verseCount}`
      : `/read?s=${id}&a=1`;
  }

  function normalize(s) {
    return s
      .toLowerCase()
      .trim()
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
      .replace(/[''`]/g, "")
      .replace(/[ʿʾ]/g, "")
      .replace(/[āáà]/g, "a")
      .replace(/[īíì]/g, "i")
      .replace(/[ūúù]/g, "u")
      .replace(/[ḥ]/g, "h")
      .replace(/[ṣ]/g, "s")
      .replace(/[ḍ]/g, "d")
      .replace(/[ṭ]/g, "t")
      .replace(/[ẓ]/g, "z");
  }

  // Arabic-script normalization: strip tashkeel, superscript alef, and
  // tatweel; unify alef and ya variants; drop a leading "سورة ". A
  // deterministic character mapping, like normalize() above — no lookup
  // beyond the mushaf orthography already carried in surahs.js.
  function normalizeArabic(s) {
    return s
      .replace(/[ً-ٰٟـ]/g, "")
      .replace(/[آأإٱ]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/^\s*سورة\s+/, "")
      .trim();
  }

  // Strip a leading definite article so "فاتحة" still finds "الفاتحة".
  function dropAl(s) {
    return s.replace(/^ال/, "");
  }

  function parseAsk(input) {
    const raw = (input || "").trim();
    if (!raw)
      return {
        route: null,
        reason: "empty",
        message:
          "Type a surah name or number, a verse like 1:1, a root like r-h-m, or a keyword.",
      };
    const q = normalize(raw);

    // Verse: 1:1, 1.1, 1 1
    const verseMatch = q.match(/^(\d{1,3})\s*[:.\s]\s*(\d{1,4})$/);
    if (verseMatch) {
      const s = +verseMatch[1],
        a = +verseMatch[2];
      if (s < 1 || s > 114)
        return {
          route: null,
          reason: "range",
          message: "Surah numbers run 1 to 114.",
        };
      if (a < 1)
        return {
          route: null,
          reason: "range",
          message: "Verse numbers start at 1.",
        };
      const meta = SURAHS.find((x) => x.id === s);
      if (meta && a > meta.verseCount)
        return {
          route: null,
          reason: "range",
          message: `${meta.translit} (surah ${s}) has ${meta.verseCount} verses.`,
        };
      return { route: `/read?s=${s}&a=${a}`, type: "verse" };
    }

    // "surah 36", "chapter 2", "s 36" — a numbered reference spelled
    // out. These used to fall through to the search page, which is
    // absurd for the least ambiguous thing a reader can type.
    const namedSurah = q.match(/^(?:surah?|chapter|sura|s)\s*(\d{1,3})$/);
    if (namedSurah) {
      const s = +namedSurah[1];
      if (s >= 1 && s <= 114)
        return { route: wholeSurah(s), type: "surah" };
      return {
        route: null,
        reason: "range",
        message: "Surah numbers run 1 to 114.",
      };
    }

    // "juz 5", "para 5", "sipara 5", "chapter-of-thirty" — the same
    // division under the names it goes by. Routes to the juz's first
    // verse, which is the place, not a page about the place.
    const juzMatch = q.match(/^(?:juz|para|sipara|jusu)\s*(\d{1,2})$/);
    if (juzMatch) {
      const n = +juzMatch[1];
      if (n >= 1 && n <= 30) {
        const j = JUZ.find((x) => x.juz === n);
        if (j)
          return {
            route: `/read?s=${j.startSurah}&a=${j.startAyah}`,
            type: "juz",
            match: `Juz ${n}`,
          };
        return { route: `/navigate`, type: "juz" };
      }
      return {
        route: null,
        reason: "range",
        message: "The Qur'an is divided into 30 juz.",
      };
    }

    // Bare surah number
    const surahNumMatch = q.match(/^(\d{1,3})$/);
    if (surahNumMatch) {
      const s = +surahNumMatch[1];
      if (s >= 1 && s <= 114)
        return { route: wholeSurah(s), type: "surah" };
      return {
        route: null,
        reason: "range",
        message: "Surah numbers run 1 to 114.",
      };
    }

    // Does the word ALSO name something this site covers in its own
    // right? A surah alias that is equally a theme, a page or a
    // glossary term is ambiguous by evidence rather than by guess:
    // "light" is al-Nur and the guidance theme; "pilgrimage" is al-Hajj
    // and the pilgrimage theme; "repentance" is al-Tawbah and the
    // forgiveness theme. Silently opening the chapter was the single
    // worst thing the Ask box did — it swallowed the concept whole.
    const alsoConcept = (w) =>
      Boolean(ROUTES.themes[w] || ROUTES.pages[w] || ROUTES.glossary[w]);

    // Exact surah name FIRST: 20 documented aliases are exactly three
    // Latin letters (hud, nas, asr, sun, pen, …), so the bare-root rule
    // below would otherwise capture them — surah 11 has no name that
    // isn't. Exact-name-then-root is also the Arabic branch's precedence
    // (نوح is the surah, not a root guess). The separated spelling
    // (a-s-r) never equals an alias, so it still reaches the Roots page.
    // "Baqarah", "Yasin", "al-Kahf", "cow", "women" name nothing else
    // here, so they still go straight to the surah; only a genuine
    // collision is handed to the grouped search.
    const surahByName = SURAHS.find((s) => s.names.some((n) => normalize(n) === q));
    if (surahByName && !alsoConcept(q))
      return {
        route: wholeSurah(surahByName.id),
        type: "surah-name",
        match: surahByName.en,
      };
    if (surahByName)
      return {
        route: `/search?q=${encodeURIComponent(raw)}`,
        type: "search",
        note: "ambiguous",
      };

    // Separated root only: r-h-m, r.h.m. The bare three-letter form is
    // NOT treated as a root — "sin" is an English word, and turning it
    // into the invented root s-i-n served nobody. Bare letters still
    // reach the Roots page when they are a real root (checked against
    // the generated root list) or via /search otherwise.
    const rootSep = q.match(/^([a-z])[-.\s]([a-z])[-.\s]([a-z])$/);
    if (rootSep) {
      return {
        route: `/roots?q=${rootSep[1]}-${rootSep[2]}-${rootSep[3]}`,
        type: "root",
      };
    }

    // Arabic-script surah name: "الفاتحة", "سورة يس", or "فاتحة"
    if (/[؀-ۿ]/.test(raw)) {
      const qa = normalizeArabic(raw);
      const surahAr = SURAHS.find(
        (s) =>
          s.ar &&
          (normalizeArabic(s.ar) === qa ||
            dropAl(normalizeArabic(s.ar)) === dropAl(qa)),
      );
      if (surahAr)
        return {
          route: wholeSurah(surahAr.id),
          type: "surah-name",
          match: surahAr.en,
        };

      // Arabic-script root: "رحم", "ر ح م", "رَحِمَ". Deliberately placed
      // after the surah-name check above: نوح and فجر are each three
      // Arabic letters and a plausible root, and the surah must win —
      // the exact-name-first precedence the Latin path uses. roots.html
      // resolves the letters against rootArabic; no Buckwalter table is
      // duplicated here. The bare form is tried first so real roots that
      // begin alif-lam (اله) are untouched; only when it fails the shape
      // test is the definite article dropped, so الرحمة finds رحمة.
      const bare = qa.replace(/[\s\-.]/g, "");
      const rootShape = /^[ء-ي]{3,4}$/;
      const arRoot = rootShape.test(bare)
        ? bare
        : rootShape.test(dropAl(bare))
          ? dropAl(bare)
          : null;
      if (arRoot) {
        return {
          route: `/roots?q=${encodeURIComponent(arRoot)}`,
          type: "root",
        };
      }
    }

    const THEME_WORDS = ROUTES.themes;
    if (THEME_WORDS[q]) {
      return { route: `/themes#${THEME_WORDS[q]}`, type: "theme" };
    }

    // Page names ("changelog", "export") and glossary terms ("nazm",
    // "hapax", "llr") are destinations, not corpus queries. Both maps
    // are validated by check-ask.mjs.
    if (ROUTES.pages[q]) {
      return { route: ROUTES.pages[q], type: "page" };
    }
    if (ROUTES.glossary[q]) {
      return { route: ROUTES.glossary[q], type: "glossary" };
    }

    // Did-you-mean, one edit away: "bakarah" should reach al-Baqarah,
    // not a roots query. Runs only for a single word of 4+ letters,
    // and only when exactly ONE surah is that close — two candidates
    // means the guess would be arbitrary, so the word falls through to
    // the ordinary routes below.
    if (/^[a-z'-]{4,}$/.test(q)) {
      const withinOne = (a, b) => {
        if (Math.abs(a.length - b.length) > 1) return false;
        if (a === b) return true;
        // One substitution, insertion, or deletion.
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
          if (a[i] !== b[i]) {
            return (
              a.slice(i + 1) === b.slice(i + 1) || // substitution
              a.slice(i) === b.slice(i + 1) || // deletion in a
              a.slice(i + 1) === b.slice(i) // insertion in a
            );
          }
        }
        return true;
      };
      const near = SURAHS.filter((su) =>
        su.names.some((n) => withinOne(normalize(n), q)),
      );
      if (near.length === 1) {
        return {
          route: wholeSurah(near[0].id),
          type: "surah-suggest",
          match: near[0].en,
        };
      }
    }

    // A surah recognizable only by its ENGLISH name, or by a prefix of
    // either name. This is where "light" (al-Nur), "women" (al-Nisa'),
    // "prophet" (al-Anbiya') and "pilgrimage" (al-Hajj) land — every
    // one of them also a concept the site covers elsewhere. Rather
    // than guess, hand the reader the grouped search, which shows the
    // surah AND the theme AND the root together and lets them choose.
    const surahByEnglish = SURAHS.find(
      (s) =>
        normalize(s.en) === q ||
        (q.length >= 4 && normalize(s.en).startsWith(q)) ||
        s.names.some((n) => normalize(n).startsWith(q) && q.length >= 4),
    );
    if (surahByEnglish) {
      return {
        route: `/search?q=${encodeURIComponent(raw)}`,
        type: "search",
        note: "ambiguous",
      };
    }

    // Everything else with letters in it goes to the full-text search.
    // /search indexes the 114 surahs, the 30 juz, every theme, every
    // glossed root, the glossary, page prose and the sources, so it
    // can answer far more than it could when it held prose alone.
    // Nothing returns "unrecognized" any more: a reader who typed
    // something gets results or an honest empty state on a page built
    // to help, never a rejection from a box.
    if (/[a-z0-9؀-ۿ]/.test(q)) {
      return {
        route: `/search?q=${encodeURIComponent(raw)}`,
        type: "search",
      };
    }

    // Only punctuation or whitespace survived normalization. There is
    // nothing to search for, so this is the one remaining non-route,
    // and it says what to do rather than what went wrong.
    return {
      route: null,
      reason: "unrecognized",
      input: raw,
      message:
        "Type a surah name or number, a verse like 1:1, a juz like juz 5, a root like r-h-m, or a keyword such as mercy.",
    };
  }

  window.parseAsk = parseAsk;

  // UI wiring: any page with an #ask-input control gets the full
  // behavior (Explore button, Enter key, example chips, rotating
  // placeholder). Pages without the control load this file for
  // parseAsk alone. This wiring lived inline on index.html while the
  // Ask box was a one-page feature.
  function initAskUi() {
    var input = document.getElementById("ask-input");
    if (!input) return;
    var button = document.getElementById("ask-go");
    var feedback = document.getElementById("ask-feedback");
    var chips = document.querySelectorAll(".ask-chips .chip");
    var passageHost = document.getElementById("ask-passage");
    var mode = document.getElementById("askMode");
    var row = document.getElementById("askRow");
    var hasPassage = Boolean(passageHost && window.qdPassage);

    // A chapter without a verse is the case this whole panel exists for:
    // the reader named a surah but has no way to know where it ends, so
    // answering with verse 1 and moving on throws away the question. A
    // complete reference (2:255), a juz, a theme, a root or a page is
    // not that case and still goes straight where it was going.
    function showPassage(surah) {
      var ctl = window.qdPassage.panel(passageHost, surah);
      if (ctl) {
        feedback.textContent = "";
        ctl.focus(); // so a second Enter reads it, no extra reach
      }
      return Boolean(ctl);
    }

    function go() {
      var result = window.parseAsk(input.value);
      if (result && result.route) {
        var surah = hasPassage ? window.qdPassage.surahOf(result) : null;
        if (surah && showPassage(surah)) return;
        window.location.href = result.route;
      } else if (result && result.message) {
        if (hasPassage) window.qdPassage.clear(passageHost);
        feedback.textContent = result.message;
      } else {
        if (hasPassage) window.qdPassage.clear(passageHost);
        feedback.textContent =
          "Not recognized. Try a surah name (Fatihah or الفاتحة), a verse like 1:1 or ٢:٥, a root like r-h-m or رحم, or an English word.";
      }
    }

    // ── Mode toggle ─────────────────────────────────────────────────
    // Two ways in, because readers arrive with different amounts of
    // knowledge: type what you know, or pick from a list when you know
    // nothing. Revealed only once the picker is on the page, so the
    // no-JS baseline stays the typed box it always was.
    if (mode && hasPassage && window.qdPicker) {
      mode.hidden = false;
      var modeBtns = mode.querySelectorAll("[data-mode]");
      var setMode = function (name) {
        modeBtns.forEach(function (b) {
          var on = b.getAttribute("data-mode") === name;
          b.classList.toggle("is-on", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        var passage = name === "passage";
        if (row) row.hidden = passage;
        var help = document.querySelector(".ask-section .ask-help");
        var chipRow = document.querySelector(".ask-section .ask-chips");
        if (help) help.hidden = passage;
        if (chipRow) chipRow.hidden = passage;
        feedback.textContent = "";
        if (passage) {
          // Open on the surah they last read, so the common case is
          // already loaded before they touch anything.
          var st = window.qdState;
          var recent =
            st && st.progress && Array.isArray(st.progress.recentSurahs)
              ? st.progress.recentSurahs[0]
              : null;
          window.qdPassage.panel(passageHost, recent || 1);
        } else {
          window.qdPassage.clear(passageHost);
        }
      };
      modeBtns.forEach(function (b) {
        b.setAttribute("aria-pressed", b.classList.contains("is-on") ? "true" : "false");
        b.addEventListener("click", function () {
          setMode(b.getAttribute("data-mode"));
        });
      });
    }

    if (button) button.addEventListener("click", go);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") go();
    });
    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        input.value = c.dataset.fill;
        input.focus();
        go();
      });
    });

    var PLACEHOLDERS = ["Al-Fatihah", "2:255", "r-h-m", "mercy", "الفاتحة"];
    var reduce = false;
    try {
      reduce =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
      reduce = false;
    }
    var phIdx = 0;
    var phTimer = null;
    function setPh(i) {
      input.setAttribute("placeholder", PLACEHOLDERS[i]);
    }
    function startRotation() {
      if (reduce || phTimer) return;
      phTimer = setInterval(function () {
        phIdx = (phIdx + 1) % PLACEHOLDERS.length;
        setPh(phIdx);
      }, 4000);
    }
    function stopRotation() {
      if (phTimer) {
        clearInterval(phTimer);
        phTimer = null;
      }
    }
    setPh(0);
    input.addEventListener("focus", stopRotation);
    input.addEventListener("blur", function () {
      if (!input.value) startRotation();
    });
    if (!reduce) startRotation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAskUi);
  } else {
    initAskUi();
  }
})();
