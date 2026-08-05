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
    { id: "en.pickthall", name: "Pickthall", lang: "en" },
    { id: "en.yusufali", name: "Yusuf Ali", lang: "en", default: true },
    { id: "en.maududi", name: "Maududi", lang: "en" },
    { id: "en.asad", name: "Muhammad Asad", lang: "en" },
    { id: "en.shakir", name: "Shakir", lang: "en" },
    { id: "en.arberry", name: "Arberry", lang: "en" },
    { id: "en.ahmedali", name: "Ahmed Ali", lang: "en" },
    { id: "en.daryabadi", name: "Daryabadi", lang: "en" },
    { id: "en.qaribullah", name: "Qaribullah & Darwish", lang: "en" },
    { id: "en.hilali", name: "Hilali & Khan", lang: "en" },
    { id: "en.ahmedraza", name: "Ahmed Raza Khan", lang: "en" },
    { id: "en.itani", name: "Quran in English (Itani)", lang: "en" },
    { id: "en.wahiduddin", name: "Wahiduddin Khan", lang: "en" },
    { id: "en.transliteration", name: "English Transliteration", lang: "en" },
    { id: "ur.jalandhry", name: "Fateh Muhammad Jalandhry (Urdu)", lang: "ur" },
    { id: "ur.kanzuliman", name: "Ahmed Raza Khan — Kanz-ul-Iman (Urdu)", lang: "ur" },
    { id: "ur.maududi", name: "Abul A'la Maududi (Urdu)", lang: "ur" },
    { id: "ur.junagarhi", name: "Muhammad Junagarhi (Urdu)", lang: "ur" },
    { id: "ur.qadri", name: "Tahir ul-Qadri (Urdu)", lang: "ur" },
    { id: "ur.jawadi", name: "Syed Zeeshan Haider Jawadi (Urdu)", lang: "ur" },
    { id: "ur.ahmedali", name: "Ahmed Ali (Urdu)", lang: "ur" },
    { id: "ur.najafi", name: "Najafi (Urdu)", lang: "ur" },
    { id: "bn.bengali", name: "Muhiuddin Khan (Bengali)", lang: "bn" },
    { id: "bn.hoque", name: "Zohurul Hoque (Bengali)", lang: "bn" },
    { id: "ms.basmeih", name: "Abdullah Muhammad Basmeih (Malay)", lang: "ms" },
    { id: "id.indonesian", name: "Kementerian Agama (Indonesian)", lang: "id" },
    { id: "fr.hamidullah", name: "Muhammad Hamidullah (French)", lang: "fr" },
    { id: "es.cortes", name: "Julio Cortés (Spanish)", lang: "es" },
    { id: "tr.diyanet", name: "Diyanet İşleri (Turkish)", lang: "tr" },
    { id: "tr.yazir", name: "Elmalılı Hamdi Yazır (Turkish)", lang: "tr" },
    { id: "bs.korkut", name: "Besim Korkut (Bosnian)", lang: "bs" },
    { id: "bs.mlivo", name: "Mustafa Mlivo (Bosnian)", lang: "bs" },
    { id: "zh.jian", name: "Ma Jian (Chinese)", lang: "zh" },
    // The API names no translator for these two (it reports "Unknown"),
    // so neither does this list. Naming one from outside the source
    // would be an attribution the site cannot show its work for.
    { id: "ja.japanese", name: "Japanese translation", lang: "ja" },
    { id: "ko.korean", name: "Korean translation", lang: "ko" },
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
        // One-time migration: the middle depth tier was renamed from
        // "scholar" to "study" (its stored value, matching the rename of
        // every "Scholar" label/class/data-attribute across the site). A
        // returning visitor's saved preference otherwise stops matching
        // any known depth and silently falls back to Simple. Persist the
        // fix immediately so this only runs once per visitor, not once
        // per page load.
        if (state.depth === "scholar") {
          state.depth = "study";
          save();
        }
      }
    } catch (e) {}
  }
  // Set by the "Clear preferences" handler: the clear itself triggers a
  // depth re-render, whose load/fetch cascade would immediately re-persist
  // the state and passage cache it just removed. While paused, nothing is
  // written to storage; the next real user gesture (pointer or key, armed
  // one-shot in the clear handler) resumes persistence — new reading
  // activity is legitimately recorded again.
  let persistPaused = false;
  function save() {
    if (persistPaused) return;
    try {
      localStorage.setItem("qd_state", JSON.stringify(state));
    } catch (e) {}
  }
  function clear() {
    try {
      localStorage.removeItem("qd_state");
      localStorage.removeItem("qd_apicache");
      localStorage.removeItem("qd_wbwcache");
      // Older builds mistakenly mirrored qd_state into sessionStorage;
      // sweep that up too so "clear" means clear.
      sessionStorage.removeItem("qd_state");
    } catch (e) {}
    // apiCacheLoad() short-circuits on a truthy in-memory apiCache, so
    // without this reset the next fetch would silently rewrite the
    // "cleared" localStorage key from the stale in-memory copy.
    apiCache = null;
    state.depth = "simple";
    state.theme = "auto";
    state.palette = "parchment";
    state.seen = false;
    state.reciter = "ar.husary";
    state.translations = TRANSLATIONS.filter((t) => t.default).map((t) => t.id);
    state.features = {
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
    if (!state.progress) state.progress = { lastRead: null, exercises: {}, paths: {} };
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

    // Translations and reciter are chosen on the Read page (the
    // per-verse "N selected" and 🎤 buttons), not here — the panel
    // covers cross-page presentation only.
    panel.innerHTML = `
      <h3>Display</h3>
      <h4>Depth <span class="small" style="font-weight: 400">(keys <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>)</span></h4>
      <div class="row"><select id="setDepth" aria-label="Depth level">
        <option value="simple" ${state.depth === "simple" ? "selected" : ""}>Simple — just read</option>
        <option value="study" ${state.depth === "study" ? "selected" : ""}>Study — analyze</option>
        <option value="encyclopedic" ${state.depth === "encyclopedic" ? "selected" : ""}>Encyclopedic — verify</option>
      </select></div>
      <h4>Show features</h4>
      <div class="check-list">
        <label><input type="checkbox" data-feature="showWords" ${state.features.showWords ? "checked" : ""}> Word-by-word breakdown</label>
        <label><input type="checkbox" data-feature="showPatterns" ${state.features.showPatterns ? "checked" : ""}> Pattern notes</label>
        <label><input type="checkbox" data-feature="showAudio" ${state.features.showAudio ? "checked" : ""}> Audio player</label>
        <label><input type="checkbox" data-feature="showTransliteration" ${state.features.showTransliteration ? "checked" : ""}> Transliteration</label>
      </div>
      <p class="small">Feature choices apply on the Read page.</p>
      <h4>Palette</h4>
      <div class="row"><select id="setPalette" aria-label="Color palette">
        <option value="parchment" ${state.palette === "parchment" || !state.palette ? "selected" : ""}>Parchment</option>
        <option value="paper" ${state.palette === "paper" ? "selected" : ""}>Paper</option>
        <option value="sage" ${state.palette === "sage" ? "selected" : ""}>Sage</option>
      </select></div>
      <h4>Theme</h4>
      <div class="row"><select id="setTheme" aria-label="Light or dark theme">
        <option value="auto" ${state.theme === "auto" ? "selected" : ""}>Auto (system)</option>
        <option value="light" ${state.theme === "light" ? "selected" : ""}>Light</option>
        <option value="dark" ${state.theme === "dark" ? "selected" : ""}>Dark</option>
      </select></div>
      <div class="actions">
        <button id="clearPrefs">Clear preferences &amp; reading history</button>
      </div>
      <p class="small">This clears display choices, reading progress, and the passage cache from this browser. It does not delete study notes. <a href="/about#privacy">Privacy and data controls</a>.</p>
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
        // applyDepth() re-renders the page (correct), but its load/fetch
        // cascade would re-save state and re-fill the passage cache the
        // reader just cleared. Pause persistence until their next real
        // gesture; the click that got us here has already fired its
        // pointerdown, so these only trip on the NEXT interaction.
        persistPaused = true;
        const resume = () => {
          persistPaused = false;
        };
        document.addEventListener("pointerdown", resume, {
          once: true,
          capture: true,
        });
        document.addEventListener("keydown", resume, {
          once: true,
          capture: true,
        });
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
    // The gear glyph alone is not a discoverable label; give the button
    // visible text (shown at wider widths via CSS) and a clearer name.
    // Injected here rather than edited into 28 pages of markup.
    if (!btn.querySelector(".gear-label")) {
      const label = document.createElement("span");
      label.className = "gear-label";
      label.textContent = "Display";
      btn.appendChild(label);
      btn.setAttribute("aria-label", "Display settings");
      btn.title = "Display settings";
    }
    const stack = btn.closest(".settings");
    function setOpen(open) {
      if (open) {
        panel.removeAttribute("hidden");
        btn.setAttribute("aria-expanded", "true");
      } else {
        panel.setAttribute("hidden", "");
        btn.setAttribute("aria-expanded", "false");
      }
      // While the panel is open it covers the share/tour buttons that
      // stack above the gear; hide them so nothing sits half-covered.
      if (stack) stack.classList.toggle("panel-open", open);
    }
    btn.addEventListener("click", () => {
      setOpen(panel.hasAttribute("hidden"));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hasAttribute("hidden")) {
        setOpen(false);
        btn.focus();
      }
      // While any dialog is open, depth hotkeys must not re-render the
      // page behind the overlay.
      if (document.querySelector('[aria-modal="true"]')) return;
      if (!e.target.matches("input,select,textarea")) {
        if (e.key === "1") {
          state.depth = "simple";
          save();
          applyDepth();
        }
        if (e.key === "2") {
          state.depth = "study";
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

  function enhanceTrustLinks() {
    document.querySelectorAll("footer.site .footer-links").forEach((links) => {
      if (links.querySelector("[data-trust-link]")) return;
      const about = links.querySelector('a[href$="/about"]');
      if (!about) return;
      const trust = document.createElement("a");
      trust.href = about.getAttribute("href") + "#trust";
      trust.textContent = "Trust & access";
      trust.setAttribute("data-trust-link", "");
      links.appendChild(document.createTextNode(" · "));
      links.appendChild(trust);
    });
  }

  // Persistent cache for api.alquran.cloud responses. Quranic text and
  // published translations are immutable, so a response can be reused
  // across visits — repeat reads render without the network, and verses
  // read before going offline stay readable. Keyed by the full request
  // URL, which encodes the selected editions, so changing translations
  // never serves a stale shape. Browser-only, cleared with everything
  // else by clear().
  const API_CACHE_KEY = "qd_apicache";
  const API_CACHE_MAX = 200;
  let apiCache = null;
  function apiCacheLoad() {
    if (apiCache) return apiCache;
    apiCache = { v: 1, order: [], entries: {} };
    try {
      const saved = JSON.parse(localStorage.getItem(API_CACHE_KEY));
      if (saved && saved.v === 1 && saved.entries && saved.order) {
        apiCache = saved;
      }
    } catch (e) {}
    return apiCache;
  }
  function apiCachePut(url, data) {
    const c = apiCacheLoad();
    if (!c.entries[url]) c.order.push(url);
    c.entries[url] = data;
    while (c.order.length > API_CACHE_MAX) delete c.entries[c.order.shift()];
    // In-memory cache stays warm either way; only the storage write is
    // suspended while a just-cleared page settles.
    if (persistPaused) return;
    try {
      localStorage.setItem(API_CACHE_KEY, JSON.stringify(c));
    } catch (e) {
      // Quota exceeded (surah responses are large): evict the older
      // half and retry once; if storage still refuses, stay in-memory.
      c.order.splice(0, Math.ceil(c.order.length / 2)).forEach(function (u) {
        delete c.entries[u];
      });
      try {
        localStorage.setItem(API_CACHE_KEY, JSON.stringify(c));
      } catch (e2) {}
    }
  }
  async function apiCachedFetch(url) {
    const c = apiCacheLoad();
    if (c.entries[url]) return c.entries[url];
    const res = await fetch(url);
    if (!res.ok) {
      // Carry the status so callers can tell a 404 (bad reference) from
      // a network failure — the two need different explanations.
      const err = new Error("HTTP " + res.status);
      err.status = res.status;
      throw err;
    }
    const json = await res.json();
    apiCachePut(url, json.data);
    return json.data;
  }

  // alquran.cloud silently substitutes a default edition (Arabic
  // quran-simple) for an invalid/removed edition ID instead of erroring —
  // the exact failure mode that let a dead "en.haleem" ID serve Arabic
  // text mislabeled as an English translation for as long as it was
  // registered. The API returns editions in request order, so a
  // by-position identifier check catches any substitution regardless of
  // which edition ID goes bad next; a filter like "isn't quran-uthmani"
  // would not (a substituted edition still isn't quran-uthmani). Returns
  // the same array with a non-enumerable `_mismatchOf` marker set on any
  // entry whose identifier doesn't match what was requested, so existing
  // consumers that don't check for it keep working unchanged.
  function qdMarkEditionMismatches(data, requestedIds) {
    return data.map((entry, i) => {
      const requested = requestedIds[i];
      if (requested && entry.edition && entry.edition.identifier !== requested) {
        console.warn(
          `qdFetchVerse/qdFetchSurah: requested edition "${requested}" but the API returned "${entry.edition.identifier}" — this edition ID may no longer exist on alquran.cloud. Rendering a placeholder instead of the substituted text.`,
        );
        return Object.assign({}, entry, { _mismatchOf: requested });
      }
      return entry;
    });
  }

  // async (not a plain function returning apiCachedFetch's promise): a
  // plain function would let a synchronous throw building the URL (e.g.
  // state.translations corrupted into something non-iterable) escape as
  // an uncaught exception instead of a rejection — callers like
  // embed.js's bare `.then().catch(fail)` rely on rejection semantics.
  // The "Transliteration" display setting appends alquran.cloud's
  // en.transliteration edition to the fetch, rendered like any other
  // translation block. Kept out of state.translations so toggling it
  // never edits the reader's saved translation choices.
  function editionList() {
    const editions = ["quran-uthmani", ...state.translations];
    if (
      state.features &&
      state.features.showTransliteration &&
      !editions.includes("en.transliteration")
    ) {
      editions.push("en.transliteration");
    }
    return editions;
  }

  window.qdFetchVerse = async function (surah, ayah) {
    const editions = editionList();
    const data = await apiCachedFetch(
      `https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/editions/${editions.join(",")}`,
    );
    return qdMarkEditionMismatches(data, editions);
  };

  window.qdFetchSurah = async function (surah) {
    const editions = editionList();
    const data = await apiCachedFetch(
      `https://api.alquran.cloud/v1/surah/${surah}/editions/${editions.join(",")}`,
    );
    return qdMarkEditionMismatches(data, editions);
  };

  const TOOLTIPS = {
    "depth-simple":
      "Shows verse text, word-by-word meanings, translations, and audio. No morphology tables or annotations.",
    "depth-study":
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
        // notebook.js (read/roots) pins its toggle to the same corner;
        // shift this button up so the two never overlap. Checked at
        // reveal time, not init, because notebook.js may run later.
        btn.classList.toggle(
          "back-to-top--offset",
          !!document.querySelector(".notebook-toggle"),
        );
        btn.hidden = window.scrollY < 600;
      },
      { passive: true },
    );
  }

  // Focus mode (read.html): hides everything but the passage being read.
  // In-memory only — no localStorage, no cross-page persistence — so a
  // reload or navigating away always starts from the normal view. A
  // no-op on every page without the button (i.e. every page but
  // read.html), since it's gated entirely on the button's presence.
  function initFocusMode() {
    const btn = document.getElementById("focusToggleBtn");
    if (!btn) return;
    function setFocus(on) {
      document.documentElement.toggleAttribute("data-focus", on);
      btn.setAttribute("aria-pressed", String(on));
    }
    btn.addEventListener("click", () => {
      setFocus(!document.documentElement.hasAttribute("data-focus"));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.documentElement.hasAttribute("data-focus")) {
        setFocus(false);
        return;
      }
      if (
        (e.key === "f" || e.key === "F") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.target.matches("input,select,textarea") &&
        !document.querySelector('[aria-modal="true"]')
      ) {
        setFocus(!document.documentElement.hasAttribute("data-focus"));
      }
    });
  }

  // Corpus figures quoted in page prose bind to data/numbers.json via
  // data-num="dot.path" so they can never drift from the generated
  // data. The static text is the fallback; this overwrites it with the
  // authoritative value. Fetches only on pages that use it.
  function initDataNums() {
    const els = document.querySelectorAll("[data-num]");
    if (!els.length) return;
    fetch("data/numbers.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        els.forEach(function (el) {
          let v = data;
          const parts = el.getAttribute("data-num").split(".");
          for (let i = 0; i < parts.length && v != null; i++) v = v[parts[i]];
          if (typeof v === "number") {
            el.textContent = Number.isInteger(v)
              ? v.toLocaleString("en-US")
              : v.toFixed(1);
          }
        });
      })
      .catch(() => {});
  }

  document.addEventListener("DOMContentLoaded", () => {
    load();
    applyTheme();
    buildPanel();
    initSettings();
    initTooltips();
    initInlineDepth();
    initBackToTop();
    initDataNums();
    initFocusMode();
    enhanceTrustLinks();
    applyDepth();
  });

  // Offline shell + bundled-data caching. Feature-detected; a browser
  // without SW support (or one that fails to register, e.g. private
  // browsing in some browsers) just runs the site exactly as before.
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }

  // Offline indicator: a slim status strip at the top of <main> while
  // the browser reports no connection, so a reader knows they are on
  // the service worker's saved copy rather than a broken site. Created
  // lazily, toggled by the online/offline events; no storage involved.
  function initOfflineIndicator() {
    if (!("onLine" in navigator)) return;
    var strip = null;
    function show() {
      if (!strip) {
        var main = document.querySelector("main");
        if (!main) return;
        strip = document.createElement("div");
        strip.className = "banner note offline-banner";
        strip.setAttribute("role", "status");
        strip.setAttribute("aria-live", "polite");
        strip.textContent =
          "Offline. Showing your saved copy; live text, audio, and forms resume with the connection.";
        main.insertBefore(strip, main.firstChild);
      }
      strip.hidden = false;
    }
    function hide() {
      if (strip) strip.hidden = true;
    }
    window.addEventListener("offline", show);
    window.addEventListener("online", hide);
    if (navigator.onLine === false) show();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initOfflineIndicator);
  } else {
    initOfflineIndicator();
  }
})();
