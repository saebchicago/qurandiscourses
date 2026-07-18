(function () {
  "use strict";

  // 60-second welcome tour for the home page (the only page that loads
  // this file). One positioned card steps through the site's core
  // affordances with an accent outline on each target — no backdrop
  // spotlight, which stays honest at 375px. Zero dependencies; keyboard
  // complete (Esc closes, arrows navigate); respects
  // prefers-reduced-motion. Also owns the first-visit welcome banner
  // and the "?" reopen button in the settings stack.

  var STEPS = [
    {
      sel: "#ask-input",
      title: "Ask anything",
      body: "Type a surah (Fatihah), a verse (2:255), a root (r-h-m), or an English word (mercy) — you'll be routed to the right tool.",
    },
    {
      sel: "#beginSection h2",
      title: "Three ways in",
      body: "Read to sit with the text, Study to follow a question, Verify to check the evidence behind any claim.",
    },
    {
      sel: '[data-case-studies="home"] .badge',
      title: "Every claim carries a label",
      body: "● Verified, ○ Pending, ~ Nuanced. Click any label anywhere to see the full citation of its source.",
    },
    {
      sel: ".share-fab",
      title: "Share exactly what you see",
      body: "Every page's address is a permalink. This button copies it — or opens your device's share sheet.",
    },
    {
      sel: ".settings .gear",
      title: "Depth, translations, palette",
      body: "The gear sets your depth (Simple / Scholar / Encyclopedic — or keys 1/2/3), translations, and colors. Saved in this browser only.",
    },
  ];

  var card = null;
  var current = -1;
  var lastFocus = null;
  var reduce = false;
  try {
    reduce =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {}

  function targetFor(i) {
    return document.querySelector(STEPS[i].sel);
  }

  function clearHighlight() {
    document.querySelectorAll(".tour-highlight").forEach(function (el) {
      el.classList.remove("tour-highlight");
    });
  }

  function endTour() {
    clearHighlight();
    if (card) {
      card.remove();
      card = null;
    }
    current = -1;
    document.removeEventListener("keydown", onKey, true);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    markSeen();
  }

  function onKey(e) {
    if (current < 0) return;
    if (e.key === "Escape") {
      // This listener runs on the capture phase (registered with `true`
      // below) so it fires before a nav dropdown's own bubble-phase Escape
      // handler — without this check, Escape closed the dropdown AND
      // ended the whole tour in one press. An open dropdown is the
      // topmost layer; let it consume Escape for itself.
      if (document.querySelector(".nav-menu:not([hidden])")) return;
      e.preventDefault();
      endTour();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      show(current + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      show(current - 1);
    }
  }

  function show(i) {
    // Skip steps whose target is missing (e.g. share fab not injected).
    while (i >= 0 && i < STEPS.length && !targetFor(i)) {
      i += i >= current ? 1 : -1;
    }
    if (i < 0) i = 0;
    if (i >= STEPS.length) {
      endTour();
      return;
    }
    current = i;
    var step = STEPS[i];
    var target = targetFor(i);

    clearHighlight();
    target.classList.add("tour-highlight");
    target.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "center",
    });

    if (!card) {
      card = document.createElement("div");
      card.className = "tour-card";
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-label", "Welcome tour");
      document.body.appendChild(card);
      document.addEventListener("keydown", onKey, true);
    }
    card.innerHTML =
      '<p class="tour-step" aria-live="polite">Step ' +
      (i + 1) +
      " of " +
      STEPS.length +
      "</p>" +
      "<h3>" +
      step.title +
      "</h3>" +
      "<p>" +
      step.body +
      "</p>" +
      '<div class="tour-actions">' +
      (i > 0
        ? '<button type="button" class="button secondary" data-tour="prev">‹ Back</button>'
        : "") +
      '<button type="button" class="button" data-tour="next">' +
      (i === STEPS.length - 1 ? "Done" : "Next ›") +
      "</button>" +
      '<button type="button" class="button secondary" data-tour="close" aria-label="Close tour">×</button>' +
      "</div>";
    card.querySelectorAll("[data-tour]").forEach(function (b) {
      b.addEventListener("click", function () {
        var a = b.getAttribute("data-tour");
        if (a === "prev") show(current - 1);
        else if (a === "next") show(current + 1);
        else endTour();
      });
    });

    // Position under the target (above if no room), clamped to viewport.
    var r = target.getBoundingClientRect();
    var cw = Math.min(320, window.innerWidth - 24);
    card.style.width = cw + "px";
    var left = Math.max(
      12,
      Math.min(r.left + r.width / 2 - cw / 2, window.innerWidth - cw - 12),
    );
    var top = r.bottom + 10 + window.scrollY;
    card.style.left = left + "px";
    card.style.top = top + "px";
    card.querySelector("[data-tour='next']").focus();
    // Re-clamp after any smooth scroll settles.
    setTimeout(function () {
      if (current !== i || !card) return;
      var r2 = target.getBoundingClientRect();
      var t2 = r2.bottom + 10 + window.scrollY;
      if (r2.bottom + 160 > window.innerHeight)
        t2 = r2.top + window.scrollY - card.offsetHeight - 10;
      card.style.top = Math.max(window.scrollY + 8, t2) + "px";
      card.style.left =
        Math.max(
          12,
          Math.min(
            r2.left + r2.width / 2 - cw / 2,
            window.innerWidth - cw - 12,
          ),
        ) + "px";
    }, reduce ? 30 : 450);
  }

  function startTour() {
    lastFocus = document.activeElement;
    markSeen();
    hideBanner();
    show(0);
  }

  function markSeen() {
    if (window.qdState && !window.qdState.seen) {
      window.qdState.seen = true;
      if (window.qdSaveState) window.qdSaveState();
    }
  }

  function hideBanner() {
    var b = document.getElementById("welcomeBanner");
    if (b) b.hidden = true;
  }

  function initBanner() {
    var banner = document.getElementById("welcomeBanner");
    if (!banner) return;
    if (window.qdState && window.qdState.seen) return; // returning reader
    banner.hidden = false;
    // Any interaction counts as "seen": a depth pick (the buttons are
    // wired by app.js initInlineDepth), the tour, or dismissal.
    banner.querySelectorAll(".depth-toggle button").forEach(function (b) {
      b.addEventListener("click", function () {
        markSeen();
        hideBanner();
      });
    });
    var dismiss = document.getElementById("welcomeDismiss");
    if (dismiss)
      dismiss.addEventListener("click", function () {
        markSeen();
        hideBanner();
      });
  }

  function initTourButtons() {
    var tourBtn = document.getElementById("welcomeTourBtn");
    if (tourBtn) tourBtn.addEventListener("click", startTour);
    // "?" reopen button, stacked with the share/settings buttons.
    var settings = document.querySelector(".settings");
    if (settings && !document.querySelector(".tour-fab")) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tour-fab";
      btn.setAttribute("aria-label", "Open the welcome tour");
      btn.title = "Take the 60-second tour";
      btn.textContent = "?";
      btn.addEventListener("click", startTour);
      settings.insertBefore(btn, settings.firstChild);
    }
  }

  function init() {
    initBanner();
    initTourButtons();
  }
  // This script is deferred, so readyState is already "interactive" when
  // it runs — but DOMContentLoaded has NOT fired yet, and app.js's
  // listener (which loads qdState from storage) must run before
  // initBanner reads qdState.seen. Only call init() directly if the
  // event is truly past ("complete").
  if (document.readyState === "complete") {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
