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
  // Carried across a re-render. Changing depth or translations rebuilds
  // the whole passage, and without this a reader who is forty verses into
  // al-Baqarah and switches translation is dropped back to verse 1 with
  // the audio stopped. Keyed by the passage's first and last global ayah
  // numbers, so it is restored onto the SAME passage and never onto a
  // different one the reader navigated to.
  var carry = null;

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

  // The surah's display name comes from the one canonical dataset
  // (assets/surahs.js) rather than a data- attribute, so no surah name
  // has to survive a second round of HTML escaping on its way here.
  function surahNameFor(n) {
    var rec = (window.SURAHS || []).filter(function (x) {
      return x.id === n;
    })[0];
    return (rec && rec.translit) || "";
  }

  // Every verse div carries the global ayah number read.html renders into
  // data-ar-number — the one identifier stable across a surah boundary,
  // which numberInSurah is not.
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

  // What the panel calls the passage. Derived from the verses actually on
  // screen, so it stays true for a range that got clamped or a juz that
  // crossed into a second surah.
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
      onEnglish: function () {
        self.addEnglishToggle();
      },
    });
    this.engine.setItems(items);
  }

  Panel.prototype.el = function (name) {
    return this.host.querySelector("[data-listen-" + name + "]");
  };

  Panel.prototype.render = function (st) {
    // A torn-down panel can still be called back into: pausing its audio
    // emits `pause` after the host was emptied, and the play() promise
    // settles later still.
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
    if (mode) {
      var arEn = st.mode === "ar-en";
      mode.setAttribute("aria-pressed", String(arEn));
      mode.textContent = arEn ? "Arabic + English" : "Arabic only";
    }
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
    // Scroll only when the POSITION moves. Every state change emits
    // (speed, repeat, pause, the English toggle appearing), and a reader
    // who scrolled ahead to read must not be dragged back by any of them.
    var cur = items[st.idx];
    var key = st.idx + ":" + st.leg;
    if (cur && st.armed && key !== this._scrolledTo) {
      this._scrolledTo = key;
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

  // Added only after a clip from the English edition has actually loaded,
  // so the reader is never shown a control that cannot do anything.
  Panel.prototype.addEnglishToggle = function () {
    var row = this.host.querySelector(".listen-controls");
    if (!row || row.querySelector("[data-listen-mode]")) return;
    var self = this;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "button secondary listen-btn";
    btn.setAttribute("data-listen-mode", "");
    btn.setAttribute("aria-pressed", "false");
    btn.textContent = "Arabic only";
    btn.addEventListener("click", function () {
      self.engine.setMode(self.engine.mode === "ar-en" ? "ar" : "ar-en");
    });
    row.appendChild(btn);
    // The engine may already be in Arabic+English (a restored sitting)
    // by the time the probe lets this control exist: paint it from
    // state, never from a default.
    this.render(this.engine.state());

    // The reader is about to hear one English rendering while reading
    // another, and nothing on the page would otherwise say so. The spoken
    // text is a fixed edition; the written one is theirs to choose from
    // sixteen. Naming which translation is recited would be a claim this
    // project has not verified, so this says what IS known.
    var note = document.createElement("p");
    note.className = "caption-note listen-en-note";
    note.innerHTML =
      "English audio is a single fixed recording — the edition " +
      "alquran.cloud's registry names <code>en.walk</code> · Ibrahim Walk, " +
      "read verse by verse. The English you see is whichever translation " +
      "you have chosen, so the spoken and written wording are two " +
      "different renderings and will not match word for word. Who holds " +
      "this recording, and under what license, is stated by neither the " +
      'registry nor the CDN, so <a href="/sources">Sources</a> carries it ' +
      '<span class="badge pending" data-source-ids="islamic-network-audio-en" aria-label="Pending" tabindex="0" title="Pending · awaiting triangulation from a second independent source">○</span> Pending.';
    this.host.appendChild(note);
    if (window.qdCiteEnhance) window.qdCiteEnhance(this.host);
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
      '<div class="listen-controls" role="group" aria-label="Recitation transport">' +
      '<button type="button" class="button secondary listen-btn" data-listen-prev aria-label="Previous verse">‹ Verse</button>' +
      '<button type="button" class="button btn-primary listen-btn" data-listen-play aria-label="Play">▶ Play</button>' +
      '<button type="button" class="button secondary listen-btn" data-listen-next aria-label="Next verse">Verse ›</button>' +
      '<button type="button" class="button secondary listen-btn" data-listen-repeat aria-pressed="false" aria-label="Repeat this verse">↻ Repeat</button>' +
      '<button type="button" class="button secondary listen-btn" data-listen-speed aria-label="Playback speed">1×</button>' +
      "</div>" +
      '<p class="caption-note listen-keys">Keys <kbd>Space</kbd> play/pause, ' +
      "<kbd>[</kbd> <kbd>]</kbd> previous/next verse, <kbd>R</kbd> repeat. " +
      "The verse being recited is highlighted and scrolled into view, so " +
      "you can follow the text while it plays.</p>" +
      '<p class="caption-note">Recitation audio streams per verse from ' +
      "cdn.islamic.network as it plays, which receives normal connection " +
      "data. Nothing about what you listen to is stored or sent anywhere " +
      'else. <a href="/about#privacy">Privacy and offline details</a>.</p>'
    );
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

    // Shortcuts, in the same shape read.html's existing ones use (see
    // assets/app.js initFocusMode): ignored inside a field or a modal,
    // and Space only once the reader has actually started listening, so
    // it keeps scrolling the page for everyone who has not.
    this._onKey = function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target && e.target.matches && e.target.matches("input,select,textarea"))
        return;
      if (document.querySelector('[aria-modal="true"]')) return;
      // The panel HOST is reused across passages, so its connectedness
      // cannot retire a superseded panel. Identity can.
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

  // Each verse gets a button that starts the transport AT that verse,
  // replacing the native <audio controls> read.html used to render per
  // verse — 286 of them on al-Baqarah, none of which knew about any
  // other verse.
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
      mode: e.mode,
      rate: e.rate,
      repeat: e.repeat,
      armed: e.armed,
      playing: e.playing,
    };
  };

  Panel.prototype.restore = function (snap) {
    if (!snap || snap.sig !== signature(this.items)) return;
    var e = this.engine;
    e.idx = Math.min(snap.idx, this.items.length - 1);
    e.mode = snap.mode;
    e.rate = snap.rate;
    e.repeat = snap.repeat;
    e.armed = snap.armed;
    e.audio.playbackRate = e.rate;
    e.emit();
    if (snap.playing) e.playCurrent();
  };

  Panel.prototype.destroy = function () {
    // The document-level shortcut handler closes over this panel and,
    // through it, every verse node of the passage; left registered it
    // would keep all of that alive across every re-render.
    if (this._onKey) document.removeEventListener("keydown", this._onKey);
    this._onKey = null;
    this.engine.destroy();
    this.items.forEach(function (it) {
      it.el.classList.remove("is-listening", "is-listening-en");
      it.el.removeAttribute("aria-current");
    });
  };

  // read.html calls this after every passage render, with the juz number
  // when the passage is a juz and null otherwise. Any rendered passage
  // gets a transport; an empty one tears the transport down.
  // Called by read.html BEFORE it replaces the rendered verses: at that
  // moment the old verse nodes are still in the DOM, so a sync would
  // happily rebuild a transport for a passage that is about to vanish.
  window.qdListenTeardown = function () {
    var host = document.getElementById("listenPanel");
    if (player) {
      carry = player.snapshot();
      player.destroy();
      player = null;
    }
    window.qdListenPanel = null;
    window.qdListenPlayer = null;
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
    player.wire();
    player.wireVerseButtons();
    player.render(player.engine.state());
    // Test seam and debugging handle. scripts/verify-site.mjs drives the
    // transport through this: headless Chromium decodes no recitation, so
    // the sequencing is asserted against the state machine directly
    // rather than against audio that never plays.
    window.qdListenPanel = player;
    window.qdListenPlayer = player.engine;
    // The English toggle arrives through onEnglish, which the probe fires
    // for every engine — a promise already settled still resolves its
    // new .then — so nothing needs asking here.
    if (window.qdCiteEnhance) window.qdCiteEnhance(host);
    // Put the reader back where they were if this is the same passage
    // re-rendered (a depth or translation change), and nowhere otherwise.
    player.restore(carry);
    carry = null;
    // A link ending in #listen (the homepage's "Listen to this surah")
    // lands on the transport, once, with Play focused so one keypress
    // starts the sitting. Autoplay is never attempted: browsers require a
    // gesture and the reader supplies it.
    if (location.hash === "#listen" && !window.__qdListenLanded) {
      window.__qdListenLanded = true;
      try {
        host.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
        var play = player.el("play");
        if (play) play.focus({ preventScroll: true });
      } catch (e) {}
    }
  };
})();
