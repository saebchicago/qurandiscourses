(function () {
  "use strict";

  // Share-this-view buttons. Every tool page keeps its state in the URL
  // (query params / hash), so the current address is already a permalink;
  // this only adds the affordance. Native share sheet where available,
  // clipboard copy elsewhere. Nothing is sent to any server.
  //
  // Usage: <button type="button" class="button secondary share-btn" data-share>
  //          Share this view</button>
  // Optional overrides: data-share-url, data-share-title.

  var toastEl = null;
  var toastTimer = null;

  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "qd-toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 2200);
  }

  function copyText(text, onDone) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          onDone(true);
        },
        function () {
          onDone(legacyCopy(text));
        },
      );
    } else {
      onDone(legacyCopy(text));
    }
  }

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (e) {}
    ta.remove();
    return ok;
  }

  function shareUrl(btn) {
    // Read the URL at click time: pages update it with replaceState as
    // the reader changes verse/root/comparison.
    var url = btn.getAttribute("data-share-url") || location.href;
    var title = btn.getAttribute("data-share-title") || document.title;
    // Optional human-readable label (e.g. "al-'Asr 103:1") that rides
    // along in the native share sheet. The copy fallback stays
    // URL-only: a pasted link should be a link.
    var text = btn.getAttribute("data-share-text") || "";
    if (navigator.share) {
      var payload = text
        ? { title: title, text: text, url: url }
        : { title: title, url: url };
      navigator.share(payload).catch(function (e) {
        // AbortError = user dismissed the sheet; anything else, fall back.
        if (e && e.name !== "AbortError") {
          copyText(url, function (ok) {
            toast(ok ? "Link copied" : "Could not copy — copy the address bar");
          });
        }
      });
    } else {
      copyText(url, function (ok) {
        toast(ok ? "Link copied" : "Could not copy — copy the address bar");
      });
    }
  }

  function initShareButtons(root) {
    (root || document).querySelectorAll("[data-share]").forEach(function (btn) {
      if (btn.dataset.shareBound) return;
      btn.dataset.shareBound = "1";
      btn.addEventListener("click", function () {
        shareUrl(btn);
      });
    });
  }

  // Copy buttons for <pre> blocks (Validation page prompts).
  // Usage: <button type="button" class="button secondary copy-btn"
  //          data-copy-target="promptId">Copy prompt</button>
  function initCopyButtons(root) {
    (root || document)
      .querySelectorAll("[data-copy-target]")
      .forEach(function (btn) {
        if (btn.dataset.copyBound) return;
        btn.dataset.copyBound = "1";
        btn.addEventListener("click", function () {
          var el = document.getElementById(btn.getAttribute("data-copy-target"));
          if (!el) return;
          copyText(el.textContent.trim(), function (ok) {
            toast(ok ? "Copied to clipboard" : "Could not copy");
          });
        });
      });
  }

  // Download an inline SVG chart as a standalone .svg file, resolving the
  // palette's CSS custom properties so the file renders outside the site.
  // Usage: qdDownloadSvg(svgElement, "filename.svg")
  window.qdDownloadSvg = function (svg, filename) {
    var clone = svg.cloneNode(true);
    var styles = getComputedStyle(document.documentElement);
    var serialized = new XMLSerializer().serializeToString(clone);
    serialized = serialized.replace(
      /var\((--[a-z0-9-]+)\)/g,
      function (m, name) {
        var v = styles.getPropertyValue(name).trim();
        return v || "#888";
      },
    );
    if (!/xmlns=/.test(serialized)) {
      serialized = serialized.replace(
        "<svg",
        '<svg xmlns="http://www.w3.org/2000/svg"',
      );
    }
    var blob = new Blob([serialized], { type: "image/svg+xml" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename || "chart.svg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 1000);
  };

  // Floating share button, stacked above the settings gear. Every page's
  // URL is a permalink (tool pages keep their state in it), so one global
  // affordance covers the whole site consistently.
  function initFloatingShare() {
    var settings = document.querySelector(".settings");
    if (!settings || document.querySelector(".share-fab")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "share-fab";
    btn.setAttribute("data-share", "");
    btn.setAttribute("aria-label", "Share this view");
    btn.title = "Share this view — copies a link to exactly what you see";
    btn.textContent = "⤴";
    settings.insertBefore(btn, settings.firstChild);
  }

  // Pages whose current view has a dedicated share page (s/root/...,
  // s/theme/..., s/surah/... — generated by build-share-pages.mjs, they
  // carry entity-specific link-preview tags) call this to point the
  // floating share button at it. Pass null to fall back to the live URL.
  window.qdSetShareUrl = function (url) {
    var fab = document.querySelector(".share-fab");
    if (!fab) return;
    if (url) fab.setAttribute("data-share-url", url);
    else fab.removeAttribute("data-share-url");
  };

  // Companion to qdSetShareUrl: a short human label ("al-'Asr 103:1")
  // for the native share sheet. Pass null to clear.
  window.qdSetShareText = function (text) {
    var fab = document.querySelector(".share-fab");
    if (!fab) return;
    if (text) fab.setAttribute("data-share-text", text);
    else fab.removeAttribute("data-share-text");
  };

  // iframe snippet for embed.html (the one page whose CSP allows
  // foreign framing). Buttons with data-embed-type/data-embed-id copy it.
  function embedSnippet(type, id, title) {
    var src =
      "https://qurandiscourse.netlify.app/embed.html?type=" +
      encodeURIComponent(type) +
      "&id=" +
      encodeURIComponent(id);
    return (
      '<iframe src="' +
      src +
      '" width="100%" height="' +
      (type === "theme" ? 340 : 300) +
      '" style="border:1px solid #d9c8a8;border-radius:10px" loading="lazy" title="' +
      (title || "Divine Discourses") +
      '"></iframe>'
    );
  }

  function initEmbedButtons(root) {
    (root || document)
      .querySelectorAll("[data-embed-type]")
      .forEach(function (btn) {
        if (btn.dataset.embedBound) return;
        btn.dataset.embedBound = "1";
        btn.addEventListener("click", function () {
          copyText(
            embedSnippet(
              btn.getAttribute("data-embed-type"),
              btn.getAttribute("data-embed-id"),
              btn.getAttribute("data-embed-title") || "",
            ),
            function (ok) {
              toast(ok ? "Embed code copied" : "Could not copy");
            },
          );
        });
      });
  }

  window.qdInitShare = function (root) {
    initShareButtons(root);
    initCopyButtons(root);
    initEmbedButtons(root);
  };
  window.qdToast = toast;
  window.qdCopyText = copyText;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initFloatingShare();
      window.qdInitShare();
    });
  } else {
    initFloatingShare();
    window.qdInitShare();
  }
})();
