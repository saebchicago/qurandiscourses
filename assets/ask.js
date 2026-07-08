// Deterministic client-side router for the Ask box.
// No LLM. No external API. Pattern-matches input, returns a route.

(function () {
  const SURAHS = window.SURAHS || [];

  function normalize(s) {
    return s
      .toLowerCase()
      .trim()
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
