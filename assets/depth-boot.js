/* Depth boot: applies the saved depth tier before first paint.
   Every page hard-codes data-depth="simple" as the no-JS fallback, and
   app.js re-applies the saved depth at DOMContentLoaded — but by then
   the page has painted, so a returning Study/Encyclopedic reader saw a
   flash of the Simple layout on every load. This file runs render-
   blocking from <head> (kept deliberately tiny for that reason) and
   sets the attribute first. app.js remains the owner of all depth
   state; this only mirrors what app.js would set moments later. */
(function () {
  try {
    var saved = JSON.parse(localStorage.getItem("qd_state") || "{}");
    var depth = saved && saved.depth;
    // Same legacy mapping as app.js load(): the middle tier was renamed
    // from "scholar" to "study". app.js persists the migration; here it
    // is only read.
    if (depth === "scholar") depth = "study";
    if (depth === "simple" || depth === "study" || depth === "encyclopedic") {
      document.documentElement.setAttribute("data-depth", depth);
    }
  } catch (e) {}
})();
