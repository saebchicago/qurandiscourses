/* First-party analytics loader.

   Loaded on every page next to assets/ga-init.js. It adds the site's own
   analytics script, served from this site's address (/_ah/t.js, which
   Netlify passes through to the analytics service the site maintainer runs;
   see netlify.toml). Measurements go back to this site's address too
   (/_ah/c), so the browser contacts no additional website.

   It applies the same Capacitor test as ga-init.js: inside the native app
   nothing is added and nothing is sent, which keeps the store disclosure
   that the app sends no analytics true. The script it adds is told to honor
   the reader's analytics switch (data-optout-key: About, Privacy and data,
   stores dd_analytics_off = "1"); it also honors Global Privacy Control,
   Do Not Track, and the localStorage key ah_optout = "1". */
(function () {
  "use strict";
  var inApp = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
  if (inApp) return;
  var tag = document.createElement("script");
  tag.defer = true;
  tag.src = "/_ah/t.js";
  tag.setAttribute("data-endpoint", "/_ah/c");
  tag.setAttribute("data-optout-key", "dd_analytics_off");
  (document.head || document.documentElement).appendChild(tag);
})();
