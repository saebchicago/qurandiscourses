// lazy.js — load a page's study-only scripts after the page has finished.
//
//   <script src="assets/lazy.js" data-lazy="assets/a.js assets/b.js" defer></script>
//
// Deferred scripts all run before DOMContentLoaded, and the Read page
// starts fetching its passage on DOMContentLoaded, so every deferred
// script is time a reader waits for the first verse. On a throttled
// phone (slow 4G, 4x CPU) /read's first verse arrived at ~5.7s, with
// DOMContentLoaded at ~5.0s. The scripts listed here (the Ask box, the
// glossary, reading lenses, the discovery worksheet, study-path ribbon,
// citation and feedback widgets) serve study, not reading, listening or
// reflecting, so they load once the page has, in the listed order.
//
// Each listed file must start correctly when loaded after
// DOMContentLoaded (a readyState check, not a bare event listener) and,
// if it follows qd:verse-loaded, catch up from window.qdLastVerseLoaded.
(function () {
  "use strict";
  var me = document.currentScript;
  var list = ((me && me.getAttribute("data-lazy")) || "").split(/\s+/).filter(Boolean);
  if (!list.length) return;
  function inject() {
    list.forEach(function (src) {
      var s = document.createElement("script");
      s.src = src;
      // Dynamically inserted scripts run as soon as they arrive unless
      // told otherwise; async=false keeps the listed order, so a file
      // that needs another's globals (ask.js on ask-routes.js) is safe.
      s.async = false;
      document.body.appendChild(s);
    });
  }
  if (document.readyState === "complete") inject();
  else window.addEventListener("load", inject, { once: true });
})();
