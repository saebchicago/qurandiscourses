/* About page, Privacy and data: the Analytics On / Off control.
   Off stores dd_analytics_off = "1" in this browser (read by
   assets/ah-init.js on every page, which then adds nothing). On clears it.
   Nothing is sent when you change the setting. A change takes effect on the
   next page load; a page already open has finished loading its counter. */
(function () {
  "use strict";
  var btn = document.getElementById("analyticsToggle");
  if (!btn) return;
  var state = document.getElementById("analyticsState");

  function isOff() {
    try {
      return localStorage.getItem("dd_analytics_off") === "1";
    } catch (e) {
      return false;
    }
  }
  function gpc() {
    return navigator.globalPrivacyControl === true;
  }
  function render() {
    var off = isOff() || gpc();
    if (state) {
      state.textContent = gpc() ? "Off (your browser sends Global Privacy Control)" : off ? "Off" : "On";
    }
    btn.textContent = off ? "Turn analytics on" : "Turn analytics off";
    btn.setAttribute("aria-pressed", String(!off));
    btn.disabled = gpc();
  }
  btn.addEventListener("click", function () {
    var off = isOff();
    try {
      if (off) localStorage.removeItem("dd_analytics_off");
      else localStorage.setItem("dd_analytics_off", "1");
    } catch (e) {}
    render();
  });
  render();
})();
