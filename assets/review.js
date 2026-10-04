/* /review enhancement.

   Both forms on the page are static Netlify Forms markup and work with
   JavaScript off (native POST, the provider's confirmation page). This
   script adds three conveniences: it fills the correction form's page
   field from ?page=, shows only the correction form when the reader came
   from a "Report an issue" link (?type=correction), and submits over
   fetch so confirmation stays on the page. Only the form type is read
   from the query string; nothing is stored or sent anywhere else. */
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
    var params = new URLSearchParams(location.search);
    var reviewerSection = document.getElementById("reviewer-section");
    var issueSection = document.getElementById("issue-section");
    var issueForm = document.getElementById("issue-form");
    if (!reviewerSection || !issueSection || !issueForm) return;

    var page = params.get("page");
    var pageField = issueForm.querySelector('input[name="page"]');
    // Only same-site paths are accepted into the field.
    if (pageField && page && page.charAt(0) === "/" && page.charAt(1) !== "/" && page.length <= 200) {
      pageField.value = page;
    }

    if (params.get("type") === "correction") {
      reviewerSection.hidden = true;
      var switcher = document.getElementById("show-reviewer-form");
      if (switcher) {
        switcher.hidden = false;
        switcher.querySelector("a").addEventListener("click", function (e) {
          e.preventDefault();
          reviewerSection.hidden = false;
          switcher.hidden = true;
          reviewerSection.scrollIntoView();
        });
      }
      issueSection.scrollIntoView();
    }

    function wire(form) {
      form.addEventListener("submit", function onSubmit(e) {
        if (!window.fetch) return; // native POST
        e.preventDefault();
        var btn = form.querySelector('button[type="submit"]');
        var status = form.querySelector(".review-status");
        if (btn) btn.disabled = true;
        fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(new FormData(form)).toString(),
        })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
            form.reset();
            if (form === issueForm && pageField && page) pageField.value = page;
            if (status) status.textContent = "Sent. Thank you.";
          })
          .catch(function () {
            form.removeEventListener("submit", onSubmit);
            form.submit();
          })
          .then(function () {
            if (btn) btn.disabled = false;
          });
      });
    }
    wire(document.getElementById("reviewer-form"));
    wire(issueForm);
  });
})();
