/* One fetch path for word-by-word pages (Read's strips, vocabulary cards).
   ────────────────────────────────────────────────────────────────
   Tries the site's own credentialed proxy first (/api/wbw, which holds
   the Quran Foundation client credentials server-side). While that proxy
   is not configured (503 not_configured) or not deployed (404), it falls
   back to the legacy unauthenticated api.quran.com route, the same source
   and edition, so nothing is substituted. Delete LEGACY once the proxy is
   live. Any other failure rejects and the caller hides the meanings.

   window.qdWbwFetch(surah, page, legacyUrl) -> Promise<{verses:[…]}> */
(function () {
  "use strict";
  var proxyState = "unknown"; // "unknown" | "up" | "absent" (session memory)

  function shaped(j) {
    return !!(j && Array.isArray(j.verses) && j.verses.length);
  }

  function legacy(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  window.qdWbwFetch = function (surah, page, legacyUrl) {
    if (proxyState === "absent") return legacy(legacyUrl);
    return fetch("/api/wbw?chapter=" + encodeURIComponent(surah) + "&page=" + encodeURIComponent(page)).then(
      function (r) {
        if (r.status === 503 || r.status === 404) {
          proxyState = "absent";
          return legacy(legacyUrl);
        }
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json().then(function (j) {
          if (!shaped(j)) throw new Error("unexpected shape");
          proxyState = "up";
          return j;
        });
      },
    );
  };
})();
