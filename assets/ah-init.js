/* First-party analytics loader. This is the site's only analytics.

   Loaded on every page. It adds the site's own cookieless analytics script,
   served from this site's address (/_ah/t.js, which Netlify passes through
   to the analytics service the site maintainer runs; see netlify.toml).
   Measurements go back to this site's address too (/_ah/c), so the browser
   contacts no additional website, and no third party receives anything.

   Nothing is added and nothing is sent when any of these holds:
   - the page runs inside the native app (window.Capacitor exists only in
     that shell), which keeps the store disclosure that the app sends no
     analytics true;
   - the reader has switched analytics off (About, Privacy and data stores
     dd_analytics_off = "1");
   - the browser sends Global Privacy Control or Do Not Track;
   - the localStorage key ah_optout = "1" is set.
   The script it adds is also told the same switch (data-optout-key) as a
   second line of defense. */
(function () {
  "use strict";
  var inApp = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
  if (inApp) return;
  var nav = navigator;
  if (nav.globalPrivacyControl === true || nav.doNotTrack === "1" || window.doNotTrack === "1" || nav.msDoNotTrack === "1") return;
  try {
    if (localStorage.getItem("dd_analytics_off") === "1" || localStorage.getItem("ah_optout") === "1") return;
  } catch (e) {
    /* storage blocked: no stored opt-out can exist, continue */
  }
  var tag = document.createElement("script");
  tag.defer = true;
  tag.src = "/_ah/t.js";
  tag.setAttribute("data-endpoint", "/_ah/c");
  tag.setAttribute("data-optout-key", "dd_analytics_off");
  (document.head || document.documentElement).appendChild(tag);
})();
