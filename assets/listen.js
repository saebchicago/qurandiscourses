// listen.js — the Read page's Listen panel: a UI over assets/audio-engine.js.
//
// The engine owns playback (clip URLs, ar/en sequencing, preload, Media
// Session, the single-<audio> iOS rule). This file owns the panel: the
// transport buttons, the verse highlight and auto-scroll, the keyboard
// shortcuts, and the notes about where the audio comes from.
//
// It builds for ANY passage on /read — a single verse, a verse range, a
// whole surah, a whole juz — because the reader's unit of listening is
// whatever they asked to read, not one division of the mushaf. It reads
// the rendered verses straight out of the DOM, so it needs no knowledge
// of which kind of passage produced them.
(function () {
  "use strict";

  var player = null;
  var carry = null;
  var MODE_KEY = "qd_listen_mode_v2";

  function storedMode() {
    try {
      var mode = localStorage.getItem(MODE_KEY);
      return mode === "en" || mode === "ar-en" ? mode : "ar";
    } catch (e) {
      return "ar";
    }
  }

  function saveMode(mode) {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch (e) {}
  }

  function signature(items) {
    return items.length
      ? items[0].arNumber + "-" + items[items.length - 1].arNumber
      : "";
  }

  function reducedMotion() {
    try {
      return (
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch (e) {
      return false;
    }
  }

  function modeLabel(mode) {
    if (mode === "en") return "English";
    if (mode === "ar-en") return "Arabic + English";
    return "Arabic";
  }

  function surahNameFor(n) {
    var rec = (window.SURAHS || []).filter(function (x) {
      return x.id === n;
    })[0];
    return (rec && rec.translit) || "";
  }

  function collect() {
    var nodes = document.querySelectorAll("#verseContainer .verse[data-ar-number]");
    return Array.prototype.map
      .call(nodes, function (el) {
        var surah = parseInt(el.getAttribute("data-surah"), 10);
        return {
          el: el,
          arNumber: parseInt(el.getAttribute("data-ar-number"), 10),
          surah: surah,
          ayah: parseInt(el.getAttribute("data-ayah"), 10),
          surahName: surahNameFor(surah),
        };
      })
      .filter(function (it) {
        return isFinite(it.arNumber) && it.arNumber > 0;
      });
  }

  function passageTitle(items, juz) {
    if (juz) return "juz " + juz;
    if (!items.length) return "this passage";
    var first = items[0];
    var last = items[items.length - 1];
    if (items.length === 1)
      return first.surahName + " " + first.surah + ":" + first.ayah;
    if (first.surah !== last.surah)
      return (
        first.surahName + " " + first.surah + ":" + first.ayah +
        " to " + last.surahName + " " + last.surah + ":" + last.ayah
      );
    var meta = (window.SURAHS || []).filter(function (x) {
      return x.id === first.surah;
    })[0];
    if (meta && first.ayah === 1 && last.ayah === meta.verseCount)
      return first.surahName + ", all " + meta.verseCount + " verses";
    return first.surahName + " " + first.surah + ":" + first.ayah + "-" + last.ayah;
  }

  function Panel(host, items, juz) {
    this.host = host;
    this.items = items;
    this.juz = juz;
    this.title = passageTitle(items, juz);
    this.support = null;
    this._resumeEnglish = false;
    this._storedEnglish = false;
    this._error = "";
    var self = this;
    this.engine = window.qdAudioEngine.create({
      album: (juz ? "Juz " + juz : this.title) + " · Divine Discourses",
      labelFor: function (item) {
        return (
          (item.surahName ? item.surahName + " " : "") +
          item.surah + ":" + item.ayah
        );
      },
      onState: function (st) {
        self.render(st);
        self.highlight(st);
      },
      onEnglishResolved: function (english) {
        if (english) return;
        // The probe has finished and found nothing. Say so: the note
        // that ships with the panel promises the choices will appear,
        // which is only true while the probe is still running.
        self.showEnglishUnavailable();
      },
      onEnglish: function () {
        self.addEnglishControl();
        self.showEnglishStatus();
        if (self._storedEnglish && !self.engine.armed) {
          self._storedEnglish = false;
          self.engine.setMode("en");
        }
        if (self._resumeEnglish) {
          self._resumeEnglish = false;
          self.engine.leg = "en";
          self.engine.playCurrent();
        }
      },
    });
    this._onAudioError = function () {
      self._error = "Audio could not load. Check your connection or choose another Arabic reciter.";
      self.render(self.engine.state());
    };
    this._onAudioPlaying = function () {
      if (!self._error) return;
      self._error = "";
      self.render(self.engine.state());
    };
    this.engine.audio.addEventListener("error", this._onAudioError);
    this.engine.audio.addEventListener("playing", this._onAudioPlaying);
    this.engine.setItems(items);
  }

  Panel.prototype.el = function (name) {
    return this.host.querySelector("[data-listen-" + name + "]");
  };

  Panel.prototype.reciterName = function () {
    var id = this.engine.reciterId();
    var rec = (window.qdReciters || []).filter(function (r) {
      return r.id === id;
    })[0];
    return (rec && rec.name) || "Choose reciter";
  };

  Panel.prototype.render = function (st) {
    if (!this.el("play")) return;
    var item = st.item;
    this.el("now").textContent = item
      ? (item.surahName ? item.surahName + " " : "") +
        item.surah + ":" + item.ayah +
        (st.leg === "en" && st.armed ? " · English" : "")
      : "—";
    this.el("pos").textContent = st.total
      ? "Verse " + (st.idx + 1) + " of " + st.total
      : "No verses to play";
    var play = this.el("play");
    play.textContent = st.playing ? "⏸ Pause" : "▶ Play";
    play.setAttribute("aria-label", st.playing ? "Pause" : "Play");
    this.el("repeat").setAttribute("aria-pressed", String(st.repeat));
    var speed = this.el("speed");
    speed.textContent = st.rate + "×";
    speed.setAttribute("aria-label", "Playback speed " + st.rate + "×");
    var mode = this.el("mode");
    if (mode) mode.value = st.mode;
    var reciter = this.el("reciter");
    if (reciter) {
      reciter.textContent = "🎤 " + this.reciterName();
      reciter.disabled = st.mode === "en";
      reciter.title = st.mode === "en" ? "Arabic reciter applies to Arabic audio modes" : "Change Arabic reciter";
    }
    var status = this.el("status");
    if (status) {
      status.textContent = this._error;
      status.hidden = !this._error;
    }
  };

  Panel.prototype.refreshLayout = function () {
    var nav = document.querySelector("nav.primary");
    var navHeight = nav && nav.getClientRects().length
      ? Math.ceil(nav.getBoundingClientRect().height)
      : 0;
    document.documentElement.style.setProperty("--qd-listen-nav-offset", navHeight + "px");
    var panelHeight = Math.ceil(this.host.getBoundingClientRect().height);
    document.documentElement.style.setProperty(
      "--qd-listen-scroll-offset",
      navHeight + panelHeight + 12 + "px",
    );
  };

  Panel.prototype.highlight = function (st) {
    var items = this.items;
    for (var i = 0; i < items.length; i++) {
      var on = i === st.idx && st.armed;
      items[i].el.classList.toggle("is-listening", on);
      items[i].el.classList.toggle("is-listening-en", on && st.leg === "en");
      if (on) items[i].el.setAttribute("aria-current", "true");
      else items[i].el.removeAttribute("aria-current");
    }
    var cur = items[st.idx];
    var key = st.idx + ":" + st.leg;
    if (cur && st.armed && key !== this._scrolledTo) {
      this._scrolledTo = key;
      this.refreshLayout();
      var nav = document.querySelector("nav.primary");
      var navHeight = nav && nav.getClientRects().length
        ? nav.getBoundingClientRect().height
        : 0;
      var inset = navHeight + this.host.getBoundingClientRect().height + 12;
      var rect = cur.el.getBoundingClientRect();
      if (rect.top < inset || rect.bottom > window.innerHeight - 12) {
        window.scrollTo({
          top: Math.max(0, window.scrollY + rect.top - inset),
          behavior: reducedMotion() ? "auto" : "smooth",
        });
      }
    }
  };

  Panel.prototype.addEnglishControl = function () {
    var row = this.host.querySelector(".listen-options");
    if (!row || row.querySelector("[data-listen-mode]")) return;
    var self = this;
    var label = document.createElement("label");
    label.className = "listen-mode-label";
    label.textContent = "Audio ";
    var select = document.createElement("select");
    select.className = "listen-mode-select";
    select.setAttribute("data-listen-mode", "");
    select.setAttribute("aria-label", "Audio language");
    select.innerHTML =
      '<option value="ar">Arabic</option>' +
      '<option value="en">English</option>' +
      '<option value="ar-en">Arabic + English</option>';
    select.addEventListener("change", function () {
      self.engine.setMode(select.value);
      saveMode(self.engine.mode);
    });
    label.appendChild(select);
    row.appendChild(label);
    this.render(this.engine.state());
    this.refreshLayout();
  };

  Panel.prototype.showEnglishStatus = function () {
    var note = this.support && this.support.querySelector("[data-listen-english-status]");
    if (!note) return;
    note.innerHTML =
      "English audio is the fixed verse-by-verse edition alquran.cloud names " +
      "<code>en.walk</code> · Ibrahim Walk. It may differ from the written translation you selected. " +
      "The recording's rights holder and license are not established by the registry or CDN; " +
      '<a href="/sources#english-audio-source">source details</a> ' +
      '<span class="badge pending" data-source-ids="islamic-network-audio-en" aria-label="Pending" tabindex="0" title="Pending · recording rights unresolved">○</span>.';
    if (window.qdCiteEnhance) window.qdCiteEnhance(this.support);
  };

  Panel.prototype.showEnglishUnavailable = function () {
    var note = this.support && this.support.querySelector("[data-listen-english-status]");
    if (!note) return;
    var wanted = storedMode();
    note.textContent =
      "English audio is unavailable right now, so only the Arabic " +
      "recitation will play." +
      (wanted === "ar"
        ? ""
        : wanted === "en"
          ? " You last chose English audio; this sitting plays Arabic instead."
          : " You last chose Arabic and English; this sitting plays the Arabic legs only.") +
      " The written translations on this page are unaffected.";
  };

  // Temporary test seam retained until the existing browser audit is moved
  // from the old binary-toggle method name to the explicit three-choice control.
  Panel.prototype.addEnglishToggle = function () {
    this.addEnglishControl();
    var mode = this.el("mode");
    if (mode) mode.setAttribute("aria-pressed", String(this.engine.mode === "ar-en"));
  };

  Panel.prototype.markup = function () {
    return (
      '<div class="listen-head">' +
      '<h3 class="listen-title">Listen to ' +
      window.qdEsc(this.title) +
      "</h3>" +
      '<p class="listen-now" data-listen-now>—</p>' +
      '<p class="listen-pos t-annotation" data-listen-pos></p>' +
      "</div>" +
      '<div class="listen-options">' +
      '<button type="button" class="button secondary listen-reciter-btn" data-listen-reciter aria-label="Change Arabic reciter">🎤 Choose reciter</button>' +
      // Reflect is not transport. In the transport row it was the only
      // control that wrapped, so it took a full 319px line of its own on
      // a phone while Play had 72px -- a note-taking button reading as
      // the panel's primary action, inside a group labelled "Recitation
      // transport" for a screen reader.
      '<button type="button" class="button secondary listen-btn listen-reflect-btn" data-listen-reflect>✎ Reflect on this verse</button>' +
      "</div>" +
      '<div class="listen-controls" role="group" aria-label="Recitation transport">' +
      '<button type="button" class="button secondary listen-btn" data-listen-prev aria-label="Previous verse">‹</button>' +
      '<button type="button" class="button btn-primary listen-btn" data-listen-play aria-label="Play">▶ Play</button>' +
      '<button type="button" class="button secondary listen-btn" data-listen-next aria-label="Next verse">›</button>' +
      '<button type="button" class="button secondary listen-btn" data-listen-repeat aria-pressed="false" aria-label="Repeat this verse">↻ Repeat</button>' +
      '<button type="button" class="button secondary listen-btn" data-listen-speed aria-label="Playback speed">1×</button>' +
      "</div>" +
      '<p class="listen-status" data-listen-status role="status" aria-live="polite" hidden></p>'
    );
  };

  Panel.prototype.mountSupport = function () {
    var old = document.querySelector(".listen-support[data-listen-support]");
    if (old) old.remove();
    var box = document.createElement("div");
    box.className = "listen-support";
    box.setAttribute("data-listen-support", "");
    box.innerHTML =
      '<details class="method-note"><summary>Audio details and shortcuts</summary>' +
      '<p class="caption-note listen-keys">Keys <kbd>Space</kbd> play/pause, ' +
      '<kbd>[</kbd> <kbd>]</kbd> previous/next verse, <kbd>R</kbd> repeat.</p>' +
      '<p class="caption-note">Recitation streams per verse from cdn.islamic.network, which receives normal connection data. Your listening preferences remain in this browser. <a href="/about#privacy">Privacy and offline details</a>.</p>' +
      '<p class="caption-note listen-en-note" data-listen-english-status role="status" aria-live="polite">English audio choices appear after the page confirms the fixed English recording is available.</p>' +
      "</details>";
    this.host.insertAdjacentElement("afterend", box);
    this.support = box;
  };

  Panel.prototype.wire = function () {
    var self = this;
    this.el("play").addEventListener("click", function () {
      self.engine.toggle();
    });
    this.el("prev").addEventListener("click", function () {
      self.engine.go(-1);
    });
    this.el("next").addEventListener("click", function () {
      self.engine.go(1);
    });
    this.el("repeat").addEventListener("click", function () {
      self.engine.setRepeat(!self.engine.repeat);
    });
    this.el("speed").addEventListener("click", function () {
      self.engine.cycleSpeed();
    });
    this.el("reciter").addEventListener("click", function () {
      var existing = document.querySelector("#verseContainer .reciter-open-btn");
      if (existing) existing.click();
    });
    this.el("reflect").addEventListener("click", function () {
      if (self.engine.playing) self.engine.toggle();
      var item = self.engine.current();
      if (!item) return;
      document.dispatchEvent(
        new CustomEvent("qd:note-verse", {
          detail: { s: item.surah, a: item.ayah, focus: true },
        }),
      );
    });

    this._onKey = function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target && e.target.matches && e.target.matches("input,select,textarea"))
        return;
      if (document.querySelector('[aria-modal="true"]')) return;
      if (window.qdListenPanel !== self) return;
      if (e.key === " " || e.key === "Spacebar") {
        if (!self.engine.armed) return;
        e.preventDefault();
        self.engine.toggle();
      } else if (e.key === "[") {
        e.preventDefault();
        self.engine.go(-1);
      } else if (e.key === "]") {
        e.preventDefault();
        self.engine.go(1);
      } else if (e.key === "r" || e.key === "R") {
        if (!self.engine.armed) return;
        e.preventDefault();
        self.engine.setRepeat(!self.engine.repeat);
      }
    };
    document.addEventListener("keydown", this._onKey);
  };

  Panel.prototype.wireVerseButtons = function () {
    var self = this;
    this.items.forEach(function (item, i) {
      var btn = item.el.querySelector("[data-listen-from]");
      if (!btn) return;
      btn.addEventListener("click", function () {
        self.engine.seek(i);
        if (!self.engine.playing) self.engine.toggle();
      });
    });
  };

  Panel.prototype.snapshot = function () {
    var e = this.engine;
    return {
      sig: signature(this.items),
      idx: e.idx,
      leg: e.leg,
      mode: e.mode,
      rate: e.rate,
      repeat: e.repeat,
      armed: e.armed,
      playing: e.playing,
    };
  };

  Panel.prototype.restore = function (snap) {
    if (!snap || snap.sig !== signature(this.items)) return false;
    var e = this.engine;
    e.idx = Math.min(snap.idx, this.items.length - 1);
    e.mode = snap.mode;
    e.leg = snap.leg || (snap.mode === "en" ? "en" : "ar");
    e.rate = snap.rate;
    e.repeat = snap.repeat;
    e.armed = snap.armed;
    e.audio.playbackRate = e.rate;
    e.emit();
    if (snap.playing) {
      if (snap.mode === "en" && !e.english) this._resumeEnglish = true;
      else e.playCurrent();
    }
    return true;
  };

  Panel.prototype.applyStoredMode = function () {
    var mode = storedMode();
    if (mode === "en" && !this.engine.english) {
      this._storedEnglish = true;
      return;
    }
    this.engine.setMode(mode);
  };

  // Scroll the transport into view and put the keyboard on Play. Used
  // by the #listen deep link and by the Listen button in the entry card:
  // on a phone the panel sits about 1,200px down the page, below the
  // entry form, so a reader who has not scrolled has no way of knowing
  // the passage can be heard at all.
  Panel.prototype.jumpTo = function () {
    try {
      this.host.scrollIntoView({
        block: "start",
        behavior: reducedMotion() ? "auto" : "smooth",
      });
      var play = this.el("play");
      if (play) play.focus({ preventScroll: true });
    } catch (e) {}
  };

  Panel.prototype.destroy = function () {
    if (this._onKey) document.removeEventListener("keydown", this._onKey);
    this._onKey = null;
    this.engine.audio.removeEventListener("error", this._onAudioError);
    this.engine.audio.removeEventListener("playing", this._onAudioPlaying);
    this._onAudioError = null;
    this._onAudioPlaying = null;
    this.engine.destroy();
    if (this.support) this.support.remove();
    this.support = null;
    this.items.forEach(function (it) {
      it.el.classList.remove("is-listening", "is-listening-en");
      it.el.removeAttribute("aria-current");
    });
  };

  // The entry card's Listen button. It exists in read.html's markup and
  // stays hidden until a panel is actually mounted, so it never promises
  // audio that is switched off in settings or has no verses to play.
  function showJump(panel) {
    var jump = document.getElementById("listenJump");
    if (!jump) return;
    jump.hidden = false;
    if (!jump._qdWired) {
      jump._qdWired = true;
      jump.addEventListener("click", function () {
        if (window.qdListenPanel) window.qdListenPanel.jumpTo();
      });
    }
  }

  function hideJump() {
    var jump = document.getElementById("listenJump");
    if (jump) jump.hidden = true;
  }

  window.qdListenTeardown = function () {
    var host = document.getElementById("listenPanel");
    if (player) {
      carry = player.snapshot();
      player.destroy();
      player = null;
    }
    window.qdListenPanel = null;
    window.qdListenPlayer = null;
    hideJump();
    if (host) {
      host.innerHTML = "";
      host.hidden = true;
    }
  };

  window.qdListenSync = function (juz) {
    var host = document.getElementById("listenPanel");
    if (!host) return;
    var audioOn = !(
      window.qdState &&
      window.qdState.features &&
      window.qdState.features.showAudio === false
    );
    var items = audioOn ? collect() : [];
    if (!items.length) {
      window.qdListenTeardown();
      carry = null;
      return;
    }
    if (player) {
      carry = player.snapshot();
      player.destroy();
    }
    host.hidden = false;
    player = new Panel(host, items, juz || null);
    host.innerHTML = player.markup();
    player.mountSupport();
    player.wire();
    player.wireVerseButtons();
    player.render(player.engine.state());
    window.qdListenPanel = player;
    window.qdListenPlayer = player.engine;
    if (window.qdCiteEnhance) window.qdCiteEnhance(host);
    var restored = player.restore(carry);
    carry = null;
    if (!restored) player.applyStoredMode();
    player.refreshLayout();
    showJump(player);
    if (location.hash === "#listen" && !window.__qdListenLanded) {
      window.__qdListenLanded = true;
      player.jumpTo();
    }
  };
})();
