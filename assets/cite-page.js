/* Footer "Cite" enhancement.

   Every footer carries a static <a href="/about#cite">Cite</a> link, and
   with JavaScript off that page section is the whole feature: it explains
   how to cite the site and links CITATION.cff and citations.bib. This
   script upgrades the link in place: clicking it opens a popover with
   this page's own citation in three formats (Chicago, APA, BibTeX), each
   behind a copy button, so a reader citing a specific page never has to
   assemble the reference by hand.

   The citation is built from what the page already declares: the title
   tag, the canonical URL, and window.QD_VERSION (assets/version.js,
   generated from data/version.json). The access date is the reader's
   own, so it is computed here rather than baked in. Popover styles reuse
   .cite-popover from cite-badge.js; copy goes through window.qdCopyText
   (share.js) with a plain fallback so the button still works on a page
   without it. */
(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  function copy(text, btn) {
    var done = function () {
      var old = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(function () {
        btn.textContent = old;
      }, 1400);
    };
    if (window.qdCopyText) {
      // share.js's helper is callback-style: copyText(text, onDone).
      window.qdCopyText(text, done);
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(done);
    }
  }

  ready(function () {
    var link = document.querySelector('footer.site a[href="/about#cite"]');
    if (!link) return;

    // The page's own title, without the shared " · Divine Discourses"
    // suffix the titles carry (the site name gets its own slot).
    var pageTitle = document.title.replace(/\s*·\s*Divine Discourses\s*$/, "");
    var canonical = document.querySelector('link[rel="canonical"]');
    var url = canonical ? canonical.href : location.origin + location.pathname;
    var v = window.QD_VERSION || { version: "", released: "" };
    var now = new Date();
    var accessed =
      now.getFullYear() +
      "-" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(now.getDate()).padStart(2, "0");
    var year = (v.released || accessed).slice(0, 4);
    var isHome = pageTitle.indexOf("Divine Discourses") === 0;
    var titlePart = isHome ? "Divine Discourses" : '"' + pageTitle + '." Divine Discourses';

    var chicago =
      titlePart +
      (v.version ? ", version " + v.version : "") +
      ". " +
      year +
      ". " +
      url +
      ". Accessed " +
      accessed +
      ".";
    var apa =
      "Divine Discourses project. (" +
      year +
      "). " +
      (isHome ? "Divine Discourses" : pageTitle + ". Divine Discourses") +
      (v.version ? " (Version " + v.version + ")" : "") +
      ". Retrieved " +
      accessed +
      ", from " +
      url;
    var key =
      "divinediscourses" +
      (isHome ? "" : "-" + location.pathname.replace(/[^a-z0-9-]/gi, "").toLowerCase());
    var bibtex =
      "@misc{" +
      key +
      ",\n  title = {" +
      (isHome ? "Divine Discourses" : pageTitle + " (Divine Discourses)") +
      "},\n  author = {{Divine Discourses project}},\n  year = {" +
      year +
      "},\n  url = {" +
      url +
      "},\n  note = {" +
      (v.version ? "Version " + v.version + ". " : "") +
      "Accessed " +
      accessed +
      "}\n}";

    var pop = null;

    function close() {
      if (!pop) return;
      pop.remove();
      pop = null;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onOutside, true);
      link.setAttribute("aria-expanded", "false");
      link.focus();
    }
    function onKey(e) {
      if (e.key === "Escape") close();
    }
    function onOutside(e) {
      if (pop && !pop.contains(e.target) && e.target !== link) close();
    }

    function row(label, text) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cite-copy-btn";
      btn.textContent = "Copy " + label;
      btn.addEventListener("click", function () {
        copy(text, btn);
      });
      var pre = document.createElement("pre");
      pre.className = "cite-page-text";
      pre.textContent = text;
      li.appendChild(pre);
      li.appendChild(btn);
      return li;
    }

    function open() {
      pop = document.createElement("div");
      pop.className = "cite-popover cite-page-pop";
      pop.setAttribute("role", "dialog");
      pop.setAttribute("aria-label", "Cite this page");

      var h = document.createElement("h5");
      h.textContent = "Cite this page";
      pop.appendChild(h);

      var ul = document.createElement("ul");
      ul.appendChild(row("Chicago", chicago));
      ul.appendChild(row("APA", apa));
      ul.appendChild(row("BibTeX", bibtex));
      pop.appendChild(ul);

      var more = document.createElement("p");
      more.className = "cite-actions";
      var a = document.createElement("a");
      a.href = "/about#cite";
      a.textContent = "About citing this site";
      more.appendChild(a);
      pop.appendChild(more);

      var x = document.createElement("button");
      x.type = "button";
      x.className = "cite-close";
      x.setAttribute("aria-label", "Close");
      x.textContent = "×";
      x.addEventListener("click", close);
      pop.appendChild(x);

      // Anchored above the footer link, clamped to the viewport.
      document.body.appendChild(pop);
      var r = link.getBoundingClientRect();
      var w = pop.offsetWidth;
      var left = Math.max(
        8,
        Math.min(window.scrollX + r.left, window.scrollX + window.innerWidth - w - 8),
      );
      pop.style.left = left + "px";
      pop.style.top = window.scrollY + r.top - pop.offsetHeight - 8 + "px";

      document.addEventListener("keydown", onKey);
      document.addEventListener("click", onOutside, true);
      link.setAttribute("aria-expanded", "true");
      x.focus();
    }

    link.setAttribute("aria-haspopup", "dialog");
    link.setAttribute("aria-expanded", "false");
    link.addEventListener("click", function (e) {
      e.preventDefault();
      if (pop) close();
      else open();
    });
  });
})();
