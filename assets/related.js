// related.js — "See also" panels, from the build-time join in
// data/related.json (scripts/build-related.mjs). Two consumers:
//
//   dossier.html: when the URL names a surah, #relatedHost gets a card
//   listing the surahs whose theme profiles overlap it most, with the
//   shared themes named. The picker state renders nothing.
//
//   themes.html: each theme card gets a "Related themes" line naming
//   the themes whose root families co-occur with its own, with the
//   strongest bridging root pair. The cards render asynchronously
//   (themes.html fetches themes.json), so this waits for them.
//
// roots.html deliberately has no panel here: its co-occurrence tables
// already ARE the related-content view for roots. Everything shown is
// a join over published counts; the ~ badge carries the standing
// caveat that root-to-theme grouping is editorial.

(function () {
  var esc =
    window.qdEsc ||
    function (v) {
      return String(v).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    };

  var NUANCED =
    '<span class="badge nuanced" aria-label="Nuanced" tabindex="0" ' +
    'title="Nuanced · mechanical counts over an editorial root-to-theme grouping">~</span>';

  function surahName(n) {
    var su =
      window.SURAHS &&
      window.SURAHS.find(function (x) {
        return x.id === n;
      });
    return su ? su.translit : "Surah " + n;
  }

  function fetchRelated(then) {
    fetch("data/related.json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(then)
      .catch(function () {
        /* panel is an extra; a failed fetch just means no panel */
      });
  }

  // ── dossier.html ─────────────────────────────────────────────────
  function initDossier(host) {
    var m = /[?&]s=(\d{1,3})(?:&|$)/.exec(window.location.search);
    if (!m) return;
    var s = String(+m[1]);
    fetchRelated(function (rel) {
      var sibs = rel.surahs[s];
      if (!sibs || !sibs.length) return;
      var items = sibs
        .map(function (p) {
          var shared = p.shared
            .map(function (slug) {
              return (
                '<a href="/themes#' +
                esc(slug) +
                '">' +
                esc(rel.titles[slug] || slug) +
                "</a>"
              );
            })
            .join(", ");
          return (
            '<li><a href="/dossier?s=' +
            p.s +
            '"><strong>' +
            esc(surahName(p.s)) +
            "</strong> (surah " +
            p.s +
            ")</a>" +
            ' <span style="color:var(--muted);font-size:0.88rem">shares ' +
            shared +
            "</span></li>"
          );
        })
        .join("");
      host.innerHTML =
        '<div class="card related-panel"><h3 style="margin-top:0">See also ' +
        NUANCED +
        "</h3>" +
        '<p style="margin:0 0 0.4rem;font-size:0.92rem">Surahs whose theme vocabulary clusters most like this one’s:</p>' +
        '<ul class="related-list">' +
        items +
        "</ul>" +
        '<p class="prov">Ranked by the per-1,000-word densities in <code>data/theme-surah-index.json</code>; a shared theme counts as much as its weaker presence. A vocabulary join, not a thematic judgment.</p></div>';
    });
  }

  // ── themes.html ──────────────────────────────────────────────────
  function decorateThemes(wrap, rel) {
    Array.prototype.forEach.call(
      wrap.querySelectorAll("section[id]"),
      function (sec) {
        var near = rel.themes[sec.id];
        var card = sec.querySelector(".theme-card");
        if (!near || !card || card.querySelector(".related-themes")) return;
        var line = near
          .map(function (n) {
            return (
              '<a href="#' +
              esc(n.slug) +
              '">' +
              esc(n.title) +
              "</a>" +
              ' <span style="color:var(--muted);font-size:0.82rem">(' +
              esc(n.via.a) +
              " · " +
              esc(n.via.b) +
              " co-occur " +
              n.via.count +
              "×)</span>"
            );
          })
          .join(" · ");
        var p = document.createElement("p");
        p.className = "related-themes";
        p.setAttribute("style", "margin:0.5rem 0 0;font-size:0.9rem;line-height:1.9");
        p.innerHTML =
          "<strong>Related themes " +
          NUANCED +
          ":</strong> " +
          line;
        var kitLink = card.querySelector('a[href="#study-kit"]');
        var anchor = kitLink ? kitLink.parentElement : null;
        if (anchor) card.insertBefore(p, anchor);
        else card.appendChild(p);
      },
    );
  }

  function initThemes(wrap) {
    fetchRelated(function (rel) {
      if (wrap.querySelector("section[id]")) {
        decorateThemes(wrap, rel);
        return;
      }
      // The theme cards arrive after themes.json resolves; decorate
      // them once, whenever that happens.
      var mo = new MutationObserver(function () {
        if (wrap.querySelector("section[id]")) {
          mo.disconnect();
          decorateThemes(wrap, rel);
        }
      });
      mo.observe(wrap, { childList: true });
    });
  }

  function init() {
    var host = document.getElementById("relatedHost");
    if (host) initDossier(host);
    var wrap = document.getElementById("themeSections");
    if (wrap) initThemes(wrap);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
