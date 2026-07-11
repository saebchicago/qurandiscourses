(function () {
  "use strict";

  // Shared HTML escaper for externally sourced text (API responses).
  // Never interpolate API text into innerHTML without this.
  window.qdEsc = function (v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const TRANSLATIONS = [
    { id: "en.sahih", name: "Saheeh International", lang: "en", default: true },
    { id: "en.pickthall", name: "Pickthall", lang: "en", default: true },
    { id: "en.yusufali", name: "Yusuf Ali", lang: "en", default: true },
    { id: "en.maududi", name: "Maududi", lang: "en", default: true },
    { id: "en.asad", name: "Muhammad Asad", lang: "en", default: true },
    { id: "en.shakir", name: "Shakir", lang: "en" },
    { id: "en.arberry", name: "Arberry", lang: "en" },
    { id: "en.ahmedali", name: "Ahmed Ali", lang: "en" },
    { id: "en.daryabadi", name: "Daryabadi", lang: "en" },
    { id: "en.qaribullah", name: "Qaribullah & Darwish", lang: "en" },
    { id: "en.hilali", name: "Hilali & Khan", lang: "en" },
    { id: "en.ahmedraza", name: "Ahmed Raza Khan", lang: "en" },
    { id: "en.itani", name: "Quran in English (Itani)", lang: "en" },
    { id: "en.haleem", name: "Abdel Haleem", lang: "en" },
    { id: "en.transliteration", name: "English Transliteration", lang: "en" },
  ];

  const RECITERS = [
    { id: "ar.husary", name: "Mahmoud al-Husary" },
    { id: "ar.minshawi", name: "Mohamed al-Minshawi" },
    { id: "ar.abdulbasitmurattal", name: "Abdul Basit" },
    { id: "ar.abdurrahmaansudais", name: "Sudais" },
    { id: "ar.saoodshuraym", name: "Shuraim" },
  ];

  const state = {
    depth: "simple",
    theme: "auto",
    palette: "parchment",
    // First-visit flag: false until the reader interacts with the
    // welcome banner or tour on the home page. A preference like every
    // other field here — browser-only, reset by "Clear preferences".
    seen: false,
    reciter: "ar.husary",
    translations: TRANSLATIONS.filter((t) => t.default).map((t) => t.id),
    features: {
      showRoots: true,
      showWords: true,
      showPatterns: true,
      showAudio: true,
      showTransliteration: false,
    },
    // Reading position and exercise completion, kept only to power a
    // "continue where you left off" prompt. Same storage, same privacy
    // posture as the rest of this object: browser-only, never sent
    // anywhere, cleared by the same "Clear preferences" button.
    progress: {
      lastRead: null, // { s: surahNumber, a: "1" | "1-7" }
      exercises: {}, // { [exerciseId]: { at, attempts, score? } }
      paths: {}, // { [pathId]: { steps: { [stepIndex]: true }, at } }
    },
  };

  function load() {
    try {
      const raw = localStorage.getItem("qd_state");
      if (raw) {
        const saved = JSON.parse(raw);
        Object.assign(state, saved);
      }
    } catch (e) {}
  }
  function save() {
    try {
      localStorage.setItem("qd_state", JSON.stringify(state));
    } catch (e) {}
  }
  function clear() {
    try {
      localStorage.removeItem("qd_state");
    } catch (e) {}
    state.depth = "simple";
    state.theme = "auto";
    state.palette = "parchment";
    state.seen = false;
    state.reciter = "ar.husary";
    state.translations = TRANSLATIONS.filter((t) => t.default).map((t) => t.id);
    state.features = {
      showRoots: true,
      showWords: true,
      showPatterns: true,
      showAudio: true,
      showTransliteration: false,
    };
    state.progress = { lastRead: null, exercises: {}, paths: {} };
  }

  // Called by read.html after a verse/range successfully loads. Also
  // announces the loaded reference so decoupled features (the notes
  // panel) can follow along without patching read.html's load flow.
  window.qdSaveLastRead = function (s, a) {
    if (!state.progress) state.progress = { lastRead: null, exercises: {}, paths: {} };
    state.progress.lastRead = { s: s, a: String(a) };
    save();
    document.dispatchEvent(
      new CustomEvent("qd:verse-loaded", { detail: { s: s, a: String(a) } }),
    );
  };

  // Called by exercise pages once a reader has revealed/attempted the
  // exercise. `score` is optional: { hits, targets, falseMarks } from the
  // exercises that grade the attempt. Attempts and last score are kept —
  // browser-only, like everything else in qd_state — so the Exercises hub
  // can show "attempted N times, last score X/Y".
  window.qdMarkExerciseDone = function (exerciseId, score) {
    if (!state.progress) state.progress = { lastRead: null, exercises: {} };
    var prev = state.progress.exercises[exerciseId] || {};
    var entry = {
      at: new Date().toISOString(),
      attempts: (prev.attempts || (prev.at ? 1 : 0)) + 1,
    };
    if (score) entry.score = score;
    else if (prev.score) entry.score = prev.score;
    state.progress.exercises[exerciseId] = entry;
    save();
  };

  // Called by paths.html when a reader checks off a step. Browser-only,
  // like all progress state.
  window.qdMarkPathStep = function (pathId, stepIndex, done) {
    if (!state.progress) state.progress = { lastRead: null, exercises: {}, paths: {} };
    if (!state.progress.paths) state.progress.paths = {};
    var p = state.progress.paths[pathId] || { steps: {} };
    if (done) p.steps[stepIndex] = true;
    else delete p.steps[stepIndex];
    p.at = new Date().toISOString();
    if (Object.keys(p.steps).length === 0) {
      delete state.progress.paths[pathId];
    } else {
      state.progress.paths[pathId] = p;
    }
    save();
  };

  function applyDepth() {
    document.documentElement.setAttribute("data-depth", state.depth);
    document.querySelectorAll(".depth-toggle button").forEach((b) => {
      b.setAttribute(
        "aria-pressed",
        b.dataset.depth === state.depth ? "true" : "false",
      );
    });
    const disp = document.getElementById("depthDisplay");
    if (disp)
      disp.textContent =
        state.depth.charAt(0).toUpperCase() + state.depth.slice(1);
    const depthSel = document.getElementById("setDepth");
    if (depthSel) depthSel.value = state.depth;
    document.dispatchEvent(new CustomEvent("qd:depth-changed"));
  }
  function applyTheme() {
    const root = document.documentElement;
    // color-scheme alone only affects form controls/scrollbars; the site
    // palette lives in custom properties keyed off [data-theme] (with the
    // prefers-color-scheme media query as the "auto" default).
    if (state.theme === "light" || state.theme === "dark") {
      root.style.colorScheme = state.theme;
      root.setAttribute("data-theme", state.theme);
    } else {
      root.style.colorScheme = "light dark";
      root.removeAttribute("data-theme");
    }
    if (state.palette && state.palette !== "parchment") {
      root.setAttribute("data-palette", state.palette);
    } else {
      root.removeAttribute("data-palette");
    }
  }

  function buildPanel() {
    const panel = document.getElementById("settingsPanel");
    if (!panel) return;

    const transChecks = TRANSLATIONS.map(
      (t) =>
        `<label><input type="checkbox" data-trans="${t.id}" ${state.translations.includes(t.id) ? "checked" : ""}> ${t.name}</label>`,
    ).join("");

    const recOpts = RECITERS.map(
      (r) =>
        `<option value="${r.id}" ${state.reciter === r.id ? "selected" : ""}>${r.name}</option>`,
    ).join("");

    panel.innerHTML = `
      <h3>Display</h3>
      <h4>Show features</h4>
      <div class="check-list">
        <label><input type="checkbox" data-feature="showRoots" ${state.features.showRoots ? "checked" : ""}> Root details</label>
        <label><input type="checkbox" data-feature="showWords" ${state.features.showWords ? "checked" : ""}> Word-by-word</label>
        <label><input type="checkbox" data-feature="showPatterns" ${state.features.showPatterns ? "checked" : ""}> Pattern indicators</label>
        <label><input type="checkbox" data-feature="showAudio" ${state.features.showAudio ? "checked" : ""}> Audio player</label>
        <label><input type="checkbox" data-feature="showTransliteration" ${state.features.showTransliteration ? "checked" : ""}> Transliteration</label>
      </div>
      <h4>Depth</h4>
      <div class="row"><select id="setDepth" aria-label="Depth level">
        <option value="simple" ${state.depth === "simple" ? "selected" : ""}>Simple</option>
        <option value="scholar" ${state.depth === "scholar" ? "selected" : ""}>Scholar</option>
        <option value="encyclopedic" ${state.depth === "encyclopedic" ? "selected" : ""}>Encyclopedic</option>
      </select></div>
      <h4>Palette</h4>
      <div class="row"><select id="setPalette" aria-label="Color palette">
        <option value="parchment" ${state.palette === "parchment" || !state.palette ? "selected" : ""}>Parchment</option>
        <option value="paper" ${state.palette === "paper" ? "selected" : ""}>Paper</option>
        <option value="sage" ${state.palette === "sage" ? "selected" : ""}>Sage</option>
      </select></div>
      <h4>Theme</h4>
      <div class="row"><select id="setTheme">
        <option value="auto" ${state.theme === "auto" ? "selected" : ""}>Auto (system)</option>
        <option value="light" ${state.theme === "light" ? "selected" : ""}>Light</option>
        <option value="dark" ${state.theme === "dark" ? "selected" : ""}>Dark</option>
      </select></div>
      <div class="actions">
        <button id="clearPrefs">Clear preferences</button>
      </div>
      <p class="small">Preferences are saved in this browser only and never sent anywhere. Clear them anytime above.</p>
    `;

    panel.querySelectorAll("[data-feature]").forEach((cb) => {
      cb.addEventListener("change", () => {
        state.features[cb.dataset.feature] = cb.checked;
        save();
        document.dispatchEvent(new CustomEvent("qd:features-changed"));
      });
    });
    const depthSel = document.getElementById("setDepth");
    if (depthSel)
      depthSel.addEventListener("change", () => {
        state.depth = depthSel.value;
        save();
        applyDepth();
      });
    const paletteSel = document.getElementById("setPalette");
    if (paletteSel)
      paletteSel.addEventListener("change", () => {
        state.palette = paletteSel.value;
        save();
        applyTheme();
      });
    const themeSel = document.getElementById("setTheme");
    if (themeSel)
      themeSel.addEventListener("change", () => {
        state.theme = themeSel.value;
        save();
        applyTheme();
      });
    const clearBtn = document.getElementById("clearPrefs");
    if (clearBtn)
      clearBtn.addEventListener("click", () => {
        clear();
        applyDepth();
        applyTheme();
        buildPanel();
        document.dispatchEvent(new CustomEvent("qd:reset"));
      });
  }

  function initSettings() {
    const btn = document.getElementById("gearBtn");
    const panel = document.getElementById("settingsPanel");
    if (!btn || !panel) return;
    btn.addEventListener("click", () => {
      const open = panel.hasAttribute("hidden");
      if (open) {
        panel.removeAttribute("hidden");
        btn.setAttribute("aria-expanded", "true");
      } else {
        panel.setAttribute("hidden", "");
        btn.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hasAttribute("hidden")) {
        panel.setAttribute("hidden", "");
        btn.setAttribute("aria-expanded", "false");
        btn.focus();
      }
      if (!e.target.matches("input,select,textarea")) {
        if (e.key === "1") {
          state.depth = "simple";
          save();
          applyDepth();
        }
        if (e.key === "2") {
          state.depth = "scholar";
          save();
          applyDepth();
        }
        if (e.key === "3") {
          state.depth = "encyclopedic";
          save();
          applyDepth();
        }
      }
    });
  }

  window.qdFetchVerse = async function (surah, ayah) {
    const editions = ["quran-uthmani", ...state.translations];
    const url = `https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/editions/${editions.join(",")}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Fetch failed");
    const json = await res.json();
    return json.data;
  };

  window.qdFetchSurah = async function (surah) {
    const editions = ["quran-uthmani", ...state.translations];
    const url = `https://api.alquran.cloud/v1/surah/${surah}/editions/${editions.join(",")}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Fetch failed");
    const json = await res.json();
    return json.data;
  };

  const TOOLTIPS = {
    "depth-simple":
      "Shows verse text, translations, and audio. No morphology or annotations.",
    "depth-scholar":
      "Adds word-by-word morphology, root links, and chronological period distribution.",
    "depth-encyclopedic":
      "Adds full structural pattern notes and complete source provenance for every claim.",
    "label-verified":
      "Confirmed from a primary corpus or canonical edition. The source is named and linked.",
    "label-pending":
      "Awaiting triangulation from a second independent source before being marked Verified.",
    "label-nuanced":
      "The counting method or interpretation has known variation across sources. See the source detail for the specific approach used.",
  };

  function initTooltips() {
    let activeTooltip = null;

    function createTooltip(content) {
      const tooltip = document.createElement("div");
      tooltip.className = "tooltip-popup";
      tooltip.textContent = content;
      tooltip.style.position = "absolute";
      tooltip.style.zIndex = "1000";
      tooltip.style.backgroundColor = "var(--bg-contrast, #333)";
      tooltip.style.color = "var(--text-contrast, #fff)";
      tooltip.style.padding = "0.5rem 0.75rem";
      tooltip.style.borderRadius = "4px";
      tooltip.style.fontSize = "0.85rem";
      tooltip.style.lineHeight = "1.4";
      tooltip.style.maxWidth = "240px";
      tooltip.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
      tooltip.style.pointerEvents = "none";
      return tooltip;
    }

    function positionTooltip(tooltip, button) {
      const rect = button.getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset;
      const scrollX = window.scrollX || window.pageXOffset;

      tooltip.style.left = rect.left + scrollX + rect.width / 2 + "px";
      tooltip.style.top = rect.bottom + scrollY + 8 + "px";
      tooltip.style.transform = "translateX(-50%)";
    }

    function showTooltip(button, tipId) {
      const content = TOOLTIPS[tipId];
      if (!content) return;

      hideTooltip();

      const tooltip = createTooltip(content);
      document.body.appendChild(tooltip);
      positionTooltip(tooltip, button);
      activeTooltip = tooltip;

      tooltip.addEventListener("click", hideTooltip);
    }

    function hideTooltip() {
      if (activeTooltip) {
        activeTooltip.remove();
        activeTooltip = null;
      }
    }

    document.querySelectorAll(".info-tip").forEach((button) => {
      const tipId = button.getAttribute("data-tip");
      if (!tipId) return;

      button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeTooltip) {
          hideTooltip();
        } else {
          showTooltip(button, tipId);
        }
      });

      button.addEventListener("mouseenter", () => {
        if (window.innerWidth > 768) {
          showTooltip(button, tipId);
        }
      });

      button.addEventListener("mouseleave", () => {
        if (window.innerWidth > 768) {
          hideTooltip();
        }
      });
    });

    document.addEventListener("click", (e) => {
      if (!e.target.matches(".info-tip") && activeTooltip) {
        hideTooltip();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && activeTooltip) {
        hideTooltip();
      }
    });
  }

  // Citation-badge popovers are owned entirely by cite-badge.js, which
  // handles data-source-ids badges with full keyboard support. Do not
  // duplicate that logic here — a second implementation on the same
  // selector previously caused two overlapping popovers per click.

  function initInlineDepth() {
    document.querySelectorAll(".depth-toggle.inline button").forEach((b) => {
      b.addEventListener("click", () => {
        state.depth = b.dataset.depth;
        save();
        applyDepth();
      });
    });
  }

  window.qdState = state;
  window.qdSaveState = save;
  window.qdTranslations = TRANSLATIONS;
  window.qdReciters = RECITERS;

  function initBackToTop() {
    const btn = document.createElement("button");
    btn.className = "back-to-top";
    btn.type = "button";
    btn.setAttribute("aria-label", "Back to top");
    btn.textContent = "↑";
    btn.hidden = true;
    document.body.appendChild(btn);
    let reduce = false;
    try {
      reduce =
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {}
    btn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });
    window.addEventListener(
      "scroll",
      () => {
        btn.hidden = window.scrollY < 600;
      },
      { passive: true },
    );
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    applyTheme();
    buildPanel();
    initSettings();
    initTooltips();
    initInlineDepth();
    initBackToTop();
    applyDepth();
  });
})();
