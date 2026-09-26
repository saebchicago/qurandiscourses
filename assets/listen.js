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

  // Which language the translation leg speaks. Any edition the engine
  // registers; English (Ibrahim Walk) otherwise.
  var VOICE_KEY = "qd_listen_voice_v1";
  function voices() {
    return (window.qdAudioEngine && window.qdAudioEngine.translations) || [];
  }
  function voiceById(id) {
    return window.qdAudioEngine && window.qdAudioEngine.translationById
      ? window.qdAudioEngine.translationById(id)
      : null;
  }
  function storedVoice() {
    try {
      var v = localStorage.getItem(VOICE_KEY);
      return voiceById(v) ? v : "en.walk";
    } catch (e) {
      return "en.walk";
    }
  }
  function saveVoice(id) {
    try {
      localStorage.setItem(VOICE_KEY, id);
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
    this._voiceChosen = false;
    this.engine = window.qdAudioEngine.create({
      translation: storedVoice(),
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
        self.removeModeControl();
        self.showEnglishUnavailable();
      },
      onEnglish: function () {
        self.addEnglishControl();
        self.showEnglishStatus();
        // A reader who picks a voice while listening to Arabic alone
        // wants to hear it: Arabic, then that language, verse by verse.
        if (self._voiceChosen && self.engine.mode === "ar") {
          self._voiceChosen = false;
          self.engine.setMode("ar-en");
          saveMode("ar-en");
        }
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
        (st.leg === "en" && st.armed ? " · " + this.voiceLanguage() : "")
      : "—";
    this.el("pos").textContent = st.total
      ? "Verse " + (st.idx + 1) + " of " + st.total
      : "No verses to play";
    var play = this.el("play");
    play.textContent = st.playing ? "⏸" : "▶";
    play.setAttribute("aria-label", st.playing ? "Pause" : "Play");
    var bar = this.el("progress");
    if (bar) bar.style.width = st.total ? ((st.idx + 1) / st.total) * 100 + "%" : "0";
    var repeat = this.el("repeat");
    var rmode = st.repeat ? "verse" : st.loop ? "passage" : "off";
    repeat.textContent =
      rmode === "verse" ? "↻ Repeat verse" : rmode === "passage" ? "↻ Repeat passage" : "↻ Repeat off";
    repeat.setAttribute("aria-pressed", String(rmode !== "off"));
    repeat.setAttribute(
      "aria-label",
      "Repeat: " + rmode + ". Press to change to " +
        (rmode === "off" ? "verse" : rmode === "verse" ? "passage" : "off"),
    );
    this.paintSleep();
    var speed = this.el("speed");
    speed.textContent = st.rate + "×";
    speed.setAttribute("aria-label", "Playback speed " + st.rate + "×");
    var mode = this.el("mode");
    if (mode) mode.value = st.mode;
    var sheetEl = this.el("sheet");
    var timeKey = this.engine.reciterId() + "|" + st.mode;
    if (sheetEl && !sheetEl.hidden && timeKey !== this._timeKey) {
      this._timeKey = timeKey;
      this.paintTime();
    }
    var reciter = this.el("reciter");
    if (reciter) {
      reciter.textContent = "🎤 " + this.reciterName();
      reciter.disabled = st.mode === "en";
      reciter.title = st.mode === "en" ? "Arabic reciter applies to Arabic audio modes" : "Change Arabic reciter";
    }
    var status = this.el("status");
    if (status) {
      var was = status.hidden;
      status.textContent = this._error;
      status.hidden = !this._error;
      // The status line changes the bar's height; the page's reserved
      // foot and the floating corner buttons follow it.
      if (was !== status.hidden) this.refreshLayout();
    }
  };

  // The transport is a bar fixed to the BOTTOM of the viewport, the
  // shape every listening app has converged on. It used to be a 207px
  // card pinned to the top under a 110px sticky nav: 39% of a phone
  // screen, leaving a 445px band in which a verse card (900px+) could
  // never fit, so the translation being recited was always off-screen.
  // The page reserves the bar's height at its foot so the last verse
  // is never underneath it.
  // Everything the panel keeps on screen except the sheet, which opens
  // OVER the page rather than pushing it: progress line, bar, and any
  // status line beneath the bar.
  Panel.prototype.barHeight = function () {
    var h = this.host.getBoundingClientRect().height;
    var sheet = this.el("sheet");
    if (sheet && !sheet.hidden) h -= sheet.getBoundingClientRect().height;
    return Math.max(0, Math.ceil(h));
  };

  // Height of whatever is stuck to the top while reading: the passage's
  // context bar, plus the site nav where it is still sticky.
  function topInset() {
    var inset = 0;
    var nav = document.querySelector("nav.primary");
    if (nav && nav.getClientRects().length && getComputedStyle(nav).position === "sticky")
      inset += nav.getBoundingClientRect().height;
    var ctx = document.querySelector(".read-context");
    if (ctx && !ctx.hidden && ctx.getClientRects().length)
      inset += ctx.getBoundingClientRect().height;
    return inset;
  }

  Panel.prototype.refreshLayout = function () {
    document.documentElement.style.setProperty(
      "--qd-listen-bar-h",
      this.barHeight() + "px",
    );
    document.documentElement.style.setProperty(
      "--qd-listen-scroll-offset",
      Math.ceil(topInset()) + 12 + "px",
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
      var inset = topInset() + 12;
      var floor = window.innerHeight - this.barHeight() - 12;
      var rect = cur.el.getBoundingClientRect();
      // A verse taller than the band is aligned to its top (the Arabic,
      // then the translation below it); a shorter one only moves when
      // any part of it is hidden under the header or the bar.
      if (rect.top < inset || rect.bottom > floor) {
        window.scrollTo({
          top: Math.max(0, window.scrollY + rect.top - inset),
          behavior: reducedMotion() ? "auto" : "smooth",
        });
      }
    }
  };

  Panel.prototype.voiceLanguage = function () {
    var v = voiceById(this.engine.translationId);
    return v ? v.language : "Translation";
  };

  // The audio-mode choice (Arabic / <language> / Arabic + <language>),
  // offered only once the chosen language's recording is confirmed.
  Panel.prototype.addEnglishControl = function () {
    var row = this.host.querySelector(".listen-options");
    if (!row) return;
    var self = this;
    var select = row.querySelector("[data-listen-mode]");
    if (!select) {
      var label = document.createElement("label");
      label.className = "listen-mode-label";
      label.textContent = "Audio ";
      select = document.createElement("select");
      select.className = "listen-mode-select";
      select.setAttribute("data-listen-mode", "");
      select.setAttribute("aria-label", "What to hear");
      select.addEventListener("change", function () {
        self.engine.setMode(select.value);
        saveMode(self.engine.mode);
      });
      label.appendChild(select);
      var voice = row.querySelector("[data-listen-voice]");
      row.insertBefore(label, voice ? voice.parentNode : null);
    }
    var lang = window.qdEsc(this.voiceLanguage());
    select.innerHTML =
      '<option value="ar">Arabic</option>' +
      '<option value="en">' + lang + " only</option>" +
      '<option value="ar-en">Arabic + ' + lang + "</option>";
    this.render(this.engine.state());
    this.refreshLayout();
  };

  Panel.prototype.removeModeControl = function () {
    var select = this.host.querySelector("[data-listen-mode]");
    if (select && select.parentNode) select.parentNode.remove();
  };

  Panel.prototype.voiceMarkup = function () {
    var cur = this.engine.translationId;
    return (
      '<label class="listen-mode-label">Translation voice ' +
      '<select class="listen-mode-select" data-listen-voice aria-label="Translation voice, heard after each verse\'s Arabic">' +
      voices()
        .map(function (v) {
          return (
            '<option value="' + window.qdEsc(v.edition) + '"' +
            (v.edition === cur ? " selected" : "") + ">" +
            window.qdEsc(v.language + (v.reader && v.reader !== v.language ? " · " + v.reader : "")) +
            "</option>"
          );
        })
        .join("") +
      "</select></label>"
    );
  };

  Panel.prototype.chooseVoice = function (id) {
    if (!voiceById(id) || id === this.engine.translationId) return;
    saveVoice(id);
    this._voiceChosen = true;
    this.removeModeControl();
    var note = this.support && this.support.querySelector("[data-listen-english-status]");
    if (note) note.textContent = "Checking the " + voiceById(id).language + " recording…";
    this.engine.setTranslation(id);
  };

  Panel.prototype.showEnglishStatus = function () {
    var note = this.support && this.support.querySelector("[data-listen-english-status]");
    if (!note) return;
    var v = voiceById(this.engine.translationId) || voiceById("en.walk");
    var english = v.edition === "en.walk";
    note.innerHTML =
      window.qdEsc(v.language) + " audio is the fixed verse-by-verse edition alquran.cloud names " +
      "<code>" + window.qdEsc(v.edition) + "</code>" +
      (v.reader && v.reader !== v.language ? " · " + window.qdEsc(v.reader) : "") +
      ". It may differ from the written translation you selected. " +
      "The recording's rights holder and license are not established by the registry or CDN; " +
      '<a href="/sources#' + (english ? "english-audio-source" : "translation-audio-source") + '">source details</a> ' +
      '<span class="badge pending" data-source-ids="' +
      (english ? "islamic-network-audio-en" : "islamic-network-audio-translations") +
      '" aria-label="Pending" tabindex="0" title="Pending · recording rights unresolved">○</span>.';
    if (window.qdCiteEnhance) window.qdCiteEnhance(this.support);
  };

  Panel.prototype.showEnglishUnavailable = function () {
    var note = this.support && this.support.querySelector("[data-listen-english-status]");
    if (!note) return;
    var lang = this.voiceLanguage();
    var wanted = storedMode();
    note.textContent =
      lang + " audio is unavailable right now, so only the Arabic " +
      "recitation will play." +
      (wanted === "ar"
        ? ""
        : wanted === "en"
          ? " You last chose " + lang + " audio; this sitting plays Arabic instead."
          : " You last chose Arabic and " + lang + "; this sitting plays the Arabic legs only.") +
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
      // Everything a reader sets once per sitting lives in this sheet,
      // opened from the bar. The bar itself carries only what is pressed
      // repeatedly: previous, play, next, and where you are.
      '<div class="listen-sheet" id="listenSheet" data-listen-sheet hidden>' +
      '<div class="listen-sheet-head">' +
      '<h3 class="listen-title">Listen to ' +
      window.qdEsc(this.title) +
      "</h3>" +
      '<button type="button" class="button secondary listen-btn listen-sheet-close" data-listen-close aria-label="Close listening options">✕</button>' +
      "</div>" +
      '<p class="listen-time t-annotation" data-listen-time hidden></p>' +
      '<div class="listen-options">' +
      '<button type="button" class="button secondary listen-reciter-btn" data-listen-reciter aria-label="Change Arabic reciter">🎤 Choose reciter</button>' +
      this.voiceMarkup() +
      // Reflect is not transport, so it is not in the transport group.
      '<button type="button" class="button secondary listen-btn listen-reflect-btn" data-listen-reflect>✎ Reflect on this verse</button>' +
      this.replayLink() +
      "</div>" +
      '<div class="listen-extra" role="group" aria-label="Listening options">' +
      '<button type="button" class="button secondary listen-btn" data-listen-repeat aria-pressed="false">↻ Repeat off</button>' +
      '<button type="button" class="button secondary listen-btn" data-listen-speed aria-label="Playback speed">1×</button>' +
      '<button type="button" class="button secondary listen-btn" data-listen-sleep aria-pressed="false">☾ Sleep timer off</button>' +
      "</div>" +
      '<div data-listen-support-slot></div>' +
      "</div>" +
      '<div class="listen-progress" aria-hidden="true"><span data-listen-progress></span></div>' +
      '<div class="listen-bar">' +
      '<div class="listen-controls" role="group" aria-label="Recitation transport">' +
      '<button type="button" class="button secondary listen-btn" data-listen-prev aria-label="Previous verse">⏮</button>' +
      '<button type="button" class="button btn-primary listen-btn listen-play" data-listen-play aria-label="Play">▶</button>' +
      '<button type="button" class="button secondary listen-btn" data-listen-next aria-label="Next verse">⏭</button>' +
      "</div>" +
      '<div class="listen-where">' +
      '<p class="listen-now" data-listen-now>—</p>' +
      '<p class="listen-pos t-annotation" data-listen-pos></p>' +
      "</div>" +
      '<button type="button" class="button secondary listen-btn listen-more" data-listen-more aria-expanded="false" aria-controls="listenSheet" aria-label="Listening options: reciter, language, repeat, speed, sleep timer">⋯</button>' +
      "</div>" +
      '<p class="listen-status" data-listen-status role="status" aria-live="polite" hidden></p>'
    );
  };

  // Replay is the same recitation shown as it unfolds: recurring roots
  // light up verse by verse and a transcribed outline's sections appear
  // at their pivots. It shares these listening choices, so it is one
  // step from here rather than a second player to learn.
  Panel.prototype.replayLink = function () {
    var first = this.items[0];
    if (!first) return "";
    return (
      '<a class="button secondary listen-btn" data-listen-replay href="/replay?s=' +
      first.surah + '&v=' + first.ayah + '">Watch it unfold</a>'
    );
  };

  Panel.prototype.toggleSheet = function (open) {
    var sheet = this.el("sheet");
    var more = this.el("more");
    if (!sheet || !more) return;
    var next = typeof open === "boolean" ? open : sheet.hidden;
    sheet.hidden = !next;
    more.setAttribute("aria-expanded", String(next));
    if (next) {
      this._timeKey = this.engine.reciterId() + "|" + this.engine.mode;
      this.paintTime();
    }
    if (next) {
      var close = this.el("close");
      if (close) close.focus({ preventScroll: true });
    } else if (open === false) {
      more.focus({ preventScroll: true });
    }
  };

  // How long the Arabic recitation of this passage takes with the chosen
  // reciter: the sum of each verse's measured duration
  // (data/recitation/verse-seconds/, scripts/build-recitation-pace.mjs).
  // Fetched only when the sheet opens, once per reciter. Hidden when the
  // timing is unavailable or only the translation is playing.
  var verseSeconds = {};
  Panel.prototype.paintTime = function () {
    var line = this.el("time");
    if (!line) return;
    var self = this;
    var id = this.engine.reciterId();
    if (this.engine.mode === "en" || !this.items.length) {
      line.hidden = true;
      return;
    }
    if (!verseSeconds[id]) {
      verseSeconds[id] = fetch("/data/recitation/verse-seconds/" + encodeURIComponent(id) + ".json").then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
      verseSeconds[id].catch(function () {
        delete verseSeconds[id];
      });
    }
    verseSeconds[id].then(
      function (secs) {
        if (self.engine.reciterId() !== id) return;
        var total = 0;
        for (var i = 0; i < self.items.length; i++) {
          var v = secs[self.items[i].arNumber - 1];
          if (typeof v !== "number") {
            line.hidden = true;
            return;
          }
          total += v;
        }
        var mins = total / 60;
        var text =
          mins < 1
            ? "under a minute"
            : mins < 90
              ? "about " + Math.round(mins) + " min"
              : "about " + Math.floor(mins / 60) + " h " + Math.round(mins % 60) + " min";
        line.textContent =
          "Arabic recitation: " + text + " with " + self.reciterName() +
          (self.engine.mode === "ar-en" ? ", plus the translation" : "") +
          " at normal speed.";
        line.hidden = false;
      },
      function () {
        line.hidden = true;
      },
    );
  };

  // Sleep timer: off, 15, 30, 60 minutes. It pauses; it never unloads,
  // so a reader who wakes to silence presses play and resumes where
  // the recitation stopped.
  var SLEEP_STEPS = [0, 15, 30, 60];

  Panel.prototype.cycleSleep = function () {
    var cur = this._sleepMins || 0;
    var next = SLEEP_STEPS[(SLEEP_STEPS.indexOf(cur) + 1) % SLEEP_STEPS.length];
    this.setSleep(next ? Date.now() + next * 60000 : 0, next);
  };

  Panel.prototype.setSleep = function (deadline, mins) {
    var self = this;
    clearTimeout(this._sleepTimer);
    clearInterval(this._sleepTick);
    this._sleepAt = deadline || 0;
    this._sleepMins = deadline ? mins || Math.ceil((deadline - Date.now()) / 60000) : 0;
    if (this._sleepAt) {
      this._sleepTimer = setTimeout(function () {
        if (self.engine.playing) self.engine.toggle();
        self._sleepAt = 0;
        self._sleepMins = 0;
        clearInterval(self._sleepTick);
        self._error = "Paused by the sleep timer. Press play to continue.";
        self.render(self.engine.state());
      }, Math.max(0, this._sleepAt - Date.now()));
      this._sleepTick = setInterval(function () {
        self.paintSleep();
      }, 30000);
    }
    this.paintSleep();
  };

  Panel.prototype.paintSleep = function () {
    var b = this.el("sleep");
    if (!b) return;
    var left = this._sleepAt ? Math.max(1, Math.ceil((this._sleepAt - Date.now()) / 60000)) : 0;
    b.textContent = left ? "☾ Sleep in " + left + " min" : "☾ Sleep timer off";
    b.setAttribute("aria-pressed", String(!!left));
    b.setAttribute(
      "aria-label",
      left
        ? "Sleep timer: pauses in " + left + " minutes. Press to change."
        : "Sleep timer off. Press for 15 minutes.",
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
      '<kbd>[</kbd> <kbd>]</kbd> previous/next verse, <kbd>R</kbd> repeat (off, verse, passage), <kbd>Escape</kbd> closes this panel.</p>' +
      '<p class="caption-note">Recitation streams per verse from cdn.islamic.network, which receives normal connection data. Your listening preferences remain in this browser. <a href="/about#privacy">Privacy and offline details</a>.</p>' +
      '<p class="caption-note listen-en-note" data-listen-english-status role="status" aria-live="polite">Translation audio choices appear after the page confirms the chosen recording is available.</p>' +
      "</details>";
    var slot = this.host.querySelector("[data-listen-support-slot]");
    if (slot) slot.appendChild(box);
    else this.host.insertAdjacentElement("afterend", box);
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
      self.cycleRepeat();
    });
    this.el("sleep").addEventListener("click", function () {
      self.cycleSleep();
    });
    this.el("more").addEventListener("click", function () {
      self.toggleSheet();
      self.refreshLayout();
    });
    this.el("close").addEventListener("click", function () {
      self.toggleSheet(false);
    });
    this.el("speed").addEventListener("click", function () {
      self.engine.cycleSpeed();
    });
    this.el("reciter").addEventListener("click", function () {
      if (window.qdOpenReciter) window.qdOpenReciter();
    });
    this.el("voice").addEventListener("change", function (e) {
      self.chooseVoice(e.target.value);
    });
    this.el("reflect").addEventListener("click", function () {
      if (self.engine.playing) self.engine.toggle();
      // The editor opens under the verse; the sheet would cover it.
      self.toggleSheet(false);
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
        self.cycleRepeat();
      } else if (e.key === "Escape") {
        var sheet = self.el("sheet");
        if (sheet && !sheet.hidden) {
          e.preventDefault();
          self.toggleSheet(false);
        }
      }
    };
    document.addEventListener("keydown", this._onKey);
  };

  // Off, then this verse, then the whole passage, then off.
  Panel.prototype.cycleRepeat = function () {
    var e = this.engine;
    if (!e.repeat && !e.loop) {
      e.loop = false;
      e.setRepeat(true);
    } else if (e.repeat) {
      e.repeat = false;
      e.setLoop(true);
    } else {
      e.repeat = false;
      e.setLoop(false);
    }
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
      loop: e.loop,
      sleepAt: this._sleepAt || 0,
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
    e.loop = !!snap.loop;
    e.armed = snap.armed;
    if (snap.sleepAt && snap.sleepAt > Date.now()) this.setSleep(snap.sleepAt);
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

  // The #listen deep link: the bar is always on screen, so this only
  // puts the keyboard on Play.
  Panel.prototype.jumpTo = function () {
    try {
      var play = this.el("play");
      if (play) play.focus({ preventScroll: true });
    } catch (e) {}
  };

  Panel.prototype.destroy = function () {
    clearTimeout(this._sleepTimer);
    clearInterval(this._sleepTick);
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

  window.qdListenTeardown = function () {
    var host = document.getElementById("listenPanel");
    if (player) {
      carry = player.snapshot();
      player.destroy();
      player = null;
    }
    window.qdListenPanel = null;
    window.qdListenPlayer = null;
    document.documentElement.classList.remove("qd-has-listen");
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
    document.documentElement.classList.add("qd-has-listen");
    player.refreshLayout();
    if (location.hash === "#listen" && !window.__qdListenLanded) {
      window.__qdListenLanded = true;
      player.jumpTo();
    }
  };
})();
