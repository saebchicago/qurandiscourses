/* Prefilled GitHub issue URLs, in one place.

   The contribution pipeline runs through GitHub issue templates, and
   more than one page needs to open one with the reader's own content
   already in the body (the discovery worksheet's submit button, the
   wanted-outlines list on Coverage). Building those URLs by hand in
   each caller is how the repo slug and template names drift, so this is
   the single builder.

   URL length is the real constraint: browsers and GitHub both truncate
   very long GET requests, so the body is capped and callers are told
   (via the return value) when the reader's text was cut and should be
   pasted manually instead. */
(function () {
  "use strict";

  var REPO = "https://github.com/saebchicago/qurandiscourses";
  // Conservative: keeps the whole URL well under every common limit.
  var BODY_BUDGET = 6000;

  /* opts: { template, title, body, labels }. Returns { url, truncated }. */
  function issueUrl(opts) {
    var params = [];
    if (opts.template) params.push("template=" + encodeURIComponent(opts.template));
    if (opts.title) params.push("title=" + encodeURIComponent(opts.title));
    if (opts.labels) params.push("labels=" + encodeURIComponent(opts.labels));
    var truncated = false;
    if (opts.body) {
      var body = String(opts.body);
      if (body.length > BODY_BUDGET) {
        body =
          body.slice(0, BODY_BUDGET) +
          "\n\n[Truncated for the URL. Paste the rest of your export here.]";
        truncated = true;
      }
      params.push("body=" + encodeURIComponent(body));
    }
    return {
      url: REPO + "/issues/new?" + params.join("&"),
      truncated: truncated,
    };
  }

  window.qdIssueUrl = issueUrl;
  window.qdRepoUrl = REPO;
})();
