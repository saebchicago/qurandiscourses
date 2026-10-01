/* Verse image card (Read: a verse's ⋯ menu, "Image").
   ───────────────────────────────────────────────────
   Draws one verse into a 1080x1350 PNG in the browser: the Arabic (the
   Tanzil text the page shows), the first translation on screen with its
   translator named, a credit line for both, the reference, and the
   address that opens it. No
   server and no third-party service: the canvas is the page's own.

   A preview opens first, with Share and Save. Sharing a file needs a
   fresh tap (Safari drops the permission across the font load and the
   PNG encode), so the share happens on the preview's own button. */
(function () {
  "use strict";

  var W = 1080;
  var H = 1350;
  var PAD = 96;
  var COLORS = { bg: "#f6efe2", card: "#fffaf0", ink: "#2b1d0e", muted: "#6b5a45", accent: "#7c5a2c", line: "#e2d3b8" };

  function wrap(ctx, text, maxWidth) {
    var words = String(text).split(/\s+/).filter(Boolean);
    var lines = [];
    var line = "";
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = words[i];
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  // Shrink a block's font until it fits its share of the card, down to
  // a floor; past the floor, cut with an ellipsis (2:282 is one verse).
  function fitBlock(ctx, text, family, start, floor, maxWidth, maxHeight, lineFactor) {
    var size = start;
    var lines;
    for (; size >= floor; size -= 2) {
      ctx.font = size + "px " + family;
      lines = wrap(ctx, text, maxWidth);
      if (lines.length * size * lineFactor <= maxHeight) return { size: size, lines: lines, cut: false };
    }
    size = floor;
    ctx.font = size + "px " + family;
    lines = wrap(ctx, text, maxWidth);
    var max = Math.max(1, Math.floor(maxHeight / (size * lineFactor)));
    if (lines.length > max) {
      lines = lines.slice(0, max);
      lines[max - 1] = lines[max - 1].replace(/\s*\S*$/, "") + " …";
      return { size: size, lines: lines, cut: true };
    }
    return { size: size, lines: lines, cut: false };
  }

  function verseData(verse) {
    var s = Number(verse.getAttribute("data-surah"));
    var a = Number(verse.getAttribute("data-ayah"));
    var arEl = verse.querySelector("p.ar");
    var tr = verse.querySelector(".translation .text");
    var label = verse.querySelector(".translation .label");
    var meta = (window.SURAHS || []).filter(function (x) {
      return x.id === s;
    })[0];
    var ar = arEl ? arEl.textContent.replace(/\s+/g, " ").trim() : "";
    // Read shows the basmala at the head of each surah's first verse; it
    // is not part of that verse (al-Fatihah aside), so the card, which
    // names the verse, leaves it off.
    if (a === 1 && s !== 1 && /^بِسْمِ\s/.test(ar)) ar = ar.split(" ").slice(4).join(" ");
    return {
      s: s,
      a: a,
      ar: ar,
      tr: tr ? tr.textContent.replace(/\s+/g, " ").trim() : "",
      trBy: label ? label.textContent.split("·")[0].trim() : "",
      trDir: tr && tr.getAttribute("dir") === "rtl" ? "rtl" : "ltr",
      name: meta ? meta.translit : "Surah " + s,
    };
  }

  function draw(d) {
    var c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    var ctx = c.getContext("2d");
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = COLORS.card;
    ctx.fillRect(48, 48, W - 96, H - 96);
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 3;
    ctx.strokeRect(48, 48, W - 96, H - 96);

    var inner = W - PAD * 2;
    // Reference, top.
    ctx.fillStyle = COLORS.accent;
    ctx.font = "600 34px Inter, system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.direction = "ltr";
    ctx.fillText(d.name + " " + d.s + ":" + d.a, PAD, PAD + 40);

    // Arabic, right-aligned and right-to-left.
    var arTop = PAD + 110;
    var arFit = fitBlock(ctx, d.ar, "Amiri, 'Scheherazade New', serif", 68, 40, inner, 520, 1.75);
    ctx.font = arFit.size + "px Amiri, 'Scheherazade New', serif";
    ctx.fillStyle = COLORS.ink;
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    var y = arTop + arFit.size;
    arFit.lines.forEach(function (l) {
      ctx.fillText(l, W - PAD, y);
      y += arFit.size * 1.75;
    });

    // Translation.
    var cut = arFit.cut;
    if (d.tr) {
      y += 20;
      ctx.strokeStyle = COLORS.line;
      ctx.beginPath();
      ctx.moveTo(PAD, y);
      ctx.lineTo(W - PAD, y);
      ctx.stroke();
      y += 30;
      var trRoom = H - PAD - 196 - y;
      var trFit = fitBlock(ctx, d.tr, "'Cormorant Garamond', Georgia, serif", 46, 28, inner, Math.max(trRoom, 80), 1.4);
      cut = cut || trFit.cut;
      ctx.font = trFit.size + "px 'Cormorant Garamond', Georgia, serif";
      ctx.fillStyle = COLORS.ink;
      ctx.direction = d.trDir;
      ctx.textAlign = d.trDir === "rtl" ? "right" : "left";
      var x = d.trDir === "rtl" ? W - PAD : PAD;
      y += trFit.size;
      trFit.lines.forEach(function (l) {
        ctx.fillText(l, x, y);
        y += trFit.size * 1.4;
      });
    }

    // Footer: who the words come from (Tanzil's terms ask for its name
    // and tanzil.net wherever its text is used; the translator is named
    // as on the page), a note when the text was cut, and the address.
    ctx.direction = "ltr";
    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.muted;
    ctx.font = "28px Inter, system-ui, sans-serif";
    var foot = H - PAD - 20;
    var credit = "Arabic: Tanzil Project, tanzil.net" + (d.trBy ? " · Translation: " + d.trBy : "");
    while (ctx.measureText(credit).width > inner && credit.length > 40) credit = credit.slice(0, -2).replace(/\s*\S*$/, "") + "…";
    ctx.fillText(credit, PAD, foot - 46);
    if (cut) ctx.fillText("Shortened; read in full at the address below", PAD, foot - 92);
    ctx.fillStyle = COLORS.accent;
    ctx.font = "600 30px Inter, system-ui, sans-serif";
    ctx.fillText("divinediscourses.org/read?s=" + d.s + "&a=" + d.a, PAD, foot);
    return c;
  }

  function esc(v) {
    return window.qdEsc ? window.qdEsc(String(v)) : String(v).replace(/[&<>"']/g, "");
  }

  var dialog = null;
  function close() {
    if (!dialog) return;
    dialog.remove();
    dialog = null;
    document.documentElement.classList.remove("qd-card-open");
  }

  function preview(canvas, d) {
    close();
    var fileName = "divine-discourses-" + d.s + "-" + d.a + ".png";
    dialog = document.createElement("div");
    dialog.className = "verse-card-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Image of " + d.s + ":" + d.a);
    var url = canvas.toDataURL("image/png");
    var canShareFiles = false;
    try {
      canShareFiles =
        !!navigator.canShare &&
        navigator.canShare({ files: [new File([new Blob()], fileName, { type: "image/png" })] });
    } catch (e) {}
    dialog.innerHTML =
      '<div class="verse-card-box">' +
      '<img alt="' + esc(d.name + " " + d.s + ":" + d.a) + ' as an image" src="' + url + '">' +
      '<div class="verse-card-actions">' +
      (canShareFiles ? '<button type="button" class="button" data-card="share">Share image</button>' : "") +
      '<a class="button' + (canShareFiles ? " secondary" : "") + '" download="' + fileName + '" href="' + url + '">Save image</a>' +
      '<button type="button" class="button secondary" data-card="close">Close</button>' +
      "</div></div>";
    document.body.appendChild(dialog);
    document.documentElement.classList.add("qd-card-open");
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) return close();
      var b = e.target.closest && e.target.closest("[data-card]");
      if (!b) return;
      if (b.getAttribute("data-card") === "close") return close();
      canvas.toBlob(function (blob) {
        if (!blob) return;
        navigator
          .share({
            files: [new File([blob], fileName, { type: "image/png" })],
            title: d.name + " " + d.s + ":" + d.a,
          })
          .catch(function () {});
      }, "image/png");
    });
    var first = dialog.querySelector("[data-card], a.button");
    if (first) first.focus();
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && dialog) close();
  });

  window.qdVerseCard = function (verse) {
    var d = verseData(verse);
    if (!d.ar) return Promise.resolve(null);
    var fonts = document.fonts && document.fonts.load
      ? Promise.all([
          document.fonts.load("68px Amiri", d.ar.slice(0, 20)),
          document.fonts.load("46px 'Cormorant Garamond'"),
          document.fonts.load("600 34px Inter"),
        ]).catch(function () {})
      : Promise.resolve();
    return fonts.then(function () {
      var canvas = draw(d);
      preview(canvas, d);
      return canvas;
    });
  };
})();
