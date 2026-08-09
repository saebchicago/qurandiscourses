(function () {
  "use strict";

  // Inline reference popovers: root mentions ("r-ḥ-m") and verse
  // references ("3:7") in static page prose become live, clickable
  // cards. Same TreeWalker + shared-popover pattern as glossary.js,
  // which runs FIRST (script order) — we skip anything it wrapped.
  //
  // Whitelisting per maintainer-guide §5: a token is only wrapped when
  // it resolves in window.ROOT_REFS (generated from roots-summary.json;
  // ambiguous ASCII-folded forms are absent by construction) or, for
  // verse refs, when surah/verse are within the canonical bounds in
  // window.SURAHS. The slim data/roots-list.json is fetched at most
  // once, lazily, on the first root popover open — only for the count.
  //
  // Runs only over static DOMContentLoaded text like glossary.js;
  // dynamically rendered containers are skipped via the skip rules and
  // never rescanned. Loaded only on prose-heavy static pages.

  if (window.__refsDone) return;
  window.__refsDone = true;

  var MAX_WRAPS = 150; // per page, a safety valve for perf

  // Candidate root tokens: 2–4 dash/dot-separated segments of 1–2
  // letters (covers gh/sh/kh digraphs and diacritics). The real filter
  // is the ROOT_REFS lookup.
  var ROOT_TOKEN =
    /(^|[^A-Za-zʿʾĀ-ỿ-])((?:[a-zʿʾḥṣḍṭẓāīū'‘’]{1,2})(?:[-.](?:[a-zʿʾḥṣḍṭẓāīū'‘’]{1,2})){2,3})(?![A-Za-zĀ-ỿ-])/;
  var VERSE_TOKEN = /(^|[^\d:.])(\d{1,3}):(\d{1,3})(?![\d:])/;

  // Mirrors normalize() in assets/ask.js — keep in sync.
  function normalize(s) {
    return s
      .toLowerCase()
      .trim()
      .replace(/[‘’'`]/g, "")
      .replace(/[ʿʾ]/g, "")
      .replace(/[āáà]/g, "a")
      .replace(/[īíì]/g, "i")
      .replace(/[ūúù]/g, "u")
      .replace(/[ḥ]/g, "h")
      .replace(/[ṣ]/g, "s")
      .replace(/[ḍ]/g, "d")
      .replace(/[ṭ]/g, "t")
      .replace(/[ẓ]/g, "z");
  }

  function lookupRoot(token) {
    var refs = window.ROOT_REFS || {};
    var t = token.toLowerCase().replace(/\./g, "-");
    return refs[t] || refs[normalize(t)] || null;
  }

  var surahById = {};
  (window.SURAHS || []).forEach(function (s) {
    surahById[s.id] = s;
  });

  function shouldSkip(node) {
    var el = node.parentElement;
    while (el && el !== document.body) {
      var tag = el.tagName;
      if (
        tag === "A" ||
        tag === "CODE" ||
        tag === "PRE" ||
        tag === "SCRIPT" ||
        tag === "STYLE" ||
        tag === "BUTTON" ||
        tag === "SVG" ||
        tag === "KBD"
      )
        return true;
      if (el.classList) {
        if (
          el.classList.contains("ar") ||
          el.classList.contains("notranslate") ||
          el.classList.contains("badge") ||
          el.classList.contains("gloss") ||
          el.classList.contains("qd-ref") ||
          el.classList.contains("share-row") ||
          el.classList.contains("qd-chart-legend")
        )
          return true;
      }
      if (el.getAttribute) {
        if (el.getAttribute("translate") === "no") return true;
        if (el.hasAttribute("data-norefs")) return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  function makeRefSpan(text, kind, data) {
    var span = document.createElement("span");
    span.className = "qd-ref";
    span.tabIndex = 0;
    span.setAttribute("role", "button");
    span.setAttribute("aria-expanded", "false");
    span.setAttribute("data-kind", kind);
    if (kind === "root") {
      span.setAttribute("data-key", data.k);
      span.setAttribute("data-bw", data.bw);
      span.setAttribute("data-ar", data.a);
      span.setAttribute("data-latin", data.l);
    } else {
      span.setAttribute("data-s", data.s);
      span.setAttribute("data-a", data.a);
    }
    span.textContent = text;
    return span;
  }

  var wraps = 0;

  // Wrap all matches in one text node (both kinds), left to right.
  function processNode(node) {
    var text = node.textContent;
    if (text.length < 3) return;
    var frag = null;
    var rest = text;
    var out = [];

    while (rest && wraps < MAX_WRAPS) {
      var rm = ROOT_TOKEN.exec(rest);
      var vm = VERSE_TOKEN.exec(rest);
      var rootAt = rm ? rm.index + rm[1].length : Infinity;
      var verseAt = vm ? vm.index + vm[1].length : Infinity;
      var m = null,
        kind = null;
      if (rm && rootAt <= verseAt) {
        var entry = lookupRoot(rm[2]);
        if (entry) {
          m = { at: rootAt, len: rm[2].length, text: rm[2] };
          kind = { type: "root", data: entry };
        } else {
          // Not a known root: consume past it and keep scanning.
          out.push(rest.slice(0, rootAt + rm[2].length));
          rest = rest.slice(rootAt + rm[2].length);
          continue;
        }
      } else if (vm) {
        var s = parseInt(vm[2], 10);
        var a = parseInt(vm[3], 10);
        var meta = surahById[s];
        if (meta && a >= 1 && a <= meta.verseCount) {
          m = { at: verseAt, len: vm[2].length + 1 + vm[3].length, text: vm[2] + ":" + vm[3] };
          kind = { type: "verse", data: { s: s, a: a } };
        } else {
          out.push(rest.slice(0, verseAt + vm[2].length + 1 + vm[3].length));
          rest = rest.slice(verseAt + vm[2].length + 1 + vm[3].length);
          continue;
        }
      } else {
        break;
      }
      out.push(rest.slice(0, m.at));
      out.push(makeRefSpan(m.text, kind.type, kind.data));
      wraps++;
      rest = rest.slice(m.at + m.len);
    }
    if (out.some(function (x) { return typeof x !== "string"; })) {
      frag = document.createDocumentFragment();
      out.forEach(function (x) {
        frag.appendChild(
          typeof x === "string" ? document.createTextNode(x) : x,
        );
      });
      if (rest) frag.appendChild(document.createTextNode(rest));
      node.parentNode.replaceChild(frag, node);
    }
  }

  // ── Popover (one shared element, glossary.js interaction pattern) ──
  var pop = null;
  var openEl = null;
  var summaryCache = null;
  var summaryPromise = null;

  function loadSummary() {
    if (summaryPromise) return summaryPromise;
    summaryPromise = fetch("data/roots-list.json")
      .then(function (r) {
        // A non-ok response must reach .catch() too, not just a network
        // exception: resolving it to null here would look identical to
        // a real "no data" response and never retry (the case a plain
        // r.ok ? r.json() : null used to miss).
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        summaryCache = d;
        return d;
      })
      .catch(function () {
        // Don't cache a failure: without this, one network blip
        // permanently blanks every root popover's occurrence count for
        // the rest of the page's life, since a resolved-to-null promise
        // looks identical to a real "no data" response forever after.
        summaryPromise = null;
        return null;
      });
    return summaryPromise;
  }

  function ensurePop() {
    if (pop) return pop;
    pop = document.createElement("div");
    pop.className = "gloss-pop qd-ref-pop";
    pop.setAttribute("hidden", "");
    pop.setAttribute("role", "tooltip");
    document.body.appendChild(pop);
    return pop;
  }

  function closePop() {
    if (!openEl) return;
    openEl.setAttribute("aria-expanded", "false");
    openEl = null;
    if (pop) pop.setAttribute("hidden", "");
  }

  function position(el) {
    var rect = el.getBoundingClientRect();
    var w = Math.min(320, window.innerWidth - 24);
    pop.style.width = w + "px";
    var left = rect.left + rect.width / 2 - w / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
    pop.style.left = left + "px";
    var popH = pop.offsetHeight;
    var top =
      rect.top >= popH + 10
        ? rect.top + window.scrollY - popH - 6
        : rect.bottom + window.scrollY + 6;
    pop.style.top = top + "px";
  }

  function openPop(el) {
    if (openEl === el) {
      closePop();
      return;
    }
    closePop();
    ensurePop();
    var kind = el.getAttribute("data-kind");
    if (kind === "root") {
      var bw = el.getAttribute("data-bw");
      var key = el.getAttribute("data-key");
      var latin = el.getAttribute("data-latin");
      var ar = el.getAttribute("data-ar");
      var gloss = (window.ROOT_MEANINGS || {})[bw] || "";
      pop.innerHTML =
        '<strong class="gloss-pop-term"></strong>' +
        '<span class="ar-inline notranslate" translate="no" lang="ar" dir="rtl"></span> ' +
        '<span class="gloss-pop-def"></span> ' +
        '<span class="qd-ref-count" style="color:var(--muted)"></span> ' +
        '<a class="gloss-pop-more" href="/roots?root=' +
        encodeURIComponent(key) +
        '">Explore in Roots →</a>';
      pop.querySelector(".gloss-pop-term").textContent = "Root " + latin + ". ";
      pop.querySelector(".ar-inline").textContent = ar;
      pop.querySelector(".gloss-pop-def").textContent = gloss
        ? " " + gloss + "."
        : "";
      var countEl = pop.querySelector(".qd-ref-count");
      if (summaryCache && summaryCache[bw]) {
        countEl.textContent =
          summaryCache[bw].totalCount.toLocaleString("en-US") +
          "× in the Qur'an.";
      } else {
        countEl.textContent = "…";
        loadSummary().then(function (d) {
          if (openEl === el && d && d[bw]) {
            countEl.textContent =
              d[bw].totalCount.toLocaleString("en-US") + "× in the Qur'an.";
            position(el);
          } else if (openEl === el) {
            countEl.textContent = "";
          }
        });
      }
    } else {
      var s = parseInt(el.getAttribute("data-s"), 10);
      var a = parseInt(el.getAttribute("data-a"), 10);
      var meta = surahById[s] || {};
      pop.innerHTML =
        '<strong class="gloss-pop-term"></strong>' +
        '<span class="gloss-pop-def"></span> ' +
        '<a class="gloss-pop-more" href="/read?s=' +
        s +
        "&a=" +
        a +
        '">Open in Read →</a>';
      pop.querySelector(".gloss-pop-term").textContent =
        (meta.translit || "Surah " + s) + " " + s + ":" + a + ". ";
      pop.querySelector(".gloss-pop-def").textContent = meta.en
        ? "Surah " + s + " (" + meta.en + "), verse " + a + "."
        : "";
    }
    pop.removeAttribute("hidden");
    el.setAttribute("aria-expanded", "true");
    openEl = el;
    position(el);
  }

  function init() {
    var main = document.getElementById("main");
    if (!main || !window.ROOT_REFS) return;

    var walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      if (wraps >= MAX_WRAPS) return;
      if (!node.parentNode) return;
      if (shouldSkip(node)) return;
      processNode(node);
    });

    document.addEventListener("click", function (e) {
      var el = e.target.closest && e.target.closest(".qd-ref");
      if (el) {
        e.preventDefault();
        openPop(el);
        return;
      }
      if (!e.target.closest || !e.target.closest(".qd-ref-pop")) closePop();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closePop();
      if (
        (e.key === "Enter" || e.key === " " || e.key === "Spacebar") &&
        document.activeElement &&
        document.activeElement.classList &&
        document.activeElement.classList.contains("qd-ref")
      ) {
        e.preventDefault();
        openPop(document.activeElement);
      }
    });
    window.addEventListener("resize", closePop);
    window.addEventListener("scroll", closePop, true);
  }

  if (document.readyState === "complete") {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
