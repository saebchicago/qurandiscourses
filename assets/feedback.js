/* Footer "Report a correction" enhancement.

   The footer form is fully functional with JavaScript off: it POSTs to
   the hosting provider's form endpoint (Netlify Forms detects the
   static markup at deploy time) and the reader lands on the provider's
   confirmation page. This script only improves that path: it fills the
   hidden page field with the address the reader is actually on, and
   submits over fetch so the confirmation is an in-place toast instead
   of a navigation away from their reading position.

   Privacy contract, stated in the form itself: submitting sends exactly
   these fields to the maintainer via the form service; nothing else on
   the site transmits anything. */
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
          // endpoint through a full navigation.
          form.removeEventListener("submit", arguments.callee);
          form.submit();
        })
        .then(function () {
          if (btn) btn.disabled = false;
        });
    });
  });
})();
