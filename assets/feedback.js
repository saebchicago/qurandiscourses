/* Footer "Report a correction" enhancement.

   The footer form is fully functional with JavaScript off: it POSTs to
   the hosting provider's form endpoint (Netlify Forms detects the
   static markup at deploy time) and the reader lands on the provider's
   confirmation page. This script improves that path: it fills the hidden
   page field with the address the reader is actually on, replaces a stale
   absolute privacy sentence in the shared footer with the site's current
   privacy contract, and submits over fetch so confirmation is an in-place
   toast instead of a navigation away from the reading position.

   Submitting the form sends its fields to the hosting provider. The site
   uses no analytics or tracking; optional translation and audio features
   make direct requests to the named providers described on /about#privacy. */
(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(function () {
    var form = document.querySelector("footer.site form.feedback-form");
    if (!form) return;

    var note = form.querySelector(".feedback-note");
    if (note) {
      note.innerHTML =
        "Goes to the maintainer via the hosting provider's form service. " +
        "No analytics or tracking are used; optional translation and audio " +
        'features contact the named providers described in <a href="/about#privacy">Privacy</a>. ' +
        'Prefer GitHub? <a href="https://github.com/saebchicago/qurandiscourses/issues/new?template=correction.md" rel="noopener">Open a correction issue</a>.';
    }

    var pageField = form.querySelector('input[name="page"]');
    if (pageField) pageField.value = location.href;

    form.addEventListener("submit", function onSubmit(e) {
      if (!window.fetch) return; // let the native POST happen
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      var data = new URLSearchParams(new FormData(form)).toString();
      fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: data,
      })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          form.reset();
          if (pageField) pageField.value = location.href;
          var details = form.closest("details");
          if (details) details.open = false;
          if (window.qdToast) {
            window.qdToast("Sent. Thank you for the correction.");
          } else {
            window.alert("Sent. Thank you for the correction.");
          }
        })
        .catch(function () {
          // Fall back to the native submission, which reaches the same
          // endpoint through a full navigation. arguments.callee is
          // illegal in strict mode (this whole file is "use strict"),
          // so the handler is named and referenced directly instead.
          form.removeEventListener("submit", onSubmit);
          form.submit();
        })
        .then(function () {
          if (btn) btn.disabled = false;
        });
    });
  });
})();
