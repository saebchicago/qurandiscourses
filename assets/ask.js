// Deterministic client-side router for the Ask box.
// Pattern-matching only — no external calls, nothing composes answers.

(function () {
  const SURAHS = window.SURAHS || [];

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
      return { route: `read.html?s=${s}&a=${a}`, type: "verse" };
    }

    // Bare surah number
    const surahNumMatch = q.match(/^(\d{1,3})$/);
    if (surahNumMatch) {
      const s = +surahNumMatch[1];
      if (s >= 1 && s <= 114)
        return { route: `read.html?s=${s}&a=1`, type: "surah" };
      return {
        route: null,
        reason: "range",
        message: "Surah numbers run 1 to 114.",
      };
    }

    // Exact surah name FIRST: 20 documented aliases are exactly three
    // Latin letters (hud, nas, asr, sun, pen, …), so the bare-root rule
    // below would otherwise capture them — surah 11 has no name that
    // isn't. Exact-name-then-root is also the Arabic branch's precedence
    // (نوح is the surah, not a root guess). The separated spelling
    // (a-s-r) never equals an alias, so it still reaches the Roots page.
    const surahExact = SURAHS.find(
      (s) =>
        s.names.some((n) => normalize(n) === q) || normalize(s.en) === q,
    );
    if (surahExact)
      return {
        route: `read.html?s=${surahExact.id}&a=1`,
        type: "surah-name",
        match: surahExact.en,
      };

    // Root: r-h-m, r.h.m, rhm (3 latin letters separated or bare)
    const rootMatch = q.match(/^([a-z])[-.\s]?([a-z])[-.\s]?([a-z])$/);
    if (rootMatch && q.replace(/[-.\s]/g, "").length === 3) {
      const root = `${rootMatch[1]}-${rootMatch[2]}-${rootMatch[3]}`;
      return { route: `roots.html?q=${root}`, type: "root" };
    }

    // Surah name prefix fuzzing, after the root rule — a 3-letter string
    // that is merely the START of a name (fat, kaf, nab…) stays a root
    // query, as it always has.
    const surah = SURAHS.find(
      (s) =>
        s.names.some((n) => normalize(n).startsWith(q) && q.length >= 3) ||
        (q.length >= 4 && normalize(s.en).startsWith(q)),
    );
    if (surah)
      return {
        route: `read.html?s=${surah.id}&a=1`,
        type: "surah-name",
        match: surah.en,
      };

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
          route: `read.html?s=${surahAr.id}&a=1`,
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
          route: `roots.html?q=${encodeURIComponent(arRoot)}`,
          type: "root",
        };
      }
    }

    // Theme keywords route to the theme gateways page
    const THEME_WORDS = {
      forgiveness: "forgiveness",
      forgive: "forgiveness",
      pardon: "forgiveness",
      repentance: "forgiveness",
      marriage: "marriage",
      marry: "marriage",
      spouse: "marriage",
      divorce: "marriage",
      children: "children",
      child: "children",
      family: "children",
      orphan: "children",
      trade: "trade",
      business: "trade",
      wealth: "trade",
      money: "trade",
      usury: "trade",
      peace: "peace",
      reconciliation: "peace",
      patience: "patience",
      trial: "patience",
      hardship: "patience",
      justice: "justice",
      fairness: "justice",
      healing: "healing",
      health: "healing",
      illness: "healing",
      knowledge: "knowledge",
      reflection: "knowledge",
      prayer: "prayer",
      remembrance: "prayer",
      gratitude: "gratitude",
      thanks: "gratitude",
      thankfulness: "gratitude",
      guidance: "guidance",
      light: "guidance",
      fear: "fear-hope",
      hope: "fear-hope",
      truthfulness: "truthfulness",
      truth: "truthfulness",
      lying: "truthfulness",
      falsehood: "truthfulness",
      charity: "charity",
      giving: "charity",
      alms: "charity",
      zakat: "charity",
      death: "death",
      mortality: "death",
      dying: "death",
      paradise: "paradise",
      heaven: "paradise",
      hellfire: "hellfire",
      hell: "hellfire",
      wisdom: "wisdom",
      pilgrimage: "pilgrimage",
      hajj: "pilgrimage",
      fasting: "fasting",
      fast: "fasting",
      anger: "anger",
      love: "love",
      trust: "trust",
      reliance: "trust",
      arrogance: "arrogance",
      pride: "arrogance",
      humility: "arrogance",
      brotherhood: "brotherhood",
      community: "brotherhood",
      consultation: "brotherhood",
      sincerity: "sincerity",
      tyranny: "tyranny",
      oppression: "tyranny",
      covenant: "covenant",
      promise: "covenant",
      loyalty: "covenant",
      striving: "striving",
      effort: "striving",
      certainty: "certainty",
      doubt: "certainty",
      joy: "joy-sorrow",
      sorrow: "joy-sorrow",
      grief: "joy-sorrow",
      blessing: "blessing",
      favor: "blessing",
    };
    if (THEME_WORDS[q]) {
      return { route: `themes.html#${THEME_WORDS[q]}`, type: "theme" };
    }

    // English word fallback: the Roots page search matches English
    // glosses (words.html is a static explainer and ignores queries)
    if (/^[a-z\s'-]{2,}$/.test(q)) {
      return {
        route: `roots.html?q=${encodeURIComponent(raw)}`,
        type: "word",
      };
    }

    // Unrecognized
    return { route: null, reason: "unrecognized", input: raw };
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

    function go() {
      var result = window.parseAsk(input.value);
      if (result && result.route) {
        window.location.href = result.route;
      } else if (result && result.message) {
        feedback.textContent = result.message;
      } else {
        feedback.textContent =
          "Not recognized. Try a surah name (Fatihah or الفاتحة), a verse like 1:1 or ٢:٥, a root like r-h-m or رحم, or an English word.";
      }
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
