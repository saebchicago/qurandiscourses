(function () {
  "use strict";

  const TRANSLATIONS = [
    { id: "en.sahih", name: "Saheeh International", lang: "en", default: true },
    { id: "en.pickthall", name: "Pickthall", lang: "en", default: true },
    { id: "en.yusufali", name: "Yusuf Ali", lang: "en", default: true },
    { id: "en.maududi", name: "Maududi", lang: "en", default: true },
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
    { id: "ar.alafasy", name: "Mishary Alafasy" },
  ];

  const state = {
    depth: "simple",
    theme: "auto",
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
      const raw = sessionStorage.getItem("qd_state");
      if (raw) {
        const saved = JSON.parse(raw);
        Object.assign(state, saved);
      }
    } catch (e) {}
  }
  function save() {
    try {
      sessionStorage.setItem("qd_state", JSON.stringify(state));
    } catch (e) {}
  }
  function clear() {
    try {
      sessionStorage.removeItem("qd_state");
    } catch (e) {}
    state.depth = "simple";
    state.theme = "auto";
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
    document.dispatchEvent(new CustomEvent("qd:depth-changed"));
  }
  function applyTheme() {
    if (state.theme === "light")
      document.documentElement.style.colorScheme = "light";
    else if (state.theme === "dark")
      document.documentElement.style.colorScheme = "dark";
    else document.documentElement.style.colorScheme = "light dark";
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
      <h3>Depth</h3>
      <div class="depth-toggle" role="group" aria-label="Depth level">
        <button data-depth="simple">Simple</button>
        <button data-depth="scholar">Scholar</button>
        <button data-depth="encyclopedic">Encyclopedic</button>
      </div>
      <p class="small">Simple shows core evidence. Scholar adds derivations and citations. Encyclopedic shows everything.</p>
      <h4>Translations to show</h4>
      <div class="actions" style="flex-wrap:wrap;margin:.3rem 0 .5rem">
        <button id="qsDefault">Default set</button>
        <button id="qsClassical">Classical</button>
        <button id="qsModern">Modern</button>
        <button id="qsClear">Clear all</button>
      </div>
      <div class="check-list" id="transList">${transChecks}</div>
      <h4>Reciter</h4>
      <div class="row"><select id="setRec">${recOpts}</select></div>
      <h4>Show features</h4>
      <div class="check-list">
        <label><input type="checkbox" data-feature="showRoots" ${state.features.showRoots ? "checked" : ""}> Root details</label>
        <label><input type="checkbox" data-feature="showWords" ${state.features.showWords ? "checked" : ""}> Word-by-word</label>
        <label><input type="checkbox" data-feature="showPatterns" ${state.features.showPatterns ? "checked" : ""}> Pattern indicators</label>
        <label><input type="checkbox" data-feature="showAudio" ${state.features.showAudio ? "checked" : ""}> Audio player</label>
        <label><input type="checkbox" data-feature="showTransliteration" ${state.features.showTransliteration ? "checked" : ""}> Transliteration</label>
      </div>
      <h4>Theme</h4>
      <div class="row"><select id="setTheme">
        <option value="auto" ${state.theme === "auto" ? "selected" : ""}>Auto (system)</option>
        <option value="light" ${state.theme === "light" ? "selected" : ""}>Light</option>
        <option value="dark" ${state.theme === "dark" ? "selected" : ""}>Dark</option>
      </select></div>
      <div class="actions">
        <button id="clearPrefs">Clear preferences</button>
      </div>
      <p class="small">Stored only in this browser tab. Cleared when the tab closes.</p>
    `;

    panel.querySelectorAll(".depth-toggle button").forEach((b) => {
      b.addEventListener("click", () => {
        state.depth = b.dataset.depth;
        save();
        applyDepth();
      });
    });
    panel.querySelectorAll("[data-trans]").forEach((cb) => {
      cb.addEventListener("change", () => {
        const id = cb.dataset.trans;
        if (cb.checked) {
          if (!state.translations.includes(id)) state.translations.push(id);
        } else {
          state.translations = state.translations.filter((x) => x !== id);
        }
        save();
        document.dispatchEvent(new CustomEvent("qd:translations-changed"));
      });
    });
    panel.querySelectorAll("[data-feature]").forEach((cb) => {
      cb.addEventListener("change", () => {
        state.features[cb.dataset.feature] = cb.checked;
        save();
        document.dispatchEvent(new CustomEvent("qd:features-changed"));
      });
    });
    const recSel = document.getElementById("setRec");
    if (recSel)
      recSel.addEventListener("change", () => {
        state.reciter = recSel.value;
        save();
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

    function applyQuickSwap(ids) {
      state.translations = ids;
      save();
      buildPanel();
      document.dispatchEvent(new CustomEvent("qd:translations-changed"));
    }
    const qsDefault = document.getElementById("qsDefault");
    if (qsDefault)
      qsDefault.addEventListener("click", () =>
        applyQuickSwap([
          "en.sahih",
          "en.pickthall",
          "en.yusufali",
          "en.maududi",
        ]),
      );
    const qsClassical = document.getElementById("qsClassical");
    if (qsClassical)
      qsClassical.addEventListener("click", () =>
        applyQuickSwap([
          "en.pickthall",
          "en.yusufali",
          "en.arberry",
          "en.shakir",
        ]),
      );
    const qsModern = document.getElementById("qsModern");
    if (qsModern)
      qsModern.addEventListener("click", () =>
        applyQuickSwap(["en.sahih", "en.haleem", "en.itani", "en.ahmedali"]),
      );
    const qsClear = document.getElementById("qsClear");
    if (qsClear) qsClear.addEventListener("click", () => applyQuickSwap([]));

    applyDepth();
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

  function markActiveNav() {
    const path = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll("nav.primary a").forEach((a) => {
      const href = a.getAttribute("href");
      if (href === path || (path === "" && href === "index.html"))
        a.classList.add("active");
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

  window.qdState = state;
  window.qdTranslations = TRANSLATIONS;
  window.qdReciters = RECITERS;

  document.addEventListener("DOMContentLoaded", () => {
    load();
    applyTheme();
    buildPanel();
    initSettings();
    markActiveNav();
  });
})();
