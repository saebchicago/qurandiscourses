/* Native app bridge. Loaded by nav.js only inside the Capacitor shell
   (window.Capacitor.isNativePlatform()), never on the web site, so the
   site's request count and behavior are unchanged in a browser.

   Three jobs, each independent and each silent on failure:
     1. Durability: mirror reader-authored data and preferences from
        localStorage to a JSON file in the app's Documents folder, and
        restore from it when localStorage comes back empty (reinstall,
        OS storage cleanup). WKWebView storage is not a durable store.
     2. Universal links: a shared divinediscourses.org URL opened in the
        app navigates to that page instead of the home page.
     3. Daily discourse reminder: an opt-in local notification at 07:00
        device time, added as a button to the home page's daily section.
        Plus a light haptic on share.

   Plugins are reached through window.Capacitor.Plugins, which the native
   shell registers for every plugin in ios-app/package.json. Nothing here
   is bundled into the app; the app loads this file from the site. */
(function () {
  "use strict";
  var cap = window.Capacitor;
  if (!cap || typeof cap.isNativePlatform !== "function" || !cap.isNativePlatform()) return;
  var P = cap.Plugins || {};

  // ── 1. Durability ──────────────────────────────────────────────────
  // Reader-authored stores and preferences. Caches (qd_apicache,
  // qd_wbwcache) are deliberately excluded: they refill, and the
  // word-by-word cache has a provider-imposed 7-day cap.
  var KEYS = [
    "qd_notes",
    "qd_discovery_v1",
    "qd_lenses_v1",
    "qd_notebook_v1",
    "qd_state",
    "qd_vocab",
    "qd_saved_v1",
    "qd_listen_voice_v1",
    "qd_listen_mode_v2",
    "dd_analytics_off",
    "dd_daily_reminder",
  ];
  var FILE = "divine-discourses-backup.json";
  var DIR = "DOCUMENTS";
  var lastWritten = null;

  function snapshot() {
    var out = {};
    KEYS.forEach(function (k) {
      var v = null;
      try { v = localStorage.getItem(k); } catch (e) {}
      if (v !== null) out[k] = v;
    });
    return out;
  }

  function backup() {
    if (!P.Filesystem) return;
    var data = JSON.stringify({ v: 1, savedAt: new Date().toISOString(), keys: snapshot() });
    // Skip the write when nothing but the timestamp would change.
    var body = data.replace(/"savedAt":"[^"]*",/, "");
    if (body === lastWritten) return;
    P.Filesystem.writeFile({ path: FILE, data: data, directory: DIR, encoding: "utf8" })
      .then(function () { lastWritten = body; })
      .catch(function () {});
  }

  function restore() {
    if (!P.Filesystem) return;
    var flag = "dd_restored_once";
    try { if (sessionStorage.getItem(flag)) return; } catch (e) {}
    P.Filesystem.readFile({ path: FILE, directory: DIR, encoding: "utf8" })
      .then(function (res) {
        var parsed = JSON.parse(res.data);
        var keys = (parsed && parsed.keys) || {};
        var changed = false;
        Object.keys(keys).forEach(function (k) {
          if (KEYS.indexOf(k) < 0) return;
          var cur = null;
          try { cur = localStorage.getItem(k); } catch (e) {}
          if (cur === null && typeof keys[k] === "string") {
            try { localStorage.setItem(k, keys[k]); changed = true; } catch (e) {}
          }
        });
        if (changed) {
          // Page scripts have already read localStorage; one reload
          // shows the restored work. The flag stops a second reload.
          try { sessionStorage.setItem(flag, "1"); } catch (e) {}
          location.reload();
        }
      })
      .catch(function () { /* no backup yet */ });
  }

  restore();
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") backup();
  });
  window.addEventListener("pagehide", backup);
  setInterval(backup, 45000);
  if (P.App && P.App.addListener) {
    P.App.addListener("appStateChange", function (s) { if (s && s.isActive === false) backup(); });
  }

  // ── 2. Universal links ─────────────────────────────────────────────
  if (P.App && P.App.addListener) {
    P.App.addListener("appUrlOpen", function (ev) {
      try {
        var u = new URL(ev.url);
        if (u.hostname === "divinediscourses.org" || u.hostname === "www.divinediscourses.org") {
          location.href = u.pathname + u.search + u.hash;
        }
      } catch (e) {}
    });
  }

  // ── 3. Daily reminder and haptics ──────────────────────────────────
  var REM_KEY = "dd_daily_reminder";
  var REM_ID = 1001;

  function reminderOn() {
    try { return localStorage.getItem(REM_KEY) === "1"; } catch (e) { return false; }
  }

  function schedule() {
    return P.LocalNotifications.schedule({
      notifications: [{
        id: REM_ID,
        title: "Today's discourse",
        body: "A passage is waiting. Read it as one discourse.",
        schedule: { on: { hour: 7, minute: 0 }, allowWhileIdle: true },
        extra: { url: "/#dailySection" },
      }],
    });
  }

  function setReminder(on, btn) {
    if (!P.LocalNotifications) return;
    if (!on) {
      P.LocalNotifications.cancel({ notifications: [{ id: REM_ID }] }).catch(function () {});
      try { localStorage.setItem(REM_KEY, "0"); } catch (e) {}
      render(btn);
      return;
    }
    P.LocalNotifications.requestPermissions()
      .then(function (r) {
        if (!r || r.display !== "granted") throw new Error("denied");
        return schedule();
      })
      .then(function () {
        try { localStorage.setItem(REM_KEY, "1"); } catch (e) {}
        render(btn);
        backup();
      })
      .catch(function () {
        try { localStorage.setItem(REM_KEY, "0"); } catch (e) {}
        render(btn);
      });
  }

  function render(btn) {
    var on = reminderOn();
    btn.textContent = on ? "Daily reminder: on (7:00)" : "Remind me daily at 7:00";
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function mountReminder() {
    var section = document.getElementById("dailySection");
    if (!section || !P.LocalNotifications || document.getElementById("ddReminderBtn")) return;
    var p = document.createElement("p");
    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "ddReminderBtn";
    btn.className = "button secondary";
    render(btn);
    btn.addEventListener("click", function () { setReminder(!reminderOn(), btn); });
    p.appendChild(btn);
    section.appendChild(p);
    // Keep the schedule alive across reinstalls that restored the flag.
    if (reminderOn()) schedule().catch(function () {});
  }

  if (P.LocalNotifications && P.LocalNotifications.addListener) {
    P.LocalNotifications.addListener("localNotificationActionPerformed", function (ev) {
      var url = ev && ev.notification && ev.notification.extra && ev.notification.extra.url;
      if (url) location.href = url;
    });
  }

  document.addEventListener("click", function (e) {
    if (!P.Haptics) return;
    var t = e.target && e.target.closest && e.target.closest("[data-share], #ddReminderBtn");
    if (t) P.Haptics.impact({ style: "LIGHT" }).catch(function () {});
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountReminder);
  } else {
    mountReminder();
  }
})();
