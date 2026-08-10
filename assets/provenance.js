/* Progressive enhancement for the provenance apparatus.

   The cards already work without this file. They are real <details>
   rendered at build time by scripts/build-provenance.mjs, so with
   JavaScript disabled every statement, source, ribbon and table
   fallback is still on the page and still operable. Nothing here is
   required to read anything.

   What this adds:
     - one card open at a time, so a long page does not become a wall
     - Escape closes the open card and returns focus to its claim mark
     - clicking a claim mark toggles its card, with aria-expanded kept
       truthful on the mark

   Deliberately absent: any measurement. No getBoundingClientRect, no
   offsetWidth, no positioning arithmetic. The cards expand in document
   flow, which is why they need none of it. */
(function () {
  "use strict";

  var cards = [].slice.call(document.querySelectorAll("details.claim-card"));
  if (!cards.length) return;

  function markFor(card) {
    var block = card.closest(".claim-block");
    return block ? block.querySelector(".claim") : null;
  }

  // Make each mark a real control. Done here rather than in the
  // generated HTML so that a no-JS reader is never shown a button that
  // cannot do anything -- without this script the statement is just
  // text, and the <details> below it is the affordance.
  cards.forEach(function (card) {
    var mark = markFor(card);
    if (!mark) return;
    mark.setAttribute("role", "button");
    mark.setAttribute("tabindex", "0");
    mark.setAttribute("aria-expanded", card.open ? "true" : "false");
    mark.setAttribute("aria-controls", card.id);

    function toggle() {
      card.open = !card.open;
    }
    mark.addEventListener("click", toggle);
    mark.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        toggle();
      }
    });

    card.addEventListener("toggle", function () {
      mark.setAttribute("aria-expanded", card.open ? "true" : "false");
      if (!card.open) return;
      cards.forEach(function (other) {
        if (other !== card && other.open) other.open = false;
      });
    });
  });

  // Escape closes the open card and puts focus back where the reader
  // left it. Scoped to the apparatus: the handler does nothing unless a
  // claim card is actually open, so it cannot swallow Escape from a
  // dialog or the settings panel.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var open = cards.filter(function (c) {
      return c.open;
    });
    if (!open.length) return;
    e.stopPropagation();
    open.forEach(function (c) {
      c.open = false;
      // Return focus to the mark that opened this card. Unconditional,
      // not only when focus happens to sit inside the card: a reader who
      // opened a card with the mouse and then pressed Escape still needs
      // a defined place to be, and the mark is where their attention
      // was. Without this, focus stays wherever it was before the click
      // -- which in testing was an unrelated glossary term.
      var mark = markFor(c);
      if (mark) mark.focus();
    });
  });
})();
