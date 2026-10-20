/* Google Analytics 4, privacy-restricted.

   Loaded on every page. It loads Google's gtag.js itself, and only when
   analytics are on, so a browser that has opted out (or the native app)
   never contacts Google at all. It counts one
   page view per page load by address only: no query string, no hash, and
   the referrer is cut the same way. Google Signals and ad personalization
   are off. Nothing is configured or sent when the browser sends Global
   Privacy Control or the reader has switched analytics off (the control
   in About, Privacy and data, which stores dd_analytics_off = "1"). */
window.dataLayer = window.dataLayer || [];
function gtag() {
  dataLayer.push(arguments);
}
// ddEvent(name, params) sends one of the fixed events listed below. It does
// nothing until analytics are confirmed on, so a browser that has opted out
// never reaches it. Callers pass only values from a fixed list, never text
// a reader typed.
window.ddEvent = function () {};
(function () {
  "use strict";
  var ID = "G-QEQGD1980R";

  // The native app builds send no analytics at all (store privacy
  // disclosures say so). window.Capacitor exists only inside that shell.
  var inApp = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
  var off = inApp;
  try {
    off = inApp || navigator.globalPrivacyControl === true || localStorage.getItem("dd_analytics_off") === "1";
  } catch (e) {
    off = inApp || navigator.globalPrivacyControl === true;
  }
  if (off) {
    window["ga-disable-" + ID] = true;
    return;
  }

  var tag = document.createElement("script");
  tag.async = true;
  tag.src = "https://www.googletagmanager.com/gtag/js?id=" + ID;
  (document.head || document.documentElement).appendChild(tag);

  // Address only: origin + path. Anything else on the URL is dropped.
  function bare(href) {
    try {
      var u = new URL(href);
      return u.origin + u.pathname;
    } catch (e) {
      return "";
    }
  }
  var location_ = location.origin + location.pathname;
  var referrer = bare(document.referrer);

  gtag("js", new Date());
  gtag("config", ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    send_page_view: false,
    page_location: location_,
    page_referrer: referrer,
  });
  gtag("event", "page_view", { page_location: location_, page_referrer: referrer });

  var EVENTS = { dataset_download: true };
  window.ddEvent = function (name, params) {
    if (EVENTS[name] === true) gtag("event", name, params || {});
  };

  // Download counts: which export table and which format was fetched, read
  // from the link's own address. Nothing about the reader goes with it.
  var TABLE_FILE = /(?:^|\/)data\/exports\/([a-z0-9-]+)\.(csv|json)(?:$|[?#])/;
  var ARCHIVE_FILE = /(?:^|\/)data\/exports\/divinediscourses-data-v[0-9.]+\.tar\.gz(?:$|[?#])/;
  document.addEventListener("click", function (e) {
    var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    var m = TABLE_FILE.exec(href);
    if (m) window.ddEvent("dataset_download", { table: m[1], format: m[2] });
    else if (ARCHIVE_FILE.test(href)) window.ddEvent("dataset_download", { table: "archive", format: "tar.gz" });
  });
})();
