// Deterministic client-side router for the Ask box.
// No LLM. No external API. Pattern-matches input, returns a route.

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
    if (!raw) return { route: null, reason: "empty" };
    const q = normalize(raw);

    // Verse: 1:1, 1.1, 1 1
    const verseMatch = q.match(/^(\d{1,3})\s*[:.\s]\s*(\d{1,3})$/);
    if (verseMatch) {
      const s = +verseMatch[1],
        a = +verseMatch[2];
      if (s >= 1 && s <= 114 && a >= 1)
        return { route: `read.html?s=${s}&a=${a}`, type: "verse" };
      if (s < 1 || s > 114)
        return {
          route: null,
          reason: "range",
          message: "Surah numbers run 1 to 114.",
        };
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

    // Root: r-h-m, r.h.m, rhm (3 latin letters separated or bare)
    const rootMatch = q.match(/^([a-z])[-.\s]?([a-z])[-.\s]?([a-z])$/);
    if (rootMatch && q.replace(/[-.\s]/g, "").length === 3) {
      const root = `${rootMatch[1]}-${rootMatch[2]}-${rootMatch[3]}`;
      return { route: `roots.html?q=${root}`, type: "root" };
    }

    // Surah name fuzzy match (names list + full English name field)
    const surah = SURAHS.find(
      (s) =>
        s.names.some((n) => normalize(n) === q) ||
        s.names.some((n) => normalize(n).startsWith(q) && q.length >= 3) ||
        normalize(s.en) === q ||
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
      // the same precedence the Latin path gives "fajr". roots.html
      // resolves the letters against rootArabic; no Buckwalter table
      // is duplicated here.
      const bare = qa.replace(/[\s\-.]/g, "");
      if (/^[ء-ي]{3,4}$/.test(bare)) {
        return { route: `roots.html?q=${encodeURIComponent(bare)}`, type: "root" };
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
})();
