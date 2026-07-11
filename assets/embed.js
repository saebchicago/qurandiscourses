(function () {
  "use strict";

  // Renderer for embed.html — the one page foreign sites may iframe.
  // ?type=root|theme|verse&id=... Every id is whitelisted against the
  // bundled datasets before use (maintainer-guide §5); API text goes
  // through qdEsc. Site-authored dataset text (glosses, titles) is
  // trusted, same as everywhere else on the site.

  var SITE = "https://qurandiscourse.netlify.app";
  var root = document.getElementById("embedRoot");

  function footer(href, label) {
    return (
      '<p class="embed-footer"><a href="' +
      href +
      '" target="_blank" rel="noopener">' +
      label +
      " · View on Divine Discourses →</a></p>"
    );
  }

  function fail() {
    root.innerHTML =
      '<p class="embed-loading">Nothing to embed.</p>' +
      footer(SITE + "/", "Divine Discourses");
  }

  function renderRoot(id) {
    fetch("data/roots-list.json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (summary) {
        // Whitelist: id must be the safeKey of a real root.
        var entry = null;
        var bw = null;
        for (var key in summary) {
          if (safeKey(key) === id) {
            entry = summary[key];
            bw = key;
            break;
          }
        }
        if (!entry) return fail();
        var gloss = (window.ROOT_MEANINGS || {})[bw];
        var top = entry.topLemmas && entry.topLemmas[0];
        root.innerHTML =
          '<p class="ar embed-ar notranslate" translate="no" lang="ar" dir="rtl">' +
          entry.rootArabic +
          "</p>" +
          '<h1 class="embed-title">Root ' +
          entry.rootLatin +
          (gloss ? " — " + gloss : "") +
          "</h1>" +
          '<p class="embed-meta">' +
          entry.totalCount.toLocaleString("en-US") +
          " occurrence" +
          (entry.totalCount === 1 ? "" : "s") +
          " in the Qur'an" +
          (top
            ? ' · most frequent form <span class="ar-inline notranslate" translate="no" lang="ar" dir="rtl">' +
              top.lemmaArabic +
              "</span> (" +
              top.count +
              "×)"
            : "") +
          "</p>" +
          '<p class="embed-prov">Counts from the Leeds Quranic Arabic Corpus v0.4; every occurrence verifiable on the site.</p>' +
          footer(SITE + "/roots.html?root=" + id, entry.rootLatin);
      })
      .catch(fail);
  }

  function renderTheme(id) {
    fetch("data/themes.json")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        var t = data.themes.find(function (x) {
          return x.slug === id;
        });
        if (!t) return fail();
        var chips = t.roots
          .map(function (r) {
            return (
              '<span class="embed-chip"><span class="ar-inline notranslate" translate="no" lang="ar" dir="rtl">' +
              r.arabic +
              "</span> " +
              r.latin +
              " · " +
              r.count.toLocaleString("en-US") +
              "×</span>"
            );
          })
          .join(" ");
        root.innerHTML =
          '<h1 class="embed-title">' +
          t.title +
          "</h1>" +
          '<p class="embed-meta">A gateway into the Qur’an’s vocabulary: ' +
          t.passages.length +
          " key passages where these root families cluster.</p>" +
          '<p class="embed-chips">' +
          chips +
          "</p>" +
          '<p class="embed-prov">Computed from the Leeds corpus; the grouping is lexical, a starting point rather than an index.</p>' +
          footer(SITE + "/themes.html#" + t.slug, t.title);
      })
      .catch(fail);
  }

  function renderVerse(id) {
    var m = /^(\d{1,3}):(\d{1,3})$/.exec(id);
    if (!m) return fail();
    var s = parseInt(m[1], 10);
    var a = parseInt(m[2], 10);
    var meta = (window.SURAHS || []).find(function (x) {
      return x.id === s;
    });
    if (!meta || a < 1 || a > meta.verseCount) return fail();
    var label = meta.translit + " " + s + ":" + a;
    var link = footer(SITE + "/read.html?s=" + s + "&a=" + a, label);

    function offline() {
      // Same fallback the Read page uses: Arabic reassembled from the
      // bundled morphology.
      fetch("data/morphology/" + s + ".json")
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (morph) {
          var words = morph[String(a)];
          if (!words) return fail();
          var ar = words
            .map(function (w) {
              return w.ar;
            })
            .join(" ");
          root.innerHTML =
            '<p class="embed-ref">' +
            qdEsc(label) +
            "</p>" +
            '<p class="ar embed-ar notranslate" translate="no" lang="ar" dir="rtl">' +
            qdEsc(ar) +
            "</p>" +
            '<p class="embed-prov">Arabic from the bundled Leeds corpus tokens; translation needs a connection.</p>' +
            link;
        })
        .catch(fail);
    }

    if (window.qdFetchVerse) {
      window
        .qdFetchVerse(s, a)
        .then(function (editions) {
          var arabic = editions[0];
          var english = editions[1];
          root.innerHTML =
            '<p class="embed-ref">' +
            qdEsc(label) +
            "</p>" +
            '<p class="ar embed-ar notranslate" translate="no" lang="ar" dir="rtl">' +
            qdEsc(arabic.text) +
            "</p>" +
            (english
              ? '<p class="embed-trans">' +
                qdEsc(english.text) +
                '</p><p class="embed-prov">' +
                qdEsc(english.edition.englishName) +
                " translation · text from api.alquran.cloud</p>"
              : "") +
            link;
        })
        .catch(offline);
    } else {
      offline();
    }
  }

  // Mirrors scripts/lib/safe-key.mjs (kept in sync by hand — no modules).
  function safeKey(bw) {
    var out = "";
    for (var i = 0; i < bw.length; i++) {
      var c = bw[i];
      if (c === "*") out += "dh";
      else if (c === "$") out += "sh";
      else if (c >= "A" && c <= "Z") out += "u" + c;
      else out += c;
    }
    return out;
  }

  var params = new URLSearchParams(location.search);
  var type = params.get("type") || "";
  // ids are matched against datasets below; this only rejects junk early.
  var id = (params.get("id") || "").slice(0, 64);
  if (type === "root" && /^[a-z]+$/i.test(id)) renderRoot(id);
  else if (type === "theme" && /^[a-z0-9-]+$/.test(id)) renderTheme(id);
  else if (type === "verse") renderVerse(id);
  else fail();
})();
