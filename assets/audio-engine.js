// audio-engine.js — the site's one sequential recitation transport.
//
// Before this existed the site had three players and none of them did the
// whole job: read.html rendered a native <audio controls> per verse (286
// of them on al-Baqarah, no English, no sequencing), replay.js walked a
// surah in Arabic only with play/prev/next, and listen.js walked a juz
// with everything but was gated to juz. Three implementations meant three
// places to fix an audio bug, and the per-reciter bitrate bug proved the
// point by being present in all three at once.
//
// This module owns PLAYBACK and nothing else — no DOM, no markup, no
// styling. It takes a list of verses, walks them, and reports state
// through callbacks. read.html's Listen panel and replay.html's guided
// replay are two UIs over this one engine.
//
// Three rules it exists to keep in one place:
//
//   ONE ELEMENT. All playback goes through a single <audio> for the whole
//   session. iOS grants an element permission to play on a user gesture
//   and keeps that grant across later src changes; a fresh Audio() per
//   verse loses it and the sitting dies after the first clip. The second
//   element here never plays — it only warms the next clip's bytes.
//
//   THE GLOBAL AYAH NUMBER is the key. numberInSurah restarts at 1 at
//   every surah boundary and 28 of the 30 juz cross one, so a passage is
//   addressed by the 1-6236 global number, which is also the CDN's
//   filename.
//
//   BITRATES ARE DISCOVERED, NOT ASSUMED. Arabic URLs come from
//   assets/app.js's qdReciteUrl, which carries each reciter's registered
//   bitrate. The English edition's bitrate is not registered anywhere, so
//   it is probed. See the note on TRANSLATION_AUDIO.
(function () {
  "use strict";

  var CDN = "https://cdn.islamic.network/quran/audio";

  // Translation audio: every edition alquran.cloud registers as
  // type=versebyverse in a language other than Arabic AND that
  // cdn.islamic.network actually serves, read off the API and the CDN by
  // scripts/check-audio-editions.mjs on a networked runner, 2026-09-26
  // (early, middle and final clips sampled). Surah-by-surah editions
  // (one file per surah: three in English, one Burmese) and "translation"
  // editions (Persian, Turkish) cannot be sequenced verse by verse, and
  // ru.kuliev-audio-2 is registered but served at no bitrate, so none of
  // those are here. `bitrate` is the directory the CDN served it from;
  // the others stay as fallbacks in case the CDN reorganises. `reader`
  // is the name the registry gives, verbatim.
  //
  // Mode names still say "en" ("en", "ar-en", the leg "en") because
  // English came first and the names are stored in readers' browsers;
  // read them as "the translation leg".
  var TRANSLATION_AUDIO = [
    { edition: "en.walk", lang: "en", language: "English", reader: "Ibrahim Walk", bitrate: 192 },
    { edition: "ur.khan", lang: "ur", language: "Urdu", reader: "Shamshad Ali Khan", bitrate: 64 },
    { edition: "fr.leclerc", lang: "fr", language: "French", reader: "Youssouf Leclerc", bitrate: 128 },
    { edition: "ru.kuliev-audio", lang: "ru", language: "Russian", reader: "Elmir Kuliev by 1MuslimApp", bitrate: 128 },
    { edition: "zh.chinese", lang: "zh", language: "Chinese", reader: "Chinese", bitrate: 128 },
    { edition: "kk.khalifahaltai-audio", lang: "kk", language: "Kazakh", reader: "Khalifah Altai", bitrate: 128 },
    { edition: "uz.sodik-audio", lang: "uz", language: "Uzbek", reader: "Muhammad Sodik Muhammad Yusuf", bitrate: 128 },
  ];
  var DEFAULT_TRANSLATION = "en.walk";
  var BITRATES = [192, 128, 64, 32];
  var PROBE_AYAH = 1;
  var PROBE_TIMEOUT_MS = 8000;
  var PROBE_KEY = "qd_listen_tr_v1:";
  var SPEEDS = [0.75, 1, 1.25, 1.5];

  function translationById(id) {
    for (var i = 0; i < TRANSLATION_AUDIO.length; i++)
      if (TRANSLATION_AUDIO[i].edition === id) return TRANSLATION_AUDIO[i];
    return null;
  }

  function candidatesFor(id) {
    var t = translationById(id) || translationById(DEFAULT_TRANSLATION);
    return [t.bitrate]
      .concat(BITRATES.filter(function (b) { return b !== t.bitrate; }))
      .map(function (b) { return { edition: t.edition, bitrate: b }; });
  }

  function enUrl(cand, arNumber) {
    return CDN + "/" + cand.bitrate + "/" + cand.edition + "/" + arNumber + ".mp3";
  }

  // Probe via an <audio> element, never fetch(): the site's CSP allows
  // cdn.islamic.network under media-src but NOT under connect-src, so a
  // HEAD or GET here would be blocked by the browser and read as "the
  // edition is missing" on a site where it is present.
  //
  // One probe per edition per page session, shared by every engine
  // instance and remembered in sessionStorage, so switching passage does
  // not re-walk the candidate list.
  var probes = {};
  function probeEdition(id) {
    if (!translationById(id)) id = DEFAULT_TRANSLATION;
    if (probes[id]) return probes[id];
    var key = PROBE_KEY + id;
    var cached = null;
    try {
      cached = sessionStorage.getItem(key);
    } catch (e) {}
    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        probes[id] = Promise.resolve(parsed && parsed.edition ? parsed : null);
        return probes[id];
      } catch (e) {}
    }
    var remaining = candidatesFor(id);
    function attempt() {
      if (!remaining.length) {
        try {
          sessionStorage.setItem(key, JSON.stringify({ edition: null }));
        } catch (e) {}
        return Promise.resolve(null);
      }
      var cand = remaining.shift();
      return new Promise(function (resolve) {
        var probe = new Audio();
        probe.preload = "metadata";
        probe.muted = true;
        var settled = false;
        var timer = setTimeout(function () {
          finish(false);
        }, PROBE_TIMEOUT_MS);
        function finish(ok) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          probe.removeAttribute("src");
          try {
            probe.load();
          } catch (e) {}
          resolve(ok);
        }
        probe.addEventListener("loadedmetadata", function () {
          // A zero-length resource is a 404 body the browser decoded as
          // empty media on some CDNs; treat it as absent.
          finish(isFinite(probe.duration) && probe.duration > 0);
        });
        probe.addEventListener("error", function () {
          finish(false);
        });
        probe.src = enUrl(cand, PROBE_AYAH);
      }).then(function (ok) {
        if (!ok) return attempt();
        try {
          sessionStorage.setItem(key, JSON.stringify(cand));
        } catch (e) {}
        return cand;
      });
    }
    probes[id] = attempt();
    return probes[id];
  }

  function probeEnglish() {
    return probeEdition(DEFAULT_TRANSLATION);
  }

  // ONE pair of media elements for the whole page session, shared by
  // every engine ever created on it. iOS grants an element permission to
  // play on a user gesture and keeps that grant across later src changes
  // on the SAME element; an element built inside an async callback (a
  // passage re-render restoring a sitting that was playing) has no grant
  // and its play() is refused. So engines come and go; the elements stay.
  // Each engine attaches its own listeners and removes them in destroy(),
  // so a retired engine never hears the element it no longer owns.
  var sharedAudio = null;
  var sharedPreload = null;
  var sharedOwner = null;
  function claimElements(engine) {
    if (!sharedAudio) {
      sharedAudio = new Audio();
      sharedAudio.preload = "auto";
      sharedPreload = new Audio();
      sharedPreload.preload = "auto";
      sharedPreload.muted = true;
    }
    // Only one passage is ever on screen; a live owner that was not torn
    // down is a leak, not a second listener.
    if (sharedOwner && sharedOwner !== engine && !sharedOwner.dead) sharedOwner.destroy();
    sharedOwner = engine;
    return [sharedAudio, sharedPreload];
  }

  function Engine(opts) {
    opts = opts || {};
    this.onState = opts.onState || function () {};
    this.onEnglish = opts.onEnglish || function () {};
    // Called once the probe SETTLES, with the edition or with null.
    // onEnglish fires only on a hit, so a UI built on it alone can never
    // tell "still probing" from "probed and absent" -- which is how the
    // Read page came to show "English audio choices appear after the
    // page confirms the recording is available" forever on any session
    // where the CDN was unreachable.
    this.onEnglishResolved = opts.onEnglishResolved || function () {};
    this.labelFor = opts.labelFor || null;
    this.album = opts.album || "Divine Discourses";

    this.items = [];
    this.idx = 0;
    this.leg = "ar";
    this.mode = "ar"; // "ar" | "en" | "ar-en"
    // The translation leg's edition: {edition, bitrate} once probed and
    // found. Named `english` because English came first; it holds
    // whichever language translationId names.
    this.english = null;
    this.translationId = translationById(opts.translation)
      ? opts.translation
      : DEFAULT_TRANSLATION;
    this.repeat = false;
    // Loop the whole passage: after its last step, start again at its
    // first verse. Independent of `repeat`, which holds one verse; a
    // reader memorising a short surah wants the surah on a loop, not
    // one verse forever or one pass and silence.
    this.loop = false;
    this.rate = 1;
    this.playing = false;
    this.armed = false; // a user has pressed play at least once
    this.dead = false;
    this.ended = false; // the last step of the passage played out
    this._switching = false;
    this._started = false; // the CURRENT clip reached "playing"
    this._handlers = null;

    var els = claimElements(this);
    this.audio = els[0];
    this.preloadEl = els[1];

    this._wire();
    var self = this;
    // Non-blocking on purpose: the caller's UI must render and be usable
    // before this settles. A miss can cost a timeout per candidate.
    this._resolveTranslation(false);
  }

  Engine.prototype._resolveTranslation = function (resume) {
    var self = this;
    var id = this.translationId;
    probeEdition(id).then(function (found) {
      // A later choice supersedes this one; its own probe reports.
      if (self.dead || self.translationId !== id) return;
      self.english = found || null;
      if (found) self.onEnglish(found);
      self.onEnglishResolved(self.english);
      if (resume && found) self.playCurrent();
      else self.emit();
    });
  };

  // Change the language of the translation leg. The sitting holds its
  // verse; if a translation clip was playing it pauses, and resumes in
  // the new language once that edition is confirmed.
  Engine.prototype.setTranslation = function (id) {
    if (!translationById(id) || id === this.translationId) return;
    var resume = this.playing && this.leg === "en";
    if (resume) {
      this.audio.pause();
      this.playing = false;
    }
    this.translationId = id;
    this.english = null;
    this.emit();
    this._resolveTranslation(resume);
  };

  Engine.prototype.translation = function () {
    return translationById(this.translationId);
  };

  Engine.prototype.setItems = function (items) {
    this.items = (items || []).filter(function (it) {
      return it && isFinite(it.arNumber) && it.arNumber > 0;
    });
    if (this.idx >= this.items.length) this.idx = 0;
    this.emit();
    return this.items.length;
  };

  Engine.prototype.current = function () {
    return this.items[this.idx] || null;
  };

  Engine.prototype.state = function () {
    return {
      idx: this.idx,
      item: this.current(),
      total: this.items.length,
      leg: this.leg,
      mode: this.mode,
      repeat: this.repeat,
      loop: this.loop,
      rate: this.rate,
      playing: this.playing,
      armed: this.armed,
      ended: this.ended,
      hasEnglish: !!this.english,
      translation: this.translationId,
    };
  };

  Engine.prototype.emit = function () {
    if (this.dead) return;
    this.onState(this.state());
    this.updateMediaSession();
  };

  Engine.prototype.reciterId = function () {
    return (window.qdState && window.qdState.reciter) || "ar.husary";
  };

  Engine.prototype.urlFor = function (item, leg) {
    if (!item) return null;
    if (leg === "en") {
      if (!this.english) return null;
      return enUrl(this.english, item.arNumber);
    }
    // assets/app.js owns the per-reciter bitrate; never rebuild this here.
    return window.qdReciteUrl(this.reciterId(), item.arNumber);
  };

  Engine.prototype.startLeg = function () {
    return this.mode === "en" ? "en" : "ar";
  };

  // What follows (idx, leg) in the current mode. This is the whole
  // sequencing contract: what plays, and what plays after it.
  Engine.prototype.nextStep = function (idx, leg) {
    if (this.mode === "en") {
      if (leg !== "en") return { idx: idx, leg: "en" };
      if (idx + 1 < this.items.length) return { idx: idx + 1, leg: "en" };
      return null;
    }
    if (this.mode === "ar-en" && leg === "ar" && this.english)
      return { idx: idx, leg: "en" };
    if (idx + 1 < this.items.length) return { idx: idx + 1, leg: "ar" };
    return null;
  };

  Engine.prototype.preloadNext = function () {
    var step = this.nextStep(this.idx, this.leg);
    if (!step) return;
    var url = this.urlFor(this.items[step.idx], step.leg);
    if (!url || this.preloadEl.getAttribute("src") === url) return;
    this.preloadEl.src = url;
    try {
      this.preloadEl.load();
    } catch (e) {}
  };

  Engine.prototype.label = function () {
    var cur = this.current();
    if (!cur) return "";
    if (this.labelFor) return this.labelFor(cur);
    return cur.surah + ":" + cur.ayah;
  };

  Engine.prototype.updateMediaSession = function () {
    if (!("mediaSession" in navigator) || !window.MediaMetadata) return;
    try {
      var reciter =
        (window.qdReciters || []).filter(
          function (r) {
            return r.id === this.reciterId();
          }.bind(this),
        )[0] || null;
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: this.label(),
        artist:
          this.leg === "en"
            ? (this.translation() ? this.translation().language : "Translation") + " translation audio"
            : (reciter && reciter.name) || "Recitation",
        album: this.album,
      });
      navigator.mediaSession.playbackState = this.playing ? "playing" : "paused";
    } catch (e) {}
  };

  // One code path for "put this clip in the element and play it", so the
  // single-element rule holds everywhere.
  Engine.prototype.playCurrent = function () {
    if (this.dead) return;
    var url = this.urlFor(this.current(), this.leg);
    if (!url) {
      // English-only is offered only after the English edition probes
      // successfully. If it later disappears, stop rather than silently
      // substituting Arabic for a mode the reader explicitly chose.
      this.playing = false;
      this.emit();
      return;
    }
    var self = this;
    if (this.audio.getAttribute("src") !== url) {
      // A src swap emits `pause` before the new clip starts; without this
      // flag the pause handler reads that as the reader pausing and
      // repaints the transport mid-sitting.
      this._switching = true;
      this._started = false;
      this.audio.src = url;
    }
    this.ended = false;
    this.audio.playbackRate = this.rate;
    var p = this.audio.play();
    if (p && p.catch)
      p.catch(function () {
        // Autoplay refused (no gesture yet) or the clip 404'd. Stop
        // rather than spin: the reader presses play again.
        self.playing = false;
        self.emit();
      });
    this.playing = true;
    this.armed = true;
    this.emit();
    this.preloadNext();
  };

  Engine.prototype.advance = function () {
    if (this.repeat) {
      // Repeat holds the VERSE, not the clip. Arabic+English still hands
      // Arabic to English before the verse repeats; single-language modes
      // simply replay that language for the same verse.
      var within = this.nextStep(this.idx, this.leg);
      if (within && within.idx === this.idx) {
        this.leg = within.leg;
        return this.playCurrent();
      }
      this.leg = this.startLeg();
      try {
        this.audio.currentTime = 0;
      } catch (e) {}
      return this.playCurrent();
    }
    var step = this.nextStep(this.idx, this.leg);
    if (!step && this.loop && this.items.length) {
      this.idx = 0;
      this.leg = this.startLeg();
      return this.playCurrent();
    }
    if (!step) {
      // The sitting played out. Callers that mark a passage finished
      // (‘replay from start’, last-read bookkeeping) read this off
      // state(); a mere pause never sets it.
      this.ended = true;
      this.playing = false;
      this.audio.pause();
      this.emit();
      return;
    }
    this.idx = step.idx;
    this.leg = step.leg;
    this.playCurrent();
  };

  Engine.prototype.toggle = function () {
    if (this.playing) {
      this.audio.pause();
      this.playing = false;
      this.emit();
    } else {
      this.playCurrent();
    }
  };

  // Aim the transport at a verse WITHOUT loading its clip: what a page
  // does on first paint or when the reader picks a verse before pressing
  // play. seek() loads the clip so play is instant; this costs nothing.
  Engine.prototype.point = function (i) {
    if (!this.items.length) return;
    this.idx = Math.min(Math.max(i, 0), this.items.length - 1);
    this.leg = this.startLeg();
    this.ended = false;
    this.emit();
  };

  Engine.prototype.seek = function (i) {
    if (!this.items.length) return;
    this.idx = Math.min(Math.max(i, 0), this.items.length - 1);
    this.leg = this.startLeg();
    this.ended = false;
    this.armed = true;
    if (this.playing) this.playCurrent();
    else {
      this.audio.pause();
      var url = this.urlFor(this.current(), this.leg);
      if (url && this.audio.getAttribute("src") !== url) this.audio.src = url;
      this.emit();
      this.preloadNext();
    }
  };

  Engine.prototype.go = function (delta) {
    this.seek(this.idx + delta);
  };

  Engine.prototype.setRepeat = function (on) {
    this.repeat = !!on;
    this.emit();
  };

  Engine.prototype.setLoop = function (on) {
    this.loop = !!on;
    this.emit();
  };

  Engine.prototype.setMode = function (mode) {
    var nextMode = mode === "en" && this.english ? "en" : mode === "ar-en" ? "ar-en" : "ar";
    if (nextMode === this.mode) {
      this.emit();
      return;
    }
    this.mode = nextMode;

    // Switching language never skips the current verse. If audio is
    // playing, swap the current clip in place; if paused, point the next
    // Play at the selected mode's first leg.
    var desired = nextMode === "en" ? "en" : nextMode === "ar" ? "ar" : this.leg;
    if (this.playing && this.leg !== desired) {
      this.leg = desired;
      return this.playCurrent();
    }
    if (!this.playing) this.leg = this.startLeg();
    this.emit();
    this.preloadNext();
  };

  Engine.prototype.cycleSpeed = function () {
    var i = SPEEDS.indexOf(this.rate);
    this.rate = SPEEDS[(i + 1) % SPEEDS.length];
    this.audio.playbackRate = this.rate;
    this.emit();
  };

  Engine.prototype._wire = function () {
    var self = this;
    var h = (this._handlers = {
      ended: function () {
        self.advance();
      },
      pause: function () {
        if (self._switching || self.audio.ended) return;
        self.playing = false;
        self.emit();
      },
      play: function () {
        self._switching = false;
        self.playing = true;
        self.emit();
      },
      playing: function () {
        self._switching = false;
        self._started = true;
      },
      error: function () {
        // A clip that fails MID-sitting must not end the sitting: skip
        // it. A clip that never loaded must not skip either — the next
        // is as likely to fail, and advancing on every load error walks
        // the whole passage in silence, one verse per error. Stop, and
        // say so through state; the reader presses play again.
        if (self._started && self.playing) return self.advance();
        self.playing = false;
        self.emit();
      },
    });
    Object.keys(h).forEach(function (ev) {
      self.audio.addEventListener(ev, h[ev]);
    });

    // Lock screen, headset, car stereo. Registered per engine; the last
    // engine created owns them, which is correct because only one
    // passage is ever on screen.
    if ("mediaSession" in navigator) {
      var handlers = {
        play: function () {
          if (!self.dead && !self.playing) self.toggle();
        },
        pause: function () {
          if (!self.dead && self.playing) self.toggle();
        },
        previoustrack: function () {
          if (!self.dead) self.go(-1);
        },
        nexttrack: function () {
          if (!self.dead) self.go(1);
        },
      };
      Object.keys(handlers).forEach(function (action) {
        try {
          navigator.mediaSession.setActionHandler(action, handlers[action]);
        } catch (e) {}
      });
    }
  };

  Engine.prototype.destroy = function () {
    var self = this;
    this.dead = true;
    this._switching = false;
    this.playing = false;
    this.armed = false;
    // Detach first: the pause below would otherwise reach this engine's
    // own pause handler, and the element outlives the engine.
    Object.keys(this._handlers || {}).forEach(function (ev) {
      self.audio.removeEventListener(ev, self._handlers[ev]);
    });
    this._handlers = null;
    if (sharedOwner === this) sharedOwner = null;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.preloadEl.removeAttribute("src");
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.playbackState = "none";
      } catch (e) {}
    }
  };

  window.qdAudioEngine = {
    create: function (opts) {
      return new Engine(opts);
    },
    SPEEDS: SPEEDS,
    // Exposed for scripts/verify-site.mjs, which drives the sequencing
    // directly: headless Chromium decodes no recitation, so the state
    // machine is asserted rather than the audio.
    _probeEnglish: probeEnglish,
    translations: TRANSLATION_AUDIO,
    translationById: translationById,
  };
})();
