/**
 * notebook.js — client-only pin tray: bookmark a verse or root for quick
 * return, no theming beyond a label. Everything lives in localStorage on
 * this device; nothing is sent anywhere.
 *
 * This is deliberately NOT a notes/journal feature — assets/notes.js
 * already owns per-verse free-text notes (with export/delete) on the Read
 * page. This tray only remembers *which* verses/roots the reader wants to
 * come back to, and extends that to roots (which notes.js does not cover).
 *
 * Usage: include <script src="assets/notebook.js"></script> on any page.
 * Any element with data-notebook-type + data-notebook-ref (+ optional
 * data-notebook-label) becomes a "Pin" control. The component is
 * self-initializing and mounts its own floating toggle + panel.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "qd_notebook_v1";
  var pins = [];
  var panelEl = null;
  var toggleEl = null;

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      pins = Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      pins = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
    } catch (e) {
      // Private-browsing mode or quota exceeded: pins still work for this
      // page view, they just won't persist across reloads.
    }
  }

  function makeId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "p" + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  function add(pin) {
    // Re-pinning something already pinned just re-opens the tray instead
    // of creating a duplicate entry.
    var exists = pins.some(function (p) {
      return p.type === pin.type && p.ref === pin.ref;
    });
    if (!exists) {
      pins.push({
        id: makeId(),
        type: pin.type,
        ref: pin.ref,
        label: pin.label || pin.ref,
        ts: Date.now(),
      });
      save();
    }
    openPanel();
  }

  function remove(id) {
    pins = pins.filter(function (p) {
      return p.id !== id;
    });
    save();
    renderPanel();
  }

  function clearAll() {
    pins = [];
    save();
    renderPanel();
  }

  function hrefFor(pin) {
    if (pin.type === "verse") {
      var parts = String(pin.ref).split(":");
      return "read.html?s=" + encodeURIComponent(parts[0]) + "&a=" + encodeURIComponent(parts[1]);
    }
    if (pin.type === "root") {
      return "roots.html?root=" + encodeURIComponent(pin.ref);
    }
    return "#";
  }

  function ensureUI() {
    if (panelEl) return;

    toggleEl = document.createElement("button");
    toggleEl.type = "button";
    toggleEl.className = "notebook-toggle";
    toggleEl.id = "notebookToggle";
    toggleEl.title = "Your pinned verses & roots";
    toggleEl.setAttribute("aria-label", "Open your pinned verses and roots");
    toggleEl.setAttribute("aria-controls", "notebookPanel");
    toggleEl.setAttribute("aria-expanded", "false");
    toggleEl.textContent = "📌";
    var badge = document.createElement("span");
    badge.className = "notebook-count";
    badge.id = "notebookCount";
    toggleEl.appendChild(badge);

    panelEl = document.createElement("div");
    panelEl.className = "notebook-panel";
    panelEl.id = "notebookPanel";
    panelEl.setAttribute("role", "dialog");
    panelEl.setAttribute("aria-label", "Your pinned verses and roots");
    panelEl.hidden = true;

    document.body.appendChild(toggleEl);
    document.body.appendChild(panelEl);

    toggleEl.addEventListener("click", function () {
      if (panelEl.hidden) openPanel();
      else closePanel();
    });
    document.addEventListener("click", function (e) {
      if (panelEl.hidden) return;
      if (panelEl.contains(e.target) || toggleEl.contains(e.target)) return;
      closePanel();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panelEl.hidden) closePanel();
    });

    updateCount();
  }

  function updateCount() {
    var el = document.getElementById("notebookCount");
    if (el) el.textContent = pins.length ? String(pins.length) : "";
  }

  function openPanel() {
    ensureUI();
    panelEl.hidden = false;
    toggleEl.setAttribute("aria-expanded", "true");
    renderPanel();
  }

  function closePanel() {
    if (!panelEl) return;
    panelEl.hidden = true;
    if (toggleEl) toggleEl.setAttribute("aria-expanded", "false");
  }

  function renderPanel() {
    if (!panelEl) return;
    updateCount();
    panelEl.innerHTML = "";

    var header = document.createElement("div");
    header.className = "notebook-header";
    var h = document.createElement("h4");
    h.textContent = "Your pins";
    header.appendChild(h);
    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "notebook-close";
    closeBtn.textContent = "×";
    closeBtn.setAttribute("aria-label", "Close pinned list");
    closeBtn.addEventListener("click", closePanel);
    header.appendChild(closeBtn);
    panelEl.appendChild(header);

    var note = document.createElement("p");
    note.className = "notebook-note";
    note.textContent =
      "Zero tracking: pins stay only in this browser's local storage, never sent anywhere. For writing notes on a verse, see the notes panel on the Read page.";
    panelEl.appendChild(note);

    if (pins.length === 0) {
      var empty = document.createElement("p");
      empty.className = "notebook-empty";
      empty.textContent =
        "Nothing pinned yet. Look for a 📌 Pin button next to a verse or a root.";
      panelEl.appendChild(empty);
      return;
    }

    var list = document.createElement("div");
    list.className = "notebook-list";
    pins
      .slice()
      .reverse()
      .forEach(function (p) {
        list.appendChild(renderPinItem(p));
      });
    panelEl.appendChild(list);

    var actions = document.createElement("div");
    actions.className = "notebook-actions";
    var clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "button secondary";
    clearBtn.textContent = "Clear all";
    clearBtn.addEventListener("click", function () {
      if (window.confirm("Remove all pinned items? This cannot be undone.")) {
        clearAll();
      }
    });
    actions.appendChild(clearBtn);
    panelEl.appendChild(actions);
  }

  function renderPinItem(p) {
    var item = document.createElement("div");
    item.className = "notebook-item";

    var top = document.createElement("div");
    top.className = "notebook-item-top";
    var link = document.createElement("a");
    link.href = hrefFor(p);
    link.textContent = p.label;
    top.appendChild(link);
    var del = document.createElement("button");
    del.type = "button";
    del.className = "notebook-remove";
    del.textContent = "×";
    del.setAttribute("aria-label", "Unpin " + p.label);
    del.addEventListener("click", function () {
      remove(p.id);
    });
    top.appendChild(del);
    item.appendChild(top);

    return item;
  }

  // Wires up any [data-notebook-type][data-notebook-ref] element in root
  // (or the whole document) as a Pin control — mirrors cite-badge.js's
  // qdCiteEnhance pattern for content inserted after page load.
  function enhance(root) {
    (root || document)
      .querySelectorAll("[data-notebook-type][data-notebook-ref]")
      .forEach(function (btn) {
        if (btn.dataset.notebookBound) return;
        btn.dataset.notebookBound = "1";
        btn.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          add({
            type: btn.dataset.notebookType,
            ref: btn.dataset.notebookRef,
            label: btn.dataset.notebookLabel || btn.dataset.notebookRef,
          });
        });
      });
  }

  window.qdNotebook = {
    add: add,
    remove: remove,
    list: function () {
      return pins.slice();
    },
    enhance: enhance,
  };

  function init() {
    load();
    ensureUI();
    enhance(document);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
