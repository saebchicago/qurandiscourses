/* Google Analytics 4, privacy-restricted.

   Loaded on every page next to the async gtag.js tag. It counts one
   page view per page load by address only: no query string, no hash, and
   the referrer is cut the same way. Google Signals and ad personalization
   are off. Nothing is configured or sent when the browser sends Global
   Privacy Control or the reader has switched analytics off (the control
   in About, Privacy and data, which stores dd_analytics_off = "1"). */
window.dataLayer = window.dataLayer || [];
function gtag() {
  dataLayer.push(arguments);
}
(function () {
  "use strict";
  var ID = "G-QEQGD1980R";

  var off = false;
  try {
    off = navigator.globalPrivacyControl === true || localStorage.getItem("dd_analytics_off") === "1";
  } catch (e) {
    off = navigator.globalPrivacyControl === true;
  }
  if (off) {
    window["ga-disable-" + ID] = true;
    return;
  }

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
})();
