// listen.js — sequential recitation for a whole juz on read.html.
//
// Why this exists as its own player rather than the per-verse <audio>
// controls already in the passage: reading a juz is a 100-to-250-verse
// sitting that crosses a surah boundary in 28 of the 30 juz. Pressing
// play on each verse in turn is not a way to listen to one; the reader
// needs a single transport that walks the passage, keeps the screen on
// the verse being recited, and survives the phone locking.
//
// What it plays is the SAME audio the per-verse controls already use:
// cdn.islamic.network's per-ayah MP3s, keyed by the GLOBAL ayah number
// (1-6236) that read.html renders into data-ar-number. No new host, so
// no CSP change — media-src already names cdn.islamic.network.
//
// The English leg is NOT assumed to exist. alquran.cloud registers an
// English translation-audio edition, but this project could not confirm
// its identifier, bitrate directory, reciter, or license from a
// sandboxed session, and the site's citation rule is to omit what cannot
// be confirmed rather than guess it. So the English track is discovered
// at runtime (probeEnglish below) and the Arabic+English toggle simply
// does not appear when the probe fails. Arabic-only listening never
// depends on that probe. scripts/check-audio-editions.mjs is the CI-side
// half: it asks the API what the English audio edition actually is, on a
// runner with real outbound network, so /sources and /credits can one day
// carry a real name and license instead of a Pending badge.
//
// Mobile Safari: ONE <audio> element does all playback for the whole
// session. iOS grants an element permission to play on a user gesture
// and keeps it across later src changes on that same element; building a
// fresh Audio() per verse loses the grant and stops the sitting dead
// after the first clip. The second element here (preloadEl) never plays
// — it only warms the next clip's bytes in the HTTP cache.
(function () {
  "use strict";

  var CDN = "https://cdn.islamic.network/quran/audio";
  // Arabic reciters are served at 128kbps (the per-verse players in
  // read.html have used that path since the audio feature shipped).
  var AR_BITRATE = 128;
  // The English edition's identifier and bitrate directory are both
  // unconfirmed, so every plausible combination is probed and the first
  // that answers wins. Nothing here is presented to the reader as a
  // named source; see the header note.
  var EN_CANDIDATES = [
    { edition: "en.walk", bitrate: 128 },
    { edition: "en.walk", bitrate: 64 },
  ];
  var PROBE_AYAH = 1;
  var PROBE_TIMEOUT_MS = 8000;
  var PROBE_KEY = "qd_listen_en_v1";
  var SPEEDS = [0.75, 1, 1.25, 1.5];

  function clipUrl(edition, bitrate, arNumber) {
    return CDN + "/" + bitrate + "/" + edition + "/" + arNumber + ".mp3";
  }

  // Probe via an <audio> element, never fetch(): the page's CSP allows
  // cdn.islamic.network under media-src but NOT under connect-src, so a
  // HEAD request here would be blocked by the browser and read as "the
  // edition is missing" on a site where it is present.
  function probeEnglish() {
    var cached = null;
    try {
      cached = sessionStorage.getItem(PROBE_KEY);
    } catch (e) {}
    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        return Promise.resolve(parsed && parsed.edition ? parsed : null);
      } catch (e) {}
    }
    var remaining = EN_CANDIDATES.slice();
    function attempt() {
      if (!remaining.length) {
        try {
          sessionStorage.setItem(PROBE_KEY, JSON.stringify({ edition: null }));
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
          // A zero-length response is a 404 page the browser decoded as
          // an empty media resource on some CDNs; treat it as absent.
          finish(isFinite(probe.duration) && probe.duration > 0);
        });
        probe.addEventListener("error", function () {
          finish(false);
        });
        probe.src = clipUrl(cand.edition, cand.bitrate, PROBE_AYAH);
      }).then(function (ok) {
        if (!ok) return attempt();
        try {
          sessionStorage.setItem(PROBE_KEY, JSON.stringify(cand));
        } catch (e) {}
        return cand;
      });
    }
    return attempt();
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

  // The surah's display name comes from the one canonical dataset
  // (assets/surahs.js) rather than a data- attribute, so no surah name
  // has to survive a second round of HTML escaping on its way here.
  function surahNameFor(n) {
    var rec = (window.SURAHS || []).filter(function (x) {
      return x.id === n;
    })[0];
    return (rec && rec.translit) || "";
  }

  var player = null;

  function Player(panel, juz) {
    this.panel = panel;
    this.juz = juz;
    this.items = [];
    this.idx = 0;
    this.leg = "ar";
    this.mode = "ar"; // "ar" | "ar-en"; upgraded to ar-en only if probe wins
    this.english = null; // {edition, bitrate} once probed
    this.repeat = false;
    this.rate = 1;
    this.playing = false;
    this.armed = false; // a user has pressed play at least once
    this.audio = new Audio();
    this.audio.preload = "auto";
    this.preloadEl = new Audio();
    this.preloadEl.preload = "auto";
    this.preloadEl.muted = true;
  }

  // Read the rendered passage. Every verse div carries the global ayah
  // number read.html renders into data-ar-number — the one identifier
  // that is stable across a surah boundary, which numberInSurah is not.
  Player.prototype.collect = function () {
    var nodes = document.querySelectorAll("#verseContainer .verse[data-ar-number]");
    this.items = Array.prototype.map.call(nodes, function (el) {
      return {
        el: el,
        arNumber: parseInt(el.getAttribute("data-ar-number"), 10),
        surah: parseInt(el.getAttribute("data-surah"), 10),
        ayah: parseInt(el.getAttribute("data-ayah"), 10),
        surahName: surahNameFor(parseInt(el.getAttribute("data-surah"), 10)),
      };
    }).filter(function (it) {
      return isFinite(it.arNumber) && it.arNumber > 0;
    });
    if (this.idx >= this.items.length) this.idx = 0;
    return this.items.length;
  };

  Player.prototype.current = function () {
    return this.items[this.idx] || null;
  };

  Player.prototype.reciterId = function () {
    return (window.qdState && window.qdState.reciter) || "ar.husary";
  };

  Player.prototype.urlFor = function (item, leg) {
    if (!item) return null;
    if (leg === "en") {
      if (!this.english) return null;
      return clipUrl(this.english.edition, this.english.bitrate, item.arNumber);
    }
    return clipUrl(this.reciterId(), AR_BITRATE, item.arNumber);
  };

  // The clip that follows (item, leg) in the current mode, which is what
  // gets preloaded and what "ended" advances to.
  Player.prototype.nextStep = function (idx, leg) {
    if (this.mode === "ar-en" && leg === "ar" && this.english)
      return { idx: idx, leg: "en" };
    if (idx + 1 < this.items.length) return { idx: idx + 1, leg: "ar" };
    return null;
  };

  Player.prototype.preloadNext = function () {
    var step = this.nextStep(this.idx, this.leg);
    if (!step) return;
    var url = this.urlFor(this.items[step.idx], step.leg);
    if (!url || this.preloadEl.getAttribute("src") === url) return;
    this.preloadEl.src = url;
    try {
      this.preloadEl.load();
    } catch (e) {}
  };

  Player.prototype.highlight = function () {
    if (this.dead) return;
    var items = this.items;
    for (var i = 0; i < items.length; i++) {
      var on = i === this.idx && this.armed;
      items[i].el.classList.toggle("is-listening", on);
      items[i].el.classList.toggle("is-listening-en", on && this.leg === "en");
      if (on) items[i].el.setAttribute("aria-current", "true");
      else items[i].el.removeAttribute("aria-current");
    }
    var cur = this.current();
    if (cur && this.armed) {
      try {
        cur.el.scrollIntoView({
          block: "center",
          behavior: reducedMotion() ? "auto" : "smooth",
        });
      } catch (e) {
        cur.el.scrollIntoView();
      }
    }
  };

  Player.prototype.label = function () {
    var cur = this.current();
    if (!cur) return "Juz " + this.juz;
    return (
      (cur.surahName ? cur.surahName + " " : "") + cur.surah + ":" + cur.ayah
    );
  };

  Player.prototype.updateMediaSession = function () {
    if (!("mediaSession" in navigator)) return;
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
            ? "English translation audio"
            : (reciter && reciter.name) || "Recitation",
        album: "Juz " + this.juz + " · Divine Discourses",
      });
      navigator.mediaSession.playbackState = this.playing
        ? "playing"
        : "paused";
    } catch (e) {}
  };

  Player.prototype.render = function () {
    // A torn-down player can still be called back into: pausing its
    // audio emits a `pause` event after qdListenSync has already emptied
    // the panel, and the play() promise settles later still. Both used
    // to reach in for controls that are no longer there.
    if (this.dead || !this.panel.querySelector("[data-listen-play]")) return;
    var cur = this.current();
    var pos = this.items.length
      ? this.idx + 1 + " of " + this.items.length
      : "0";
    this.panel.querySelector("[data-listen-now]").textContent = cur
      ? this.label() + (this.leg === "en" && this.armed ? " · English" : "")
      : "—";
    this.panel.querySelector("[data-listen-pos]").textContent =
      "Verse " + pos;
    var playBtn = this.panel.querySelector("[data-listen-play]");
    playBtn.textContent = this.playing ? "⏸ Pause" : "▶ Play";
    playBtn.setAttribute("aria-label", this.playing ? "Pause" : "Play");
    var repeatBtn = this.panel.querySelector("[data-listen-repeat]");
    repeatBtn.setAttribute("aria-pressed", String(this.repeat));
    var speedBtn = this.panel.querySelector("[data-listen-speed]");
    speedBtn.textContent = this.rate + "×";
    speedBtn.setAttribute("aria-label", "Playback speed " + this.rate + "×");
    var modeBtn = this.panel.querySelector("[data-listen-mode]");
    if (modeBtn) {
      var arEn = this.mode === "ar-en";
      modeBtn.setAttribute("aria-pressed", String(arEn));
      modeBtn.textContent = arEn ? "Arabic + English" : "Arabic only";
    }
    this.updateMediaSession();
  };

  // One code path for "put this clip in the element and play it", so the
  // single-element rule above holds everywhere.
  Player.prototype.playCurrent = function () {
    if (this.dead) return;
    var url = this.urlFor(this.current(), this.leg);
    if (!url) {
      // No English clip for this verse (or the edition vanished
      // mid-sitting): fall through to the next Arabic verse rather than
      // stalling with a silent player.
      if (this.leg === "en") {
        this.leg = "ar";
        return this.advance();
      }
      return;
    }
    var self = this;
    if (this.audio.getAttribute("src") !== url) {
      // A src swap emits `pause` before the new clip starts. Without
      // this flag the pause handler below reads that as the reader
      // pausing and repaints the button mid-sitting.
      this._switching = true;
      this.audio.src = url;
    }
    this.audio.playbackRate = this.rate;
    var p = this.audio.play();
    if (p && p.catch)
      p.catch(function () {
        // Autoplay refused (no gesture yet) or the clip 404'd. Stop
        // rather than spin: the reader presses play again.
        self.playing = false;
        self.render();
      });
    this.playing = true;
    this.armed = true;
    this.highlight();
    this.render();
    this.preloadNext();
  };

  Player.prototype.advance = function () {
    if (this.repeat) {
      // Repeat holds the VERSE, not the clip. In Arabic+English mode
      // that means the Arabic still hands off to the English leg; only
      // the step that would leave this verse wraps back to its Arabic.
      var within = this.nextStep(this.idx, this.leg);
      if (within && within.idx === this.idx) {
        this.leg = within.leg;
        return this.playCurrent();
      }
      this.leg = "ar";
      try {
        this.audio.currentTime = 0;
      } catch (e) {}
      return this.playCurrent();
    }
    var step = this.nextStep(this.idx, this.leg);
    if (!step) {
      this.playing = false;
      this.audio.pause();
      this.render();
      return;
    }
    this.idx = step.idx;
    this.leg = step.leg;
    this.playCurrent();
  };

  Player.prototype.toggle = function () {
    if (this.playing) {
      this.audio.pause();
      this.playing = false;
      this.render();
    } else {
      this.playCurrent();
    }
  };

  Player.prototype.go = function (delta) {
    if (!this.items.length) return;
    var next = this.idx + delta;
    if (next < 0) next = 0;
    if (next > this.items.length - 1) next = this.items.length - 1;
    this.idx = next;
    this.leg = "ar";
    this.armed = true;
    if (this.playing) this.playCurrent();
    else {
      this.audio.pause();
      var url = this.urlFor(this.current(), "ar");
      if (url && this.audio.getAttribute("src") !== url) this.audio.src = url;
      this.highlight();
      this.render();
      this.preloadNext();
    }
  };

  Player.prototype.cycleSpeed = function () {
    var i = SPEEDS.indexOf(this.rate);
    this.rate = SPEEDS[(i + 1) % SPEEDS.length];
    this.audio.playbackRate = this.rate;
    this.render();
  };

  Player.prototype.wire = function () {
    var self = this;
    this.audio.addEventListener("ended", function () {
      self.advance();
    });
    this.audio.addEventListener("pause", function () {
      if (self._switching || self.audio.ended) return;
      self.playing = false;
      self.render();
    });
    this.audio.addEventListener("play", function () {
      self._switching = false;
      self.playing = true;
      self.render();
    });
    this.audio.addEventListener("playing", function () {
      self._switching = false;
    });
    // A clip that fails mid-sitting must not end the sitting.
    this.audio.addEventListener("error", function () {
      if (self.playing) self.advance();
    });

    this.panel
      .querySelector("[data-listen-play]")
      .addEventListener("click", function () {
        self.toggle();
      });
    this.panel
      .querySelector("[data-listen-prev]")
      .addEventListener("click", function () {
        self.go(-1);
      });
    this.panel
      .querySelector("[data-listen-next]")
      .addEventListener("click", function () {
        self.go(1);
      });
    this.panel
      .querySelector("[data-listen-repeat]")
      .addEventListener("click", function () {
        self.repeat = !self.repeat;
        self.render();
      });
    this.panel
      .querySelector("[data-listen-speed]")
      .addEventListener("click", function () {
        self.cycleSpeed();
      });
    var modeBtn = this.panel.querySelector("[data-listen-mode]");
    if (modeBtn)
      modeBtn.addEventListener("click", function () {
        self.mode = self.mode === "ar-en" ? "ar" : "ar-en";
        if (self.mode === "ar" && self.leg === "en") {
          self.leg = "ar";
          if (self.playing) self.advance();
        }
        self.render();
        self.preloadNext();
      });

    // Lock screen / headset / car stereo. Registered once; the metadata
    // is refreshed on every clip change in updateMediaSession.
    if ("mediaSession" in navigator) {
      var handlers = {
        play: function () {
          if (!self.playing) self.toggle();
        },
        pause: function () {
          if (self.playing) self.toggle();
        },
        previoustrack: function () {
          self.go(-1);
        },
        nexttrack: function () {
          self.go(1);
        },
      };
      Object.keys(handlers).forEach(function (action) {
        try {
          navigator.mediaSession.setActionHandler(action, handlers[action]);
        } catch (e) {}
      });
    }

    // Shortcuts, in the same shape read.html's existing ones use (see
    // assets/app.js initFocusMode): ignored inside a field or a modal,
    // and only once the reader has actually started listening, so Space
    // keeps scrolling the page for everyone who has not.
    document.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target && e.target.matches && e.target.matches("input,select,textarea"))
        return;
      if (document.querySelector('[aria-modal="true"]')) return;
      // The panel HOST is reused across juz reads, so its connectedness
      // cannot retire a superseded player. Identity can: only the player
      // currently on the page answers the keyboard.
      if (window.qdListenPlayer !== self) return;
      if (e.key === " " || e.key === "Spacebar") {
        if (!self.armed) return;
        e.preventDefault();
        self.toggle();
      } else if (e.key === "[") {
        e.preventDefault();
        self.go(-1);
      } else if (e.key === "]") {
        e.preventDefault();
        self.go(1);
      } else if (e.key === "r" || e.key === "R") {
        if (!self.armed) return;
        e.preventDefault();
        self.repeat = !self.repeat;
        self.render();
      }
    });
  };

  Player.prototype.stop = function () {
    this.dead = true;
    this._switching = false;
    this.audio.pause();
    this.playing = false;
    this.armed = false;
    this.audio.removeAttribute("src");
    this.preloadEl.removeAttribute("src");
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.playbackState = "none";
      } catch (e) {}
    }
  };

  function panelHtml(juz, hasEnglish) {
    return (
      '<div class="listen-head">' +
      '<h3 class="listen-title">Listen to juz ' +
      juz +
      "</h3>" +
      '<p class="listen-now" data-listen-now>—</p>' +
      '<p class="listen-pos t-annotation" data-listen-pos></p>' +
      "</div>" +
      '<div class="listen-controls" role="group" aria-label="Recitation transport">' +
      '<button type="button" class="button secondary listen-btn" data-listen-prev aria-label="Previous verse">‹ Verse</button>' +
      '<button type="button" class="button btn-primary listen-btn" data-listen-play aria-label="Play">▶ Play</button>' +
      '<button type="button" class="button secondary listen-btn" data-listen-next aria-label="Next verse">Verse ›</button>' +
      '<button type="button" class="button secondary listen-btn" data-listen-repeat aria-pressed="false" aria-label="Repeat this verse">↻ Repeat</button>' +
      '<button type="button" class="button secondary listen-btn" data-listen-speed aria-label="Playback speed">1×</button>' +
      (hasEnglish
        ? '<button type="button" class="button secondary listen-btn" data-listen-mode aria-pressed="false">Arabic only</button>'
        : "") +
      "</div>" +
      '<p class="caption-note listen-keys">Keys <kbd>Space</kbd> play/pause, ' +
      "<kbd>[</kbd> <kbd>]</kbd> previous/next verse, <kbd>R</kbd> repeat. " +
      "The verse being recited is highlighted and scrolled into view.</p>" +
      '<p class="caption-note">Recitation audio streams per verse from ' +
      "cdn.islamic.network as it plays, which receives normal connection " +
      "data. Nothing about what you listen to is stored or sent anywhere " +
      "else. <a href=\"/about#privacy\">Privacy and offline details</a>.</p>" +
      (hasEnglish
        ? '<p class="caption-note listen-en-note">English translation audio is served by the ' +
          "same CDN as an audio edition of a published English translation. " +
          "This project has not yet confirmed its reciter or license against " +
          "the source, so it carries a " +
          '<span class="badge pending" data-source-ids="islamic-network-audio" aria-label="Pending" tabindex="0" title="Pending · awaiting confirmation from the source">○</span> ' +
          'Pending label on <a href="/sources">Sources</a> rather than a name this project cannot yet stand behind.</p>'
        : "")
    );
  }

  // read.html calls this after every passage render. A juz read gets a
  // player; anything else tears one down, so switching from ?j=15 to a
  // single verse does not leave a transport pointing at a passage that
  // is no longer on the page.
  window.qdListenSync = function (juz) {
    var host = document.getElementById("listenPanel");
    if (!host) return;
    var audioOn = !(
      window.qdState &&
      window.qdState.features &&
      window.qdState.features.showAudio === false
    );
    if (!juz || !audioOn) {
      if (player) {
        player.stop();
        player = null;
        window.qdListenPlayer = null;
      }
      host.innerHTML = "";
      host.hidden = true;
      return;
    }
    // Same juz, re-render (depth or translation change): keep the
    // transport and its position, just re-bind to the new verse nodes.
    if (player && player.juz === juz && host.firstChild) {
      var wasPlaying = player.playing;
      player.collect();
      player.highlight();
      player.render();
      if (wasPlaying && !player.playing) player.playCurrent();
      return;
    }
    if (player) player.stop();
    host.hidden = false;
    probeEnglish().then(function (english) {
      // The probe is async and a reader can change passage while it
      // runs; only build if this juz is still the one on screen.
      if (!document.getElementById("listenPanel")) return;
      host.innerHTML = panelHtml(juz, !!english);
      player = new Player(host, juz);
      player.english = english;
      player.collect();
      player.wire();
      player.render();
      // Test seam and debugging handle. scripts/verify-site.mjs drives
      // the transport through this: headless Chromium will not decode a
      // real recitation, so the sequencing (Arabic leg, English leg, next
      // verse, repeat) is asserted against the state machine directly
      // rather than against audio that never plays.
      window.qdListenPlayer = player;
      if (window.qdCiteEnhance) window.qdCiteEnhance(host);
    });
  };
})();
