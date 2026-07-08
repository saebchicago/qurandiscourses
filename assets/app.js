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
    reciter: "ar.husary",
    translations: TRANSLATIONS.filter((t) => t.default).map((t) => t.id),
    features: {
      showRoots: true,
      showWords: true,
      showPatterns: true,
      showAudio: true,
      showTransliteration: false,
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
    state.reciter = "ar.husary";
    state.translations = TRANSLATIONS.filter((t) => t.default).map((t) => t.id);
    state.features = {
      showRoots: true,
      showWords: true,
      showPatterns: true,
      showAudio: true,
      showTransliteration: false,
    };
  }

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

  let sourcesData = null;
  let activeSourcePopover = null;

  async function loadSources() {
    if (sourcesData) return sourcesData;
    try {
      const res = await fetch("data/sources.json");
      if (!res.ok) throw new Error("Failed to load sources");
      const data = await res.json();
      sourcesData = data.sources;
      return sourcesData;
    } catch (e) {
      console.error("Failed to load sources.json:", e);
      return [];
    }
  }

  function createSourcePopover(sourceIds, targetElement) {
    if (!sourcesData) return null;

    const ids = sourceIds.split(",").map((id) => id.trim());
    const sources = ids
      .map((id) => sourcesData.find((s) => s.id === id))
      .filter(Boolean);

    if (sources.length === 0) return null;

    const popover = document.createElement("div");
    popover.className = "source-popover";
    popover.style.position = "absolute";
    popover.style.zIndex = "2000";
    popover.style.backgroundColor = "var(--card)";
    popover.style.border = "1px solid var(--accent)";
    popover.style.borderRadius = "6px";
    popover.style.padding = "0.75rem 1rem";
    popover.style.boxShadow = "var(--shadow-lg)";
    popover.style.maxWidth = "320px";
    popover.style.fontSize = "0.85rem";
    popover.style.lineHeight = "1.5";

    let html = "";
    sources.forEach((source, idx) => {
      if (idx > 0)
        html +=
          '<hr style="margin: 0.6rem 0; border: none; border-top: 1px solid var(--line);">';
      html += `<div style="margin-bottom: 0.4rem;"><strong>${source.name}</strong>`;
      if (source.edition)
        html += ` <span style="color: var(--muted);">${source.edition}</span>`;
      html += `</div>`;
      if (source.author)
        html += `<div style="font-size: 0.82rem; color: var(--muted);">Author: ${source.author}</div>`;
      if (source.publisher)
        html += `<div style="font-size: 0.82rem; color: var(--muted);">${source.publisher}`;
      if (source.year) html += `, ${source.year}`;
      html += `</div>`;
      if (source.isbn)
        html += `<div style="font-size: 0.82rem; color: var(--muted);">ISBN: ${source.isbn}</div>`;
      if (source.url)
        html += `<div style="margin-top: 0.3rem;"><a href="${source.url}" target="_blank" rel="noopener" style="font-size: 0.82rem;">${source.url}</a></div>`;
      if (source.accessed)
        html += `<div style="font-size: 0.78rem; color: var(--muted); margin-top: 0.25rem;">Accessed: ${source.accessed}</div>`;
    });

    popover.innerHTML = html;

    const rect = targetElement.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;

    document.body.appendChild(popover);

    const popoverRect = popover.getBoundingClientRect();
    let top = rect.bottom + scrollY + 8;
    let left = rect.left + scrollX;

    if (left + popoverRect.width > window.innerWidth) {
      left = window.innerWidth - popoverRect.width - 16;
    }
    if (left < 8) left = 8;

    if (top + popoverRect.height > window.innerHeight + scrollY) {
      top = rect.top + scrollY - popoverRect.height - 8;
    }

    popover.style.left = left + "px";
    popover.style.top = top + "px";

    return popover;
  }

  function hideSourcePopover() {
    if (activeSourcePopover) {
      activeSourcePopover.remove();
      activeSourcePopover = null;
    }
  }

  async function initSourcePopovers() {
    await loadSources();

    document.querySelectorAll(".badge[data-source-ids]").forEach((badge) => {
      badge.style.cursor = "pointer";
      badge.setAttribute("role", "button");
      badge.setAttribute("tabindex", "0");

      badge.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeSourcePopover) {
          hideSourcePopover();
        } else {
          const sourceIds = badge.getAttribute("data-source-ids");
          if (sourceIds) {
            activeSourcePopover = createSourcePopover(sourceIds, badge);
          }
        }
      });

      badge.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          badge.click();
        }
      });
    });

    document.addEventListener("click", (e) => {
      if (
        activeSourcePopover &&
        !e.target.closest(".badge[data-source-ids]") &&
        !e.target.closest(".source-popover")
      ) {
        hideSourcePopover();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && activeSourcePopover) {
        hideSourcePopover();
      }
    });
  }

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
    initSourcePopovers();
    initInlineDepth();
    initBackToTop();
    applyDepth();
  });
})();
